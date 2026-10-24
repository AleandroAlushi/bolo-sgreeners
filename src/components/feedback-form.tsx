"use client";

import { useSearchParams } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { sendFeedback } from "@/lib/feedback/actions";
import { cx } from "./ui";

const KINDS = [
  { value: "idea", label: "Idea", hint: "Una cosa da aggiungere o migliorare" },
  { value: "problema", label: "Problema", hint: "Qualcosa non funziona o è sbagliato" },
  { value: "altro", label: "Altro", hint: "Tutto il resto" },
] as const;

const field =
  "w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-base text-text placeholder:text-muted/60 focus:border-primary focus:outline-none";

/** Form dei feedback: il messaggio arriva solo agli admin. */
export function FeedbackForm() {
  const from = useSearchParams().get("da");
  const [kind, setKind] = useState<(typeof KINDS)[number]["value"]>("idea");
  const [state, action, pending] = useActionState(sendFeedback, null);
  const formRef = useRef<HTMLFormElement>(null);
  // dopo l'invio riuscito il form si svuota (dopo un errore no: si ritrova il testo scritto)
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="page" value={from ?? ""} />
      <div className="hidden" aria-hidden>
        <label>
          Sito web <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <fieldset disabled={pending} className="space-y-5">
        <div role="radiogroup" aria-label="Tipo di messaggio" className="grid grid-cols-3 gap-2">
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              role="radio"
              aria-checked={kind === k.value}
              onClick={() => setKind(k.value)}
              className={cx(
                "rounded-xl border px-3 py-2.5 text-left transition-colors",
                kind === k.value ? "border-primary bg-primary/10" : "border-border bg-surface hover:border-muted",
              )}
            >
              <span className="block text-sm font-semibold">{k.label}</span>
              <span className="hidden text-xs text-muted sm:block">{k.hint}</span>
            </button>
          ))}
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Messaggio</span>
          <textarea
            name="message"
            required
            minLength={3}
            maxLength={2000}
            rows={6}
            className={field}
            placeholder={kind === "problema" ? "Cosa hai visto e in quale pagina?" : "Scrivi pure: ogni idea è benvenuta."}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Nome o contatto (facoltativo)</span>
          <input name="contact" maxLength={200} className={field} placeholder="Se vuoi una risposta" autoComplete="name" />
        </label>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-full bg-primary px-5 py-2 font-semibold text-primary-ink disabled:opacity-50">
          {pending ? "Invio…" : "Invia"}
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
