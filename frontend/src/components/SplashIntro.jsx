import React, { useLayoutEffect, useRef, useMemo } from "react";
import { gsap } from "gsap";

/**
 * CinemaSync splash intro — smooth, low-GPU edition.
 *
 *  Beat 1 — C (film-reel) writes itself anti-clockwise (hand draws a C:
 *           top-right → up → left → down → bottom-right).
 *
 *  Beat 2 — S (arrows) writes itself behind C as one continuous
 *           hand-written S (top curl → middle → bottom curl).
 *
 *  Beat 3 — Composition flies into the empty Navbar logo slot and the
 *           real logo cross-fades in so the drawn logo becomes the
 *           header logo.
 *
 * Performance notes:
 *  • SVG viewBox is intentionally small (100×100) so mask rasterization
 *    per frame is 25× cheaper than a 500×500 viewBox.
 *  • `stroke-dashoffset` is driven through the CSS pipeline (GSAP's
 *    default) rather than `attr:` so Chromium/Safari can GPU-composite.
 *  • Ambient effects (rings, rays, particles, glow) are kept idle while
 *    C and S are drawing — they only start once the writing is done, so
 *    the GPU budget during the reveal is dedicated to the mask/stroke.
 */

const STAGE_PX = 260;

export default function SplashIntro({ onDone }) {
  const rootRef = useRef(null);
  const bgRef = useRef(null);
  const glowRef = useRef(null);
  const stageRef = useRef(null);
  const cPathRef = useRef(null);
  const sPathRef = useRef(null);
  const ringsRef = useRef([]);
  const particlesRef = useRef([]);
  const raysRef = useRef(null);
  const bulbsRef = useRef([]);

  const particles = useMemo(
    () =>
      Array.from({ length: 10 }).map((_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: 2 + Math.random() * 3,
        hue: i % 3,
      })),
    []
  );

  useLayoutEffect(() => {
    const navLogoBox = document.querySelector(
      '[data-testid="logo-home-link"] > div'
    );
    if (navLogoBox) {
      navLogoBox.style.opacity = "0";
      navLogoBox.style.transition = "none";
    }

    gsap.fromTo(
      rootRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.4, ease: "power2.out" }
    );
    gsap.fromTo(
      stageRef.current,
      { scale: 0.88, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.7, ease: "power3.out" }
    );

    // Seed stroke-dasharray/offset BOTH as CSS inline style (preferred,
    // GPU-composited) and attribute (browser fallback).
    const seed = (el) => {
      if (!el) return 0;
      const len = el.getTotalLength();
      el.style.strokeDasharray = `${len}`;
      el.style.strokeDashoffset = `${len}`;
      el.setAttribute("stroke-dasharray", `${len}`);
      el.setAttribute("stroke-dashoffset", `${len}`);
      return len;
    };
    seed(cPathRef.current);
    seed(sPathRef.current);

    const tl = gsap.timeline();

    // Beat 1 — C writes in, CSS-style (no `attr:`), linear handwriting
    tl.to(
      cPathRef.current,
      { strokeDashoffset: 0, duration: 1.9, ease: "none" },
      0.45
    );

    // Beat 2 — S writes in behind C as one continuous stroke
    tl.to(
      sPathRef.current,
      { strokeDashoffset: 0, duration: 2.0, ease: "none" },
      "+=0.35"
    );

    // Beat 3 — ambient effects kick in NOW (after the writing is done,
    // so they don't fight for GPU budget during the reveal).
    tl.call(() => {
      if (glowRef.current) {
        gsap.to(glowRef.current, {
          opacity: 0.5,
          duration: 1.4,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        });
      }
      ringsRef.current.forEach((r, i) => {
        if (!r) return;
        gsap.fromTo(
          r,
          { scale: 0.6, opacity: 0 },
          {
            scale: 1.7,
            opacity: 0,
            duration: 2.8,
            ease: "sine.out",
            repeat: -1,
            delay: i * 1.0,
            keyframes: [
              { scale: 0.6, opacity: 0, duration: 0 },
              { opacity: 0.42, duration: 0.35 },
              { scale: 1.7, opacity: 0, duration: 2.45 },
            ],
          }
        );
      });
      particlesRef.current.forEach((p) => {
        if (!p) return;
        gsap.to(p, {
          y: `-=${25 + Math.random() * 35}`,
          x: `+=${(Math.random() - 0.5) * 24}`,
          opacity: 0.2 + Math.random() * 0.45,
          duration: 3.5 + Math.random() * 2.5,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        });
      });
      if (raysRef.current) {
        gsap.to(raysRef.current, {
          rotation: 360,
          duration: 60,
          ease: "none",
          repeat: -1,
          transformOrigin: "50% 50%",
          force3D: true,
        });
      }
      bulbsRef.current.forEach((b, i) => {
        if (!b) return;
        gsap.to(b, {
          opacity: 0.35,
          duration: 0.9,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
          delay: i * 0.2,
        });
      });
    }, null, "+=0.05");

    // Beat 4 — fly composition into Navbar logo slot
    tl.add(() => {
      const target =
        navLogoBox ||
        document.querySelector('[data-testid="logo-home-link"] > div');
      const stage = stageRef.current;

      const finalise = () => {
        if (navLogoBox) {
          navLogoBox.style.transition = "";
          gsap.set(navLogoBox, { opacity: 1 });
        }
      };

      const fallbackFinish = () => {
        finalise();
        gsap.to(rootRef.current, {
          opacity: 0,
          duration: 0.45,
          ease: "power1.inOut",
          onComplete: () => onDone?.(),
        });
      };

      if (!target || !stage) return fallbackFinish();
      const tgtRect = target.getBoundingClientRect();
      const srcRect = stage.getBoundingClientRect();
      if (!tgtRect.width || !srcRect.width) return fallbackFinish();

      const dx =
        tgtRect.left + tgtRect.width / 2 - (srcRect.left + srcRect.width / 2);
      const dy =
        tgtRect.top + tgtRect.height / 2 - (srcRect.top + srcRect.height / 2);
      const scale = tgtRect.width / srcRect.width;

      gsap.to(bgRef.current, { opacity: 0, duration: 0.9, ease: "power2.inOut" });
      gsap.to(glowRef.current, { opacity: 0, duration: 0.5, ease: "power1.out" });

      gsap.to(stage, {
        x: dx,
        y: dy,
        scale,
        duration: 1.1,
        ease: "power3.inOut",
        onComplete: () => {
          finalise();
          gsap.to(stage, {
            opacity: 0,
            duration: 0.22,
            ease: "power1.out",
            onComplete: () => {
              gsap.to(rootRef.current, {
                opacity: 0,
                duration: 0.22,
                ease: "power1.out",
                onComplete: () => onDone?.(),
              });
            },
          });
        },
      });
    }, "+=0.6");

    return () => {
      tl.kill();
      if (navLogoBox) {
        navLogoBox.style.opacity = "";
        navLogoBox.style.transition = "";
      }
    };
  }, [onDone]);

  // ---- C stroke path (anti-clockwise: top-right → bottom-right) ----
  //   SVG viewBox intentionally tiny (100×100) → 25× cheaper rasterization
  const C_R = 46;
  const C_CX = 50;
  const C_CY = 50;
  const pt = (cx, cy, r, deg) => ({
    x: cx + r * Math.cos((deg * Math.PI) / 180),
    y: cy + r * Math.sin((deg * Math.PI) / 180),
  });
  const cStart = pt(C_CX, C_CY, C_R, -55);
  const cEnd = pt(C_CX, C_CY, C_R, 55);
  const cPath = `M ${cStart.x} ${cStart.y} A ${C_R} ${C_R} 0 1 0 ${cEnd.x} ${cEnd.y}`;

  // ---- S stroke path — single continuous hand-written S ----
  const S_R = 36;
  const sStart = { x: 86, y: 12 };
  const sMid = { x: 50, y: 50 };
  const sEnd = { x: 14, y: 88 };
  const sPath =
    `M ${sStart.x} ${sStart.y} ` +
    `A ${S_R} ${S_R} 0 1 0 ${sMid.x} ${sMid.y} ` +
    `A ${S_R} ${S_R} 0 1 1 ${sEnd.x} ${sEnd.y}`;

  return (
    <div
      ref={rootRef}
      data-testid="splash-intro"
      className="fixed inset-0 z-[9998] select-none overflow-hidden"
      style={{ opacity: 0 }}
      aria-hidden
    >
      {/* Translucent backdrop — Landing faintly bleeds through */}
      <div
        ref={bgRef}
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(10,10,10,0.78) 0%, rgba(5,5,5,0.90) 55%, rgba(0,0,0,0.96) 100%)",
        }}
      />

      {/* Ambient neon halo behind the logo stage */}
      <div
        ref={glowRef}
        className="pointer-events-none absolute left-1/2 top-1/2"
        style={{
          width: STAGE_PX * 1.6,
          height: STAGE_PX * 1.6,
          marginLeft: -(STAGE_PX * 1.6) / 2,
          marginTop: -(STAGE_PX * 1.6) / 2,
          opacity: 0,
          background:
            "radial-gradient(circle, rgba(255,209,0,0.22) 0%, rgba(106,20,255,0.14) 35%, rgba(0,0,0,0) 65%)",
          filter: "blur(30px)",
          willChange: "opacity",
        }}
      />

      {/* Rotating light rays — idle until writing is done */}
      <div
        ref={raysRef}
        className="pointer-events-none absolute left-1/2 top-1/2"
        style={{
          width: "140vmax",
          height: "140vmax",
          marginLeft: "-70vmax",
          marginTop: "-70vmax",
          opacity: 0.18,
          background:
            "conic-gradient(from 0deg, rgba(255,209,0,0) 0deg, rgba(255,209,0,0.16) 14deg, rgba(255,209,0,0) 30deg, rgba(106,20,255,0) 140deg, rgba(106,20,255,0.12) 160deg, rgba(106,20,255,0) 180deg, rgba(255,209,0,0) 360deg)",
          filter: "blur(22px)",
          mixBlendMode: "screen",
          willChange: "transform",
        }}
      />

      {/* Concentric projector rings — idle until writing is done */}
      {[0, 1].map((i) => (
        <div
          key={`ring-${i}`}
          ref={(el) => (ringsRef.current[i] = el)}
          className="pointer-events-none absolute left-1/2 top-1/2 rounded-full"
          style={{
            width: STAGE_PX * 1.2,
            height: STAGE_PX * 1.2,
            marginLeft: -(STAGE_PX * 1.2) / 2,
            marginTop: -(STAGE_PX * 1.2) / 2,
            border: "1.5px solid rgba(255,209,0,0.4)",
            boxShadow:
              "0 0 40px rgba(255,209,0,0.25), inset 0 0 30px rgba(255,209,0,0.15)",
            opacity: 0,
            willChange: "transform, opacity",
          }}
        />
      ))}

      {/* Floating cinema particles — idle until writing is done */}
      {particles.map((p, idx) => (
        <div
          key={p.id}
          ref={(el) => (particlesRef.current[idx] = el)}
          className="pointer-events-none absolute rounded-full"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            opacity: 0.35,
            background:
              p.hue === 0
                ? "rgba(255,209,0,0.85)"
                : p.hue === 1
                ? "rgba(168,85,247,0.8)"
                : "rgba(255,255,255,0.9)",
            boxShadow:
              p.hue === 0
                ? "0 0 10px rgba(255,209,0,0.9)"
                : p.hue === 1
                ? "0 0 8px rgba(168,85,247,0.9)"
                : "0 0 7px rgba(255,255,255,0.9)",
            willChange: "transform, opacity",
          }}
        />
      ))}

      {/* Corner marquee bulbs */}
      {[
        { top: 28, left: 28 },
        { top: 28, right: 28 },
        { bottom: 28, left: 28 },
        { bottom: 28, right: 28 },
      ].map((pos, i) => (
        <div
          key={`bulb-${i}`}
          ref={(el) => (bulbsRef.current[i] = el)}
          className="pointer-events-none absolute rounded-full"
          style={{
            ...pos,
            width: 9,
            height: 9,
            background: "#ffd100",
            boxShadow:
              "0 0 14px rgba(255,209,0,0.9), 0 0 28px rgba(255,209,0,0.4)",
            opacity: 1,
            willChange: "opacity",
          }}
        />
      ))}

      {/* Centred composition stage — GSAP tweens this to the header slot */}
      <div
        ref={stageRef}
        className="absolute"
        style={{
          left: "50%",
          top: "50%",
          width: STAGE_PX,
          height: STAGE_PX,
          marginLeft: -STAGE_PX / 2,
          marginTop: -STAGE_PX / 2,
          transformOrigin: "50% 50%",
          willChange: "transform, opacity",
          filter: "drop-shadow(0 8px 28px rgba(0,0,0,0.55))",
        }}
      >
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full"
          shapeRendering="optimizeSpeed"
          style={{ overflow: "visible" }}
        >
          <defs>
            {/* Mask for the C — anti-clockwise stroke */}
            <mask id="maskC" maskUnits="userSpaceOnUse">
              <rect width="100" height="100" fill="black" />
              <path
                ref={cPathRef}
                d={cPath}
                stroke="white"
                strokeWidth={C_R * 0.95}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                style={{ willChange: "stroke-dashoffset" }}
              />
            </mask>

            {/* Mask for the S — single continuous stroke */}
            <mask
              id="maskS"
              maskUnits="userSpaceOnUse"
              x="-40"
              y="-40"
              width="180"
              height="180"
            >
              <rect x="-40" y="-40" width="180" height="180" fill="black" />
              <path
                ref={sPathRef}
                d={sPath}
                stroke="white"
                strokeWidth={S_R * 1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                style={{ willChange: "stroke-dashoffset" }}
              />
            </mask>
          </defs>

          {/* BACKGROUND — S arrows artwork (slightly larger than C) */}
          <image
            href="/cinemasync-s-arrows.png"
            x="-24"
            y="-24"
            width="148"
            height="148"
            preserveAspectRatio="xMidYMid meet"
            mask="url(#maskS)"
            style={{ opacity: 0.95 }}
          />

          {/* FOREGROUND — C film-reel logo */}
          <image
            href="/cinemasync-c-logo.png"
            x="2"
            y="2"
            width="96"
            height="96"
            preserveAspectRatio="xMidYMid meet"
            mask="url(#maskC)"
          />
        </svg>
      </div>
    </div>
  );
}
