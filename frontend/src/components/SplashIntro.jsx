import React, { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";

/**
 * CinemaSync splash intro.
 *
 *   Beat 1 — C (film reel logo) draws itself in the centre the way a
 *            hand writes "C": from the top-right corner, anti-clockwise
 *            around to the bottom-right.
 *   Beat 2 — S (pair of circular arrows) draws itself BEHIND the C the
 *            way a hand writes "S": the top curl first (top-right,
 *            anti-clockwise to middle), then the bottom curl (middle,
 *            clockwise to bottom-left).
 *
 * Runs on every page load.  Smooth easing (`sine.inOut`) throughout so
 * there is no visible pulsing on the drawing progress.
 */

const TOTAL_HOLD_MS = 5200;

export default function SplashIntro({ onDone }) {
  const rootRef = useRef(null);
  const cPathRef = useRef(null);
  const sTopRef = useRef(null);
  const sBotRef = useRef(null);

  useLayoutEffect(() => {
    gsap.fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: 0.4 });

    const seed = (el) => {
      if (!el) return 0;
      const len = el.getTotalLength();
      el.setAttribute("stroke-dasharray", `${len}`);
      el.setAttribute("stroke-dashoffset", `${len}`);
      return len;
    };
    seed(cPathRef.current);
    seed(sTopRef.current);
    seed(sBotRef.current);

    // sine.inOut is the smoothest "writing" ease — no visible stutter.
    const tl = gsap.timeline({ defaults: { ease: "sine.inOut" } });

    // Beat 1 — C (foreground) writes in
    tl.to(cPathRef.current, {
      attr: { "stroke-dashoffset": 0 },
      duration: 2.0,
    }, 0.35);

    // Tiny pause so C feels "complete" before S starts behind it
    // Beat 2 — S (background) writes in, top curl then bottom curl
    tl.to(sTopRef.current, {
      attr: { "stroke-dashoffset": 0 },
      duration: 1.1,
    }, 2.6);
    tl.to(sBotRef.current, {
      attr: { "stroke-dashoffset": 0 },
      duration: 1.1,
    }, 3.55);

    // Overall stage hold + exit
    const t = setTimeout(() => {
      gsap.to(rootRef.current, {
        opacity: 0,
        duration: 0.45,
        ease: "power1.in",
        onComplete: () => onDone?.(),
      });
    }, TOTAL_HOLD_MS);

    return () => {
      clearTimeout(t);
      tl.kill();
    };
  }, []);

  // ---- C stroke path (anti-clockwise from top-right to bottom-right) ----
  const C_RADIUS = 230;
  const C_CX = 250;
  const C_CY = 250;
  const toPt = (cx, cy, r, deg) => ({
    x: cx + r * Math.cos((deg * Math.PI) / 180),
    y: cy + r * Math.sin((deg * Math.PI) / 180),
  });
  const cStart = toPt(C_CX, C_CY, C_RADIUS, -55);
  const cEnd = toPt(C_CX, C_CY, C_RADIUS, 55);
  const cPath = `M ${cStart.x} ${cStart.y} A ${C_RADIUS} ${C_RADIUS} 0 1 0 ${cEnd.x} ${cEnd.y}`;

  // ---- S stroke paths (two arcs drawn the way we hand-write an S) ----
  // Top curl  : centre upper-right → anti-clockwise up and left → middle
  // Bottom curl: middle → clockwise down and right → bottom-left
  //
  // Arcs share a mid-point at the centre of the composition so the two
  // halves join seamlessly to form a continuous S silhouette.
  const S_TOP_R = 140;
  const S_BOT_R = 140;
  const MID_X = 250;
  const MID_Y = 250;
  const sTopStart = { x: 380, y: 110 };   // top-right head of S
  const sTopMid   = { x: MID_X, y: MID_Y };
  const sBotEnd   = { x: 120, y: 390 };   // bottom-left tail of S
  const sTopPath = `M ${sTopStart.x} ${sTopStart.y} A ${S_TOP_R} ${S_TOP_R} 0 1 0 ${sTopMid.x} ${sTopMid.y}`;
  const sBotPath = `M ${sTopMid.x} ${sTopMid.y} A ${S_BOT_R} ${S_BOT_R} 0 1 0 ${sBotEnd.x} ${sBotEnd.y}`;

  return (
    <div
      ref={rootRef}
      data-testid="splash-intro"
      className="fixed inset-0 z-[9998] flex items-center justify-center overflow-hidden bg-[#0b0b0b] select-none"
      style={{ opacity: 0 }}
      aria-hidden
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,0.92) 100%)" }}
      />

      <div className="relative" style={{ width: 560, height: 560 }}>
        <svg viewBox="0 0 500 500" className="absolute inset-0 w-full h-full" shapeRendering="geometricPrecision">
          <defs>
            {/* Mask for the C — anti-clockwise stroke */}
            <mask id="maskC" maskUnits="userSpaceOnUse">
              <rect width="500" height="500" fill="black" />
              <path
                ref={cPathRef}
                d={cPath}
                stroke="white"
                strokeWidth={C_RADIUS * 1.4}
                strokeLinecap="round"
                fill="none"
              />
            </mask>

            {/* Mask for the S — two sequential strokes */}
            <mask id="maskS" maskUnits="userSpaceOnUse">
              <rect width="500" height="500" fill="black" />
              <path
                ref={sTopRef}
                d={sTopPath}
                stroke="white"
                strokeWidth={S_TOP_R * 1.9}
                strokeLinecap="round"
                fill="none"
              />
              <path
                ref={sBotRef}
                d={sBotPath}
                stroke="white"
                strokeWidth={S_BOT_R * 1.9}
                strokeLinecap="round"
                fill="none"
              />
            </mask>
          </defs>

          {/* BACKGROUND — S arrows artwork */}
          <image
            href="/cinemasync-s-arrows.png"
            x="-10"
            y="-10"
            width="520"
            height="520"
            preserveAspectRatio="xMidYMid meet"
            mask="url(#maskS)"
            style={{ opacity: 0.88 }}
          />

          {/* FOREGROUND — C film-reel logo */}
          <image
            href="/cinemasync-c-logo.jpg"
            x="10"
            y="10"
            width="480"
            height="480"
            preserveAspectRatio="xMidYMid meet"
            mask="url(#maskC)"
          />
        </svg>
      </div>
    </div>
  );
}
