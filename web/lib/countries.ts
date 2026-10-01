// Grid carbon intensity: Ember yearly electricity data, 2025 (UAE 2024), location-based, g CO2e/kWh.
// Daily use per person drives the saving limits (researched 1 Oct 2026):
//   water   household L per person per day, national statistics (year varies, 2021–2025)
//   energy  household electricity kWh per day (Eurostat 2024, EIA 2024, StatCan, national agencies)
//   co2     fossil CO2 per person per day, Global Carbon Project 2024 via Our World in Data
// Less certain: India 135 L is a supply norm; Japan water is Tokyo; Australia and UAE electricity and
// UAE water are proxies (UAE uses the low end); world water is municipal withdrawal, an upper bound.

export type Country = {
  code: string;
  name: string;
  gridG: number;
  daily: { water: number; energy: number; co2: number }; // L, kWh (household), kg
};

export const COUNTRIES: Country[] = [
  { code: "IN", name: "India", gridG: 671, daily: { water: 135, energy: 3.3, co2: 6.0 } },
  { code: "US", name: "United States", gridG: 384, daily: { water: 310, energy: 28.4, co2: 38.9 } },
  { code: "GB", name: "United Kingdom", gridG: 217, daily: { water: 136.5, energy: 7.4, co2: 12.4 } },
  { code: "DE", name: "Germany", gridG: 330, daily: { water: 121, energy: 8.7, co2: 18.5 } },
  { code: "FR", name: "France", gridG: 41, daily: { water: 150, energy: 12.9, co2: 10.9 } },
  { code: "NL", name: "Netherlands", gridG: 254, daily: { water: 117, energy: 6.9, co2: 17.3 } },
  { code: "CA", name: "Canada", gridG: 191, daily: { water: 223, energy: 29.8, co2: 36.8 } },
  { code: "AU", name: "Australia", gridG: 525, daily: { water: 187, energy: 16, co2: 39.7 } },
  { code: "JP", name: "Japan", gridG: 477, daily: { water: 221, energy: 10.7, co2: 21.3 } },
  { code: "CN", name: "China", gridG: 526, daily: { water: 127, energy: 7.6, co2: 23.7 } },
  { code: "BR", name: "Brazil", gridG: 110, daily: { water: 148, energy: 5.8, co2: 6.2 } },
  { code: "SG", name: "Singapore", gridG: 497, daily: { water: 142, energy: 12.5, co2: 25.3 } },
  { code: "AE", name: "United Arab Emirates", gridG: 468, daily: { water: 285, energy: 35, co2: 55.2 } },
  { code: "XX", name: "Other (world average)", gridG: 458, daily: { water: 183, energy: 7.7, co2: 13.0 } },
];

export function country(code: string): Country {
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[COUNTRIES.length - 1];
}
