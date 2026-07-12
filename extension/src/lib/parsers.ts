import { Protocol, Proxy } from "./types";

// ---------------------------------------------------------------------------
// Protocol parsers.
// Each parser turns a single share-link / config string into a Proxy object.
// A permissive detector routes each line to the right parser.
// ---------------------------------------------------------------------------

let counter = 0;
export function uid(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

function baseProxy(partial: Partial<Proxy> & { protocol: Protocol; host: string; port: number }): Proxy {
  return {
    id: uid(),
    name: partial.name || `${partial.protocol}-${partial.host}`,
    protocol: partial.protocol,
    host: partial.host,
    port: partial.port,
    auth: partial.auth,
    country: partial.country,
    notes: partial.notes,
    tags: partial.tags ?? [],
    favorite: false,
    status: "unknown",
    latency: null,
    healthScore: 0,
    source: partial.source ?? "manual",
    raw: partial.raw,
    createdAt: Date.now(),
    history: [],
  };
}

function b64decode(s: string): string {
  const norm = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = norm + "=".repeat((4 - (norm.length % 4)) % 4);
  try {
    return decodeURIComponent(escape(atob(pad)));
  } catch {
    return atob(pad);
  }
}

function isB64(s: string): boolean {
  return /^[A-Za-z0-9+/_=-]+$/.test(s.trim()) && s.trim().length % 4 !== 1;
}

// ---- Individual protocol parsers -----------------------------------------

/** ss://method:pass@host:port#name  OR  ss://base64(method:pass)@host:port */
function parseShadowsocks(uri: string, source: string): Proxy | null {
  try {
    const url = new URL(uri);
    const name = decodeURIComponent(url.hash.slice(1));
    let method = "";
    let password = "";
    if (url.username && !url.password) {
      const decoded = b64decode(url.username);
      [method, password] = decoded.split(":");
    } else {
      method = decodeURIComponent(url.username);
      password = decodeURIComponent(url.password);
    }
    return baseProxy({
      protocol: "shadowsocks",
      host: url.hostname,
      port: Number(url.port),
      name: name || undefined,
      auth: { password, extra: { method } },
      raw: uri,
      source,
    });
  } catch {
    return null;
  }
}

/** ssr://base64(host:port:proto:method:obfs:base64pass/?params) */
function parseSSR(uri: string, source: string): Proxy | null {
  try {
    const body = b64decode(uri.slice("ssr://".length));
    const [main, query = ""] = body.split("/?");
    const parts = main.split(":");
    if (parts.length < 6) return null;
    const [host, port, proto, method, obfs, passB64] = parts;
    const params = new URLSearchParams(query);
    return baseProxy({
      protocol: "shadowsocksr",
      host,
      port: Number(port),
      name: params.get("remarks") ? b64decode(params.get("remarks")!) : undefined,
      auth: {
        password: b64decode(passB64),
        extra: { method, protocol: proto, obfs },
      },
      raw: uri,
      source,
    });
  } catch {
    return null;
  }
}

/** vmess://base64(json) */
function parseVMess(uri: string, source: string): Proxy | null {
  try {
    const json = JSON.parse(b64decode(uri.slice("vmess://".length)));
    return baseProxy({
      protocol: "vmess",
      host: json.add,
      port: Number(json.port),
      name: json.ps,
      auth: {
        extra: {
          uuid: json.id,
          alterId: String(json.aid ?? 0),
          net: json.net ?? "tcp",
          tls: json.tls ?? "",
          sni: json.sni ?? json.host ?? "",
          path: json.path ?? "",
        },
      },
      raw: uri,
      source,
    });
  } catch {
    return null;
  }
}

/** vless://uuid@host:port?params#name  and trojan:// share this shape. */
function parseUserHostUri(
  uri: string,
  protocol: Protocol,
  source: string,
): Proxy | null {
  try {
    const url = new URL(uri);
    const params = url.searchParams;
    const extra: Record<string, string> = {};
    params.forEach((v, k) => (extra[k] = v));
    if (protocol === "vless" || protocol === "tuic") extra.uuid = decodeURIComponent(url.username);
    return baseProxy({
      protocol,
      host: url.hostname,
      port: Number(url.port),
      name: decodeURIComponent(url.hash.slice(1)) || undefined,
      auth: {
        password:
          protocol === "trojan" || protocol === "hysteria" || protocol === "hysteria2"
            ? decodeURIComponent(url.username)
            : undefined,
        extra,
      },
      raw: uri,
      source,
    });
  } catch {
    return null;
  }
}

/** socks5://user:pass@host:port  / http:// / https:// */
function parsePlain(uri: string, protocol: Protocol, source: string): Proxy | null {
  try {
    const url = new URL(uri);
    return baseProxy({
      protocol,
      host: url.hostname,
      port: Number(url.port) || (protocol === "https" ? 443 : protocol === "http" ? 80 : 1080),
      name: decodeURIComponent(url.hash.slice(1)) || undefined,
      auth:
        url.username || url.password
          ? {
              username: decodeURIComponent(url.username),
              password: decodeURIComponent(url.password),
            }
          : undefined,
      raw: uri,
      source,
    });
  } catch {
    return null;
  }
}

/** host:port:user:pass  (common txt list format, assumed socks5) */
function parseColonList(line: string, source: string): Proxy | null {
  const parts = line.split(":");
  if (parts.length < 2) return null;
  const [host, port, username, password] = parts;
  if (!host || !/^\d+$/.test(port)) return null;
  return baseProxy({
    protocol: "socks5",
    host,
    port: Number(port),
    auth: username ? { username, password } : undefined,
    source,
  });
}

// ---- Dispatcher ----------------------------------------------------------

export function parseLine(rawLine: string, source = "import"): Proxy | null {
  const line = rawLine.trim();
  if (!line || line.startsWith("#") || line.startsWith("//")) return null;

  const scheme = line.split("://")[0]?.toLowerCase();
  switch (scheme) {
    case "ss":
      return parseShadowsocks(line, source);
    case "ssr":
      return parseSSR(line, source);
    case "vmess":
      return parseVMess(line, source);
    case "vless":
      return parseUserHostUri(line, "vless", source);
    case "trojan":
      return parseUserHostUri(line, "trojan", source);
    case "tuic":
      return parseUserHostUri(line, "tuic", source);
    case "hysteria":
      return parseUserHostUri(line, "hysteria", source);
    case "hysteria2":
    case "hy2":
      return parseUserHostUri(line.replace(/^hy2:/, "hysteria2:"), "hysteria2", source);
    case "socks5":
    case "socks":
      return parsePlain(line, "socks5", source);
    case "http":
      return parsePlain(line, "http", source);
    case "https":
      return parsePlain(line, "https", source);
    default:
      return parseColonList(line, source);
  }
}

/**
 * Parse an arbitrary blob (txt list, JSON array, or base64 subscription).
 * Auto-detects the container format, then parses each entry.
 */
export function parseBlob(blob: string, source = "import"): Proxy[] {
  const text = blob.trim();
  const out: Proxy[] = [];

  // JSON array of proxies or raw configs.
  if (text.startsWith("[") || text.startsWith("{")) {
    try {
      const data = JSON.parse(text);
      const arr = Array.isArray(data) ? data : [data];
      for (const item of arr) {
        if (typeof item === "string") {
          const p = parseLine(item, source);
          if (p) out.push(p);
        } else if (item?.host && item?.protocol) {
          out.push(
            baseProxy({
              protocol: item.protocol,
              host: item.host,
              port: Number(item.port),
              name: item.name,
              auth: item.auth,
              country: item.country,
              tags: item.tags,
              source,
            }),
          );
        }
      }
      if (out.length) return out;
    } catch {
      /* fall through */
    }
  }

  // Base64 subscription (single blob) -> decode then re-split.
  const singleLine = text.split(/\r?\n/).length === 1;
  if (singleLine && isB64(text) && !text.includes("://")) {
    const decoded = b64decode(text);
    if (decoded.includes("://") || decoded.includes("\n")) {
      return parseBlob(decoded, source);
    }
  }

  // Plain line list.
  for (const line of text.split(/\r?\n/)) {
    const p = parseLine(line, source);
    if (p) out.push(p);
  }
  return out;
}
