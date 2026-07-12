# ProxyPilot

> Intelligently discover, import, benchmark, rank and switch between multi-protocol proxy servers — from a single, beautiful Chrome extension.

ProxyPilot keeps the user experience extremely simple while handling the messy
reality of modern proxy protocols under the hood. You never touch complicated
proxy software: import a list, hit **Auto-select best**, and browse.

```text
┌─────────────────────────────┐        Native Messaging        ┌──────────────────────────┐
│      Chrome Extension        │  ───────────────────────────▶ │     ProxyPilot Engine     │
│  (MV3 · React · TS · Vite)   │  { start, stop, probe, ping }  │  (local, GUI-less host)   │
│                             │  ◀─────────────────────────── │                          │
│  Dashboard · Manager ·       │     { ok, localPort, ... }    │  spawns xray / sing-box   │
│  Import · Benchmark ·        │                               │  ↳ local SOCKS5 :10808    │
│  Auto-Switch · Routing       │                               └──────────────┬───────────┘
│  chrome.proxy ───────────────┼──────────────────────────────────────────────┘
└─────────────────────────────┘         (fixed_servers / PAC)
```

## Why two components?

Chrome's `proxy` API can only speak **SOCKS5 / HTTP / HTTPS**. Everything else
(VMess, VLESS, Trojan, Shadowsocks(R), Hysteria(2), TUIC) is bridged by the
**ProxyPilot Engine**, a tiny local native-messaging host that brings up a
local SOCKS5 endpoint. Chrome then simply points at `127.0.0.1:10808`.

| Concern | Chrome Extension | ProxyPilot Engine |
| --- | --- | --- |
| UI, storage, benchmarking, routing | ✅ | — |
| Native protocols (SOCKS5/HTTP/HTTPS) | ✅ direct | — |
| Advanced protocols (VMess, VLESS, …) | control only | ✅ tunnels via core |
| Runs silently, autostarts on Windows | — | ✅ |

## Features

- **Import** from GitHub Raw URL, Gist, TXT, JSON, Clipboard or local file — auto
  protocol detection, parsing, validation and de-duplication.
- **Proxy Manager** — unlimited proxies with protocol, host, port, auth, country,
  notes, tags, favorites, status, latency, health score and source.
- **Benchmark** — test all, single, retest failed, auto-select best. Unified
  0–100 **Health Score** (success rate + latency + stability), auto-ranked.
- **Auto-Switch** — on failure, fail over to the healthiest endpoint; failed
  endpoints are retried on a schedule.
- **Domain Routing** — optional, disabled by default. PAC-based per-domain rules
  with enable/disable, priority and comments.
- **Search** by protocol, country, latency, health, tags and favorites.
- **Security** — no telemetry, no analytics, no cloud. Everything stays local.
  Credentials are never uploaded.
- **UI** — modern, minimal, fast, responsive, dark. Inspired by Arc, Raycast, Linear.

## Tech stack

Chrome Manifest V3 · TypeScript · React · Vite · TailwindCSS v4 ·
Chrome Storage API · Chrome Proxy API · Native Messaging · Node.js engine.

## Project structure

```text
extension/                 # Chrome MV3 extension
  manifest.config.ts       # MV3 manifest (via @crxjs)
  src/
    background/index.ts     # service worker: proxy switching, auto-switch, engine control
    lib/                    # clean-architecture core (framework-agnostic)
      types.ts  storage.ts  parsers.ts  import.ts
      benchmark.ts  native.ts  proxy-config.ts  messages.ts
    popup/                  # React UI
      pages/                # Dashboard, Proxies, Import, Benchmark, Routing, Settings
      components/           # ui primitives + ProxyRow
engine/                    # ProxyPilot Engine (native messaging host)
  src/index.js             # stdio transport + request dispatch
  src/core.js              # xray/sing-box config generation
  install/install.js       # cross-platform host registration + Windows autostart
docs/INSTALL.md            # installation guide
```

## Quick start

```bash
# 1. Build the extension
cd extension
bun install         # or npm install
bun run build       # outputs extension/dist

# 2. Load it in Chrome
#    chrome://extensions → Developer mode → Load unpacked → select extension/dist
#    Copy the assigned Extension ID.

# 3. Install the engine (enables advanced protocols)
cd ../engine
PROXYPILOT_EXT_ID=<your-extension-id> node install/install.js
#    Then drop an `xray` (or `sing-box`) binary in engine/core/ — see docs/INSTALL.md
```

See [docs/INSTALL.md](docs/INSTALL.md) for the full, platform-by-platform guide.

## Extensibility

Adding a protocol touches exactly two files:
`extension/src/lib/parsers.ts` (share-link → `Proxy`) and
`engine/src/core.js` (`Proxy` → core outbound). The transport, UI and storage
layers never change — that's the clean-architecture boundary.

## License

MIT — open-source friendly and built to be extended.
