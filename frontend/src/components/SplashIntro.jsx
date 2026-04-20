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

  // Circular reveal path — a near-full circle centred on the film reel,
  // starting at ~12 o'clock, sweeping clockwise all the way around. When
  // swept by a fat stroke inside a <mask>, it "paints" the whole bitmap.
  // Path is drawn as TWO 180° arcs (SVG's arc command can't draw 360°).
  const RADIUS = 240;
  const CX = 250;
  const CY = 250;
  // Start at top, sweep clockwise 180° to bottom, then another 180° back.
  // Small offset so start ≠ end (otherwise path length rolls back to zero).
  const circlePath =
    `M ${CX} ${CY - RADIUS} ` +
    `A ${RADIUS} ${RADIUS} 0 1 1 ${CX} ${CY + RADIUS} ` +
    `A ${RADIUS} ${RADIUS} 0 1 1 ${CX - 0.01} ${CY - RADIUS}`;

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
              {/* The stroke is huge so its path-sweep covers the full C bitmap */}
              <path
                ref={maskArcRef}
                d={circlePath}
                stroke="white"
                strokeWidth={RADIUS * 2}
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
