import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center">
      <p className="display text-7xl font-extrabold italic text-primary">404</p>
      <h1 className="display text-2xl font-bold italic">Pagina non trovata</h1>
      <p className="text-muted">La stagione, la partita o il giocatore che cerchi non esiste (o non è ancora stato inserito).</p>
      <Link href="/" className="mt-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-ink">
        Torna alla home
      </Link>
    </main>
  );
}
