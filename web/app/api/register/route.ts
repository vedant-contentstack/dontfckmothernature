import { db, hashSecret, newToken } from "@/lib/db";

// Creates an anonymous profile. The token is returned once and only its hash is stored.
export async function POST() {
  const token = newToken();
  const { error } = await db().from("profiles").insert({ secret_hash: hashSecret(token) });
  if (error) return Response.json({ error: "Could not create a profile. Try again." }, { status: 500 });
  return Response.json({ token });
}
