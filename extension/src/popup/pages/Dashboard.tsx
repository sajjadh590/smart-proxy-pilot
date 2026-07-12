import { useEffect, useState } from "react";
import { AppState } from "@/lib/types";
import { sendToBackground } from "@/lib/messages";
import { Button, Stat, HealthBar, StatusDot } from "../components/ui";
import { Zap, ShieldCheck, ShieldOff } from "lucide-react";

export function Dashboard({ state }: { state: AppState }) {
  const active = state.proxies.find((p) => p.id === state.activeProxyId) ?? null;
  const working = state.proxies.filter((p) => p.status === "working").length;
  const failed = state.proxies.filter((p) => p.status === "failed").length;
  const [engine, setEngine] = useState<{ running?: boolean; version?: string; ok: boolean }>({ ok: false });

  useEffect(() => {
    sendToBackground({ type: "ENGINE_PING" }).then((r) =>
      setEngine({ ok: r.ok, running: r.engineRunning, version: r.engineVersion }),
    );
  }, []);

  return (
    <div className="space-y-3">
      <div className="pp-card p-4">
        <div className="mb-1 flex items-center gap-2 text-[11px] text-[--color-muted]">
          {active ? <StatusDot status={active.status} /> : <ShieldOff size={13} />}
          Current connection
        </div>
        {active ? (
          <>
            <div className="text-base font-semibold">{active.name}</div>
            <div className="text-[11px] text-[--color-muted]">
              {active.protocol} · {active.host}:{active.port}
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
          <div className="py-2 text-[12px] text-[--color-muted]">
            Not connected. Pick a proxy or auto-select the best one.
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Working" value={working} accent="var(--color-success)" />
        <Stat label="Failed" value={failed} accent="var(--color-danger)" />
      </div>

      <div className="pp-card flex items-center gap-2 p-3 text-[11px]">
        {state.settings.autoSwitch ? (
          <ShieldCheck size={14} className="text-[--color-success]" />
        ) : (
          <ShieldOff size={14} className="text-[--color-muted]" />
        )}
        Auto-switch {state.settings.autoSwitch ? "enabled" : "disabled"}
        <span className="ml-auto flex items-center gap-1 text-[--color-muted]">
          Engine{" "}
          <span style={{ color: engine.running ? "var(--color-success)" : "var(--color-danger)" }}>
            {engine.running ? engine.version ?? "on" : "offline"}
          </span>
        </span>
      </div>

      <Button variant="primary" className="flex w-full items-center justify-center gap-2" onClick={() => sendToBackground({ type: "AUTO_SELECT_BEST" })}>
        <Zap size={14} /> Auto-select best
      </Button>
    </div>
  );
}
