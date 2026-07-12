#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Registers (or removes) the ProxyPilot Engine as a Chrome native-messaging
// host on Windows, macOS and Linux, and configures autostart on Windows.
//
// Usage:
//   node install/install.js            # install + enable autostart
//   node install/install.js --uninstall
//
// Set the allowed extension id via PROXYPILOT_EXT_ID (chrome://extensions).
// ---------------------------------------------------------------------------

import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOST_NAME = "com.proxypilot.engine";
const ENGINE_ENTRY = resolve(HERE, "..", "src", "index.js");
const NODE_BIN = process.execPath;
const EXT_ID = process.env.PROXYPILOT_EXT_ID || "REPLACE_WITH_EXTENSION_ID";
const uninstall = process.argv.includes("--uninstall");

function hostManifest(scriptPath) {
  return {
    name: HOST_NAME,
    description: "ProxyPilot Engine native messaging host",
    path: scriptPath,
    type: "stdio",
    allowed_origins: [`chrome-extension://${EXT_ID}/`],
  };
}

function chromeManifestDir() {
  const home = homedir();
  switch (platform()) {
    case "win32":
      return join(home, "AppData", "Local", "ProxyPilot");
    case "darwin":
      return join(home, "Library", "Application Support", "Google", "Chrome", "NativeMessagingHosts");
    default:
      return join(home, ".config", "google-chrome", "NativeMessagingHosts");
  }
}

function writeLauncher() {
  // A tiny launcher makes the manifest `path` a single executable that runs
  // `node index.js`, which is what Chrome expects.
  if (platform() === "win32") {
    const bat = join(chromeManifestDir(), "proxypilot-engine.bat");
    writeFileSync(bat, `@echo off\r\n"${NODE_BIN}" "${ENGINE_ENTRY}" %*\r\n`);
    return bat;
  }
  const sh = join(chromeManifestDir(), "proxypilot-engine.sh");
  writeFileSync(sh, `#!/usr/bin/env bash\nexec "${NODE_BIN}" "${ENGINE_ENTRY}" "$@"\n`, { mode: 0o755 });
  return sh;
}

function installWindowsAutostart(launcher) {
  // Silent autostart via HKCU Run key (no GUI, no admin needed).
  try {
    execSync(
      `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v ProxyPilotEngine /t REG_SZ /d "${launcher}" /f`,
      { stdio: "ignore" },
    );
  } catch (e) {
    console.warn("Autostart registration skipped:", String(e));
  }
}

function removeWindowsAutostart() {
  try {
    execSync(
      `reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v ProxyPilotEngine /f`,
      { stdio: "ignore" },
    );
  } catch {}
}

function installWindowsRegistry(manifestPath) {
  execSync(
    `reg add "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}" /ve /t REG_SZ /d "${manifestPath}" /f`,
    { stdio: "ignore" },
  );
}

function main() {
  const dir = chromeManifestDir();
  const manifestPath = join(dir, `${HOST_NAME}.json`);

  if (uninstall) {
    rmSync(manifestPath, { force: true });
    if (platform() === "win32") {
      removeWindowsAutostart();
      try {
        execSync(`reg delete "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}" /f`, { stdio: "ignore" });
      } catch {}
    }
    console.log("ProxyPilot Engine uninstalled.");
    return;
  }

  if (EXT_ID === "REPLACE_WITH_EXTENSION_ID") {
    console.error("Set PROXYPILOT_EXT_ID to your extension id first (see chrome://extensions).");
    process.exit(1);
  }

  mkdirSync(dir, { recursive: true });
  const launcher = writeLauncher();
  writeFileSync(manifestPath, JSON.stringify(hostManifest(launcher), null, 2));

  if (platform() === "win32") {
    installWindowsRegistry(manifestPath);
    installWindowsAutostart(launcher);
    console.log("Registered engine + enabled silent autostart (Windows).");
  } else {
    console.log("Registered native messaging host.");
  }

  if (!existsSync(ENGINE_ENTRY)) console.warn("Warning: engine entry not found at", ENGINE_ENTRY);
  console.log("Manifest:", manifestPath);
  console.log("Done. Reload the extension in chrome://extensions.");
}

main();
