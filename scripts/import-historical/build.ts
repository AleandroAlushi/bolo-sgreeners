/**
 * Costruzione del dataset storico: estrazione → normalizzazione → mapping → validazione,
 * senza toccare il database. Fonti: Excel (01_EXCEL), box score HTML (02_HTML_PARTITE)
 * e trascrizioni CSI curate (data/curated).
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  emptyStatLine,
  mapPlayers,
  normalizePlayerName,
  normalizeTeamName,
  parseMatchHtml,
  validateImportedMatch,
  type AliasRecord,
  type NormalizedMatchReport,
  type NormalizedPlayerLine,
  type PlayerMapping,
  type PlayerRef,
  type StatLine,
} from "../../src/lib/importers";
import type { ConflictDef, Dataset, MatchDef, SourceDef, StatImportDef } from "./dataset";
import { isoDate, loadWorkbook, minutes, num, readTable, sheet, str, type Row } from "./excel";

const CURATED_DIR = join(process.cwd(), "data", "curated");
const readJson = <T>(name: string): T => JSON.parse(readFileSync(join(CURATED_DIR, name), "utf8")) as T;

export const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const nfc = (s: string) => s.normalize("NFC");

interface CuratedCompetition {
  slug: string;
  name: string;
  kind: string;
  phase_order: number;
  csi_project_id: number | null;
  excelPhase: string;
  url?: string;
  format_notes?: string;
  standingsRule?: {
    points_win: number;
    points_loss: number;
    points_ot_loss?: number;
    tiebreakers: string[];
    is_verified: boolean;
    notes?: string;
  };
}
interface CuratedSeason {
  slug: string;
  label: string;
  isCurrent?: boolean;
  ownDisplayName: string | null;
  csiTeamId: number | null;
  notes?: string;
  competitions: CuratedCompetition[];
}
interface CuratedCsiMatch {
  season: string;
  competition: string;
  round: number;
  roundLabel?: string;
  date: string;
  time: string;
  code: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  homePeriods: number[];
  awayPeriods: number[];
  venue: string;
  screenshot: string;
  notes?: string;
}

export async function buildDataset(sourcesDir: string): Promise<Dataset> {
  const log: string[] = [];
  const competitionsCfg = readJson<{
    ownTeam: { slug: string; name: string; short_name: string; city: string; fileAliases: string[] };
    seasons: CuratedSeason[];
  }>("competitions.json");
  const teamsCfg = readJson<{
    teams: { slug: string; name: string; short_name?: string; city?: string; officialNames: string[] }[];
  }>("teams.json");
  const csiCfg = readJson<{
    venues: { key: string; name: string; address: string; city: string }[];
    matches: CuratedCsiMatch[];
    matchIds: { season: string; date: string; csiMatchId: number; label: string; notes: string }[];
  }>("csi-matches.json");
  const standingsCfg = readJson<{
    standings: {
      season: string;
      competition: string;
      file: string;
      url: string;
      rows: { position: number; team: string; points: number; played: number; wins: number; losses: number; ssp: number; pf: number; pa: number; qc: number; qtot: number }[];
    }[];
  }>("csi-standings.json");
  const manualCfg = readJson<{
    conflicts: { match: { season: string; date: string }; field: string; primaryLabel: string; primaryValue: string; secondaryLabel: string; secondaryValue: string; description: string }[];
  }>("manual-conflicts.json");

  const excelDir = join(sourcesDir, "01_EXCEL");
  const [wbS, wbC, wbM] = await Promise.all([
    loadWorkbook(join(excelDir, "Sgreeners_stats_COMPLETO.xlsx")),
    loadWorkbook(join(excelDir, "Sgreeners_calendario_COMPLETO.xlsx")),
    loadWorkbook(join(excelDir, "Bolo_Sgreeners_matching_CSI_COMPLETO.xlsx")),
  ]);

  // -------------------------------------------------------------------------
  // Fonti
  // -------------------------------------------------------------------------
  const sources: SourceDef[] = [
    { key: "xls-s", kind: "excel", label: "Excel storico statistiche Bolo Sgreeners 2023-2026", notes: "Sgreeners_stats_COMPLETO.xlsx" },
    { key: "xls-c", kind: "excel", label: "Excel storico calendario Bolo Sgreeners 2023-2026", notes: "Sgreeners_calendario_COMPLETO.xlsx" },
    { key: "xls-m", kind: "excel", label: "Excel matching avversari ↔ CSI", notes: "Bolo_Sgreeners_matching_CSI_COMPLETO.xlsx" },
    { key: "analysis", kind: "manual", label: "Analisi incrociata delle fonti (ottobre 2026)", notes: "docs/DATI_IDENTIFICATI.md" },
  ];
  const addSource = (s: SourceDef) => {
    if (!sources.some((x) => x.key === s.key)) sources.push(s);
    return s.key;
  };

  // -------------------------------------------------------------------------
  // Stagioni e competizioni
  // -------------------------------------------------------------------------
  const seasons = competitionsCfg.seasons.map((s) => ({
    slug: s.slug,
    label: s.label,
    is_current: s.isCurrent ?? false,
    notes: s.notes ?? null,
  }));
  const competitions: Dataset["competitions"] = [];
  const rules: Dataset["rules"] = [];
  const phaseToCompetition = new Map<string, string>();
  for (const s of competitionsCfg.seasons) {
    for (const c of s.competitions) {
      const csiKey = c.url
        ? addSource({ key: `csi-league:${s.slug}:${c.slug}`, kind: "csi", label: `Livescore CSI Bologna — ${c.name} ${s.slug}`, url: c.url })
        : null;
      competitions.push({
        season: s.slug,
        slug: c.slug,
        name: c.name,
        kind: c.kind,
        phase_order: c.phase_order,
        csi_project_id: c.csi_project_id,
        format_notes: c.format_notes ?? null,
        sourceKey: csiKey,
      });
      phaseToCompetition.set(`${s.slug}|${c.excelPhase}`, c.slug);
    }
  }
  for (const st of standingsCfg.standings) {
    addSource({
      key: `csi-standings:${st.season}:${st.competition}`,
      kind: "csi",
      label: `Classifica ufficiale CSI ${st.season} (PDF Livescore)`,
      url: st.url,
      notes: st.file,
    });
  }
  for (const s of competitionsCfg.seasons) {
    for (const c of s.competitions) {
      if (!c.standingsRule) continue;
      rules.push({
        season: s.slug,
        competition: c.slug,
        points_win: c.standingsRule.points_win,
        points_loss: c.standingsRule.points_loss,
        points_ot_loss: c.standingsRule.points_ot_loss ?? null,
        tiebreakers: c.standingsRule.tiebreakers,
        is_verified: c.standingsRule.is_verified,
        notes: c.standingsRule.notes ?? null,
        sourceKey: `csi-standings:${s.slug}:${c.slug}`,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Squadre
  // -------------------------------------------------------------------------
  const own = competitionsCfg.ownTeam;
  const teams: Dataset["teams"] = [
    { slug: own.slug, name: own.name, short_name: own.short_name, city: own.city, is_own_team: true },
    ...teamsCfg.teams.map((t) => ({ slug: t.slug, name: t.name, short_name: t.short_name ?? null, city: t.city ?? null, is_own_team: false })),
  ];
  const officialToTeam = new Map<string, string>();
  for (const t of teamsCfg.teams) for (const n of t.officialNames) officialToTeam.set(normalizeTeamName(n), t.slug);
  for (const s of competitionsCfg.seasons) if (s.ownDisplayName) officialToTeam.set(normalizeTeamName(s.ownDisplayName), own.slug);
  officialToTeam.set(normalizeTeamName(own.name), own.slug);
  const resolveTeam = (official: string): string => {
    const slug = officialToTeam.get(normalizeTeamName(official));
    if (!slug) throw new Error(`Squadra non censita in data/curated/teams.json: "${official}"`);
    return slug;
  };

  const competitionTeams = new Map<string, Dataset["competitionTeams"][number]>();
  const addCompetitionTeam = (season: string, competition: string, team: string, display_name: string, csi_team_id: number | null = null) => {
    const k = `${season}/${competition}/${team}`;
    if (!competitionTeams.has(k)) competitionTeams.set(k, { season, competition, team, display_name, csi_team_id });
  };
  for (const s of competitionsCfg.seasons) {
    for (const c of s.competitions) {
      if (s.ownDisplayName) addCompetitionTeam(s.slug, c.slug, own.slug, s.ownDisplayName, s.csiTeamId);
    }
  }

  // Alias squadre dall'Excel matching (soprannomi negli HTML) — riservati agli admin
  const teamAliases: Dataset["teamAliases"] = own.fileAliases.map((a) => ({ team: own.slug, alias: a, season: null, sourceKey: "xls-m" }));
  const masterRows = readTable(sheet(wbM, "Master"), "#");
  for (const r of masterRows) {
    const nick = str(r["Avversario nel file"]);
    const official = str(r["Avversario CSI associato"]);
    const season = str(r["Stagione"]);
    if (!nick || !official || !season || /non indicato|nessun report/i.test(nick)) continue;
    teamAliases.push({ team: resolveTeam(official), alias: nick, season, sourceKey: "xls-m" });
  }

  // -------------------------------------------------------------------------
  // Palestre (CSI)
  // -------------------------------------------------------------------------
  const venues = csiCfg.venues.map((v) => ({ key: v.key, name: v.name, address: v.address, city: v.city }));

  // -------------------------------------------------------------------------
  // Giocatori e alias (Excel statistiche)
  // -------------------------------------------------------------------------
  const aliasRows = readTable(sheet(wbS, "Alias"), "Alias");
  const realNames = new Set<string>();
  for (const season of ["2023-24", "2024-25", "2025-26"]) {
    for (const r of readTable(sheet(wbS, `${season} Giocatori`), "Giocatore", { stopAtBlank: true })) {
      const n = str(r["Giocatore"]);
      if (n && !/non attribuito/i.test(n)) realNames.add(n);
    }
  }
  for (const r of aliasRows) {
    const n = str(r["Nome aggregato"]);
    if (n && !/non attribuito/i.test(n)) realNames.add(n);
  }
  const players: Dataset["players"] = [...realNames].sort().map((full) => {
    const [first, ...rest] = full.split(" ");
    return { slug: slugify(full), first_name: first, last_name: rest.join(" "), nickname: null };
  });
  const playerByName = new Map(players.map((p) => [normalizePlayerName(`${p.first_name} ${p.last_name}`), p.slug]));

  const playerAliases: Dataset["playerAliases"] = [];
  for (const r of aliasRows) {
    const rawAlias = str(r["Alias"]);
    const target = str(r["Nome aggregato"]);
    if (!rawAlias || !target || /non attribuito/i.test(target) || /ambiguo/i.test(str(r["Stato"]) ?? "")) continue;
    const slug = playerByName.get(normalizePlayerName(target));
    if (!slug) throw new Error(`Alias "${rawAlias}" punta a un giocatore sconosciuto: ${target}`);
    const m = rawAlias.match(/^(.*?)\s*\(#(\d+)\)$/);
    const alias = m ? m[1] : rawAlias;
    if (normalizePlayerName(alias) === normalizePlayerName(target)) continue; // il nome completo è già implicito
    playerAliases.push({ player: slug, alias, season: null, jersey: m ? m[2] : null, sourceKey: "xls-s", notes: str(r["Nota"]) });
  }
  const aliasRecords: AliasRecord[] = playerAliases.map((a) => ({ playerId: a.player, alias: a.alias, seasonId: a.season, jersey: a.jersey }));
  const playerRefs: PlayerRef[] = players.map((p) => ({ id: p.slug, displayName: `${p.first_name} ${p.last_name}` }));

  // -------------------------------------------------------------------------
  // Calendario (Excel calendario) + sovrapposizione dati CSI
  // -------------------------------------------------------------------------
  const csiByDate = new Map(csiCfg.matches.map((m) => [`${m.season}|${m.date}`, m]));
  const csiIdByDate = new Map(csiCfg.matchIds.map((m) => [`${m.season}|${m.date}`, m]));
  const masterIdByDate = new Map<string, number>();
  for (const r of masterRows) {
    const id = num(r["CSI match_id"]);
    const d = isoDate(r["Data"]);
    if (id && d) masterIdByDate.set(`${str(r["Stagione"])}|${d}`, id);
  }

  const htmlDir = join(sourcesDir, "02_HTML_PARTITE");
  const htmlFiles = existsSync(htmlDir) ? readdirSync(htmlDir).filter((f) => f.endsWith(".html")).map(nfc) : [];

  const matches: MatchDef[] = [];
  const periods: Dataset["periods"] = [];
  const conflicts: ConflictDef[] = [];
  const calendarRows = readTable(sheet(wbC, "Tutte le partite"), "Stagione");
  for (const r of calendarRows) {
    const season = str(r["Stagione"]);
    const phase = str(r["Fase"]);
    if (!season || !phase) continue;
    const competition = phaseToCompetition.get(`${season}|${phase}`);
    if (!competition) throw new Error(`Fase "${phase}" ${season} non configurata in competitions.json`);
    const opponentName = str(r["Avversario"]);
    if (!opponentName) {
      log.push(`SALTATA riga calendario senza avversario: ${season} ${phase} ${isoDate(r["Data"])}`);
      continue;
    }
    const opponent = resolveTeam(opponentName);
    addCompetitionTeam(season, competition, opponent, opponentName.replace(/\s*\(.*\)$/, ""));
    const date = isoDate(r["Data"]);
    const cf = str(r["C/F"]);
    const pf = num(r["PF"]);
    const pa = num(r["PA"]);
    const fileRef = str(r["File / fonte"]) ?? "";
    const htmlFile = htmlFiles.find((f) => fileRef.includes(f)) ?? null;
    const csi = date ? csiByDate.get(`${season}|${date}`) : undefined;
    const verifica = (str(r["Verifica"]) ?? "").toLowerCase();
    const csiMatchId = date ? (masterIdByDate.get(`${season}|${date}`) ?? csiIdByDate.get(`${season}|${date}`)?.csiMatchId ?? null) : null;

    const key = `${season}/${competition}/${date ?? `senza-data-${opponent}`}`;
    const excelHomeAway = cf === "Casa" ? "home" : cf === "Fuori" ? "away" : null;
    const def: MatchDef = {
      key,
      season,
      competition,
      round_number: num(r["Giornata"]),
      round_label: null,
      date,
      time: null,
      venue: null,
      home: excelHomeAway === "home" ? own.slug : opponent,
      away: excelHomeAway === "home" ? opponent : own.slug,
      home_score: null,
      away_score: null,
      status: "played",
      home_away_confirmed: excelHomeAway !== null,
      csi_match_id: csiMatchId,
      csi_game_code: null,
      verification: csiMatchId ? "verified" : /^alta/.test(verifica) || /media/.test(verifica) ? "probable" : "to_verify",
      scheduleSource: "xls-c",
      resultSource: null,
      notes: null,
      htmlFile,
      excelScore: pf !== null && pa !== null ? { own: pf, opponent: pa } : null,
      excelHomeAway,
    };

    if (csi) {
      const csiSource = addSource({
        key: `csi-ss:${season}:${competition}`,
        kind: "csi",
        label: `Livescore CSI Bologna — calendario e risultati ${season} (screenshot)`,
        url: competitionsCfg.seasons.find((x) => x.slug === season)?.competitions.find((c) => c.slug === competition)?.url ?? null,
        notes: "Screenshot del Livescore CSI forniti dall'utente (04_SCREENSHOT_EXTRA)",
      });
      const csiHome = resolveTeam(csi.home);
      const csiAway = resolveTeam(csi.away);
      addCompetitionTeam(season, competition, csiHome, csi.home);
      addCompetitionTeam(season, competition, csiAway, csi.away);
      Object.assign(def, {
        round_number: csi.round,
        round_label: csi.roundLabel ?? null,
        time: csi.time,
        venue: csi.venue,
        home: csiHome,
        away: csiAway,
        home_score: csi.homeScore,
        away_score: csi.awayScore,
        home_away_confirmed: true,
        csi_game_code: csi.code,
        verification: "verified",
        scheduleSource: csiSource,
        resultSource: csiSource,
        notes: csi.notes ?? null,
      } satisfies Partial<MatchDef>);
      csi.homePeriods.forEach((points, i) => periods.push({ match: key, team: csiHome, period: i + 1, points, sourceKey: csiSource }));
      csi.awayPeriods.forEach((points, i) => periods.push({ match: key, team: csiAway, period: i + 1, points, sourceKey: csiSource }));

      // verifiche Excel vs CSI
      const csiOwnHome = csiHome === own.slug;
      const csiOwn = csiOwnHome ? csi.homeScore : csi.awayScore;
      const csiOpp = csiOwnHome ? csi.awayScore : csi.homeScore;
      if (def.excelScore && (def.excelScore.own !== csiOwn || def.excelScore.opponent !== csiOpp)) {
        conflicts.push({ entity: "match", ref: key, field: "score", primarySource: csiSource, primary_value: `${csiOwn}-${csiOpp}`, secondarySource: "xls-c", secondary_value: `${def.excelScore.own}-${def.excelScore.opponent}`, description: "Risultato dell'Excel calendario diverso dal CSI (Sgreeners-avversari)" });
      }
      if (excelHomeAway && excelHomeAway !== (csiOwnHome ? "home" : "away")) {
        conflicts.push({ entity: "match", ref: key, field: "home_away", primarySource: csiSource, primary_value: csiOwnHome ? "casa" : "trasferta", secondarySource: "xls-c", secondary_value: excelHomeAway === "home" ? "casa" : "trasferta", description: "Casa/trasferta dell'Excel diverso dal CSI" });
      }
      const xRound = num(r["Giornata"]);
      if (xRound !== null && xRound !== csi.round) {
        conflicts.push({ entity: "match", ref: key, field: "round_number", primarySource: csiSource, primary_value: String(csi.round), secondarySource: "xls-c", secondary_value: String(xRound), description: "Giornata dell'Excel diversa dal CSI" });
      }
    } else if (!htmlFile) {
      // nessun box score e nessun dato CSI: il risultato arriva solo dall'Excel
      if (def.excelScore) {
        const ownHome = def.home === own.slug;
        def.home_score = ownHome ? def.excelScore.own : def.excelScore.opponent;
        def.away_score = ownHome ? def.excelScore.opponent : def.excelScore.own;
        def.resultSource = "xls-c";
      } else {
        def.status = "scheduled";
      }
      const note = str(r["Note"]);
      if (!date) def.notes = `Data non disponibile nelle fonti. ${note ?? ""}`.trim();
    }
    if (!def.home_away_confirmed) {
      def.notes = [def.notes, "Casa/trasferta non indicata dalle fonti."].filter(Boolean).join(" ");
    }
    matches.push(def);
  }
  const matchByDate = new Map(matches.filter((m) => m.date).map((m) => [`${m.season}|${m.date}`, m]));
  const seasonOfDate = (date: string): string | null => {
    for (const m of matches) if (m.date === date) return m.season;
    return null;
  };

  // -------------------------------------------------------------------------
  // Box score HTML
  // -------------------------------------------------------------------------
  const statImports: StatImportDef[] = [];
  const htmlLines: { season: string; matchKey: string; line: NormalizedPlayerLine; mapping: PlayerMapping }[] = [];
  for (const file of htmlFiles) {
    const path = join(htmlDir, readdirSync(htmlDir).find((f) => nfc(f) === file) ?? file);
    const content = readFileSync(path, "utf8");
    const hash = createHash("sha256").update(content).digest("hex");
    const report = parseMatchHtml(content, { ownTeamNames: own.fileAliases });
    const match = matches.find((m) => m.htmlFile === file) ?? (report.date ? matchByDate.get(`${seasonOfDate(report.date)}|${report.date}`) : undefined);
    if (!match) {
      log.push(`ERRORE HTML senza partita in calendario: ${file}`);
      continue;
    }
    const mappings = mapPlayers(report.players, aliasRecords, playerRefs, match.season);
    const officialOwn = match.home_score !== null ? (match.home === own.slug ? match.home_score : match.away_score) : null;
    const officialOpp = match.home_score !== null ? (match.home === own.slug ? match.away_score : match.home_score) : null;
    const issues = validateImportedMatch(report, {
      officialScore: officialOwn !== null && officialOpp !== null ? { own: officialOwn, opponent: officialOpp } : null,
      scheduledDate: match.date,
      mappings,
    });
    const blocking = issues.filter((i) => i.level === "error");
    if (blocking.length > 0) {
      log.push(`ERRORE ${file}: ${blocking.map((i) => i.message).join("; ")}`);
      continue;
    }
    const fileConflicts: StatImportDef["conflicts"] = [];
    // Casa/trasferta dichiarati dall'app vs CSI
    if (match.scheduleSource.startsWith("csi") && report.own.appSide) {
      const csiSide = match.home === own.slug ? "home" : "away";
      if (report.own.appSide !== csiSide) {
        fileConflicts.push({ field: "home_away", primary_value: csiSide === "home" ? "casa" : "trasferta", secondary_value: report.own.appSide === "home" ? "casa" : "trasferta", description: "Il box score indica casa/trasferta in modo diverso dal CSI" });
      }
    }
    // Risultato Excel vs box score (solo verifica, quando manca il CSI)
    if (!match.scheduleSource.startsWith("csi") && match.excelScore && report.own.score !== null && report.opponent.score !== null &&
        (match.excelScore.own !== report.own.score || match.excelScore.opponent !== report.opponent.score)) {
      conflicts.push({ entity: "match", ref: match.key, field: "score_excel", primarySource: null, primary_value: `${report.own.score}-${report.opponent.score}`, secondarySource: "xls-c", secondary_value: `${match.excelScore.own}-${match.excelScore.opponent}`, description: "Risultato dell'Excel calendario diverso dal box score" });
    }
    const dateLabel = report.date ? report.date.split("-").reverse().join("/") : "data n.d.";
    statImports.push({
      matchKey: match.key,
      season: match.season,
      kind: "html",
      fileName: file,
      hash,
      size: statSync(path).size,
      content,
      report,
      mappings,
      issues,
      source: { kind: "html", label: `Box score Easy Stats · ${dateLabel}` },
      conflicts: fileConflicts,
    });
    report.players.forEach((line, i) => htmlLines.push({ season: match.season, matchKey: match.key, line, mapping: mappings[i] }));
  }

  // -------------------------------------------------------------------------
  // Log partita dell'Excel per le gare senza HTML (PDF, foto, articolo web)
  // -------------------------------------------------------------------------
  const excelLogs: (Row & { season: string })[] = [];
  const teamRowsByDate = new Map<string, Row>();
  for (const season of ["2023-24", "2024-25", "2025-26"]) {
    for (const r of readTable(sheet(wbS, `${season} Giocatori`), "Data")) excelLogs.push({ ...r, season });
    for (const r of readTable(sheet(wbS, `${season} Squadra`), "Data")) {
      const d = isoDate(r["Data"]);
      if (d) teamRowsByDate.set(`${season}|${d}`, r);
    }
  }
  const nonHtml = new Map<string, (Row & { season: string })[]>();
  for (const r of excelLogs) {
    if (str(r["Tipo fonte"]) === "HTML") continue;
    const d = isoDate(r["Data"]);
    if (!d) continue;
    const k = `${r.season}|${d}`;
    nonHtml.set(k, [...(nonHtml.get(k) ?? []), r]);
  }
  const kindOf = (tipo: string): "pdf" | "photo" | "web" => (/pdf/i.test(tipo) ? "pdf" : /foto/i.test(tipo) ? "photo" : "web");
  const labelOf: Record<"pdf" | "photo" | "web", string> = {
    pdf: "Report PDF Basketball Stats Assistant",
    photo: "Foto degli appunti statistici",
    web: "Articolo Basket Castelfranco",
  };
  for (const [k, rows] of nonHtml) {
    const [season, date] = k.split("|");
    const match = matchByDate.get(k);
    if (!match) {
      log.push(`ERRORE log Excel senza partita: ${k}`);
      continue;
    }
    const tipo = str(rows[0]["Tipo fonte"]) ?? "";
    const kind = kindOf(tipo);
    const fileRef = str(rows[0]["Fonte"]) ?? "Excel";
    const lines: NormalizedPlayerLine[] = rows.map((r) => {
      const s = emptyStatLine();
      const p2m = num(r["2PM"]), p2a = num(r["2PA"]), p3m = num(r["3PM"]), p3a = num(r["3PA"]);
      Object.assign(s, {
        minutes: minutes(r["MIN"]),
        points: num(r["PTS"]),
        reb: num(r["REB"]),
        ast: num(r["AST"]),
        stl: num(r["STL"]),
        tov: num(r["TOV"]),
        blk: num(r["BLK"]),
        pf: num(r["Falli"]),
        fgm: p2m !== null && p3m !== null ? p2m + p3m : null,
        fga: p2a !== null && p3a !== null ? p2a + p3a : null,
        fg3m: p3m,
        fg3a: p3a,
        ftm: num(r["FTM"]),
        fta: num(r["FTA"]),
        plus_minus: num(r["+/-"]),
      } satisfies Partial<StatLine>);
      const jersey = str(r["#"]);
      return {
        rawLabel: str(r["Alias originale"]) ?? str(r["Giocatore"]) ?? "?",
        name: str(r["Alias originale"]) ?? str(r["Giocatore"]) ?? "?",
        jersey: jersey && /^\d+$/.test(jersey) ? jersey : null,
        participation: "played",
        didPlay: true,
        stats: s,
        extra: {},
      };
    });
    const mappings: PlayerMapping[] = rows.map((r, i) => {
      const real = str(r["Giocatore"]) ?? "";
      const slug = playerByName.get(normalizePlayerName(real)) ?? null;
      return {
        rawLabel: lines[i].rawLabel,
        name: lines[i].name,
        jersey: lines[i].jersey,
        status: slug ? "matched" : "unmatched",
        playerId: slug,
        candidates: slug ? [slug] : [],
        reason: slug ? "Nome reale indicato dall'Excel" : "Riga non attribuibile a un giocatore (alias ambiguo)",
      };
    });
    const teamRow = teamRowsByDate.get(k);
    let ownTotals: StatLine | null = null;
    if (teamRow && num(teamRow["FGA"]) !== null) {
      ownTotals = { ...emptyStatLine(), points: null, fgm: num(teamRow["FGM"]), fga: num(teamRow["FGA"]), fg3m: num(teamRow["3PM"]), fg3a: num(teamRow["3PA"]), ftm: num(teamRow["FTM"]), fta: num(teamRow["FTA"]), oreb: num(teamRow["OREB"]), dreb: num(teamRow["DREB"]), reb: num(teamRow["REB"]), ast: num(teamRow["AST"]), stl: num(teamRow["STL"]), tov: num(teamRow["TOV"]), blk: num(teamRow["BLK"]), pf: num(teamRow["Falli"]) };
      const ownPts = match.home === own.slug ? match.home_score : match.away_score;
      ownTotals.points = ownPts;
    }
    const report: NormalizedMatchReport = {
      parser: "excel-player-log",
      parserVersion: "1.0.0",
      formatVariant: tipo,
      date,
      own: { rawName: own.name, score: null, appSide: null, totals: ownTotals, isOwnTeam: true },
      opponent: { rawName: "", score: null, appSide: null, totals: null, isOwnTeam: false },
      periods: [],
      players: lines,
      availableStats: [],
      shots: { own: [], opponent: [] },
      rosterIds: [],
      issues: [],
    };
    const ownScore = match.home === own.slug ? match.home_score : match.away_score;
    const sumPts = lines.reduce((a, l) => a + (l.stats.points ?? 0), 0);
    const fileConflicts: StatImportDef["conflicts"] = [];
    if (ownScore !== null && lines.every((l) => l.stats.points !== null) && sumPts !== ownScore) {
      fileConflicts.push({ field: "points_attributed", primary_value: String(ownScore), secondary_value: String(sumPts), description: `La somma dei punti attribuiti ai giocatori (${labelOf[kind]}) è ${sumPts}, il punteggio ufficiale è ${ownScore}` });
    }
    const rowsJson = JSON.stringify(rows.map((r) => ({ ...r, Data: date })));
    statImports.push({
      matchKey: match.key,
      season,
      kind: "excel-log",
      fileName: `${fileRef} (trascritto in Sgreeners_stats_COMPLETO.xlsx)`,
      hash: createHash("sha256").update(`excel-log|${k}|${rowsJson}`).digest("hex"),
      size: null,
      content: null,
      report,
      mappings,
      issues: mappings.filter((m) => m.status !== "matched").map((m) => ({ level: "warning" as const, code: "unattributed_line", message: `Riga non attribuita: ${m.rawLabel}`, ref: m.rawLabel })),
      source: { kind, label: `${labelOf[kind]} · ${date.split("-").reverse().join("/")}`, notes: `Trascrizione nell'Excel storico (${fileRef})` },
      conflicts: fileConflicts,
    });
  }

  // Presenze: giocatori a referto con 0 minuti che l'Excel conta come partita giocata
  const excelHtmlLogKeys = new Set(
    excelLogs.filter((r) => str(r["Tipo fonte"]) === "HTML").map((r) => `${r.season}|${isoDate(r["Data"])}|${normalizePlayerName(str(r["Giocatore"]) ?? "")}`),
  );
  for (const h of htmlLines) {
    if (h.line.participation !== "dnp" || !h.mapping.playerId) continue;
    const match = matches.find((m) => m.key === h.matchKey);
    const realName = playerRefs.find((p) => p.id === h.mapping.playerId)?.displayName ?? "";
    if (match && excelHtmlLogKeys.has(`${h.season}|${match.date}|${normalizePlayerName(realName)}`)) {
      conflicts.push({ entity: "match", ref: h.matchKey, field: `presence:${h.mapping.playerId}`, primarySource: null, primary_value: "non entrato (0 minuti)", secondarySource: "xls-s", secondary_value: "presenza conteggiata", description: `${realName}: a referto con 0 minuti nel box score, l'Excel lo conta come presenza` });
    }
  }

  // -------------------------------------------------------------------------
  // Roster di stagione (numero e soprannome più frequenti)
  // -------------------------------------------------------------------------
  const rosterMap = new Map<string, { jerseys: Map<string, number>; names: Map<string, number> }>();
  const touch = (season: string, player: string) => {
    const k = `${season}|${player}`;
    if (!rosterMap.has(k)) rosterMap.set(k, { jerseys: new Map(), names: new Map() });
    return rosterMap.get(k)!;
  };
  const bump = (m: Map<string, number>, v: string | null) => {
    if (v) m.set(v, (m.get(v) ?? 0) + 1);
  };
  for (const h of htmlLines) {
    if (!h.mapping.playerId) continue;
    const e = touch(h.season, h.mapping.playerId);
    bump(e.jerseys, h.line.jersey);
    bump(e.names, h.line.name);
  }
  for (const imp of statImports.filter((s) => s.kind === "excel-log")) {
    imp.mappings.forEach((m, i) => {
      if (!m.playerId) return;
      const e = touch(imp.season, m.playerId);
      bump(e.jerseys, imp.report.players[i].jersey);
    });
  }
  const mostFrequent = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const rosters: Dataset["rosters"] = [...rosterMap.entries()].map(([k, e]) => {
    const [season, player] = k.split("|");
    const name = mostFrequent(e.names);
    const p = players.find((x) => x.slug === player)!;
    const nickname = name && normalizePlayerName(name) !== normalizePlayerName(p.first_name) ? name : null;
    return { season, player, jersey: mostFrequent(e.jerseys), nickname: nickname ? nickname[0].toUpperCase() + nickname.slice(1) : null, sourceKey: "xls-s" };
  });
  // soprannome "di carriera" = il più usato in assoluto
  const nickCount = new Map<string, Map<string, number>>();
  for (const h of htmlLines) {
    if (!h.mapping.playerId) continue;
    if (!nickCount.has(h.mapping.playerId)) nickCount.set(h.mapping.playerId, new Map());
    bump(nickCount.get(h.mapping.playerId)!, h.line.name);
  }
  for (const p of players) {
    const n = nickCount.has(p.slug) ? mostFrequent(nickCount.get(p.slug)!) : null;
    p.nickname = n && normalizePlayerName(n) !== normalizePlayerName(p.first_name) ? n[0].toUpperCase() + n.slice(1) : null;
  }

  // -------------------------------------------------------------------------
  // Classifiche ufficiali e totali di fase
  // -------------------------------------------------------------------------
  const standings: Dataset["standings"] = [];
  for (const st of standingsCfg.standings) {
    for (const row of st.rows) {
      const team = resolveTeam(row.team);
      addCompetitionTeam(st.season, st.competition, team, row.team);
      standings.push({
        season: st.season,
        competition: st.competition,
        team,
        position: row.position,
        played: row.played,
        wins: row.wins,
        losses: row.losses,
        ot_losses: row.ssp,
        points: row.points,
        points_for: row.pf,
        points_against: row.pa,
        extra: { quoziente_canestri: row.qc, quoziente_totale: row.qtot },
        sourceKey: `csi-standings:${st.season}:${st.competition}`,
      });
    }
  }

  const phaseTotals: Dataset["phaseTotals"] = [];
  for (const r of readTable(sheet(wbC, "Riepilogo"), "Stagione", { stopAtBlank: true })) {
    const season = str(r["Stagione"]);
    const phase = str(r["Fase"]);
    const base = str(r["Base dati"]) ?? "";
    if (!season || !phase || !/csi/i.test(base)) continue;
    const competition = phaseToCompetition.get(`${season}|${phase}`);
    if (!competition) continue;
    phaseTotals.push({
      season,
      competition,
      played: num(r["PG"]) ?? 0,
      wins: num(r["V"]) ?? 0,
      losses: num(r["S"]) ?? 0,
      pf: num(r["PF"]) ?? 0,
      pa: num(r["PA"]) ?? 0,
      sourceKey: "xls-c",
      note: str(r["Note"]),
    });
  }

  // -------------------------------------------------------------------------
  // Conflitti manuali
  // -------------------------------------------------------------------------
  for (const c of manualCfg.conflicts) {
    const match = matchByDate.get(`${c.match.season}|${c.match.date}`);
    if (!match) {
      log.push(`ATTENZIONE conflitto manuale senza partita: ${c.match.season} ${c.match.date}`);
      continue;
    }
    if (c.field === "opponent") match.verification = "to_verify";
    conflicts.push({
      entity: "match",
      ref: match.key,
      field: c.field,
      primarySource: null,
      primary_value: `${c.primaryValue} (${c.primaryLabel})`,
      secondarySource: "analysis",
      secondary_value: `${c.secondaryValue} (${c.secondaryLabel})`,
      description: c.description,
    });
  }

  return {
    sources,
    seasons,
    competitions,
    rules,
    teams,
    teamAliases,
    competitionTeams: [...competitionTeams.values()],
    venues,
    players,
    playerAliases,
    matches,
    periods,
    standings,
    statImports,
    rosters,
    conflicts,
    phaseTotals,
    log,
  };
}
