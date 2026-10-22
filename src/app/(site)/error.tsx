"use client";

import { EmptyState } from "@/components/ui";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EmptyState title="Qualcosa è andato storto">
      <p>{error.name === "DataError" ? error.message : "Impossibile caricare i dati in questo momento."}</p>
      <button onClick={reset} className="mt-3 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-ink">
        Riprova
      </button>
    </EmptyState>
  );
}
