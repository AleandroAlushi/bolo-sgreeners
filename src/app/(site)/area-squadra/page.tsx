import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { IconCake, IconLock } from "@/components/icons";
import { LoadingBlock } from "@/components/loading";
import { Notice, SectionTitle, cx } from "@/components/ui";
import { signOutTeam } from "@/lib/admin/actions";
import { formatBirthday, formatDate, formatMonthYear } from "@/lib/domain/format";
import { planPaste, type PasteAssignment, type PasteWeek } from "@/lib/domain/paste";
import { requireTeamSession } from "@/lib/team/auth";
import { getTeamArea } from "@/lib/team/data";

export const metadata: Metadata = { title: "Area squadra", robots: { index: false } };

const REASON: Record<PasteAssignment["reason"], { label: string; className: string }> = {
  birthday: { label: "Compleanno", className: "bg-primary text-primary-ink" },
  recovered: { label: "Compleanno recuperato", className: "bg-accent text-black" },
  turn: { label: "Turno", className: "bg-surface-3 text-text" },
};

function WeekRow({ week, highlight }: { week: PasteWeek; highlight?: boolean }) {
  return (
    <li className={cx("flex flex-wrap items-start gap-x-4 gap-y-1 rounded-xl border px-3 py-2.5", highlight ? "border-primary/50 bg-primary/[0.06]" : "border-border")}>
      <span className="w-28 shrink-0 text-sm">
        <span className="display block text-lg leading-none">{formatDate(week.assignments[0]?.day ?? week.trainingDays[0], "day-month")}</span>
        <span className="text-xs text-muted">allenamenti: {week.trainingDays.map((d) => formatDate(d, "day-month")).join(", ")}</span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        {week.assignments.map((a) => (
          <span key={a.personId + a.day} className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{a.name}</span>
            <span className={cx("rounded-full px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider", REASON[a.reason].className)}>{REASON[a.reason].label}</span>
            {a.birthday && <span className="text-xs text-muted">compie gli anni il {formatBirthday(a.birthday)}</span>}
            {a.day !== week.trainingDays[0] && <span className="text-xs text-muted">· porta le paste {formatDate(a.day, "short")}</span>}
          </span>
        ))}
      </span>
    </li>
  );
}

async function TeamArea() {
  const session = await requireTeamSession();
  const signOut = (
    <form action={signOutTeam}>
      <button className="text-sm text-muted hover:text-text">Esci</button>
    </form>
  );
  if (!session.isMember) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-8">
        <h1 className="display text-4xl">Area squadra</h1>
        <Notice tone="warning">
          L&apos;account <strong>{session.user.email}</strong> non è abilitato all&apos;area squadra. Chiedi all&apos;admin di attivarlo.
        </Notice>
        {signOut}
      </div>
    );
  }
  const area = await getTeamArea(session.supabase);
  if (!area) return <Notice>Nessuna stagione in archivio.</Notice>;
  const today = new Date().toISOString().slice(0, 10);
  const weeks = planPaste(area.people, area.setup);
  const upcoming = weeks.filter((w) => w.trainingDays.at(-1)! >= today);
  const thisWeek = upcoming[0];
  const byMonth = new Map<string, PasteWeek[]>();
  for (const w of weeks) {
    const k = w.trainingDays[0].slice(0, 7);
    byMonth.set(k, [...(byMonth.get(k) ?? []), w]);
  }
  const withBirthday = area.people.filter((p) => p.birthDate);
  const missing = area.people.filter((p) => !p.birthDate);
  const nextBirthday = (iso: string) => {
    const md = iso.slice(5);
    const y = Number(today.slice(0, 4));
    return `${today.slice(5) <= md ? y : y + 1}-${md}`;
  };
  const birthdays = [...withBirthday].sort((a, b) => nextBirthday(a.birthDate!).localeCompare(nextBirthday(b.birthDate!)));

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow flex items-center gap-1.5 text-secondary">
            <IconLock size={14} /> Area squadra · {area.season.slug}
          </p>
          <h1 className="display mt-1 text-6xl leading-none">Paste</h1>
          <p className="accent-serif mt-1 text-xl text-text/85">almeno una a settimana, nessun compleanno dimenticato</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {session.isAdmin && (
            <Link href="/admin/area-squadra" className="font-semibold text-primary hover:underline">
              Impostazioni
            </Link>
          )}
          {signOut}
        </div>
      </header>

      {(area.defaultSchedule || missing.length > 0 || area.rosterFrom) && (
        <div className="space-y-2">
          {area.rosterFrom && (
            <Notice>
              Il roster {area.season.slug} si riempie con i box score delle partite: per ora le paste usano i giocatori del {area.rosterFrom}
              {session.isAdmin ? " (puoi aggiungere i nuovi da Admin → Giocatori e roster)." : "."}
            </Notice>
          )}
          {area.defaultSchedule && (
            <Notice>
              Allenamenti di default: lunedì e giovedì, dal {formatDate(area.setup.start, "day-month")} al {formatDate(area.setup.end, "day-month")}, senza pause.
              {session.isAdmin ? " Impostali in Impostazioni." : " L'admin può impostare le date vere e le pause."}
            </Notice>
          )}
          {missing.length > 0 && (
            <Notice tone="warning">
              Manca la data di nascita di {missing.length} {missing.length === 1 ? "persona" : "persone"}: {missing.map((p) => p.name).join(", ")}. Per ora fanno solo i turni.
            </Notice>
          )}
        </div>
      )}

      {thisWeek && (
        <section className="glow-panel rounded-3xl border border-border p-5 sm:p-7">
          <p className="eyebrow text-text/80">Questa settimana</p>
          <div className="mt-2 space-y-2">
            {thisWeek.assignments.map((a) => (
              <div key={a.personId} className="flex flex-wrap items-baseline gap-x-3">
                <span className="display text-5xl leading-none sm:text-6xl">{a.name}</span>
                <span className="accent-serif text-xl text-text/90">
                  {a.reason === "turn" ? "porta le paste" : "festeggia con le paste"} · {formatDate(a.day, "long")}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {upcoming.length > 1 && (
        <section>
          <SectionTitle eyebrow="Prossime settimane">In arrivo</SectionTitle>
          <ul className="space-y-2">
            {upcoming.slice(1, 7).map((w) => (
              <WeekRow key={w.weekStart} week={w} />
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionTitle eyebrow={`${weeks.length} settimane di allenamento`}>Calendario completo</SectionTitle>
        <div className="space-y-6">
          {[...byMonth.entries()].map(([month, list]) => (
            <div key={month}>
              <p className="eyebrow mb-2 text-muted">{formatMonthYear(`${month}-01`)}</p>
              <ul className="space-y-2">
                {list.map((w) => (
                  <WeekRow key={w.weekStart} week={w} highlight={w === thisWeek} />
                ))}
              </ul>
            </div>
          ))}
        </div>
        {area.breaks.length > 0 && (
          <p className="mt-3 text-sm text-muted">Pause: {area.breaks.map((b) => `${b.label} (${formatDate(b.start_date, "day-month")} – ${formatDate(b.end_date, "day-month")})`).join(" · ")}</p>
        )}
      </section>

      <section>
        <SectionTitle eyebrow="In ordine di arrivo">Compleanni</SectionTitle>
        {birthdays.length === 0 ? (
          <p className="text-sm text-muted">Nessuna data di nascita inserita.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {birthdays.map((p) => (
              <li key={p.id} className="card flex items-center gap-3 px-4 py-3">
                <IconCake size={20} className="text-secondary" />
                <span className="min-w-0 flex-1">
                  {p.playerSlug ? (
                    <Link href={`/giocatori/${p.playerSlug}`} className="font-semibold hover:text-primary">
                      {p.name}
                    </Link>
                  ) : (
                    <span className="font-semibold">{p.name}</span>
                  )}
                  {p.role && <span className="block text-xs text-muted">{p.role}</span>}
                </span>
                <span className="display text-xl">{formatBirthday(p.birthDate!)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function TeamAreaPage() {
  return (
    <Suspense fallback={<LoadingBlock rows={6} />}>
      <TeamArea />
    </Suspense>
  );
}
