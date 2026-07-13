import { Proxy } from "./types";

// Message contract between the popup UI and the background service worker.
// The worker owns all side-effects (proxy switching, engine control,
// benchmarking loops) so the UI stays a thin, reactive layer.

export type UiToBg =
  | { type: "ACTIVATE"; proxyId: string }
  | { type: "DEACTIVATE" }
  | { type: "BENCHMARK_ALL" }
  | { type: "BENCHMARK_ONE"; proxyId: string }
  | { type: "RETEST_FAILED" }
  | { type: "AUTO_SELECT_BEST" }
  | { type: "REFRESH_CONFIG" }
  | { type: "REFRESH_SUBSCRIPTION"; subId: string }
  | { type: "REFRESH_ALL_SUBSCRIPTIONS" }
  | { type: "SYNC_SUB_ALARMS" }
  | { type: "ENGINE_PING" };

export interface BgResult {
  ok: boolean;
  error?: string;
  activeProxy?: Proxy | null;
  engineVersion?: string;
  engineRunning?: boolean;
  tested?: number;
  added?: number;
  removed?: number;
  total?: number;
}

export function sendToBackground(msg: UiToBg): Promise<BgResult> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (res: BgResult) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(res ?? { ok: false, error: "No response" });
      }
    });
  });
}
