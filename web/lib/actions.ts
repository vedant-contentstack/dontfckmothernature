// Offset catalogue. Conservative values everywhere a source gives a range.
// Electricity savings are stored as kWh only; CO2 for them comes from the user's country grid.
// `co2` here is direct CO2e (fuel, food, plastic), in kg.

export type Saving = { water?: number; energy?: number; co2?: number };

export type Category = "water" | "electricity" | "travel" | "food";

export const CATEGORIES: { id: Category; label: string; hint: string }[] = [
  { id: "water", label: "Water", hint: "Showers, taps, laundry" },
  { id: "electricity", label: "Electricity", hint: "AC, lights, appliances" },
  { id: "travel", label: "Travel", hint: "Instead of driving" },
  { id: "food", label: "Food and plastic", hint: "Meals and bottles" },
];

export type DailyAction = {
  id: string;
  kind: "daily";
  category: Category;
  name: string;
  per: Saving;      // per logged instance (India values for travel; see `drive`)
  cap: number;      // max instances per day
  // Travel instead of driving: CO2 = (country car kg/km − alternative kg/passenger-km) × km.
  drive?: { km: number; alternative: number };
  note: string;
};

export type OnetimeAction = {
  id: string;
  kind: "onetime";
  name: string;
  unit: string;     // what the quantity counts
  perMonth: Saving; // per unit
  months: number;   // how long the saving keeps accruing
  note: string;
};

export const DAILY: DailyAction[] = [
  { id: "shower5", kind: "daily", category: "water", name: "Shower 5 min shorter", per: { water: 47 }, cap: 2, note: "9.5 L/min standard showerhead (EPA). Heater energy not counted." },
  { id: "bucket", kind: "daily", category: "water", name: "Bucket bath instead of shower", per: { water: 35 }, cap: 1, note: "55 L bathing norm vs a 20 L bucket." },
  { id: "brush", kind: "daily", category: "water", name: "Tap off while brushing", per: { water: 15 }, cap: 2, note: "EPA: 8 gal/day across two brushings." },
  { id: "fullload", kind: "daily", category: "water", name: "Skipped a half load, ran a full one", per: { water: 53 }, cap: 1, note: "Energy Star: 14 vs 20 gal per load." },
  { id: "ro", kind: "daily", category: "water", name: "Reused a bucket of RO reject water", per: { water: 15 }, cap: 2, note: "15 L bucket." },
  { id: "bottle", kind: "daily", category: "food", name: "Reusable bottle instead of 1 L bottled water", per: { water: 2, co2: 0.08 }, cap: 4, note: "Pacific Institute: 3 L water and 0.08 kg CO2 per 1 L bottle." },
  { id: "acoff", kind: "daily", category: "electricity", name: "AC off for 1 hour", per: { energy: 0.46 }, cap: 8, note: "BEE label, 5-star 1.5 t inverter AC." },
  { id: "acset", kind: "daily", category: "electricity", name: "AC set 2 °C higher all day", per: { energy: 0.44 }, cap: 1, note: "BEE: 6% per °C on 8 h of use." },
  { id: "linedry", kind: "daily", category: "electricity", name: "Line-dried a load instead of the dryer", per: { energy: 2.5 }, cap: 2, note: "Low end of 2.5–4.5 kWh per dryer load." },
  { id: "coldwash", kind: "daily", category: "electricity", name: "Cold wash instead of warm", per: { energy: 0.5 }, cap: 2, note: "Estimate; water heating is about 90% of washer energy." },
  { id: "lights", kind: "daily", category: "electricity", name: "Lights and fan off in an empty room, 1 hour", per: { energy: 0.09 }, cap: 8, note: "75 W fan plus two 9 W LEDs." },
  { id: "pcoff", kind: "daily", category: "electricity", name: "Shut the computer down overnight", per: { energy: 0.08 }, cap: 1, note: "Laptop idle 10 W for 8 h." },
  { id: "walk10", kind: "daily", category: "travel", name: "Walked or cycled 10 km instead of driving", per: { co2: 1.3 }, cap: 6, note: "India GHG Program, petrol hatchback 0.13 kg/km." },
  { id: "bus10", kind: "daily", category: "travel", name: "Bus for 10 km instead of driving", per: { co2: 1.15 }, cap: 6, note: "Car 0.13 minus city bus 0.015 kg/passenger-km." },
  { id: "metro10", kind: "daily", category: "travel", name: "Metro or train for 10 km instead of driving", per: { co2: 1.22 }, cap: 6, note: "Car 0.13 minus rail 0.008 kg/passenger-km." },
  { id: "wfh10", kind: "daily", category: "travel", name: "Worked from home, 10 km of driving avoided", per: { co2: 1.3 }, cap: 6, note: "Same car factor; extra home energy not subtracted." },
  { id: "vegmeal", kind: "daily", category: "food", name: "Plant-based meal instead of chicken", per: { water: 73, co2: 1.37 }, cap: 3, note: "Poore & Nemecek: 150 g chicken vs 60 g pulses." },
];

export const ONETIME: OnetimeAction[] = [
  { id: "tree", kind: "onetime", name: "Planted a tree", unit: "trees", perMonth: { co2: 1.8 }, months: 120, note: "22 kg CO2 a year, for 10 years." },
  { id: "led", kind: "onetime", name: "Replaced a 60 W bulb with LED", unit: "bulbs", perMonth: { energy: 6.1 }, months: 120, note: "9 W LED, 4 h a day." },
  { id: "tap", kind: "onetime", name: "Fixed a dripping tap", unit: "taps", perMonth: { water: 110 }, months: 12, note: "10 drips a minute; counted for one year." },
  { id: "showerhead", kind: "onetime", name: "Installed a low-flow showerhead", unit: "showerheads", perMonth: { water: 852 }, months: 120, note: "EPA WaterSense: 2,700 gal a year per family." },
  { id: "aerator", kind: "onetime", name: "Installed a tap aerator", unit: "taps", perMonth: { water: 221 }, months: 120, note: "EPA WaterSense: 700 gal a year per household." },
  { id: "ac5star", kind: "onetime", name: "Bought a 5-star AC instead of 3-star", unit: "ACs", perMonth: { energy: 22.3 }, months: 120, note: "BEE label: 1,008 vs 740 kWh a year." },
  { id: "solar", kind: "onetime", name: "Installed rooftop solar", unit: "kW", perMonth: { energy: 92 }, months: 300, note: "Low end: 1,100 kWh a year per kW; India is about 120 a month." },
  { id: "rain", kind: "onetime", name: "Set up rainwater harvesting", unit: "m² of roof", perMonth: { water: 77 }, months: 240, note: "1,160 mm rain × 0.8 runoff, India average." },
];

export const ACTIONS = [...DAILY, ...ONETIME];

export function actionById(id: string) {
  return ACTIONS.find((a) => a.id === id);
}
