import React, { useLayoutEffect, useRef, useState, useEffect } from "react";

/**
 * CinemaSync splash intro — Step 2.
 *
 *   Beat 1 — C (film-reel) writes itself anti-clockwise the way a hand
 *            writes a "C": top-right → up → left → down → bottom-right.
 *
 *   Beat 2 — S (arrows) writes itself BEHIND the C as one continuous
 *            hand-written S: top-right → anti-cw top curl → middle →
 *            cw bottom curl → bottom-left.
 *
 * The draw animation is driven by pure CSS @keyframes (not JS) so the
 * browser hands it off to the compositor thread for the smoothest
 * possible pen speed — no frame-pacing jitter from GSAP or rAF.
 */

const STAGE_PX = 340;
const C_DURATION = 2.6; // seconds
const C_DELAY = 0.25;
const S_DURATION = 2.4;
const S_DELAY = C_DELAY + C_DURATION + 0.35;
const TOTAL_MS = (S_DELAY + S_DURATION + 0.9) * 1000;

// Keep keyframes in a single injected <style> tag so every re-use of the
// splash shares the same GPU-compiled rule.
const KEYFRAMES = `
@keyframes cinemasync-draw {
  from { stroke-dashoffset: var(--draw-len); }
  to   { stroke-dashoffset: 0; }
}
@keyframes cinemasync-fade-in  { from { opacity: 0 } to { opacity: 1 } }
@keyframes cinemasync-fade-out { from { opacity: 1 } to { opacity: 0 } }
`;

function usePathSeed(ref) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const len = el.getTotalLength();
    el.style.setProperty("--draw-len", `${len}`);
    el.style.strokeDasharray = `${len}`;
    el.style.strokeDashoffset = `${len}`;
  }, [ref]);
}

export default function SplashIntro({ onDone }) {
  const rootRef = useRef(null);
  const cPathRef = useRef(null);
  const sPathRef = useRef(null);
  const [exiting, setExiting] = useState(false);

  usePathSeed(cPathRef);
  usePathSeed(sPathRef);

  useEffect(() => {
    const t = setTimeout(() => setExiting(true), TOTAL_MS - 500);
    const t2 = setTimeout(() => onDone?.(), TOTAL_MS);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [onDone]);

  // ---- C stroke path (anti-clockwise from top-right to bottom-right) ----
  const C_R = 23;
  const C_CX = 25;
  const C_CY = 25;
  const pt = (cx, cy, r, deg) => ({
    x: cx + r * Math.cos((deg * Math.PI) / 180),
    y: cy + r * Math.sin((deg * Math.PI) / 180),
  });
  const cStart = pt(C_CX, C_CY, C_R, -55);
  const cEnd = pt(C_CX, C_CY, C_R, 55);
  const cPath = `M ${cStart.x} ${cStart.y} A ${C_R} ${C_R} 0 1 0 ${cEnd.x} ${cEnd.y}`;

  // ---- S stroke path (one continuous hand-written S) ----
  //   top-right → anti-cw top curl → middle → cw bottom curl → bottom-left
  const S_R = 15;
  const sStart = { x: 42, y: 8 };
  const sMid = { x: 25, y: 25 };
  const sEnd = { x: 8, y: 42 };
  const sPath =
    `M ${sStart.x} ${sStart.y} ` +
    `A ${S_R} ${S_R} 0 1 0 ${sMid.x} ${sMid.y} ` +
    `A ${S_R} ${S_R} 0 1 1 ${sEnd.x} ${sEnd.y}`;

  return (
    <div
      ref={rootRef}
      data-testid="splash-intro"
      className="fixed inset-0 z-[9998] select-none overflow-hidden bg-[#0b0b0b]"
      style={{
        opacity: 0,
        animation: exiting
          ? "cinemasync-fade-out 0.5s ease-in forwards"
          : "cinemasync-fade-in 0.35s ease-out forwards",
      }}
      aria-hidden
    >
      <style>{KEYFRAMES}</style>

      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: STAGE_PX,
          height: STAGE_PX,
          marginLeft: -STAGE_PX / 2,
          marginTop: -STAGE_PX / 2,
          transform: "translateZ(0)",
          willChange: "transform",
        }}
      >
        <svg
          viewBox="0 0 50 50"
          className="absolute inset-0 w-full h-full"
          shapeRendering="optimizeSpeed"
          style={{ overflow: "visible" }}
        >
          <defs>
            {/* Mask for the C — anti-clockwise hand-written stroke */}
            <mask id="maskC" maskUnits="userSpaceOnUse">
              <rect width="50" height="50" fill="black" />
              <path
                ref={cPathRef}
                d={cPath}
                stroke="white"
                strokeWidth={C_R * 2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                style={{
                  willChange: "stroke-dashoffset",
                  strokeDasharray: "1000",
                  strokeDashoffset: "1000",
                  animation: `cinemasync-draw ${C_DURATION}s linear ${C_DELAY}s forwards`,
                }}
              />
            </mask>

            {/* Mask for the S — single continuous hand-written stroke */}
            <mask
              id="maskS"
              maskUnits="userSpaceOnUse"
              x="-20"
              y="-20"
              width="90"
              height="90"
            >
              <rect x="-20" y="-20" width="90" height="90" fill="black" />
              <path
                ref={sPathRef}
                d={sPath}
                stroke="white"
                strokeWidth={S_R * 2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                style={{
                  willChange: "stroke-dashoffset",
                  strokeDasharray: "1000",
                  strokeDashoffset: "1000",
                  animation: `cinemasync-draw ${S_DURATION}s linear ${S_DELAY}s forwards`,
                }}
              />
            </mask>
          </defs>

          {/* BACKGROUND — S arrows artwork (slightly larger than C so tails peek out) */}
          <image
            href="/cinemasync-s-arrows.png"
            x="-4"
            y="-4"
            width="58"
            height="58"
            preserveAspectRatio="xMidYMid meet"
            mask="url(#maskS)"
            style={{ opacity: 0.95 }}
          />

          {/* FOREGROUND — C film-reel logo, drawn on top */}
          <image
            href="/cinemasync-c-logo.png"
            x="2"
            y="2"
            width="46"
            height="46"
            preserveAspectRatio="xMidYMid meet"
            mask="url(#maskC)"
          />
        </svg>
      </div>
    </div>
  );
}
