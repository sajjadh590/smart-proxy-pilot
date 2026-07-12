import { Proxy, Settings, DomainRule } from "./types";
import { needsEngine } from "./native";

// Builds Chrome Proxy API configs.
//
// - Native protocols (socks5/http/https) point directly at the remote host.
// - Engine protocols point at the local SOCKS5 endpoint (127.0.0.1:enginePort)
//   which the ProxyPilot Engine has tunnelled.
// - When domain routing is enabled we emit a PAC script that sends only
//   matching domains through the proxy and everything else DIRECT.

function proxyEndpoint(proxy: Proxy, settings: Settings): { scheme: string; host: string; port: number } {
  if (needsEngine(proxy)) {
    return { scheme: "socks5", host: settings.engineHost, port: settings.enginePort };
  }
  const scheme = proxy.protocol === "https" ? "https" : proxy.protocol === "http" ? "http" : "socks5";
  return { scheme, host: proxy.host, port: proxy.port };
}

function pacScheme(scheme: string): string {
  switch (scheme) {
    case "socks5":
      return "SOCKS5";
    case "https":
      return "HTTPS";
    default:
      return "PROXY";
  }
}

/** Fixed-servers config: everything through the chosen proxy. */
export function buildFixedConfig(
  proxy: Proxy,
  settings: Settings,
): chrome.proxy.ProxyConfig {
  const ep = proxyEndpoint(proxy, settings);
  return {
    mode: "fixed_servers",
    rules: {
      singleProxy: { scheme: ep.scheme, host: ep.host, port: ep.port },
      bypassList: ["localhost", "127.0.0.1", "<local>"],
    },
  };
}

/** PAC config: only matching domain rules go through the proxy. */
export function buildPacConfig(
  proxy: Proxy,
  rules: DomainRule[],
  settings: Settings,
): chrome.proxy.ProxyConfig {
  const ep = proxyEndpoint(proxy, settings);
  const active = rules
    .filter((r) => r.enabled && r.pattern.trim())
    .sort((a, b) => b.priority - a.priority)
    .map((r) => r.pattern.trim().toLowerCase());

  const proxyLine = `${pacScheme(ep.scheme)} ${ep.host}:${ep.port}`;
  const patterns = JSON.stringify(active);

  const pac = `
function FindProxyForURL(url, host) {
  host = host.toLowerCase();
  var patterns = ${patterns};
  for (var i = 0; i < patterns.length; i++) {
    var p = patterns[i];
    if (host === p || dnsDomainIs(host, p) || shExpMatch(host, p) || shExpMatch(host, "*." + p)) {
      return "${proxyLine}";
    }
  }
  return "DIRECT";
}`.trim();

  return { mode: "pac_script", pacScript: { data: pac } };
}

export function buildConfig(
  proxy: Proxy,
  rules: DomainRule[],
  settings: Settings,
): chrome.proxy.ProxyConfig {
  return settings.domainRoutingEnabled && rules.some((r) => r.enabled)
    ? buildPacConfig(proxy, rules, settings)
    : buildFixedConfig(proxy, settings);
}
