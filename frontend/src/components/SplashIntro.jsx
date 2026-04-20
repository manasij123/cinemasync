import React, { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";

/**
 * CinemaSync splash — choreographed 4-beat intro:
 *
 *   1. Film reel (punched-hole camera reel) assembles at the centre.
 *   2. Reel slides slightly left; the "C"-shaped filmstrip unrolls out of
 *      the reel — the tan band appears to thread out of the perforations
 *      and curves around the top-right and bottom-right.
 *   3. Two painted arrows sweep in from the centre behind everything:
 *      the purple one curves up-and-over to the top, the yellow one
 *      curves down-and-under to the bottom.
 *   4. Composition holds with glow, then crossfades to the real product
 *      logo and FLIPs to the top-left header slot.
 */

const MIN_DISPLAY_MS = 4000;

// Palette (from the user's logo + our brand)
const CREAM = "#F3E3C3";
const CREAM_SOFT = "#F7EDD4";
const NAVY = "#1E2B44";
const ACCENT_1 = "#D9A473";
const ACCENT_2 = "#E8A16A";
const ARROW_PURPLE = "#6A14FF";
const ARROW_YELLOW = "#FFD100";

// Geometry (400x400 viewBox)
const CENTER_X = 200;
const CENTER_Y = 200;

// Reel (final position)
const REEL_CX = 150;
const REEL_CY = 200;
const R_REEL = 72;
const R_PERF = 14;

// C-strip arcs share their own centre, shifted right of the reel so they
// curve around the right side like the final logo.
const STRIP_CX = 215;
const STRIP_CY = 200;
const STRIP_R_IN = 95;
const STRIP_R_OUT = 135;
// Top arc: from upper-left (near reel) sweeping over the top to the right
const TOP_ARC_START = -170;
const TOP_ARC_END = -10;
// Bottom arc: mirror
const BOT_ARC_START = 10;
const BOT_ARC_END = 170;

const pt = (cx, cy, r, deg) => {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

// Arc band that is the filmstrip
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

// An open arc along the centreline of the band (used to guide the
// unrolling animation via stroke-dashoffset).
const arcCenterPath = (cx, cy, r, startDeg, endDeg) => {
  const a = pt(cx, cy, r, startDeg);
  const b = pt(cx, cy, r, endDeg);
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  const sweep = endDeg > startDeg ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} ${sweep} ${b.x} ${b.y}`;
};

// Frame square placed on the arc at `deg`
const frameAt = (cx, cy, r, deg, size = 22, accent = false) => {
  const p = pt(cx, cy, r, deg);
  const half = size / 2;
  return { x: p.x - half, y: p.y - half, w: size, h: size, accent };
};

export default function SplashIntro({ onDone }) {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const svgRef = useRef(null);
  const mountedAt = useRef(Date.now());
  const morphStarted = useRef(false);

  const measureFinalSlot = () => {
    const t = document.querySelector('[data-testid="logo-home-link"] img');
    if (!t) return null;
    const r = t.getBoundingClientRect();
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

    // FLIP the ANIMATED SVG itself (not a separate raster tile) toward the
    // header logo slot. As it flies, it blurs + fades out — the real logo
    // already sitting in the header is revealed beneath. No jarring crossfade.
    const target = measureFinalSlot();
    if (!target) {
      gsap.to(rootRef.current, { opacity: 0, duration: 0.4, delay: 0.3, onComplete: () => onDone?.() });
      return;
    }
    const stage = stageRef.current;
    if (!stage) {
      gsap.to(rootRef.current, { opacity: 0, duration: 0.4, onComplete: () => onDone?.() });
      return;
    }

    // Tighten the composition — remove the background arrows first so the
    // flying shape reads as the logo silhouette, not a full splash scene.
    gsap.to(['[data-arrow3d]', '[data-arrow-icons]'], {
      opacity: 0,
      scale: 0.6,
      duration: 0.4,
      ease: "power2.in",
      transformOrigin: "center",
    });

    requestAnimationFrame(() => {
      const box = stage.getBoundingClientRect();
      const dx = target.x + target.w / 2 - (box.x + box.width / 2);
      const dy = target.y + target.h / 2 - (box.y + box.height / 2);
      const scale = (target.w * 1.15) / box.width;
      const tl = gsap.timeline({
        onComplete: () => onDone?.(),
      });
      // The stage (our animated composition) flies to the header slot
      tl.to(stage, {
        x: dx,
        y: dy,
        scale,
        duration: 0.9,
        ease: "power3.inOut",
        delay: 0.4,
      }, 0)
        // Partway through the flight, begin blurring + fading so the real
        // raster logo in the header appears to take over seamlessly.
        .to(stage, {
          filter: "blur(6px) saturate(1.3)",
          duration: 0.45,
          ease: "power2.in",
        }, 0.7)
        .to(stage, {
          opacity: 0,
          duration: 0.35,
          ease: "power1.in",
        }, 1.0)
        .to(rootRef.current, {
          opacity: 0,
          duration: 0.3,
          ease: "power1.in",
        }, 1.2);
    });
  };

  useLayoutEffect(() => {
    gsap.fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: 0.35 });
    const svg = svgRef.current;
    if (!svg) return;

    // Seed stroke-dashoffset reveals
    svg.querySelectorAll("[data-draw]").forEach((el) => {
      try {
        const len = el.getTotalLength ? el.getTotalLength() : 800;
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

    // -------- BEAT 1 (0.0 – 1.0) : Reel assembles at centre --------
    tl.fromTo('#reel-group',
      { scale: 0, transformOrigin: "200px 200px" },
      { scale: 1, duration: 0.6, ease: "back.out(1.5)" }, 0.2,
    )
      .to('[data-draw="reel-outline"]', { strokeDashoffset: 0, duration: 0.6 }, 0.2)
      .to('[data-fadein="reel-fill"]', { opacity: 1, duration: 0.3 }, 0.4)
      .to('[data-pop^="reel-perf"]', { scale: 1, opacity: 1, duration: 0.35, stagger: 0.05, ease: "back.out(2)" }, 0.55)
      .to('[data-pop="reel-spindle"]', { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(2.5)" }, 0.8);

    // -------- BEAT 2 (1.0 – 2.2) : Reel shifts left and C-strip unrolls --------
    tl.to('#reel-group', { x: -50, duration: 0.5, ease: "power2.inOut" }, 1.05)
      // Strip fills fade in just as the drawing starts, so the outline leads
      .to('[data-fadein="strip-top-fill"]', { opacity: 1, duration: 0.4 }, 1.25)
      .to('[data-draw="strip-top-outline"]', { strokeDashoffset: 0, duration: 0.9, ease: "power1.inOut" }, 1.25)
      .to('[data-fadein="strip-bot-fill"]', { opacity: 1, duration: 0.4 }, 1.55)
      .to('[data-draw="strip-bot-outline"]', { strokeDashoffset: 0, duration: 0.9, ease: "power1.inOut" }, 1.55)
      .to('[data-pop^="strip-top-frame"]', { scale: 1, opacity: 1, duration: 0.3, stagger: 0.06, ease: "back.out(2)" }, 1.9)
      .to('[data-pop^="strip-bot-frame"]', { scale: 1, opacity: 1, duration: 0.3, stagger: 0.06, ease: "back.out(2)" }, 2.05);

    // -------- BEAT 3 (2.4 – 3.3) : 3D tab arrows sweep in from centre --------
    // Seed 3D-entry state on the arrows
    gsap.set('[data-arrow3d]', {
      transformPerspective: 700,
      scale: 0.35,
      opacity: 0,
    });
    gsap.set('[data-arrow3d="top"]', { rotationX: 75, rotationZ: -25, y: 20 });
    gsap.set('[data-arrow3d="bot"]', { rotationX: -75, rotationZ: 25, y: -20 });
    gsap.set('[data-arrow-icons]', { opacity: 0, scale: 0.4, transformOrigin: "center" });

    tl.to('[data-arrow3d="top"]', {
      rotationX: 0,
      rotationZ: 0,
      y: 0,
      scale: 1,
      opacity: 1,
      duration: 0.9,
      ease: "power3.out",
    }, 2.45)
      .to('[data-arrow3d="bot"]', {
        rotationX: 0,
        rotationZ: 0,
        y: 0,
        scale: 1,
        opacity: 1,
        duration: 0.9,
        ease: "power3.out",
      }, 2.6)
      .to('[data-arrow-icons]', {
        opacity: 1,
        scale: 1,
        duration: 0.35,
        stagger: 0.12,
        ease: "back.out(2)",
      }, 3.05);

    // -------- BEAT 4 (3.3 – 3.8) : Hold + glow --------
    tl.to('#cs-splash-group', {
      filter: "drop-shadow(0 0 18px rgba(255,209,0,0.55)) drop-shadow(0 0 32px rgba(106,20,255,0.4))",
      duration: 0.45, ease: "power2.inOut",
    }, 3.35);

    const kickoff = setTimeout(runMorph, MIN_DISPLAY_MS);
    return () => {
      clearTimeout(kickoff);
      tl.kill();
    };
  }, []);

  // ---- Static shape data ----
  const topBand = bandPath(STRIP_CX, STRIP_CY, STRIP_R_IN, STRIP_R_OUT, TOP_ARC_START, TOP_ARC_END);
  const botBand = bandPath(STRIP_CX, STRIP_CY, STRIP_R_IN, STRIP_R_OUT, BOT_ARC_START, BOT_ARC_END);
  const topCenter = arcCenterPath(STRIP_CX, STRIP_CY, (STRIP_R_IN + STRIP_R_OUT) / 2, TOP_ARC_START, TOP_ARC_END);
  const botCenter = arcCenterPath(STRIP_CX, STRIP_CY, (STRIP_R_IN + STRIP_R_OUT) / 2, BOT_ARC_START, BOT_ARC_END);

  const topFrames = [-150, -110, -70, -30].map((deg, i) =>
    frameAt(STRIP_CX, STRIP_CY, (STRIP_R_IN + STRIP_R_OUT) / 2, deg, 22, i === 3),
  );
  const botFrames = [30, 70, 110, 150].map((deg, i) =>
    frameAt(STRIP_CX, STRIP_CY, (STRIP_R_IN + STRIP_R_OUT) / 2, deg, 22, i === 3),
  );

  const perfs = Array.from({ length: 5 }, (_, i) => {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    return {
      cx: REEL_CX + Math.cos(a) * (R_REEL - 28),
      cy: REEL_CY + Math.sin(a) * (R_REEL - 28),
    };
  });

  // Background arrows — tab-shaped, like the user's hand-drawn logo.
  // Each is a thick banana-shape arc with an arrowhead at the tip.
  // Top arrow (orange): sweeps from left-of-reel up and around to the right.
  // Bottom arrow (blue): sweeps from right-of-reel down and around to the left.
  const tabArrow = ({ cx, cy, rIn, rOut, start, end, headLen = 36 }) => {
    const startOuter = pt(cx, cy, rOut, start);
    const endOuter = pt(cx, cy, rOut, end);
    const endInner = pt(cx, cy, rIn, end);
    const startInner = pt(cx, cy, rIn, start);
    // Tangent direction at `end` (for placing the arrowhead tip)
    const tang = {
      x: -Math.sin((end * Math.PI) / 180),
      y: Math.cos((end * Math.PI) / 180),
    };
    const sweepSign = end > start ? 1 : -1;
    // Tip = mid-radius, pushed further along tangent
    const midR = (rIn + rOut) / 2;
    const base = pt(cx, cy, midR, end);
    const tip = {
      x: base.x + tang.x * headLen * sweepSign,
      y: base.y + tang.y * headLen * sweepSign,
    };
    // Arrowhead wings extend perpendicular to the tangent
    const wingOuter = {
      x: endOuter.x + tang.x * (headLen * 0.4) * sweepSign,
      y: endOuter.y + tang.y * (headLen * 0.4) * sweepSign,
    };
    const wingInner = {
      x: endInner.x + tang.x * (headLen * 0.4) * sweepSign,
      y: endInner.y + tang.y * (headLen * 0.4) * sweepSign,
    };
    const large = Math.abs(end - start) > 180 ? 1 : 0;
    const sweepOut = end > start ? 1 : 0;
    const d = [
      `M ${startOuter.x} ${startOuter.y}`,
      `A ${rOut} ${rOut} 0 ${large} ${sweepOut} ${endOuter.x} ${endOuter.y}`,
      `L ${wingOuter.x} ${wingOuter.y}`,
      `L ${tip.x} ${tip.y}`,
      `L ${wingInner.x} ${wingInner.y}`,
      `L ${endInner.x} ${endInner.y}`,
      `A ${rIn} ${rIn} 0 ${large} ${1 - sweepOut} ${startInner.x} ${startInner.y}`,
      `Z`,
    ].join(" ");
    return d;
  };

  // Top arrow (orange tab): arcs over the top, points up-right
  const arrowTopD = tabArrow({
    cx: 200, cy: 200, rIn: 115, rOut: 165,
    start: 200, end: 335, headLen: 40,
  });
  // Bottom arrow (blue tab): arcs under the bottom, points down-left
  const arrowBotD = tabArrow({
    cx: 200, cy: 200, rIn: 115, rOut: 165,
    start: 20, end: 155, headLen: 40,
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

      <div ref={stageRef} className="relative" style={{ width: 480, height: 480, willChange: "transform, opacity, filter" }}>
        <svg ref={svgRef} viewBox="0 0 400 400" className="absolute inset-0 w-full h-full">
          <g id="cs-splash-group">
            {/* ===== BACKGROUND TAB ARROWS (orange top, blue bottom) ===== */}
            <defs>
              <linearGradient id="arrowOrangeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stopColor="#F7B876" />
                <stop offset="55%" stopColor="#E8A16A" />
                <stop offset="100%" stopColor="#B5763C" />
              </linearGradient>
              <linearGradient id="arrowBlueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stopColor="#7AA1D8" />
                <stop offset="55%" stopColor="#4A77B5" />
                <stop offset="100%" stopColor="#2A4777" />
              </linearGradient>
            </defs>

            <g data-arrow3d="top" style={{ transformOrigin: "200px 200px", transformBox: "fill-box" }}>
              <path
                d={arrowTopD}
                fill="url(#arrowOrangeGrad)"
                opacity="0.92"
                style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.5))" }}
              />
              <path
                d={arrowTopD}
                fill="none"
                stroke={NAVY}
                strokeWidth="4"
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity="0.85"
              />
              {/* Mini icon hint — lightbulb + gear dots inside the tab */}
              <g data-arrow-icons="top">
                <circle cx="260" cy="85" r="7" fill="#FFE0A8" stroke={NAVY} strokeWidth="2" />
                <circle cx="295" cy="105" r="9" fill="none" stroke={NAVY} strokeWidth="2.5" />
                <circle cx="295" cy="105" r="4" fill={NAVY} />
              </g>
            </g>

            <g data-arrow3d="bot" style={{ transformOrigin: "200px 200px", transformBox: "fill-box" }}>
              <path
                d={arrowBotD}
                fill="url(#arrowBlueGrad)"
                opacity="0.92"
                style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.5))" }}
              />
              <path
                d={arrowBotD}
                fill="none"
                stroke={NAVY}
                strokeWidth="4"
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity="0.85"
              />
              {/* Mini icon hint — calendar + clock inside the tab */}
              <g data-arrow-icons="bot">
                <rect x="112" y="275" width="16" height="16" rx="2" fill="#F0F6FF" stroke={NAVY} strokeWidth="2" />
                <line x1="115" y1="280" x2="125" y2="280" stroke={NAVY} strokeWidth="1.5" />
                <circle cx="148" cy="300" r="9" fill="#F0F6FF" stroke={NAVY} strokeWidth="2" />
                <line x1="148" y1="300" x2="148" y2="295" stroke={NAVY} strokeWidth="1.8" />
                <line x1="148" y1="300" x2="152" y2="303" stroke={NAVY} strokeWidth="1.8" />
              </g>
            </g>

            {/* ===== C-SHAPED FILMSTRIP (drawn before the reel so the reel sits on top) ===== */}
            {/* Top strip */}
            <path data-fadein="strip-top-fill" d={topBand} fill={CREAM} />
            <path
              data-draw="strip-top-outline"
              d={topCenter}
              fill="none"
              stroke={NAVY}
              strokeWidth={STRIP_R_OUT - STRIP_R_IN}
              strokeLinecap="butt"
              opacity="0"
              style={{ mixBlendMode: "normal" }}
            />
            {/* visible outline on top of fill */}
            <path d={topBand} fill="none" stroke={NAVY} strokeWidth="5" strokeLinejoin="round" data-fadein="strip-top-fill" />
            {topFrames.map((f, i) => (
              <g key={`t-${i}`} data-pop={`strip-top-frame-${i}`}>
                <rect
                  x={f.x} y={f.y} width={f.w} height={f.h} rx="3"
                  fill={f.accent ? (i % 2 === 0 ? ACCENT_1 : ACCENT_2) : "transparent"}
                  stroke={NAVY} strokeWidth="3"
                />
              </g>
            ))}

            {/* Bottom strip */}
            <path data-fadein="strip-bot-fill" d={botBand} fill={CREAM} />
            <path
              data-draw="strip-bot-outline"
              d={botCenter}
              fill="none"
              stroke={NAVY}
              strokeWidth={STRIP_R_OUT - STRIP_R_IN}
              strokeLinecap="butt"
              opacity="0"
            />
            <path d={botBand} fill="none" stroke={NAVY} strokeWidth="5" strokeLinejoin="round" data-fadein="strip-bot-fill" />
            {botFrames.map((f, i) => (
              <g key={`b-${i}`} data-pop={`strip-bot-frame-${i}`}>
                <rect
                  x={f.x} y={f.y} width={f.w} height={f.h} rx="3"
                  fill={f.accent ? (i % 2 === 0 ? ACCENT_1 : ACCENT_2) : "transparent"}
                  stroke={NAVY} strokeWidth="3"
                />
              </g>
            ))}

            {/* ===== FILM REEL (on top, in its own group so we can translate it) ===== */}
            <g id="reel-group">
              <circle data-fadein="reel-fill" cx={REEL_CX} cy={REEL_CY} r={R_REEL} fill={CREAM_SOFT} />
              <circle
                data-draw="reel-outline"
                cx={REEL_CX}
                cy={REEL_CY}
                r={R_REEL}
                fill="none"
                stroke={NAVY}
                strokeWidth="5"
                strokeLinecap="round"
              />
              {perfs.map((p, i) => (
                <g key={i} data-pop={`reel-perf-${i}`}>
                  <ellipse cx={p.cx} cy={p.cy} rx={R_PERF} ry={R_PERF} fill="#3c4a66" />
                  <ellipse cx={p.cx - 3} cy={p.cy - 3} rx={R_PERF - 5} ry={R_PERF - 6} fill="#6a7a94" opacity="0.55" />
                  <ellipse cx={p.cx} cy={p.cy} rx={R_PERF} ry={R_PERF} fill="none" stroke={NAVY} strokeWidth="2.5" />
                </g>
              ))}
              <g data-pop="reel-spindle">
                <circle cx={REEL_CX} cy={REEL_CY} r="7" fill="#3c4a66" stroke={NAVY} strokeWidth="2.5" />
              </g>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
