import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AppState, Protocol } from "@/lib/types";
import { rankProxies } from "@/lib/benchmark";
import { ProxyRow } from "../components/ProxyRow";

type Filter = "all" | "working" | "failed" | "favorites";

export function Proxies({ state }: { state: AppState }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

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

      <div className="flex gap-1">
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

// eslint helper to keep Protocol referenced type-safe in future extension.
export type _P = Protocol;
