"use client";

import { startTransition, useActionState, type ReactNode } from "react";
import type { ActionState } from "@/lib/admin/forms";
import { cx } from "../ui";

type Action = (prev: ActionState | null, fd: FormData) => Promise<ActionState>;

/**
 * Form collegato a una server action: mostra esito e disabilita i campi durante l'invio.
 * L'azione viene invocata da onSubmit (non da `action`) così React non svuota i campi:
 * dopo un errore l'utente ritrova quello che aveva scritto.
 */
export function ActionForm({ action, children, className, submitLabel = "Salva", encType }: { action: Action; children: ReactNode; className?: string; submitLabel?: string; encType?: "multipart/form-data" }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      className={cx("space-y-3", className)}
      encType={encType}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      <fieldset disabled={pending} className="space-y-3">
        {children}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-ink disabled:opacity-50">
          {pending ? "Salvataggio…" : submitLabel}
        </button>
        {state && (
          <p role="status" className={cx("text-sm", state.ok ? "text-win" : "text-loss")}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

export function ConfirmButton({ children, message, className }: { children: ReactNode; message: string; className?: string }) {
  return (
    <button
      type="submit"
      className={cx("rounded-full border border-loss/40 px-3 py-1 text-xs font-semibold text-loss hover:bg-loss/10", className)}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
