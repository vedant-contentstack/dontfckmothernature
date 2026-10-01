import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { DAILY, ONETIME, type Saving } from "@/lib/actions";
import { COUNTRIES } from "@/lib/countries";
import {
  BANDS, CACHE_WRITE, CARBON_G_PER_KWH, R_CACHE_READ, R_IN_ANTHROPIC, R_IN_OPENAI, TIERS, WATER_L_PER_KWH, energyWh, usageImpact,
} from "@/lib/footprint";
import { num } from "@/lib/format";
import { CUSTOM_SHARE } from "@/lib/savings";

export const metadata: Metadata = { title: "Method · dontfckmothernature" };

const EXAMPLE = { model: "claude-sonnet-4-5", input_tokens: 200_000, output_tokens: 50_000, cache_write_tokens: 0, cache_read_tokens: 2_000_000 };

const fmt = (n: number, d = 2) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const gives = (s: Saving) =>
  [s.water && `${num(s.water)} L`, s.energy && `${num(s.energy)} kWh`, s.co2 && `${num(s.co2)} kg CO₂`].filter(Boolean).join(" · ");

export default function Method() {
  const ex = usageImpact([EXAMPLE]);
  return (
    <main className="wrap">
      <Header />
      <article className="prose">
        <h1>How the numbers are worked out</h1>
        <p className="lede">
          No AI company publishes energy or water per token, so every AI figure here is an estimate built from published research. The
          dashboard shows the middle estimate and a low–high range next to it.
        </p>

        <h2>1. Reading your sessions</h2>
        <p>
          Claude Code and Codex already save every session as a log file on your machine (<code>~/.claude/projects</code> and{" "}
          <code>~/.codex/sessions</code>). After each response, the plugin starts a background sync that reads only the files that changed.
        </p>
        <ul>
          <li>
            <strong>Claude Code</strong> writes the token usage of each AI response next to it: input, output, cache-write and cache-read
            tokens. One response can span several lines that repeat the same usage, so each response is counted once by its message ID.
          </li>
          <li>
            <strong>Codex</strong> writes a running total after every turn. The difference between two totals is that turn’s usage, and it
            is assigned to the model the turn used. Codex counts cached input inside input tokens, so it is subtracted to avoid counting it
            twice.
          </li>
        </ul>
        <p>
          Tokens are then added up per <strong>model</strong> and per <strong>day</strong> for each file.
        </p>

        <h2>2. How each new prompt is added</h2>
        <p>
          The sync never adds “this prompt’s tokens” on top of what is stored. It recounts the whole file and replaces the stored value
          for that file, model and day. So a prompt that adds 4,000 tokens moves the stored value from 10,000 to 14,000, and sending the
          same file again changes nothing.
        </p>
        <p>
          Days older than 35 days are added into one lifetime total per model and frozen. If an old session is reopened, only its new
          messages count, because they carry today’s date.
        </p>

        <h2>3. Tokens to energy</h2>
        <p>Output tokens cost the most energy. Input and cached tokens are weighted down, following the ratio of their API prices:</p>
        <pre className="box formula">
{`weighted tokens = output
                + input × r_in
                + cache write × r_in × ${CACHE_WRITE}
                + cache read × r_in × r_cache

energy (Wh)     = weighted tokens ÷ 1,000 × Wh per 1K output tokens`}
        </pre>
        <div className="box table-wrap">
          <table>
            <thead><tr><th>Weight</th>{BANDS.map((b) => <th key={b} className="r">{b}</th>)}</tr></thead>
            <tbody>
              <tr><td>r_in, Claude models</td>{BANDS.map((b) => <td key={b} className="r">{R_IN_ANTHROPIC[b]}</td>)}</tr>
              <tr><td>r_in, OpenAI models</td>{BANDS.map((b) => <td key={b} className="r">{R_IN_OPENAI[b]}</td>)}</tr>
              <tr><td>r_cache (share of input price for a cache read)</td>{BANDS.map((b) => <td key={b} className="r">{R_CACHE_READ[b]}</td>)}</tr>
            </tbody>
          </table>
        </div>
        <p>
          Energy per 1,000 output tokens depends on model size. Providers don’t publish model sizes, so these use EcoLogits’ estimates of
          active parameters with Epoch AI’s energy method. The figures include data-centre overhead (PUE).
        </p>
        <div className="box table-wrap">
          <table>
            <thead><tr><th>Model tier</th>{BANDS.map((b) => <th key={b} className="r">{b} (Wh / 1K)</th>)}</tr></thead>
            <tbody>
              {Object.values(TIERS).map((t) => (
                <tr key={t.label}><td>{t.label}</td>{BANDS.map((b) => <td key={b} className="r">{t.whPer1kOut[b]}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Check: a 500-token Sonnet reply comes to about 0.26 Wh at mid, close to the published per-query figures from Google (0.24 Wh),
          Microsoft research (0.31 Wh) and OpenAI (0.34 Wh).
        </p>

        <h2>4. Energy to CO₂ and water</h2>
        <pre className="box formula">
{`CO₂ (kg)  = kWh × grid carbon intensity ÷ 1,000
water (L) = kWh × (cooling water per kWh ÷ PUE + water used to generate each kWh)`}
        </pre>
        <div className="box table-wrap">
          <table>
            <thead><tr><th>Factor</th>{BANDS.map((b) => <th key={b} className="r">{b}</th>)}<th>Source</th></tr></thead>
            <tbody>
              <tr>
                <td>Grid carbon (g CO₂/kWh)</td>
                {BANDS.map((b) => <td key={b} className="r">{CARBON_G_PER_KWH[b]}</td>)}
                <td>Virginia, US average (EPA eGRID), world (Ember 2025)</td>
              </tr>
              <tr>
                <td>Water (L/kWh)</td>
                {BANDS.map((b) => <td key={b} className="r">{fmt(WATER_L_PER_KWH[b])}</td>)}
                <td>AWS / Azure / Google WUE and PUE; Li et al., Jegham et al.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          AI usage is counted at the data centre’s grid, which is in the US, wherever you are. About 95% of the water figure is the water
          used by power plants to make the electricity; the rest is cooling water at the data centre.
        </p>

        <h2>Worked example</h2>
        <p>A Claude Sonnet session with 2,000,000 cache-read, 200,000 input and 50,000 output tokens:</p>
        <div className="box table-wrap">
          <table>
            <thead><tr><th /> {BANDS.map((b) => <th key={b} className="r">{b}</th>)}</tr></thead>
            <tbody>
              <tr><td>Energy</td>{BANDS.map((b) => <td key={b} className="r">{fmt(energyWh(EXAMPLE.model, EXAMPLE, b), 1)} Wh</td>)}</tr>
              <tr><td>CO₂</td>{BANDS.map((b) => <td key={b} className="r">{fmt(ex[b].co2 * 1000, 1)} g</td>)}</tr>
              <tr><td>Water</td>{BANDS.map((b) => <td key={b} className="r">{fmt(ex[b].water)} L</td>)}</tr>
            </tbody>
          </table>
        </div>

        <h2>5. Savings</h2>
        <p>
          Every action uses the lowest value its source gives. Electricity savings are stored in kWh, and their CO₂ uses your country’s grid.
          Fuel, food and plastic savings carry their own CO₂.
        </p>
        <h3>Daily habits</h3>
        <div className="box table-wrap">
          <table className="wrap-cells">
            <thead><tr><th>Action</th><th>Saves each time</th><th className="r">Per day</th><th>Basis</th></tr></thead>
            <tbody>
              {DAILY.map((a) => <tr key={a.id}><td>{a.name}</td><td>{gives(a.per)}</td><td className="r">{a.cap}×</td><td>{a.note}</td></tr>)}
            </tbody>
          </table>
        </div>
        <h3>One-time actions</h3>
        <p>These keep saving every month after the date you log, for as long as the action lasts.</p>
        <div className="box table-wrap">
          <table className="wrap-cells">
            <thead><tr><th>Action</th><th>Saves per month</th><th className="r">For</th><th>Basis</th></tr></thead>
            <tbody>
              {ONETIME.map((a) => <tr key={a.id}><td>{a.name}</td><td>{gives(a.perMonth)} per {a.unit.replace(/s$/, "")}</td><td className="r">{a.months / 12} yr</td><td>{a.note}</td></tr>)}
            </tbody>
          </table>
        </div>
        <h3>Daily limits</h3>
        <p>
          You can’t save more in a day than an average person in your country uses in a day. Custom entries count up to{" "}
          {CUSTOM_SHARE * 100}% of that. One-time actions are not limited.
        </p>
        <div className="box table-wrap">
          <table>
            <thead><tr><th>Country</th><th className="r">Grid g CO₂/kWh</th><th className="r">Water L/day</th><th className="r">Home kWh/day</th><th className="r">CO₂ kg/day</th></tr></thead>
            <tbody>
              {COUNTRIES.map((c) => (
                <tr key={c.code}><td>{c.name}</td><td className="r">{c.gridG}</td><td className="r">{c.daily.water}</td><td className="r">{c.daily.energy}</td><td className="r">{c.daily.co2}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Daily use is sourced for India (CPHEEO, BEE 2024 survey) and the US (EPA WaterSense, EIA 2023). Other countries use rough
          placeholders for now.
        </p>

        <h2>What is uncertain</h2>
        <ul>
          <li>No provider publishes model sizes, so the tier figures are estimates, and the high band is about 30 times the low band.</li>
          <li>Using API price ratios to weight input and cached tokens is a reasonable proxy, not a measurement.</li>
          <li>Anthropic also runs on non-NVIDIA hardware, so the GPU-based energy figures may not carry over exactly.</li>
          <li>Several saving values (bucket bath, cold wash, computer shutdown) are engineering estimates.</li>
        </ul>

        <h2>Sources</h2>
        <ul className="small">
          <li><a href="https://epoch.ai/gradient-updates/how-much-energy-does-chatgpt-use">Epoch AI: How much energy does ChatGPT use?</a> (2025)</li>
          <li><a href="https://ecologits.ai/latest/methodology/llm_inference/">EcoLogits: LLM inference methodology</a></li>
          <li><a href="https://arxiv.org/abs/2508.15734">Elsworth et al., Google: Measuring the environmental impact of AI inference</a> (2025)</li>
          <li><a href="https://arxiv.org/abs/2505.09598">Jegham et al.: How Hungry is AI?</a> (2025)</li>
          <li><a href="https://arxiv.org/abs/2304.03271">Li et al.: Making AI Less “Thirsty”</a> (2023)</li>
          <li><a href="https://blog.samaltman.com/the-gentle-singularity">Sam Altman: The Gentle Singularity</a> (2025)</li>
          <li><a href="https://www.epa.gov/egrid/summary-data">EPA eGRID summary data</a> · <a href="https://ember-energy.org/data/">Ember electricity data</a></li>
          <li><a href="https://www.epa.gov/watersense/statistics-and-facts">EPA WaterSense</a> · <a href="https://beeindia.gov.in/WriteReadData/L45218/2878513814676762.pdf">BEE residential energy survey 2024</a> · <a href="https://www.eia.gov/energyexplained/use-of-energy/electricity-use-in-homes.php">EIA electricity use in homes</a></li>
          <li><a href="https://ourworldindata.org/grapher/ghg-per-kg-poore">Poore &amp; Nemecek food emissions (Our World in Data)</a></li>
        </ul>

        <p className="muted small">What data is collected to do all this is on the <Link href="/privacy">privacy page</Link>.</p>
      </article>
    </main>
  );
}
