import type { Metadata } from "next";
import { Field, Input } from "@/components/admin/fields";
import { ActionForm } from "@/components/admin/form";
import { IconLock } from "@/components/icons";
import { signIn } from "@/lib/admin/actions";

export const metadata: Metadata = { title: "Area squadra", robots: { index: false } };

export default function TeamLoginPage() {
  return (
    <div className="mx-auto max-w-sm py-8">
      <p className="eyebrow flex items-center gap-1.5 text-secondary">
        <IconLock size={14} /> Riservato a giocatori e staff
      </p>
      <h1 className="display mb-1 mt-1 text-5xl">Area squadra</h1>
      <p className="mb-6 text-sm text-muted">Compleanni, paste e allenamenti: le cose di squadra che non sono pubbliche.</p>
      <div className="card p-5">
        <ActionForm action={signIn} submitLabel="Entra">
          <input type="hidden" name="next" value="/area-squadra" />
          <Field label="Email">
            <Input name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="Password">
            <Input name="password" type="password" autoComplete="current-password" required />
          </Field>
        </ActionForm>
      </div>
      <p className="mt-4 text-xs text-muted">Le credenziali le dà l&apos;admin della squadra.</p>
    </div>
  );
}
