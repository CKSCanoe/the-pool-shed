// Shared helpers for Phase 0 tools. Read-only against Supabase unless a script says otherwise.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Load KEY=value lines from .env.phase0.local (git-ignored) without ever printing values. */
export function loadEnv(file = path.join(ROOT, ".env.phase0.local")) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const key = line.slice(0, line.indexOf("=")).trim();
    let value = line.slice(line.indexOf("=") + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

export function need(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. Add it to .env.phase0.local (see scripts/phase0/README.md).`);
    process.exit(2);
  }
  return value;
}

export function supabase(prefix = "") {
  const url = need(prefix + "SUPABASE_URL").replace(/\/+$/, "");
  const key = need(prefix + "SUPABASE_SERVICE_ROLE_KEY");
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  async function call(method, pathname, { body, accept = "application/json", extra = {}, timeout = 120000, raw = false } = {}) {
    const response = await fetch(url + pathname, {
      method,
      headers: { ...headers, Accept: accept, ...(body ? { "Content-Type": "application/json" } : {}), ...extra },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeout)
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`${method} ${pathname} -> ${response.status} ${text.slice(0, 300)}`);
    }
    if (raw) return response;
    const type = response.headers.get("content-type") || "";
    return type.includes("json") ? response.json() : response.text();
  }
  return { url, call, host: new URL(url).host };
}

export const sha256 = (data) => crypto.createHash("sha256").update(data).digest("hex");

/** Stable JSON: object keys sorted, so the same data always hashes the same. */
export function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map((k) => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  }
  return JSON.stringify(value === undefined ? null : value);
}

export function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const text = JSON.stringify(value, null, 2);
  fs.writeFileSync(file, text);
  return { bytes: Buffer.byteLength(text), sha256: sha256(text) };
}

export function human(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes, i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i += 1; }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
}
