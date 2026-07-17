import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Server,
  Download,
  Rss,
  Gauge,
  Route,
  Settings as SettingsIcon,
  Cpu,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useAppState } from "./useAppState";
import { sendToBackground } from "@/lib/messages";
import { ConnectToggle } from "./components/ui";
import { Dashboard } from "./pages/Dashboard";
import { Proxies } from "./pages/Proxies";
import { ImportPage } from "./pages/ImportPage";
import { Subscriptions } from "./pages/Subscriptions";
import { Benchmark } from "./pages/Benchmark";
import { Routing } from "./pages/Routing";
import { SettingsPage } from "./pages/SettingsPage";

type Tab =
  | "dashboard"
  | "proxies"
  | "import"
  | "subs"
  | "benchmark"
  | "routing"
  | "settings";

const TABS: { id: Tab; label: string; icon: typeof Server }[] = [
  { id: "dashboard", label: "Home", icon: LayoutDashboard },
  { id: "proxies", label: "Proxies", icon: Server },
  { id: "subs", label: "Subs", icon: Rss },
  { id: "import", label: "Import", icon: Download },
  { id: "benchmark", label: "Test", icon: Gauge },
  { id: "routing", label: "Routes", icon: Route },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const { state, loading } = useAppState();
  const [engine, setEngine] = useState<{ running: boolean; version?: string }>({ running: false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    sendToBackground({ type: "ENGINE_PING" }).then((r) =>
      setEngine({ running: !!r.engineRunning, version: r.engineVersion }),
    );
  }, [state.activeProxyId]);

  const active = state.proxies.find((p) => p.id === state.activeProxyId) ?? null;
  const connected = !!active;

  async function handleToggle(next: boolean) {
    setBusy(true);
    if (next) {
      const r = await sendToBackground({ type: "AUTO_SELECT_BEST" });
      if (!r.ok) alert(`Could not connect: ${r.error ?? "no working proxies"}`);
    } else {
      await sendToBackground({ type: "DEACTIVATE" });
    }
    setBusy(false);
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="flex w-14 flex-col items-center gap-1 border-r border-[--color-border] bg-[--color-surface]/60 py-3">
        <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[--color-accent] to-[--color-primary] text-[12px] font-bold text-white shadow-[0_0_12px_var(--color-accent-glow)]">
          P
        </div>
        {TABS.map(({ id, label, icon: Icon }) => {
          const activeTab = tab === id;
          return (
            <button
              key={id}
              title={label}
              onClick={() => setTab(id)}
              className={`group relative flex h-10 w-10 items-center justify-center rounded-lg transition-all ${
                activeTab
                  ? "bg-[--color-accent]/15 text-[--color-accent]"
                  : "text-[--color-muted] hover:bg-[--color-surface-2] hover:text-[--color-fg]"
              }`}
            >
              {activeTab && (
                <span className="absolute -left-3 h-5 w-1 rounded-r-full bg-[--color-accent]" />
              )}
              <Icon size={17} strokeWidth={1.6} />
            </button>
          );
        })}
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-[--color-border] bg-[--color-surface]/40 px-4 py-3 backdrop-blur">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <ConnectToggle on={connected} disabled={busy || state.proxies.length === 0} onChange={handleToggle} />
              <div className="min-w-0">
                <div className="text-[12px] font-semibold tracking-tight">
                  {connected ? (
                    <span className="text-[--color-primary]">Connected</span>
                  ) : (
                    <span className="text-[--color-muted]">Disconnected</span>
                  )}
                </div>
                <div className="truncate text-[10px] text-[--color-muted]">
                  {connected && active ? active.name : "Toggle to auto-connect"}
                </div>
              </div>
            </div>
          </div>

          {/* Speed + core */}
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2 font-mono text-[10px] text-[--color-muted]">
              <span className="flex items-center gap-0.5 text-[--color-success]">
                <ArrowDown size={10} /> {connected && active?.latency != null ? `${active.latency}ms` : "—"}
              </span>
              <span className="flex items-center gap-0.5 text-[--color-accent]">
                <ArrowUp size={10} /> {connected ? "live" : "—"}
              </span>
            </div>
            <div
              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-medium uppercase tracking-wider ${
                engine.running
                  ? "border-[--color-primary]/40 text-[--color-primary]"
                  : "border-[--color-border] text-[--color-muted]"
              }`}
              title={engine.version ? `Engine v${engine.version}` : "Engine"}
            >
              <Cpu size={9} /> Sing-box
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="pt-20 text-center text-[--color-muted]">Loading…</div>
          ) : (
            <>
              {tab === "dashboard" && <Dashboard state={state} />}
              {tab === "proxies" && <Proxies state={state} />}
              {tab === "import" && <ImportPage />}
              {tab === "subs" && <Subscriptions state={state} />}
              {tab === "benchmark" && <Benchmark state={state} />}
              {tab === "routing" && <Routing state={state} />}
              {tab === "settings" && <SettingsPage state={state} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
