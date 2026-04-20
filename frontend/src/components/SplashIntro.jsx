import React, { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";

/**
 * CinemaSync splash intro — assembles the brand's own shape vocabulary:
 *   • Film reel (circle + 5 perforations + spindle) — left side
 *   • Top-right filmstrip arc (cream strip with dark frame squares)
 *   • Bottom-right filmstrip arc (mirror of the top one)
 *
 * Together they form the stylised "C" of the CinemaSync logo.
 *
 * Technique:
 *   • Pure inline SVG, no Three.js required for this line-art look.
 *   • Dark navy strokes are drawn in via stroke-dashoffset ("sketching" effect).
 *   • Fills fade in after the outlines lock.
 *   • Frame squares + reel perforations pop in with back-ease stagger.
 *   • At the end, the SVG crossfades to the real product logo tile which then
 *     FLIPs to the header slot at the top-left corner.
 *
 * Duration ≈ 3.8 s, first-visit-only (gated upstream in Landing.jsx).
 */

const MIN_DISPLAY_MS = 3800;

// ---- Geometry constants (in the SVG's 400x400 viewBox, origin 200,200) ----
const R_REEL_OUTER = 85;        // film reel outer radius
const R_REEL_INNER = 70;        // perforation orbit radius
const R_PERF = 18;              // each perforation
const REEL_CX = 135;
const REEL_CY = 200;

// Arc band (filmstrip) parameters
const STRIP_R_INNER = 95;
const STRIP_R_OUTER = 135;
const STRIP_CX = 220;
const STRIP_CY = 200;
// Top arc spans from ~-55° (top-left) to ~20° (right)
const TOP_ARC_START = -120;
const TOP_ARC_END = 15;
// Bottom arc spans symmetric
const BOT_ARC_START = 20;
const BOT_ARC_END = 155;

// Convert polar to cartesian
const pt = (cx, cy, r, deg) => {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

// Build a banded arc path (filmstrip) between r_inner and r_outer
const bandPath = (cx, cy, rIn, rOut, startDeg, endDeg) => {
  const a = pt(cx, cy, rOut, startDeg);
  const b = pt(cx, cy, rOut, endDeg);
  const c = pt(cx, cy, rIn, endDeg);
  const d = pt(cx, cy, rIn, startDeg);
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  const sweep = endDeg > startDeg ? 1 : 0;
  return [
    `M ${a.x} ${a.y}`,
    `A ${rOut} ${rOut} 0 ${large} ${sweep} ${b.x} ${b.y}`,
    `L ${c.x} ${c.y}`,
    `A ${rIn} ${rIn} 0 ${large} ${1 - sweep} ${d.x} ${d.y}`,
    "Z",
  ].join(" ");
};

// Build a frame-square path placed on an arc at angle `deg`, size scale `s`
const frameSquareAt = (cx, cy, r, deg, size = 22, accent = false) => {
  const p = pt(cx, cy, r, deg);
  const half = size / 2;
  return {
    x: p.x - half,
    y: p.y - half,
    w: size,
    h: size,
    accent,
  };
};

// Palette (from the user's logo)
const CREAM = "#F3E3C3";
const CREAM_SOFT = "#F7EDD4";
const NAVY = "#1E2B44";
const ACCENT_1 = "#D9A473";
const ACCENT_2 = "#E8A16A";

export default function SplashIntro({ onDone }) {
  const rootRef = useRef(null);
  const tileRef = useRef(null);
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

    // Crossfade built SVG → real logo tile
    gsap.to(svgRef.current, { opacity: 0, scale: 0.94, duration: 0.35, ease: "power2.out" });
    gsap.fromTo(
      tileRef.current,
      { opacity: 0, scale: 0.94 },
      { opacity: 1, scale: 1, duration: 0.35, ease: "power2.out" },
    );

    requestAnimationFrame(() => {
      const target = measureFinalSlot();
      if (!target) {
        gsap.to(rootRef.current, { opacity: 0, duration: 0.4, delay: 0.5, onComplete: () => onDone?.() });
        return;
      }
      const box = tileRef.current.getBoundingClientRect();
      const dx = target.x + target.w / 2 - (box.x + box.width / 2);
      const dy = target.y + target.h / 2 - (box.y + box.height / 2);
      const scale = target.w / box.width;
      gsap.to(tileRef.current, {
        x: dx, y: dy, scale,
        boxShadow: "0 0 0 rgba(255,209,0,0)",
        borderColor: "rgba(255,255,255,0.15)",
        duration: 0.65, ease: "power3.inOut", delay: 0.25,
      });
      gsap.to(rootRef.current, {
        opacity: 0, duration: 0.3, delay: 0.85, ease: "power1.in",
        onComplete: () => onDone?.(),
      });
    });
  };

  useLayoutEffect(() => {
    gsap.fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: 0.35 });

    const svg = svgRef.current;
    if (!svg) return;

    // Seed every stroked path for stroke-dashoffset reveal
    svg.querySelectorAll("[data-draw]").forEach((el) => {
      try {
        const len = el.getTotalLength ? el.getTotalLength() : 600;
        el.style.strokeDasharray = `${len}`;
        el.style.strokeDashoffset = `${len}`;
      } catch {}
    });
    svg.querySelectorAll("[data-fadein]").forEach((el) => { el.style.opacity = "0"; });
    svg.querySelectorAll("[data-pop]").forEach((el) => {
      el.style.transformBox = "fill-box";
      el.style.transformOrigin = "center";
      el.style.transform = "scale(0)";
      el.style.opacity = "0";
    });

    const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

    // 1) Reel circle outline draws in
    tl.to('[data-draw="reel-outline"]', { strokeDashoffset: 0, duration: 0.8 }, 0.2)
      // 2) Reel fill pours in
      .to('[data-fadein="reel-fill"]', { opacity: 1, duration: 0.4 }, 0.7)
      // 3) Reel perforations pop
      .to('[data-pop^="reel-perf"]', {
        scale: 1, opacity: 1, duration: 0.4, stagger: 0.06, ease: "back.out(2)",
      }, 0.9)
      .to('[data-pop="reel-spindle"]', {
        scale: 1, opacity: 1, duration: 0.4, ease: "back.out(2.5)",
      }, 1.15)
      // 4) Top strip sketches in
      .to('[data-draw="strip-top-outline"]', { strokeDashoffset: 0, duration: 0.85 }, 1.1)
      .to('[data-fadein="strip-top-fill"]', { opacity: 1, duration: 0.4 }, 1.7)
      // 5) Top frame squares pop
      .to('[data-pop^="strip-top-frame"]', {
        scale: 1, opacity: 1, duration: 0.35, stagger: 0.07, ease: "back.out(2)",
      }, 1.85)
      // 6) Bottom strip mirrors the move
      .to('[data-draw="strip-bot-outline"]', { strokeDashoffset: 0, duration: 0.85 }, 1.9)
      .to('[data-fadein="strip-bot-fill"]', { opacity: 1, duration: 0.4 }, 2.5)
      .to('[data-pop^="strip-bot-frame"]', {
        scale: 1, opacity: 1, duration: 0.35, stagger: 0.07, ease: "back.out(2)",
      }, 2.65)
      // 7) Glow pulse over the whole group
      .to('#cs-splash-group', {
        filter: "drop-shadow(0 0 18px rgba(255,209,0,0.55)) drop-shadow(0 0 32px rgba(106,20,255,0.4))",
        duration: 0.5, ease: "power2.inOut",
      }, 3.0);

    const kickoff = setTimeout(runMorph, MIN_DISPLAY_MS);
    return () => {
      clearTimeout(kickoff);
      tl.kill();
    };
  }, []);

  // ---- Static shape data ----
  const topArcBand = bandPath(STRIP_CX, STRIP_CY, STRIP_R_INNER, STRIP_R_OUTER, TOP_ARC_START, TOP_ARC_END);
  const botArcBand = bandPath(STRIP_CX, STRIP_CY, STRIP_R_INNER, STRIP_R_OUTER, BOT_ARC_START, BOT_ARC_END);

  const topFrames = [-95, -60, -25, 10].map((deg, i) => frameSquareAt(
    STRIP_CX, STRIP_CY, (STRIP_R_INNER + STRIP_R_OUTER) / 2, deg, 22, i === 3,
  ));
  const botFrames = [30, 65, 100, 135].map((deg, i) => frameSquareAt(
    STRIP_CX, STRIP_CY, (STRIP_R_INNER + STRIP_R_OUTER) / 2, deg, 22, i === 3,
  ));

  const perfs = Array.from({ length: 5 }, (_, i) => {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    return {
      cx: REEL_CX + Math.cos(a) * (R_REEL_INNER - 20),
      cy: REEL_CY + Math.sin(a) * (R_REEL_INNER - 20),
    };
  });

  return (
    <div
      ref={rootRef}
      data-testid="splash-intro"
      className="fixed inset-0 z-[9998] flex items-center justify-center overflow-hidden bg-[#0b0b0b] select-none"
      style={{ opacity: 0 }}
      aria-hidden
    >
      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,0.92) 100%)" }}
      />

      {/* Central stage */}
      <div className="relative" style={{ width: 420, height: 420 }}>
        <svg
          ref={svgRef}
          viewBox="0 0 400 400"
          className="absolute inset-0 w-full h-full"
          data-testid="splash-svg"
        >
          <g id="cs-splash-group">
            {/* =================== FILM REEL =================== */}
            {/* Fill (behind outline) */}
            <circle
              data-fadein="reel-fill"
              cx={REEL_CX}
              cy={REEL_CY}
              r={R_REEL_OUTER}
              fill={CREAM_SOFT}
            />
            {/* Outline */}
            <circle
              data-draw="reel-outline"
              cx={REEL_CX}
              cy={REEL_CY}
              r={R_REEL_OUTER}
              fill="none"
              stroke={NAVY}
              strokeWidth="6"
              strokeLinecap="round"
            />
            {/* Perforations */}
            {perfs.map((p, i) => (
              <g key={i} data-pop={`reel-perf-${i}`}>
                <ellipse cx={p.cx} cy={p.cy} rx={R_PERF} ry={R_PERF * 0.95} fill="#3c4a66" />
                <ellipse cx={p.cx - 3} cy={p.cy - 3} rx={R_PERF - 6} ry={R_PERF - 8} fill="#6a7a94" opacity="0.55" />
                <ellipse cx={p.cx} cy={p.cy} rx={R_PERF} ry={R_PERF * 0.95} fill="none" stroke={NAVY} strokeWidth="3" />
              </g>
            ))}
            {/* Spindle (center dot) */}
            <g data-pop="reel-spindle">
              <circle cx={REEL_CX} cy={REEL_CY} r="9" fill="#3c4a66" stroke={NAVY} strokeWidth="3" />
            </g>

            {/* =================== TOP FILMSTRIP ARC =================== */}
            <path
              data-fadein="strip-top-fill"
              d={topArcBand}
              fill={CREAM}
            />
            <path
              data-draw="strip-top-outline"
              d={topArcBand}
              fill="none"
              stroke={NAVY}
              strokeWidth="6"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {topFrames.map((f, i) => (
              <g key={`top-${i}`} data-pop={`strip-top-frame-${i}`}>
                <rect
                  x={f.x}
                  y={f.y}
                  width={f.w}
                  height={f.h}
                  rx="3"
                  fill={f.accent ? (i % 2 === 0 ? ACCENT_1 : ACCENT_2) : "transparent"}
                  stroke={NAVY}
                  strokeWidth="3"
                />
              </g>
            ))}
            {/* Perforation ticks along the strip edge for texture */}
            {Array.from({ length: 14 }, (_, i) => {
              const deg = TOP_ARC_START + (i / 13) * (TOP_ARC_END - TOP_ARC_START);
              const p1 = pt(STRIP_CX, STRIP_CY, STRIP_R_INNER + 3, deg);
              const p2 = pt(STRIP_CX, STRIP_CY, STRIP_R_INNER + 10, deg);
              return (
                <line
                  key={`ttick-${i}`}
                  data-fadein="strip-top-fill"
                  x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                  stroke={NAVY} strokeWidth="2" strokeLinecap="round"
                />
              );
            })}

            {/* =================== BOTTOM FILMSTRIP ARC =================== */}
            <path
              data-fadein="strip-bot-fill"
              d={botArcBand}
              fill={CREAM}
            />
            <path
              data-draw="strip-bot-outline"
              d={botArcBand}
              fill="none"
              stroke={NAVY}
              strokeWidth="6"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {botFrames.map((f, i) => (
              <g key={`bot-${i}`} data-pop={`strip-bot-frame-${i}`}>
                <rect
                  x={f.x}
                  y={f.y}
                  width={f.w}
                  height={f.h}
                  rx="3"
                  fill={f.accent ? (i % 2 === 0 ? ACCENT_1 : ACCENT_2) : "transparent"}
                  stroke={NAVY}
                  strokeWidth="3"
                />
              </g>
            ))}
            {Array.from({ length: 14 }, (_, i) => {
              const deg = BOT_ARC_START + (i / 13) * (BOT_ARC_END - BOT_ARC_START);
              const p1 = pt(STRIP_CX, STRIP_CY, STRIP_R_INNER + 3, deg);
              const p2 = pt(STRIP_CX, STRIP_CY, STRIP_R_INNER + 10, deg);
              return (
                <line
                  key={`btick-${i}`}
                  data-fadein="strip-bot-fill"
                  x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                  stroke={NAVY} strokeWidth="2" strokeLinecap="round"
                />
              );
            })}
          </g>
        </svg>

        {/* Crossfade target — the real product logo */}
        <div
          ref={tileRef}
          className="absolute rounded-md overflow-hidden flex items-center justify-center"
          style={{
            top: "50%",
            left: "50%",
            width: 240,
            height: 240,
            transform: "translate(-50%, -50%)",
            background: "#ffffff",
            border: "2px solid rgba(255,209,0,0.6)",
            boxShadow: "0 0 40px rgba(255,209,0,0.35), 0 0 100px rgba(106,20,255,0.25)",
            opacity: 0,
            transformOrigin: "center",
            willChange: "transform, opacity",
          }}
          data-testid="splash-logo-tile"
        >
          <img
            src="/cinemasync-logo.svg"
            alt=""
            className="w-[88%] h-[88%] object-contain"
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}
