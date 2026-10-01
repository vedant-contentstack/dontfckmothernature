import { db, profileFromRequest } from "@/lib/db";

type Row = {
  source: "claude" | "codex";
  session_key: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_write_tokens: number;
  cache_read_tokens: number;
  first_at: string;
  last_at: string;
};

const MAX_ROWS = 500;
const COUNT_FIELDS = ["input_tokens", "output_tokens", "cache_write_tokens", "cache_read_tokens"] as const;

function valid(r: Partial<Row>): r is Row {
  return (
    (r.source === "claude" || r.source === "codex") &&
    typeof r.session_key === "string" && /^[a-f0-9]{40}$/.test(r.session_key) &&
    typeof r.model === "string" && r.model.length > 0 && r.model.length <= 80 &&
    COUNT_FIELDS.every((f) => Number.isSafeInteger(r[f]) && (r[f] as number) >= 0) &&
    typeof r.first_at === "string" && !Number.isNaN(Date.parse(r.first_at)) &&
    typeof r.last_at === "string" && !Number.isNaN(Date.parse(r.last_at))
  );
}

// Upserts per-file, per-model token totals sent by the CLI. Sending the same file twice is harmless.
export async function POST(req: Request) {
  const profile = await profileFromRequest(req);
  if (!profile) return Response.json({ error: "Unknown token. Run the setup again." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const rows: unknown[] = Array.isArray(body?.rows) ? body.rows : [];
  if (rows.length === 0) return Response.json({ upserted: 0 });
  if (rows.length > MAX_ROWS) return Response.json({ error: `Send at most ${MAX_ROWS} rows at a time.` }, { status: 413 });
  if (!rows.every((r) => valid(r as Partial<Row>))) return Response.json({ error: "One or more rows are malformed." }, { status: 400 });

  const records = (rows as Row[]).map((r) => ({
    user_id: profile.id,
    source: r.source,
    session_key: r.session_key,
    model: r.model,
    input_tokens: r.input_tokens,
    output_tokens: r.output_tokens,
    cache_write_tokens: r.cache_write_tokens,
    cache_read_tokens: r.cache_read_tokens,
    first_at: r.first_at,
    last_at: r.last_at,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await db().from("usage_sessions").upsert(records, { onConflict: "user_id,source,session_key,model" });
  if (error) return Response.json({ error: "Could not save usage. Try again." }, { status: 500 });
  return Response.json({ upserted: records.length });
}
