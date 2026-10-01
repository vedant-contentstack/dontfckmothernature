import { db, profileFromRequest } from "@/lib/db";

export async function DELETE(req: Request, ctx: RouteContext<"/api/offsets/[id]">) {
  const profile = await profileFromRequest(req);
  if (!profile) return Response.json({ error: "Unknown token." }, { status: 401 });
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return Response.json({ error: "Bad id." }, { status: 400 });

  const { error } = await db().from("offset_logs").delete().eq("id", Number(id)).eq("user_id", profile.id);
  if (error) return Response.json({ error: "Could not remove that entry." }, { status: 500 });
  return Response.json({ ok: true });
}
