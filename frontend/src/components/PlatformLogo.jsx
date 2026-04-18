import React from "react";

// Brand metadata: logo asset + the tile background that best showcases it.
// We keep each logo visually "as-is" on a background that matches how the
// brand officially presents the mark (mostly white/neutral, plus dark for
// Hoichoi whose transparent PNG is white-on-dark).
export const PLATFORMS = {
  netflix:   { label: "Netflix",     short: "Netflix",  logo: "/ott-logos/netflix.svg",    bg: "#ffffff", fg: "#E50914", pad: "18%" },
  prime:     { label: "Prime Video", short: "Prime",    logo: "/ott-logos/prime.svg",      bg: "#ffffff", fg: "#00A8E1", pad: "16%" },
  hotstar:   { label: "JioHotstar",  short: "Hotstar",  logo: "/ott-logos/jiohotstar.png", bg: "#ffffff", fg: "#1a6aff", pad: "8%"  },
  hoichoi:   { label: "Hoichoi",     short: "Hoichoi",  logo: "/ott-logos/hoichoi.png",    bg: "#1a0b2e", fg: "#ffffff", pad: "12%" },
  addatimes: { label: "Addatimes",   short: "Adda",     logo: "/ott-logos/addatimes.jpg",  bg: "#ffffff", fg: "#e11d48", pad: "4%"  },
  zee5:      { label: "ZEE5",        short: "ZEE5",     logo: "/ott-logos/zee5.svg",       bg: "#ffffff", fg: "#7209b7", pad: "18%" },
  custom:    { label: "Custom",      short: "Custom",   logo: null,                        bg: "#fdf4ff", fg: "#7209b7", pad: "0%"  },
};

export const PLATFORM_LIST = Object.entries(PLATFORMS).map(([id, meta]) => ({ id, ...meta }));

export const platformLabel = (id) => PLATFORMS[id]?.label || "Custom";

/**
 * Square brand tile with the real logo rendered on its brand color.
 * size: "sm" | "md" | "lg" | number (px)
 */
export default function PlatformLogo({ platform = "custom", size = "md", rounded = "lg", className = "", showRing = false, testid }) {
  const meta = PLATFORMS[platform] || PLATFORMS.custom;
  const pxMap = { xs: 28, sm: 40, md: 56, lg: 80, xl: 120 };
  const px = typeof size === "number" ? size : (pxMap[size] || pxMap.md);
  const roundMap = { none: "0", sm: "6px", md: "10px", lg: "14px", xl: "18px", full: "9999px" };
  const radius = roundMap[rounded] ?? rounded;

  return (
    <div
      data-testid={testid || `platform-logo-${platform}`}
      className={`relative flex items-center justify-center overflow-hidden shrink-0 ${className}`}
      style={{
        width: px,
        height: px,
        background: meta.bg,
        borderRadius: radius,
        boxShadow: showRing ? `0 0 0 1px rgba(114,9,183,0.25), 0 4px 12px rgba(26,11,46,0.15)` : undefined,
      }}
      title={meta.label}
    >
      {meta.logo ? (
        <img
          src={meta.logo}
          alt={meta.label}
          draggable={false}
          className="max-w-full max-h-full object-contain select-none"
          style={{
            padding: meta.pad,
            filter: platform === "addatimes" ? "none" : undefined,
          }}
        />
      ) : (
        <span className="font-head uppercase text-[#7209b7]" style={{ fontSize: px * 0.35 }}>
          {meta.short}
        </span>
      )}
    </div>
  );
}

/** Horizontal chip: small logo + brand label */
export function PlatformChip({ platform = "custom", size = 20, className = "", testid }) {
  const meta = PLATFORMS[platform] || PLATFORMS.custom;
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} data-testid={testid}>
      <PlatformLogo platform={platform} size={size} rounded="sm" />
      <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#1a0b2e]">{meta.label}</span>
    </span>
  );
}
