import React, { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";

/**
 * CinemaSync splash intro.
 *
 *   Beat 1 — C (film-reel logo) writes itself in the centre the way a
 *            hand draws a "C": starts top-right and sweeps
 *            anti-clockwise around to bottom-right.
 *
 *   Beat 2 — S (pair of circular arrows) writes itself BEHIND the C in
 *            a single, continuous hand-written "S" motion:
 *                top-right → top curl (anti-cw) → middle →
 *                bottom curl (cw) → bottom-left.
 *            Drawn with ONE path so there is no seam mid-stroke.
 *
 * Linear easing (`ease: "none"`) on every reveal keeps the pen speed
 * constant so the stroke looks smooth and never pulses.
 *
 * Plays on every page load.
 */

const TOTAL_HOLD_MS = 5400;

export default function SplashIntro({ onDone }) {
  const rootRef = useRef(null);
  const cPathRef = useRef(null);
  const sPathRef = useRef(null);

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
    seed(sPathRef.current);

    // Linear easing — pen moves at a constant speed, no pulsing.
    const tl = gsap.timeline({ defaults: { ease: "none" } });

    // Beat 1 — C (foreground) writes in anti-clockwise
    tl.to(
      cPathRef.current,
      { attr: { "stroke-dashoffset": 0 }, duration: 2.0 },
      0.35
    );

    // Small beat so C feels "complete" before S begins behind it
    // Beat 2 — S (background) writes in as one continuous stroke
    tl.to(
      sPathRef.current,
      { attr: { "stroke-dashoffset": 0 }, duration: 2.2 },
      2.75
    );

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
  // large-arc-flag=1, sweep-flag=0 → anti-clockwise the long way round
  const cPath = `M ${cStart.x} ${cStart.y} A ${C_RADIUS} ${C_RADIUS} 0 1 0 ${cEnd.x} ${cEnd.y}`;

  // ---- S stroke path — ONE continuous path, drawn as a hand writes S ----
  //   top-right  →  (anti-cw top curl)  →  middle  →  (cw bottom curl)  →  bottom-left
  //
  // S reaches further out than the C (C_RADIUS = 230) so the arrow tails
  // of the background artwork peek out beyond the film-reel on both sides,
  // making it obvious there is an S sitting behind the C.
  const S_R = 185;
  const sStart = { x: 440, y: 50 };
  const sMid   = { x: 250, y: 250 };
  const sEnd   = { x: 60,  y: 450 };
  const sPath =
    `M ${sStart.x} ${sStart.y} ` +
    `A ${S_R} ${S_R} 0 1 0 ${sMid.x} ${sMid.y} ` +
    `A ${S_R} ${S_R} 0 1 1 ${sEnd.x} ${sEnd.y}`;

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
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,0.92) 100%)",
        }}
      />

      <div className="relative" style={{ width: 700, height: 700 }}>
        <svg
          viewBox="0 0 500 500"
          className="absolute inset-0 w-full h-full"
          shapeRendering="geometricPrecision"
          style={{ overflow: "visible" }}
        >
          <defs>
            {/* Mask for the C — anti-clockwise stroke */}
            <mask id="maskC" maskUnits="userSpaceOnUse">
              <rect width="500" height="500" fill="black" />
              <path
                ref={cPathRef}
                d={cPath}
                stroke="white"
                strokeWidth={C_RADIUS * 1.45}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </mask>

            {/* Mask for the S — single continuous stroke (larger than C) */}
            <mask
              id="maskS"
              maskUnits="userSpaceOnUse"
              x="-150"
              y="-150"
              width="800"
              height="800"
            >
              <rect x="-150" y="-150" width="800" height="800" fill="black" />
              <path
                ref={sPathRef}
                d={sPath}
                stroke="white"
                strokeWidth={S_R * 2.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </mask>
          </defs>

          {/* BACKGROUND — S arrows artwork (larger than C so tails peek out) */}
          <image
            href="/cinemasync-s-arrows.png"
            x="-110"
            y="-110"
            width="720"
            height="720"
            preserveAspectRatio="xMidYMid meet"
            mask="url(#maskS)"
            style={{ opacity: 0.92 }}
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
