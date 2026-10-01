import { CopyCommand } from "@/components/CopyCommand";
import { Header } from "@/components/Header";
import { INSTALL } from "@/lib/site";

export default function Home() {
  return (
    <main className="wrap">
      <Header />

      <section className="section" style={{ gap: 20, paddingBlock: 12 }}>
        <span className="label muted">For Claude Code and Codex users</span>
        <h1>See the water, energy and CO₂ behind your AI usage, then pay it back.</h1>
        <p className="lede">
          A plugin reads your token counts after every prompt and works out what they cost the planet. Log the water and power you
          save in daily life, and watch your lifetime balance move.
        </p>
      </section>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="card-img" src="/card/example" alt="Example share card: 31 L water, 6.8 kWh and 2.4 kg CO₂ used by AI, 18.6 L, 3.7 kWh and 1 kg saved, balance −12.4 L, −3.1 kWh, −1.4 kg" width={1200} height={630} />

      <section className="section" id="install">
        <h2>Install</h2>
        <div className="section">
          <span className="label">Claude Code · run these inside Claude Code</span>
          {INSTALL.claude.map((c) => <CopyCommand key={c} text={c} />)}
          <p className="muted small">The last command imports your past usage and prints your private dashboard link.</p>
        </div>
        <div className="section">
          <span className="label">Codex · run this in your terminal</span>
          <CopyCommand text={INSTALL.codex} />
          <p className="muted small">Backs up <code>~/.codex/config.toml</code>, adds a sync after every turn, and keeps any notify program you already use.</p>
        </div>
      </section>

      <section className="section" id="method">
        <h2>How the numbers are worked out</h2>
        <div className="box" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10, maxWidth: "72ch" }}>
          <p style={{ margin: 0 }}>
            No AI company publishes energy per token, so every figure is an estimate. Tokens are weighted by type (output 1, input 0.2,
            cache read 0.02), multiplied by an energy factor for the model size, then converted to CO₂ with the US grid average
            (348 g/kWh) and to water with data-centre cooling plus the water used to generate the electricity.
          </p>
          <p style={{ margin: 0 }}>
            The dashboard shows the mid estimate with a low–high range. Savings use the lowest published value for each action and are
            capped at your country&rsquo;s average daily use.
          </p>
          <p className="muted small" style={{ margin: 0 }}>
            Sources: Epoch AI, EcoLogits, Google&rsquo;s Gemini footprint paper (2025), Jegham et al. &ldquo;How Hungry is AI&rdquo;, EPA
            WaterSense, BEE India, Ember, Poore &amp; Nemecek.
          </p>
        </div>
        <p className="muted small">
          Privacy: only token counts, model names, timestamps and a hash of each log file path are uploaded. Prompt text, code and folder
          names never leave your machine.
        </p>
      </section>
    </main>
  );
}
