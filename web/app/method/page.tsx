import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { DAILY, ONETIME, type Saving } from "@/lib/actions";
import { COUNTRIES } from "@/lib/countries";
import {
  BANDS, CACHE_J_PER_PAIR, CARBON_G_PER_KWH, FACILITY_OVERHEAD, R_IN, TIERS, TYPICAL_REQUEST, WATER_L_PER_KWH, usageImpact,
} from "@/lib/footprint";
import { num } from "@/lib/format";
import { CUSTOM_SHARE } from "@/lib/savings";

export const metadata: Metadata = { title: "Method" };

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
              <li>For cached tokens, the plugin also adds up, per request, cached tokens × new tokens and cached tokens × output tokens.</li>
              <li><strong>Claude Code</strong> writes the token usage of each response next to it. A response can span several lines that repeat the same usage, so each one is counted once by its message ID.</li>
              <li><strong>Codex</strong> writes a running total after every turn. The difference between two totals is that turn’s usage. Cached input is inside input there, so it is subtracted.</li>
              <li>Tokens are added up per model and per day. A prompt that adds 4,000 tokens moves the stored value from 10,000 to 14,000; sending the same file again changes nothing.</li>
              <li>Days older than 35 days are folded into one lifetime total per model and frozen. A reopened old session only adds its new messages.</li>
            </ul>
          </div>
        </details>

        <h2>2. Tokens to energy</h2>
        <p>
          Output tokens cost the most energy, and input tokens about 40% of an output token, based on measured serving throughput. A
          cached token is not processed again, but in every request the new tokens attend to it and each output token reads it, so its
          cost is worked out per request from your logs.
        </p>
        <details className="more">
          <summary>Show the formula and factors</summary>
          <div className="more-body">
            <pre className="box formula">
{`fresh tokens energy (Wh) = (output + (input + cache write) × r_in) ÷ 1,000 × Wh per 1K output tokens

cached tokens energy (J)  = Σ cache read × new tokens   × J per new–cached pair
                          + Σ cache read × output tokens × J per output–cached pair
                          × ${FACILITY_OVERHEAD} for data-centre overhead, scaled by model size`}
            </pre>
            <div className="box table-wrap">
              <table>
                <thead><tr><th>Factor</th>{BANDS.map((b) => <th key={b} className="r">{b}</th>)}</tr></thead>
                <tbody>
                  <tr><td>r_in (input token vs output token)</td>{BANDS.map((b) => <td key={b} className="r">{R_IN[b]}</td>)}</tr>
                  <tr><td>µJ per new–cached pair (Opus size)</td>{BANDS.map((b) => <td key={b} className="r">{fmt(CACHE_J_PER_PAIR[b].fresh * 1e6, 1)}</td>)}</tr>
                  <tr><td>µJ per output–cached pair (Opus size)</td>{BANDS.map((b) => <td key={b} className="r">{fmt(CACHE_J_PER_PAIR[b].output * 1e6, 1)}</td>)}</tr>
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
              Energy per token comes from ML.ENERGY measurements of large open models (DeepSeek-V3.1, Llama 405B, Qwen3-235B) at realistic
              batch sizes, DeepSeek’s published production numbers, and Microsoft research’s per-query spread, which sets the high. The input
              weight comes from prefill versus decode throughput in DeepSeek and SGLang serving. Cached-token energy is a first-principles
              estimate from attention compute and memory reads; older plugin versions that don’t send per-request data assume a typical
              request of {TYPICAL_REQUEST.fresh.toLocaleString("en-US")} new and {TYPICAL_REQUEST.output} output tokens. Check: a 500-token Sonnet reply is about 0.23 Wh at mid, close to Google’s published
              0.24 Wh median prompt.
            </p>
          </div>
        </details>

        <h2>3. Energy to CO₂ and water</h2>
        <p>
          CO₂ uses the grids of the US regions where Anthropic and OpenAI run inference, from Virginia to Ohio and Iowa. Water counts both
          data-centre cooling and the water power plants use to make the electricity; the second part is most of it.
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
                  <tr><td>Grid carbon (g CO₂/kWh)</td>{BANDS.map((b) => <td key={b} className="r">{CARBON_G_PER_KWH[b]}</td>)}<td>EPA eGRID2023: Virginia, blend, Ohio/Indiana/Iowa</td></tr>
                  <tr><td>Water (L/kWh)</td>{BANDS.map((b) => <td key={b} className="r">{fmt(WATER_L_PER_KWH[b])}</td>)}<td>AWS Virginia, fleet blend, Google Iowa; Li et al. off-site water</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </details>

        <h2>How the range is worked out</h2>
        <p>
          The low and high are not “every factor at its worst at once”, which almost never happens. Each factor is moved to its own low or
          high, and the effects are combined the standard way for independent uncertainties (root-sum-square on a log scale). The result
          is a range of roughly a third to three times the middle value.
        </p>

        <h2>Example</h2>
        <p>A Claude Sonnet session with 2,000,000 cache-read, 200,000 input and 50,000 output tokens:</p>
        <div className="box table-wrap">
          <table>
            <thead><tr><th /> {BANDS.map((b) => <th key={b} className="r">{b}</th>)}</tr></thead>
            <tbody>
              <tr><td>Energy</td>{BANDS.map((b) => <td key={b} className="r">{fmt(ex[b].energy * 1000, 1)} Wh</td>)}</tr>
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
            <p className="muted small">Water: national statistics (2021–2025). Electricity: Eurostat, EIA, Statistics Canada and national energy agencies (mostly 2024). CO₂: fossil CO₂ per person, Global Carbon Project 2024 via Our World in Data. Less certain: India’s water is a supply norm, Japan’s is Tokyo, Australia and UAE electricity and UAE water are proxies, and the world water figure is municipal withdrawal.</p>
          </div>
        </details>

        <h2>5. What is uncertain</h2>
        <ul>
          <li>Model sizes and hardware aren’t published, so even with measured data the high is several times the low.</li>
          <li>Cached-token energy is a first-principles estimate; no one has published a production measurement, and it depends on how each model’s attention works.</li>
          <li>Some saving values (bucket bath, cold wash, computer shutdown) are engineering estimates.</li>
        </ul>

        <details className="more">
          <summary>Sources</summary>
          <div className="more-body">
            <ul className="small">
              <li><a href="https://ml.energy/blog/measurement/energy/diagnosing-inference-energy-consumption-with-the-mlenergy-leaderboard-v30/">ML.ENERGY Leaderboard v3</a> (2026)</li>
              <li><a href="https://arxiv.org/abs/2509.20241">Oviedo et al., Microsoft: energy per AI query</a> (2025)</li>
              <li><a href="https://github.com/deepseek-ai/open-infra-index/blob/main/202502OpenSourceWeek/day_6_one_more_thing_deepseekV3R1_inference_system_overview.md">DeepSeek inference system overview</a> (2025)</li>
              <li><a href="https://www.lmsys.org/blog/2025-05-05-large-scale-ep/">LMSYS: large-scale DeepSeek serving on H100</a> (2025)</li>
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
