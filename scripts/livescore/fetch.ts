/**
 * Lettura del Livescore CSI Bologna (calendario, risultati, parziali, palestre, classifiche):
 * usata da `npm run livescore:sync` (scrive data/curated/livescore.json) e da
 * `npm run livescore:update` (aggiorna direttamente il database per la stagione in corso).
 *
 * Dal sito nuovo (novembre 2026) le partite, anche le nostre, si leggono dalla tabella risultati
 * di ogni competizione configurata. Le formazioni del Livescore non vengono usate: i punti dei
 * giocatori spesso non coincidono con i box score.
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
// Pagine (sito nuovo, da novembre 2026): classifica e risultati di una competizione arrivano da
// assets/json/getProjectSheetSection.php?project_id=…&section=ranking|results, che la pagina
// league.php carica da sola. Le vecchie components/project-sheets*.php ora rispondono vuote.
// ---------------------------------------------------------------------------
const sections = new Map<string, Promise<string>>(); // una sola richiesta per sezione a ogni esecuzione
async function section(projectId: number, name: "ranking" | "results") {
  const path = sectionPath(projectId, name);
  if (!sections.has(path)) sections.set(path, get(path));
  const html = await sections.get(path)!;
  if (!html.trim()) throw new Error(`Livescore: sezione "${name}" della competizione ${projectId} vuota (il sito è cambiato?)`);
  return parse(html);
}

/** Indirizzi delle palestre dalla tabella risultati della competizione. */
async function projectVenues(projectId: number, into: Map<number, { name: string; address: string | null; geo: string | null }>) {
  const root = await section(projectId, "results");
  for (const a of root.querySelectorAll('a[href^="field.php"]')) {
    const id = idFrom(a.getAttribute("href"), "id");
    if (!id || into.has(id)) continue;
    const address = text(a.parentNode?.querySelector(".live-result-location__address"));
    into.set(id, { name: text(a), address: address.replace(/,\s*Italia$/, "") || null, geo: null });
  }
}

/**
 * Tutte le partite del girone di `teamId` (o di tutti i gironi con `teamId` null) dalla tabella
 * risultati della competizione: una scheda per girone, anche le partite tra le altre squadre.
 * Colonne: ID, giornata, casa, ospite, riquadro (squadre, stato, parziali), n° gara, data,
 * impianto, risultato, parziali, note.
 */
async function projectResults(projectId: number, teamId: number | null) {
  const root = await section(projectId, "results");
  const panes = root.querySelectorAll(".tab-pane");
  const chosen = teamId === null ? (panes.length ? panes : [root]) : [(panes.length ? panes : [root]).find((p) => p.querySelector(`a[href*="team_id=${teamId}"]`))];
  const out = [];
  for (const pane of chosen) {
    if (!pane) continue;
    for (const tr of pane.querySelectorAll("tr[data-round]")) {
      const tds = tr.querySelectorAll("td");
      if (tds.length < 10) continue;
      const csiMatchId = int(text(tds[0]));
      if (!csiMatchId) continue;
      const teamLinks = tds[4].querySelectorAll('a[href*="team_id="]');
      const when = (tds[6].getAttribute("data-order") ?? "").match(/(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}))?/);
      const score = text(tds[8]).match(/^(\d+)\s*-\s*(\d+)$/);
      const periods = text(tds[9])
        .split(",")
        .map((p) => p.match(/(\d+)\s*-\s*(\d+)/))
        .filter((m): m is RegExpMatchArray => m !== null);
      const field = tds[7].querySelector('a[href^="field.php"]');
      // a volte il totale sul Livescore è sbagliato (es. 162-163 con parziali che fanno 84-85):
      // se i parziali ci sono e non tornano col totale, valgono i parziali
      let homeScore = score ? Number(score[1]) : null;
      let awayScore = score ? Number(score[2]) : null;
      let scoreFix: string | null = null;
      if (score && periods.length) {
        const h = periods.reduce((s, m) => s + Number(m[1]), 0);
        const a = periods.reduce((s, m) => s + Number(m[2]), 0);
        if (h !== homeScore || a !== awayScore) {
          scoreFix = `Partita ${csiMatchId} (${text(tds[2])} - ${text(tds[3])}): sul Livescore ${homeScore}-${awayScore}, ma i parziali fanno ${h}-${a}; uso ${h}-${a}`;
          [homeScore, awayScore] = [h, a];
        }
      }
      out.push({
        csiMatchId,
        projectId,
        round: int(tr.getAttribute("data-round") ?? undefined) ?? null,
        roundLabel: roundName(text(tds[1])),
        code: text(tds[5]) || null,
        date: when ? `${when[1]}-${when[2]}-${when[3]}` : null,
        time: when?.[4] && !(when[4] === "00" && when[5] === "00") ? `${when[4]}:${when[5]}` : null,
        home: text(tds[2]),
        homeTeamId: idFrom(teamLinks[0]?.getAttribute("href"), "team_id"),
        away: text(tds[3]),
        awayTeamId: idFrom(teamLinks[1]?.getAttribute("href"), "team_id"),
        homeScore,
        awayScore,
        scoreFix,
        // "Da Omologare": risultato non ancora omologato
        resultApproved: score ? !tds[4].querySelector(".live-result-state--unofficial") : null,
        homePeriods: periods.map((m) => Number(m[1])),
        awayPeriods: periods.map((m) => Number(m[2])),
        venueId: idFrom(field?.getAttribute("href"), "id"),
        venue: text(field) || null,
      });
    }
  }
  return out;
}

async function projectStandings(projectId: number, teamId: number) {
  const root = await section(projectId, "ranking");
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
    return { group: title, headers: headers.filter((h) => !["Ultime 5", "% vittorie"].includes(h)), rows };
  }
  return null;
}

type MatchDetails = Awaited<ReturnType<typeof projectResults>>[number] & { url: string; seasonLabel: string | null };


// ---------------------------------------------------------------------------
// Download completo (tutte le stagioni configurate o solo alcune)
// ---------------------------------------------------------------------------
export type LivescoreMatch = MatchDetails & { season: string; competition: string };
export type LivescoreResult = Awaited<ReturnType<typeof projectResults>>[number] & { season: string; competition: string };
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
  const warnings: string[] = [];

  const venues = new Map<number, { name: string; address: string | null; geo: string | null }>();
  for (const [p, target] of projectToCompetition) if (wanted(target.season)) await projectVenues(p, venues);

  // le nostre partite: dalla tabella risultati di ogni competizione configurata (la ricerca del
  // vecchio sito non c'è più); il Livescore nuovo elenca anche le gare non ancora giocate
  const matches: LivescoreMatch[] = [];
  for (const [p, target] of projectToCompetition) {
    if (!wanted(target.season)) continue;
    for (const r of await projectResults(p, null)) {
      if (!ownTeamIds.has(r.homeTeamId ?? -1) && !ownTeamIds.has(r.awayTeamId ?? -1)) continue;
      matches.push({ season: target.season, competition: target.competition, url: `${BASE}game.php?id=${r.csiMatchId}`, seasonLabel: null, ...r });
    }
  }
  matches.sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || (a.round ?? 0) - (b.round ?? 0));

  const standings: LivescoreStanding[] = [];
  const results: LivescoreResult[] = [];
  for (const s of cfg.seasons) {
    if (!s.csiTeamId || !wanted(s.slug)) continue;
    for (const c of s.competitions) {
      if (!c.csi_project_id) continue;
      for (const r of await projectResults(c.csi_project_id, s.csiTeamId)) results.push({ season: s.slug, competition: c.slug, ...r });
      const st = await projectStandings(c.csi_project_id, s.csiTeamId);
      if (st && st.rows.some((r) => (r.played ?? 0) > 0)) {
        standings.push({ season: s.slug, competition: c.slug, projectId: c.csi_project_id, url: `${BASE}league.php?project_id=${c.csi_project_id}`, ...st });
      }
    }
  }

  for (const fix of new Set(results.map((r) => r.scoreFix).filter((x): x is string => Boolean(x)))) warnings.push(fix);
  const usedVenues = new Set(matches.map((m) => m.venueId));
  return {
    retrievedAt: new Date().toISOString().slice(0, 10),
    venues: [...venues.entries()].filter(([id]) => usedVenues.has(id)).map(([csiId, v]): LivescoreVenue => ({ csiId, ...v })),
    matches,
    standings,
    results,
    warnings,
  };
}

/**
 * Solo i risultati del girone degli Sgreeners (una pagina per competizione): il controllo rapido
 * di `livescore:update -- --rapido`, per capire se c'è qualcosa di nuovo senza scaricare tutto.
 */
export async function fetchRoundResults(
  cfg: Config,
  season: string,
  opts: { attempts?: number; waitMs?: number } = {},
): Promise<LivescoreResult[]> {
  useCache = false;
  const s = cfg.seasons.find((x) => x.slug === season);
  if (!s?.csiTeamId) return [];
  const projects = s.competitions.filter((c) => c.csi_project_id);
  // a volte (es. di sera, mentre il CSI carica i risultati) il server manda per qualche minuto una
  // pagina senza le nostre partite: si riprova dopo una pausa prima di dare errore
  const attempts = opts.attempts ?? 3;
  const waitMs = opts.waitMs ?? 15_000;
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const out: LivescoreResult[] = [];
    lastError = null;
    try {
      for (const c of projects) {
        for (const r of await projectResults(c.csi_project_id!, s.csiTeamId)) out.push({ season, competition: c.slug, ...r });
      }
    } catch (e) {
      lastError = e as Error;
    }
    if (out.length > 0 && !lastError) return out;
    const why = lastError?.message ?? "nessuna nostra partita nella tabella risultati";
    const pages = await Promise.all(projects.map((c) => describeSection(c.csi_project_id!, "results", s.csiTeamId!)));
    console.log(`Livescore, tentativo ${attempt} di ${attempts}: ${why}. ${pages.join(" · ")}`);
    if (attempt < attempts) {
      for (const c of projects) forgetSection(c.csi_project_id!, "results"); // la prossima volta si riscarica
      await sleep(waitMs);
    }
  }
  if (lastError) throw lastError;
  return [];
}

const sectionPath = (projectId: number, name: "ranking" | "results") =>
  `assets/json/getProjectSheetSection.php?project_id=${projectId}&section=${name}`;

function forgetSection(projectId: number, name: "ranking" | "results") {
  sections.delete(sectionPath(projectId, name));
}

/** Cosa è arrivato dal Livescore per una sezione: per capire dai log perché mancano le partite. */
async function describeSection(projectId: number, name: "ranking" | "results", teamId: number) {
  const body = await sections.get(sectionPath(projectId, name))?.catch((e: Error) => `(download fallito: ${e.message})`);
  if (body === undefined) return `competizione ${projectId}: pagina non scaricata`;
  const start = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
  return (
    `competizione ${projectId}: ${body.length} caratteri, ${(body.match(/class="tab-pane/g) ?? []).length} gironi, ` +
    `${(body.match(/<tr[^>]*data-round/g) ?? []).length} righe partita, nostra squadra ${body.includes(`team_id=${teamId}`) ? "presente" : "assente"}; ` +
    `inizio: "${start}"`
  );
}

/**
 * Loghi delle squadre dalla classifica del Livescore: solo il girone di `teamId`, oppure tutti i
 * gironi della competizione con `teamId` null.
 */
export async function projectLogos(projectId: number, teamId: number | null, opts: { cache?: boolean } = {}) {
  useCache = opts.cache ?? false;
  const root = await section(projectId, "ranking");
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
