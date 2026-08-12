export interface CometConfig {
  /** Seconds for one full left-to-right traversal and loop. */
  loopDuration: number;
  /** Quad half-size, in the same clip-space-ish units as position. */
  scale: [number, number];
  /** RGB tint multiplied over the glow texture, 0..1. */
  tint: [number, number, number];
  /** Device pixel ratio cap — avoids rendering an unnecessarily large framebuffer. */
  dprCap: number;
}

export const DEFAULT_COMET_CONFIG: CometConfig = {
  loopDuration: 14,
  scale: [0.5, 0.28],
  // Electric blue / cyan / white, per the landing page's visual identity.
  tint: [0.55, 0.85, 1.0],
  dprCap: 1.5,
};
