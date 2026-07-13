import { useState } from "react";
import { RefreshCw, Trash2, Plus, Clock, Hand, Link2 } from "lucide-react";
import { AppState, Subscription } from "@/lib/types";
import { uid } from "@/lib/parsers";
import {
  addSubscription,
  updateSubscription,
  removeSubscription,
} from "@/lib/storage";
import { sendToBackground } from "@/lib/messages";
import { Button } from "../components/ui";

const INTERVAL_OPTIONS = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "3 hours", value: 180 },
  { label: "6 hours", value: 360 },
  { label: "12 hours", value: 720 },
  { label: "24 hours", value: 1440 },
];

// Subscription Manager: save subscription links, refresh them manually, or let
// the background worker auto-refresh them on a schedule.
export function Subscriptions({ state }: { state: AppState }) {
  const subs = state.subscriptions ?? [];
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function add() {
    if (!url.trim()) return;
    const sub: Subscription = {
      id: uid(),
      name: name.trim() || new URL(url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`).hostname,
      url: url.trim(),
      autoUpdate: false,
      updateIntervalMin: 60,
      createdAt: Date.now(),
    };
    await addSubscription(sub);
    setName("");
    setUrl("");
    // Fetch immediately so the user sees results right away.
    void refresh(sub.id);
  }

  async function refresh(id: string) {
    setBusy(id);
    setMsg(null);
    const r = await sendToBackground({ type: "REFRESH_SUBSCRIPTION", subId: id });
    setBusy(null);
    setMsg(
      r.ok
        ? `Updated · ${r.total ?? 0} configs (+${r.added ?? 0} new, -${r.removed ?? 0} removed)`
        : `Error: ${r.error}`,
    );
  }

  async function refreshAll() {
    setBusy("all");
    setMsg(null);
    const r = await sendToBackground({ type: "REFRESH_ALL_SUBSCRIPTIONS" });
    setBusy(null);
    setMsg(r.ok ? `All updated · ${r.total ?? 0} configs total` : `Error: ${r.error}`);
  }

  return (
    <div className="space-y-4">
      {/* Add new subscription */}
      <div className="pp-card space-y-2 p-3">
        <div className="flex items-center gap-2 text-[11px] text-[--color-muted]">
          <Link2 size={13} /> Add subscription link
        </div>
        <input
          className="pp-input"
          placeholder="Name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="pp-input"
          placeholder="https://example.com/sub"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button variant="primary" className="w-full flex items-center justify-center gap-1" disabled={!url} onClick={add}>
          <Plus size={13} /> Save subscription
        </Button>
      </div>

      {subs.length > 0 && (
        <Button className="w-full flex items-center justify-center gap-1" disabled={busy === "all"} onClick={refreshAll}>
          <RefreshCw size={13} className={busy === "all" ? "animate-spin" : ""} /> Refresh all now
        </Button>
      )}

      {msg && <div className="pp-card p-3 text-[11px] text-[--color-fg]">{msg}</div>}

      {/* Subscription list */}
      <div className="space-y-2">
        {subs.length === 0 && (
          <div className="pp-card p-4 text-center text-[11px] text-[--color-muted]">
            No subscriptions yet. Add a link above to import and keep configs fresh.
          </div>
        )}
        {subs.map((sub) => (
          <SubRow
            key={sub.id}
            sub={sub}
            busy={busy === sub.id}
            onRefresh={() => refresh(sub.id)}
          />
        ))}
      </div>
    </div>
  );
}

function SubRow({
  sub,
  busy,
  onRefresh,
}: {
  sub: Subscription;
  busy: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="pp-card space-y-2 p-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-medium">{sub.name}</div>
          <div className="truncate text-[10px] text-[--color-muted]">{sub.url}</div>
        </div>
        <button
          className="rounded-md p-1.5 text-[--color-muted] hover:text-[--color-primary]"
          title="Refresh now"
          disabled={busy}
          onClick={onRefresh}
        >
          <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
        </button>
        <button
          className="rounded-md p-1.5 text-[--color-muted] hover:text-[--color-danger]"
          title="Delete subscription"
          onClick={() => {
            if (confirm(`Remove "${sub.name}" and its imported proxies?`)) {
              void removeSubscription(sub.id);
            }
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Update mode selector */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => updateSubscription(sub.id, { autoUpdate: false })}
          className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] transition ${
            !sub.autoUpdate
              ? "border-[--color-primary] text-[--color-primary]"
              : "border-[--color-border] text-[--color-muted]"
          }`}
        >
          <Hand size={12} /> Manual
        </button>
        <button
          onClick={() => updateSubscription(sub.id, { autoUpdate: true })}
          className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] transition ${
            sub.autoUpdate
              ? "border-[--color-primary] text-[--color-primary]"
              : "border-[--color-border] text-[--color-muted]"
          }`}
        >
          <Clock size={12} /> Auto
        </button>
      </div>

      {sub.autoUpdate && (
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-[--color-muted]">Every</span>
          <select
            className="pp-input flex-1 py-1"
            value={sub.updateIntervalMin}
            onChange={(e) =>
              updateSubscription(sub.id, { updateIntervalMin: Number(e.target.value) })
            }
          >
            {INTERVAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-[--color-muted]">
        <span>
          {sub.lastUpdatedAt
            ? `Updated ${timeAgo(sub.lastUpdatedAt)}`
            : "Never updated"}
        </span>
        <span>
          {sub.lastError ? (
            <span className="text-[--color-danger]">{sub.lastError}</span>
          ) : sub.lastCount != null ? (
            `${sub.lastCount} configs`
          ) : (
            ""
          )}
        </span>
      </div>
    </div>
  );
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
