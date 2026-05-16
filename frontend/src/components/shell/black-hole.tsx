"use client";

import { useEffect, useState } from "react";

/**
 * BlackHole — pure-SVG showpiece for the Supernova theme. Two counter-
 * rotating accretion disks (42s + 24s), a photon ring + soft halo, a pure
 * black singularity, and an outer warm radial glow. All motion is SVG-
 * native via <animateTransform> — no JS frame loop.
 *
 * Positioned by `.bd-blackhole` in globals.css (top-right of the viewport,
 * mix-blend-mode: screen). Only mounted when theme === 'supernova'.
 *
 * Respects `prefers-reduced-motion`: when set, the disks render in a fixed
 * orientation and the <animateTransform> elements are omitted entirely
 * (SVG SMIL cannot be paused via CSS, so the component subscribes to
 * matchMedia and conditionally renders the animation children).
 */
export function BlackHole() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  return (
    <div className="bd-blackhole" aria-hidden>
      <svg viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Outer warm radial glow */}
          <radialGradient id="bh-outer" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(232, 168, 92, 0.45)" />
            <stop offset="32%" stopColor="rgba(196, 110, 86, 0.22)" />
            <stop offset="68%" stopColor="rgba(120, 50, 90, 0.08)" />
            <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
          </radialGradient>

          {/* Accretion disk fill — flat ellipse base */}
          <radialGradient id="bh-disk" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255, 235, 200, 0.00)" />
            <stop offset="20%" stopColor="rgba(255, 220, 170, 0.65)" />
            <stop offset="50%" stopColor="rgba(232, 168, 92, 0.90)" />
            <stop offset="78%" stopColor="rgba(180, 80, 120, 0.50)" />
            <stop offset="100%" stopColor="rgba(80, 30, 70, 0.00)" />
          </radialGradient>

          {/* Doppler overlay — one side blue-tinted, one side red-tinted */}
          <linearGradient id="bh-doppler" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="rgba(120, 180, 255, 0.55)" />
            <stop offset="50%" stopColor="rgba(255, 255, 255, 0.00)" />
            <stop offset="100%" stopColor="rgba(255, 110, 130, 0.55)" />
          </linearGradient>

          {/* Photon ring blur */}
          <filter id="bh-photon-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" />
          </filter>
          <filter id="bh-photon-halo" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
        </defs>

        {/* Layer 1 — outer warm glow */}
        <circle cx="300" cy="300" r="280" fill="url(#bh-outer)" />

        {/* Layer 2 — outer accretion disk (42s rotation) */}
        <g transform="translate(300 300)">
          <g>
            <ellipse rx="250" ry="72" fill="url(#bh-disk)" />
            <ellipse rx="250" ry="72" fill="url(#bh-doppler)" opacity="0.55" />
            {!reduceMotion && (
              <animateTransform
                attributeName="transform"
                attributeType="XML"
                type="rotate"
                from="0"
                to="360"
                dur="42s"
                repeatCount="indefinite"
              />
            )}
          </g>
        </g>

        {/* Layer 3 — inner accretion disk (24s counter-rotation, hotter) */}
        <g transform="translate(300 300)">
          <g>
            <ellipse rx="160" ry="38" fill="url(#bh-disk)" opacity="0.9" />
            <ellipse rx="160" ry="38" fill="url(#bh-doppler)" opacity="0.55" />
            {!reduceMotion && (
              <animateTransform
                attributeName="transform"
                attributeType="XML"
                type="rotate"
                from="360"
                to="0"
                dur="24s"
                repeatCount="indefinite"
              />
            )}
          </g>
        </g>

        {/* Layer 4 — photon ring (soft halo + thin bright ring) */}
        <circle
          cx="300" cy="300" r="100"
          fill="none"
          stroke="rgba(255, 215, 170, 0.55)"
          strokeWidth="7"
          filter="url(#bh-photon-halo)"
        />
        <circle
          cx="300" cy="300" r="96"
          fill="none"
          stroke="rgba(255, 240, 220, 0.85)"
          strokeWidth="2"
          filter="url(#bh-photon-blur)"
        />

        {/* Layer 5 — singularity */}
        <circle cx="300" cy="300" r="86" fill="#000000" />

        {/* Layer 6 — thin warm inner halo */}
        <circle
          cx="300" cy="300" r="88"
          fill="none"
          stroke="rgba(255, 210, 160, 0.4)"
          strokeWidth="0.8"
        />
      </svg>
    </div>
  );
}
