import { SOCIAL_SIZE, renderSocial } from "@/lib/social";

export const alt = "dontfckmothernature: the water, energy and CO₂ behind your AI usage";
export const size = SOCIAL_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderSocial({
    eyebrow: "Plugin · open source",
    title: "Your AI uses water, power and CO₂. Pay it back.",
    note: "A Claude Code plugin that tracks your AI footprint and a checklist to clear it.",
  });
}
