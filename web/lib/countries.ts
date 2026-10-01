// Grid carbon intensity: Ember yearly electricity data, 2025 (UAE 2024), location-based, g CO2e/kWh.
// Daily use per person drives the saving limits. India and US are sourced; the rest are rough
// placeholders (world-average CO2, 150 L water, 10 kWh household electricity) until researched.
//   India: CPHEEO 135 L/day, BEE 2024 survey 98 kWh/month per household, 2.2 t CO2/yr.
//   US: EPA WaterSense 82 gal/day, EIA 2023 855 kWh/month per household, 17.3 t CO2/yr.

export type Country = {
  code: string;
  name: string;
  gridG: number;
  daily: { water: number; energy: number; co2: number }; // L, kWh (household), kg
};

const ROUGH = { water: 150, energy: 10, co2: 13.4 };

export const COUNTRIES: Country[] = [
  { code: "IN", name: "India", gridG: 671, daily: { water: 135, energy: 3.3, co2: 6.0 } },
  { code: "US", name: "United States", gridG: 384, daily: { water: 310, energy: 28, co2: 47 } },
  { code: "GB", name: "United Kingdom", gridG: 217, daily: ROUGH },
  { code: "DE", name: "Germany", gridG: 330, daily: ROUGH },
  { code: "FR", name: "France", gridG: 41, daily: ROUGH },
  { code: "NL", name: "Netherlands", gridG: 254, daily: ROUGH },
  { code: "CA", name: "Canada", gridG: 191, daily: ROUGH },
  { code: "AU", name: "Australia", gridG: 525, daily: ROUGH },
  { code: "JP", name: "Japan", gridG: 477, daily: ROUGH },
  { code: "CN", name: "China", gridG: 526, daily: ROUGH },
  { code: "BR", name: "Brazil", gridG: 110, daily: ROUGH },
  { code: "SG", name: "Singapore", gridG: 497, daily: ROUGH },
  { code: "AE", name: "United Arab Emirates", gridG: 468, daily: ROUGH },
  { code: "XX", name: "Other (world average)", gridG: 458, daily: ROUGH },
];

export function country(code: string): Country {
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[COUNTRIES.length - 1];
}
