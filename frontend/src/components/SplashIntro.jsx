import React, { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";

/**
 * CinemaSync splash intro — Step 1 (C only, ultra-smooth).
 *
 * Centres the film-reel C and reveals it the exact way a hand writes a
 * C: anti-clockwise, starting top-right and finishing bottom-right.
 *
 * Smoothness tuning:
 *   • Tiny 50×50 viewBox → mask rasterization is 4× cheaper than 100×100
 *     and 100× cheaper than the original 500×500.
 *   • `stroke-dashoffset` animated through the CSS pipeline with
 *     `will-change` so it GPU-composites.
 *   • `force3D` tells GSAP to promote the element to its own layer.
 *   • No competing layers (no vignette / glow / rings / particles) so
 *     the GPU budget is dedicated entirely to the reveal.
 */

const STAGE_PX = 320;
const HOLD_MS = 3500;

export default function SplashIntro({ onDone }) {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const cPathRef = useRef(null);

  useLayoutEffect(() => {
    gsap.fromTo(
      rootRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.3, ease: "power1.out", force3D: true }
    );

    const el = cPathRef.current;
    if (el) {
      const len = el.getTotalLength();
      el.style.strokeDasharray = `${len}`;
      el.style.strokeDashoffset = `${len}`;
    }

    // Single tween — nothing else animating = buttery-smooth pen speed.
    const tween = gsap.to(cPathRef.current, {
      strokeDashoffset: 0,
      duration: 2.6,
      ease: "none",
      delay: 0.25,
      force3D: true,
    });

    const t = setTimeout(() => {
      gsap.to(rootRef.current, {
        opacity: 0,
        duration: 0.5,
        ease: "power1.in",
        force3D: true,
        onComplete: () => onDone?.(),
      });
    }, HOLD_MS);

    return () => {
      clearTimeout(t);
      tween.kill();
    };
  }, [onDone]);

  // ---- C stroke path (anti-clockwise: top-right → bottom-right) ----
  // Tiny 50×50 viewBox → cheap rasterization, pin-sharp output because
  // the browser scales the SVG, not the stroke bitmap.
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

  return (
    <div
      ref={rootRef}
      data-testid="splash-intro"
      className="fixed inset-0 z-[9998] select-none overflow-hidden bg-[#0b0b0b]"
      style={{ opacity: 0 }}
      aria-hidden
    >
      <div
        ref={stageRef}
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
        >
          <defs>
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
                  strokeDasharray: "500",
                  strokeDashoffset: "500",
                }}
              />
            </mask>
          </defs>

          <image
            href="/cinemasync-c-logo.png"
            x="0"
            y="0"
            width="50"
            height="50"
            preserveAspectRatio="xMidYMid meet"
            mask="url(#maskC)"
          />
        </svg>
      </div>
    </div>
  );
}
