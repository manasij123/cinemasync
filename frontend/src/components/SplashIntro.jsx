import React, { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";

/**
 * CinemaSync splash intro — Step 1.
 *
 * Shows ONLY the C (film-reel) logo in the centre of the screen and
 * reveals it the exact way a hand writes a C:
 *   anti-clockwise — starting at the top-right, sweeping round the
 *   left, ending at the bottom-right.
 *
 * Smooth linear pen speed, GPU-friendly single CSS tween.  No S layer,
 * no fly-to-header, no ambient effects — those come in follow-up steps.
 *
 * Runs on every page load.
 */

const STAGE_PX = 320;
const HOLD_MS = 3200;

export default function SplashIntro({ onDone }) {
  const rootRef = useRef(null);
  const cPathRef = useRef(null);

  useLayoutEffect(() => {
    gsap.fromTo(
      rootRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.35, ease: "power2.out" }
    );

    // Seed stroke-dash so the mask starts fully hidden
    const el = cPathRef.current;
    if (el) {
      const len = el.getTotalLength();
      el.style.strokeDasharray = `${len}`;
      el.style.strokeDashoffset = `${len}`;
      el.setAttribute("stroke-dasharray", `${len}`);
      el.setAttribute("stroke-dashoffset", `${len}`);
    }

    const tl = gsap.timeline();

    // Beat 1 — C writes in anti-clockwise, linear pen-speed (no pulsing)
    tl.to(
      cPathRef.current,
      { strokeDashoffset: 0, duration: 2.2, ease: "none" },
      0.25
    );

    // Hold + clean exit
    const t = setTimeout(() => {
      gsap.to(rootRef.current, {
        opacity: 0,
        duration: 0.45,
        ease: "power1.in",
        onComplete: () => onDone?.(),
      });
    }, HOLD_MS);

    return () => {
      clearTimeout(t);
      tl.kill();
    };
  }, [onDone]);

  // ---- C stroke path (anti-clockwise: top-right → bottom-right) ----
  // Small 100×100 viewBox keeps mask rasterization cheap.
  const C_R = 46;
  const C_CX = 50;
  const C_CY = 50;
  const pt = (cx, cy, r, deg) => ({
    x: cx + r * Math.cos((deg * Math.PI) / 180),
    y: cy + r * Math.sin((deg * Math.PI) / 180),
  });
  const cStart = pt(C_CX, C_CY, C_R, -55);
  const cEnd = pt(C_CX, C_CY, C_R, 55);
  // large-arc-flag=1, sweep-flag=0 → goes anti-clockwise the long way
  const cPath = `M ${cStart.x} ${cStart.y} A ${C_R} ${C_R} 0 1 0 ${cEnd.x} ${cEnd.y}`;

  return (
    <div
      ref={rootRef}
      data-testid="splash-intro"
      className="fixed inset-0 z-[9998] select-none overflow-hidden bg-[#0b0b0b]"
      style={{ opacity: 0 }}
      aria-hidden
    >
      {/* Subtle cinematic vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(20,20,20,0) 0%, rgba(0,0,0,0.7) 100%)",
        }}
      />

      {/* Centred composition stage */}
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: STAGE_PX,
          height: STAGE_PX,
          marginLeft: -STAGE_PX / 2,
          marginTop: -STAGE_PX / 2,
        }}
      >
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full"
          shapeRendering="optimizeSpeed"
        >
          <defs>
            {/* Mask for the C — anti-clockwise hand-written stroke */}
            <mask id="maskC" maskUnits="userSpaceOnUse">
              <rect width="100" height="100" fill="black" />
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
                }}
              />
            </mask>
          </defs>

          {/* C film-reel logo — masked by the growing stroke */}
          <image
            href="/cinemasync-c-logo.png"
            x="0"
            y="0"
            width="100"
            height="100"
            preserveAspectRatio="xMidYMid meet"
            mask="url(#maskC)"
          />
        </svg>
      </div>
    </div>
  );
}
