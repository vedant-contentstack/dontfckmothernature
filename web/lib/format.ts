import type { Impact } from "./footprint";

export type Factor = keyof Impact;
export const FACTORS: { key: Factor; label: string; unit: string }[] = [
  { key: "water", label: "Water", unit: "L" },
  { key: "energy", label: "Energy", unit: "kWh" },
  { key: "co2", label: "CO₂", unit: "kg CO₂" },
];

// One rule everywhere (strip, panels, share card): 2 decimals, or 1 from 1,000 up.
export function num(n: number): string {
  const a = Math.abs(n);
  const digits = a >= 1000 ? 1 : 2;
  return a.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function signed(n: number): string {
  const s = num(n);
  if (s.replace(/[0.,]/g, "") === "") return s;
  return (n > 0 ? "+" : "−") + s;
}

export type BalanceState = "debt" | "even" | "credit";

// Average share of the footprint paid back across the three factors.
export function balanceState(used: Impact, saved: Impact): BalanceState {
  // Each factor counts at most 100%, so a big water saving cannot hide an energy debt.
  const ratios = FACTORS.map(({ key }) => (used[key] > 0 ? Math.min(saved[key] / used[key], 1) : 1));
  const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  if (avg >= 0.999) return "credit";
  if (avg >= 0.9) return "even";
  return "debt";
}

export const HEADLINE: Record<BalanceState, string> = {
  debt: "I owe Mother Nature",
  even: "Almost square with Mother Nature",
  credit: "Mother Nature owes me one",
};

export function shortTokens(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}

export function ago(iso: string, now = Date.now()): string {
  const mins = Math.round((now - Date.parse(iso)) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}
