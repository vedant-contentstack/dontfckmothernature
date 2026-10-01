import Link from "next/link";

export function Header() {
  return (
    <header className="top">
      <Link href="/" className="brand">
        dontfckmothernature<span className="caret">_</span>
      </Link>
      <nav className="nav">
        <Link href="/#install">Install</Link>
        <Link href="/method">Method</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/me">My dashboard</Link>
      </nav>
    </header>
  );
}
