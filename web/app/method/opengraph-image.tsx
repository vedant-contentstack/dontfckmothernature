import { SOCIAL_SIZE, renderSocial } from "@/lib/social";

export const alt = "How dontfckmothernature works out water, energy and CO₂ from tokens";
export const size = SOCIAL_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderSocial({
    eyebrow: "Method",
    title: "How tokens become litres, kWh and kg of CO₂.",
    note: "Measured energy per token, per-request cache cost, and an honest range.",
  });
}
