import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { IconLock } from "@/components/icons";
import { BottomNav, BottomNavView, FeedbackLink, FeedbackLinkView, TopNavLinks, TopNavLinksView } from "@/components/navigation";
import { getFeaturedSeason } from "@/lib/data/seasons";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const { featured } = await getFeaturedSeason();
  const seasonSlug = featured?.slug ?? null;
  return (
    <>
      <header className="pt-safe sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" className="group flex items-center gap-2.5" aria-label="Bolo Sgreeners — home">
            <Image src="/brand/logo-160.png" alt="" width={160} height={118} priority className="h-9 w-auto" />
            <span className="display pt-0.5 text-2xl leading-none tracking-wide">
              Bolo <span className="text-gradient">Sgreeners</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <Suspense fallback={<TopNavLinksView seasonSlug={seasonSlug} pathname="" />}>
              <TopNavLinks seasonSlug={seasonSlug} />
            </Suspense>
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
      <footer className="hidden border-t border-border py-6 text-center text-xs text-muted md:block">
        Bolo Sgreeners · basket CSI Bologna · dati da box score, Excel storici e Livescore CSI ·{" "}
        <Link href="/feedback" className="underline-offset-2 hover:text-text hover:underline">
          idee e segnalazioni
        </Link>
      </footer>
      <Suspense fallback={<BottomNavView seasonSlug={seasonSlug} pathname="" />}>
        <BottomNav seasonSlug={seasonSlug} />
      </Suspense>
    </>
  );
}
