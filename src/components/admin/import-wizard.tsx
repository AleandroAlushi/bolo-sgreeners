"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { AnalyzeResult, ConfirmInput, ConfirmResult } from "@/lib/admin/import-actions";
import { formatMadeAttempted } from "@/lib/domain/format";
import { Badge, Notice, cx } from "../ui";

type Preview = Extract<AnalyzeResult, { status: "preview" }>;
type RowChoice = ConfirmInput["rows"][number] & { mode: "existing" | "new" };

interface Props {
  seasons: { id: string; slug: string }[];
  defaultSeasonId: string | null;
  competitions: { id: string; season_id: string; name: string }[];
  teams: { id: string; name: string; is_own_team: boolean }[];
  players: { id: string; name: string }[];
  analyze: (fd: FormData) => Promise<AnalyzeResult>;
  confirm: (input: ConfirmInput) => Promise<ConfirmResult>;
}

const inputCls = "w-full rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none";

export function ImportWizard({ seasons, defaultSeasonId, competitions, teams, players, analyze, confirm }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [rows, setRows] = useState<RowChoice[]>([]);
  const [matchId, setMatchId] = useState<string>("");
  const [newMatch, setNewMatch] = useState({ competitionId: "", opponentId: "", ownIsHome: true, date: "" });
  const [overwrite, setOverwrite] = useState(false);
  const [done, setDone] = useState<Extract<ConfirmResult, { status: "done" }> | null>(null);

  function onAnalyze(fd: FormData) {
    setError(null);
    setDone(null);
    startTransition(async () => {
      const res = await analyze(fd);
      if (res.status === "error") {
        setError(res.message);
        setPreview(null);
        return;
      }
      setPreview(res);
      setRows(res.mappings.map((m) => ({ playerId: m.playerId, newPlayer: null, saveAlias: m.status === "matched" ? "none" : "always", mode: "existing" })));
      setMatchId(res.suggestedMatchId ?? "");
      setNewMatch({ competitionId: competitions.find((c) => c.season_id === res.seasonId)?.id ?? "", opponentId: res.suggestedOpponentId ?? "", ownIsHome: res.report.own.appSide === "home", date: res.report.date ?? "" });
      setOverwrite(false);
    });
  }

  const selected = preview?.candidates.find((c) => c.id === matchId) ?? null;
  const unresolved = useMemo(
    () => (preview ? preview.report.players.filter((p, i) => p.participation !== "absent" && !rows[i]?.playerId && !rows[i]?.newPlayer).length : 0),
    [preview, rows],
  );

  function onConfirm() {
    if (!preview) return;
    setError(null);
    startTransition(async () => {
      const res = await confirm({
        hash: preview.hash,
        fileName: preview.fileName,
        size: preview.size,
        seasonId: preview.seasonId,
        matchId: matchId && matchId !== "new" ? matchId : null,
        newMatch: matchId === "new" ? newMatch : null,
        overwrite,
        rows: rows.map((r) => ({ playerId: r.playerId, newPlayer: r.newPlayer, saveAlias: r.saveAlias })),
      });
      if (res.status === "error") setError(res.message);
      else {
        setDone(res);
        setPreview(null);
      }
    });
  }

  const updateRow = (i: number, patch: Partial<RowChoice>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-6">
      <form action={onAnalyze} className="card grid gap-3 p-4 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">1. Stagione</span>
          <select name="season_id" defaultValue={defaultSeasonId ?? ""} className={inputCls} required>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.slug}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">2. File HTML (Easy Stats)</span>
          <input name="file" type="file" accept=".html,.htm,text/html" required className={cx(inputCls, "file:mr-3 file:rounded-full file:border-0 file:bg-surface-3 file:px-3 file:py-1 file:text-text")} />
        </label>
        <button disabled={pending} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-ink disabled:opacity-50">
          {pending && !preview ? "Analisi…" : "Analizza"}
        </button>
      </form>

      {error && <Notice tone="warning">{error}</Notice>}
      {done && (
        <Notice>
          {done.message}{" "}
          <Link href={`/partite/${done.matchId}`} className="font-semibold text-primary underline">
            Vedi la partita
          </Link>
        </Notice>
      )}

      {preview && (
        <div className="space-y-6">
          {preview.duplicateOf && (
            <Notice tone="warning">
              Questo file è già stato importato. Confermando non verrà duplicato nulla.
              {preview.duplicateOf.matchId && (
                <>
                  {" "}
                  <Link href={`/admin/partite/${preview.duplicateOf.matchId}`} className="underline">
                    Apri la partita
                  </Link>
                </>
              )}
            </Notice>
          )}

          <section className="card space-y-2 p-4">
            <h2 className="display text-xl font-bold italic">3. Anteprima</h2>
            <p className="text-sm">
              <strong>{preview.report.own.rawName}</strong> {preview.report.own.score ?? "?"} – {preview.report.opponent.score ?? "?"}{" "}
              <strong>{preview.report.opponent.rawName}</strong> · {preview.report.date ?? "data non letta"}
            </p>
            <p className="text-xs text-muted">
              Formato: {preview.report.formatVariant} · parser {preview.report.parser} v{preview.report.parserVersion} · statistiche:{" "}
              {preview.report.availableStats.join(", ")}
              {preview.report.periods.length > 0 && ` · parziali: ${preview.report.periods.map((p) => `${p.own}-${p.opponent}`).join(", ")}`}
            </p>
            {preview.issues.length > 0 && (
              <ul className="space-y-1 text-sm">
                {preview.issues.map((i, k) => (
                  <li key={k} className={i.level === "error" ? "text-loss" : i.level === "warning" ? "text-warning" : "text-muted"}>
                    {i.level === "error" ? "✖" : i.level === "warning" ? "⚠" : "ℹ"} {i.message}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card space-y-3 p-4">
            <h2 className="display text-xl font-bold italic">4. Partita</h2>
            <select value={matchId} onChange={(e) => setMatchId(e.target.value)} className={inputCls}>
              <option value="">— scegli la partita —</option>
              {preview.candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.sameDate ? "★ " : ""}
                  {c.label}
                  {c.hasStats ? " · ha già statistiche" : ""}
                </option>
              ))}
              <option value="new">+ Crea una nuova partita</option>
            </select>
            {matchId === "new" && (
              <div className="grid gap-3 sm:grid-cols-4">
                <select value={newMatch.competitionId} onChange={(e) => setNewMatch({ ...newMatch, competitionId: e.target.value })} className={inputCls}>
                  <option value="">Competizione</option>
                  {competitions
                    .filter((c) => c.season_id === preview.seasonId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <select value={newMatch.opponentId} onChange={(e) => setNewMatch({ ...newMatch, opponentId: e.target.value })} className={inputCls}>
                  <option value="">Avversario (nome ufficiale)</option>
                  {teams
                    .filter((t) => !t.is_own_team)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
                <select value={newMatch.ownIsHome ? "home" : "away"} onChange={(e) => setNewMatch({ ...newMatch, ownIsHome: e.target.value === "home" })} className={inputCls}>
                  <option value="home">Sgreeners in casa</option>
                  <option value="away">Sgreeners in trasferta</option>
                </select>
                <input type="date" value={newMatch.date} onChange={(e) => setNewMatch({ ...newMatch, date: e.target.value })} className={inputCls} />
              </div>
            )}
            {selected?.hasStats && (
              <label className="flex items-center gap-2 text-sm text-warning">
                <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
                La partita ha già statistiche: sovrascrivile con questo file
              </label>
            )}
          </section>

          <section className="card space-y-3 p-4">
            <h2 className="display text-xl font-bold italic">5. Giocatori</h2>
            <p className="text-xs text-muted">
              I nomi riconosciuti dagli alias sono già associati. Per i nomi nuovi scegli il giocatore (verrà salvato come alias) oppure
              crea esplicitamente un nuovo giocatore.
            </p>
            <div className="-mx-4 overflow-x-auto sm:mx-0">
              <table className="stat-table">
                <thead>
                  <tr>
                    <th>Nel file</th>
                    <th>PTS</th>
                    <th>Stato</th>
                    <th style={{ textAlign: "left" }}>Giocatore</th>
                    <th style={{ textAlign: "left" }}>Alias</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.report.players.map((p, i) => {
                    const m = preview.mappings[i];
                    const r = rows[i];
                    if (!r) return null;
                    return (
                      <tr key={i}>
                        <td className="font-semibold">{p.rawLabel}</td>
                        <td>{p.stats.points ?? "–"}</td>
                        <td>
                          {p.participation === "absent" ? (
                            <Badge>assente</Badge>
                          ) : p.participation === "dnp" ? (
                            <Badge>0 min</Badge>
                          ) : (
                            <span className="text-xs text-muted">{formatMadeAttempted(p.stats.fgm, p.stats.fga)}</span>
                          )}{" "}
                          {m.status !== "matched" && <Badge tone={m.status === "ambiguous" ? "warning" : "loss"}>{m.status === "ambiguous" ? "ambiguo" : "nuovo"}</Badge>}
                        </td>
                        <td style={{ textAlign: "left" }} className="min-w-[14rem]">
                          {r.mode === "existing" ? (
                            <select
                              value={r.playerId ?? ""}
                              onChange={(e) =>
                                e.target.value === "__new"
                                  ? updateRow(i, { mode: "new", playerId: null, newPlayer: { firstName: "", lastName: "" } })
                                  : updateRow(i, { playerId: e.target.value || null })
                              }
                              className={inputCls}
                            >
                              <option value="">{p.participation === "absent" ? "— (assente, facoltativo) —" : "— scegli —"}</option>
                              {players.map((pl) => (
                                <option key={pl.id} value={pl.id}>
                                  {m.candidates.includes(pl.id) ? "★ " : ""}
                                  {pl.name}
                                </option>
                              ))}
                              <option value="__new">+ Nuovo giocatore…</option>
                            </select>
                          ) : (
                            <div className="flex gap-1">
                              <input placeholder="Nome" value={r.newPlayer?.firstName ?? ""} onChange={(e) => updateRow(i, { newPlayer: { firstName: e.target.value, lastName: r.newPlayer?.lastName ?? "" } })} className={inputCls} />
                              <input placeholder="Cognome" value={r.newPlayer?.lastName ?? ""} onChange={(e) => updateRow(i, { newPlayer: { firstName: r.newPlayer?.firstName ?? "", lastName: e.target.value } })} className={inputCls} />
                              <button type="button" onClick={() => updateRow(i, { mode: "existing", newPlayer: null })} className="px-2 text-muted" aria-label="Annulla">
                                ✕
                              </button>
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: "left" }}>
                          <select value={r.saveAlias} onChange={(e) => updateRow(i, { saveAlias: e.target.value as RowChoice["saveAlias"] })} className={inputCls}>
                            <option value="none">non salvare</option>
                            <option value="always">salva “{p.name}”</option>
                            <option value="season">salva solo per questa stagione</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onConfirm}
              disabled={pending || unresolved > 0 || !matchId || (selected?.hasStats === true && !overwrite)}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-ink disabled:opacity-40"
            >
              {pending ? "Importazione…" : "6. Conferma importazione"}
            </button>
            {unresolved > 0 && <span className="text-sm text-warning">{unresolved} giocatori da associare</span>}
          </div>
        </div>
      )}
    </div>
  );
}
