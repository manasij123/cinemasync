import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

function initialsFromName(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    const p = parts[0];
    return (p.length >= 2 ? p.slice(0, 2) : p[0]).toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Shows the full unique-id "pill" on md+ screens, collapses to a circular
 * avatar button (profile picture or initials) on narrow screens to avoid
 * wrapping / overlapping the greeting. Clicking either copies the unique ID.
 */
export default function UniqueIdBadge({
  value,
  user,
  testid = "unique-id-badge",
  multiline = false,
  collapse = true, // set false to always show the full pill
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const initials = initialsFromName(user?.name);
  const avatarImg = user?.profile_image;

  // Tailwind visibility:
  //   multiline  → always show full pill (used on profile page)
  //   collapse   → pill hidden < md, avatar shown < md
  //   !collapse  → always show pill
  const pillClass = multiline || !collapse ? "inline-flex" : "hidden md:inline-flex";
  const avatarClass = multiline || !collapse ? "hidden" : "inline-flex md:hidden";

  return (
    <>
      {/* Full pill (md and up) */}
      <button
        onClick={copy}
        data-testid={testid}
        title="Click to copy unique ID"
        className={
          pillClass +
          " items-start gap-2 px-3 py-1.5 bg-[#6a14ff]/10 border border-dashed border-[#6a14ff]/50 text-[#6a14ff] font-mono text-xs tracking-widest rounded-sm hover:bg-[#6a14ff]/20 transition-colors text-left " +
          (multiline ? "max-w-full whitespace-normal break-all leading-relaxed" : "")
        }
      >
        {copied ? <Check size={13} className="mt-0.5 shrink-0" /> : <Copy size={13} className="mt-0.5 shrink-0" />}
        <span className={multiline ? "break-all" : "truncate max-w-[180px] lg:max-w-[260px]"}>{value}</span>
      </button>

      {/* Collapsed avatar (below md) */}
      <button
        onClick={copy}
        data-testid={`${testid}-avatar`}
        title={copied ? "Copied!" : `Copy ${value}`}
        className={
          avatarClass +
          " relative items-center justify-center w-10 h-10 rounded-full overflow-hidden border border-[#6a14ff]/40 bg-[#6a14ff]/10 text-[#6a14ff] font-head text-sm shrink-0 hover:bg-[#6a14ff]/20 transition-colors"
        }
      >
        {avatarImg ? (
          <img src={avatarImg} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="tracking-wide">{initials}</span>
        )}
        {copied && (
          <span className="absolute inset-0 flex items-center justify-center bg-[#6a14ff] text-white">
            <Check size={16} />
          </span>
        )}
      </button>
    </>
  );
}
