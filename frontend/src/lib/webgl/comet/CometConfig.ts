export interface CometTailConfig {
  /** Tail length, in the same clip-space-ish units as comet position. */
  length: number;
  /** Base half-width at the point nearest the core. */
  width: number;
  /** Speed of the internal flowing-energy effect (independent of core travel speed). */
  flowSpeed: number;
  /** Amplitude of the procedural centerline distortion. */
  distortion: number;
  /** Frequency multiplier for the two-octave distortion (see comet-tail.vert). */
  distortionFrequency: number;
  /** Overall tail brightness/opacity multiplier. */
  intensity: number;
  /** How strongly the tail bends away from a straight line. */
  curvature: number;
}

export interface CometParticleConfig {
  /** Maximum particles rendered on desktop. */
  count: number;
  /** Active particles on narrow portrait/mobile viewports. */
  mobileCount: number;
  /** Dim, static particles kept when reduced motion is requested. */
  reducedMotionCount: number;
  /** Longitudinal travel through the tail, in normalized UV units per second. */
  flowSpeed: number;
  /** Multiplier for lateral distribution around the tail envelope. */
  spread: number;
  /** Strength of independent lateral particle drift. */
  turbulence: number;
  /** Point-sprite size range in CSS pixels. */
  size: [number, number];
  /** Overall particle brightness/opacity multiplier. */
  intensity: number;
}

export interface CometStrandConfig {
  /** Maximum instanced energy strands rendered on desktop. */
  count: number;
  /** Active strands on compact/portrait viewports. */
  mobileCount: number;
  /** Static strands retained for the reduced-motion composition. */
  reducedMotionCount: number;
  /** Strand half-width in height-relative clip-space units. */
  width: number;
  /** Maximum lateral separation from the main plasma envelope. */
  spread: number;
  /** Independent energy-flow speed. */
  flowSpeed: number;
  /** Overall strand brightness/opacity multiplier. */
  intensity: number;
}

export interface CometBloomConfig {
  enabled: boolean;
  /** Premultiplied luminance above which pixels contribute to the glow. */
  threshold: number;
  /** Smooth transition width around the threshold. */
  softKnee: number;
  /** Desktop bloom contribution during final compositing. */
  strength: number;
  /** Mobile/portrait bloom contribution. */
  mobileStrength: number;
  /** Blur sample offset in reduced-resolution pixels. */
  radius: number;
  /** Desktop bloom-buffer scale relative to the canvas. */
  resolutionScale: number;
  /** Mobile/portrait bloom-buffer scale relative to the canvas. */
  mobileResolutionScale: number;
}

export interface CometParallaxConfig {
  enabled: boolean;
  /** Maximum connected-system drift in normalized device coordinates. */
  maxOffset: [number, number];
  /** Exponential response rate; larger values settle faster. */
  smoothing: number;
}

export interface CometConfig {
  /** Seconds for one full left-to-right traversal and loop. */
  loopDuration: number;
  /** Quad half-size, in the same clip-space-ish units as position. */
  scale: [number, number];
  /** RGB tint multiplied over the glow texture, 0..1. */
  tint: [number, number, number];
  /** Device pixel ratio cap — avoids rendering an unnecessarily large framebuffer. */
  dprCap: number;
  tail: CometTailConfig;
  strands: CometStrandConfig;
  particles: CometParticleConfig;
  bloom: CometBloomConfig;
  parallax: CometParallaxConfig;
}

export const DEFAULT_COMET_CONFIG: CometConfig = {
  loopDuration: 14,
  scale: [0.5, 0.28],
  // Electric blue / cyan / white, per the landing page's visual identity.
  tint: [0.55, 0.85, 1.0],
  dprCap: 1.5,
  tail: {
    length: 2.2,
    width: 0.14,
    flowSpeed: 0.85,
    distortion: 0.045,
    distortionFrequency: 1.0,
    intensity: 0.72,
    curvature: 0.12,
  },
  strands: {
    count: 5,
    mobileCount: 3,
    reducedMotionCount: 2,
    width: 0.008,
    spread: 0.24,
    flowSpeed: 0.55,
    intensity: 0.72,
  },
  particles: {
    count: 160,
    mobileCount: 64,
    reducedMotionCount: 32,
    flowSpeed: 0.12,
    spread: 1.45,
    turbulence: 0.035,
    size: [1.2, 3.8],
    intensity: 0.68,
  },
  bloom: {
    enabled: true,
    threshold: 0.72,
    softKnee: 0.18,
    strength: 0.42,
    mobileStrength: 0.3,
    radius: 5,
    resolutionScale: 0.5,
    mobileResolutionScale: 0.33,
  },
  parallax: {
    enabled: true,
    maxOffset: [0.025, 0.018],
    smoothing: 8,
  },
};
