import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";

/**
 * CinemaSync splash intro — plays an .mp4 splash video, then seamlessly
 * transforms the video's final frame into the product logo and FLIPs it to
 * the header slot at the top-left corner.
 *
 * Timeline:
 *   0.00                 fade overlay in
 *   0.00 → video ends    mp4 plays (muted autoplay) in the centre tile
 *   video end + min 3.5s crossfade video → logo tile at same position
 *   +0.65s               FLIP the logo tile to the header logo coordinates
 *   +0.30s fade          overlay disappears, revealing the Landing page
 *
 * Both ends of the splash are safe: we never block on a broken mp4
 * (6 s watchdog), and we never morph before the user has spent enough
 * time to feel the intro (3.5 s floor).
 */

const MIN_DISPLAY_MS = 3500; // user-chosen cinematic duration
const WATCHDOG_MS = 6500;    // absolute safety cap

export default function SplashIntro({ onDone }) {
  const rootRef = useRef(null);
  const videoRef = useRef(null);
  const tileRef = useRef(null);
  const mountedAt = useRef(Date.now());
  const morphStarted = useRef(false);

  const [phase, setPhase] = useState("video"); // video | morph | done

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
    setPhase("morph");

    // Crossfade: video → logo tile
    gsap.to(videoRef.current, {
      opacity: 0,
      duration: 0.35,
      ease: "power2.out",
    });
    gsap.fromTo(
      tileRef.current,
      { opacity: 0, scale: 0.94 },
      { opacity: 1, scale: 1, duration: 0.35, ease: "power2.out" },
    );

    // FLIP the centred tile to the header slot
    requestAnimationFrame(() => {
      const targetRect = measureFinalSlot();
      if (!targetRect) {
        gsap.to(rootRef.current, {
          opacity: 0,
          duration: 0.4,
          delay: 0.5,
          onComplete: () => { setPhase("done"); onDone?.(); },
        });
        return;
      }
      const box = tileRef.current.getBoundingClientRect();
      const dx = targetRect.x + targetRect.w / 2 - (box.x + box.width / 2);
      const dy = targetRect.y + targetRect.h / 2 - (box.y + box.height / 2);
      const scale = targetRect.w / box.width;

      gsap.to(tileRef.current, {
        x: dx,
        y: dy,
        scale,
        boxShadow: "0 0 0 rgba(255,209,0,0)",
        borderColor: "rgba(255,255,255,0.15)",
        duration: 0.65,
        ease: "power3.inOut",
        delay: 0.3,
      });

      gsap.to(rootRef.current, {
        opacity: 0,
        duration: 0.3,
        delay: 0.85,
        ease: "power1.in",
        onComplete: () => { setPhase("done"); onDone?.(); },
      });
    });
  };

  // Fade overlay in + start the video
  useLayoutEffect(() => {
    gsap.fromTo(
      rootRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.35, ease: "power1.out" },
    );
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.playsInline = true;
    const p = v.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        // autoplay blocked → skip straight to logo after the min duration
        runMorph();
      });
    }
  }, []);

  // Absolute safety watchdog
  useEffect(() => {
    const t = setTimeout(() => {
      if (!morphStarted.current) runMorph();
    }, WATCHDOG_MS);
    return () => clearTimeout(t);
  }, []);

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
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,0.92) 100%)",
        }}
      />

      {/* Central stage — video and logo tile share the same rect so the
          crossfade is pixel-aligned. */}
      <div className="relative" style={{ width: 360, height: 360 }}>
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          preload="auto"
          onEnded={runMorph}
          className="absolute inset-0 w-full h-full object-contain"
          style={{ borderRadius: 12, background: "transparent" }}
          data-testid="splash-video"
        >
          <source src="/splash-intro.webm" type="video/webm" />
          <source src="/splash-intro.mp4" type="video/mp4" />
        </video>
        <div
          ref={tileRef}
          className="absolute inset-0 rounded-md overflow-hidden flex items-center justify-center"
          style={{
            background: "#ffffff",
            border: "2px solid rgba(255,209,0,0.6)",
            boxShadow:
              "0 0 40px rgba(255,209,0,0.35), 0 0 100px rgba(106,20,255,0.25)",
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
