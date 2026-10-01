import { db, profileFromRequest } from "@/lib/db";

// Clears the caller's usage rows (not their savings) so the CLI can rebuild them with a full rescan.
// Used by `dontfckmothernature rescan`; the profile comes only from the caller's own token.
export async function DELETE(req: Request) {
  const profile = await profileFromRequest(req);
  if (!profile) return Response.json({ error: "Unknown token." }, { status: 401 });
  for (const table of ["usage_daily", "usage_totals", "devices"]) {
    const { error } = await db().from(table).delete().eq("user_id", profile.id);
    if (error) return Response.json({ error: "Could not clear usage. Try again." }, { status: 500 });
  }
  return Response.json({ cleared: true });
}
