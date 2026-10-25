import { getAdmin } from "@/lib/admin/auth";
import { SectionTitle } from "./ui";

export interface GraphicLink {
  href: string;
  label: string;
  file: string;
}

/**
 * Pulsanti di download delle grafiche di una partita: li vede solo l'admin (per i visitatori non
 * rende nulla, e le route /grafiche rifiutano chi non è admin). Va usato dentro <Suspense>.
 */
export async function AdminGraphicsLinks({ links, date }: { links: GraphicLink[]; date: string | null }) {
  if (!(await getAdmin())) return null;
  return (
    <section>
      <SectionTitle eyebrow="Solo admin · pronte per Instagram e WhatsApp">Grafiche</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {links.flatMap((g) =>
          (["post", "storia"] as const).map((f) => (
            <a
              key={`${g.href}-${f}`}
              href={`${g.href}?formato=${f}`}
              download={`sgreeners-${g.file}-${date ?? "partita"}-${f}.png`}
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-primary/60 hover:text-primary"
            >
              {g.label} · {f}
            </a>
          )),
        )}
        <a href="/admin/grafiche" className="rounded-full px-4 py-2 text-sm font-semibold text-muted hover:text-primary">
          Altre opzioni (foto, titolo) →
        </a>
      </div>
    </section>
  );
}
