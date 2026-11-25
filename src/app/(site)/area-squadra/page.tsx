import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { IconCake, IconLock } from "@/components/icons";
import { LoadingBlock } from "@/components/loading";
import { PasteShare } from "@/components/paste-share";
import { TeamCalendar } from "@/components/team-calendar";
import { Notice, SectionTitle, cx } from "@/components/ui";
import { signOutTeam } from "@/lib/admin/actions";
import { formatDate, formatMonthYear } from "@/lib/domain/format";
import { planPaste, type PasteSlot } from "@/lib/domain/paste";
import { pasteMessage } from "@/lib/domain/paste-message";
import { buildTeamCalendar } from "@/lib/domain/team-calendar";
import { requireTeamSession } from "@/lib/team/auth";
import { getTeamArea, type TeamPerson } from "@/lib/team/data";

export const metadata: Metadata = { title: "Area squadra", robots: { index: false } };

const fmtWeekday = new Intl.DateTimeFormat("it-IT", { weekday: "short", timeZone: "UTC" });
const weekday = (iso: string) => fmtWeekday.format(new Date(`${iso}T12:00:00Z`)).replace(".", "");
const isoWeekday = (iso: string) => ((new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
const MONTHS = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

function SlotRow({ slot, person, next, today }: { slot: PasteSlot; person?: TeamPerson; next?: boolean; today: string }) {
  const past = slot.day < today;
  return (
    <li
      className={cx(
        "flex items-center gap-3 rounded-xl border px-3 py-2.5",
        next ? "border-accent/60 bg-accent/[0.08]" : "border-border",
        past && !slot.done && "border-loss/40",
        slot.done && "opacity-60",
      )}
    >
      <span className="w-16 shrink-0">
        <span className="display block text-xl leading-none">{formatDate(slot.day, "day-month")}</span>
        <span className="text-xs capitalize text-muted">{weekday(slot.day)}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{person?.short ?? slot.name}</span>
        <span className="block truncate text-xs text-muted">{slot.name}</span>
      </span>
      {slot.done ? (
        <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-bold text-primary">✓ Portate</span>
      ) : next ? (
        <span className="shrink-0 rounded-full bg-accent/20 px-2.5 py-1 text-xs font-bold text-accent">Prossime</span>
      ) : past ? (
        <span className="shrink-0 rounded-full bg-loss/15 px-2.5 py-1 text-xs font-bold text-loss">Da recuperare</span>
      ) : null}
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
  const person = new Map(area.people.map((p) => [p.id, p]));
  const next = plan.slots.find((x) => !x.done && x.day >= today);
  const nextTimes = next ? area.times[String(isoWeekday(next.day))] : undefined;
  const doneCount = plan.slots.filter((x) => x.done).length;
  const byMonth = new Map<string, PasteSlot[]>();
  for (const x of plan.slots) byMonth.set(x.day.slice(0, 7), [...(byMonth.get(x.day.slice(0, 7)) ?? []), x]);

  const message = pasteMessage({
    season: area.season.slug,
    slots: plan.slots,
    short: (id) => person.get(id)?.short ?? "",
    link: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://bolo-sgreeners.vercel.app"}/area-squadra`,
  });

  const events = buildTeamCalendar({
    setup: area.setup,
    times: area.times,
    matches: area.matches,
    people: area.people,
    slots: plan.slots,
  });

  // compleanni da gennaio a dicembre, divisi per mese
  const birthdays = area.people
    .filter((p) => p.birthDate)
    .sort((a, b) => a.birthDate!.slice(5).localeCompare(b.birthDate!.slice(5)) || a.short.localeCompare(b.short));
  const birthdayMonths = new Map<number, TeamPerson[]>();
  for (const p of birthdays) {
    const mo = Number(p.birthDate!.slice(5, 7));
    birthdayMonths.set(mo, [...(birthdayMonths.get(mo) ?? []), p]);
  }
  const nextBirthdayId = [...birthdays].sort((a, b) => {
    const up = (p: TeamPerson) => (p.birthDate!.slice(5) >= today.slice(5) ? "0" : "1") + p.birthDate!.slice(5);
    return up(a).localeCompare(up(b));
  })[0]?.id;

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow flex items-center gap-1.5 text-secondary">
            <IconLock size={14} /> Area squadra · {area.season.slug}
          </p>
          <h1 className="display mt-1 text-6xl leading-none">Squadra</h1>
          <p className="accent-serif mt-1 text-xl text-text/85">allenamenti, partite, paste e compleanni</p>
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

      {area.rosterFrom && (
        <Notice>
          Il roster {area.season.slug} si riempie con i box score delle partite: per ora le paste usano i giocatori del {area.rosterFrom}
          {session.isAdmin ? " (puoi aggiungere i nuovi da Admin → Giocatori e roster)." : "."}
        </Notice>
      )}

      {next && (
        <section className="glow-panel rounded-3xl border border-border p-5 sm:p-7">
          <p className="eyebrow text-text/80">🥐 Prossime paste</p>
          <p className="display mt-2 text-6xl leading-none sm:text-7xl">{person.get(next.personId)?.short ?? next.name}</p>
          <p className="accent-serif mt-2 text-xl text-text/90">
            {formatDate(next.day, "long")}
            {nextTimes && ` · allenamento ${nextTimes[0]}–${nextTimes[1]}`}
          </p>
        </section>
      )}

      <section>
        <SectionTitle eyebrow="Allenamenti, partite, paste e compleanni">Calendario</SectionTitle>
        <TeamCalendar events={events} start={area.setup.start} end={area.setup.end} today={today} />
      </section>

      <section>
        <SectionTitle eyebrow={`${doneCount} portate su ${plan.slots.length}`}>Turni delle paste</SectionTitle>
        <p className="mb-4 text-sm text-muted">
          Una volta l&apos;anno a testa, negli allenamenti senza partita. Se un giorno diventa di partita, il turno slitta al primo
          allenamento libero.
        </p>
        <div className="mb-6">
          <PasteShare message={message} />
        </div>
        {plan.slots.length === 0 ? (
          <p className="text-sm text-muted">Nessun turno impostato.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {[...byMonth.entries()].map(([month, list]) => (
              <div key={month}>
                <p className="eyebrow mb-2 text-muted">{formatMonthYear(`${month}-01`)}</p>
                <ul className="space-y-2">
                  {list.map((x) => (
                    <SlotRow key={x.personId} slot={x} person={person.get(x.personId)} next={x === next} today={today} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle eyebrow="Da gennaio a dicembre">Compleanni</SectionTitle>
        {birthdays.length === 0 ? (
          <p className="text-sm text-muted">Nessuna data di nascita inserita.</p>
        ) : (
          <div className="gap-6 sm:columns-2">
            {[...birthdayMonths.entries()].map(([mo, list]) => (
              <div key={mo} className="mb-5 break-inside-avoid">
                <p className="eyebrow mb-2 text-muted">{MONTHS[mo - 1]}</p>
                <ul className="space-y-2">
                  {list.map((p) => (
                    <li
                      key={p.id}
                      className={cx("card flex items-center gap-3 px-4 py-3", p.id === nextBirthdayId && "border-secondary/60")}
                    >
                      <span className="display w-9 shrink-0 text-center text-3xl leading-none text-secondary">{Number(p.birthDate!.slice(8))}</span>
                      <span className="min-w-0 flex-1">
                        {p.playerSlug ? (
                          <Link href={`/giocatori/${p.playerSlug}`} className="font-semibold hover:text-primary">
                            {p.short}
                          </Link>
                        ) : (
                          <span className="font-semibold">{p.short}</span>
                        )}
                        <span className="block truncate text-xs text-muted">
                          {p.name}
                          {p.role && ` · ${p.role}`}
                        </span>
                      </span>
                      {p.id === nextBirthdayId ? (
                        <span className="shrink-0 rounded-full bg-secondary/15 px-2.5 py-1 text-xs font-bold text-secondary">Prossimo</span>
                      ) : (
                        <IconCake size={18} className="shrink-0 text-secondary/70" />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
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
