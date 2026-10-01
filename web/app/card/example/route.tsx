import { EXAMPLE, renderCard } from "@/lib/card";

export async function GET() {
  return renderCard(EXAMPLE);
}
