"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CopyCommand } from "@/components/CopyCommand";
import { Header } from "@/components/Header";
import { Panels } from "@/components/Panels";
import { DAILY, ONETIME, actionById, type Saving } from "@/lib/actions";
import { COUNTRIES } from "@/lib/countries";
import { FACTORS, balanceState, num, shortTokens, signed, type Factor } from "@/lib/format";
import type { OffsetLog } from "@/lib/savings";
import { INSTALL } from "@/lib/site";
import type { Summary } from "@/lib/summary";

const TOKEN_KEY = "dfmn_token";

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

export default function Dashboard() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"footprint" | "sins">("footprint");
  const [busy, setBusy] = useState(false);
  const today = localDate();

  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await fetch(path, { ...init, headers: { "content-type": "application/json", authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Something went wrong. Try again.");
      return json;
    },
    [token],
  );

  const refresh = useCallback(async () => {
    try {
      setData(await api(`/api/me?today=${today}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [api, today]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setToken(readToken()), []);
  useEffect(() => {
    if (!token) return;
    let live = true;
    api(`/api/me?today=${today}`)
      .then((d) => live && (setData(d as Summary), setError(null)))
      .catch((e: Error) => live && setError(e.message));
    return () => { live = false; };
  }, [token, api, today]);

  const run = async (fn: () => Promise<unknown>) => {
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
          <div className="tabs" role="tablist">
            <button type="button" role="tab" id="tab-footprint" className="btn" aria-selected={tab === "footprint"} onClick={() => setTab("footprint")}>My footprint</button>
            <button type="button" role="tab" id="tab-sins" className="btn" aria-selected={tab === "sins"} onClick={() => setTab("sins")}>Clear your sins</button>
          </div>
          {tab === "footprint" ? (
            <Footprint data={data} busy={busy} onShare={(share) => run(() => api("/api/profile", { method: "PATCH", body: JSON.stringify({ share }) }))} />
          ) : (
            <Sins data={data} busy={busy} today={today} api={api} run={run} />
          )}
        </>
      )}
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
    </div>
  );
}

function Footprint({ data, busy, onShare }: { data: Summary; busy: boolean; onShare: (on: boolean) => void }) {
  const state = balanceState(data.used.mid, data.saved.total);
  const shareUrl = data.shareSlug ? `${window.location.origin}/s/${data.shareSlug}` : null;
  const since = data.firstAt ? new Date(data.firstAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;

  return (
    <>
      <section className="section">
        <div className="section-head">
          <h2>Lifetime{since ? ` since ${since}` : ""}</h2>
          <span className="muted small">AI figures are mid estimates</span>
        </div>
        <Panels used={data.used.mid} saved={data.saved.total} balance={data.balance.mid} state={state} />
        <p className="muted small">
          Range for AI usage: {FACTORS.map((f) => `${num(data.used.low[f.key])}–${num(data.used.high[f.key])} ${f.unit}`).join(" · ")}.
          No AI company publishes per-token figures, so the real number could be anywhere in this range.
        </p>
      </section>

      <section className="section">
        <h2>By model</h2>
        {data.byModel.length === 0 ? (
          <p className="muted">No usage synced yet. It appears here after your next prompt in Claude Code or Codex.</p>
        ) : (
          <div className="box table-wrap">
            <table>
              <thead>
                <tr><th>Model</th><th>Tool</th><th>Counted as</th><th className="r">Tokens</th><th className="r">Energy (mid)</th></tr>
              </thead>
              <tbody>
                {data.byModel.map((m) => (
                  <tr key={`${m.source}:${m.model}`}>
                    <td>{m.model}</td>
                    <td>{m.source === "claude" ? "Claude Code" : "Codex"}</td>
                    <td>{m.tier}</td>
                    <td className="r">{shortTokens(m.tokens)}</td>
                    <td className="r">{num(m.energy)} kWh</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Share card</h2>
          <button type="button" id="share-toggle" className="btn" disabled={busy} onClick={() => onShare(!shareUrl)}>
            {shareUrl ? "Turn off sharing" : "Create share link"}
          </button>
        </div>
        {shareUrl ? (
          <>
            <CopyCommand text={shareUrl} label="Copy link" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="card-img" src={`/s/${data.shareSlug}/opengraph-image?v=${Math.round(data.balance.mid.water * 10)}`} alt="Your share card" width={1200} height={630} />
            <p className="muted small">The public page shows only the three totals. Turning sharing off breaks the link for good; a new one gets a new address.</p>
          </>
        ) : (
          <p className="muted">Sharing is off. Creating a link makes a public page with your used, saved and balance totals and nothing else.</p>
        )}
      </section>
    </>
  );
}

type Api = (path: string, init?: RequestInit) => Promise<unknown>;

function Sins({ data, busy, today, api, run }: { data: Summary; busy: boolean; today: string; api: Api; run: (fn: () => Promise<unknown>) => Promise<void> }) {
  const todayCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of data.logs) if (l.kind === "daily" && l.logged_on === today) m.set(l.action_id!, (m.get(l.action_id!) ?? 0) + l.quantity);
    return m;
  }, [data.logs, today]);

  const [onetime, setOnetime] = useState({ action_id: ONETIME[0].id, quantity: "1", logged_on: today });
  const [custom, setCustom] = useState<{ factor: Factor; amount: string; note: string }>({ factor: "water", amount: "", note: "" });
  const post = (body: object) => run(() => api("/api/offsets", { method: "POST", body: JSON.stringify(body) }));
  const t = data.saved.today;

  return (
    <>
      <section className="section">
        <div className="section-head">
          <h2>Where you live</h2>
          <select
            id="country"
            aria-label="Country"
            value={data.country}
            disabled={busy}
            onChange={(e) => run(() => api("/api/profile", { method: "PATCH", body: JSON.stringify({ country: e.target.value }) }))}
          >
            {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
        <p className="muted small">Your country sets how much CO₂ each saved kWh is worth and the daily limits below.</p>
      </section>

      <section className="section">
        <h2>Today&rsquo;s limit</h2>
        <div className="meter">
          {FACTORS.map((f) => {
            const pct = t.limit[f.key] > 0 ? Math.min(100, (t.counted[f.key] / t.limit[f.key]) * 100) : 0;
            return (
              <div className="box" key={f.key}>
                <span className="label">{f.label}</span>
                <span className="num" style={{ fontSize: 20 }}>{num(t.counted[f.key])}<small>of {num(t.limit[f.key])} {f.unit}</small></span>
                <div className="bar"><span style={{ width: `${pct}%` }} /></div>
              </div>
            );
          })}
        </div>
        <p className="muted small">You can&rsquo;t save more in a day than an average person in your country uses. Custom entries count up to half of that. One-time actions are not limited.</p>
      </section>

      <section className="section">
        <h2>Daily habits</h2>
        <div className="actions">
          {DAILY.map((a) => {
            const done = todayCounts.get(a.id) ?? 0;
            const full = done >= a.cap;
            return (
              <div className={`action box${full ? " full" : ""}`} key={a.id}>
                <span className="name">{a.name}</span>
                <span className="muted small">{a.note}</span>
                <div className="foot">
                  <span className="gives">{gives(a.per)}</span>
                  <button type="button" id={`log-${a.id}`} className="btn go" disabled={busy || full} onClick={() => post({ kind: "daily", action_id: a.id, quantity: 1, logged_on: today })}>
                    {full ? `${done}/${a.cap} done` : `+1 · ${done}/${a.cap}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="section">
        <h2>One-time actions</h2>
        <p className="muted small">These keep saving every month after you do them, for as long as the action lasts.</p>
        <form
          className="form box"
          onSubmit={(e) => {
            e.preventDefault();
            post({ kind: "onetime", action_id: onetime.action_id, quantity: Number(onetime.quantity), logged_on: onetime.logged_on });
          }}
        >
          <label className="field wide">
            <span className="label">Action</span>
            <select id="onetime-action" value={onetime.action_id} onChange={(e) => setOnetime({ ...onetime, action_id: e.target.value })}>
              {ONETIME.map((a) => <option key={a.id} value={a.id}>{a.name} · {gives(a.perMonth)} a month for {a.months / 12} yr</option>)}
            </select>
          </label>
          <label className="field">
            <span className="label">How many ({ONETIME.find((a) => a.id === onetime.action_id)?.unit})</span>
            <input id="onetime-qty" type="number" min="0.1" step="0.1" required value={onetime.quantity} onChange={(e) => setOnetime({ ...onetime, quantity: e.target.value })} />
          </label>
          <label className="field">
            <span className="label">Done on</span>
            <input id="onetime-date" type="date" max={today} required value={onetime.logged_on} onChange={(e) => setOnetime({ ...onetime, logged_on: e.target.value })} />
          </label>
          <button type="submit" className="btn go" disabled={busy}>Add</button>
        </form>
      </section>

      <section className="section">
        <h2>Something else</h2>
        <form
          className="form box"
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
        <p className="muted small">Counted today: {FACTORS.map((f) => `${num(t.customCounted[f.key])} of ${num(t.customLimit[f.key])} ${f.unit}`).join(" · ")}.</p>
      </section>

      <History logs={data.logs} busy={busy} onDelete={(id) => run(() => api(`/api/offsets/${id}`, { method: "DELETE" }))} />
    </>
  );
}

function History({ logs, busy, onDelete }: { logs: OffsetLog[]; busy: boolean; onDelete: (id: number) => void }) {
  if (logs.length === 0) return null;
  const describe = (l: OffsetLog) => {
    if (l.kind === "custom") return { name: l.note ?? "Custom saving", amount: `${num(l.amount!)} ${FACTORS.find((f) => f.key === l.factor)!.unit}` };
    const a = actionById(l.action_id!);
    if (!a) return { name: l.action_id!, amount: "" };
    if (a.kind === "daily") return { name: a.name, amount: `× ${l.quantity}` };
    return { name: a.name, amount: `${l.quantity} ${a.unit}` };
  };
  return (
    <section className="section">
      <h2>History</h2>
      <div className="box table-wrap">
        <table>
          <thead><tr><th>Date</th><th>What</th><th className="r">Amount</th><th /></tr></thead>
          <tbody>
            {logs.slice(0, 100).map((l) => {
              const d = describe(l);
              return (
                <tr key={l.id}>
                  <td>{l.logged_on}</td>
                  <td>{d.name}</td>
                  <td className="r">{d.amount}</td>
                  <td className="r">
                    <button type="button" className="btn" style={{ padding: "6px 10px" }} disabled={busy} onClick={() => onDelete(l.id)}>Remove</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

