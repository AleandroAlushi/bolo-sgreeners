/**
 * Prova delle grafiche Instagram con dati finti, senza database né server:
 *   npx tsx scripts/graphics-preview.tsx <cartella> [foto.jpg]
 * Scrive un PNG per modello nella cartella indicata.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BoxScoreCard, FinalCard, LeadersCard, MvpCard, PreMatchCard, renderSocial, type BoxRow, type PreMatchData } from "../src/lib/graphics/social/cards";
import { croppedPhoto, tintedPhoto } from "../src/lib/graphics/social/photo";

const [out = "grafiche-prova", photoFile] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const photoBuf = photoFile ? readFileSync(photoFile) : null;
let storyPhoto: string | null = null;
let mvpPhoto: string | null = null;
let head: string | null = null;
const rows: BoxRow[] = [
  ["Carini", 12, 4, 3, 3], ["Mazzanti", 11, 15, 0, 0], ["Venturi", 10, 4, 3, 4], ["Nanni", 8, 5, 6, 2], ["Tomba", 8, 2, 1, 4], ["Maccaferri", 6, 0, 0, 0],
  ["Morando", 6, 7, 0, 1], ["Bertuzzi", 5, 3, 1, 2], ["Biscarini", 2, 5, 0, 1], ["Pedretti", 2, 5, 4, 3], ["Lagna", 1, 2, 0, 3],
].map(([name, pts, reb, ast, stl]) => ({ name, pts, reb, ast, stl }) as BoxRow);

const pre: PreMatchData = {
  own: { code: "BSG", name: "Bolo Sgreeners", logo: null, own: true },
  opponent: { code: "POR", name: "Polisportiva Trottola Porretta", logo: null },
  away: false,
  day: "LUN 2.11",
  time: "22:15",
  venue: "Palasalvemini",
  photo: null,
};

const jobs: [string, () => Promise<Response>][] = [
  ["presentazione-post", () => renderSocial((a) => <PreMatchCard d={pre} format="post" a={a} />, "post")],
  ["presentazione-storia", () => renderSocial((a) => <PreMatchCard d={{ ...pre, photo: storyPhoto }} format="storia" a={a} />, "storia")],
  ["presentazione-post-senza-foto", () => renderSocial((a) => <PreMatchCard d={{ ...pre, photo: null, away: true }} format="post" a={a} />, "post")],
  ["finale", () => renderSocial((a) => <FinalCard d={{ top: { ...pre.own, score: 71 }, bottom: { ...pre.opponent, score: 42 } }} a={a} />)],
  ["mvp", () => renderSocial((a) => <MvpCard d={{ name: "Francesco Carini", stats: ["12 PTS", "4 REB", "3 AST", "3 STL"], photo: mvpPhoto }} a={a} />)],
  ["box-score", () => renderSocial((a) => <BoxScoreCard rows={rows} a={a} />)],
  [
    "leader",
    () =>
      renderSocial((a) => (
        <LeadersCard
          leaders={[
            { label: "PUNTI", value: 12, name: "Francesco Carini", photo: head },
            { label: "RIMBALZI", value: 15, name: "Matteo Mazzanti", photo: head },
            { label: "ASSIST", value: 6, name: "Davide Nanni", photo: head },
            { label: "RECUPERI", value: 4, name: "Simone Venturi", photo: null },
          ]}
          a={a}
        />
      )),
  ],
];

(async () => {
  if (photoBuf) {
    mvpPhoto = await croppedPhoto(photoBuf, 520, 910);
    head = await croppedPhoto(photoBuf, 190, 228);
  }
  if (photoBuf) pre.photo = await tintedPhoto(photoBuf, 602, 1350);
  storyPhoto = photoBuf ? await tintedPhoto(photoBuf, 602, 1920) : null;
  for (const [name, job] of jobs) {
    const res = await job();
    writeFileSync(join(out, `${name}.png`), Buffer.from(await res.arrayBuffer()));
    console.log(name);
  }
})();
