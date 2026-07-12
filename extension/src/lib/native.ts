import { Proxy, Settings, ENGINE_PROTOCOLS } from "./types";

// Native Messaging bridge to the ProxyPilot Engine.
//
// The engine is a lightweight local host (see /engine) that speaks the Chrome
// native-messaging protocol. It bridges protocols Chrome cannot use directly
// (VMess, VLESS, Trojan, Shadowsocks(R), Hysteria(2), TUIC) and exposes a
// local SOCKS5 endpoint that the extension then points Chrome's proxy at.

export const NATIVE_HOST = "com.proxypilot.engine";

export interface EngineRequest {
  id: string;
  type:
    | "ping"
    | "start"
    | "stop"
    | "status"
    | "probe";
  proxy?: SerializedProxy;
  port?: number;
}

export interface EngineResponse {
  id: string;
  ok: boolean;
  version?: string;
  running?: boolean;
  localPort?: number;
  latency?: number | null;
  error?: string;
}

export interface SerializedProxy {
  protocol: string;
  host: string;
  port: number;
  raw?: string;
  auth?: Proxy["auth"];
}

function reqId(): string {
  return Math.random().toString(36).slice(2);
}

function serialize(p: Proxy): SerializedProxy {
  return {
    protocol: p.protocol,
    host: p.host,
    port: p.port,
    raw: p.raw,
    auth: p.auth,
  };
}

/** Whether a proxy needs the engine to be usable by Chrome. */
export function needsEngine(p: Proxy): boolean {
  return ENGINE_PROTOCOLS.includes(p.protocol);
}

function sendNative(req: EngineRequest): Promise<EngineResponse> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendNativeMessage(NATIVE_HOST, req, (res) => {
        if (chrome.runtime.lastError || !res) {
          resolve({
            id: req.id,
            ok: false,
            error: chrome.runtime.lastError?.message ?? "No response from engine",
          });
        } else {
          resolve(res as EngineResponse);
        }
      });
    } catch (e) {
      resolve({ id: req.id, ok: false, error: String(e) });
    }
  });
}

export async function pingEngine(): Promise<EngineResponse> {
  return sendNative({ id: reqId(), type: "ping" });
}

/**
 * Ask the engine to bring up a local SOCKS5 tunnel for `proxy`.
 * Returns the local port Chrome should route through.
 */
export async function startTunnel(
  proxy: Proxy,
  settings: Settings,
): Promise<EngineResponse> {
  return sendNative({
    id: reqId(),
    type: "start",
    proxy: serialize(proxy),
    port: settings.enginePort,
  });
}

export async function stopTunnel(): Promise<EngineResponse> {
  return sendNative({ id: reqId(), type: "stop" });
}

/** Real end-to-end probe performed by the engine through the tunnel. */
export async function engineProbe(proxy: Proxy): Promise<EngineResponse> {
  return sendNative({ id: reqId(), type: "probe", proxy: serialize(proxy) });
}
