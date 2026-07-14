// ---------------------------------------------------------------------------
// Core config generation.
//
// The engine delegates the heavy protocol work to a proven core binary
// (sing-box preferred, Xray-core supported). This module:
//   1. Locates the core binary (sing-box in engine/core/ is the default).
//   2. Detects the flavour and produces a matching config JSON.
//   3. Exposes a local SOCKS5 inbound that Chrome's proxy points to.
// ---------------------------------------------------------------------------

import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Resolve the core binary path.
 * Order: env override → engine/core/sing-box → engine/core/xray →
 * engine/sing-box → engine/xray. sing-box wins by default because that's
 * what the installer instructions recommend.
 */
export function resolveCorePath() {
  if (process.env.PROXYPILOT_CORE && existsSync(process.env.PROXYPILOT_CORE)) {
    return process.env.PROXYPILOT_CORE;
  }
  const exe = process.platform === "win32" ? ".exe" : "";
  const candidates = [
    join(HERE, "..", "core", `sing-box${exe}`),
    join(HERE, "..", "core", `xray${exe}`),
    join(HERE, "..", `sing-box${exe}`),
    join(HERE, "..", `xray${exe}`),
  ];
  return candidates.find(existsSync) ?? null;
}

/** true when the resolved binary is sing-box (default). */
export function isSingBox(corePath) {
  return /sing-?box/i.test(basename(corePath || ""));
}

/** Route to the right config builder based on the binary. */
export function buildCoreConfig(proxy, localPort, corePath) {
  return isSingBox(corePath)
    ? buildSingBoxConfig(proxy, localPort)
    : buildXrayConfig(proxy, localPort);
}

/** CLI args to invoke the core with a config file. */
export function coreArgs(corePath, configPath) {
  return isSingBox(corePath) ? ["run", "-c", configPath] : ["-c", configPath];
}

function e(proxy, key, fallback = "") {
  return proxy.auth?.extra?.[key] ?? fallback;
}

// =========================================================================
// sing-box (default)
// =========================================================================

export function buildSingBoxConfig(proxy, localPort) {
  return {
    log: { level: "warn" },
    inbounds: [
      {
        type: "socks",
        tag: "socks-in",
        listen: "127.0.0.1",
        listen_port: localPort,
        sniff: true,
      },
    ],
    outbounds: [
      { ...singBoxOutbound(proxy), tag: "proxy" },
      { type: "direct", tag: "direct" },
      { type: "block", tag: "block" },
    ],
    route: { final: "proxy" },
  };
}

function singBoxTransport(proxy) {
  const net = e(proxy, "net", e(proxy, "type", "tcp"));
  if (net === "ws") {
    return { type: "ws", path: e(proxy, "path", "/"), headers: { Host: e(proxy, "host", proxy.host) } };
  }
  if (net === "grpc") {
    return { type: "grpc", service_name: e(proxy, "serviceName", e(proxy, "path", "")) };
  }
  if (net === "h2" || net === "http") {
    return { type: "http", path: e(proxy, "path", "/"), host: [e(proxy, "host", proxy.host)] };
  }
  return undefined;
}

function singBoxTls(proxy, forceServerName) {
  const security = e(proxy, "tls") || e(proxy, "security");
  if (!security && !forceServerName) return undefined;
  return {
    enabled: true,
    server_name: e(proxy, "sni", e(proxy, "host", proxy.host)),
    insecure: e(proxy, "insecure") === "1" || e(proxy, "allowInsecure") === "1",
    alpn: e(proxy, "alpn") ? String(e(proxy, "alpn")).split(",") : undefined,
  };
}

function singBoxOutbound(proxy) {
  const server = proxy.host;
  const server_port = Number(proxy.port);

  switch (proxy.protocol) {
    case "vmess":
      return {
        type: "vmess",
        server,
        server_port,
        uuid: e(proxy, "uuid"),
        security: "auto",
        alter_id: Number(e(proxy, "alterId", "0")),
        transport: singBoxTransport(proxy),
        tls: singBoxTls(proxy),
      };
    case "vless":
      return {
        type: "vless",
        server,
        server_port,
        uuid: e(proxy, "uuid"),
        flow: e(proxy, "flow") || undefined,
        packet_encoding: "xudp",
        transport: singBoxTransport(proxy),
        tls: singBoxTls(proxy, true),
      };
    case "trojan":
      return {
        type: "trojan",
        server,
        server_port,
        password: proxy.auth?.password ?? "",
        transport: singBoxTransport(proxy),
        tls: singBoxTls(proxy, true),
      };
    case "shadowsocks":
      return {
        type: "shadowsocks",
        server,
        server_port,
        method: e(proxy, "method", "aes-256-gcm"),
        password: proxy.auth?.password ?? "",
      };
    case "shadowsocksr":
      return {
        type: "shadowsocksr",
        server,
        server_port,
        method: e(proxy, "method", "aes-256-cfb"),
        password: proxy.auth?.password ?? "",
        obfs: e(proxy, "obfs", "plain"),
        protocol: e(proxy, "protocol", "origin"),
      };
    case "hysteria":
      return {
        type: "hysteria",
        server,
        server_port,
        auth_str: proxy.auth?.password ?? e(proxy, "auth"),
        up_mbps: Number(e(proxy, "upmbps", "50")) || 50,
        down_mbps: Number(e(proxy, "downmbps", "100")) || 100,
        tls: { enabled: true, server_name: e(proxy, "sni", server), insecure: e(proxy, "insecure") === "1" },
      };
    case "hysteria2":
      return {
        type: "hysteria2",
        server,
        server_port,
        password: proxy.auth?.password ?? e(proxy, "auth"),
        tls: { enabled: true, server_name: e(proxy, "sni", server), insecure: e(proxy, "insecure") === "1" },
      };
    case "tuic":
      return {
        type: "tuic",
        server,
        server_port,
        uuid: e(proxy, "uuid"),
        password: proxy.auth?.password ?? "",
        congestion_control: e(proxy, "congestion_control", "bbr"),
        tls: { enabled: true, server_name: e(proxy, "sni", server), insecure: e(proxy, "insecure") === "1" },
      };
    case "socks5":
      return {
        type: "socks",
        server,
        server_port,
        version: "5",
        username: proxy.auth?.username || undefined,
        password: proxy.auth?.password || undefined,
      };
    case "http":
    case "https":
      return {
        type: "http",
        server,
        server_port,
        username: proxy.auth?.username || undefined,
        password: proxy.auth?.password || undefined,
        tls: proxy.protocol === "https" ? { enabled: true, server_name: server } : undefined,
      };
    default:
      return { type: "direct" };
  }
}

// =========================================================================
// Xray (fallback)
// =========================================================================

export function buildXrayConfig(proxy, localPort) {
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
    outbounds: [xrayOutbound(proxy)],
  };
}

function xrayStream(proxy) {
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

function xrayOutbound(proxy) {
  const address = proxy.host;
  const port = Number(proxy.port);
  switch (proxy.protocol) {
    case "vmess":
      return { tag: "out", protocol: "vmess", settings: { vnext: [{ address, port, users: [{ id: e(proxy, "uuid"), alterId: Number(e(proxy, "alterId", "0")), security: "auto" }] }] }, streamSettings: xrayStream(proxy) };
    case "vless":
      return { tag: "out", protocol: "vless", settings: { vnext: [{ address, port, users: [{ id: e(proxy, "uuid"), encryption: e(proxy, "encryption", "none"), flow: e(proxy, "flow") }] }] }, streamSettings: xrayStream(proxy) };
    case "trojan":
      return { tag: "out", protocol: "trojan", settings: { servers: [{ address, port, password: proxy.auth?.password ?? "" }] }, streamSettings: xrayStream(proxy) };
    case "shadowsocks":
      return { tag: "out", protocol: "shadowsocks", settings: { servers: [{ address, port, method: e(proxy, "method", "aes-256-gcm"), password: proxy.auth?.password ?? "" }] } };
    case "socks5":
      return { tag: "out", protocol: "socks", settings: { servers: [{ address, port, users: proxy.auth?.username ? [{ user: proxy.auth.username, pass: proxy.auth.password ?? "" }] : undefined }] } };
    case "http":
    case "https":
      return { tag: "out", protocol: "http", settings: { servers: [{ address, port, users: proxy.auth?.username ? [{ user: proxy.auth.username, pass: proxy.auth.password ?? "" }] : undefined }] } };
    default:
      return { tag: "out", protocol: "freedom", settings: {} };
  }
}
