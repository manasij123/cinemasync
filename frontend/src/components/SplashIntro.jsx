import React, { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";

/**
 * Step 1 · CinemaSync splash intro.
 *
 * Reveals the user-provided C logo at screen centre using a circular
 * stroke mask — the artwork "paints itself in" following a circular
 * motion around the film-reel centre, tracing out the C silhouette.
 *
 * Runs on every page load (as requested).
 */

const HOLD_MS = 3500; // total time on screen before fading out

export default function SplashIntro({ onDone }) {
  const rootRef = useRef(null);
  const maskArcRef = useRef(null);

  useLayoutEffect(() => {
    // Fade overlay in
    gsap.fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: 0.35 });

    const arc = maskArcRef.current;
    if (arc) {
      const len = arc.getTotalLength();
      arc.setAttribute("stroke-dasharray", `${len}`);
      arc.setAttribute("stroke-dashoffset", `${len}`);
      gsap.to(arc, {
        attr: { "stroke-dashoffset": 0 },
        duration: 2.2,
        ease: "power2.inOut",
      });
    }

    const t = setTimeout(() => {
      gsap.to(rootRef.current, {
        opacity: 0,
        duration: 0.4,
        ease: "power1.in",
        onComplete: () => onDone?.(),
      });
    }, HOLD_MS);

    return () => clearTimeout(t);
  }, []);

  // Anti-clockwise sweep path — the way one actually writes a "C" by hand.
  //
  //   • start : top-right corner of the C  (≈ 1 o'clock position)
  //   • sweep : large-arc, counter-clockwise (up → left → down → right)
  //   • end   : bottom-right corner of the C (≈ 5 o'clock position)
  //
  // The ~300° arc traces exactly the C silhouette; its ~280° gap on the
  // right side becomes the opening of the letter — no part of the C is
  // revealed outside the stroke's sweep.
  const RADIUS = 230;
  const CX = 250;
  const CY = 250;
  const START_DEG = -55;  // top-right
  const END_DEG = 55;     // bottom-right (wraps the long way around)
  const toPt = (deg) => ({
    x: CX + RADIUS * Math.cos((deg * Math.PI) / 180),
    y: CY + RADIUS * Math.sin((deg * Math.PI) / 180),
  });
  const startPt = toPt(START_DEG);
  const endPt = toPt(END_DEG);
  // large-arc-flag=1 → take the long way · sweep-flag=0 → counter-clockwise
  const writePath = `M ${startPt.x} ${startPt.y} A ${RADIUS} ${RADIUS} 0 1 0 ${endPt.x} ${endPt.y}`;

  return (
    <div
      ref={rootRef}
      data-testid="splash-intro"
      className="fixed inset-0 z-[9998] flex items-center justify-center overflow-hidden bg-[#0b0b0b] select-none"
      style={{ opacity: 0 }}
      aria-hidden
    >
      {/* Subtle vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,0.92) 100%)" }}
      />

      <div className="relative" style={{ width: 520, height: 520 }}>
        <svg viewBox="0 0 500 500" className="absolute inset-0 w-full h-full">
          <defs>
            <mask id="cCircleMask" maskUnits="userSpaceOnUse">
              <rect width="500" height="500" fill="black" />
              {/* Fat stroke whose path traces the hand-written C stroke
                  (anti-clockwise from top-right down to bottom-right). */}
              <path
                ref={maskArcRef}
                d={writePath}
                stroke="white"
                strokeWidth={RADIUS * 1.4}
                strokeLinecap="round"
                fill="none"
              />
            </mask>
          </defs>

          {/* The real C logo, revealed by the animated circular mask */}
          <image
            href="/cinemasync-c-logo.jpg"
            x="10"
            y="10"
            width="480"
            height="480"
            preserveAspectRatio="xMidYMid meet"
            mask="url(#cCircleMask)"
          />
        </svg>
      </div>
    </div>
  );
}
