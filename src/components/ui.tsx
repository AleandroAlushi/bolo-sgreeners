/** Primitive UI condivise: card, badge, titoli, stati vuoti, statistiche. */
import Link from "next/link";
import type { ReactNode } from "react";
import { IconAlert, IconBall, IconChevronRight, IconInfo } from "./icons";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function Card({ children, className, as: Tag = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" }) {
  return <Tag className={cx("card", className)}>{children}</Tag>;
}

export function SectionTitle({ children, action, eyebrow }: { children: ReactNode; action?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="eyebrow text-secondary">{eyebrow}</p>}
        <h2 className="display mt-0.5 text-3xl leading-none sm:text-4xl">{children}</h2>
      </div>
      {action}
    </div>
  );
}

export function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-0.5 text-sm font-semibold text-primary hover:underline">
      {children}
      <IconChevronRight size={16} />
    </Link>
  );
}

type BadgeTone = "neutral" | "primary" | "win" | "loss" | "warning" | "secondary";
const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-3 text-muted",
  primary: "bg-primary/15 text-primary",
  secondary: "bg-secondary/15 text-secondary",
  win: "bg-win/15 text-win",
  loss: "bg-loss/15 text-loss",
  warning: "bg-warning/15 text-warning",
};
export function Badge({ children, tone = "neutral", className, title }: { children: ReactNode; tone?: BadgeTone; className?: string; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide", tones[tone], className)}>
      {children}
    </span>
  );
}

/** Stato vuoto: alto abbastanza da non far saltare la pagina, con eventuali pulsanti. */
export function EmptyState({ title, children, icon, actions }: { title: string; children?: ReactNode; icon?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="card flex min-h-[45vh] flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">{icon ?? <IconBall size={28} />}</div>
      <p className="display text-3xl leading-none">{title}</p>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
      {actions && <div className="mt-2 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}

/** Pulsante-link: pieno (principale) o con il bordo. */
export function ButtonLink({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "outline" }) {
  return (
    <Link
      href={href}
      className={cx(
        "press inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
        variant === "primary" ? "bg-primary text-primary-ink hover:opacity-90" : "border border-border hover:border-primary/60 hover:text-primary",
      )}
    >
      {children}
    </Link>
  );
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" }) {
  return (
    <div
      className={cx(
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm",
        tone === "warning" ? "border-warning/30 bg-warning/5 text-warning" : "border-secondary/25 bg-secondary/5 text-text/90",
      )}
    >
      <span className="mt-0.5 shrink-0">{tone === "warning" ? <IconAlert size={16} /> : <IconInfo size={16} className="text-secondary" />}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function StatCard({ label, value, hint, accent, className }: { label: string; value: ReactNode; hint?: ReactNode; accent?: "primary" | "secondary" | "accent"; className?: string }) {
  const color = accent === "secondary" ? "text-secondary" : accent === "accent" ? "text-accent" : accent === "primary" ? "text-primary" : "text-text";
  return (
    <div className={cx("card px-4 py-3", className)}>
      <p className="eyebrow text-[0.62rem] text-muted">{label}</p>
      <p className={cx("display mt-1 text-[2.6rem] leading-none tabular-nums", color)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-6">
      {eyebrow && <div className="eyebrow mb-1 text-secondary">{eyebrow}</div>}
      <h1 className="display text-5xl leading-[0.9] sm:text-6xl">{title}</h1>
      <div className="neon-line mt-3 h-[3px] w-24 rounded-full" />
      {children && <div className="mt-3 text-muted">{children}</div>}
    </header>
  );
}
