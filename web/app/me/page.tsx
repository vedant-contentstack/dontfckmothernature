"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CopyCommand } from "@/components/CopyCommand";
import { Header } from "@/components/Header";
import { LinkInfo } from "@/components/LinkInfo";
import { Panels } from "@/components/Panels";
import { CATEGORIES, DAILY, ONETIME, actionById, type Saving } from "@/lib/actions";
import { COUNTRIES } from "@/lib/countries";
import { FACTORS, ago, balanceState, num, shortTokens, signed, type Factor } from "@/lib/format";
import type { OffsetLog } from "@/lib/savings";
import { INSTALL } from "@/lib/site";
import type { Summary } from "@/lib/summary";

const TOKEN_KEY = "dfmn_token";

type Tab = "overview" | "log" | "history" | "settings";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "log", label: "Log savings" },
  { id: "history", label: "History" },
  { id: "settings", label: "Settings" },
];

type Api = (path: string, init?: RequestInit) => Promise<unknown>;
type Run = (fn: () => Promise<unknown>) => Promise<void>;

function localDate(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function readToken(): string | null {
  const fromHash = window.location.hash.slice(1);
  try {
    if (fromHash) {
      localStorage.setItem(TOKEN_KEY, fromHash);
      history.replaceState(null, "", window.location.pathname);
      return fromHash;
    }
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return fromHash || null;
  }
}

function gives(s: Saving) {
  return FACTORS.filter((f) => s[f.key]).map((f) => `${num(s[f.key]!)} ${f.key === "co2" ? "kg CO₂" : f.unit}`).join(" · ");
}

// Average share of the AI footprint paid back so far, across the three factors.
function paidBack(data: Summary) {
  const shares = FACTORS.map(({ key }) => (data.used.mid[key] > 0 ? Math.min(data.saved.total[key] / data.used.mid[key], 1) : 1));
  return Math.round((shares.reduce((a, b) => a + b, 0) / shares.length) * 100);
}

export default function Dashboard() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [busy, setBusy] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const today = localDate();

  const api = useCallback<Api>(
    async (path, init) => {
      const res = await fetch(path, { ...init, headers: { "content-type": "application/json", authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Something went wrong. Try again.");
      return json;
    },
    [token],
  );

  const refresh = useCallback(async () => {
    try {
      setData((await api(`/api/me?today=${today}`)) as Summary);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [api, today]);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (TABS.some((x) => x.id === t)) setTab(t as Tab);
    setToken(readToken());
  }, []);
  useEffect(() => {
    if (!token) return;
    let live = true;
    api(`/api/me?today=${today}`)
      .then((d) => live && (setData(d as Summary), setError(null)))
      .catch((e: Error) => live && setError(e.message));
    return () => { live = false; };
  }, [token, api, today]);

  // Pick up new syncs while the tab is open and visible.
  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      api(`/api/me?today=${today}`).then((d) => setData(d as Summary)).catch(() => {});
    }, 60_000);
    return () => clearInterval(id);
  }, [token, api, today]);

  const run: Run = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const deleteAll = async () => {
    setBusy(true);
    try {
      await api("/api/profile", { method: "DELETE" });
      try { localStorage.removeItem(TOKEN_KEY); } catch {}
      setDeleted(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (deleted) return <Deleted />;
  if (token === undefined) return <main className="wrap"><Header /></main>;
  if (!token) return <NoToken />;

  return (
    <main className="wrap">
      <Header />
      {error && <div className="error" role="alert">{error}</div>}
      {!data ? (
        <p className="muted">Loading your numbers…</p>
      ) : (
        <>
          <Strip data={data} />
          <div className="tabs" role="tablist" aria-label="Dashboard sections">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} className="btn" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          {tab === "overview" && <Overview data={data} onLog={() => setTab("log")} />}
          {tab === "log" && <LogSavings data={data} busy={busy} today={today} api={api} run={run} />}
          {tab === "history" && <HistoryTab data={data} busy={busy} onDelete={(id) => run(() => api(`/api/offsets/${id}`, { method: "DELETE" }))} />}
          {tab === "settings" && <Settings data={data} busy={busy} api={api} run={run} onDelete={deleteAll} />}
        </>
      )}
    </main>
  );
}

function Deleted() {
  return (
    <main className="wrap">
      <Header />
      <section className="section">
        <h1>Your data is deleted</h1>
        <p className="lede">Your profile, usage history and logged savings have been removed from the server. This link no longer works.</p>
        <p>The plugin on your machine still has the old token, so its syncs will now be refused and nothing new is stored. To remove it completely:</p>
        <CopyCommand text="/plugin uninstall dontfckmothernature@dontfckmothernature" />
        <CopyCommand text="rm -rf ~/.dontfck" />
      </section>
    </main>
  );
}

function NoToken() {
  return (
    <main className="wrap">
      <Header />
      <section className="section">
        <h1>Open your dashboard from Claude Code</h1>
        <p className="lede">Your dashboard link is private and is created by the plugin. Run this inside Claude Code to get it:</p>
        <CopyCommand text="/footprint" />
        <p className="muted">Not installed yet? Start with the install steps.</p>
        <CopyCommand text={INSTALL.claude[0]} />
      </section>
    </main>
  );
}

function Strip({ data }: { data: Summary }) {
  const state = balanceState(data.used.mid, data.saved.total);
  return (
    <div className={`strip bal-${state}`}>
      <span className="label">Balance</span>
      {FACTORS.map((f) => (
        <span className="num" key={f.key}>{signed(data.balance.mid[f.key])}<small>{f.unit}</small></span>
      ))}
      {data.lastAt && <span className="small" style={{ marginLeft: "auto" }}>Latest usage {ago(data.lastAt)}</span>}
    </div>
  );
}

/* ---------- Overview ---------- */

function Overview({ data, onLog }: { data: Summary; onLog: () => void }) {
  const state = balanceState(data.used.mid, data.saved.total);
  const since = data.firstAt ? new Date(data.firstAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;
  const pct = paidBack(data);
  const u = data.used.mid;

  return (
    <>
      <section className="section">
        <h2>{since ? `Since ${since}` : "Your lifetime balance"}</h2>
        <p className="lede">
          Your AI use has needed about <strong>{num(u.water)} L</strong> of water, <strong>{num(u.energy)} kWh</strong> of electricity and{" "}
          <strong>{num(u.co2)} kg</strong> of CO₂. You have paid back <strong>{pct}%</strong> of it.
        </p>
        <Panels used={data.used.mid} saved={data.saved.total} balance={data.balance.mid} state={state} />
        <details className="more">
          <summary>How sure are these numbers?</summary>
          <div className="more-body">
            <p>
              No AI company publishes energy per token, so the AI figures are middle estimates from published measurements. The likely range is{" "}
              {FACTORS.map((f) => `${num(data.used.low[f.key])} to ${num(data.used.high[f.key])} ${f.unit}`).join(", ")}.
            </p>
            <p><a href="/method">How the numbers are worked out</a></p>
          </div>
        </details>
      </section>
      {state !== "credit" && (
        <div className="box callout">
          <p>Paying it back starts with everyday things, like a shorter shower or an hour without AC.</p>
          <button type="button" className="btn go" onClick={onLog}>Log a saving</button>
        </div>
      )}
    </>
  );
}

/* ---------- Log savings ---------- */

function LogSavings({ data, busy, today, api, run }: { data: Summary; busy: boolean; today: string; api: Api; run: Run }) {
  const todayCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of data.logs) if (l.kind === "daily" && l.logged_on === today) m.set(l.action_id!, (m.get(l.action_id!) ?? 0) + l.quantity);
    return m;
  }, [data.logs, today]);

  const [onetime, setOnetime] = useState({ action_id: ONETIME[0].id, quantity: "1", logged_on: today });
  const [custom, setCustom] = useState<{ factor: Factor; amount: string; note: string }>({ factor: "water", amount: "", note: "" });
  const post = (body: object) => run(() => api("/api/offsets", { method: "POST", body: JSON.stringify(body) }));
  const t = data.saved.today;
  const chosen = ONETIME.find((a) => a.id === onetime.action_id)!;

  return (
    <>
      <section className="section">
        <div className="section-head">
          <h2>Today</h2>
          <span className="muted small">Daily cap: what an average person in your country uses in a day</span>
        </div>
        <div className="meter">
          {FACTORS.map((f) => {
            const pct = t.limit[f.key] > 0 ? Math.min(100, (t.counted[f.key] / t.limit[f.key]) * 100) : 0;
            return (
              <div className="box" key={f.key}>
                <div className="meter-head">
                  <span className="label">{f.label}</span>
                  <span className="small">{num(t.counted[f.key])} / {num(t.limit[f.key])} {f.unit}</span>
                </div>
                <div className="bar"><span style={{ width: `${pct}%` }} /></div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="section">
        <h2>Daily habits</h2>
        {CATEGORIES.map((c, i) => {
          const actions = DAILY.filter((a) => a.category === c.id);
          const done = actions.reduce((s, a) => s + (todayCounts.get(a.id) ?? 0), 0);
          return (
            <details className="group box" key={c.id} open={i === 0}>
              <summary>
                <span className="group-title">{c.label}</span>
                <span className="muted small">{c.hint}</span>
                {done > 0 && <span className="pill">{done} today</span>}
              </summary>
              <ul className="rows">
                {actions.map((a) => {
                  const n = todayCounts.get(a.id) ?? 0;
                  const full = n >= a.cap;
                  return (
                    <li key={a.id} className={full ? "full" : ""}>
                      <div className="row-text">
                        <span className="name">{a.name}</span>
                        <span className="gives">{gives(a.per)}</span>
                      </div>
                      <span className="count small">{n}/{a.cap}</span>
                      <button type="button" id={`log-${a.id}`} className="btn go" disabled={busy || full} onClick={() => post({ kind: "daily", action_id: a.id, quantity: 1, logged_on: today })}>
                        {full ? "Done" : "+1"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}
      </section>

      <section className="section">
        <h2>Bigger changes</h2>
        <details className="group box">
          <summary>
            <span className="group-title">One-time action</span>
            <span className="muted small">Keeps saving every month, like LED bulbs or solar</span>
          </summary>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              post({ kind: "onetime", action_id: onetime.action_id, quantity: Number(onetime.quantity), logged_on: onetime.logged_on });
            }}
          >
            <label className="field wide">
              <span className="label">Action</span>
              <select id="onetime-action" value={onetime.action_id} onChange={(e) => setOnetime({ ...onetime, action_id: e.target.value })}>
                {ONETIME.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="label">How many {chosen.unit}</span>
              <input id="onetime-qty" type="number" min="0.1" step="0.1" required value={onetime.quantity} onChange={(e) => setOnetime({ ...onetime, quantity: e.target.value })} />
            </label>
            <label className="field">
              <span className="label">Done on</span>
              <input id="onetime-date" type="date" max={today} required value={onetime.logged_on} onChange={(e) => setOnetime({ ...onetime, logged_on: e.target.value })} />
            </label>
            <button type="submit" className="btn go" disabled={busy}>Add</button>
            <p className="muted small full-width">
              Saves {gives(chosen.perMonth)} a month per {chosen.unit.replace(/s$/, "")}, for {chosen.months / 12} years.
            </p>
          </form>
        </details>

        <details className="group box">
          <summary>
            <span className="group-title">Something else</span>
            <span className="muted small">Counts up to half of today’s cap</span>
          </summary>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              post({ kind: "custom", factor: custom.factor, amount: Number(custom.amount), note: custom.note, logged_on: today });
              setCustom({ ...custom, amount: "", note: "" });
            }}
          >
            <label className="field">
              <span className="label">Saved</span>
              <select id="custom-factor" value={custom.factor} onChange={(e) => setCustom({ ...custom, factor: e.target.value as Factor })}>
                {FACTORS.map((f) => <option key={f.key} value={f.key}>{f.label} ({f.unit})</option>)}
              </select>
            </label>
            <label className="field">
              <span className="label">Amount</span>
              <input id="custom-amount" type="number" min="0.01" step="0.01" required value={custom.amount} onChange={(e) => setCustom({ ...custom, amount: e.target.value })} />
            </label>
            <label className="field wide">
              <span className="label">What you did</span>
              <input id="custom-note" maxLength={140} required placeholder="Watered plants with leftover cooking water" value={custom.note} onChange={(e) => setCustom({ ...custom, note: e.target.value })} />
            </label>
            <button type="submit" className="btn go" disabled={busy}>Add</button>
          </form>
        </details>
      </section>
    </>
  );
}

/* ---------- History ---------- */

function HistoryTab({ data, busy, onDelete }: { data: Summary; busy: boolean; onDelete: (id: number) => void }) {
  const describe = (l: OffsetLog) => {
    if (l.kind === "custom") return { name: l.note ?? "Custom saving", amount: `${num(l.amount!)} ${FACTORS.find((f) => f.key === l.factor)!.unit}` };
    const a = actionById(l.action_id!);
    if (!a) return { name: l.action_id!, amount: "" };
    if (a.kind === "daily") return { name: a.name, amount: `× ${l.quantity}` };
    return { name: a.name, amount: `${l.quantity} ${a.unit}` };
  };

  return (
    <>
      <section className="section">
        <h2>Your savings</h2>
        {data.logs.length === 0 ? (
          <p className="muted">Nothing logged yet. Savings you add in “Log savings” show up here.</p>
        ) : (
          <div className="box table-wrap">
            <table>
              <thead><tr><th>Date</th><th>What</th><th className="r">Amount</th><th /></tr></thead>
              <tbody>
                {data.logs.slice(0, 100).map((l) => {
                  const d = describe(l);
                  return (
                    <tr key={l.id}>
                      <td>{l.logged_on}</td>
                      <td>{d.name}</td>
                      <td className="r">{d.amount}</td>
                      <td className="r"><button type="button" className="btn small-btn" disabled={busy} onClick={() => onDelete(l.id)}>Remove</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section">
        <h2>AI usage by model</h2>
        {data.byModel.length === 0 ? (
          <p className="muted">No usage synced yet. It appears after your next prompt in Claude Code or Codex.</p>
        ) : (
          <div className="box table-wrap">
            <table>
              <thead>
                <tr><th>Model</th><th>Tool</th><th className="r">Tokens</th><th className="r">Energy</th></tr>
              </thead>
              <tbody>
                {data.byModel.map((m) => (
                  <tr key={`${m.source}:${m.model}`}>
                    <td>{m.model}<div className="muted small">Counted as {m.tier}</div></td>
                    <td>{m.source === "claude" ? "Claude Code" : "Codex"}</td>
                    <td className="r">{shortTokens(m.tokens)}</td>
                    <td className="r">{num(m.energy)} kWh</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

/* ---------- Settings ---------- */

function Settings({ data, busy, api, run, onDelete }: { data: Summary; busy: boolean; api: Api; run: Run; onDelete: () => void }) {
  const [confirm, setConfirm] = useState("");
  const shareUrl = data.shareSlug ? `${window.location.origin}/s/${data.shareSlug}` : null;
  const patch = (body: object) => run(() => api("/api/profile", { method: "PATCH", body: JSON.stringify(body) }));

  return (
    <>
      <section className="section">
        <h2>Country</h2>
        <div className="box setting">
          <p className="muted small">Sets how much CO₂ each kWh you save is worth, and your daily saving cap.</p>
          <select id="country" aria-label="Country" value={data.country} disabled={busy} onChange={(e) => patch({ country: e.target.value })}>
            {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Share card</h2>
          <button type="button" id="share-toggle" className="btn" disabled={busy} onClick={() => patch({ share: !shareUrl })}>
            {shareUrl ? "Turn off sharing" : "Create share link"}
          </button>
        </div>
        {shareUrl ? (
          <>
            <CopyCommand text={shareUrl} label="Copy link" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="card-img" src={`/s/${data.shareSlug}/opengraph-image?v=${Math.round(data.balance.mid.water * 10)}`} alt="Your share card" width={1200} height={630} />
          </>
        ) : (
          <p className="muted">Sharing is off. A share link shows only your three totals, never your history or settings.</p>
        )}
        <details className="more">
          <summary>Share link or private link: what’s the difference?</summary>
          <div className="more-body"><LinkInfo /></div>
        </details>
      </section>

      <section className="section">
        <h2>Delete my data</h2>
        <form
          className="form box"
          onSubmit={(e) => {
            e.preventDefault();
            if (confirm === "DELETE") onDelete();
          }}
        >
          <p className="field wide" style={{ margin: 0 }}>
            Removes your profile, usage history, savings and share link from the server. This can’t be undone. Type DELETE to confirm.
          </p>
          <label className="field">
            <span className="label">Confirm</span>
            <input id="delete-confirm" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" />
          </label>
          <button type="submit" className="btn danger" disabled={busy || confirm !== "DELETE"}>Delete everything</button>
        </form>
      </section>
    </>
  );
}
