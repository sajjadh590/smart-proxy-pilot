import { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";
import { Proxy } from "@/lib/types";

// Small, dependency-light UI primitives styled from the design tokens.

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger" | "surface" | "accent";
}

export function Button({ variant = "surface", className, ...rest }: BtnProps) {
  const styles = {
    primary:
      "bg-[--color-primary] text-[--color-primary-fg] hover:brightness-110 shadow-[0_0_18px_var(--color-primary-glow)]",
    accent:
      "bg-[--color-accent] text-[--color-accent-fg] hover:brightness-110",
    ghost: "text-[--color-muted] hover:text-[--color-fg]",
    danger: "bg-[--color-danger] text-white hover:opacity-90",
    surface:
      "bg-[--color-surface-2] text-[--color-fg] border border-[--color-border] hover:border-[--color-accent]",
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

/** Color-coded miniature latency bar: green (fast) → yellow → red (slow). */
export function LatencyBar({ latency }: { latency: number | null | undefined }) {
  if (latency == null) {
    return (
      <div className="h-1 w-full overflow-hidden rounded-full bg-[--color-surface-2]">
        <div className="h-full w-0" />
      </div>
    );
  }
  // 0ms → 100%, 800ms → ~0%
  const pct = Math.max(6, Math.min(100, 100 - (latency / 8)));
  const color =
    latency < 200 ? "var(--color-success)" :
    latency < 500 ? "var(--color-warning)" :
    "var(--color-danger)";
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-[--color-surface-2]">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}` }}
      />
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
      style={{ background: map[status], boxShadow: status === "working" ? `0 0 6px ${map.working}` : undefined }}
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

/** Sleek connection toggle with a neon glow when active. */
export function ConnectToggle({
  on,
  disabled,
  onChange,
}: {
  on: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={clsx(
        "relative h-7 w-12 rounded-full border transition-all duration-300 disabled:opacity-40",
        on
          ? "bg-[--color-primary] border-transparent shadow-[0_0_14px_var(--color-primary-glow)]"
          : "bg-[--color-surface-2] border-[--color-border-strong]",
      )}
    >
      <span
        className={clsx(
          "absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all duration-300",
          on ? "left-[22px]" : "left-0.5",
        )}
        style={{
          boxShadow: on
            ? "0 0 10px var(--color-primary-glow), 0 2px 4px rgba(0,0,0,.35)"
            : "0 2px 4px rgba(0,0,0,.4)",
        }}
      />
    </button>
  );
}
