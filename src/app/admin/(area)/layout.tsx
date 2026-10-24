import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { LoadingBlock } from "@/components/loading";
import { requireAdmin } from "@/lib/admin/auth";
import { signOut } from "@/lib/admin/actions";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/import", label: "Importa partita" },
  { href: "/admin/partite", label: "Partite" },
  { href: "/admin/grafiche", label: "Grafiche" },
  { href: "/admin/giocatori", label: "Giocatori e roster" },
  { href: "/admin/staff", label: "Staff" },
  { href: "/admin/area-squadra", label: "Area squadra" },
  { href: "/admin/alias", label: "Alias" },
  { href: "/admin/stagioni", label: "Stagioni e classifiche" },
  { href: "/admin/squadre", label: "Squadre" },
  { href: "/admin/discrepanze", label: "Discrepanze" },
  { href: "/admin/feedback", label: "Feedback" },
];

async function Guard({ children }: { children: ReactNode }) {
  const { user } = await requireAdmin();
  return (
    <div className="grid gap-6 md:grid-cols-[13rem_1fr]">
      <aside className="space-y-4">
        <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-col md:px-0">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-text">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden text-xs text-muted md:block">
          <p className="truncate">{user.email}</p>
          <form action={signOut}>
            <button className="mt-1 text-loss hover:underline">Esci</button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 space-y-6">{children}</div>
    </div>
  );
}

export default function AdminAreaLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<LoadingBlock rows={5} />}>
      <Guard>{children}</Guard>
    </Suspense>
  );
}
