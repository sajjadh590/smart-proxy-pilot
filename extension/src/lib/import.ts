import { Proxy } from "./types";
import { parseBlob } from "./parsers";

// Import Manager: turns any supported source into a list of parsed proxies.
// All fetching happens locally in the browser; nothing is uploaded.

export type ImportSource =
  | { kind: "url"; value: string }
  | { kind: "gist"; value: string }
  | { kind: "text"; value: string }
  | { kind: "clipboard" }
  | { kind: "file"; value: string; filename: string };

export interface ImportResult {
  parsed: Proxy[];
  raw: string;
  sourceLabel: string;
}

/** Normalise a GitHub gist URL into its raw endpoint when possible. */
function normalizeGist(url: string): string {
  // https://gist.github.com/user/id -> raw endpoint
  if (url.includes("gist.githubusercontent.com")) return url;
  const m = url.match(/gist\.github\.com\/([^/]+)\/([a-f0-9]+)/i);
  if (m) return `https://gist.githubusercontent.com/${m[1]}/${m[2]}/raw`;
  return url;
}

/** Convert a github.com blob URL into raw.githubusercontent.com. */
function normalizeGithub(url: string): string {
  const m = url.match(/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)/);
  if (m) return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`;
  return url;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url}`);
  return res.text();
}

export async function runImport(source: ImportSource): Promise<ImportResult> {
  switch (source.kind) {
    case "url": {
      const url = normalizeGithub(source.value);
      const raw = await fetchText(url);
      return { parsed: parseBlob(raw, url), raw, sourceLabel: url };
    }
    case "gist": {
      const url = normalizeGist(source.value);
      const raw = await fetchText(url);
      return { parsed: parseBlob(raw, url), raw, sourceLabel: url };
    }
    case "text": {
      return {
        parsed: parseBlob(source.value, "text"),
        raw: source.value,
        sourceLabel: "Pasted text",
      };
    }
    case "clipboard": {
      const raw = await navigator.clipboard.readText();
      return {
        parsed: parseBlob(raw, "clipboard"),
        raw,
        sourceLabel: "Clipboard",
      };
    }
    case "file": {
      return {
        parsed: parseBlob(source.value, source.filename),
        raw: source.value,
        sourceLabel: source.filename,
      };
    }
  }
}
