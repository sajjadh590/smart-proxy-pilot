// Core domain types for ProxyPilot.
// These are the single source of truth shared across the popup UI,
// the background service worker and the native-messaging bridge.

export type Protocol =
  | "socks5"
  | "http"
  | "https"
  | "vmess"
  | "vless"
  | "trojan"
  | "shadowsocks"
  | "shadowsocksr"
  | "hysteria"
  | "hysteria2"
  | "tuic";

/** Protocols Chrome can consume directly through the Proxy API. */
export const NATIVE_CHROME_PROTOCOLS: Protocol[] = ["socks5", "http", "https"];

/** Protocols that require the local ProxyPilot Engine to bridge. */
export const ENGINE_PROTOCOLS: Protocol[] = [
  "vmess",
  "vless",
  "trojan",
  "shadowsocks",
  "shadowsocksr",
  "hysteria",
  "hysteria2",
  "tuic",
];

export type ProxyStatus = "unknown" | "working" | "failed" | "testing";

export interface ProxyAuth {
  username?: string;
  password?: string;
  /** Protocol-specific auth material (uuid, method, sni, etc.). */
  extra?: Record<string, string>;
}

export interface Proxy {
  id: string;
  name: string;
  protocol: Protocol;
  host: string;
  port: number;
  auth?: ProxyAuth;
  country?: string;
  notes?: string;
  tags: string[];
  favorite: boolean;
  status: ProxyStatus;
  /** Round-trip latency in ms; null when unknown. */
  latency: number | null;
  /** 0-100 unified score. */
  healthScore: number;
  /** Where this proxy was imported from. */
  source: string;
  /** Raw import URI, kept for engine bridging & re-parsing. */
  raw?: string;
  createdAt: number;
  lastTestedAt?: number;
  /** Rolling benchmark history used for stability. */
  history: BenchmarkSample[];
}

export interface BenchmarkSample {
  at: number;
  ok: boolean;
  latency: number | null;
}

export interface DomainRule {
  id: string;
  pattern: string;
  enabled: boolean;
  priority: number;
  comment?: string;
  /** Optional: pin this rule to a specific proxy id. */
  proxyId?: string;
}

export interface Settings {
  autoSwitch: boolean;
  domainRoutingEnabled: boolean;
  /** ms per benchmark attempt before treating as timeout. */
  benchmarkTimeout: number;
  /** URL used to probe connectivity. */
  probeUrl: string;
  /** Local SOCKS5 endpoint exposed by the engine. */
  engineHost: string;
  enginePort: number;
  theme: "dark";
}

export interface AppState {
  proxies: Proxy[];
  rules: DomainRule[];
  settings: Settings;
  activeProxyId: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  autoSwitch: true,
  domainRoutingEnabled: false,
  benchmarkTimeout: 5000,
  probeUrl: "https://www.gstatic.com/generate_204",
  engineHost: "127.0.0.1",
  enginePort: 10808,
  theme: "dark",
};

export const DEFAULT_STATE: AppState = {
  proxies: [],
  rules: [],
  settings: DEFAULT_SETTINGS,
  activeProxyId: null,
};
