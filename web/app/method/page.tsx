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

        <div className="box summary-box">
          <span className="label">In short</span>
          <ul>
            <li>The plugin reads token counts from your Claude Code and Codex logs after every response.</li>
            <li>Tokens become energy using an estimate per model size. Energy becomes CO₂ and water using data-centre and power-grid figures.</li>
            <li>No AI company publishes these numbers, so the dashboard shows a middle estimate with a low–high range.</li>
            <li>Savings use the lowest published value for each action and are capped at what an average person in your country uses in a day.</li>
          </ul>
        </div>

        <h2>1. Where the tokens come from</h2>
        <p>
          Claude Code and Codex already save each session as a log file on your machine. After every response, the plugin re-reads the
          files that changed and replaces their stored totals, so the same tokens are never counted twice.
        </p>
        <details className="more">
          <summary>Show details</summary>
          <div className="more-body">
            <ul>
              <li><strong>Claude Code</strong> writes the token usage of each response next to it. A response can span several lines that repeat the same usage, so each one is counted once by its message ID.</li>
              <li><strong>Codex</strong> writes a running total after every turn. The difference between two totals is that turn’s usage. Cached input is inside input there, so it is subtracted.</li>
              <li>Tokens are added up per model and per day. A prompt that adds 4,000 tokens moves the stored value from 10,000 to 14,000; sending the same file again changes nothing.</li>
              <li>Days older than 35 days are folded into one lifetime total per model and frozen. A reopened old session only adds its new messages.</li>
            </ul>
          </div>
        </details>

        <h2>2. Tokens to energy</h2>
        <p>
          Output tokens cost the most energy. Input and cached tokens count for less, in line with their API prices. The weighted total is
          multiplied by an energy figure for the model’s size.
        </p>
        <details className="more">
          <summary>Show the formula and factors</summary>
          <div className="more-body">
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
                  <tr><td>r_cache</td>{BANDS.map((b) => <td key={b} className="r">{R_CACHE_READ[b]}</td>)}</tr>
                </tbody>
              </table>
            </div>
            <div className="box table-wrap">
              <table>
                <thead><tr><th>Model tier</th>{BANDS.map((b) => <th key={b} className="r">{b} Wh / 1K</th>)}</tr></thead>
                <tbody>
                  {Object.values(TIERS).map((t) => (
                    <tr key={t.label}><td>{t.label}</td>{BANDS.map((b) => <td key={b} className="r">{t.whPer1kOut[b]}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted small">
              Model sizes are EcoLogits’ estimates, with Epoch AI’s energy method, including data-centre overhead. Check: a 500-token Sonnet
              reply is about 0.26 Wh at mid, close to published per-query figures from Google (0.24 Wh), Microsoft research (0.31 Wh) and
              OpenAI (0.34 Wh).
            </p>
          </div>
        </details>

        <h2>3. Energy to CO₂ and water</h2>
        <p>
          CO₂ uses the carbon intensity of the US grid, where the data centres are. Water counts both data-centre cooling and the water
          power plants use to make the electricity; the second part is about 95% of it.
        </p>
        <details className="more">
          <summary>Show the formula and factors</summary>
          <div className="more-body">
            <pre className="box formula">
{`CO₂ (kg)  = kWh × grid carbon intensity ÷ 1,000
water (L) = kWh × (cooling water per kWh ÷ PUE + water used to generate each kWh)`}
            </pre>
            <div className="box table-wrap">
              <table>
                <thead><tr><th>Factor</th>{BANDS.map((b) => <th key={b} className="r">{b}</th>)}<th>Source</th></tr></thead>
                <tbody>
                  <tr><td>Grid carbon (g CO₂/kWh)</td>{BANDS.map((b) => <td key={b} className="r">{CARBON_G_PER_KWH[b]}</td>)}<td>EPA eGRID, Ember 2025</td></tr>
                  <tr><td>Water (L/kWh)</td>{BANDS.map((b) => <td key={b} className="r">{fmt(WATER_L_PER_KWH[b])}</td>)}<td>Cloud WUE and PUE; Li et al.; Jegham et al.</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </details>

        <h2>Example</h2>
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

        <h2>4. Savings</h2>
        <p>
          Each action uses the lowest value its source gives. Saved electricity is turned into CO₂ with your country’s grid. You can’t save
          more in a day than an average person in your country uses, and custom entries count up to {CUSTOM_SHARE * 100}% of that.
          One-time actions, like LED bulbs, keep saving every month and have no daily cap.
        </p>
        <details className="more">
          <summary>Show all actions</summary>
          <div className="more-body">
            <div className="box table-wrap">
              <table className="wrap-cells">
                <thead><tr><th>Daily habit</th><th>Saves each time</th><th className="r">Per day</th><th>Basis</th></tr></thead>
                <tbody>
                  {DAILY.map((a) => <tr key={a.id}><td>{a.name}</td><td>{gives(a.per)}</td><td className="r">{a.cap}×</td><td>{a.note}</td></tr>)}
                </tbody>
              </table>
            </div>
            <div className="box table-wrap">
              <table className="wrap-cells">
                <thead><tr><th>One-time action</th><th>Saves per month</th><th className="r">For</th><th>Basis</th></tr></thead>
                <tbody>
                  {ONETIME.map((a) => <tr key={a.id}><td>{a.name}</td><td>{gives(a.perMonth)} per {a.unit.replace(/s$/, "")}</td><td className="r">{a.months / 12} yr</td><td>{a.note}</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        </details>
        <details className="more">
          <summary>Show daily caps by country</summary>
          <div className="more-body">
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
            <p className="muted small">Sourced for India (CPHEEO, BEE 2024) and the US (EPA WaterSense, EIA 2023). Other countries use rough placeholders.</p>
          </div>
        </details>

        <h2>5. What is uncertain</h2>
        <ul>
          <li>Model sizes aren’t published, so the high estimate is about 30 times the low one.</li>
          <li>Weighting input and cached tokens by price is a reasonable proxy, not a measurement.</li>
          <li>Some saving values (bucket bath, cold wash, computer shutdown) are engineering estimates.</li>
        </ul>

        <details className="more">
          <summary>Sources</summary>
          <div className="more-body">
            <ul className="small">
              <li><a href="https://epoch.ai/gradient-updates/how-much-energy-does-chatgpt-use">Epoch AI: How much energy does ChatGPT use?</a> (2025)</li>
              <li><a href="https://ecologits.ai/latest/methodology/llm_inference/">EcoLogits: LLM inference methodology</a></li>
              <li><a href="https://arxiv.org/abs/2508.15734">Elsworth et al., Google: Measuring the environmental impact of AI inference</a> (2025)</li>
              <li><a href="https://arxiv.org/abs/2505.09598">Jegham et al.: How Hungry is AI?</a> (2025)</li>
              <li><a href="https://arxiv.org/abs/2304.03271">Li et al.: Making AI Less “Thirsty”</a> (2023)</li>
              <li><a href="https://blog.samaltman.com/the-gentle-singularity">Sam Altman: The Gentle Singularity</a> (2025)</li>
              <li><a href="https://www.epa.gov/egrid/summary-data">EPA eGRID</a> · <a href="https://ember-energy.org/data/">Ember electricity data</a></li>
              <li><a href="https://www.epa.gov/watersense/statistics-and-facts">EPA WaterSense</a> · <a href="https://beeindia.gov.in/WriteReadData/L45218/2878513814676762.pdf">BEE residential survey 2024</a> · <a href="https://www.eia.gov/energyexplained/use-of-energy/electricity-use-in-homes.php">EIA electricity in homes</a></li>
              <li><a href="https://ourworldindata.org/grapher/ghg-per-kg-poore">Poore &amp; Nemecek food emissions</a></li>
            </ul>
          </div>
        </details>

        <p className="muted small">What data is collected to do all this is on the <Link href="/privacy">privacy page</Link>.</p>
      </article>
    </main>
  );
}
