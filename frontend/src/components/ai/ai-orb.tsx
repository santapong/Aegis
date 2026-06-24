"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";

export type OrbState = "idle" | "listening" | "thinking" | "responding";

/**
 * Transmission Orb — a presentational, CSS-variable-driven plasma sphere that
 * signals the advisor's state. Animates transform/opacity only (GPU-friendly).
 * Looping variants are dropped under prefers-reduced-motion; the static
 * data-state color cues still convey state. The orb is decorative — status is
 * conveyed textually elsewhere — so it is aria-hidden.
 */
const orbVariants: Variants = {
  idle: {
    scale: [1, 1.04, 1],
    transition: { duration: 3.2, repeat: Infinity, ease: "easeInOut" },
  },
  listening: {
    scale: 1.08,
    transition: { type: "spring", stiffness: 320, damping: 18 },
  },
  thinking: {
    scale: [1, 1.06, 1],
    transition: { duration: 1.1, repeat: Infinity, ease: "easeInOut" },
  },
  responding: {
    scale: [1.18, 1],
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
};

export function AIOrb({ state, size = 28 }: { state: OrbState; size?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      className="aegis-orb"
      data-state={state}
      aria-hidden
      style={{ width: size, height: size }}
      variants={reduce ? undefined : orbVariants}
      animate={state}
    >
      <span className="aegis-orb-core" />
      <span className="aegis-orb-halo" />
      {!reduce && <span className="aegis-orb-sat" />}
    </motion.span>
  );
}
