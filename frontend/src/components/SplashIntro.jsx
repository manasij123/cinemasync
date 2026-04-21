import React, { useLayoutEffect, useRef, useEffect } from "react";
import { gsap } from "gsap";

/**
 * CinemaSync splash intro — Step 4 (smaller shape + cinema ambience).
 *
 *   Beat 0 — letter-box bars slide in from top/bottom (movie-opening cue).
 *   Beat 1 — C (film-reel) writes itself anti-clockwise (2.6s).
 *   Beat 2 — S (arrows) writes itself BEHIND the C as one continuous
 *            hand-written S (2.4s).
 *   Beat 3 — Composition flies into the navbar logo slot; real logo
 *            cross-fades in so the drawn composition becomes the header.
 *
 * Size reference (change STAGE_PX) — lighter = smaller compositing layer:
 *   260px  — comfortable (default)
 *   220px  — lighter
 *   180px  — very light
 *   140px  — badge-size, ultra-light
 *
 * Drawing: pure CSS @keyframes on stroke-dashoffset (compositor thread,
 * jitter-free).  Ambience: pure CSS too.  GSAP only for the dynamic
 * fly-to-header measurement.
 */

const STAGE_PX = 260; // 👈 adjust here to scale the animation
const C_DURATION = 1.7;
const C_DELAY = 0.3;
const S_DURATION = 1.6;
const S_DELAY = C_DELAY + C_DURATION + 0.25;
const DRAW_DONE_MS = (S_DELAY + S_DURATION) * 1000;
const FLY_START_MS = DRAW_DONE_MS + 250;

const KEYFRAMES = `
@keyframes cinemasync-draw {
  from { stroke-dashoffset: var(--draw-len); }
  to   { stroke-dashoffset: 0; }
}
@keyframes cinemasync-fade-in  { from { opacity: 0 } to { opacity: 1 } }
@keyframes cinemasync-bar-top {
  from { transform: translate3d(0, -100%, 0); }
  to   { transform: translate3d(0, 0, 0); }
}
@keyframes cinemasync-bar-bot {
  from { transform: translate3d(0, 100%, 0); }
  to   { transform: translate3d(0, 0, 0); }
}
@keyframes cinemasync-glow-pulse {
  0%,100% { opacity: .35; transform: scale(1); }
  50%     { opacity: .7;  transform: scale(1.08); }
}
@keyframes cinemasync-ray-sweep {
  0%,100% { transform: translate3d(-50%, -50%, 0) rotate(-22deg); opacity: 0; }
  50%     { opacity: .22; }
}
@keyframes cinemasync-film-scroll {
  from { transform: translate3d(0, 0, 0); }
  to   { transform: translate3d(0, -40px, 0); }
}
@keyframes cinemasync-flicker {
  0%,  9%, 11%, 49%, 51%, 89%, 91%, 100% { opacity: 1; }
  10%, 50%, 90% { opacity: .82; }
}
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

  // CSS film-strip sprocket pattern
  const filmStripBg = `repeating-linear-gradient(
    to bottom,
    rgba(0,0,0,0) 0 8px,
    rgba(255,255,255,0.12) 8px 10px,
    rgba(0,0,0,0) 10px 20px
  )`;

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

      {/* Deep cinema backdrop */}
      <div
        ref={bgRef}
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, #161616 0%, #080808 55%, #000 100%)",
        }}
      />

      {/* Film grain noise (subtle) */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-overlay"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "3px 3px",
          animation: "cinemasync-flicker 3s steps(1,end) infinite",
        }}
      />

      {/* Cinema letter-box bars (top + bottom) — slide in, movie-opening feel */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 h-[8vh]"
        style={{
          background:
            "linear-gradient(to bottom, #000 0%, #000 70%, rgba(0,0,0,0) 100%)",
          animation: "cinemasync-bar-top 0.9s cubic-bezier(.2,.8,.2,1) both",
          willChange: "transform",
        }}
      />
      <div
        className="pointer-events-none absolute left-0 right-0 bottom-0 h-[8vh]"
        style={{
          background:
            "linear-gradient(to top, #000 0%, #000 70%, rgba(0,0,0,0) 100%)",
          animation: "cinemasync-bar-bot 0.9s cubic-bezier(.2,.8,.2,1) both",
          willChange: "transform",
        }}
      />

      {/* Film-strip sprockets scrolling on left & right edges */}
      <div
        className="pointer-events-none absolute top-0 bottom-0 left-0 w-5"
        style={{
          backgroundImage: filmStripBg,
          backgroundSize: "100% 20px",
          animation: "cinemasync-film-scroll 1.6s linear infinite",
          opacity: 0.55,
          willChange: "transform",
        }}
      />
      <div
        className="pointer-events-none absolute top-0 bottom-0 right-0 w-5"
        style={{
          backgroundImage: filmStripBg,
          backgroundSize: "100% 20px",
          animation: "cinemasync-film-scroll 2s linear infinite reverse",
          opacity: 0.55,
          willChange: "transform",
        }}
      />

      {/* Soft neon glow pulse behind the composition */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2"
        style={{
          width: STAGE_PX * 1.8,
          height: STAGE_PX * 1.8,
          marginLeft: -(STAGE_PX * 1.8) / 2,
          marginTop: -(STAGE_PX * 1.8) / 2,
          background:
            "radial-gradient(circle, rgba(255,209,0,0.22) 0%, rgba(106,20,255,0.14) 35%, rgba(0,0,0,0) 65%)",
          filter: "blur(28px)",
          animation: "cinemasync-glow-pulse 3.2s ease-in-out infinite",
          willChange: "opacity, transform",
        }}
      />

      {/* Rotating projector ray slash */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2"
        style={{
          width: "120vmax",
          height: "28vmax",
          background:
            "linear-gradient(to right, rgba(255,209,0,0) 0%, rgba(255,209,0,0.18) 45%, rgba(255,209,0,0) 100%)",
          filter: "blur(20px)",
          mixBlendMode: "screen",
          animation: "cinemasync-ray-sweep 7s ease-in-out infinite",
          willChange: "transform, opacity",
        }}
      />

      {/* Corner marquee bulbs */}
      {[
        { top: "calc(8vh + 24px)", left: 36 },
        { top: "calc(8vh + 24px)", right: 36 },
        { bottom: "calc(8vh + 24px)", left: 36 },
        { bottom: "calc(8vh + 24px)", right: 36 },
      ].map((pos, i) => (
        <div
          key={`bulb-${i}`}
          className="pointer-events-none absolute rounded-full"
          style={{
            ...pos,
            width: 8,
            height: 8,
            background: "#ffd100",
            boxShadow:
              "0 0 14px rgba(255,209,0,0.9), 0 0 28px rgba(255,209,0,0.4)",
            animation: `cinemasync-glow-pulse ${1.2 + i * 0.15}s ease-in-out infinite`,
            animationDelay: `${i * 0.15}s`,
            willChange: "opacity, transform",
          }}
        />
      ))}

      {/* Composition stage */}
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
          filter: "drop-shadow(0 8px 32px rgba(0,0,0,0.6))",
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
