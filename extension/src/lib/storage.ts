import { AppState, DEFAULT_STATE, Proxy, DomainRule, Settings } from "./types";

// Thin, typed wrapper over chrome.storage.local.
// Everything ProxyPilot persists lives locally — no cloud, no telemetry.

const KEY = "proxypilot:state";

type Listener = (state: AppState) => void;
const listeners = new Set<Listener>();

export async function loadState(): Promise<AppState> {
  const res = await chrome.storage.local.get(KEY);
  const stored = res[KEY] as Partial<AppState> | undefined;
  if (!stored) return structuredClone(DEFAULT_STATE);
  return {
    ...structuredClone(DEFAULT_STATE),
    ...stored,
    settings: { ...DEFAULT_STATE.settings, ...(stored.settings ?? {}) },
  };
}

export async function saveState(state: AppState): Promise<void> {
  await chrome.storage.local.set({ [KEY]: state });
  listeners.forEach((l) => l(state));
}

export async function mutate(
  fn: (draft: AppState) => void | Promise<void>,
): Promise<AppState> {
  const state = await loadState();
  await fn(state);
  await saveState(state);
  return state;
}

/** Subscribe to cross-context storage changes (popup <-> background). */
export function onStateChange(cb: Listener): () => void {
  const handler = (
    changes: { [k: string]: chrome.storage.StorageChange },
    area: string,
  ) => {
    if (area === "local" && changes[KEY]?.newValue) {
      cb(changes[KEY].newValue as AppState);
    }
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}

// ---- Convenience helpers -------------------------------------------------

export async function upsertProxies(incoming: Proxy[]): Promise<number> {
  let added = 0;
  await mutate((s) => {
    const seen = new Set(s.proxies.map(dedupeKey));
    for (const p of incoming) {
      const key = dedupeKey(p);
      if (seen.has(key)) continue;
      seen.add(key);
      s.proxies.push(p);
      added++;
    }
  });
  return added;
}

export function dedupeKey(p: Proxy): string {
  const u = p.auth?.username ?? "";
  const id = p.auth?.extra?.uuid ?? p.auth?.password ?? "";
  return `${p.protocol}://${p.host}:${p.port}#${u}${id}`;
}

export async function updateProxy(
  id: string,
  patch: Partial<Proxy>,
): Promise<void> {
  await mutate((s) => {
    const p = s.proxies.find((x) => x.id === id);
    if (p) Object.assign(p, patch);
  });
}

export async function removeProxy(id: string): Promise<void> {
  await mutate((s) => {
    s.proxies = s.proxies.filter((p) => p.id !== id);
    if (s.activeProxyId === id) s.activeProxyId = null;
  });
}

export async function setActiveProxy(id: string | null): Promise<void> {
  await mutate((s) => {
    s.activeProxyId = id;
  });
}

export async function saveRules(rules: DomainRule[]): Promise<void> {
  await mutate((s) => {
    s.rules = rules;
  });
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  await mutate((s) => {
    s.settings = { ...s.settings, ...patch };
  });
}
