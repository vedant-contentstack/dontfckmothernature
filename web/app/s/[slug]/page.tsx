import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Panels } from "@/components/Panels";
import { HEADLINE } from "@/lib/format";
import { loadShared } from "@/lib/share";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/s/[slug]">) {
  const d = await loadShared((await params).slug);
  return { title: d ? `${HEADLINE[d.state]} · dontfckmothernature` : "dontfckmothernature" };
}

export default async function SharedPage({ params }: PageProps<"/s/[slug]">) {
  const d = await loadShared((await params).slug);
  if (!d) notFound();
  return (
    <main className="wrap">
      <Header />
      <section className="section">
        <span className="label muted">Shared balance{d.since ? ` · since ${new Date(d.since).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}` : ""}</span>
        <h1>{HEADLINE[d.state]}</h1>
        <p className="lede">Water, energy and CO₂ behind this person&rsquo;s Claude Code and Codex usage, minus what they saved in daily life. AI figures are mid estimates.</p>
      </section>
      <Panels used={d.used} saved={d.saved} balance={d.balance} state={d.state} />
      <div>
        <Link href="/#install" className="btn go">See your own numbers</Link>
      </div>
      <p className="muted small">This is a read-only share page. It shows three totals and cannot change or delete anything.</p>
    </main>
  );
}
