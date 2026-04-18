import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

export default function UniqueIdBadge({ value, testid = "unique-id-badge", multiline = false }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <button
      onClick={copy}
      data-testid={testid}
      className={
        "inline-flex items-start gap-2 px-3 py-1.5 bg-[#d4a373]/10 border border-dashed border-[#d4a373]/50 text-[#d4a373] font-mono text-xs tracking-widest rounded-sm hover:bg-[#d4a373]/20 transition-colors text-left " +
        (multiline
          ? "max-w-full whitespace-normal break-all leading-relaxed"
          : "")
      }
      title="Click to copy"
    >
      {copied ? <Check size={13} className="mt-0.5 shrink-0" /> : <Copy size={13} className="mt-0.5 shrink-0" />}
      <span className={multiline ? "break-all" : "truncate max-w-[280px]"}>{value}</span>
    </button>
  );
}
