import React, { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";

/**
 * CinemaSync splash intro — reveals on EVERY page load.
 *
 * Technique:
 *   The real logo artwork (the drawn C film reel and the drawn S-shape of
 *   two circular arrows) are used as <image> elements inside an SVG.  Each
 *   image is masked by a thick stroked path that follows its own silhouette
 *   (a C-sweep and an S-curve).  Animating stroke-dashoffset of those mask
 *   strokes from "full length" to zero makes the artwork "paint itself in"
 *   along that path — giving the feeling of the drawing being created live.
 *
 * Timeline (≈3.8 s):
 *   0.0  overlay + vignette fade in
 *   0.3  C reveals along its C-sweep
 *   1.5  S reveals behind it along its S-sweep (two strokes, one each loop)
 *   3.2  brief hold + glow pulse
 *   3.5  entire stage flies to the top-left header slot, blurring + fading
 *   3.8  overlay gone, landing visible, real logo already docked in header
 */

const MIN_DISPLAY_MS = 3800;

export default function SplashIntro({ onDone }) {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const svgRef = useRef(null);
  const mountedAt = useRef(Date.now());
  const morphStarted = useRef(false);

  const measureFinalSlot = () => {
    const target = document.querySelector('[data-testid="logo-home-link"] img');
    if (!target) return null;
    const r = target.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  };

  const runMorph = () => {
    if (morphStarted.current) return;
    const elapsed = Date.now() - mountedAt.current;
    if (elapsed < MIN_DISPLAY_MS) {
      setTimeout(runMorph, MIN_DISPLAY_MS - elapsed);
      return;
    }
    morphStarted.current = true;
    const target = measureFinalSlot();
    const stage = stageRef.current;
    if (!target || !stage) {
      gsap.to(rootRef.current, { opacity: 0, duration: 0.4, onComplete: () => onDone?.() });
      return;
    }

    requestAnimationFrame(() => {
      const box = stage.getBoundingClientRect();
      const dx = target.x + target.w / 2 - (box.x + box.width / 2);
      const dy = target.y + target.h / 2 - (box.y + box.height / 2);
      const scale = (target.w * 1.2) / box.width;
      const tl = gsap.timeline({ onComplete: () => onDone?.() });
      tl.to(stage, { x: dx, y: dy, scale, duration: 0.9, ease: "power3.inOut", delay: 0.3 }, 0)
        .to(stage, { filter: "blur(6px) saturate(1.2)", duration: 0.45, ease: "power2.in" }, 0.7)
        .to(stage, { opacity: 0, duration: 0.35, ease: "power1.in" }, 1.0)
        .to(rootRef.current, { opacity: 0, duration: 0.3, ease: "power1.in" }, 1.15);
    });
  };

  useLayoutEffect(() => {
    gsap.fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: 0.35 });
    const svg = svgRef.current;
    if (!svg) return;

    // Seed the mask strokes so they are fully hidden at t=0
    svg.querySelectorAll("[data-mask-path]").forEach((el) => {
      try {
        const len = el.getTotalLength();
        el.setAttribute("stroke-dasharray", `${len}`);
        el.setAttribute("stroke-dashoffset", `${len}`);
      } catch {}
    });

    const tl = gsap.timeline({ defaults: { ease: "power2.inOut" } });
    // BEAT 1 — C reveals along its own C-sweep
    tl.to('[data-mask-path="c"]', { attr: { "stroke-dashoffset": 0 }, duration: 1.1 }, 0.3);
    // BEAT 2 — S reveals, two strokes, one for the upper loop, one for lower
    tl.to('[data-mask-path="s-top"]', { attr: { "stroke-dashoffset": 0 }, duration: 0.95 }, 1.4)
      .to('[data-mask-path="s-bot"]', { attr: { "stroke-dashoffset": 0 }, duration: 0.95 }, 1.7);
    // BEAT 3 — hold + glow pulse
    tl.to('#cs-splash-stage', {
      filter: "drop-shadow(0 0 16px rgba(255,209,0,0.55)) drop-shadow(0 0 32px rgba(106,20,255,0.4))",
      duration: 0.5,
    }, 2.9);

    const kickoff = setTimeout(runMorph, MIN_DISPLAY_MS);
    return () => { clearTimeout(kickoff); tl.kill(); };
  }, []);

  // C-sweep path — a thick arc tracing the outer silhouette of the C logo
  const cSweep =
    "M 330 95 C 220 50, 95 130, 95 250 C 95 370, 220 450, 330 405";
  // Two S-sweep paths — top loop (right-to-left top curl) and bottom loop
  const sTop =
    "M 380 80 C 260 20, 150 60, 160 170 C 170 240, 270 260, 260 250";
  const sBot =
    "M 260 250 C 380 270, 430 390, 300 430 C 180 470, 80 410, 120 340";

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

      <div ref={stageRef} className="relative" style={{ width: 520, height: 520, willChange: "transform, opacity, filter" }}>
        <svg
          ref={svgRef}
          id="cs-splash-stage"
          viewBox="0 0 500 500"
          className="absolute inset-0 w-full h-full"
        >
          <defs>
            {/* ---------- S mask (background) ---------- */}
            <mask id="maskS" maskUnits="userSpaceOnUse">
              <rect width="500" height="500" fill="black" />
              <path
                data-mask-path="s-top"
                d={sTop}
                stroke="white"
                strokeWidth="360"
                strokeLinecap="round"
                fill="none"
              />
              <path
                data-mask-path="s-bot"
                d={sBot}
                stroke="white"
                strokeWidth="360"
                strokeLinecap="round"
                fill="none"
              />
            </mask>

            {/* ---------- C mask (foreground) ---------- */}
            <mask id="maskC" maskUnits="userSpaceOnUse">
              <rect width="500" height="500" fill="black" />
              <path
                data-mask-path="c"
                d={cSweep}
                stroke="white"
                strokeWidth="340"
                strokeLinecap="round"
                fill="none"
              />
            </mask>
          </defs>

          {/* ---------- BACKGROUND : S-arrows image, revealed along S path ---------- */}
          <image
            href="/cinemasync-s-arrows.png"
            x="10"
            y="10"
            width="480"
            height="480"
            preserveAspectRatio="xMidYMid meet"
            mask="url(#maskS)"
            style={{ opacity: 0.92 }}
          />

          {/* ---------- FOREGROUND : C logo image, revealed along C path ---------- */}
          <image
            href="/cinemasync-logo.svg"
            x="30"
            y="30"
            width="440"
            height="440"
            preserveAspectRatio="xMidYMid meet"
            mask="url(#maskC)"
          />
        </svg>
      </div>
    </div>
  );
}
