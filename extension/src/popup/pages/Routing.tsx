import { useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { AppState, DomainRule } from "@/lib/types";
import { saveRules, saveSettings } from "@/lib/storage";
import { sendToBackground } from "@/lib/messages";
import { uid } from "@/lib/parsers";
import { Button } from "../components/ui";

const PRESETS = ["chatgpt.com", "claude.ai", "qwen.ai", "github.com", "reddit.com"];

export function Routing({ state }: { state: AppState }) {
  const [rules, setRules] = useState<DomainRule[]>(state.rules);
  const [pattern, setPattern] = useState("");

  async function commit(next: DomainRule[]) {
    setRules(next);
    await saveRules(next);
    await sendToBackground({ type: "REFRESH_CONFIG" });
  }

  const add = (p: string) => {
    if (!p.trim()) return;
    commit([
      ...rules,
      { id: uid(), pattern: p.trim(), enabled: true, priority: rules.length, comment: "" },
    ]);
    setPattern("");
  };

  const patch = (id: string, upd: Partial<DomainRule>) =>
    commit(rules.map((r) => (r.id === id ? { ...r, ...upd } : r)));

  const remove = (id: string) => commit(rules.filter((r) => r.id !== id));

  const move = (id: string, dir: -1 | 1) => {
    const idx = rules.findIndex((r) => r.id === id);
    const j = idx + dir;
    if (j < 0 || j >= rules.length) return;
    const next = [...rules];
    [next[idx], next[j]] = [next[j], next[idx]];
    commit(next.map((r, i) => ({ ...r, priority: rules.length - i })));
  };

  return (
    <div className="space-y-3">
      <label className="pp-card flex items-center justify-between p-3">
        <div>
          <div className="text-[12px] font-medium">Domain routing</div>
          <div className="text-[10px] text-[--color-muted]">Route only matching domains via proxy</div>
        </div>
        <input
          type="checkbox"
          checked={state.settings.domainRoutingEnabled}
          onChange={async (e) => {
            await saveSettings({ domainRoutingEnabled: e.target.checked });
            await sendToBackground({ type: "REFRESH_CONFIG" });
          }}
        />
      </label>

      <div className="flex gap-2">
        <input
          className="pp-input"
          placeholder="example.com"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add(pattern)}
        />
        <Button variant="primary" onClick={() => add(pattern)}>
          <Plus size={14} />
        </Button>
      </div>

      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button key={p} onClick={() => add(p)} className="rounded-full bg-[--color-surface-2] px-2 py-1 text-[10px] text-[--color-muted]">
            + {p}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {rules.map((r) => (
          <div key={r.id} className="pp-card flex items-center gap-2 p-2">
            <input type="checkbox" checked={r.enabled} onChange={(e) => patch(r.id, { enabled: e.target.checked })} />
            <span className={`flex-1 truncate text-[11px] ${r.enabled ? "" : "line-through opacity-50"}`}>{r.pattern}</span>
            <button onClick={() => move(r.id, -1)} className="text-[--color-muted]"><ArrowUp size={13} /></button>
            <button onClick={() => move(r.id, 1)} className="text-[--color-muted]"><ArrowDown size={13} /></button>
            <button onClick={() => remove(r.id)} className="text-[--color-danger]"><Trash2 size={13} /></button>
          </div>
        ))}
        {rules.length === 0 && (
          <div className="pt-6 text-center text-[11px] text-[--color-muted]">No rules yet.</div>
        )}
      </div>
    </div>
  );
}
