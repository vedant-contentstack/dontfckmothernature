import { actionById, type DailyAction, type OnetimeAction, type Saving } from "./actions";
import { country as getCountry } from "./countries";
import type { Impact } from "./footprint";

export type OffsetLog = {
  id: number;
  kind: "daily" | "onetime" | "custom";
  action_id: string | null;
  quantity: number;
  factor: "water" | "energy" | "co2" | null;
  amount: number | null;
  note: string | null;
  logged_on: string; // YYYY-MM-DD
};

// Limits per day, as a share of the user's country daily use.
export const CUSTOM_SHARE = 0.5;
export const TOTAL_SHARE = 1.0;

const DAY_MS = 86_400_000;
const MONTH_DAYS = 30.44;

const zero = (): Impact => ({ water: 0, energy: 0, co2: 0 });

// Electricity savings also cut CO2 at the user's grid intensity.
function toImpact(s: Saving, times: number, gridG: number): Impact {
  const energy = (s.energy ?? 0) * times;
  return {
    water: (s.water ?? 0) * times,
    energy,
    co2: (s.co2 ?? 0) * times + (energy * gridG) / 1000,
  };
}

function add(a: Impact, b: Impact): Impact {
  return { water: a.water + b.water, energy: a.energy + b.energy, co2: a.co2 + b.co2 };
}

function capEach(a: Impact, cap: Impact): Impact {
  return { water: Math.min(a.water, cap.water), energy: Math.min(a.energy, cap.energy), co2: Math.min(a.co2, cap.co2) };
}

function scale(a: Impact, k: number): Impact {
  return { water: a.water * k, energy: a.energy * k, co2: a.co2 * k };
}

export function dailyLimits(countryCode: string) {
  const c = getCountry(countryCode);
  return { custom: scale(c.daily, CUSTOM_SHARE), total: scale(c.daily, TOTAL_SHARE) };
}

export type SavingsResult = {
  total: Impact;
  habits: Impact;   // daily + custom, after limits
  onetime: Impact;
  today: { counted: Impact; limit: Impact; customCounted: Impact; customLimit: Impact };
};

export function computeSavings(logs: OffsetLog[], countryCode: string, today: string, now = Date.now()): SavingsResult {
  const c = getCountry(countryCode);
  const limits = dailyLimits(countryCode);

  const byDay = new Map<string, OffsetLog[]>();
  let onetime = zero();

  for (const log of logs) {
    if (log.kind === "onetime") {
      const a = actionById(log.action_id ?? "") as OnetimeAction | undefined;
      if (!a) continue;
      const elapsed = (now - Date.parse(log.logged_on + "T00:00:00Z")) / DAY_MS / MONTH_DAYS;
      const months = Math.max(0, Math.min(elapsed, a.months));
      onetime = add(onetime, toImpact(a.perMonth, months * log.quantity, c.gridG));
    } else {
      const list = byDay.get(log.logged_on) ?? [];
      list.push(log);
      byDay.set(log.logged_on, list);
    }
  }

  let habits = zero();
  let todayInfo = { counted: zero(), customCounted: zero() };

  for (const [day, list] of byDay) {
    let daily = zero();
    let custom = zero();
    const used = new Map<string, number>();

    for (const log of list) {
      if (log.kind === "daily") {
        const a = actionById(log.action_id ?? "") as DailyAction | undefined;
        if (!a) continue;
        const already = used.get(a.id) ?? 0;
        const times = Math.max(0, Math.min(log.quantity, a.cap - already));
        used.set(a.id, already + times);
        daily = add(daily, toImpact(a.per, times, c.gridG));
      } else if (log.factor && log.amount) {
        custom = add(custom, toImpact({ [log.factor]: log.amount }, 1, c.gridG));
      }
    }

    const customCounted = capEach(custom, limits.custom);
    const counted = capEach(add(daily, customCounted), limits.total);
    habits = add(habits, counted);
    if (day === today) todayInfo = { counted, customCounted };
  }

  return {
    total: add(habits, onetime),
    habits,
    onetime,
    today: { ...todayInfo, limit: limits.total, customLimit: limits.custom },
  };
}

// How many more times a daily action can be logged on a day.
export function remainingForAction(logs: OffsetLog[], actionId: string, day: string): number {
  const a = actionById(actionId);
  if (!a || a.kind !== "daily") return 0;
  const done = logs
    .filter((l) => l.kind === "daily" && l.action_id === actionId && l.logged_on === day)
    .reduce((s, l) => s + l.quantity, 0);
  return Math.max(0, a.cap - done);
}
