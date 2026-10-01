import { actionById } from "@/lib/actions";
import { db, profileFromRequest } from "@/lib/db";
import { remainingForAction, type OffsetLog } from "@/lib/savings";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Logs a checklist action, a one-time action or a custom saving.
export async function POST(req: Request) {
  const profile = await profileFromRequest(req);
  if (!profile) return Response.json({ error: "Unknown token." }, { status: 401 });

  const b = await req.json().catch(() => null);
  if (!b || !DATE.test(b.logged_on ?? "")) return Response.json({ error: "Pick a valid date." }, { status: 400 });

  // Allow one day of slack either side for time zones, nothing further in the future.
  if (Date.parse(b.logged_on) > Date.now() + 86_400_000) return Response.json({ error: "That date is in the future." }, { status: 400 });

  const note = typeof b.note === "string" ? b.note.trim().slice(0, 140) || null : null;
  let row: Record<string, unknown>;

  if (b.kind === "custom") {
    const amount = Number(b.amount);
    if (!["water", "energy", "co2"].includes(b.factor) || !(amount > 0) || amount > 100_000) {
      return Response.json({ error: "Choose water, energy or CO₂ and enter an amount above zero." }, { status: 400 });
    }
    if (!note) return Response.json({ error: "Add a short note about what you did." }, { status: 400 });
    row = { kind: "custom", factor: b.factor, amount, note };
  } else {
    const action = actionById(b.action_id ?? "");
    if (!action || action.kind !== b.kind) return Response.json({ error: "Unknown action." }, { status: 400 });
    const quantity = Number(b.quantity ?? 1);
    if (!(quantity > 0) || quantity > 10_000) return Response.json({ error: "Enter a quantity above zero." }, { status: 400 });

    if (action.kind === "daily") {
      if (!Number.isInteger(quantity)) return Response.json({ error: "Daily actions are logged in whole numbers." }, { status: 400 });
      const { data } = await db()
        .from("offset_logs")
        .select("id, kind, action_id, quantity, factor, amount, note, logged_on")
        .eq("user_id", profile.id)
        .eq("action_id", action.id)
        .eq("logged_on", b.logged_on);
      const left = remainingForAction((data ?? []) as OffsetLog[], action.id, b.logged_on);
      if (quantity > left) {
        return Response.json({ error: `You can log "${action.name}" ${action.cap} times a day. ${left} left for that day.` }, { status: 409 });
      }
    }
    row = { kind: action.kind, action_id: action.id, quantity, note };
  }

  const { data, error } = await db()
    .from("offset_logs")
    .insert({ ...row, user_id: profile.id, logged_on: b.logged_on })
    .select("id")
    .single();
  if (error) return Response.json({ error: "Could not save that. Try again." }, { status: 500 });
  return Response.json({ id: data.id });
}
