import { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";
import { Proxy } from "@/lib/types";

// Small, dependency-light UI primitives styled from the design tokens.

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger" | "surface";
}

export function Button({ variant = "surface", className, ...rest }: BtnProps) {
  const styles = {
    primary: "bg-[--color-primary] text-[--color-primary-fg] hover:opacity-90",
    ghost: "text-[--color-muted] hover:text-[--color-fg]",
    danger: "bg-[--color-danger] text-white hover:opacity-90",
    surface:
      "bg-[--color-surface-2] text-[--color-fg] border border-[--color-border] hover:border-[--color-primary]",
  }[variant];
  return (
    <button
      className={clsx(
        "rounded-lg px-3 py-2 text-[12px] font-medium transition disabled:opacity-40",
        styles,
        className,
      )}
      {...rest}
    />
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("pp-card p-3", className)}>{children}</div>;
}

export function Stat({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <div className="pp-card p-3">
      <div className="text-[10px] uppercase tracking-wide text-[--color-muted]">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
    </div>
  );
}

export function HealthBar({ score }: { score: number }) {
  const color = score >= 70 ? "var(--color-success)" : score >= 40 ? "var(--color-warning)" : "var(--color-danger)";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[--color-surface-2]">
      <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
    </div>
  );
}

export function StatusDot({ status }: { status: Proxy["status"] }) {
  const map = {
    working: "var(--color-success)",
    failed: "var(--color-danger)",
    testing: "var(--color-warning)",
    unknown: "var(--color-muted)",
  } as const;
  return (
    <span
      className={clsx("inline-block h-2 w-2 rounded-full", status === "testing" && "animate-pulse")}
      style={{ background: map[status] }}
    />
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-[--color-surface-2] px-2 py-0.5 text-[10px] text-[--color-muted]">
      {children}
    </span>
  );
}
