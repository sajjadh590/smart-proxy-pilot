import { useMemo, useState } from "react";
import { Search, Gauge, Trash2 } from "lucide-react";
import { AppState, Protocol } from "@/lib/types";
import { rankProxies } from "@/lib/benchmark";
import { sendToBackground } from "@/lib/messages";
import { dedupeAllProxies } from "@/lib/storage";
import { ProxyRow } from "../components/ProxyRow";
import { Button } from "../components/ui";

type Filter = "all" | "working" | "failed" | "favorites";

export function Proxies({ state }: { state: AppState }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = state.proxies.filter((p) => {
      if (filter === "working") return p.status === "working";
      if (filter === "failed") return p.status === "failed";
      if (filter === "favorites") return p.favorite;
      return true;
    });
    if (q) {
      list = list.filter((p) =>
        [p.name, p.protocol, p.host, p.country, ...(p.tags ?? [])]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(q)) ||
        (q === "fast" && (p.latency ?? 9999) < 300) ||
        (/^\d+$/.test(q) && p.healthScore >= Number(q)),
      );
    }
    return rankProxies(list);
  }, [state.proxies, query, filter]);

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "working", label: "Working" },
    { id: "failed", label: "Failed" },
    { id: "favorites", label: "★" },
  ];

  async function testAll() {
    setBusy(true);
    await sendToBackground({ type: "BENCHMARK_ALL" });
    setBusy(false);
  }

  async function removeDuplicates() {
    const n = await dedupeAllProxies();
    alert(n ? `Removed ${n} duplicate proxies.` : "No duplicates found.");
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--color-muted]" />
        <input
          className="pp-input pl-8"
          placeholder="Search protocol, country, tag, health…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-lg px-3 py-1 text-[11px] ${
              filter === f.id
                ? "bg-[--color-primary] text-[--color-primary-fg]"
                : "bg-[--color-surface-2] text-[--color-muted]"
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-[--color-muted]">
          {filtered.length} shown
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="primary"
          className="flex items-center justify-center gap-1"
          disabled={busy || state.proxies.length === 0}
          onClick={testAll}
        >
          <Gauge size={13} /> {busy ? "Testing…" : "Test all"}
        </Button>
        <Button
          className="flex items-center justify-center gap-1"
          disabled={state.proxies.length === 0}
          onClick={removeDuplicates}
        >
          <Trash2 size={13} /> Remove duplicates
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="pt-10 text-center text-[12px] text-[--color-muted]">
          No proxies. Head to Import to add some.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <ProxyRow key={p.id} proxy={p} active={p.id === state.activeProxyId} />
          ))}
        </div>
      )}
    </div>
  );
}

export type _P = Protocol;
