/**
 * Lettura del Livescore CSI Bologna (calendario, risultati, parziali, palestre, classifiche):
 * usata da `npm run livescore:sync` (scrive data/curated/livescore.json) e da
 * `npm run livescore:update` (aggiorna direttamente il database per la stagione in corso).
 *
 * Le partite si trovano con la ricerca del Livescore (nome della società), perché la tabella
 * risultati di una competizione mostra solo le gare con data fissata. Le formazioni del
 * Livescore non vengono usate: i punti dei giocatori spesso non coincidono con i box score.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, type HTMLElement } from "node-html-parser";

const BASE = "https://livescore.csibologna.it/";
const CACHE = join(process.cwd(), "data", "build", "livescore-cache");
let useCache = false;

export interface Config {
  ownTeam: { name: string; livescoreSearch?: string };
  seasons: {
    slug: string;
    ownDisplayName: string | null;
    csiTeamId: number | null;
    competitions: { slug: string; name: string; csi_project_id: number | null; extraProjectIds?: number[] }[];
  }[];
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(path: string): Promise<string> {
  const file = join(CACHE, path.replace(/[^A-Za-z0-9]+/g, "_") + ".html");
  if (useCache && existsSync(file)) return readFileSync(file, "utf8");
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(BASE + path, { headers: { "User-Agent": "archivio-bolo-sgreeners" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.text();
      mkdirSync(CACHE, { recursive: true });
      writeFileSync(file, body);
      await sleep(300); // gentilezza verso il server CSI
      return body;
    } catch (e) {
      if (attempt >= 3) throw new Error(`Download fallito: ${path} (${(e as Error).message})`);
      await sleep(2000 * 2 ** attempt);
    }
  }
}

// ---------------------------------------------------------------------------
// Utility di parsing
// ---------------------------------------------------------------------------
/** Il Livescore a volte serve testo UTF-8 codificato due volte ("CÃ de Testi"). */
function fixText(s: string): string {
  if (/Ã.|Â/.test(s)) {
    const fixed = Buffer.from(s, "latin1").toString("utf8");
    if (!fixed.includes("�")) return fixed;
  }
  return s;
}
const clean = (s: string | undefined | null) => fixText(s ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const text = (el: HTMLElement | null | undefined) => clean(el?.text);
const idFrom = (href: string | undefined, key: string) => {
  const m = (href ?? "").match(new RegExp(`${key}=(\\d+)`));
  return m ? Number(m[1]) : null;
};
const int = (s: string | undefined) => (s && /^-?\d+$/.test(s.trim()) ? Number(s.trim()) : null);
const dec = (s: string | undefined) => (s && /^-?\d+(\.\d+)?$/.test(s.trim()) ? Number(s.trim()) : null);

/**
 * "3a Giornata" → "3ª giornata"; nei playoff il Livescore usa codici come "4i-Aa Giornata"
 * (quarti, gara 1), "SF-Ra Giornata" (semifinale, gara 2), "FF-Aa Giornata" (finale).
 */
function roundName(label: string): string {
  const day = label.match(/^(\d+)\s*a\s+Giornata$/i);
  if (day) return `${day[1]}ª giornata`;
  const po = label.match(/^(\w+)-([ARS])a\s+Giornata$/i);
  if (po) {
    const stages: Record<string, string> = { "8i": "Ottavi", "4i": "Quarti", sf: "Semifinale", ff: "Finale", f: "Finale" };
    const game = { A: 1, R: 2, S: 3 }[po[2].toUpperCase() as "A" | "R" | "S"];
    const stage = stages[po[1].toLowerCase()] ?? po[1];
    return stage === "Finale" && game === 1 ? "Finale" : `${stage} · gara ${game}`;
  }
  return label;
}

// ---------------------------------------------------------------------------
// Pagine
// ---------------------------------------------------------------------------
async function searchMatches(key: string) {
  const root = parse(await get(`components/search-results.php?key=${encodeURIComponent(key)}&activeSeason=false`));
  const out: { matchId: number; projectId: number | null; label: string }[] = [];
  const teams: { teamId: number; label: string }[] = [];
  for (const tr of root.querySelectorAll("tr")) {
    const tds = tr.querySelectorAll("td");
    if (tds.length < 2) continue;
    const kind = text(tds[0]);
    const links = tr.querySelectorAll("a").map((a) => a.getAttribute("href") ?? "");
    if (kind === "Partita") {
      const matchId = idFrom(links.find((l) => l.includes("match_details")), "id");
      if (matchId) out.push({ matchId, projectId: idFrom(links.find((l) => l.includes("project_id")), "project_id"), label: text(tds[1]) });
    } else if (kind === "Squadra") {
      const teamId = idFrom(links.find((l) => l.includes("team_details")), "team_id");
      if (teamId) teams.push({ teamId, label: text(tds[1]) });
    }
  }
  return { matches: out, teams };
}

async function matchDetails(id: number) {
  const html = await get(`match_details.php?id=${id}`);
  const root = parse(html);
  const box = root.querySelector("#match-main");
  if (!box) {
    if (/non trovata/i.test(text(root.querySelector("main")))) return null; // gara in calendario ma non ancora pubblicata
    throw new Error(`Scheda partita ${id} non riconosciuta`);
  }
  const head = text(box.querySelector(".solid-border"));
  const date = head.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const teamLinks = box.querySelectorAll("h5 a").filter((a) => (a.getAttribute("href") ?? "").includes("team_id="));
  const scoreEl = box.querySelector("h1");
  const score = text(scoreEl).match(/(\d+)\s*-\s*(\d+)/);
  // parziali letti dall'HTML grezzo: il parser scarta i "</br>" che li separano
  const periods = (html.match(/<!-- Parziali -->\s*<div[^>]*>\s*<h6>([\s\S]*?)<\/h6>/)?.[1] ?? "")
    .split(/<\/?br\s*\/?>/i)
    .map((p) => clean(p.replace(/<[^>]+>/g, "")).match(/(\d+)\s*-\s*(\d+)/))
    .filter((m): m is RegExpMatchArray => m !== null);
  const venue = box.querySelector('a[href^="field_details.php"]');
  const roundLabel = text(box.querySelector(".solid-border small small")) || null;
  const breadcrumb = root.querySelectorAll(".breadcrumb a").map((a) => text(a));
  return {
    csiMatchId: id,
    url: `${BASE}match_details.php?id=${id}`,
    projectId: idFrom(box.querySelector('a[href*="project_id="]')?.getAttribute("href"), "project_id"),
    seasonLabel: breadcrumb.find((b) => /^\d{4} - \d{4}$/.test(b)) ?? null,
    round: int(roundLabel?.match(/^(\d+)\s*a\s+Giornata$/i)?.[1]),
    roundLabel: roundLabel ? roundName(roundLabel) : null,
    code: head.match(/N° gara\s*(\S+)/)?.[1] ?? null,
    date: date ? `${date[3]}-${date[2]}-${date[1]}` : null,
    time: head.match(/ore\s*(\d{1,2}:\d{2})/)?.[1]?.padStart(5, "0") ?? null,
    home: text(teamLinks[0]),
    homeTeamId: idFrom(teamLinks[0]?.getAttribute("href"), "team_id"),
    away: text(teamLinks[1]),
    awayTeamId: idFrom(teamLinks[1]?.getAttribute("href"), "team_id"),
    homeScore: score ? Number(score[1]) : null,
    awayScore: score ? Number(score[2]) : null,
    /** in corsivo sul Livescore = risultato non ancora omologato */
    resultApproved: score ? !/<i>/i.test(scoreEl?.innerHTML ?? "") : null,
    homePeriods: periods.map((m) => Number(m[1])),
    awayPeriods: periods.map((m) => Number(m[2])),
    venueId: idFrom(venue?.getAttribute("href"), "id"),
    venue: text(venue) || null,
  };
}

/**
 * Gara presente nell'indice di ricerca ma con scheda non ancora pubblica (di solito data da
 * fissare): squadre ricavate dall'etichetta "Casa - Ospite [Stagione ...]".
 */
function unpublished(id: number, label: string, ownNames: string[]): MatchDetails | null {
  const teams = label.replace(/\s*\[Stagione.*$/, "").trim();
  for (const own of ownNames) {
    const isHome = teams.startsWith(`${own} - `);
    const isAway = teams.endsWith(` - ${own}`);
    if (!isHome && !isAway) continue;
    const opponent = isHome ? teams.slice(own.length + 3) : teams.slice(0, -(own.length + 3));
    return {
      csiMatchId: id, url: `${BASE}match_details.php?id=${id}`, projectId: null, seasonLabel: null, round: null, roundLabel: null,
      code: null, date: null, time: null, home: isHome ? own : opponent, homeTeamId: null, away: isHome ? opponent : own, awayTeamId: null,
      homeScore: null, awayScore: null, resultApproved: null, homePeriods: [], awayPeriods: [], venueId: null, venue: null,
    };
  }
  return null;
}
type MatchDetails = NonNullable<Awaited<ReturnType<typeof matchDetails>>>;

/** Indirizzi delle palestre dalla tabella risultati della competizione. */
async function projectVenues(projectId: number, into: Map<number, { name: string; address: string | null; geo: string | null }>) {
  const root = parse(await get(`components/project-sheets-results.php?project_id=${projectId}`));
  for (const a of root.querySelectorAll('a[href^="field_details.php"]')) {
    const id = idFrom(a.getAttribute("href"), "id");
    if (!id || into.has(id)) continue;
    const maps = a.parentNode?.querySelector('a[href*="maps"]');
    into.set(id, {
      name: text(a),
      address: text(maps).replace(/,\s*Italia$/, "") || null,
      geo: maps?.getAttribute("href")?.match(/place\/([\d.-]+,[\d.-]+)/)?.[1] ?? null,
    });
  }
}

async function projectStandings(projectId: number, teamId: number) {
  const root = parse(await get(`components/project-sheets.php?project_id=${projectId}`));
  for (const table of root.querySelectorAll("table")) {
    const headers = table.querySelectorAll("thead th").map((th) => text(th));
    const rows = table.querySelectorAll("tbody tr").map((tr) => {
      const cells = tr.querySelectorAll("td").map((td) => text(td));
      const link = tr.querySelector('a[href*="team_id="]');
      const col = (name: string) => cells[headers.indexOf(name)];
      return {
        position: int(col("Pos")),
        team: text(link),
        teamId: idFrom(link?.getAttribute("href"), "team_id"),
        points: dec(col("Pti")),
        played: int(col("PG")),
        wins: int(col("V")),
        losses: int(col("S")),
        ssp: int(col("SSP")),
        pf: int(col("PF")),
        pa: int(col("PS")),
        qc: dec(col("Q. C.")),
        qtot: dec(col("Q. Tot")),
      };
    });
    if (!rows.some((r) => r.teamId === teamId)) continue;
    // titolo del girone: l'intestazione che precede la tabella
    let title: string | null = null;
    for (let el = table.parentNode; el && !title; el = el.parentNode) {
      const h = el.querySelector("h5, h4, h3");
      if (h) title = text(h);
    }
    return { group: title, headers, rows };
  }
  return null;
}


// ---------------------------------------------------------------------------
// Download completo (tutte le stagioni configurate o solo alcune)
// ---------------------------------------------------------------------------
export type LivescoreMatch = MatchDetails & { season: string; competition: string };
export type LivescoreStanding = NonNullable<Awaited<ReturnType<typeof projectStandings>>> & { season: string; competition: string; projectId: number; url: string };
export interface LivescoreVenue {
  csiId: number;
  name: string;
  address: string | null;
  geo: string | null;
}

export async function fetchLivescore(cfg: Config, opts: { seasons?: string[]; cache?: boolean } = {}) {
  useCache = opts.cache ?? false;
  const wanted = (slug: string) => !opts.seasons || opts.seasons.includes(slug);
  const ownTeamIds = new Set(cfg.seasons.map((s) => s.csiTeamId).filter((x): x is number => x !== null));
  const projectToCompetition = new Map<number, { season: string; competition: string }>();
  for (const s of cfg.seasons) {
    for (const c of s.competitions) {
      for (const p of [c.csi_project_id, ...(c.extraProjectIds ?? [])]) {
        if (p) projectToCompetition.set(p, { season: s.slug, competition: c.slug });
      }
    }
  }
  const ownNames = [...new Set([cfg.ownTeam.name, ...cfg.seasons.map((s) => s.ownDisplayName)].filter((n): n is string => !!n))];
  const search = await searchMatches(cfg.ownTeam.livescoreSearch ?? cfg.ownTeam.name);
  const warnings: string[] = [];
  for (const t of search.teams) {
    if (!ownNames.some((n) => t.label.startsWith(`${n} [`))) continue;
    if (!ownTeamIds.has(t.teamId)) warnings.push(`Squadra Livescore non configurata (csiTeamId ${t.teamId}): ${t.label}`);
  }

  const venues = new Map<number, { name: string; address: string | null; geo: string | null }>();
  for (const [p, target] of projectToCompetition) if (wanted(target.season)) await projectVenues(p, venues);

  const matches: LivescoreMatch[] = [];
  for (const m of search.matches) {
    if (!ownNames.some((n) => m.label.includes(n))) continue; // la ricerca è per parole: scarta le altre squadre
    const target = m.projectId ? projectToCompetition.get(m.projectId) : undefined;
    if (!target) {
      warnings.push(`Partita ${m.matchId} di una competizione non configurata (project_id ${m.projectId}): ${m.label}`);
      continue;
    }
    if (!wanted(target.season)) continue;
    const d = (await matchDetails(m.matchId)) ?? unpublished(m.matchId, m.label, ownNames);
    if (!d) {
      warnings.push(`Partita ${m.matchId} non leggibile: ${m.label}`);
      continue;
    }
    if (d.homeTeamId !== null && !ownTeamIds.has(d.homeTeamId) && !ownTeamIds.has(d.awayTeamId ?? -1)) continue;
    matches.push({ season: target.season, competition: target.competition, ...d });
  }
  matches.sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || (a.round ?? 0) - (b.round ?? 0));

  const standings: LivescoreStanding[] = [];
  for (const s of cfg.seasons) {
    if (!s.csiTeamId || !wanted(s.slug)) continue;
    for (const c of s.competitions) {
      if (!c.csi_project_id) continue;
      const st = await projectStandings(c.csi_project_id, s.csiTeamId);
      if (st && st.rows.some((r) => (r.played ?? 0) > 0)) {
        standings.push({ season: s.slug, competition: c.slug, projectId: c.csi_project_id, url: `${BASE}league_details.php?project_id=${c.csi_project_id}`, ...st });
      }
    }
  }

  const usedVenues = new Set(matches.map((m) => m.venueId));
  return {
    retrievedAt: new Date().toISOString().slice(0, 10),
    venues: [...venues.entries()].filter(([id]) => usedVenues.has(id)).map(([csiId, v]): LivescoreVenue => ({ csiId, ...v })),
    matches,
    standings,
    warnings,
  };
}

/**
 * Loghi delle squadre dalla classifica del Livescore: solo il girone di `teamId`, oppure tutti i
 * gironi della competizione con `teamId` null.
 */
export async function projectLogos(projectId: number, teamId: number | null, opts: { cache?: boolean } = {}) {
  useCache = opts.cache ?? false;
  const root = parse(await get(`components/project-sheets.php?project_id=${projectId}`));
  const all: { teamId: number | null; team: string; logoUrl: string }[] = [];
  for (const table of root.querySelectorAll("table")) {
    const out: typeof all = [];
    for (const tr of table.querySelectorAll("tbody tr")) {
      const link = tr.querySelector('a[href*="team_id="]');
      const src = tr.querySelector('img[src*="teams/logos/"]')?.getAttribute("src");
      if (!link) continue;
      out.push({ teamId: idFrom(link.getAttribute("href"), "team_id"), team: text(link), logoUrl: src ? new URL(src, BASE).toString() : "" });
    }
    // solo il girone in cui gioca la squadra (le altre tabelle sono altri gironi)
    if (teamId !== null && out.some((r) => r.teamId === teamId)) return out.filter((r) => r.logoUrl);
    all.push(...out.filter((r) => r.logoUrl));
  }
  return teamId === null ? all : [];
}
