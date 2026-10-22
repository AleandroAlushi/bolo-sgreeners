import type { Metadata } from "next";
import Link from "next/link";
import type React from "react";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-surface/80">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4">
          <Link href="/admin" className="display text-lg font-extrabold italic">
            Sgreeners <span className="text-primary">Admin</span>
          </Link>
          <Link href="/" className="text-sm text-muted hover:text-text">
            ← Sito pubblico
          </Link>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</div>
    </div>
  );
}
