import React, { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";

/**
 * CinemaSync splash intro.
 *
 *   Beat 1 — C (film-reel) writes itself anti-clockwise, the way a
 *            hand draws a "C": from top-right, sweeping round, to
 *            bottom-right.
 *
 *   Beat 2 — S (pair of circular arrows) writes itself BEHIND the C as
 *            a single continuous hand-written "S" (top curl → middle →
 *            bottom curl).  Its arrow tails sit just outside the C so
 *            the S is visible peeking around the film-reel.
 *
 *   Beat 3 — The finished composition smoothly flies into the empty
 *            Navbar logo slot (top-left of the page).  The real Navbar
 *            logo is kept hidden while the splash runs; the moment the
 *            composition docks into place we hand off with a cross-fade
 *            so the drawn logo visually *becomes* the header logo.
 *
 * Linear easing on the strokes keeps pen speed constant (no pulsing),
 * power3.inOut on the fly gives it that polished "the logo was just
 * created and now it settled home" feel.
 *
 * Runs on every page load.
 */

const STAGE_PX = 360;

export default function SplashIntro({ onDone }) {
  const rootRef = useRef(null);
  const bgRef = useRef(null);
  const glowRef = useRef(null);
  const stageRef = useRef(null);
  const cPathRef = useRef(null);
  const sPathRef = useRef(null);

  useLayoutEffect(() => {
    const navLogoBox =
      document.querySelector('[data-testid="logo-home-link"] > div');
    if (navLogoBox) {
      navLogoBox.style.opacity = "0";
      navLogoBox.style.transition = "none";
    }

    gsap.fromTo(
      rootRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.45, ease: "power2.out" }
    );
    gsap.fromTo(
      stageRef.current,
      { scale: 0.86, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.9, ease: "power3.out" }
    );
    gsap.to(glowRef.current, {
      opacity: 0.55,
      duration: 1.6,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    });

    const seed = (el) => {
      if (!el) return 0;
      const len = el.getTotalLength();
      el.setAttribute("stroke-dasharray", `${len}`);
      el.setAttribute("stroke-dashoffset", `${len}`);
      return len;
    };
    seed(cPathRef.current);
    seed(sPathRef.current);

    const tl = gsap.timeline();

    // Beat 1 — C writes in (linear, smooth handwriting)
    tl.to(
      cPathRef.current,
      { attr: { "stroke-dashoffset": 0 }, duration: 1.9, ease: "none" },
      0.55
    );

    // Beat 2 — S writes in behind C, single continuous stroke
    tl.to(
      sPathRef.current,
      { attr: { "stroke-dashoffset": 0 }, duration: 2.0, ease: "none" },
      "+=0.4"
    );

    // Beat 3 — composition flies to the Navbar logo slot
    tl.add(() => {
      const target = navLogoBox || document.querySelector('[data-testid="logo-home-link"] > div');
      const stage = stageRef.current;

      const fallbackFinish = () => {
        if (navLogoBox) {
          gsap.to(navLogoBox, {
            opacity: 1,
            duration: 0.4,
            ease: "power2.out",
            onStart: () => {
              navLogoBox.style.transition = "";
            },
          });
        }
        gsap.to(rootRef.current, {
          opacity: 0,
          duration: 0.5,
          ease: "power1.inOut",
          onComplete: () => onDone?.(),
        });
      };

      if (!target || !stage) {
        fallbackFinish();
        return;
      }
      const tgtRect = target.getBoundingClientRect();
      const srcRect = stage.getBoundingClientRect();
      if (!tgtRect.width || !srcRect.width) {
        fallbackFinish();
        return;
      }
      const tgtCx = tgtRect.left + tgtRect.width / 2;
      const tgtCy = tgtRect.top + tgtRect.height / 2;
      const srcCx = srcRect.left + srcRect.width / 2;
      const srcCy = srcRect.top + srcRect.height / 2;
      const dx = tgtCx - srcCx;
      const dy = tgtCy - srcCy;
      const scale = tgtRect.width / srcRect.width;

      // Fade the dark backdrop + glow out as the logo travels.
      gsap.to(bgRef.current, { opacity: 0, duration: 0.9, ease: "power2.inOut" });
      gsap.to(glowRef.current, { opacity: 0, duration: 0.6, ease: "power1.out" });

      gsap.to(stage, {
        x: dx,
        y: dy,
        scale,
        duration: 1.15,
        ease: "power3.inOut",
        onComplete: () => {
          // Hand-off: reveal the real navbar logo in the exact same spot,
          // then fade the splash composition away so the swap is invisible.
          if (navLogoBox) {
            navLogoBox.style.transition = "";
            gsap.set(navLogoBox, { opacity: 1 });
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
    }, "+=0.35");

    return () => {
      tl.kill();
      // Safety: ensure the real logo is visible again if splash unmounts early.
      if (navLogoBox) {
        navLogoBox.style.opacity = "";
        navLogoBox.style.transition = "";
      }
    };
  }, [onDone]);

  // ---- C stroke path (anti-clockwise: top-right → bottom-right) ----
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

  // ---- S stroke path — single continuous hand-written S ----
  const S_R = 180;
  const sStart = { x: 430, y: 60 };
  const sMid = { x: 250, y: 250 };
  const sEnd = { x: 70, y: 440 };
  const sPath =
    `M ${sStart.x} ${sStart.y} ` +
    `A ${S_R} ${S_R} 0 1 0 ${sMid.x} ${sMid.y} ` +
    `A ${S_R} ${S_R} 0 1 1 ${sEnd.x} ${sEnd.y}`;

  return (
    <div
      ref={rootRef}
      data-testid="splash-intro"
      className="fixed inset-0 z-[9998] select-none"
      style={{ opacity: 0 }}
      aria-hidden
    >
      {/* Translucent backdrop — Landing bleeds through just enough to feel alive */}
      <div
        ref={bgRef}
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(10,10,10,0.72) 0%, rgba(5,5,5,0.86) 55%, rgba(0,0,0,0.94) 100%)",
          backdropFilter: "blur(18px) saturate(115%)",
          WebkitBackdropFilter: "blur(18px) saturate(115%)",
        }}
      />

      {/* Subtle film-grain vignette overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-overlay"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "3px 3px",
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
        }}
      />

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
          willChange: "transform",
          filter: "drop-shadow(0 10px 40px rgba(0,0,0,0.55))",
        }}
      >
        <svg
          viewBox="0 0 500 500"
          className="absolute inset-0 w-full h-full"
          shapeRendering="geometricPrecision"
          style={{ overflow: "visible" }}
        >
          <defs>
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

            <mask
              id="maskS"
              maskUnits="userSpaceOnUse"
              x="-200"
              y="-200"
              width="900"
              height="900"
            >
              <rect x="-200" y="-200" width="900" height="900" fill="black" />
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

          {/* BACKGROUND — S arrows artwork (extends past C so tails peek out) */}
          <image
            href="/cinemasync-s-arrows.png"
            x="-120"
            y="-120"
            width="740"
            height="740"
            preserveAspectRatio="xMidYMid meet"
            mask="url(#maskS)"
            style={{ opacity: 0.95 }}
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
