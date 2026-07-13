import { AppState, Proxy } from "@/lib/types";
import {
  loadState,
  setActiveProxy,
  updateProxy,
  updateSubscription,
  syncSubscriptionProxies,
} from "@/lib/storage";
import { UiToBg, BgResult } from "@/lib/messages";
import { runImport } from "@/lib/import";
import { buildConfig } from "@/lib/proxy-config";
import { probeProxy, recordSample, bestProxy, rankProxies } from "@/lib/benchmark";
import {
  needsEngine,
  pingEngine,
  startTunnel,
  stopTunnel,
} from "@/lib/native";

// ProxyPilot background service worker.
// Owns: applying Chrome proxy config, engine tunnel lifecycle, benchmarking,
// and automatic failover.

const HEALTH_ALARM = "proxypilot:health";
const HEALTH_PERIOD_MIN = 3;
const SUB_ALARM = "proxypilot:subscriptions";
const SUB_CHECK_PERIOD_MIN = 5;

// ---- Proxy activation ----------------------------------------------------

async function applyProxy(state: AppState, proxy: Proxy): Promise<void> {
  if (needsEngine(proxy)) {
    const res = await startTunnel(proxy, state.settings);
    if (!res.ok) throw new Error(res.error ?? "Engine failed to start tunnel");
  } else {
    await stopTunnel().catch(() => void 0);
  }
  const config = buildConfig(proxy, state.rules, state.settings);
  await chrome.proxy.settings.set({ value: config, scope: "regular" });
  await setBadge(proxy);
}

async function clearProxy(): Promise<void> {
  await chrome.proxy.settings.clear({ scope: "regular" });
  await stopTunnel().catch(() => void 0);
  await chrome.action.setBadgeText({ text: "" });
}

async function setBadge(proxy: Proxy | null): Promise<void> {
  if (!proxy) {
    await chrome.action.setBadgeText({ text: "" });
    return;
  }
  const color =
    proxy.healthScore >= 70 ? "#3fd68a" : proxy.healthScore >= 40 ? "#f6c453" : "#ff6b6b";
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setBadgeText({ text: "ON" });
}

async function activate(proxyId: string): Promise<BgResult> {
  const state = await loadState();
  const proxy = state.proxies.find((p) => p.id === proxyId);
  if (!proxy) return { ok: false, error: "Proxy not found" };
  try {
    await applyProxy(state, proxy);
    await setActiveProxy(proxyId);
    return { ok: true, activeProxy: proxy };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function deactivate(): Promise<BgResult> {
  await clearProxy();
  await setActiveProxy(null);
  return { ok: true, activeProxy: null };
}

// ---- Benchmarking --------------------------------------------------------

async function benchmarkOne(proxyId: string): Promise<void> {
  const state = await loadState();
  const proxy = state.proxies.find((p) => p.id === proxyId);
  if (!proxy) return;
  await updateProxy(proxyId, { status: "testing" });
  const result = await probeProxy(proxy, state.settings.benchmarkTimeout);
  const updated = recordSample(proxy, result);
  await updateProxy(proxyId, {
    status: updated.status,
    latency: updated.latency,
    healthScore: updated.healthScore,
    history: updated.history,
    lastTestedAt: updated.lastTestedAt,
  });
}

async function benchmarkMany(ids: string[]): Promise<number> {
  const CONCURRENCY = 6;
  let idx = 0;
  let tested = 0;
  async function worker() {
    while (idx < ids.length) {
      const id = ids[idx++];
      await benchmarkOne(id);
      tested++;
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker),
  );
  return tested;
}

async function benchmarkAll(): Promise<number> {
  const state = await loadState();
  return benchmarkMany(state.proxies.map((p) => p.id));
}

async function retestFailed(): Promise<number> {
  const state = await loadState();
  return benchmarkMany(
    state.proxies.filter((p) => p.status === "failed").map((p) => p.id),
  );
}

async function autoSelectBest(): Promise<BgResult> {
  const state = await loadState();
  const best = bestProxy(state.proxies);
  if (!best) return { ok: false, error: "No working proxies" };
  return activate(best.id);
}

// ---- Subscriptions -------------------------------------------------------

async function refreshSubscription(subId: string): Promise<BgResult> {
  const state = await loadState();
  const sub = state.subscriptions?.find((s) => s.id === subId);
  if (!sub) return { ok: false, error: "Subscription not found" };
  try {
    const res = await runImport({ kind: "url", value: sub.url });
    if (res.parsed.length === 0) {
      await updateSubscription(subId, {
        lastUpdatedAt: Date.now(),
        lastError: "No proxies found",
      });
      return { ok: false, error: "No proxies found" };
    }
    const stats = await syncSubscriptionProxies(subId, res.parsed);
    await updateSubscription(subId, {
      lastUpdatedAt: Date.now(),
      lastCount: stats.total,
      lastError: undefined,
    });
    return { ok: true, ...stats };
  } catch (e) {
    await updateSubscription(subId, {
      lastUpdatedAt: Date.now(),
      lastError: String(e),
    });
    return { ok: false, error: String(e) };
  }
}

async function refreshAllSubscriptions(): Promise<BgResult> {
  const state = await loadState();
  const subs = state.subscriptions ?? [];
  let added = 0;
  let removed = 0;
  let total = 0;
  for (const sub of subs) {
    const r = await refreshSubscription(sub.id);
    added += r.added ?? 0;
    removed += r.removed ?? 0;
    total += r.total ?? 0;
  }
  return { ok: true, added, removed, total };
}

/** Refresh only subscriptions whose auto-update interval has elapsed. */
async function subscriptionTick(): Promise<void> {
  const state = await loadState();
  const now = Date.now();
  for (const sub of state.subscriptions ?? []) {
    if (!sub.autoUpdate) continue;
    const dueAfter = (sub.lastUpdatedAt ?? 0) + sub.updateIntervalMin * 60_000;
    if (now >= dueAfter) {
      await refreshSubscription(sub.id);
    }
  }
}



async function healthTick(): Promise<void> {
  const state = await loadState();
  if (!state.settings.autoSwitch) return;

  const active = state.proxies.find((p) => p.id === state.activeProxyId);
  if (!active) return;

  // Re-probe the active proxy; on failure, fail over to the next best.
  const result = await probeProxy(active, state.settings.benchmarkTimeout);
  const updated = recordSample(active, result);
  await updateProxy(active.id, {
    status: updated.status,
    latency: updated.latency,
    healthScore: updated.healthScore,
    history: updated.history,
    lastTestedAt: updated.lastTestedAt,
  });

  if (!result.ok) {
    const fresh = await loadState();
    const candidates = rankProxies(
      fresh.proxies.filter((p) => p.id !== active.id && p.status === "working"),
    );
    const next = candidates[0];
    if (next) {
      await activate(next.id);
      notify("Auto-switched", `Failover to ${next.name}`);
    }
  }
}

function notify(title: string, message: string): void {
  chrome.notifications?.create?.({
    type: "basic",
    iconUrl: "icons/icon48.png",
    title,
    message,
  });
}

// ---- Message + lifecycle wiring -----------------------------------------

chrome.runtime.onMessage.addListener((msg: UiToBg, _sender, sendResponse) => {
  (async () => {
    switch (msg.type) {
      case "ACTIVATE":
        sendResponse(await activate(msg.proxyId));
        break;
      case "DEACTIVATE":
        sendResponse(await deactivate());
        break;
      case "BENCHMARK_ALL":
        sendResponse({ ok: true, tested: await benchmarkAll() });
        break;
      case "BENCHMARK_ONE":
        await benchmarkOne(msg.proxyId);
        sendResponse({ ok: true, tested: 1 });
        break;
      case "RETEST_FAILED":
        sendResponse({ ok: true, tested: await retestFailed() });
        break;
      case "AUTO_SELECT_BEST":
        sendResponse(await autoSelectBest());
        break;
      case "REFRESH_CONFIG": {
        const state = await loadState();
        const active = state.proxies.find((p) => p.id === state.activeProxyId);
        if (active) await applyProxy(state, active);
        sendResponse({ ok: true, activeProxy: active ?? null });
        break;
      }
      case "REFRESH_SUBSCRIPTION":
        sendResponse(await refreshSubscription(msg.subId));
        break;
      case "REFRESH_ALL_SUBSCRIPTIONS":
        sendResponse(await refreshAllSubscriptions());
        break;
      case "SYNC_SUB_ALARMS":
        await subscriptionTick();
        sendResponse({ ok: true });
        break;
      case "ENGINE_PING": {
        const res = await pingEngine();
        sendResponse({
          ok: res.ok,
          engineVersion: res.version,
          engineRunning: res.running,
          error: res.error,
        });
        break;
      }
      default:
        sendResponse({ ok: false, error: "Unknown message" });
    }
  })();
  return true; // async response
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: "" });
  chrome.alarms.create(HEALTH_ALARM, { periodInMinutes: HEALTH_PERIOD_MIN });
});

chrome.runtime.onStartup.addListener(async () => {
  const state = await loadState();
  if (state.activeProxyId) {
    const p = state.proxies.find((x) => x.id === state.activeProxyId);
    if (p) await applyProxy(state, p).catch(() => void 0);
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === HEALTH_ALARM) void healthTick();
});

// React to Chrome-level proxy errors as an additional failover trigger.
chrome.proxy.onProxyError.addListener(() => {
  void healthTick();
});
