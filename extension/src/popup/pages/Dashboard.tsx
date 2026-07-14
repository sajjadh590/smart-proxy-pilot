import { useEffect, useState } from "react";
import { AppState } from "@/lib/types";
import { sendToBackground } from "@/lib/messages";
import { rankProxies } from "@/lib/benchmark";
import { Button, Stat, HealthBar, StatusDot } from "../components/ui";
import {
  Zap,
  ShieldCheck,
  ShieldOff,
  Gauge,
  Cpu,
  Wifi,
  WifiOff,
} from "lucide-react";

export function Dashboard({ state }: { state: AppState }) {
  const active = state.proxies.find((p) => p.id === state.activeProxyId) ?? null;
  const working = state.proxies.filter((p) => p.status === "working").length;
  const failed = state.proxies.filter((p) => p.status === "failed").length;
  const untested = state.proxies.filter((p) => p.status === "unknown").length;
  const [engine, setEngine] = useState<{ running?: boolean; version?: string; ok: boolean }>({ ok: false });
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    sendToBackground({ type: "ENGINE_PING" }).then((r) =>
      setEngine({ ok: r.ok, running: r.engineRunning, version: r.engineVersion }),
    );
  }, []);

  async function autoBest() {
    setBusy("best");
    const r = await sendToBackground({ type: "AUTO_SELECT_BEST" });
    setBusy(null);
    if (!r.ok) alert(`Could not connect: ${r.error ?? "no working proxies"}`);
  }
  async function benchmarkAll() {
    setBusy("bench");
    await sendToBackground({ type: "BENCHMARK_ALL" });
    setBusy(null);
  }

  const top = rankProxies(state.proxies.filter((p) => p.id !== state.activeProxyId)).slice(0, 4);

  return (
    <div className="flex flex-col gap-3">
      {/* Current connection */}
      <div className="pp-card p-4">
        <div className="mb-1 flex items-center gap-2 text-[11px] text-[--color-muted]">
          {active ? <StatusDot status={active.status} /> : <ShieldOff size={13} />}
          Current connection
        </div>
        {active ? (
          <>
            <div className="flex items-center gap-2">
              <Wifi size={16} className="text-[--color-success]" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold">{active.name}</div>
                <div className="truncate text-[11px] text-[--color-muted]">
                  {active.protocol} · {active.host}:{active.port}
                </div>
              </div>
            </div>
            <div className="mt-3"><HealthBar score={active.healthScore} /></div>
            <div className="mt-1 flex justify-between text-[11px] text-[--color-muted]">
              <span>Health {active.healthScore}</span>
              <span>{active.latency != null ? `${active.latency}ms` : "—"}</span>
            </div>
            <Button variant="danger" className="mt-3 w-full" onClick={() => sendToBackground({ type: "DEACTIVATE" })}>
              Disconnect
            </Button>
          </>
        ) : (
          <div className="flex items-center gap-2 py-2 text-[12px] text-[--color-muted]">
            <WifiOff size={16} />
            Not connected. Pick a proxy or auto-select the best one.
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="primary"
          className="flex items-center justify-center gap-1"
          disabled={busy === "best" || state.proxies.length === 0}
          onClick={autoBest}
        >
          <Zap size={14} /> {busy === "best" ? "Selecting…" : "Auto-best"}
        </Button>
        <Button
          className="flex items-center justify-center gap-1"
          disabled={busy === "bench" || state.proxies.length === 0}
          onClick={benchmarkAll}
        >
          <Gauge size={14} /> {busy === "bench" ? "Testing…" : "Test all"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Working" value={working} accent="var(--color-success)" />
        <Stat label="Failed" value={failed} accent="var(--color-danger)" />
        <Stat label="Untested" value={untested} accent="var(--color-muted)" />
      </div>

      {/* Engine + auto-switch status */}
      <div className="pp-card space-y-2 p-3 text-[11px]">
        <div className="flex items-center gap-2">
          <Cpu size={13} className={engine.running ? "text-[--color-success]" : "text-[--color-danger]"} />
          <span className="text-[--color-muted]">Engine</span>
          <span className="ml-auto" style={{ color: engine.running ? "var(--color-success)" : "var(--color-danger)" }}>
            {engine.running ? `running · v${engine.version ?? "?"}` : "offline"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {state.settings.autoSwitch ? (
            <ShieldCheck size={13} className="text-[--color-success]" />
          ) : (
            <ShieldOff size={13} className="text-[--color-muted]" />
          )}
          <span className="text-[--color-muted]">Auto-switch</span>
          <span className="ml-auto">{state.settings.autoSwitch ? "enabled" : "disabled"}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[--color-muted]">Subscriptions</span>
          <span className="ml-auto">{state.subscriptions?.length ?? 0}</span>
        </div>
      </div>

      {/* Top ranked proxies */}
      {top.length > 0 && (
        <div className="pp-card p-3">
          <div className="mb-2 text-[10px] uppercase tracking-wide text-[--color-muted]">
            Top ranked
          </div>
          <div className="space-y-2">
            {top.map((p) => (
              <button
                key={p.id}
                onClick={async () => {
                  const r = await sendToBackground({ type: "ACTIVATE", proxyId: p.id });
                  if (!r.ok) alert(`Could not connect: ${r.error ?? "unknown"}`);
                }}
                className="flex w-full items-center gap-2 rounded-md p-1 text-left hover:bg-[--color-surface-2]"
              >
                <StatusDot status={p.status} />
                <span className="min-w-0 flex-1 truncate text-[11px]">{p.name}</span>
                <span className="text-[10px] text-[--color-muted]">
                  {p.latency != null ? `${p.latency}ms` : "—"}
                </span>
                <span className="w-8 text-right text-[11px] font-semibold">{p.healthScore}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
