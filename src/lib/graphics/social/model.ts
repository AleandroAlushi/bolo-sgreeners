import "server-only";
/**
 * Dal database ai dati delle grafiche nuove e delle didascalie: presentazione (mattina della
 * partita) e pacchetto del dopo partita (finale, MVP, box score, leader, didascalia).
 * Il profilo Instagram è un dato riservato: si legge con il client della sessione admin.
 */
import { getGraphicMatch, type GraphicMatch } from "@/lib/graphics/data";
import { getSeasonMatches, type MatchView, type PlayerGameLine } from "@/lib/data/matches";
import { getSeasonRoster } from "@/lib/data/players";
import { publicMediaUrl } from "@/lib/media";
import type { createSessionClient } from "@/lib/supabase/server";
import { postCaption, preCaption, type CaptionPlayer } from "./caption";
import type { BoxRow, FinalData, Leader, MvpData, PreMatchData, TeamBadge } from "./cards";
import { mvpScore, shortDay, teamCode } from "./format";

type Session = Awaited<ReturnType<typeof createSessionClient>>;

export interface SocialKit {
  g: GraphicMatch;
  played: boolean;
  hasBoxScore: boolean;
  pre: PreMatchData;
  preCaption: string;
  final: FinalData | null;
  /** MVP indicato dall'admin oppure calcolato dalla valutazione (auto = true) */
  mvp: { data: MvpData; playerId: string | null; auto: boolean } | null;
  box: BoxRow[];
  leaders: Leader[];
  postCaption: string | null;
}

const isPlayed = (m: MatchView) => (m.status === "played" || m.status === "forfeit") && m.own_score !== null && m.opponent_score !== null;
const order = (m: MatchView) => `${m.match_date ?? "9999"} ${m.start_time ?? "99"}`;

export async function getSocialKit(matchId: string, session: Session): Promise<SocialKit | null> {
  const g = await getGraphicMatch(matchId);
  if (!g) return null;
  const m = g.match;
  const [season, roster, teams] = await Promise.all([
    m.season_id ? getSeasonMatches(m.season_id) : Promise.resolve([] as MatchView[]),
    m.season_id ? getSeasonRoster(m.season_id) : Promise.resolve([]),
    session.from("teams").select("id, code, name, short_name, is_own_team").or(`is_own_team.eq.true${m.opponent_id ? `,id.eq.${m.opponent_id}` : ""}`),
  ]);
  const teamRows = teams.data ?? [];
  const ownTeam = teamRows.find((t) => t.is_own_team);
  const oppTeam = teamRows.find((t) => t.id === m.opponent_id);
  const own: TeamBadge = { code: ownTeam?.code ?? "BSG", name: "Bolo Sgreeners", logo: null, own: true };
  const opponent: TeamBadge = {
    code: oppTeam?.code ?? teamCode(oppTeam?.short_name ?? oppTeam?.name ?? m.opponent_name ?? ""),
    name: m.opponent_name ?? "Avversari",
    logo: g.opponentLogo,
  };

  const pre: PreMatchData = {
    own,
    opponent,
    away: g.home === false,
    day: shortDay(m.match_date),
    time: m.start_time?.slice(0, 5) ?? null,
    venue: m.venue_name,
    photo: null,
  };
  const preText = preCaption({ opponent: opponent.name, home: g.home, date: m.match_date, time: m.start_time, venue: m.venue_name });

  const played = isPlayed(m);
  const lines = g.playerLines.filter((l) => l.is_own_team && l.participation === "played");
  const hasBoxScore = played && lines.length > 0;
  const base = { g, played, hasBoxScore, pre, preCaption: preText };
  if (!played) return { ...base, final: null, mvp: null, box: [], leaders: [], postCaption: null };

  const ownScore = m.own_score!;
  const oppScore = m.opponent_score!;
  const ownBadge = { ...own, score: ownScore };
  const oppBadge = { ...opponent, score: oppScore };
  const final: FinalData = g.home === false ? { top: oppBadge, bottom: ownBadge } : { top: ownBadge, bottom: oppBadge };
  if (!hasBoxScore) return { ...base, final, mvp: null, box: [], leaders: [], postCaption: null };

  // nomi e foto dal roster della stagione
  const byId = new Map(roster.map((r) => [r.player_id, r]));
  const lastNames = lines.map((l) => byId.get(l.player_id ?? "")?.last_name ?? (l.player_name ?? l.raw_name ?? "").split(" ").slice(1).join(" ") ?? "");
  const shortName = (l: PlayerGameLine, i: number) => {
    const last = lastNames[i] || l.player_name || l.raw_name || "?";
    // due cognomi uguali: iniziale del nome davanti
    return lastNames.filter((x) => x === last).length > 1 ? `${(l.player_name ?? "?")[0]}. ${last}` : last;
  };
  const photoOf = (id: string | null) => publicMediaUrl(byId.get(id ?? "")?.photo_path);
  const n = (v: number | null) => v ?? 0;

  const box: BoxRow[] = lines
    .map((l, i) => ({ l, name: shortName(l, i) }))
    .sort((a, b) => n(b.l.points) - n(a.l.points) || n(b.l.reb) - n(a.l.reb) || a.name.localeCompare(b.name))
    .map(({ l, name }) => ({ name, pts: n(l.points), reb: n(l.reb), ast: n(l.ast), stl: n(l.stl) }));

  const leaders: Leader[] = (
    [
      ["PUNTI", "points"],
      ["RIMBALZI", "reb"],
      ["ASSIST", "ast"],
      ["RECUPERI", "stl"],
    ] as const
  ).map(([label, key]) => {
    const best = [...lines].sort((a, b) => n(b[key]) - n(a[key]) || n(b.points) - n(a.points))[0];
    return { label, value: n(best[key]), name: best.player_name ?? best.raw_name ?? "", photo: photoOf(best.player_id) };
  });

  // MVP: quello indicato dall'admin, altrimenti il migliore per valutazione
  const saved = lines.find((l) => l.player_id && l.player_id === g.mvpPlayerId);
  const mvpLine = saved ?? [...lines].sort((a, b) => mvpScore(b) - mvpScore(a) || n(b.points) - n(a.points))[0];
  const mvpStats = (
    [
      ["PTS", mvpLine.points],
      ["REB", mvpLine.reb],
      ["AST", mvpLine.ast],
      ["STL", mvpLine.stl],
      ["BLK", mvpLine.blk],
    ] as const
  ).filter(([, v]) => n(v) > 0);
  // al massimo 4 voci: con 5, via la più piccola tra assist, recuperi e stoppate
  if (mvpStats.length > 4) {
    const drop = mvpStats.slice(2).reduce((min, s) => (n(s[1]) < n(min[1]) ? s : min));
    mvpStats.splice(mvpStats.indexOf(drop), 1);
  }
  const mvp = {
    data: { name: mvpLine.player_name ?? mvpLine.raw_name ?? "", stats: mvpStats.map(([k, v]) => `${v} ${k}`), photo: photoOf(mvpLine.player_id) },
    playerId: mvpLine.player_id,
    auto: !saved,
  };

  // record, serie, prima in casa/trasferta, prossima partita
  const ownGames = season.filter((x) => x.involves_own_team && x.status !== "cancelled").sort((a, b) => order(a).localeCompare(order(b)));
  const idx = ownGames.findIndex((x) => x.id === m.id);
  const before = ownGames.slice(0, idx + 1).filter(isPlayed);
  const wins = before.filter((x) => x.own_score! > x.opponent_score!).length;
  let streak = 0;
  for (const x of [...before].reverse()) {
    if (x.own_score! > x.opponent_score! === ownScore > oppScore) streak++;
    else break;
  }
  // la partita successiva a questa (anche se poi giocata: la didascalia si può rifare più tardi)
  const nextGame = ownGames.slice(idx + 1).find((x) => x.status !== "postponed") ?? null;
  const sideOf = (x: MatchView) => (x.own_side === "home" ? true : x.own_side === "away" ? false : null);

  const ids = lines.map((l) => l.player_id).filter((x): x is string => Boolean(x));
  const [awards, socials] = await Promise.all([
    mvpLine.player_id
      ? session
          .from("match_awards")
          .select("match_id")
          .eq("award", "mvp")
          .eq("player_id", mvpLine.player_id)
          .in(
            "match_id",
            before.map((x) => x.id!),
          )
      : Promise.resolve({ data: [] as { match_id: string }[] }),
    session.from("private_profiles").select("player_id, instagram").in("player_id", ids),
  ]);
  const insta = new Map((socials.data ?? []).map((s) => [s.player_id, s.instagram]));
  const asCaption = (l: PlayerGameLine): CaptionPlayer => ({
    name: l.player_name ?? l.raw_name ?? "",
    instagram: insta.get(l.player_id) ?? null,
    pts: n(l.points),
    reb: n(l.reb),
    ast: n(l.ast),
    stl: n(l.stl),
    blk: n(l.blk),
  });
  const mvpCount = (awards.data ?? []).filter((a) => a.match_id !== m.id).length + 1;
  const text = postCaption({
    ownScore,
    oppScore,
    home: g.home,
    opponent: opponent.name,
    date: m.match_date,
    wins,
    losses: before.length - wins,
    firstGame: before.length === 1,
    firstOfKind: before.filter((x) => sideOf(x) === g.home).length === 1,
    streak,
    mvp: asCaption(mvpLine),
    mvpCount,
    players: lines.map(asCaption),
    next: nextGame
      ? {
          date: nextGame.match_date,
          home: sideOf(nextGame),
          opponent: nextGame.opponent_name ?? "avversari",
          firstOfKind: !ownGames.slice(0, ownGames.indexOf(nextGame)).some((x) => sideOf(x) === sideOf(nextGame)),
        }
      : null,
  });

  return { ...base, final, mvp, box, leaders, postCaption: text };
}
