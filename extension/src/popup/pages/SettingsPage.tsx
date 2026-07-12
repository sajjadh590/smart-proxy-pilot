import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { AppState } from "@/lib/types";
import { saveSettings } from "@/lib/storage";
import { sendToBackground } from "@/lib/messages";
import { Button } from "../components/ui";

export function SettingsPage({ state }: { state: AppState }) {
  const s = state.settings;
  const [engine, setEngine] = useState<string>("checking…");

  useEffect(() => {
    sendToBackground({ type: "ENGINE_PING" }).then((r) =>
      setEngine(r.ok ? `online · ${r.engineVersion ?? "?"}` : "offline"),
    );
  }, []);

  return (
    <div className="space-y-3">
      <Toggle
        label="Auto-switch on failure"
        desc="Fail over to the healthiest proxy automatically"
        checked={s.autoSwitch}
        onChange={(v) => saveSettings({ autoSwitch: v })}
      />

      <div className="pp-card space-y-2 p-3">
        <Field label="Probe URL">
          <input className="pp-input" defaultValue={s.probeUrl} onBlur={(e) => saveSettings({ probeUrl: e.target.value })} />
        </Field>
        <Field label="Benchmark timeout (ms)">
          <input
            type="number"
            className="pp-input"
            defaultValue={s.benchmarkTimeout}
            onBlur={(e) => saveSettings({ benchmarkTimeout: Number(e.target.value) })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Engine host">
            <input className="pp-input" defaultValue={s.engineHost} onBlur={(e) => saveSettings({ engineHost: e.target.value })} />
          </Field>
          <Field label="Engine port">
            <input
              type="number"
              className="pp-input"
              defaultValue={s.enginePort}
              onBlur={(e) => saveSettings({ enginePort: Number(e.target.value) })}
            />
          </Field>
        </div>
      </div>

      <div className="pp-card flex items-center gap-2 p-3 text-[11px]">
        <ShieldCheck size={14} className="text-[--color-success]" />
        <span>ProxyPilot Engine</span>
        <span className="ml-auto text-[--color-muted]">{engine}</span>
      </div>

      <div className="pp-card p-3 text-[10px] leading-relaxed text-[--color-muted]">
        <div className="mb-1 font-medium text-[--color-fg]">Privacy</div>
        No telemetry. No analytics. No cloud. All proxies and credentials are
        stored locally in this browser and never uploaded.
      </div>

      <Button
        variant="danger"
        className="w-full"
        onClick={async () => {
          if (!confirm("Delete all proxies, rules and settings?")) return;
          await chrome.storage.local.clear();
          await sendToBackground({ type: "DEACTIVATE" });
          location.reload();
        }}
      >
        Reset all data
      </Button>
    </div>
  );
}

function Toggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="pp-card flex items-center justify-between p-3">
      <div>
        <div className="text-[12px] font-medium">{label}</div>
        <div className="text-[10px] text-[--color-muted]">{desc}</div>
      </div>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wide text-[--color-muted]">{label}</div>
      {children}
    </div>
  );
}
