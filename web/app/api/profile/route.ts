import { COUNTRIES } from "@/lib/countries";
import { db, newSlug, profileFromRequest } from "@/lib/db";

// Updates country and turns the public share link on or off.
export async function PATCH(req: Request) {
  const profile = await profileFromRequest(req);
  if (!profile) return Response.json({ error: "Unknown token." }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};

  if (b.country !== undefined) {
    if (!COUNTRIES.some((c) => c.code === b.country)) return Response.json({ error: "Unknown country." }, { status: 400 });
    patch.country = b.country;
  }
  if (b.share === true && !profile.share_slug) patch.share_slug = newSlug();
  if (b.share === false) patch.share_slug = null;

  if (Object.keys(patch).length === 0) return Response.json({ country: profile.country, share_slug: profile.share_slug });

  const { data, error } = await db().from("profiles").update(patch).eq("id", profile.id).select("country, share_slug").single();
  if (error) return Response.json({ error: "Could not save that change." }, { status: 500 });
  return Response.json(data);
}

// Deletes the caller's profile. Usage rows, devices and logged savings go with it (on delete cascade).
// The profile is found only from the caller's own token, so no request can name another user.
export async function DELETE(req: Request) {
  const profile = await profileFromRequest(req);
  if (!profile) return Response.json({ error: "Unknown token." }, { status: 401 });
  const { error } = await db().from("profiles").delete().eq("id", profile.id);
  if (error) return Response.json({ error: "Could not delete your data. Try again." }, { status: 500 });
  return Response.json({ deleted: true });
}
