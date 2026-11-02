import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { IconLock } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { BottomNav, BottomNavView, FeedbackLink, FeedbackLinkView, TopNavLinks, TopNavLinksView } from "@/components/navigation";
import { getFeaturedSeason } from "@/lib/data/seasons";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const { featured } = await getFeaturedSeason();
  const seasonSlug = featured?.slug ?? null;
  return (
    <>
      {/* barra piena, senza sfocatura: su alcuni telefoni il blur sotto la barra di stato sfocava la parte alta */}
      <header className="pt-safe sticky top-0 z-30 border-b border-border bg-bg">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" className="group flex items-center gap-2.5" aria-label="Bolo Sgreeners — home">
            <Image src="/brand/logo-160.png" alt="" width={160} height={118} priority className="logo-chip h-9 w-auto" />
            <span className="display pt-0.5 text-2xl leading-none tracking-wide">
              Bolo <span className="text-gradient">Sgreeners</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <Suspense fallback={<TopNavLinksView seasonSlug={seasonSlug} pathname="" />}>
              <TopNavLinks seasonSlug={seasonSlug} />
            </Suspense>
            <ThemeToggle />
            <Suspense fallback={<FeedbackLinkView pathname="" />}>
              <FeedbackLink />
            </Suspense>
            <Link
              href="/area-squadra"
              title="Area squadra (riservata)"
              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-text"
            >
              <IconLock size={16} />
              <span className="hidden lg:inline">Area squadra</span>
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 md:pb-16">{children}</main>
      <footer className="hidden border-t border-border py-8 md:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 text-sm text-muted">
          <span className="flex items-center gap-2.5">
            <Image src="/brand/logo-160.png" alt="" width={160} height={118} className="logo-chip h-7 w-auto" />
            <span>
              <span className="display text-lg leading-none text-text">Bolo Sgreeners</span>
              <span className="block text-xs">basket CSI · Bologna</span>
            </span>
          </span>
          <nav aria-label="Link utili" className="flex flex-wrap gap-x-5 gap-y-1">
            {[
              { href: "/stagioni", label: "Archivio stagioni" },
              { href: "/giocatori", label: "Giocatori" },
              { href: "/statistiche", label: "Statistiche all time" },
              { href: "/feedback", label: "Idee e segnalazioni" },
            ].map((l) => (
              <Link key={l.href} href={l.href} className="transition-colors hover:text-text">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="mx-auto mt-4 max-w-6xl px-4 text-xs text-muted/70">Dati da box score, Excel storici e Livescore CSI Bologna.</p>
      </footer>
      <Suspense fallback={<BottomNavView seasonSlug={seasonSlug} pathname="" />}>
        <BottomNav seasonSlug={seasonSlug} />
      </Suspense>
    </>
  );
}
