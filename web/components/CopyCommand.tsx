"use client";

import { useState } from "react";

export function CopyCommand({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="code box">
      <code>{text}</code>
      <button
        type="button"
        className="btn"
        onClick={async () => {
          await navigator.clipboard.writeText(text).catch(() => {});
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copied" : label}
      </button>
    </div>
  );
}
