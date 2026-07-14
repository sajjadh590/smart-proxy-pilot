import { AppState, DEFAULT_STATE, Proxy, DomainRule, Settings, Subscription } from "./types";

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

// ---- Subscriptions -------------------------------------------------------

/** Stable source label used to tag proxies that came from a subscription. */
export function subSource(subId: string): string {
  return `sub:${subId}`;
}

export async function addSubscription(sub: Subscription): Promise<void> {
  await mutate((s) => {
    if (!s.subscriptions) s.subscriptions = [];
    s.subscriptions.push(sub);
  });
}

export async function updateSubscription(
  id: string,
  patch: Partial<Subscription>,
): Promise<void> {
  await mutate((s) => {
    const sub = s.subscriptions?.find((x) => x.id === id);
    if (sub) Object.assign(sub, patch);
  });
}

export async function removeSubscription(
  id: string,
  purgeProxies = true,
): Promise<void> {
  await mutate((s) => {
    s.subscriptions = (s.subscriptions ?? []).filter((x) => x.id !== id);
    if (purgeProxies) {
      const src = subSource(id);
      s.proxies = s.proxies.filter(
        (p) => p.source !== src || p.id === s.activeProxyId,
      );
    }
  });
}

/**
 * Replace the proxy set belonging to a subscription with a freshly fetched
 * list. Existing entries (matched by dedupe key) keep their benchmark history,
 * new ones are added, and stale ones are removed — except the active proxy,
 * which is always preserved so a refresh never drops the live connection.
 */
export async function syncSubscriptionProxies(
  subId: string,
  incoming: Proxy[],
): Promise<{ added: number; removed: number; total: number }> {
  const src = subSource(subId);
  let added = 0;
  let removed = 0;
  let total = 0;

  await mutate((s) => {
    const existing = s.proxies.filter((p) => p.source === src);
    const others = s.proxies.filter((p) => p.source !== src);
    const byKey = new Map(existing.map((p) => [dedupeKey(p), p]));
    // Also index proxies from other sources so we never introduce a
    // cross-source duplicate on refresh.
    const otherKeys = new Set(others.map(dedupeKey));
    const incomingKeys = new Set<string>();
    const kept: Proxy[] = [];

    for (const inc of incoming) {
      inc.source = src;
      const key = dedupeKey(inc);
      if (incomingKeys.has(key)) continue; // de-dup within the feed
      if (otherKeys.has(key)) {
        // Already exists elsewhere (manual import, other sub); skip.
        incomingKeys.add(key);
        continue;
      }
      incomingKeys.add(key);
      const prev = byKey.get(key);
      if (prev) {
        prev.name = inc.name;
        prev.raw = inc.raw;
        prev.protocol = inc.protocol;
        prev.host = inc.host;
        prev.port = inc.port;
        prev.auth = inc.auth;
        kept.push(prev);
      } else {
        kept.push(inc);
        added++;
      }
    }

    for (const p of existing) {
      if (!incomingKeys.has(dedupeKey(p))) {
        if (p.id === s.activeProxyId) kept.push(p);
        else removed++;
      }
    }

    s.proxies = [...others, ...kept];
    total = kept.length;
  });

  return { added, removed, total };
}

/** One-shot pass to remove any duplicate proxies in storage (keeps first). */
export async function dedupeAllProxies(): Promise<number> {
  let removed = 0;
  await mutate((s) => {
    const seen = new Set<string>();
    const kept: Proxy[] = [];
    for (const p of s.proxies) {
      const key = dedupeKey(p);
      if (seen.has(key) && p.id !== s.activeProxyId) {
        removed++;
        continue;
      }
      seen.add(key);
      kept.push(p);
    }
    s.proxies = kept;
  });
  return removed;
}
