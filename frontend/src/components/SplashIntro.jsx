import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";

/**
 * CinemaSync splash intro — runs once on first-ever visit to the landing page.
 *
 * Timeline (≈3.5 s total):
 *   0.00 → 0.40   black curtain + film-grain noise fade in
 *   0.40 → 1.20   neon rings stroke in (purple/yellow/green)
 *   0.80 → 1.80   logo tile scale + rotate-in from centre
 *   1.00 → 2.00   scan-line sweeps across
 *   1.40 → 2.20   "CINEMASYNC" word-mark types in with cursor
 *   2.20 → 2.80   hold + pulse glow
 *   2.80 → 3.40   FLIP morph — logo shrinks & flies to its header slot
 *   3.30 → 3.55   overlay fades out, reveals Landing underneath
 */
export default function SplashIntro({ onDone }) {
  const rootRef = useRef(null);
  const tileRef = useRef(null);
  const ringRef = useRef(null);
  const wordRef = useRef(null);
  const cursorRef = useRef(null);
  const scanRef = useRef(null);
  const grainRef = useRef(null);
  const [finalRect, setFinalRect] = useState(null);

  // Probe the header logo's final screen coords just before we land.
  const measureFinalSlot = () => {
    const target = document.querySelector('[data-testid="logo-home-link"] img');
    if (!target) return null;
    const r = target.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  };

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: "power3.out" },
        onComplete: () => {
          // Hold one frame, then notify parent to unmount us
          requestAnimationFrame(() => onDone?.());
        },
      });

      // 0.00–0.40 — curtain + grain
      tl.fromTo(
        rootRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.4, ease: "power1.out" },
      )
        .fromTo(
          grainRef.current,
          { opacity: 0 },
          { opacity: 0.25, duration: 0.4 },
          "<",
        )
        // 0.40–1.20 — rings stroke in
        .fromTo(
          ringRef.current.querySelectorAll("circle, path"),
          { strokeDashoffset: 1000, opacity: 0 },
          {
            strokeDashoffset: 0,
            opacity: 1,
            duration: 0.9,
            stagger: 0.08,
            ease: "power2.inOut",
          },
          "0.35",
        )
        // 0.80–1.80 — logo tile scale/rotate in
        .fromTo(
          tileRef.current,
          { scale: 0.1, rotate: -90, opacity: 0, filter: "blur(12px)" },
          {
            scale: 1,
            rotate: 0,
            opacity: 1,
            filter: "blur(0px)",
            duration: 1.1,
            ease: "back.out(1.6)",
          },
          "0.8",
        )
        // 1.00–2.00 — scanline sweep
        .fromTo(
          scanRef.current,
          { y: "-110%", opacity: 0 },
          { y: "110%", opacity: 0.8, duration: 1.0, ease: "power1.inOut" },
          "1.0",
        )
        // 1.40–2.20 — wordmark reveal (clip-path wipe)
        .fromTo(
          wordRef.current,
          { clipPath: "inset(0 100% 0 0)", opacity: 0 },
          {
            clipPath: "inset(0 0% 0 0)",
            opacity: 1,
            duration: 0.8,
            ease: "power2.out",
          },
          "1.4",
        )
        .fromTo(
          cursorRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.1, repeat: 6, yoyo: true },
          "1.6",
        )
        // 2.20–2.80 — pulse glow hold
        .to(
          tileRef.current,
          {
            boxShadow:
              "0 0 60px rgba(255, 209, 0, 0.55), 0 0 120px rgba(106, 20, 255, 0.35)",
            duration: 0.6,
            ease: "power2.inOut",
          },
          "2.2",
        )
        // 2.80–3.40 — FLIP morph to header
        .add(() => {
          const rect = measureFinalSlot();
          if (rect) setFinalRect(rect);
        }, "2.75")
        .to(
          wordRef.current,
          { opacity: 0, y: -12, duration: 0.35, ease: "power2.in" },
          "2.80",
        )
        .to(
          ringRef.current,
          { opacity: 0, scale: 0.6, duration: 0.45, ease: "power2.in" },
          "2.80",
        )
        .to(
          tileRef.current,
          {
            duration: 0.6,
            ease: "power3.inOut",
            onStart: function () {
              const rect = measureFinalSlot();
              if (!rect || !tileRef.current) return;
              const currentBox = tileRef.current.getBoundingClientRect();
              const dx = rect.x + rect.w / 2 - (currentBox.x + currentBox.width / 2);
              const dy = rect.y + rect.h / 2 - (currentBox.y + currentBox.height / 2);
              const scale = rect.w / currentBox.width;
              gsap.to(tileRef.current, {
                x: dx,
                y: dy,
                scale,
                boxShadow: "0 0 0 rgba(255,209,0,0)",
                borderColor: "rgba(255,255,255,0.15)",
                duration: 0.6,
                ease: "power3.inOut",
              });
            },
          },
          "2.85",
        )
        // 3.30–3.55 — overlay fade out
        .to(
          rootRef.current,
          { opacity: 0, duration: 0.25, ease: "power1.in" },
          "3.30",
        );
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={rootRef}
      data-testid="splash-intro"
      className="fixed inset-0 z-[9998] flex items-center justify-center overflow-hidden bg-[#0b0b0b] select-none"
      style={{ opacity: 0 }}
      aria-hidden
    >
      {/* Film grain noise */}
      <div
        ref={grainRef}
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
          mixBlendMode: "overlay",
          opacity: 0,
        }}
      />

      {/* Concentric neon rings behind the logo */}
      <svg
        ref={ringRef}
        width="560"
        height="560"
        viewBox="-280 -280 560 560"
        className="absolute pointer-events-none"
        style={{ overflow: "visible" }}
      >
        <defs>
          <radialGradient id="glowPurple" cx="0" cy="0" r="1" gradientUnits="objectBoundingBox">
            <stop offset="0%" stopColor="#6a14ff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#6a14ff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle r="240" fill="url(#glowPurple)" />
        <circle
          r="220"
          fill="none"
          stroke="#6a14ff"
          strokeWidth="1.5"
          strokeDasharray="1000"
          style={{ filter: "drop-shadow(0 0 10px rgba(106,20,255,0.7))" }}
        />
        <circle
          r="180"
          fill="none"
          stroke="#ffd100"
          strokeWidth="1"
          strokeDasharray="1000"
          style={{ filter: "drop-shadow(0 0 10px rgba(255,209,0,0.6))" }}
        />
        <circle
          r="140"
          fill="none"
          stroke="#39ff14"
          strokeWidth="0.8"
          strokeDasharray="1000"
          opacity="0.8"
          style={{ filter: "drop-shadow(0 0 8px rgba(57,255,20,0.55))" }}
        />
        {/* Decorative corner ticks */}
        {[0, 90, 180, 270].map((a) => (
          <path
            key={a}
            d="M 250 0 L 275 0"
            stroke="#ffd100"
            strokeWidth="2"
            strokeDasharray="1000"
            transform={`rotate(${a})`}
          />
        ))}
      </svg>

      {/* Scan line sweep */}
      <div
        ref={scanRef}
        className="absolute pointer-events-none"
        style={{
          left: "50%",
          top: 0,
          width: "620px",
          height: "14%",
          transform: "translateX(-50%)",
          background:
            "linear-gradient(to bottom, rgba(255,255,0,0) 0%, rgba(255,255,0,0.08) 45%, rgba(255,209,0,0.35) 50%, rgba(255,255,0,0.08) 55%, rgba(255,255,0,0) 100%)",
          filter: "blur(1px)",
          opacity: 0,
        }}
      />

      {/* Central logo tile — this is the element that FLIPs into the header */}
      <div
        ref={tileRef}
        className="relative rounded-md overflow-hidden flex items-center justify-center"
        style={{
          width: 220,
          height: 220,
          background: "#ffffff",
          border: "2px solid rgba(255,209,0,0.6)",
          boxShadow:
            "0 0 40px rgba(255,209,0,0.35), 0 0 100px rgba(106,20,255,0.25), inset 0 0 0 1px rgba(255,255,255,0.8)",
          transformOrigin: "center",
          willChange: "transform, opacity, filter",
        }}
      >
        <img
          src="/cinemasync-logo.svg"
          alt=""
          className="w-[88%] h-[88%] object-contain"
          draggable={false}
        />
      </div>

      {/* Wordmark below logo */}
      <div
        className="absolute"
        style={{ top: "calc(50% + 140px)", left: "50%", transform: "translateX(-50%)" }}
      >
        <div
          ref={wordRef}
          className="font-head text-5xl sm:text-6xl tracking-[0.08em] uppercase text-white whitespace-nowrap"
          style={{
            textShadow:
              "0 0 24px rgba(255,209,0,0.45), 0 0 50px rgba(106,20,255,0.35)",
          }}
        >
          CinemaSync
          <span
            ref={cursorRef}
            className="inline-block ml-1 align-middle"
            style={{
              width: 4,
              height: "0.8em",
              background: "#ffd100",
              marginLeft: 8,
              verticalAlign: "-0.05em",
            }}
          />
        </div>
        <div className="mt-2 text-center font-mono text-[10px] tracking-[0.55em] uppercase text-[#ffd100]/80">
          Watch · Party · Sync
        </div>
      </div>

      {/* Vignette edges */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(0,0,0,0.85) 100%)",
        }}
      />
    </div>
  );
}
