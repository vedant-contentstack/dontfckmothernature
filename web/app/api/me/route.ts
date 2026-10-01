import { profileFromRequest } from "@/lib/db";
import { loadSummary } from "@/lib/summary";

export async function GET(req: Request) {
  const profile = await profileFromRequest(req);
  if (!profile) return Response.json({ error: "This link is not valid. Run /footprint in Claude Code to get yours." }, { status: 401 });
  const today = new URL(req.url).searchParams.get("today") ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return Response.json({ error: "Bad date." }, { status: 400 });
  return Response.json(await loadSummary(profile, today));
}
