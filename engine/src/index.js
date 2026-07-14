#!/usr/bin/env node
// ---------------------------------------------------------------------------
// ProxyPilot Engine
//
// A lightweight, GUI-less native-messaging host controlled entirely by the
// ProxyPilot Chrome extension. It bridges protocols Chrome cannot use
// directly (VMess, VLESS, Trojan, Shadowsocks(R), Hysteria(2), TUIC) by
// generating a config for a bundled core (xray/sing-box) and exposing a
// local SOCKS5 endpoint that the extension points Chrome's proxy at.
//
// Chrome native-messaging framing:
//   [uint32 little-endian length][utf8 JSON payload]
//
// The extension speaks the { id, type, proxy, port } request contract
// (see extension/src/lib/native.ts) and expects { id, ok, ... } responses.
// ---------------------------------------------------------------------------

import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { performance } from "node:perf_hooks";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildCoreConfig, resolveCorePath, coreArgs } from "./core.js";

const VERSION = "1.0.0";

/** @typedef {{id:string,type:string,proxy?:any,port?:number}} Req */

const state = {
  /** @type {import('node:child_process').ChildProcess|null} */
  core: null,
  localPort: 0,
  activeProxy: null,
};

// ---- stdio native-messaging transport ------------------------------------

function send(msg) {
  const json = Buffer.from(JSON.stringify(msg), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(json.length, 0);
  process.stdout.write(Buffer.concat([header, json]));
}

let buffer = Buffer.alloc(0);
process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (buffer.length >= 4) {
    const len = buffer.readUInt32LE(0);
    if (buffer.length < 4 + len) break;
    const payload = buffer.subarray(4, 4 + len);
    buffer = buffer.subarray(4 + len);
    try {
      handle(JSON.parse(payload.toString("utf8")));
    } catch (e) {
      send({ id: "?", ok: false, error: `Bad request: ${e}` });
    }
  }
});
process.stdin.on("end", () => stopCore());

// ---- core (xray/sing-box) lifecycle --------------------------------------

function stopCore() {
  if (state.core) {
    try {
      state.core.kill();
    } catch {}
    state.core = null;
    state.activeProxy = null;
  }
}

async function startCore(proxy, localPort) {
  stopCore();
  const corePath = resolveCorePath();
  if (!corePath) {
    throw new Error(
      "Core binary not found. Place xray (or sing-box) next to the engine or set PROXYPILOT_CORE.",
    );
  }
  const config = buildCoreConfig(proxy, localPort);
  const dir = mkdtempSync(join(tmpdir(), "proxypilot-"));
  const configPath = join(dir, "config.json");
  writeFileSync(configPath, JSON.stringify(config, null, 2));

  const args = corePath.includes("sing-box")
    ? ["run", "-c", configPath]
    : ["-c", configPath];

  state.core = spawn(corePath, args, { stdio: "ignore" });
  state.core.on("exit", () => {
    if (state.core) state.core = null;
  });
  state.localPort = localPort;
  state.activeProxy = proxy;

  // Give the core a moment to bind the local port.
  await waitForPort("127.0.0.1", localPort, 4000);
}

function waitForPort(host, port, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const sock = createConnection({ host, port }, () => {
        sock.destroy();
        resolve(true);
      });
      sock.on("error", () => {
        sock.destroy();
        if (Date.now() - start > timeoutMs) reject(new Error("core port timeout"));
        else setTimeout(attempt, 150);
      });
    };
    attempt();
  });
}

/** Measure TCP connect latency to the remote endpoint. */
function tcpLatency(host, port, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const sock = createConnection({ host, port });
    const timer = setTimeout(() => {
      sock.destroy();
      resolve({ ok: false, latency: null });
    }, timeoutMs);
    sock.on("connect", () => {
      clearTimeout(timer);
      sock.destroy();
      resolve({ ok: true, latency: Math.round(performance.now() - t0) });
    });
    sock.on("error", () => {
      clearTimeout(timer);
      resolve({ ok: false, latency: null });
    });
  });
}

// ---- request dispatch ----------------------------------------------------

async function handle(/** @type {Req} */ req) {
  const reply = (extra) => send({ id: req.id, ok: true, ...extra });
  const fail = (error) => send({ id: req.id, ok: false, error });

  try {
    switch (req.type) {
      case "ping":
        return reply({ version: VERSION, running: !!state.core, localPort: state.localPort });

      case "status":
        return reply({ running: !!state.core, localPort: state.localPort });

      case "start": {
        if (!req.proxy) return fail("Missing proxy");
        const port = req.port || 10808;
        await startCore(req.proxy, port);
        return reply({ running: true, localPort: port });
      }

      case "stop":
        stopCore();
        return reply({ running: false });

      case "probe": {
        if (!req.proxy) return fail("Missing proxy");
        const r = await tcpLatency(req.proxy.host, req.proxy.port, 5000);
        return reply(r);
      }

      default:
        return fail(`Unknown type: ${req.type}`);
    }
  } catch (e) {
    return fail(String(e?.message ?? e));
  }
}

process.on("SIGTERM", () => stopCore());
process.on("SIGINT", () => stopCore());
