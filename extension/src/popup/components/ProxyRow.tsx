import { Star, Trash2, Power, Play } from "lucide-react";
import { Proxy } from "@/lib/types";
import { updateProxy, removeProxy } from "@/lib/storage";
import { sendToBackground } from "@/lib/messages";
import { LatencyBar, StatusDot, Chip } from "./ui";

// One row in the proxy manager list.
export function ProxyRow({ proxy, active }: { proxy: Proxy; active: boolean }) {
  const activate = async () => {
    const r = await sendToBackground({ type: "ACTIVATE", proxyId: proxy.id });
    if (!r.ok) alert(`Could not connect: ${r.error ?? "unknown error"}`);
  };
  const test = () => sendToBackground({ type: "BENCHMARK_ONE", proxyId: proxy.id });

  const pingColor =
    proxy.latency == null ? "var(--color-muted)" :
    proxy.latency < 200 ? "var(--color-success)" :
    proxy.latency < 500 ? "var(--color-warning)" :
    "var(--color-danger)";

  return (
    <div
      className={`pp-card group relative p-4 transition-all duration-200 hover:-translate-y-[1px] hover:border-[--color-accent] ${
        active ? "border-[--color-primary] shadow-[0_0_18px_var(--color-primary-glow)]" : ""
      }`}
    >
      {/* header row */}
      <div className="flex items-start gap-3">
        <div className="mt-1"><StatusDot status={proxy.status} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-semibold tracking-tight">{proxy.name}</span>
            {active && (
              <span className="rounded-full bg-[--color-primary]/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-[--color-primary]">
                Active
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-[10.5px] text-[--color-muted]">
            <span className="font-mono uppercase tracking-wider text-[--color-muted-2]">{proxy.protocol}</span>
            <span className="mx-1.5 opacity-40">·</span>
            {proxy.host}:{proxy.port}
            {proxy.country ? <><span className="mx-1.5 opacity-40">·</span>{proxy.country}</> : null}
          </div>
        </div>
        <button
          onClick={() => updateProxy(proxy.id, { favorite: !proxy.favorite })}
          className="rounded-md p-1 transition hover:bg-[--color-surface-2]"
          title="Favorite"
        >
          <Star
            size={14}
            className={proxy.favorite ? "fill-[--color-warning] text-[--color-warning]" : "text-[--color-muted-2] hover:text-[--color-warning]"}
          />
        </button>
      </div>

      {/* ping bar */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1"><LatencyBar latency={proxy.latency} /></div>
        <div className="min-w-[60px] text-right font-mono text-[11px] font-medium" style={{ color: pingColor }}>
          {proxy.latency != null ? `${proxy.latency}ms` : "—"}
        </div>
        <div className="text-[10px] text-[--color-muted]">HP {proxy.healthScore}</div>
      </div>

      {proxy.tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {proxy.tags.map((t) => (<Chip key={t}>{t}</Chip>))}
        </div>
      )}

      {/* action row */}
      <div className="mt-3 flex items-center gap-1.5">
        <button
          onClick={activate}
          className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[10.5px] font-medium transition ${
            active
              ? "bg-[--color-primary] text-[--color-primary-fg]"
              : "bg-[--color-surface-2] text-[--color-fg] border border-[--color-border] hover:border-[--color-primary] hover:text-[--color-primary]"
          }`}
        >
          <Power size={11} /> {active ? "Connected" : "Connect"}
        </button>
        <button
          onClick={test}
          className="flex items-center gap-1 rounded-md bg-[--color-surface-2] px-2.5 py-1.5 text-[10.5px] text-[--color-muted] hover:text-[--color-accent]"
        >
          <Play size={11} /> Test
        </button>
        <button
          onClick={() => removeProxy(proxy.id)}
          className="ml-auto rounded-md p-1.5 opacity-0 transition group-hover:opacity-100 hover:bg-[--color-danger]/10"
          title="Delete"
        >
          <Trash2 size={12} className="text-[--color-danger]" />
        </button>
      </div>
    </div>
  );
}
