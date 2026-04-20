import React, { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";

/**
 * CinemaSync splash intro.
 *
 *   Beat 1 — C (film-reel logo) writes itself the way a hand draws a "C":
 *            anti-clockwise from top-right sweeping round to bottom-right.
 *
 *   Beat 2 — S (pair of circular arrows) writes itself BEHIND the C as a
 *            single, continuous hand-written S (top curl → bottom curl).
 *            S is deliberately a touch larger than C so its arrow tails
 *            peek out behind the film-reel.
 *
 *   Beat 3 — The finished composition smoothly flies to the navbar logo
 *            slot (top-left of the page) and shrinks to fit, so it looks
 *            like the logo was just drawn into existence and then settled
 *            into its home in the header.
 *
 * Linear easing on the strokes keeps the pen speed constant so the draw
 * reads as smooth handwriting without any pulsing / jitter.  Runs on
 * every page load.
 */

const STAGE_PX = 360; // size of the centred composition

export default function SplashIntro({ onDone }) {
  const rootRef = useRef(null);
  const bgRef = useRef(null);
  const stageRef = useRef(null);
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

    // Linear easing — pen moves at constant speed, no pulsing.
    const tl = gsap.timeline();

    // Beat 1 — C (foreground) writes in anti-clockwise
    tl.to(
      cPathRef.current,
      { attr: { "stroke-dashoffset": 0 }, duration: 2.0, ease: "none" },
      0.35
    );

    // Tiny pause between beats
    // Beat 2 — S (background) writes in as one continuous stroke
    tl.to(
      sPathRef.current,
      { attr: { "stroke-dashoffset": 0 }, duration: 2.0, ease: "none" },
      "+=0.35"
    );

    // Beat 3 — composition flies to header logo slot
    tl.add(() => {
      const target = document.querySelector('[data-testid="logo-home-link"] img');
      const stage = stageRef.current;
      if (!target || !stage) {
        gsap.to(rootRef.current, {
          opacity: 0,
          duration: 0.5,
          ease: "power1.inOut",
          onComplete: () => onDone?.(),
        });
        return;
      }
      const tgtRect = target.getBoundingClientRect();
      const tgtCx = tgtRect.left + tgtRect.width / 2;
      const tgtCy = tgtRect.top + tgtRect.height / 2;
      const srcRect = stage.getBoundingClientRect();
      const srcCx = srcRect.left + srcRect.width / 2;
      const srcCy = srcRect.top + srcRect.height / 2;
      const dx = tgtCx - srcCx;
      const dy = tgtCy - srcCy;
      const scale = tgtRect.width / srcRect.width;

      // Fade the dark backdrop early so the composition appears to
      // "leave" the splash and dock into the navbar.
      gsap.to(bgRef.current, {
        opacity: 0,
        duration: 0.7,
        ease: "power2.inOut",
      });
      gsap.to(stage, {
        x: dx,
        y: dy,
        scale,
        duration: 1.1,
        ease: "power3.inOut",
        onComplete: () => {
          gsap.to(rootRef.current, {
            opacity: 0,
            duration: 0.35,
            ease: "power1.out",
            onComplete: () => onDone?.(),
          });
        },
      });
    }, "+=0.35");

    return () => {
      tl.kill();
    };
  }, [onDone]);

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
  const cPath = `M ${cStart.x} ${cStart.y} A ${C_RADIUS} ${C_RADIUS} 0 1 0 ${cEnd.x} ${cEnd.y}`;

  // ---- S stroke path — ONE continuous path, hand-written S ----
  //   top-right  →  (anti-cw top curl)  →  middle  →  (cw bottom curl)  →  bottom-left
  // S reaches slightly beyond C so the arrow tails of the artwork peek
  // out on both sides.
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
      {/* Dark backdrop — faded out when the logo flies to the header */}
      <div
        ref={bgRef}
        className="absolute inset-0 bg-[#0b0b0b]"
        style={{
          background:
            "radial-gradient(ellipse at center, #141414 0%, #050505 70%, #000 100%)",
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
        }}
      >
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

            {/* Mask for the S — single continuous stroke */}
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

          {/* BACKGROUND — S arrows artwork (slightly larger than the C) */}
          <image
            href="/cinemasync-s-arrows.png"
            x="-120"
            y="-120"
            width="740"
            height="740"
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
