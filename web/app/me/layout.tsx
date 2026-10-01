import type { Metadata } from "next";

// The dashboard is private to whoever holds the link; keep it out of search results.
export const metadata: Metadata = { title: "My dashboard", robots: { index: false, follow: false } };

export default function MeLayout({ children }: LayoutProps<"/me">) {
  return children;
}
