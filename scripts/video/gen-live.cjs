// Diretta di prova SOLO per il database locale: partita con Hoopless al 3° quarto, eventi
// realistici (tiri, rimbalzi, assist, recuperi, cambi) generati con un seme fisso.
const { randomUUID } = require("crypto");
const fs = require("fs");
const WORK = require("path").resolve(__dirname, "../../data/private/video/lavoro");
require("fs").mkdirSync(WORK, { recursive: true });


const MATCH = "4ae59514-165a-45aa-b692-0f267a238094";
const GAME = "11111111-2222-4333-8444-555555555555";
const roster = [
  ["8196aaa5-2ad7-4d08-8203-6859aa57b522", "11", "Andrea Maccaferri"],
  ["63c4bbeb-4704-4dbe-be3f-0376719682dd", "3", "Marcello Lagna"],
  ["14267caa-59d9-4ac2-9c5f-3cb90024c072", "1", "Matteo Mazzanti"],
  ["85d1c931-68da-4905-bc3b-0ab6b89902e8", "2", "Francesco Carini"],
  ["7ea27555-d55e-4229-99f2-7249d16a9dd9", "20", "Tommaso Pedretti"],
  ["f1327679-6822-4f7f-aa30-c3260ab1ba17", "15", "Luca Biolchini"],
  ["a960e062-83c2-4abf-a3a1-97ea2337b8d1", "18", "Gianmarco Tomba"],
  ["370e410f-d718-46a6-ae01-bac40fa84a66", "22", "Davide Nanni"],
  ["06186de3-6be0-40b2-9383-95f464aa02b3", "32", "Federico Hrvatin"],
  ["745f5d84-59c5-4e98-9f85-6ae5d330ecb9", "9", "Francesco Giordani"],
];
let seed = Number(process.argv[2] || 42);
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = (a) => a[Math.floor(rnd() * a.length)];

const events = [];
let n = 0;
const ev = (period, clock, team, player, kind, made = null) => events.push({ id: randomUUID(), n: n++, period, clock, team, player, kind, made });

const lineups = [roster.slice(0, 5), roster.slice(3, 8), [roster[0], roster[1], roster[2], roster[8], roster[9]]];
let onCourt = [];
const sub = (period, clock, next) => {
  for (const p of onCourt) if (!next.includes(p)) ev(period, clock, "own", p[0], "out");
  for (const p of next) if (!onCourt.includes(p)) ev(period, clock, "own", p[0], "in");
  onCourt = next;
};

const shooters = () => onCourt.map((p) => p[0]);
for (let period = 1; period <= 3; period++) {
  const stop = period === 3 ? 262 : 0;
  sub(period, 600, lineups[period - 1]);
  let clock = 600 - Math.round(10 + rnd() * 15);
  let own = period % 2 === 1;
  while (clock > stop) {
    const team = own ? "own" : "opp";
    const shooter = own ? pick(shooters()) : null;
    const r = rnd();
    if (r < 0.12) {
      // palla persa (con recupero dell'altra squadra)
      ev(period, clock, team, shooter, "tov");
      ev(period, clock, own ? "opp" : "own", own ? null : pick(shooters()), "stl");
    } else if (r < 0.2) {
      // fallo subito: due liberi
      ev(period, clock, own ? "opp" : "own", own ? null : pick(shooters()), "foul");
      ev(period, clock, team, shooter, "1pt", rnd() < (own ? 0.72 : 0.65));
      ev(period, clock, team, shooter, "1pt", rnd() < (own ? 0.72 : 0.65));
    } else {
      const three = rnd() < 0.3;
      const made = rnd() < (three ? (own ? 0.42 : 0.28) : own ? 0.6 : 0.44);
      ev(period, clock, team, shooter, three ? "3pt" : "2pt", made);
      if (made && own && rnd() < 0.55) ev(period, clock, "own", pick(shooters().filter((p) => p !== shooter)), "ast");
      if (!made) {
        const off = rnd() < 0.27;
        const rebTeam = off ? team : own ? "opp" : "own";
        const rebPlayer = rebTeam === "own" ? pick(shooters()) : null;
        if (!own && !off && rnd() < 0.12) ev(period, clock, "own", pick(shooters()), "blk");
        ev(period, clock, rebTeam, rebPlayer, off ? "oreb" : "dreb");
        if (off) {
          clock -= Math.round(4 + rnd() * 6);
          continue;
        }
      }
    }
    own = !own;
    clock -= Math.round(14 + rnd() * 18);
  }
}

const sql = [];
const rosterJson = JSON.stringify(roster.map(([player_id, jersey, name]) => ({ player_id, jersey, name })));
sql.push(`delete from live_games where match_id = '${MATCH}';`);
sql.push(
  `insert into live_games (id, match_id, status, period, periods, period_seconds, clock_remaining, clock_running, clock_updated_at, roster, opponent_name) values ('${GAME}', '${MATCH}', 'live', 3, 4, 600, 262, true, now(), '${rosterJson}'::jsonb, 'Hoopless');`,
);
for (const e of events) {
  sql.push(
    `insert into live_events (id, game_id, n, period, clock, team, player_id, kind, made) values ('${e.id}', '${GAME}', ${e.n}, ${e.period}, ${e.clock}, '${e.team}', ${e.player ? `'${e.player}'` : "null"}, '${e.kind}', ${e.made === null ? "null" : e.made});`,
  );
}
fs.writeFileSync(WORK + "/live.sql", sql.join("\n"));
// una tripla di Maccaferri da far arrivare durante la registrazione
fs.writeFileSync(
  WORK + "/live-tripla.sql",
  `insert into live_events (id, game_id, n, period, clock, team, player_id, kind, made) values ('${randomUUID()}', '${GAME}', ${n}, 3, 250, 'own', '${roster[0][0]}', '3pt', true);\n` +
    `insert into live_events (id, game_id, n, period, clock, team, player_id, kind, made) values ('${randomUUID()}', '${GAME}', ${n + 1}, 3, 250, 'own', '${roster[3][0]}', 'ast', null);`,
);
const pts = (t) => events.filter((e) => e.team === t && e.made && ["1pt", "2pt", "3pt"].includes(e.kind)).reduce((s, e) => s + { "1pt": 1, "2pt": 2, "3pt": 3 }[e.kind], 0);
console.log("eventi", events.length, "punteggio", pts("own"), "-", pts("opp"));
