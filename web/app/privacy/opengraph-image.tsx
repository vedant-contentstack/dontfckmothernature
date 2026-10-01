import { SOCIAL_SIZE, renderSocial } from "@/lib/social";

export const alt = "dontfckmothernature privacy";
export const size = SOCIAL_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderSocial({
    eyebrow: "Privacy",
    title: "Token counts only. Never your prompts or code.",
    note: "No accounts, no emails. Delete everything with one button.",
  });
}
