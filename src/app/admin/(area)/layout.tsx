import { Suspense, type ReactNode } from "react";
import { LoadingBlock } from "@/components/loading";
import { requireAdmin } from "@/lib/admin/auth";
import { signOut } from "@/lib/admin/actions";
import { AdminNav } from "@/components/admin/admin-nav";

async function Guard({ children }: { children: ReactNode }) {
  const { user } = await requireAdmin();
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[14rem_1fr]">
      <aside className="space-y-4">
        <AdminNav />
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
