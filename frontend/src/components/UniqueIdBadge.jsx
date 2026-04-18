import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

export default function UniqueIdBadge({ value, testid = "unique-id-badge" }) {
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
      className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#FACC15]/10 border border-dashed border-[#FACC15]/50 text-[#FACC15] font-mono text-xs tracking-widest rounded-sm hover:bg-[#FACC15]/20 transition-colors"
      title="Click to copy"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      <span className="truncate max-w-[280px]">{value}</span>
    </button>
  );
}
