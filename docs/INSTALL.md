# ProxyPilot — Installation Guide

ProxyPilot has two parts: the **Chrome extension** and the **ProxyPilot Engine**.
The extension alone fully supports SOCKS5 / HTTP / HTTPS proxies. Install the
engine to unlock VMess, VLESS, Trojan, Shadowsocks(R), Hysteria(2) and TUIC.

---

## 1. Build & load the extension

```bash
cd extension
bun install      # or: npm install / pnpm install
bun run build    # produces extension/dist
```

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select `extension/dist`.
4. Note the **Extension ID** shown on the card — you need it for the engine.

For live development instead of a static build:

```bash
bun run dev      # HMR-enabled; load extension/dist as unpacked
```

---

## 2. Install the ProxyPilot Engine

The engine is a Node.js native-messaging host (Node 18+ required).

```bash
cd engine
# Windows (PowerShell/CMD): registers host + enables silent autostart
set PROXYPILOT_EXT_ID=<your-extension-id> && node install/install.js
# macOS / Linux:
PROXYPILOT_EXT_ID=<your-extension-id> node install/install.js
```

This writes the native-messaging manifest to the correct per-user location:

| OS | Manifest location |
| --- | --- |
| Windows | `%LOCALAPPDATA%\ProxyPilot\com.proxypilot.engine.json` + HKCU registry |
| macOS | `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/` |
| Linux | `~/.config/google-chrome/NativeMessagingHosts/` |

On **Windows** it also adds an `HKCU\...\Run` entry so the engine starts
silently with the user session — no GUI, installed once.

### Provide a core binary

The engine bridges advanced protocols using a proven core. Download one and
place it here (or point `PROXYPILOT_CORE` at it):

```text
engine/core/sing-box     (default — sing-box.exe on Windows)
engine/core/xray         (fallback — xray.exe on Windows)
```

- Xray-core: https://github.com/XTLS/Xray-core/releases
- sing-box: https://github.com/SagerNet/sing-box/releases

```bash
# Optional explicit override:
export PROXYPILOT_CORE=/path/to/xray
```

---

## 3. Verify

1. Reload the extension in `chrome://extensions`.
2. Open the ProxyPilot popup → **Settings**. The **Engine** row should read
   `online · 1.0.0`.
3. **Import** some proxies → **Test → Benchmark all** → **Auto-select best**.

---

## Uninstall

```bash
cd engine
node install/install.js --uninstall   # removes host + Windows autostart
```

Then remove the extension from `chrome://extensions`.

---

## Troubleshooting

- **Engine offline** — confirm Node 18+ is installed and on `PATH`, the
  `PROXYPILOT_EXT_ID` matched your real extension id, and you reloaded the
  extension after registering the host.
- **Advanced proxy won't connect** — a core binary must exist in `engine/core/`
  (or via `PROXYPILOT_CORE`). Hysteria/TUIC need `sing-box`.
- **Native host not found** — the `allowed_origins` in the generated manifest
  must exactly match `chrome-extension://<id>/`. Re-run the installer with the
  correct id.

## Privacy

ProxyPilot performs **no telemetry, no analytics and has no cloud dependency**.
All proxies, credentials, rules and settings live in `chrome.storage.local` on
your machine and are never uploaded.
