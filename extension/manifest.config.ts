import { defineManifest } from "@crxjs/vite-plugin";

// Chrome Manifest V3 definition for ProxyPilot.
// Permissions are intentionally minimal: only what is required to manage
// the proxy, persist config locally and talk to the native engine.
export default defineManifest({
  manifest_version: 3,
  name: "ProxyPilot",
  version: "1.0.0",
  description:
    "Intelligently discover, benchmark, rank and switch between multi-protocol proxy servers.",
  icons: {
    16: "icons/icon16.png",
    48: "icons/icon48.png",
    128: "icons/icon128.png",
  },
  action: {
    default_popup: "index.html",
    default_title: "ProxyPilot",
    default_icon: {
      16: "icons/icon16.png",
      48: "icons/icon48.png",
      128: "icons/icon128.png",
    },
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  permissions: [
    "proxy",
    "storage",
    "alarms",
    "clipboardRead",
    "nativeMessaging",
    "tabs",
  ],
  host_permissions: ["<all_urls>"],
  minimum_chrome_version: "116",
});
