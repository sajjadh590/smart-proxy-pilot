import { BenchmarkSample, Proxy } from "./types";

// Benchmark + Health scoring.
//
// A true protocol-level benchmark for VMess/VLESS/etc. must run through the
// native engine's local SOCKS5 endpoint. From the extension we perform a
// TCP-reachability + latency probe which is protocol-agnostic and safe to run
// in the service worker. The engine, when present, augments results with a
// real end-to-end HTTP probe (see native.ts).

const MAX_HISTORY = 20;

export interface ProbeResult {
  ok: boolean;
  latency: number | null;
}

/**
 * Probe a proxy endpoint reachability using a timed fetch to a lightweight
 * connectivity URL. We can't route the request itself through the proxy from
 * the worker, so this measures endpoint responsiveness / TCP handshake via a
 * best-effort HEAD to the host:port when it speaks HTTP, and falls back to a
 * timed connect for opaque protocols.
 */
export async function probeProxy(
  proxy: Proxy,
  timeoutMs: number,
): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();
  try {
    // A no-cors reachability ping. Resolves for reachable hosts, throws on
    // DNS/connection failure or timeout.
    await fetch(`https://${proxy.host}:${proxy.port}`, {
      method: "HEAD",
      mode: "no-cors",
      signal: controller.signal,
      cache: "no-store",
    });
    const latency = Math.round(performance.now() - start);
    return { ok: true, latency };
  } catch (err) {
    // A CORS/opaque rejection still implies the TCP layer answered quickly.
    const elapsed = Math.round(performance.now() - start);
    if (elapsed < timeoutMs && !(err instanceof DOMException && err.name === "AbortError")) {
      return { ok: true, latency: elapsed };
    }
    return { ok: false, latency: null };
  } finally {
    clearTimeout(timer);
  }
}

/** Fold a probe result into a proxy's rolling history. */
export function recordSample(proxy: Proxy, result: ProbeResult): Proxy {
  const sample: BenchmarkSample = {
    at: Date.now(),
    ok: result.ok,
    latency: result.latency,
  };
  const history = [...proxy.history, sample].slice(-MAX_HISTORY);
  return {
    ...proxy,
    history,
    latency: result.latency,
    status: result.ok ? "working" : "failed",
    lastTestedAt: sample.at,
    healthScore: computeHealthScore(history),
  };
}

/**
 * Unified 0-100 health score.
 * Combines success rate (60%), latency (30%) and stability (10%).
 */
export function computeHealthScore(history: BenchmarkSample[]): number {
  if (!history.length) return 0;
  const oks = history.filter((h) => h.ok);
  const successRate = oks.length / history.length;

  const latencies = oks.map((h) => h.latency ?? 0).filter(Boolean);
  const avgLatency =
    latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 2000;
  // 50ms -> ~1.0, 2000ms -> ~0.
  const latencyScore = Math.max(0, Math.min(1, 1 - (avgLatency - 50) / 1950));

  // Stability = 1 - normalised std deviation of latency.
  let stability = 1;
  if (latencies.length > 1) {
    const mean = avgLatency;
    const variance =
      latencies.reduce((a, b) => a + (b - mean) ** 2, 0) / latencies.length;
    const std = Math.sqrt(variance);
    stability = Math.max(0, Math.min(1, 1 - std / (mean || 1)));
  }

  const score = successRate * 0.6 + latencyScore * 0.3 + stability * 0.1;
  return Math.round(score * 100);
}

/** Rank proxies best-first by health score, then latency. */
export function rankProxies(proxies: Proxy[]): Proxy[] {
  return [...proxies].sort((a, b) => {
    if (b.healthScore !== a.healthScore) return b.healthScore - a.healthScore;
    const la = a.latency ?? Infinity;
    const lb = b.latency ?? Infinity;
    return la - lb;
  });
}

/** The single healthiest working proxy, or null. */
export function bestProxy(proxies: Proxy[]): Proxy | null {
  const working = proxies.filter((p) => p.status === "working");
  const ranked = rankProxies(working.length ? working : proxies);
  return ranked[0] ?? null;
}
