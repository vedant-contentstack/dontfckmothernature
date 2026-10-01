import "server-only";
import { db, type Profile } from "./db";
import { balanceState } from "./format";
import { loadSummary } from "./summary";

// Public view of a shared profile: only the three totals, nothing else.
export async function loadShared(slug: string) {
  if (!/^[A-Za-z0-9_-]{8,20}$/.test(slug)) return null;
  const { data } = await db().from("profiles").select("id, country, share_slug, created_at").eq("share_slug", slug).maybeSingle<Profile>();
  if (!data) return null;
  const s = await loadSummary(data, new Date().toISOString().slice(0, 10));
  return {
    used: s.used.mid,
    saved: s.saved.total,
    balance: s.balance.mid,
    state: balanceState(s.used.mid, s.saved.total),
    since: s.firstAt,
  };
}
