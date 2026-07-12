// ---------------------------------------------------------------------------
// Core config generation.
//
// The engine delegates the heavy protocol work to a proven core binary
// (Xray-core or sing-box). This module:
//   1. Locates the core binary.
//   2. Translates a ProxyPilot proxy object into an outbound config plus a
//      local SOCKS5 inbound.
//
// Keeping this isolated means adding/altering protocol support never touches
// the native-messaging transport in index.js (clean architecture boundary).
// ---------------------------------------------------------------------------

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Resolve the core binary path (env override, then bundled locations). */
export function resolveCorePath() {
  if (process.env.PROXYPILOT_CORE && existsSync(process.env.PROXYPILOT_CORE)) {
    return process.env.PROXYPILOT_CORE;
  }
  const exe = process.platform === "win32" ? ".exe" : "";
  const candidates = [
    join(HERE, "..", "core", `xray${exe}`),
    join(HERE, "..", "core", `sing-box${exe}`),
    join(HERE, "..", `xray${exe}`),
  ];
  return candidates.find(existsSync) ?? null;
}

/** Build an Xray-compatible config: SOCKS5 inbound -> protocol outbound. */
export function buildCoreConfig(proxy, localPort) {
  return {
    log: { loglevel: "warning" },
    inbounds: [
      {
        tag: "socks-in",
        port: localPort,
        listen: "127.0.0.1",
        protocol: "socks",
        settings: { udp: true, auth: "noauth" },
      },
    ],
    outbounds: [buildOutbound(proxy)],
  };
}

function e(proxy, key, fallback = "") {
  return proxy.auth?.extra?.[key] ?? fallback;
}

function streamSettings(proxy) {
  const net = e(proxy, "net", e(proxy, "type", "tcp"));
  const security = e(proxy, "tls") || e(proxy, "security");
  const ss = { network: net };
  if (security === "tls" || security === "reality" || proxy.protocol === "trojan") {
    ss.security = security || "tls";
    ss.tlsSettings = { serverName: e(proxy, "sni", proxy.host), allowInsecure: false };
  }
  if (net === "ws") ss.wsSettings = { path: e(proxy, "path", "/"), headers: { Host: e(proxy, "host", proxy.host) } };
  if (net === "grpc") ss.grpcSettings = { serviceName: e(proxy, "serviceName", e(proxy, "path", "")) };
  return ss;
}

function buildOutbound(proxy) {
  const address = proxy.host;
  const port = Number(proxy.port);

  switch (proxy.protocol) {
    case "vmess":
      return {
        tag: "out",
        protocol: "vmess",
        settings: {
          vnext: [{ address, port, users: [{ id: e(proxy, "uuid"), alterId: Number(e(proxy, "alterId", "0")), security: "auto" }] }],
        },
        streamSettings: streamSettings(proxy),
      };

    case "vless":
      return {
        tag: "out",
        protocol: "vless",
        settings: {
          vnext: [{ address, port, users: [{ id: e(proxy, "uuid"), encryption: e(proxy, "encryption", "none"), flow: e(proxy, "flow") }] }],
        },
        streamSettings: streamSettings(proxy),
      };

    case "trojan":
      return {
        tag: "out",
        protocol: "trojan",
        settings: { servers: [{ address, port, password: proxy.auth?.password ?? "" }] },
        streamSettings: streamSettings(proxy),
      };

    case "shadowsocks":
      return {
        tag: "out",
        protocol: "shadowsocks",
        settings: {
          servers: [{ address, port, method: e(proxy, "method", "aes-256-gcm"), password: proxy.auth?.password ?? "" }],
        },
      };

    case "shadowsocksr":
      // Requires an SSR-capable core; config mirrors shadowsocks with plugins.
      return {
        tag: "out",
        protocol: "shadowsocks",
        settings: {
          servers: [
            {
              address,
              port,
              method: e(proxy, "method", "aes-256-cfb"),
              password: proxy.auth?.password ?? "",
              plugin: "obfs-local",
              pluginOpts: `obfs=${e(proxy, "obfs", "plain")};protocol=${e(proxy, "protocol", "origin")}`,
            },
          ],
        },
      };

    case "hysteria":
    case "hysteria2":
      // Best handled by sing-box; shape kept for its outbound schema.
      return {
        tag: "out",
        type: proxy.protocol === "hysteria2" ? "hysteria2" : "hysteria",
        server: address,
        server_port: port,
        password: proxy.auth?.password ?? e(proxy, "auth"),
        tls: { enabled: true, server_name: e(proxy, "sni", address), insecure: e(proxy, "insecure") === "1" },
      };

    case "tuic":
      return {
        tag: "out",
        type: "tuic",
        server: address,
        server_port: port,
        uuid: e(proxy, "uuid"),
        password: proxy.auth?.password ?? "",
        tls: { enabled: true, server_name: e(proxy, "sni", address) },
      };

    case "socks5":
      return {
        tag: "out",
        protocol: "socks",
        settings: {
          servers: [
            {
              address,
              port,
              users: proxy.auth?.username ? [{ user: proxy.auth.username, pass: proxy.auth.password ?? "" }] : undefined,
            },
          ],
        },
      };

    case "http":
    case "https":
      return {
        tag: "out",
        protocol: "http",
        settings: {
          servers: [
            {
              address,
              port,
              users: proxy.auth?.username ? [{ user: proxy.auth.username, pass: proxy.auth.password ?? "" }] : undefined,
            },
          ],
        },
      };

    default:
      return { tag: "out", protocol: "freedom", settings: {} };
  }
}
