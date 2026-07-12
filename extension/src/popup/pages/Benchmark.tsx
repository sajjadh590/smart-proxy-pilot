import { useState } from "react";
import { Gauge, RefreshCw, Zap, AlertTriangle } from "lucide-react";
import { AppState } from "@/lib/types";
import { sendToBackground } from "@/lib/messages";
import { rankProxies } from "@/lib/benchmark";
import { Button, HealthBar, StatusDot } from "../components/ui";

export function Benchmark({ state }: { state: AppState }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function run(type: "BENCHMARK_ALL" | "RETEST_FAILED" | "AUTO_SELECT_BEST", label: string) {
    setBusy(label);
    await sendToBackground({ type });
    setBusy(null);
  }

  const ranked = rankProxies(state.proxies).slice(0, 20);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2">
        <Button variant="primary" className="flex items-center justify-center gap-2" disabled={!!busy} onClick={() => run("BENCHMARK_ALL", "all")}>
          <Gauge size={14} /> {busy === "all" ? "Testing…" : "Benchmark all"}
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button className="flex items-center justify-center gap-2" disabled={!!busy} onClick={() => run("RETEST_FAILED", "failed")}>
            <RefreshCw size={13} /> Retest failed
          </Button>
          <Button className="flex items-center justify-center gap-2" disabled={!!busy} onClick={() => run("AUTO_SELECT_BEST", "best")}>
            <Zap size={13} /> Select best
          </Button>
        </div>
      </div>

      <div className="pp-card p-3 text-[11px] text-[--color-muted]">
        <div className="mb-1 flex items-center gap-1">
          <AlertTriangle size={12} /> Ranking (best first)
        </div>
        {ranked.length === 0 && <div>No proxies to rank yet.</div>}
        <div className="mt-2 space-y-2">
          {ranked.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2">
              <span className="w-4 text-right text-[--color-muted]">{i + 1}</span>
              <StatusDot status={p.status} />
              <span className="w-24 truncate text-[--color-fg]">{p.name}</span>
              <div className="flex-1"><HealthBar score={p.healthScore} /></div>
              <span className="w-10 text-right text-[--color-fg]">{p.healthScore}</span>
              <span className="w-12 text-right">{p.latency != null ? `${p.latency}ms` : "—"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
