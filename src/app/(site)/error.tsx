"use client";

import { EmptyState } from "@/components/ui";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EmptyState title="Qualcosa è andato storto">
      <p>{error.name === "DataError" ? error.message : "Impossibile caricare i dati in questo momento."}</p>
      {/* dettaglio tecnico in piccolo: con uno screenshot si capisce subito cosa si è rotto */}
      {error.name !== "DataError" && (error.digest || error.message) && (
        <p className="mt-2 break-all font-mono text-[0.65rem] text-muted/70">{error.digest ? `Codice ${error.digest}` : error.message.slice(0, 200)}</p>
      )}
      <button onClick={reset} className="mt-3 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-ink">
        Riprova
      </button>
    </EmptyState>
  );
}
