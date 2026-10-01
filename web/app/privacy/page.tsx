import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { LinkInfo } from "@/components/LinkInfo";

export const metadata: Metadata = { title: "Privacy · dontfckmothernature" };

const COLLECTED = [
  ["Token counts", "Input, output, cache-write and cache-read tokens, per model and per day", "To work out energy, CO₂ and water"],
  ["Model name", "For example claude-opus-5 or gpt-5.3-codex", "Bigger models use more energy per token"],
  ["Tool", "Claude Code or Codex", "Shown in the by-model table"],
  ["Day and time of first and last usage", "Per log file, per model, per day", "Lifetime period and the “latest usage” line"],
  ["Log file ID", "A SHA-1 hash of the log file’s path, never the path itself", "So re-sending a file replaces its numbers instead of adding them again"],
  ["Device ID", "A random ID created on your machine", "So two laptops on one dashboard don’t overwrite each other"],
  ["Country", "The one you pick on the dashboard (India by default)", "CO₂ per saved kWh and daily saving limits"],
  ["Savings you log", "Action, quantity, date, and any note you type for a custom entry", "Your “Saved by me” total"],
];

export default function Privacy() {
  return (
    <main className="wrap">
      <Header />
      <article className="prose">
        <span className="label muted">Last updated 1 October 2026</span>
        <h1>Privacy</h1>
        <p className="lede">
          dontfckmothernature reads token counts from your Claude Code and Codex logs. It never reads or uploads what you wrote, what the AI
          replied, or your code. There are no accounts, names or email addresses.
        </p>

        <div className="box summary-box">
          <span className="label">In short</span>
          <ul>
            <li>Only token counts, model names, dates and random IDs are uploaded. Never prompts, code or file names.</li>
            <li>There is no account. A private token on your machine is your login, and the server keeps only its hash.</li>
            <li>Nobody else can see your data. A share link shows just three totals.</li>
            <li>You can delete everything yourself from Settings on your dashboard.</li>
          </ul>
        </div>

        <h2>What is collected</h2>
        <p>Usage numbers per model and per day, a random ID for each log file and device, your country, and the savings you log.</p>
        <details className="more">
          <summary>Show every field and why it’s needed</summary>
          <div className="more-body">
        <div className="box table-wrap">
          <table className="wrap-cells">
            <thead><tr><th>Data</th><th>What exactly</th><th>Why</th></tr></thead>
            <tbody>
              {COLLECTED.map(([a, b, c]) => <tr key={a}><td><strong>{a}</strong></td><td>{b}</td><td>{c}</td></tr>)}
            </tbody>
          </table>
        </div>
          </div>
        </details>

        <h2>What is never collected</h2>
        <ul>
          <li>Prompts, AI responses, tool output or any other text from your sessions</li>
          <li>Code, file contents, file names, folder names or project names</li>
          <li>Your name, email address or any account details</li>
          <li>Cookies or analytics trackers. The dashboard keeps your token in your browser’s local storage so you stay signed in.</li>
        </ul>
        <p>
          The sync script is one file with no dependencies, so you can read exactly what it sends:{" "}
          <code>cli/bin/dfmn.mjs</code> in the plugin folder.
        </p>

        <h2>How you are identified</h2>
        <p>
          On first run, the plugin asks the server for a random private token and saves it in <code>~/.dontfck/config.json</code>. The
          server stores only a SHA-256 hash of that token, so even someone reading the database cannot open your dashboard.
        </p>
        <p>
          Your dashboard link is <code>/me#token</code>. The part after <code>#</code> is never sent to the server in the address; the page
          sends it in a request header and then removes it from the address bar. Anyone who has the full link can see and change your
          numbers, so keep it to yourself.
        </p>

        <h2>What stays on your machine</h2>
        <p>
          The folder <code>~/.dontfck</code> holds your token, your device ID, the server address, and a list of which log files have been
          synced (their path, last-modified time and size), so only changed files are read next time. No token counts or usage history are
          kept there. Error messages from background syncs go to <code>~/.dontfck/sync.log</code>.
        </p>

        <h2>Where data is stored and who can see it</h2>
        <ul>
          <li><strong>Database:</strong> Supabase, Mumbai region. Row-level security is on with no public access rules, so the public API key cannot read anything.</li>
          <li><strong>Website and API:</strong> Vercel. Requests are processed in the US (Washington, D.C. region). The app does not store IP addresses; Vercel keeps standard request logs, which include IP addresses, for a short time.</li>
          <li><strong>Other users</strong> cannot see your data. Every request is matched to one profile by the token hash.</li>
          <li><strong>The site owner</strong> can read the database. Nothing in it is linked to your name or email.</li>
        </ul>

        <h2>How long data is kept</h2>
        <ul>
          <li>Per-day usage rows are kept for 35 days. After that they are added into one lifetime total per model and deleted.</li>
          <li>Logged savings are kept until you remove them from the history list on the dashboard.</li>
          <li>Your profile is kept until you delete it from the dashboard.</li>
        </ul>

        <h2>Private link and share link</h2>
        <p>Your private link controls your dashboard. A share link is read-only and shows three totals.</p>
        <details className="more">
          <summary>Compare the two links</summary>
          <div className="more-body"><LinkInfo /></div>
        </details>

        <h2>Sharing</h2>
        <p>
          Sharing is off until you press “Create share link”. The public page and its image show only three totals: used, saved and
          balance for water, energy and CO₂. They don’t show models, dates or your savings list. Turning sharing off deletes the link; a new
          one gets a different address.
        </p>

        <h2>Deleting your data</h2>
        <p>
          On your dashboard, open Settings, go to “Delete my data”, type DELETE and confirm. Your profile, usage history, logged
          savings and share link are removed from the database at once. Only your own private link can do this; a share link cannot.
        </p>
        <p>
          After that, the plugin’s old token is refused, so nothing new is stored. To remove it from your machine, uninstall the plugin with{" "}
          <code>/plugin</code> and delete <code>~/.dontfck</code>.
        </p>

        <h2>Changes</h2>
        <p>If this policy changes, the date at the top will change with it.</p>

        <p className="muted small">
          How the numbers are worked out is on the <Link href="/method">method page</Link>.
        </p>
      </article>
    </main>
  );
}
