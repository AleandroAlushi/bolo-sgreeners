/** Campi di form per l'area admin (componenti server, senza stato). */
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cx } from "../ui";

const inputClass =
  "w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-muted/60 focus:border-primary focus:outline-none disabled:opacity-60";

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block space-y-1", className)}>
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const Input = (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} className={cx(inputClass, props.className)} />;
export const Textarea = (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...props} className={cx(inputClass, props.className)} />;
export const Select = ({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...props} className={cx(inputClass, props.className)}>
    {children}
  </select>
);

export function Checkbox({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <input type="checkbox" {...props} className="h-4 w-4 accent-[var(--sg-primary)]" />
      {label}
    </label>
  );
}

export function Grid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const c = cols === 4 ? "sm:grid-cols-4" : cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  return <div className={cx("grid gap-3", c)}>{children}</div>;
}

export function AdminSection({ title, children, description }: { title: string; children: ReactNode; description?: ReactNode }) {
  return (
    <section className="card space-y-4 p-4 sm:p-5">
      <div>
        <h2 className="display text-xl">{title}</h2>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}
