import { useState } from "react";
import {
  LayoutDashboard,
  Server,
  Download,
  Rss,
  Gauge,
  Route,
  Settings as SettingsIcon,
} from "lucide-react";
import { useAppState } from "./useAppState";
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
  { id: "import", label: "Import", icon: Download },
  { id: "subs", label: "Subs", icon: Rss },
  { id: "benchmark", label: "Test", icon: Gauge },
  { id: "routing", label: "Routes", icon: Route },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const { state, loading } = useAppState();

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-[--color-border] px-4 py-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[--color-primary] text-[--color-primary-fg] text-[11px] font-bold">
          P
        </div>
        <span className="font-semibold tracking-tight">ProxyPilot</span>
        <span className="ml-auto text-[11px] text-[--color-muted]">
          {state.proxies.length} proxies
        </span>
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

      <nav className="grid grid-cols-6 border-t border-[--color-border]">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex flex-col items-center gap-1 py-2 text-[10px] transition-colors ${
              tab === id
                ? "text-[--color-primary]"
                : "text-[--color-muted] hover:text-[--color-fg]"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
