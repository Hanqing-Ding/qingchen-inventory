import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

/** 主按钮 / 次按钮 */
export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 px-4 py-2 text-sm tracking-wide transition disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-ink text-white hover:bg-black",
    secondary: "border border-ink bg-transparent text-ink hover:bg-ink hover:text-white",
    ghost: "text-muted hover:text-ink",
    danger: "bg-red-700 text-white hover:bg-red-800",
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props} />
  );
}

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink ${className}`}
      {...props}
    />
  );
}

export function Select({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink ${className}`}
      {...props}
    />
  );
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs uppercase tracking-[0.14em] text-muted">
      {children}
    </label>
  );
}

export function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: ReactNode;
  error?: string;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-medium tracking-tight text-ink md:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-xl text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Alert({
  children,
  tone = "error",
}: {
  children: ReactNode;
  tone?: "error" | "ok" | "info";
}) {
  const tones = {
    error: "border-red-300 bg-red-50 text-red-800",
    ok: "border-emerald-300 bg-emerald-50 text-emerald-900",
    info: "border-line bg-surface text-ink",
  };
  return (
    <div className={`border px-3 py-2 text-sm ${tones[tone]}`}>{children}</div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="border border-dashed border-line px-6 py-16 text-center text-sm text-muted">
      {children}
    </div>
  );
}
