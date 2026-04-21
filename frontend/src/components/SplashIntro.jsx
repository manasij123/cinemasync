import React, { useLayoutEffect, useRef, useEffect } from "react";
import { gsap } from "gsap";

/**
 * CinemaSync splash intro — Step 3 (C → S → fly to header).
 *
 *   Beat 1 — C (film-reel) writes itself anti-clockwise (2.6s).
 *   Beat 2 — S (arrows) writes itself BEHIND the C as one continuous
 *            hand-written S (2.4s).
 *   Beat 3 — The finished composition flies smoothly into the empty
 *            navbar logo slot.  On arrival, the real navbar logo
 *            cross-fades in so the drawn composition becomes the
 *            header logo.  (The navbar slot is kept hidden for the
 *            duration of the splash to avoid a double-logo flash.)
 *
 * Drawing is driven by CSS @keyframes (compositor-thread, jitter-free).
 * Only the fly uses GSAP — it needs dynamic target measurement.
 */

const STAGE_PX = 340;
const C_DURATION = 2.6;
const C_DELAY = 0.25;
const S_DURATION = 2.4;
const S_DELAY = C_DELAY + C_DURATION + 0.35; // 3.2s
const DRAW_DONE_MS = (S_DELAY + S_DURATION) * 1000; // 5600ms
const FLY_START_MS = DRAW_DONE_MS + 350; // 5950ms

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
  const bgRef = useRef(null);
  const stageRef = useRef(null);
  const cPathRef = useRef(null);
  const sPathRef = useRef(null);

  usePathSeed(cPathRef);
  usePathSeed(sPathRef);

  useEffect(() => {
    // Hide the real Navbar logo while the splash is drawing, so the fly
    // can land into an empty slot and then cross-fade the real logo in.
    const navLogoBox = document.querySelector(
      '[data-testid="logo-home-link"] > div'
    );
    if (navLogoBox) {
      navLogoBox.style.opacity = "0";
      navLogoBox.style.transition = "none";
    }

    const flyTimer = setTimeout(() => {
      const stage = stageRef.current;
      const target =
        navLogoBox ||
        document.querySelector('[data-testid="logo-home-link"] > div');

      const finish = () => {
        // Reveal real navbar logo so the drawn composition "becomes" it.
        if (navLogoBox) {
          navLogoBox.style.transition = "";
          gsap.to(navLogoBox, { opacity: 1, duration: 0.3, ease: "power2.out" });
        }
        gsap.to(rootRef.current, {
          opacity: 0,
          duration: 0.45,
          ease: "power1.in",
          onComplete: () => onDone?.(),
        });
      };

      if (!stage || !target) return finish();

      const srcRect = stage.getBoundingClientRect();
      const tgtRect = target.getBoundingClientRect();
      if (!srcRect.width || !tgtRect.width) return finish();

      const dx =
        tgtRect.left + tgtRect.width / 2 - (srcRect.left + srcRect.width / 2);
      const dy =
        tgtRect.top + tgtRect.height / 2 - (srcRect.top + srcRect.height / 2);
      const scale = tgtRect.width / srcRect.width;

      // Fade the dark backdrop as the logo travels so it feels like the
      // composition escapes the splash and docks into the navbar.
      gsap.to(bgRef.current, {
        opacity: 0,
        duration: 0.9,
        ease: "power2.inOut",
      });

      gsap.to(stage, {
        x: dx,
        y: dy,
        scale,
        duration: 1.1,
        ease: "power3.inOut",
        force3D: true,
        onComplete: () => {
          // Cross-fade: reveal real navbar logo, fade the drawn one out.
          if (navLogoBox) {
            navLogoBox.style.transition = "";
            gsap.to(navLogoBox, {
              opacity: 1,
              duration: 0.25,
              ease: "power2.out",
            });
          }
          gsap.to(stage, {
            opacity: 0,
            duration: 0.25,
            ease: "power1.out",
            onComplete: () => {
              gsap.to(rootRef.current, {
                opacity: 0,
                duration: 0.25,
                ease: "power1.out",
                onComplete: () => onDone?.(),
              });
            },
          });
        },
      });
    }, FLY_START_MS);

    return () => {
      clearTimeout(flyTimer);
      // Safety: if splash unmounts early, make sure navbar logo is visible.
      if (navLogoBox) {
        navLogoBox.style.opacity = "";
        navLogoBox.style.transition = "";
      }
    };
  }, [onDone]);

  // ---- C stroke path (anti-clockwise: top-right → bottom-right) ----
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

  // ---- S stroke path — single continuous hand-written S ----
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
      className="fixed inset-0 z-[9998] select-none overflow-hidden"
      style={{
        opacity: 0,
        animation: "cinemasync-fade-in 0.35s ease-out forwards",
      }}
      aria-hidden
    >
      <style>{KEYFRAMES}</style>

      <div
        ref={bgRef}
        className="absolute inset-0 bg-[#0b0b0b]"
        style={{
          background:
            "radial-gradient(ellipse at center, #141414 0%, #080808 60%, #000 100%)",
        }}
      />

      <div
        ref={stageRef}
        className="absolute left-1/2 top-1/2"
        style={{
          width: STAGE_PX,
          height: STAGE_PX,
          marginLeft: -STAGE_PX / 2,
          marginTop: -STAGE_PX / 2,
          transform: "translateZ(0)",
          willChange: "transform, opacity",
          transformOrigin: "50% 50%",
        }}
      >
        <svg
          viewBox="0 0 50 50"
          className="absolute inset-0 w-full h-full"
          shapeRendering="optimizeSpeed"
          style={{ overflow: "visible" }}
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
                  strokeDasharray: "1000",
                  strokeDashoffset: "1000",
                  animation: `cinemasync-draw ${C_DURATION}s linear ${C_DELAY}s forwards`,
                }}
              />
            </mask>

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

          {/* BACKGROUND — S arrows (slightly larger than C, tails peek out) */}
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

          {/* FOREGROUND — C film-reel */}
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
