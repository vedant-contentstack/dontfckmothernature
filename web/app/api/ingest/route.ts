import { db, profileFromRequest } from "@/lib/db";

type Row = {
  source: "claude" | "codex";
  session_key: string;
  model: string;
  day: string;
  input_tokens: number;
  output_tokens: number;
  cache_write_tokens: number;
  cache_read_tokens: number;
  first_at: string;
  last_at: string;
};

const MAX_ROWS = 500;
const WINDOW_DAYS = 35;
const COUNT_FIELDS = ["input_tokens", "output_tokens", "cache_write_tokens", "cache_read_tokens"] as const;

function valid(r: Partial<Row>): r is Row {
  return (
    (r.source === "claude" || r.source === "codex") &&
    typeof r.session_key === "string" && /^[a-f0-9]{40}$/.test(r.session_key) &&
    typeof r.model === "string" && r.model.length > 0 && r.model.length <= 80 &&
    typeof r.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.day) &&
    COUNT_FIELDS.every((f) => Number.isSafeInteger(r[f]) && (r[f] as number) >= 0) &&
    typeof r.first_at === "string" && !Number.isNaN(Date.parse(r.first_at)) &&
    typeof r.last_at === "string" && !Number.isNaN(Date.parse(r.last_at))
  );
}

// Receives per-file, per-model, per-day token totals from the CLI. Rows replace earlier values for the
// same key, days older than the window are rolled into lifetime totals, and frozen days are ignored.
export async function POST(req: Request) {
  const profile = await profileFromRequest(req);
  if (!profile) return Response.json({ error: "Unknown token. Run the setup again." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const rows: unknown[] = Array.isArray(body?.rows) ? body.rows : [];
  const device = body?.device_id;

  if (typeof device !== "string" || !/^[A-Za-z0-9_-]{8,40}$/.test(device)) {
    return Response.json({ error: "This plugin version is out of date. Update dontfckmothernature with /plugin." }, { status: 426 });
  }
  if (rows.length > MAX_ROWS) return Response.json({ error: `Send at most ${MAX_ROWS} rows at a time.` }, { status: 413 });
  if (!rows.every((r) => valid(r as Partial<Row>))) return Response.json({ error: "One or more rows are malformed." }, { status: 400 });

  const cutoff = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await db().rpc("ingest_usage", { p_user: profile.id, p_device: device, p_rows: rows, p_cutoff: cutoff, p_final: body?.final !== false });
  if (error) return Response.json({ error: "Could not save usage. Try again." }, { status: 500 });
  return Response.json({ upserted: data });
}
