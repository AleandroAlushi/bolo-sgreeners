-- =============================================================================
-- Persistenza degli import di box score (fase finale della pipeline).
-- Il parsing avviene nell'app (src/lib/importers); qui arriva un payload già
-- normalizzato, validato e con i giocatori associati. Tutto in un'unica transazione.
--
-- Idempotenza:
--   * stesso file (hash SHA-256) già importato → nessuna scrittura, risposta 'duplicate'
--     (il tentativo resta comunque tracciato in imports);
--   * partita che ha già statistiche → errore 'match_already_imported' a meno di
--     overwrite = true: in quel caso le righe precedenti vengono sostituite e gli
--     import precedenti marcati 'superseded'.
-- Conflitti: il risultato ufficiale (CSI) non viene mai sovrascritto; se il file
-- riporta un punteggio o una data diversi, viene creata una riga in source_conflicts.
-- =============================================================================

create or replace function public.import_match_report(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_imp jsonb := coalesce(payload -> 'import', '{}'::jsonb);
  v_hash text := v_imp ->> 'file_hash';
  v_overwrite boolean := coalesce((payload ->> 'overwrite')::boolean, false);
  v_own uuid := (payload ->> 'own_team_id')::uuid;
  v_opp uuid;
  v_own_is_home boolean;
  v_dup uuid;
  v_source_id uuid;
  v_import_id uuid;
  v_file_own int := (payload -> 'result' ->> 'own')::int;
  v_file_opp int := (payload -> 'result' ->> 'opponent')::int;
  v_file_date date := (payload ->> 'file_date')::date;
  v_official_own int;
  v_official_opp int;
  v_lines int := 0;
  v_conflicts int := 0;
  v_existing_periods text;
  v_new_periods text;
  c jsonb;
begin
  if not (public.is_admin() or current_user in ('service_role', 'postgres')) then
    raise exception 'Operazione riservata agli amministratori' using errcode = '42501';
  end if;

  select * into v_match from public.matches where id = (payload ->> 'match_id')::uuid for update;
  if not found then
    raise exception 'Partita non trovata' using errcode = 'P0002', hint = 'match_not_found';
  end if;
  if v_own is null or v_own not in (v_match.home_team_id, v_match.away_team_id) then
    raise exception 'La squadra indicata non gioca questa partita' using hint = 'team_not_in_match';
  end if;
  v_own_is_home := v_match.home_team_id = v_own;
  v_opp := case when v_own_is_home then v_match.away_team_id else v_match.home_team_id end;

  -- 1. stesso file già importato
  if v_hash is not null then
    select id into v_dup from public.imports where file_hash = v_hash and status = 'completed';
    if found then
      insert into public.imports (kind, status, file_name, file_hash, file_size, parser, parser_version,
                                  season_id, match_id, created_by, error_message, completed_at)
      values ('match_report', 'duplicate', v_imp ->> 'file_name', v_hash, (v_imp ->> 'file_size')::int,
              v_imp ->> 'parser', v_imp ->> 'parser_version', (v_imp ->> 'season_id')::uuid, v_match.id,
              auth.uid(), 'File già importato (import ' || v_dup || ')', now());
      return jsonb_build_object('status', 'duplicate', 'existing_import_id', v_dup);
    end if;
  end if;

  -- 2. statistiche già presenti per la partita
  if exists (select 1 from public.player_match_stats where match_id = v_match.id)
     or exists (select 1 from public.team_match_stats where match_id = v_match.id) then
    if not v_overwrite then
      raise exception 'La partita ha già statistiche importate: conferma la sovrascrittura'
        using hint = 'match_already_imported';
    end if;
    delete from public.player_match_stats where match_id = v_match.id;
    delete from public.team_match_stats where match_id = v_match.id;
    update public.imports set status = 'superseded'
      where match_id = v_match.id and kind = 'match_report' and status = 'completed';
  end if;

  -- 3. fonte + audit
  insert into public.data_sources (kind, label, reference_date, source_key, notes)
  values (coalesce((payload -> 'source' ->> 'kind')::public.source_kind, 'html'),
          coalesce(payload -> 'source' ->> 'label', 'Box score importato'),
          coalesce(v_file_date, v_match.match_date),
          case when v_hash is not null then 'file:' || v_hash end,
          payload -> 'source' ->> 'notes')
  on conflict (source_key) do update set label = excluded.label
  returning id into v_source_id;

  insert into public.imports (kind, status, file_name, file_hash, file_size, storage_path, parser, parser_version,
                              season_id, match_id, source_id, parsed_payload, issues, created_by)
  values ('match_report', 'pending', v_imp ->> 'file_name', v_hash, (v_imp ->> 'file_size')::int,
          v_imp ->> 'storage_path', v_imp ->> 'parser', v_imp ->> 'parser_version',
          (v_imp ->> 'season_id')::uuid, v_match.id, v_source_id, v_imp -> 'parsed_payload',
          coalesce(v_imp -> 'issues', '[]'::jsonb), auth.uid())
  returning id into v_import_id;

  -- 4. statistiche giocatori (squadra nostra)
  insert into public.player_match_stats (
    match_id, team_id, player_id, raw_name, jersey_number, participation, is_starter, minutes, points,
    fgm, fga, fg3m, fg3a, ftm, fta, oreb, dreb, reb, ast, stl, tov, blk, pf, plus_minus, extra,
    source_id, import_id)
  select v_match.id, v_own, x.player_id, x.raw_name, x.jersey_number, coalesce(x.participation, 'played'),
         x.is_starter, x.minutes, x.points, x.fgm, x.fga, x.fg3m, x.fg3a, x.ftm, x.fta, x.oreb, x.dreb,
         x.reb, x.ast, x.stl, x.tov, x.blk, x.pf, x.plus_minus, coalesce(x.extra, '{}'::jsonb),
         v_source_id, v_import_id
  from jsonb_to_recordset(coalesce(payload -> 'player_stats', '[]'::jsonb)) as x(
    player_id uuid, raw_name text, jersey_number text, participation public.participation, is_starter boolean,
    minutes numeric, points int, fgm int, fga int, fg3m int, fg3a int, ftm int, fta int, oreb int, dreb int,
    reb int, ast int, stl int, tov int, blk int, pf int, plus_minus int, extra jsonb);
  get diagnostics v_lines = row_count;

  -- 5. totali di squadra (entrambe le squadre, se presenti)
  insert into public.team_match_stats (
    match_id, team_id, points, fgm, fga, fg3m, fg3a, ftm, fta, oreb, dreb, reb, ast, stl, tov, blk, pf,
    extra, source_id, import_id)
  select v_match.id, case when x.side = 'own' then v_own else v_opp end, x.points, x.fgm, x.fga, x.fg3m,
         x.fg3a, x.ftm, x.fta, x.oreb, x.dreb, x.reb, x.ast, x.stl, x.tov, x.blk, x.pf,
         coalesce(x.extra, '{}'::jsonb), v_source_id, v_import_id
  from jsonb_to_recordset(coalesce(payload -> 'team_stats', '[]'::jsonb)) as x(
    side text, points int, fgm int, fga int, fg3m int, fg3a int, ftm int, fta int, oreb int, dreb int,
    reb int, ast int, stl int, tov int, blk int, pf int, extra jsonb)
  where x.side in ('own', 'opponent');

  -- 6. risultato: il file lo imposta solo se manca un risultato ufficiale
  if v_file_own is not null and v_file_opp is not null then
    if v_match.home_score is null or v_match.away_score is null then
      update public.matches
        set home_score = case when v_own_is_home then v_file_own else v_file_opp end,
            away_score = case when v_own_is_home then v_file_opp else v_file_own end,
            status = case when status = 'scheduled' then 'played' else status end,
            result_source_id = v_source_id
        where id = v_match.id;
    else
      v_official_own := case when v_own_is_home then v_match.home_score else v_match.away_score end;
      v_official_opp := case when v_own_is_home then v_match.away_score else v_match.home_score end;
      if v_official_own <> v_file_own or v_official_opp <> v_file_opp then
        insert into public.source_conflicts (entity_type, entity_id, match_id, field, primary_source_id, primary_value,
                                             secondary_source_id, secondary_value, description)
        values ('match', v_match.id, v_match.id, 'score', v_match.result_source_id,
                v_official_own || '-' || v_official_opp, v_source_id, v_file_own || '-' || v_file_opp,
                'Il box score riporta un punteggio diverso dal risultato ufficiale (Sgreeners-avversari)')
        on conflict do nothing;
        v_conflicts := v_conflicts + 1;
      end if;
    end if;
  end if;

  -- 7. data
  if v_file_date is not null then
    if v_match.match_date is null then
      update public.matches set match_date = v_file_date where id = v_match.id;
    elsif v_match.match_date <> v_file_date then
      insert into public.source_conflicts (entity_type, entity_id, match_id, field, primary_source_id, primary_value,
                                           secondary_source_id, secondary_value, description)
      values ('match', v_match.id, v_match.id, 'match_date', v_match.schedule_source_id, v_match.match_date::text,
              v_source_id, v_file_date::text, 'La data del box score è diversa da quella del calendario')
      on conflict do nothing;
      v_conflicts := v_conflicts + 1;
    end if;
  end if;

  -- 8. parziali per quarto (il box score è fonte primaria; differenze con altre fonti → conflitto)
  if jsonb_array_length(coalesce(payload -> 'periods', '[]'::jsonb)) > 0 then
    select string_agg(p.period || ':' || p.points, ',' order by p.team_id = v_own desc, p.period)
      into v_existing_periods
      from public.match_period_scores p where p.match_id = v_match.id;
    select string_agg(x.period || ':' || x.points, ',' order by x.own desc, x.period)
      into v_new_periods
      from (
        select (e ->> 'period')::int as period, (e ->> 'own')::int as points, true as own
          from jsonb_array_elements(payload -> 'periods') e
        union all
        select (e ->> 'period')::int, (e ->> 'opponent')::int, false
          from jsonb_array_elements(payload -> 'periods') e
      ) x;
    if v_existing_periods is not null and v_existing_periods <> v_new_periods then
      insert into public.source_conflicts (entity_type, entity_id, match_id, field, primary_source_id, primary_value,
                                           secondary_source_id, secondary_value, description)
      values ('match', v_match.id, v_match.id, 'period_scores', v_source_id, v_new_periods,
              (select source_id from public.match_period_scores where match_id = v_match.id limit 1),
              v_existing_periods, 'Parziali per quarto diversi tra box score e altra fonte')
      on conflict do nothing;
      v_conflicts := v_conflicts + 1;
    end if;
    delete from public.match_period_scores where match_id = v_match.id;
    insert into public.match_period_scores (match_id, team_id, period, points, source_id)
    select v_match.id, v_own, (e ->> 'period')::int, (e ->> 'own')::int, v_source_id
      from jsonb_array_elements(payload -> 'periods') e
    union all
    select v_match.id, v_opp, (e ->> 'period')::int, (e ->> 'opponent')::int, v_source_id
      from jsonb_array_elements(payload -> 'periods') e;
  end if;

  -- 9. conflitti calcolati dall'app (es. somma punti giocatori ≠ risultato ufficiale)
  for c in select * from jsonb_array_elements(coalesce(payload -> 'conflicts', '[]'::jsonb)) loop
    insert into public.source_conflicts (entity_type, entity_id, match_id, field, primary_source_id, primary_value,
                                         secondary_source_id, secondary_value, description)
    values (coalesce(c ->> 'entity_type', 'match'), coalesce((c ->> 'entity_id')::uuid, v_match.id), v_match.id,
            c ->> 'field', coalesce((c ->> 'primary_source_id')::uuid, v_match.result_source_id),
            c ->> 'primary_value', coalesce((c ->> 'secondary_source_id')::uuid, v_source_id),
            c ->> 'secondary_value', c ->> 'description')
    on conflict do nothing;
    v_conflicts := v_conflicts + 1;
  end loop;

  update public.imports set status = 'completed', completed_at = now() where id = v_import_id;

  return jsonb_build_object(
    'status', 'completed',
    'import_id', v_import_id,
    'source_id', v_source_id,
    'player_lines', v_lines,
    'conflicts', v_conflicts
  );
end;
$$;

revoke execute on function public.import_match_report(jsonb) from public, anon;
grant execute on function public.import_match_report(jsonb) to authenticated, service_role;
