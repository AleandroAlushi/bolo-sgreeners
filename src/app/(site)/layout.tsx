import Link from "next/link";
import { Suspense } from "react";
import { BottomNav, BottomNavView, TopNavLinks, TopNavLinksView } from "@/components/navigation";
import { getFeaturedSeason } from "@/lib/data/seasons";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const { featured } = await getFeaturedSeason();
  const seasonSlug = featured?.slug ?? null;
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" className="group flex items-center gap-2.5" aria-label="Bolo Sgreeners — home">
            <span className="neon-line h-7 w-1.5 -skew-x-12 rounded-sm" aria-hidden />
            <span className="display text-xl font-extrabold italic leading-none tracking-wide">
              Bolo <span className="text-primary">Sgreeners</span>
            </span>
          </Link>
          <Suspense fallback={<TopNavLinksView seasonSlug={seasonSlug} pathname="" />}>
            <TopNavLinks seasonSlug={seasonSlug} />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 md:pb-16">{children}</main>
      <footer className="hidden border-t border-border py-6 text-center text-xs text-muted md:block">
        Bolo Sgreeners · basket CSI Bologna · dati da box score, Excel storici e Livescore CSI
      </footer>
      <Suspense fallback={<BottomNavView seasonSlug={seasonSlug} pathname="" />}>
        <BottomNav seasonSlug={seasonSlug} />
      </Suspense>
    </>
  );
}
