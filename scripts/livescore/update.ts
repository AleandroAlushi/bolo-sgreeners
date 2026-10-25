/**
 * Aggiornamento automatico dal Livescore CSI Bologna, senza le fonti storiche: per la stagione
 * in corso scarica calendario, orari, palestre, risultati, parziali e classifiche e li scrive
 * direttamente sul database (service role). Pensato per girare da solo su GitHub Actions
 * (.github/workflows/livescore.yml), ma funziona anche dal computer.
 *
 *   npm run livescore:update                      # stagione in corso (isCurrent in competitions.json)
 *   npm run livescore:update -- --dry-run         # mostra cosa cambierebbe, senza scrivere
 *   npm run livescore:update -- --season=2026-27  # un'altra stagione configurata
 *
 * Variabili: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY; facoltative SITE_URL e
 * REVALIDATE_SECRET per aggiornare subito le pagine del sito (POST /api/revalidate).
 *
 * Regole (le stesse dell'import storico): il CSI è la fonte primaria di calendario, risultati e
 * classifiche; una gara senza risultato sul Livescore non cancella il punteggio già presente;
 * le statistiche dei giocatori arrivano solo dai box score. Le gare nuove usano la stessa chiave
 * dell'import storico (stagione/competizione/csi-<id>), così i due strumenti non si pestano i piedi.
 */
import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { slugify } from "../../src/lib/admin/forms";
import { normalizeTeamName } from "../../src/lib/importers/normalize";
import type { TablesInsert, TablesUpdate } from "../../src/lib/supabase/database.types";
import { client } from "../import-historical/persist";
import { fetchLivescore, type Config } from "./fetch";
import { revalidateSite } from "./revalidate";

const CURATED = join(process.cwd(), "data", "curated");
const dryRun = process.argv.includes("--dry-run");
const seasonArg = process.argv.find((a) => a.startsWith("--season="))?.split("=")[1];

type CompetitionCfg = Config["seasons"][number]["competitions"][number] & { url?: string };
interface CompetitionsConfig {
  ownTeam: Config["ownTeam"] & { slug: string };
  seasons: (Omit<Config["seasons"][number], "competitions"> & { isCurrent?: boolean; competitions: CompetitionCfg[] })[];
}
interface TeamsConfig {
  teams: { slug: string; name: string; officialNames: string[] }[];
}

const cityFromAddress = (address: string | null) => address?.match(/\b\d{5}\s+(.+?)\s+[A-Z]{2}$/)?.[1] ?? null;
const PENDING_NOTE = /non ancora (fissata|pubblicat)|CSI non li ha ancora pubblicati/i;

async function main() {
  const cfg = JSON.parse(readFileSync(join(CURATED, "competitions.json"), "utf8")) as CompetitionsConfig;
  const teamsCfg = JSON.parse(readFileSync(join(CURATED, "teams.json"), "utf8")) as TeamsConfig;
  const seasonCfg = seasonArg ? cfg.seasons.find((s) => s.slug === seasonArg) : cfg.seasons.find((s) => s.isCurrent);
  if (!seasonCfg) throw new Error(seasonArg ? `Stagione ${seasonArg} non configurata in competitions.json` : "Nessuna stagione con isCurrent in competitions.json");
  const season = seasonCfg.slug;

  console.log(`Livescore CSI → database, stagione ${season}${dryRun ? " (prova, nessuna scrittura)" : ""}`);
  const ls = await fetchLivescore(cfg, { seasons: [season] });
  console.log(`Scaricate ${ls.matches.length} partite e ${ls.standings.length} classifiche.`);

  const db = client();
  const changes: string[] = [];
  const warnings = [...ls.warnings];
  const must = <T>(res: { data: T; error: { message: string } | null }, what: string): NonNullable<T> => {
    if (res.error) throw new Error(`${what}: ${res.error.message}`);
    return res.data as NonNullable<T>;
  };

  // --- riferimenti già nel database -------------------------------------------------------
  const { data: seasonRow } = await db.from("seasons").select("id").eq("slug", season).maybeSingle();
  if (!seasonRow) throw new Error(`Stagione ${season} assente nel database: lancia prima l'import storico`);
  const comps = must(await db.from("competitions").select("id, slug").eq("season_id", seasonRow.id), "Competizioni");
  const compId = new Map(comps.map((c) => [c.slug, c.id]));
  const teams = must(await db.from("teams").select("id, slug, name"), "Squadre");
  const teamId = new Map<string, string | null>(teams.map((t) => [t.slug, t.id]));

  // nomi ufficiali CSI → squadra (come nell'import storico)
  const officialToTeam = new Map<string, string>();
  for (const t of teamsCfg.teams) for (const n of t.officialNames) officialToTeam.set(normalizeTeamName(n), t.slug);
  for (const s of cfg.seasons) if (s.ownDisplayName) officialToTeam.set(normalizeTeamName(s.ownDisplayName), cfg.ownTeam.slug);
  officialToTeam.set(normalizeTeamName(cfg.ownTeam.name), cfg.ownTeam.slug);

  /** Squadra per nome ufficiale; una squadra mai vista viene creata (da aggiungere poi a teams.json). */
  const resolveTeam = async (official: string): Promise<string | null> => {
    const slug = officialToTeam.get(normalizeTeamName(official)) ?? slugify(official);
    if (teamId.has(slug)) return teamId.get(slug) ?? null;
    warnings.push(`Squadra nuova "${official}": creata con slug "${slug}". Aggiungila a data/curated/teams.json con lo stesso slug.`);
    changes.push(`Nuova squadra: ${official}`);
    teamId.set(slug, null);
    if (dryRun) return null;
    const row = must(await db.from("teams").insert({ slug, name: official, is_own_team: false }).select("id").single(), `Squadra ${official}`);
    teamId.set(slug, row.id);
    return row.id;
  };

  // --- fonti --------------------------------------------------------------------------------
  const sourceId = new Map<string, string | null>();
  const source = async (key: string, label: string, url: string | null, notes: string) => {
    if (sourceId.has(key)) return sourceId.get(key)!;
    let id: string | null = null;
    if (!dryRun) {
      const row = must(
        await db.from("data_sources").upsert({ source_key: key, kind: "csi", label, url, reference_date: ls.retrievedAt, notes }, { onConflict: "source_key" }).select("id").single(),
        `Fonte ${key}`,
      );
      id = row.id;
    }
    sourceId.set(key, id);
    return id;
  };
  const compCfg = (slug: string) => seasonCfg.competitions.find((c) => c.slug === slug);

  // --- palestre -----------------------------------------------------------------------------
  const venues = must(await db.from("venues").select("id, name"), "Palestre");
  const venueId = new Map<number, string | null>();
  for (const v of ls.venues) {
    const same = venues.find((x) => normalizeTeamName(x.name) === normalizeTeamName(v.name));
    if (same) {
      venueId.set(v.csiId, same.id);
      continue;
    }
    changes.push(`Nuova palestra: ${v.name}`);
    if (dryRun) {
      venueId.set(v.csiId, null);
      continue;
    }
    const row = must(await db.from("venues").insert({ name: v.name, address: v.address, city: cityFromAddress(v.address) }).select("id").single(), `Palestra ${v.name}`);
    venueId.set(v.csiId, row.id);
  }

  // --- partite ------------------------------------------------------------------------------
  const existing = must(
    await db
      .from("matches")
      .select("id, csi_match_id, match_date, start_time, venue_id, home_score, away_score, status, notes")
      .in("competition_id", [...compId.values()]),
    "Partite",
  );
  const byCsi = new Map(existing.filter((m) => m.csi_match_id !== null).map((m) => [m.csi_match_id!, m]));
  const linked = new Set<string>();

  for (const m of ls.matches) {
    const competitionId = compId.get(m.competition);
    if (!competitionId) {
      warnings.push(`Competizione ${season}/${m.competition} assente nel database: lancia l'import storico`);
      continue;
    }
    const [home, away] = [await resolveTeam(m.home), await resolveTeam(m.away)];
    const label = `${m.date ?? "data da fissare"} ${m.home} - ${m.away}`;
    if (!dryRun && (!home || !away)) continue;
    for (const [tid, name] of [[home, m.home], [away, m.away]] as const) {
      if (!tid || dryRun || linked.has(`${competitionId}|${tid}`)) continue;
      linked.add(`${competitionId}|${tid}`);
      // nome ufficiale della stagione (con gli sponsor): solo se la squadra non è ancora iscritta
      must(await db.from("competition_teams").upsert({ competition_id: competitionId, team_id: tid, display_name: name }, { onConflict: "competition_id,team_id", ignoreDuplicates: true }), "Iscrizione squadra");
    }
    const src = await source(
      `csi-ls:${season}:${m.competition}`,
      `Livescore CSI Bologna — ${compCfg(m.competition)?.name ?? m.competition} ${season}`,
      compCfg(m.competition)?.url ?? null,
      "Calendario, risultati, parziali e palestre scaricati con `npm run livescore:update`",
    );
    const row: TablesUpdate<"matches"> = {
      round_number: m.round,
      round_label: m.roundLabel,
      csi_game_code: m.code,
      csi_match_id: m.csiMatchId,
      home_away_confirmed: true,
      verification: "verified",
      ...(home && away ? { home_team_id: home, away_team_id: away } : {}),
    };
    // senza data sul Livescore restano data, orario e palestra già presenti (es. dal calendario della squadra)
    if (m.date) Object.assign(row, { match_date: m.date, start_time: m.time, schedule_source_id: src, ...(m.venueId && venueId.get(m.venueId) ? { venue_id: venueId.get(m.venueId) } : {}) });
    if (m.homeScore !== null) Object.assign(row, { home_score: m.homeScore, away_score: m.awayScore, status: "played", result_source_id: src });

    const old = byCsi.get(m.csiMatchId);
    let matchId: string | null = old?.id ?? null;
    if (old) {
      const what: string[] = [];
      if (m.date && (old.match_date !== m.date || (old.start_time ?? "").slice(0, 5) !== (m.time ?? ""))) what.push(`${old.match_date ?? "?"} ${old.start_time?.slice(0, 5) ?? ""} → ${m.date} ${m.time ?? ""}`);
      if (m.homeScore !== null && (old.home_score !== m.homeScore || old.away_score !== m.awayScore)) what.push(`risultato ${m.homeScore}-${m.awayScore}`);
      if (m.date && m.venueId && venueId.get(m.venueId) && old.venue_id !== venueId.get(m.venueId)) what.push(`palestra ${m.venue}`);
      if (m.date && old.notes && PENDING_NOTE.test(old.notes)) row.notes = null;
      if (what.length) changes.push(`${label}: ${what.join(", ")}`);
      if (!dryRun) must(await db.from("matches").update(row).eq("id", old.id), `Partita ${label}`);
    } else {
      changes.push(`Nuova partita: ${label}${m.homeScore !== null ? ` (${m.homeScore}-${m.awayScore})` : ""}`);
      if (!dryRun) {
        const insert = {
          ...row,
          import_key: `${season}/${m.competition}/csi-${m.csiMatchId}`,
          competition_id: competitionId,
          home_team_id: home!,
          away_team_id: away!,
          notes: m.date ? null : "Data non ancora fissata dal CSI.",
        } as TablesInsert<"matches">;
        matchId = must(await db.from("matches").upsert(insert, { onConflict: "import_key" }).select("id").single(), `Partita ${label}`).id;
      }
    }
    if (!dryRun && matchId && home && away && m.homePeriods.length > 0) {
      const periods = [
        ...m.homePeriods.map((points, i) => ({ match_id: matchId!, team_id: home, period: i + 1, points, source_id: src })),
        ...m.awayPeriods.map((points, i) => ({ match_id: matchId!, team_id: away, period: i + 1, points, source_id: src })),
      ];
      must(await db.from("match_period_scores").upsert(periods, { onConflict: "match_id,team_id,period" }), `Parziali ${label}`);
    }
  }

  // --- classifiche ufficiali ----------------------------------------------------------------
  for (const st of ls.standings) {
    const competitionId = compId.get(st.competition);
    if (!competitionId) continue;
    const src = await source(
      `csi-ls-standings:${season}:${st.competition}`,
      `Classifica ufficiale CSI ${season}${st.group ? ` — ${st.group}` : ""} (Livescore)`,
      st.url,
      "Scaricata con `npm run livescore:update`",
    );
    const before = must(await db.from("official_standings").select("team_id, position, points, played").eq("competition_id", competitionId), "Classifica");
    const rows: TablesInsert<"official_standings">[] = [];
    for (const [i, r] of st.rows.entries()) {
      const tid = await resolveTeam(r.team);
      if (!tid) continue;
      rows.push({
        competition_id: competitionId,
        team_id: tid,
        position: r.position ?? i + 1,
        played: r.played ?? 0,
        wins: r.wins ?? 0,
        losses: r.losses ?? 0,
        ot_losses: r.ssp,
        points: r.points ?? 0,
        points_for: r.pf,
        points_against: r.pa,
        extra: Object.fromEntries(Object.entries({ quoziente_canestri: r.qc, quoziente_totale: r.qtot }).filter((e): e is [string, number] => e[1] !== null)),
        as_of: ls.retrievedAt,
        source_id: src,
      });
    }
    const changed = rows.filter((r) => {
      const b = before.find((x) => x.team_id === r.team_id);
      return !b || b.position !== r.position || Number(b.points) !== Number(r.points) || b.played !== r.played;
    });
    if (changed.length > 0 || dryRun) changes.push(`Classifica ${st.competition}${st.group ? ` (${st.group})` : ""}: ${changed.length} righe cambiate su ${st.rows.length}`);
    if (!dryRun && rows.length > 0) must(await db.from("official_standings").upsert(rows, { onConflict: "competition_id,team_id" }), "Classifica");
  }

  // --- riepilogo e aggiornamento del sito ----------------------------------------------------
  console.log(changes.length ? `\nModifiche:\n- ${changes.join("\n- ")}` : "\nNessuna modifica: il database era già aggiornato.");
  for (const w of warnings) console.log(`ATTENZIONE ${w}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const md = [`### Livescore CSI → database (${season})`, "", ...(changes.length ? changes.map((c) => `- ${c}`) : ["Nessuna modifica."]), ...(warnings.length ? ["", "**Attenzione**", ...warnings.map((w) => `- ${w}`)] : [])];
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, md.join("\n") + "\n");
  }
  if (dryRun) return;
  await revalidateSite();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
