import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";
import { gsap } from "gsap";

/**
 * CinemaSync splash intro — code-driven 3D scene (no pre-rendered video).
 *
 * Scene:
 *   • Central 3D film reel (cylinder + 5 perforations + spindle)
 *   • Two orbiting curved ribbons — blue + orange — painted style
 *   • Workflow dot-icons floating on the orbits
 *   • Slow camera dolly + reel spin give the "3D cinematic" feel
 *
 * Timeline (≈3.8 s):
 *   0.0  scene + camera fade in
 *   0.4  reel scales up from 0 with back-ease, ribbons stroke in
 *   1.0  camera begins a gentle orbit around the reel
 *   2.5  everything holds in center, glow pulse
 *   3.0  WebGL canvas fades out, 2D logo tile crossfades in at exact centre
 *   3.3  logo tile FLIPs to the header slot (top-left)
 *   3.8  overlay fades out, Landing revealed
 */

const MIN_DISPLAY_MS = 3800;

export default function SplashIntro({ onDone }) {
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const tileRef = useRef(null);
  const mountedAt = useRef(Date.now());
  const morphStarted = useRef(false);
  // three.js handles
  const rafRef = useRef(0);
  const sceneStateRef = useRef(null);

  const [, forceRender] = useState(0);

  const measureFinalSlot = () => {
    const target = document.querySelector('[data-testid="logo-home-link"] img');
    if (!target) return null;
    const r = target.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  };

  // ---------- Build Three.js scene ----------
  const buildScene = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(0, 0.6, 8);
    camera.lookAt(0, 0, 0);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const key = new THREE.DirectionalLight(0xfff0c0, 1.1);
    key.position.set(3, 4, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x6a14ff, 0.7);
    rim.position.set(-4, -1, -3);
    scene.add(rim);

    // --- Film reel ---
    const reelGroup = new THREE.Group();
    reelGroup.scale.setScalar(0); // animate in

    const reelColor = 0xf0d59b; // warm tan
    const reelEdgeColor = 0x2a1a12;

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(1.25, 1.25, 0.28, 48),
      new THREE.MeshStandardMaterial({
        color: reelColor,
        roughness: 0.55,
        metalness: 0.15,
      }),
    );
    body.rotation.x = Math.PI / 2;
    reelGroup.add(body);

    // rim outline
    const rimOutline = new THREE.Mesh(
      new THREE.TorusGeometry(1.28, 0.045, 16, 80),
      new THREE.MeshStandardMaterial({
        color: reelEdgeColor,
        roughness: 0.8,
      }),
    );
    reelGroup.add(rimOutline);
    const rimOutlineBack = rimOutline.clone();
    rimOutlineBack.position.z = -0.28;
    reelGroup.add(rimOutlineBack);

    // 5 perforations around the face
    const holeMat = new THREE.MeshStandardMaterial({
      color: 0x1a0b08,
      roughness: 0.9,
    });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const hole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.38, 24),
        holeMat,
      );
      hole.rotation.x = Math.PI / 2;
      hole.position.set(Math.cos(a) * 0.7, Math.sin(a) * 0.7, 0);
      reelGroup.add(hole);
    }
    // spindle (center pin)
    const spindle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.42, 24),
      new THREE.MeshStandardMaterial({
        color: 0xffd100,
        emissive: 0x4a3a00,
        roughness: 0.4,
        metalness: 0.5,
      }),
    );
    spindle.rotation.x = Math.PI / 2;
    reelGroup.add(spindle);

    scene.add(reelGroup);

    // --- Two semicircular painted ribbons orbiting ---
    const ribbonGroup = new THREE.Group();
    ribbonGroup.scale.setScalar(0);

    const makeRibbon = (color, rotateZ) => {
      const curve = new THREE.CatmullRomCurve3(
        Array.from({ length: 32 }, (_, i) => {
          const t = i / 31;
          const a = t * Math.PI; // half circle
          return new THREE.Vector3(
            Math.cos(a) * 1.95,
            Math.sin(a) * 1.95,
            Math.sin(t * Math.PI * 2) * 0.15, // gentle wobble for 3D feel
          );
        }),
      );
      const geo = new THREE.TubeGeometry(curve, 64, 0.12, 10, false);
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.6,
        metalness: 0.1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.z = rotateZ;

      // Arrow-head cone at the end of the ribbon
      const head = new THREE.Mesh(
        new THREE.ConeGeometry(0.24, 0.42, 16),
        mat,
      );
      const endT = 0.999;
      const end = curve.getPoint(endT);
      const tangent = curve.getTangent(endT).normalize();
      head.position.copy(end);
      head.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        tangent,
      );
      mesh.add(head);
      return mesh;
    };

    const ribbonBlue = makeRibbon(0x6a14ff, 0);
    const ribbonGold = makeRibbon(0xffd100, Math.PI);
    ribbonGroup.add(ribbonBlue, ribbonGold);
    scene.add(ribbonGroup);

    // --- Glowing sparkle dots to evoke the workflow icons ---
    const sparkleGroup = new THREE.Group();
    const sparkleMat = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
    const sparkleYMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const s = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 12, 12),
        i % 2 === 0 ? sparkleMat : sparkleYMat,
      );
      s.position.set(Math.cos(a) * 2.5, Math.sin(a) * 2.5, 0);
      sparkleGroup.add(s);
    }
    sparkleGroup.scale.setScalar(0);
    scene.add(sparkleGroup);

    // --- Animate in ---
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.to(reelGroup.scale, { x: 1, y: 1, z: 1, duration: 0.9, ease: "back.out(1.6)" }, 0.3)
      .to(ribbonGroup.scale, { x: 1, y: 1, z: 1, duration: 0.8, ease: "back.out(1.4)" }, 0.5)
      .to(sparkleGroup.scale, { x: 1, y: 1, z: 1, duration: 0.6 }, 0.8);

    sceneStateRef.current = {
      renderer,
      scene,
      camera,
      reelGroup,
      ribbonGroup,
      ribbonBlue,
      ribbonGold,
      sparkleGroup,
      tl,
    };

    const clock = new THREE.Clock();
    const loop = () => {
      const t = clock.getElapsedTime();
      // Reel spin
      reelGroup.rotation.z -= 0.02;
      // Ribbons counter-rotate in opposite directions
      ribbonBlue.rotation.z += 0.015;
      ribbonGold.rotation.z -= 0.015;
      // Sparkle twinkle via scale modulation
      sparkleGroup.children.forEach((s, i) => {
        const k = 0.7 + Math.sin(t * 3 + i) * 0.4;
        s.scale.setScalar(k);
      });
      // Slow camera orbit for depth
      const cAngle = Math.min(t, 3) * 0.35;
      camera.position.x = Math.sin(cAngle) * 1.2;
      camera.position.z = 8 - Math.cos(cAngle) * 0.8;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();

    // Handle resize
    const onResize = () => {
      if (!canvas) return;
      const nw = canvas.clientWidth;
      const nh = canvas.clientHeight;
      renderer.setSize(nw, nh, false);
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(rafRef.current);
      tl.kill();
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
          else obj.material.dispose?.();
        }
      });
    };
  };

  const runMorph = () => {
    if (morphStarted.current) return;
    const elapsed = Date.now() - mountedAt.current;
    if (elapsed < MIN_DISPLAY_MS) {
      setTimeout(runMorph, MIN_DISPLAY_MS - elapsed);
      return;
    }
    morphStarted.current = true;

    // Crossfade: canvas → logo tile
    gsap.to(canvasRef.current, { opacity: 0, duration: 0.35, ease: "power2.out" });
    gsap.fromTo(
      tileRef.current,
      { opacity: 0, scale: 0.92 },
      { opacity: 1, scale: 1, duration: 0.35, ease: "power2.out" },
    );

    requestAnimationFrame(() => {
      const target = measureFinalSlot();
      if (!target) {
        gsap.to(rootRef.current, {
          opacity: 0,
          duration: 0.4,
          delay: 0.5,
          onComplete: () => onDone?.(),
        });
        return;
      }
      const box = tileRef.current.getBoundingClientRect();
      const dx = target.x + target.w / 2 - (box.x + box.width / 2);
      const dy = target.y + target.h / 2 - (box.y + box.height / 2);
      const scale = target.w / box.width;
      gsap.to(tileRef.current, {
        x: dx,
        y: dy,
        scale,
        boxShadow: "0 0 0 rgba(255,209,0,0)",
        borderColor: "rgba(255,255,255,0.15)",
        duration: 0.65,
        ease: "power3.inOut",
        delay: 0.25,
      });
      gsap.to(rootRef.current, {
        opacity: 0,
        duration: 0.3,
        delay: 0.85,
        ease: "power1.in",
        onComplete: () => onDone?.(),
      });
    });
  };

  useLayoutEffect(() => {
    gsap.fromTo(
      rootRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.35 },
    );
    const cleanup = buildScene();
    // Kick the morph once the animation timeline is done (or MIN floor)
    const kickoff = setTimeout(runMorph, MIN_DISPLAY_MS);
    forceRender((v) => v + 1); // ensure canvas size is measured
    return () => {
      clearTimeout(kickoff);
      cleanup?.();
    };
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

      {/* Shared stage so canvas ↔ logo tile align pixel-perfect for the crossfade */}
      <div className="relative" style={{ width: 420, height: 420 }}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          data-testid="splash-canvas"
        />
        <div
          ref={tileRef}
          className="absolute rounded-md overflow-hidden flex items-center justify-center"
          style={{
            top: "50%",
            left: "50%",
            width: 220,
            height: 220,
            transform: "translate(-50%, -50%)",
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
