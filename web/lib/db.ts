import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

export const hashSecret = (token: string) => createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");
export const newSlug = () => randomBytes(9).toString("base64url");

export type Profile = { id: string; country: string; share_slug: string | null; created_at: string };

// Resolves the bearer token on a request to a profile, or null.
export async function profileFromRequest(req: Request): Promise<Profile | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (token.length < 20 || token.length > 100) return null;
  const { data } = await db()
    .from("profiles")
    .select("id, country, share_slug, created_at")
    .eq("secret_hash", hashSecret(token))
    .maybeSingle();
  return data;
}
