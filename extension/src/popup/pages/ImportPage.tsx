import { useRef, useState } from "react";
import { Github, Clipboard, FileText, Link2, Upload, Plus } from "lucide-react";
import { runImport, ImportSource } from "@/lib/import";
import { upsertProxies } from "@/lib/storage";
import { uid } from "@/lib/parsers";
import { Protocol, Proxy } from "@/lib/types";
import { Button } from "../components/ui";

const PROTOCOLS: Protocol[] = [
  "socks5",
  "http",
  "https",
  "vmess",
  "vless",
  "trojan",
  "shadowsocks",
  "shadowsocksr",
  "hysteria",
  "hysteria2",
  "tuic",
];

export function ImportPage() {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<Proxy[]>([]);

  // Manual proxy form state.
  const [mProto, setMProto] = useState<Protocol>("socks5");
  const [mHost, setMHost] = useState("");
  const [mPort, setMPort] = useState("");
  const [mUser, setMUser] = useState("");
  const [mPass, setMPass] = useState("");
  const [mName, setMName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function doImport(source: ImportSource) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await runImport(source);
      if (res.parsed.length === 0) {
        setMsg("No valid proxies found in source.");
        setPreview([]);
        return;
      }
      const added = await upsertProxies(res.parsed);
      setPreview(res.parsed);
      setMsg(`Parsed ${res.parsed.length} · added ${added} · ${res.parsed.length - added} duplicates skipped.`);
    } catch (e) {
      setMsg(`Error: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      doImport({ kind: "file", value: String(reader.result), filename: file.name });
    reader.readAsText(file);
  }

  async function addManualProxy() {
    if (!mHost.trim() || !mPort.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const proxy: Proxy = {
        id: uid(),
        name: mName.trim() || `${mProto}-${mHost.trim()}`,
        protocol: mProto,
        host: mHost.trim(),
        port: Number(mPort),
        auth: mUser || mPass ? { username: mUser || undefined, password: mPass || undefined } : undefined,
        tags: [],
        favorite: false,
        status: "unknown",
        latency: null,
        healthScore: 0,
        source: "manual",
        createdAt: Date.now(),
        history: [],
      };
      const added = await upsertProxies([proxy]);
      setMsg(added ? `Added ${mProto}://${mHost}:${mPort}.` : "Duplicate — proxy already exists.");
      if (added) {
        setMHost(""); setMPort(""); setMUser(""); setMPass(""); setMName("");
      }
    } finally {
      setBusy(false);
    }
  }

  const isGist = url.includes("gist.github.com") || url.includes("gist.githubusercontent.com");

  return (
    <div className="space-y-4">
      <div className="pp-card space-y-2 p-3">
        <div className="flex items-center gap-2 text-[11px] text-[--color-muted]">
          {isGist ? <Github size={13} /> : <Link2 size={13} />} URL / GitHub Raw / Gist
        </div>
        <input
          className="pp-input"
          placeholder="https://raw.githubusercontent.com/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button
          variant="primary"
          className="w-full"
          disabled={!url || busy}
          onClick={() => doImport({ kind: isGist ? "gist" : "url", value: url })}
        >
          Fetch & Import
        </Button>
      </div>

      <div className="pp-card space-y-2 p-3">
        <div className="flex items-center gap-2 text-[11px] text-[--color-muted]">
          <FileText size={13} /> Paste TXT / JSON / Subscription
        </div>
        <textarea
          className="pp-input h-24 resize-none font-mono text-[11px]"
          placeholder="vmess://…&#10;ss://…&#10;socks5://user:pass@host:port"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex gap-2">
          <Button className="flex-1" disabled={!text || busy} onClick={() => doImport({ kind: "text", value: text })}>
            Import text
          </Button>
          <Button className="flex items-center gap-1" disabled={busy} onClick={() => doImport({ kind: "clipboard" })}>
            <Clipboard size={12} /> Clipboard
          </Button>
        </div>
      </div>

      <div className="pp-card space-y-2 p-3">
        <div className="flex items-center gap-2 text-[11px] text-[--color-muted]">
          <Upload size={13} /> Local file (.txt / .json)
        </div>
        <input ref={fileRef} type="file" accept=".txt,.json,.conf" className="hidden" onChange={onFile} />
        <Button className="w-full" disabled={busy} onClick={() => fileRef.current?.click()}>
          Choose file
        </Button>
      </div>

      <div className="pp-card space-y-2 p-3">
        <div className="flex items-center gap-2 text-[11px] text-[--color-muted]">
          <Plus size={13} /> Add a single proxy manually
        </div>
        <div className="grid grid-cols-3 gap-2">
          <select
            className="pp-input col-span-1"
            value={mProto}
            onChange={(e) => setMProto(e.target.value as Protocol)}
          >
            {PROTOCOLS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <input
            className="pp-input col-span-2"
            placeholder="host"
            value={mHost}
            onChange={(e) => setMHost(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            className="pp-input"
            placeholder="port"
            inputMode="numeric"
            value={mPort}
            onChange={(e) => setMPort(e.target.value)}
          />
          <input
            className="pp-input"
            placeholder="label (optional)"
            value={mName}
            onChange={(e) => setMName(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            className="pp-input"
            placeholder="username (optional)"
            value={mUser}
            onChange={(e) => setMUser(e.target.value)}
          />
          <input
            className="pp-input"
            placeholder="password (optional)"
            type="password"
            value={mPass}
            onChange={(e) => setMPass(e.target.value)}
          />
        </div>
        <Button
          variant="primary"
          className="w-full flex items-center justify-center gap-1"
          disabled={busy || !mHost || !mPort}
          onClick={addManualProxy}
        >
          <Plus size={13} /> Add proxy
        </Button>
      </div>

      {msg && <div className="pp-card p-3 text-[11px] text-[--color-fg]">{msg}</div>}

      {preview.length > 0 && (
        <div className="pp-card max-h-40 space-y-1 overflow-y-auto p-3 text-[10px] text-[--color-muted]">
          {preview.slice(0, 30).map((p) => (
            <div key={p.id} className="truncate">
              <span className="text-[--color-primary]">{p.protocol}</span> {p.host}:{p.port}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
