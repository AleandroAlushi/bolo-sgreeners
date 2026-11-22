/** Casella della ricerca rapida dell'admin: un semplice form GET verso /admin/cerca. */
export function AdminSearch({ id, defaultValue = "", autoFocus = false, className }: { id: string; defaultValue?: string; autoFocus?: boolean; className?: string }) {
  return (
    <form action="/admin/cerca" role="search" className={className}>
      <label htmlFor={id} className="sr-only">
        Cerca giocatori, staff, squadre e partite
      </label>
      <input
        id={id}
        name="q"
        type="search"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        placeholder="Cerca giocatore, squadra…"
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted focus:border-primary/60 focus:outline-none"
      />
    </form>
  );
}
