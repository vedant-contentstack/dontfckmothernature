# dontfckmothernature

Shows the water, energy and CO₂ behind your Claude Code and Codex usage, and lets you log everyday savings against it.

## What is in this repo

| Path | What it is |
|---|---|
| `.claude-plugin/`, `hooks/`, `commands/` | The Claude Code plugin. The repo root is both the marketplace and the plugin. A `Stop` hook runs a sync after every response; `/footprint` prints the dashboard link. |
| `cli/bin/dfmn.mjs` | The sync script, one file with no dependencies. Used by the plugin and published to npm for Codex (`npx dontfckmothernature codex`). |
| `supabase/migrations/` | Database schema. |
| `web/` | Next.js app: landing page, dashboard (`/me`), public share page (`/s/<slug>`) and the share card image. |

## How the data flows

1. After each response, the hook starts `dfmn.mjs sync` in the background and returns straight away.
2. The sync reads every `.jsonl` log changed since the last run (`~/.claude/projects`, `~/.codex/sessions`), adds up tokens per model, and sends the totals to `/api/ingest`. Totals are per log file, so sending a file twice changes nothing.
3. The first run registers an anonymous profile and keeps the private token in `~/.dontfck/config.json`.
4. The dashboard link is `/me#<token>`. The token sits after `#`, so it never reaches server logs.

Uploaded: token counts, model name, timestamps, and a SHA-1 of each log file path. Never uploaded: prompts, code, folder names.

## Setup

1. Create a Supabase project. In the SQL editor, run `supabase/migrations/20261001000000_init.sql` (or `supabase link` then `supabase db push`).
2. Deploy `web/` to Vercel with root directory `web` and these env vars from `web/.env.example`:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Project settings → API)
   - `NEXT_PUBLIC_GITHUB_REPO`, the GitHub repo that hosts this plugin
3. Set `DEFAULT_API` at the top of `cli/bin/dfmn.mjs` to the deployed URL.
4. Push this repo to GitHub, then in Claude Code:
   ```
   /plugin marketplace add <github-user>/dontfckmothernature
   /plugin install dontfckmothernature@dontfckmothernature
   /footprint
   ```
5. For Codex, publish the CLI (`cd cli && npm publish`) and run `npx dontfckmothernature codex`. Before publishing, run `node cli/bin/dfmn.mjs codex` from the repo to test it.

Useful commands: `node cli/bin/dfmn.mjs status`, `... sync`, `... set-api <url>`. Errors from background syncs go to `~/.dontfck/sync.log`.

## Numbers

- AI footprint: `web/lib/footprint.ts`. Tokens are weighted (output 1, input 0.2, cache write 0.25, cache read 0.02 at mid), multiplied by Wh per 1K output tokens for the model tier, then converted with 348 g CO₂/kWh and 4.61 L/kWh at mid. Low and high bands use the low and high value of every coefficient.
- Savings: `web/lib/actions.ts` (17 daily habits, 8 one-time actions, conservative values) and `web/lib/savings.ts`.
- Limits: custom entries count up to 50% of the country's average daily use, and all daily savings together up to 100% (`web/lib/countries.ts`). One-time actions are not limited.

## Known gaps

- Daily-use figures are sourced for India and the US only. Other countries use rough placeholders.
- If Claude Code copies earlier messages into a new log file (for example, a forked session), those messages are counted again.
- Model tiers are matched by name. Unknown Claude models count as Sonnet, and unknown OpenAI models as GPT-5.2.
