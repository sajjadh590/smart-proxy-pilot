import { Star, Trash2, Power, Play } from "lucide-react";
import { Proxy } from "@/lib/types";
import { updateProxy, removeProxy } from "@/lib/storage";
import { sendToBackground } from "@/lib/messages";
import { HealthBar, StatusDot, Chip } from "./ui";

// One row in the proxy manager list.
export function ProxyRow({ proxy, active }: { proxy: Proxy; active: boolean }) {
  const activate = async () => {
    const r = await sendToBackground({ type: "ACTIVATE", proxyId: proxy.id });
    if (!r.ok) alert(`Could not connect: ${r.error ?? "unknown error"}`);
  };
  const test = () => sendToBackground({ type: "BENCHMARK_ONE", proxyId: proxy.id });

  return (
    <div className={`pp-card p-3 ${active ? "border-[--color-primary]" : ""}`}>
      <div className="flex items-center gap-2">
        <StatusDot status={proxy.status} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[12px] font-medium">{proxy.name}</span>
            {proxy.favorite && <Star size={11} className="fill-[--color-warning] text-[--color-warning]" />}
          </div>
          <div className="truncate text-[10px] text-[--color-muted]">
            {proxy.protocol} · {proxy.host}:{proxy.port}
            {proxy.country ? ` · ${proxy.country}` : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[12px] font-semibold">{proxy.healthScore}</div>
          <div className="text-[10px] text-[--color-muted]">
            {proxy.latency != null ? `${proxy.latency}ms` : "—"}
          </div>
        </div>
      </div>

      <div className="mt-2">
        <HealthBar score={proxy.healthScore} />
      </div>

      {proxy.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {proxy.tags.map((t) => (
            <Chip key={t}>{t}</Chip>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center gap-1">
        <button
          onClick={activate}
          className="flex items-center gap-1 rounded-md bg-[--color-primary] px-2 py-1 text-[10px] font-medium text-[--color-primary-fg]"
        >
          <Power size={11} /> {active ? "Active" : "Connect"}
        </button>
        <button onClick={test} className="flex items-center gap-1 rounded-md bg-[--color-surface-2] px-2 py-1 text-[10px]">
          <Play size={11} /> Test
        </button>
        <button
          onClick={() => updateProxy(proxy.id, { favorite: !proxy.favorite })}
          className="ml-auto rounded-md bg-[--color-surface-2] p-1"
          title="Favorite"
        >
          <Star size={12} className={proxy.favorite ? "fill-[--color-warning] text-[--color-warning]" : "text-[--color-muted]"} />
        </button>
        <button onClick={() => removeProxy(proxy.id)} className="rounded-md bg-[--color-surface-2] p-1" title="Delete">
          <Trash2 size={12} className="text-[--color-danger]" />
        </button>
      </div>
    </div>
  );
}
