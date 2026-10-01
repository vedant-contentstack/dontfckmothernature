#!/usr/bin/env node
// dontfckmothernature CLI. One self-contained file with no dependencies, so the Claude Code
// plugin and the Codex installer can both run it straight from disk.
//
// Commands:
//   hook          Claude Code Stop hook. Starts a background sync and returns at once.
//   notify <json> Codex notify target. Starts a background sync, then runs the previous notify program.
//   sync          Reads changed log files and uploads token totals.
//   link          Prints your private dashboard link.
//   codex         Sets up Codex to sync after every turn.
//   set-api <url> Points the CLI at a different server.
//   status        Shows what has been synced.
//
// Only token counts, model names, timestamps and a hash of each log file path are uploaded.
// Prompt text, code and folder names never leave the machine.

import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_API = "https://dontfckmothernature.vercel.app";
const HOME = os.homedir();
const DIR = process.env.DFMN_HOME || path.join(HOME, ".dontfck");
const CONFIG = path.join(DIR, "config.json");
const STATE = path.join(DIR, "state.json");
const LOCK = path.join(DIR, "sync.lock");
const LOG = path.join(DIR, "sync.log");
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(HOME, ".claude");
const CODEX_DIR = process.env.CODEX_HOME || path.join(HOME, ".codex");
const SELF = fileURLToPath(import.meta.url);
const BATCH = 500;
const STATE_VERSION = 3; // bump to force a full rescan after the upload format changes

// ---------- small helpers ----------

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}
function log(msg) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.appendFileSync(LOG, `${new Date().toISOString()} ${msg}\n`);
}
const sha1 = (s) => createHash("sha1").update(s).digest("hex");
const config = () => readJson(CONFIG, {});
const apiUrl = () => (process.env.DFMN_API_URL || config().apiUrl || DEFAULT_API).replace(/\/$/, "");

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && e.name.endsWith(".jsonl")) out.push(p);
  }
  return out;
}

function runDetached(cmd, args) {
  try {
    const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
  } catch {}
}

// ---------- log parsers ----------

// Claude Code writes one line per content block, each repeating the message's usage, so count each message id once.
function parseClaude(file) {
  const messages = new Map();
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.includes('"usage"')) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    const m = e?.message;
    if (e?.type !== "assistant" || !m?.usage || !m.id || !m.model || m.model === "<synthetic>") continue;
    messages.set(m.id, { model: m.model, u: m.usage, ts: e.timestamp });
  }
  const buckets = new Map();
  for (const { model, u, ts } of messages.values()) {
    const r = bucket(buckets, model, ts);
    const fresh = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0);
    const cached = u.cache_read_input_tokens || 0;
    r.input_tokens += u.input_tokens || 0;
    r.output_tokens += u.output_tokens || 0;
    r.cache_write_tokens += u.cache_creation_input_tokens || 0;
    r.cache_read_tokens += cached;
    r.cache_x_new += cached * fresh;
    r.cache_x_out += cached * (u.output_tokens || 0);
    stamp(r, ts);
  }
  return [...buckets.values()];
}

// Codex logs cumulative totals in token_count events. Take the difference between events and
// give it to whichever model the current turn uses. Cached input is part of input_tokens there.
function parseCodex(file) {
  const buckets = new Map();
  let model = "gpt-5";
  let prev = null;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.includes('"turn_context"') && !line.includes('"token_count"')) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    const p = e?.payload;
    if (e?.type === "turn_context" && typeof p?.model === "string") { model = p.model; continue; }
    const t = p?.type === "token_count" ? p.info?.total_token_usage : null;
    if (!t) continue;
    const reset = prev && (t.total_tokens ?? 0) < (prev.total_tokens ?? 0);
    const base = !prev || reset ? {} : prev;
    const d = (k) => Math.max(0, (t[k] || 0) - (base[k] || 0));
    prev = t;
    if (d("total_tokens") === 0 && d("input_tokens") === 0 && d("output_tokens") === 0) continue;
    const cached = d("cached_input_tokens");
    const written = d("cache_write_input_tokens");
    const r = bucket(buckets, model, e.timestamp);
    const uncached = Math.max(0, d("input_tokens") - cached - written);
    r.input_tokens += uncached;
    r.output_tokens += d("output_tokens");
    r.cache_read_tokens += cached;
    r.cache_write_tokens += written;
    // Products need one request's numbers; a gap between two totals can span several requests.
    const last = p.info?.last_token_usage;
    if (last) {
      const lc = last.cached_input_tokens || 0;
      r.cache_x_new += lc * Math.max(0, (last.input_tokens || 0) - lc);
      r.cache_x_out += lc * (last.output_tokens || 0);
    } else {
      r.cache_x_new += cached * (uncached + written);
      r.cache_x_out += cached * d("output_tokens");
    }
    stamp(r, e.timestamp);
  }
  return [...buckets.values()];
}

// One bucket per (model, UTC day). A past day never changes, which lets the server freeze old days.
function bucket(buckets, model, ts) {
  const t = ts || new Date().toISOString();
  const day = t.slice(0, 10);
  const key = `${model}|${day}`;
  let r = buckets.get(key);
  if (!r) {
    r = { model, day, input_tokens: 0, output_tokens: 0, cache_write_tokens: 0, cache_read_tokens: 0, cache_x_new: 0, cache_x_out: 0, first_at: t, last_at: t };
    buckets.set(key, r);
  }
  return r;
}
function stamp(r, ts) {
  if (!ts) return;
  if (ts < r.first_at) r.first_at = ts;
  if (ts > r.last_at) r.last_at = ts;
}

// ---------- server calls ----------

async function post(route, body, token) {
  const res = await fetch(`${apiUrl()}${route}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(20_000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${route} ${res.status}: ${json.error ?? "request failed"}`);
  return json;
}

async function ensureToken() {
  const c = config();
  if (c.token) return c.token;
  const { token } = await post("/api/register");
  writeJson(CONFIG, { ...config(), token });
  return token;
}

// A random id per machine, so two laptops on one profile never overwrite each other's rows.
function deviceId() {
  const c = config();
  if (c.deviceId) return c.deviceId;
  const id = randomBytes(12).toString("base64url");
  writeJson(CONFIG, { ...config(), deviceId: id });
  return id;
}

// ---------- commands ----------

function takeLock() {
  fs.mkdirSync(DIR, { recursive: true });
  try {
    const age = Date.now() - fs.statSync(LOCK).mtimeMs;
    if (age > 10 * 60_000) fs.rmSync(LOCK, { force: true });
  } catch {}
  try { fs.closeSync(fs.openSync(LOCK, "wx")); return true; } catch { return false; }
}

async function sync({ quiet = true } = {}) {
  if (!takeLock()) { if (!quiet) console.log("A sync is already running."); return; }
  try {
    const token = await ensureToken();
    const device = deviceId();
    const saved = readJson(STATE, { files: {} });
    const state = saved.v === STATE_VERSION ? saved : { v: STATE_VERSION, files: {} };
    const sources = [
      ["claude", walk(path.join(CLAUDE_DIR, "projects")), parseClaude],
      ["codex", [...walk(path.join(CODEX_DIR, "sessions")), ...walk(path.join(CODEX_DIR, "archived_sessions"))], parseCodex],
    ];

    const rows = [];
    const seen = {};
    for (const [source, files, parse] of sources) {
      for (const file of files) {
        let st;
        try { st = fs.statSync(file); } catch { continue; }
        const sig = `${st.mtimeMs}:${st.size}`;
        seen[file] = sig;
        if (state.files[file] === sig) continue;
        const key = sha1(`${source}:${file}`);
        for (const r of parse(file)) rows.push({ source, session_key: key, ...r });
      }
    }

    // Always send at least one (possibly empty) batch so the server can roll up and freeze old days.
    const batches = Math.max(1, Math.ceil(rows.length / BATCH));
    for (let i = 0; i < batches; i++) {
      const slice = rows.slice(i * BATCH, (i + 1) * BATCH);
      await post("/api/ingest", { device_id: device, rows: slice, final: i === batches - 1 }, token);
    }
    writeJson(STATE, { v: STATE_VERSION, files: { ...state.files, ...seen }, lastSync: new Date().toISOString() });
    if (!quiet) console.log(`Synced ${rows.length} model totals from ${Object.keys(seen).length} log files.`);
  } catch (err) {
    log(`sync failed: ${err.message}`);
    if (!quiet) console.error(`Sync failed: ${err.message}`);
    process.exitCode = 1;
  } finally {
    fs.rmSync(LOCK, { force: true });
  }
}

async function link() {
  const firstRun = !readJson(STATE, null);
  if (firstRun) {
    console.log("First run: importing your past Claude Code and Codex usage. This can take a few seconds.");
    await sync({ quiet: false });
  }
  const token = await ensureToken();
  console.log(`\nYour private dashboard:\n${apiUrl()}/me#${token}\n\nKeep this link to yourself. Anyone with it can see and edit your numbers.`);
}

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve("");
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data));
    setTimeout(() => resolve(data), 1000);
  });
}

async function hook() {
  const input = await readStdin().catch(() => "");
  let payload = {};
  try { payload = JSON.parse(input); } catch {}
  // Avoid running twice when a Stop hook continues the conversation.
  if (payload.stop_hook_active) return;
  runDetached(process.execPath, [SELF, "sync"]);
}

function notify(args) {
  runDetached(process.execPath, [SELF, "sync"]);
  const prev = config().codexPrevNotify;
  if (Array.isArray(prev) && prev.length > 0) runDetached(prev[0], [...prev.slice(1), ...args]);
}

// Finds the top-level `notify = [...]` line in Codex's config.toml (keys before the first [table]).
function findNotify(lines) {
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*\[/.test(lines[i])) return { index: -1, insertAt: i };
    if (/^\s*notify\s*=/.test(lines[i])) return { index: i, insertAt: i };
  }
  return { index: -1, insertAt: lines.length };
}

async function codex() {
  const configToml = path.join(CODEX_DIR, "config.toml");
  const installed = path.join(DIR, "bin", "dfmn.mjs");
  fs.mkdirSync(path.dirname(installed), { recursive: true });
  fs.copyFileSync(SELF, installed);

  const text = fs.existsSync(configToml) ? fs.readFileSync(configToml, "utf8") : "";
  const lines = text.split("\n");
  const { index, insertAt } = findNotify(lines);
  const ours = [process.execPath, installed, "notify"];

  if (index >= 0) {
    const raw = lines[index].replace(/^\s*notify\s*=\s*/, "").replace(/\s+#.*$/, "");
    let current;
    try { current = JSON.parse(raw); } catch {
      console.error(`Could not read the notify setting in ${configToml}. Set it by hand to:\nnotify = ${JSON.stringify(ours)}`);
      process.exitCode = 1;
      return;
    }
    if (Array.isArray(current) && current.includes(installed)) {
      console.log("Codex is already set up.");
    } else {
      writeJson(CONFIG, { ...config(), codexPrevNotify: current });
      console.log(`Your existing notify program will keep running after each sync:\n  ${current.join(" ")}`);
    }
  }

  if (fs.existsSync(configToml)) fs.copyFileSync(configToml, `${configToml}.bak-${Date.now()}`);
  const line = `notify = ${JSON.stringify(ours)}`;
  if (index >= 0) lines[index] = line;
  else lines.splice(insertAt, 0, line);
  fs.mkdirSync(CODEX_DIR, { recursive: true });
  fs.writeFileSync(configToml, lines.join("\n"));
  console.log(`Codex will now sync after every turn. A backup of your config is next to ${configToml}.`);
  await link();
}

function status() {
  const c = config();
  const s = readJson(STATE, { files: {} });
  console.log(`Server:      ${apiUrl()}`);
  console.log(`Registered:  ${c.token ? "yes" : "no"}`);
  console.log(`Log files:   ${Object.keys(s.files).length}`);
  console.log(`Last sync:   ${s.lastSync ?? "never"}`);
  console.log(`Codex:       ${c.codexPrevNotify !== undefined || fs.existsSync(path.join(DIR, "bin", "dfmn.mjs")) ? "set up" : "not set up"}`);
  if (fs.existsSync(LOG)) {
    const last = fs.readFileSync(LOG, "utf8").trim().split("\n").pop();
    if (last) console.log(`Last error:  ${last}`);
  }
}

const [cmd, ...rest] = process.argv.slice(2);
const commands = {
  hook,
  notify: () => notify(rest),
  sync: () => sync({ quiet: !process.stdout.isTTY }),
  link,
  codex,
  status,
  "set-api": () => {
    if (!/^https?:\/\//.test(rest[0] ?? "")) { console.error("Usage: set-api https://your-deployment.example"); process.exitCode = 1; return; }
    writeJson(CONFIG, { ...config(), apiUrl: rest[0].replace(/\/$/, "") });
    console.log(`Server set to ${rest[0]}`);
  },
};

const run = commands[cmd] ?? (() => {
  console.log("Usage: dontfckmothernature <codex | link | sync | status | set-api <url>>");
});
await run();
