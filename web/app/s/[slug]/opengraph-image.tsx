import { CARD_SIZE, renderCard } from "@/lib/card";
import { loadShared } from "@/lib/share";

export const alt = "AI water, energy and CO₂ used, saved and balance";
export const size = CARD_SIZE;
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await loadShared(slug);
  if (!d) return new Response("Not found", { status: 404 });
  return renderCard({ ...d, footnote: "Lifetime · Claude Code + Codex · mid estimate" });
}
