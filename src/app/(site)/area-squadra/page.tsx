import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { IconCake, IconLock } from "@/components/icons";
import { LoadingBlock } from "@/components/loading";
import { Notice, SectionTitle, cx } from "@/components/ui";
import { signOutTeam } from "@/lib/admin/actions";
import { formatBirthday, formatDate, formatMonthYear } from "@/lib/domain/format";
import { planPaste, type PasteSlot } from "@/lib/domain/paste";
import { requireTeamSession } from "@/lib/team/auth";
import { getTeamArea } from "@/lib/team/data";

export const metadata: Metadata = { title: "Area squadra", robots: { index: false } };

const fmtWeekday = new Intl.DateTimeFormat("it-IT", { weekday: "short", timeZone: "UTC" });
const weekday = (iso: string) => fmtWeekday.format(new Date(`${iso}T12:00:00Z`)).replace(".", "");

function SlotRow({ slot, highlight, past }: { slot: PasteSlot; highlight?: boolean; past?: boolean }) {
  return (
    <li
      className={cx(
        "flex items-center gap-4 rounded-xl border px-3 py-2.5",
        highlight ? "border-primary/50 bg-primary/[0.06]" : "border-border",
        past && "opacity-55",
      )}
    >
      <span className="w-20 shrink-0">
        <span className="display block text-xl leading-none">{formatDate(slot.day, "day-month")}</span>
        <span className="text-xs capitalize text-muted">{weekday(slot.day)}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{slot.name}</span>
        {slot.day !== slot.target && (
          <span className="text-xs text-muted">suo giorno: {formatDate(slot.target, "day-month")} · primo allenamento utile</span>
        )}
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
  const plan = planPaste(area.people, area.setup);
  const upcoming = plan.slots.filter((x) => x.day >= today);
  const next = upcoming[0];
  const byMonth = new Map<string, PasteSlot[]>();
  for (const x of plan.slots) byMonth.set(x.day.slice(0, 7), [...(byMonth.get(x.day.slice(0, 7)) ?? []), x]);
  const excludedMatchDays = (area.setup.matchDays ?? []).filter((d) => area.setup.weekdays.includes(((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7) + 1)).length;
  const freeUpcoming = plan.freeDays.filter((d) => d >= today);
  const withBirthday = area.people.filter((p) => p.birthDate);
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
          <p className="accent-serif mt-1 text-xl text-text/85">una volta l&apos;anno a testa, ognuno nel suo giorno</p>
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

      {(area.defaultSchedule || area.rosterFrom) && (
        <div className="space-y-2">
          {area.rosterFrom && (
            <Notice>
              Il roster {area.season.slug} si riempie con i box score delle partite: per ora le paste usano i giocatori del {area.rosterFrom}
              {session.isAdmin ? " (puoi aggiungere i nuovi da Admin → Giocatori e roster)." : "."}
            </Notice>
          )}
          {area.defaultSchedule && (
            <Notice>
              Allenamenti di default: lunedì e giovedì, dal {formatDate(area.setup.start, "day-month")} al {formatDate(area.setup.end, "day-month")}.
              {session.isAdmin ? " Impostali in Impostazioni." : " L'admin può impostare le date vere e le pause."}
            </Notice>
          )}
        </div>
      )}

      {next && (
        <section className="glow-panel rounded-3xl border border-border p-5 sm:p-7">
          <p className="eyebrow text-text/80">Prossime paste</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
            <span className="display text-5xl leading-none sm:text-6xl">{next.name}</span>
            <span className="accent-serif text-xl text-text/90">porta le paste · {formatDate(next.day, "long")}</span>
          </div>
        </section>
      )}

      {upcoming.length > 1 && (
        <section>
          <SectionTitle eyebrow="Prossimi turni">In arrivo</SectionTitle>
          <ul className="space-y-2">
            {upcoming.slice(1, 6).map((x) => (
              <SlotRow key={x.personId} slot={x} />
            ))}
          </ul>
        </section>
      )}

      {(plan.unassigned.length > 0 || plan.unplaced.length > 0) && (
        <section>
          <SectionTitle eyebrow={`${freeUpcoming.length} allenamenti ancora liberi`}>Da impostare</SectionTitle>
          <p className="mb-3 text-sm text-muted">
            Devono ancora scegliere il loro giorno per le paste: chi è nato d&apos;estate, quando non ci si allena, e chi non aveva
            ancora una data.{" "}
            {session.isAdmin ? "Si imposta nella scheda del giocatore o dello staff (Admin → giorno delle paste)." : "Scrivetelo all'admin."}
          </p>
          <ul className="flex flex-wrap gap-2">
            {[...plan.unassigned, ...plan.unplaced].map((p) => {
              const month = p.birthDate ? Number(p.birthDate.slice(5, 7)) : null;
              const summer = month !== null && month >= 6 && month <= 8;
              return (
                <li key={p.id} className="flex items-center gap-2 rounded-full border border-dashed border-border px-3 py-1.5 text-sm">
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-xs text-muted">{summer ? "nato d'estate" : "ancora senza data"}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <SectionTitle eyebrow={`${plan.slots.length} paste in ${plan.trainingDays.length} allenamenti`}>Calendario completo</SectionTitle>
        {plan.slots.length === 0 ? (
          <p className="text-sm text-muted">Nessun giorno delle paste impostato.</p>
        ) : (
          <div className="space-y-6">
            {[...byMonth.entries()].map(([month, list]) => (
              <div key={month}>
                <p className="eyebrow mb-2 text-muted">{formatMonthYear(`${month}-01`)}</p>
                <ul className="space-y-2">
                  {list.map((x) => (
                    <SlotRow key={x.personId} slot={x} highlight={x === next} past={x.day < today} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-sm text-muted">
          Allenamenti {area.setup.weekdays.map((d) => ["lun", "mar", "mer", "gio", "ven", "sab", "dom"][d - 1]).join(" e ")}, dal{" "}
          {formatDate(area.setup.start, "day-month")} al {formatDate(area.setup.end, "day-month")}
          {excludedMatchDays > 0 && ` · esclusi ${excludedMatchDays} giorni di partita`}
          {area.breaks.length > 0 &&
            ` · pause: ${area.breaks.map((b) => `${b.label} (${formatDate(b.start_date, "day-month")} – ${formatDate(b.end_date, "day-month")})`).join(", ")}`}
          .
        </p>
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
