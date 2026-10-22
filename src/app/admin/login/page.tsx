import { ActionForm } from "@/components/admin/form";
import { Field, Input } from "@/components/admin/fields";
import { signIn } from "@/lib/admin/actions";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="display mb-1 text-3xl">Accesso admin</h1>
      <p className="mb-6 text-sm text-muted">Area riservata alla gestione dei dati dei Bolo Sgreeners.</p>
      <div className="card p-5">
        <ActionForm action={signIn} submitLabel="Entra">
          <Field label="Email">
            <Input name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="Password">
            <Input name="password" type="password" autoComplete="current-password" required />
          </Field>
        </ActionForm>
      </div>
    </div>
  );
}
