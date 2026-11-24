/**
 * Prova delle grafiche Instagram con dati finti, senza database né server:
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/graphics-preview.tsx <cartella> [cartella-scontorni]
 * Scrive un PNG per grafica nella cartella indicata. Con la cartella degli scontorni
 * (es. data/private/grafiche/giocatori) usa i mezzo busto e le foto in partita veri.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { socialAssets } from "../src/lib/graphics/social/assets";
import { BoxScoreCard, FinalCard, LeadersCard, MvpCard, PreMatchCard, renderSocial, type BoxRow, type PreMatchData } from "../src/lib/graphics/social/cards";
import { fadedCutout, scaledCutout, tintedOnBase, type PlacedImage } from "../src/lib/graphics/social/photo";

const [out = "grafiche-prova", photos] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const file = (p: string) => (photos && existsSync(join(photos, p)) ? readFileSync(join(photos, p)) : null);
const gallery = (slug: string) => {
  const dir = photos ? join(photos, "foto-partita", slug) : "";
  const f = dir && existsSync(dir) ? readdirSync(dir).filter((x) => x.endsWith(".png")).sort()[0] : null;
  return f ? readFileSync(join(dir, f)) : null;
};

const rows: BoxRow[] = (
  [
    ["Lagna", 20, 4, 2, 1], ["Hrvatin", 16, 9, 3, 3], ["Mazzanti", 10, 11, 1, 2], ["Biscarini", 8, 5, 6, 1], ["Corriere", 7, 2, 1, 4], ["Maccaferri", 6, 3, 2, 2],
    ["Venturi", 5, 2, 1, 1], ["Biolchini", 4, 3, 2, 1], ["Pedretti", 3, 4, 1, 0], ["Tomba", 2, 3, 0, 1], ["Carini", 2, 1, 1, 1], ["Morando", 0, 1, 0, 0],
  ] as const
).map(([name, pts, reb, ast, stl]) => ({ name, pts, reb, ast, stl }));

const pre: PreMatchData = {
  own: { code: "BSG", name: "Bolo Sgreeners", logo: null, own: true },
  opponent: { code: "ZVC", name: "Zola Vice", logo: null },
  away: true,
  day: "MAR 24.11",
  time: "21:45",
  venue: "Palestra Francesco Francia",
};

(async () => {
  const a = await socialAssets();
  const front = gallery("andrea-maccaferri") ?? file("mezzobusto/andrea-maccaferri.png");
  const back = gallery("tommaso-pedretti") ?? file("mezzobusto/tommaso-pedretti.png");
  const players = [
    front && (await tintedOnBase(front, a.baseFiles["presentazione-post"], { x: 420, y: 690, size: 620, byWidth: true }, 0.72, 1080)),
    back && (await tintedOnBase(back, a.baseFiles["presentazione-post"], { x: 640, y: 100, size: 800 }, 0.65)),
  ].filter((p): p is PlacedImage => Boolean(p));
  const mvpSrc = gallery("federico-hrvatin");
  const mvp = mvpSrc ? await fadedCutout(mvpSrc, 880, 470) : null;
  const leader = async (slug: string) => {
    const f = file(`mezzobusto/${slug}.png`);
    return f ? await scaledCutout(f, 0.31) : null;
  };
  const leaders = [
    { label: "ASSIST", value: 6, firstName: "Tommaso", lastName: "Biscarini", photo: await leader("tommaso-biscarini") },
    { label: "PUNTI", value: 20, firstName: "Marcello", lastName: "Lagna", photo: await leader("marcello-lagna") },
    { label: "RECUPERI", value: 4, firstName: "Filippo", lastName: "Corriere", photo: await leader("filippo-corriere") },
    { label: "RIMBALZI", value: 11, firstName: "Matteo", lastName: "Mazzanti", photo: await leader("matteo-mazzanti") },
  ];
  const jobs: [string, () => Promise<Response>][] = [
    ["presentazione-post", () => renderSocial((x) => <PreMatchCard d={{ ...pre, players }} format="post" a={x} />, "post")],
    ["presentazione-storia", () => renderSocial((x) => <PreMatchCard d={pre} format="storia" a={x} />, "storia")],
    ["finale", () => renderSocial((x) => <FinalCard d={{ own: { ...pre.own, score: 83 }, opponent: { ...pre.opponent, score: 71 } }} a={x} />)],
    ["mvp", () => renderSocial((x) => <MvpCard d={{ name: "Federico Hrvatin", stats: ["16 PTS", "9 REB", "3 STL", "50% FG"], photo: mvp ? { ...mvp, full: true } : null }} a={x} />)],
    ["box-score", () => renderSocial((x) => <BoxScoreCard rows={rows} a={x} />)],
    ["leader", () => renderSocial((x) => <LeadersCard leaders={leaders} a={x} />)],
  ];
  for (const [name, job] of jobs) {
    const res = await job();
    writeFileSync(join(out, `${name}.png`), Buffer.from(await res.arrayBuffer()));
    console.log(name);
  }
})();
