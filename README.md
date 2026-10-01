# dontfckmothernature

See the water, energy and CO₂ behind your Claude Code and Codex usage, then pay it back.

A Claude Code plugin reads the token counts in your local session logs after every response and sends them to a small web app. The app turns them into an estimate of electricity, CO₂ and water, and gives you a checklist of everyday savings (shorter showers, an hour without AC, taking the metro) to log against it. Your dashboard shows one lifetime balance: what your AI used, what you saved, and what is left.

Live site: [dontfckmothernature.vercel.app](https://dontfckmothernature.vercel.app)

## Install

**Claude Code**, inside a session:

```
/plugin marketplace add vedant-contentstack/dontfckmothernature
/plugin install dontfckmothernature@dontfckmothernature
/footprint
```

`/footprint` imports your past usage and prints your private dashboard link. After that, a `Stop` hook syncs in the background after every response.

**Codex**, in a terminal:

```bash
npx dontfckmothernature codex
```

This backs up `~/.codex/config.toml`, sets `notify` to run the sync after every turn, and keeps any notify program you already had.

## Privacy in short

- Uploaded: token counts per model and per day, model names, timestamps, a SHA-1 hash of each log file path, and a random device ID.
- Never uploaded: prompts, responses, code, file or folder names, names or emails.
- There are no accounts. A random token in `~/.dontfck/config.json` is your login; the server stores only its SHA-256 hash.
- You can delete everything from Settings on your dashboard.

Full details: [privacy page](https://dontfckmothernature.vercel.app/privacy).

## How the numbers are worked out

No AI provider publishes energy per token, so every AI figure is an estimate with a likely range.

```
fresh tokens   Wh = (output + (input + cache write) × r_in) ÷ 1,000 × Wh per 1K output tokens (by model tier)
cached tokens  J  = Σ cache read × new tokens × J per pair + Σ cache read × output tokens × J per pair
CO₂            kg = kWh × grid intensity of the US data-centre regions
water          L  = kWh × (data-centre cooling water ÷ PUE + water used to generate the electricity)
```

- Energy per token comes from ML.ENERGY measurements of large open models, DeepSeek's published production figures, and Microsoft research's per-query spread.
- Cached-token cost is worked out per request from your logs (attention over cached context plus KV reads).
- The range moves each factor to its own low or high and combines them as a root-sum-square on a log scale.
- Savings use the lowest published value for each action and are capped at what an average person in your country uses in a day.

Every factor, source and caveat is on the [method page](https://dontfckmothernature.vercel.app/method). The code is in `web/lib/footprint.ts`, `web/lib/actions.ts` and `web/lib/countries.ts`.

## Repository layout

| Path | What it is |
|---|---|
| `.claude-plugin/`, `hooks/`, `commands/` | The Claude Code plugin. The repo root is both the marketplace and the plugin. |
| `cli/bin/dfmn.mjs` | The sync script: one file, no dependencies. Used by the plugin and published to npm for Codex. |
| `supabase/migrations/` | Postgres schema and the `ingest_usage` function. |
| `web/` | Next.js app: landing page, dashboard (`/me`), share pages (`/s/<slug>`), share card images, method and privacy pages. |

## How syncing works

1. After each response the hook starts `dfmn.mjs sync` in the background and returns at once.
2. The sync reads only log files that changed (`~/.claude/projects`, `~/.codex/sessions`) and adds up tokens per file, model and day.
3. The server replaces the stored values for each file, model and day, so re-sending a file never counts it twice.
4. Days older than 35 days are rolled into one lifetime total per model and frozen, so storage per user stays bounded.

CLI commands: `link`, `sync`, `status`, `rescan` (rebuild your usage from local logs), `codex`, `set-api <url>`. Background sync errors go to `~/.dontfck/sync.log`.

## Self-hosting

1. Create a Supabase project and apply the migrations (`supabase link`, then `supabase db push`).
2. Deploy `web/` to Vercel (root directory `web`) with the variables in `web/.env.example`:
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_GITHUB_REPO`.
3. Point the CLI at your deployment: `node cli/bin/dfmn.mjs set-api https://your-deployment.example`, or change `DEFAULT_API` in `cli/bin/dfmn.mjs` for your own fork.

All database access goes through the Next.js API with the service role key. Row-level security is on with no policies, so the public API key can't read or write anything.

## Development

```bash
cd web
npm install
cp .env.example .env   # fill in your Supabase project
npm run dev
```

`npx tsc --noEmit` and `npm run lint` should both pass.

## Known gaps

- `/api/register` and `/api/ingest` have no rate limiting yet.
- Daily-use figures for Australia and UAE electricity, and UAE and world water, are proxies.
- If Claude Code copies earlier messages into a new log file (for example a forked session), those messages are counted again.
- Model tiers are matched by name; unknown Claude models count as Sonnet and unknown OpenAI models as GPT-5.2.

## License

MIT. See [LICENSE](LICENSE).

Created by Vedant Karle ([vedantkarle.in](https://vedantkarle.in)).
