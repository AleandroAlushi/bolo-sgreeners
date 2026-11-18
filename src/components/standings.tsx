import Link from "next/link";
import type { CompetitionStandings } from "@/lib/data/standings";
import { formatNumber } from "@/lib/domain/format";
import { TeamBadge } from "./match";
import { Notice, cx } from "./ui";

const FIELD_LABEL: Record<string, string> = {
  position: "posizione",
  played: "partite",
  wins: "vittorie",
  losses: "sconfitte",
  points: "punti",
  points_for: "punti fatti",
  points_against: "punti subiti",
};

export function StandingsTable({ data, seasonSlug }: { data: CompetitionStandings; seasonSlug?: string }) {
  // scheda della squadra: la nostra pagina Squadra per noi, la scheda avversari per le altre
  const hrefOf = (teamId: string, own: boolean) =>
    !seasonSlug ? null : own ? `/stagioni/${seasonSlug}/squadra` : data.slugs[teamId] ? `/stagioni/${seasonSlug}/classifica/${data.slugs[teamId]}` : null;
  const showQuotient = data.rows.some((r) => r.extra && "quoziente_totale" in r.extra);
  return (
    <div className="space-y-3">
      {data.mode === "official" && (
        <Notice>
          {data.officialSource ? data.officialSource.label : "Classifica ufficiale CSI"}: nel database non ci sono tutte le partite del
          campionato, quindi non è possibile ricalcolarla.
        </Notice>
      )}
      {data.discrepancies.length > 0 && (
        <Notice tone="warning">
          La classifica calcolata dalle partite non coincide con quella ufficiale CSI:{" "}
          {data.discrepancies
            .slice(0, 6)
            .map((d) => `${d.team_name} (${FIELD_LABEL[d.field] ?? d.field}: CSI ${d.official ?? "–"}, calcolata ${d.computed ?? "–"})`)
            .join("; ")}
          .
        </Notice>
      )}
      {/* da telefono: colonna del nome stretta e fissa, le statistiche scorrono fino in fondo */}
      <div className="-mx-4 overflow-x-auto overscroll-x-none sm:mx-0">
        <table className="stat-table">
          <thead>
            <tr>
              <th>Squadra</th>
              <th title="Punti in classifica">PT</th>
              <th title="Partite giocate">G</th>
              <th title="Vittorie">V</th>
              <th title="Sconfitte">S</th>
              <th title="Punti fatti">PF</th>
              <th title="Punti subiti">PS</th>
              <th title="Differenza punti">DIFF</th>
              {showQuotient && <th title="Quoziente totale CSI (punti/partite + PF/PS)">Q.TOT</th>}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.team_id} className={r.is_own_team ? "is-own" : undefined}>
                <td className="w-[9.5rem] min-w-[9.5rem] max-w-[9.5rem] whitespace-normal sm:w-auto sm:min-w-[12rem] sm:max-w-[16rem] sm:whitespace-nowrap">
                  <span className="flex items-center gap-2">
                    <span className={cx("display w-4 shrink-0 text-center text-base sm:w-5", r.position <= 1 ? "text-primary" : "text-muted")}>{r.position}</span>
                    <TeamBadge name={r.name} own={r.is_own_team} logo={data.logos[r.team_id]} size={26} />
                    {(() => {
                      const href = hrefOf(r.team_id, r.is_own_team);
                      const cls = cx("line-clamp-2 min-w-0 text-[0.78rem] font-semibold leading-tight sm:line-clamp-none sm:truncate sm:text-sm", r.is_own_team && "text-primary", href && "underline-offset-2 hover:text-primary hover:underline");
                      const label = (
                        <>
                          {/* da telefono il nome stabile della squadra, senza sponsor */}
                          <span className="sm:hidden">{data.shortNames[r.team_id] ?? r.name}</span>
                          <span className="hidden sm:inline">{r.name}</span>
                        </>
                      );
                      return href ? (
                        <Link href={href} className={cls} title={`Scheda di ${r.name}`}>
                          {label}
                        </Link>
                      ) : (
                        <span className={cls} title={r.name}>
                          {label}
                        </span>
                      );
                    })()}
                  </span>
                </td>
                <td className="display text-base tabular-nums text-text">{formatNumber(r.points)}</td>
                <td className="tabular-nums">{r.played}</td>
                <td className="tabular-nums">{r.wins}</td>
                <td className="tabular-nums">{r.losses}</td>
                <td className="tabular-nums">{r.points_for}</td>
                <td className="tabular-nums">{r.points_against}</td>
                <td className={cx("tabular-nums", r.point_diff > 0 ? "text-win" : r.point_diff < 0 ? "text-loss" : "")}>
                  {r.point_diff > 0 ? `+${r.point_diff}` : r.point_diff}
                </td>
                {showQuotient && (
                  <td className="tabular-nums">{formatNumber(Number(r.extra?.quoziente_totale ?? NaN), 3)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.mode === "official" && data.pointsFromResults && (
        <p className="text-xs text-muted">
          Punti fatti e subiti ricalcolati dai risultati delle partite: la classifica del CSI, nelle partite finite ai supplementari, conta due
          volte il punteggio dei tempi regolamentari.
        </p>
      )}
      {data.rule && (
        <p className="text-xs text-muted">
          Punti: vittoria {formatNumber(Number(data.rule.points_win))}, sconfitta {formatNumber(Number(data.rule.points_loss))}
          {data.rule.points_ot_loss !== null && `, sconfitta ai supplementari ${formatNumber(Number(data.rule.points_ot_loss))}`}
          {!data.rule.is_verified && " · regolamento dedotto dai dati, da confermare"}
        </p>
      )}
    </div>
  );
}
