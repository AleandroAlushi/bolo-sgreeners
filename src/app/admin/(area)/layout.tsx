import { Suspense, type ReactNode } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminSearch } from "@/components/admin/admin-search";
import { LoadingBlock } from "@/components/loading";
import { signOut } from "@/lib/admin/actions";
import { requireStaff } from "@/lib/admin/auth";

function Account({ email, role, className }: { email: string | undefined; role: string; className?: string }) {
  return (
    <div className={className}>
      <p className="truncate">
        {email} {role === "stats" && <span className="text-loss">· Statistiche</span>}
      </p>
      <form action={signOut}>
        <button className="mt-1 text-loss hover:underline">Esci</button>
      </form>
    </div>
  );
}

async function Guard({ children }: { children: ReactNode }) {
  // admin e "Statistiche"; le pagine riservate all'admin controllano di nuovo con requireAdmin
  const { user, role, isAdmin } = await requireStaff();
  return (
    <div className="grid grid-cols-1 gap-6 pb-24 md:grid-cols-[14rem_1fr] md:pb-0">
      <aside className="space-y-4">
        {isAdmin && <AdminSearch id="cerca-menu" className="hidden md:block" />}
        <AdminNav isAdmin={isAdmin} />
        <Account email={user.email} role={role} className="hidden text-xs text-muted md:block" />
      </aside>
      <div className="min-w-0 space-y-6">
        {/* sito di prova di una PR (Vercel "preview"): stessi dati del sito vero */}
        {process.env.VERCEL_ENV === "preview" && (
          <p className="rounded-xl border border-warning/40 bg-warning/10 px-3.5 py-2.5 text-sm text-warning">
            <strong>Anteprima delle modifiche.</strong> I dati sono quelli veri: guarda pure tutto, ma quello che salvi qui finisce sul sito.
          </p>
        )}
        {children}
        {/* sul telefono il menu è la barra in basso: l'uscita sta in fondo alla pagina */}
        <Account email={user.email} role={role} className="border-t border-border pt-4 text-xs text-muted md:hidden" />
      </div>
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
