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

export interface CometFlightPath {
  start: [number, number];
  control1: [number, number];
  control2: [number, number];
  end: [number, number];
  /** Final screen-space heading in radians; positive rises right, negative descends. */
  settledHeading: number;
}

export interface CometFlightConfig {
  /** Seconds from the offscreen start to the settled hero composition. */
  arrivalDuration: number;
  desktop: CometFlightPath;
  compact: CometFlightPath;
  /** Settled position drift in normalized device coordinates. */
  breathingOffset: [number, number];
  /** Fractional scale change around the settled scale. */
  breathingScale: number;
  /** Ambient breathing cycles per second after arrival. */
  breathingSpeed: number;
}

export interface CometConfig {
  flight: CometFlightConfig;
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
  flight: {
    arrivalDuration: 4.8,
    desktop: {
      start: [-0.92, 0.82],
      control1: [-0.62, 0.68],
      control2: [0.18, -0.1],
      end: [0.62, 0.18],
      settledHeading: 0.18,
    },
    compact: {
      start: [-1.04, 0.9],
      control1: [-0.72, 0.66],
      control2: [0.18, -0.12],
      end: [0.64, 0.22],
      settledHeading: 0.12,
    },
    breathingOffset: [0.008, 0.006],
    breathingScale: 0.015,
    breathingSpeed: 0.11,
  },
  scale: [0.24, 0.19],
  // Electric blue / cyan / white, per the landing page's visual identity.
  tint: [0.55, 0.85, 1.0],
  dprCap: 1.5,
  tail: {
    length: 3.05,
    width: 0.18,
    flowSpeed: 0.72,
    distortion: 0.052,
    distortionFrequency: 1.0,
    intensity: 0.64,
    curvature: 0.82,
  },
  strands: {
    count: 9,
    mobileCount: 5,
    reducedMotionCount: 4,
    width: 0.0045,
    spread: 0.34,
    flowSpeed: 0.48,
    intensity: 0.82,
  },
  particles: {
    count: 280,
    mobileCount: 96,
    reducedMotionCount: 48,
    flowSpeed: 0.09,
    spread: 1.72,
    turbulence: 0.044,
    size: [0.9, 3.2],
    intensity: 0.76,
  },
  bloom: {
    enabled: true,
    threshold: 0.72,
    softKnee: 0.18,
    strength: 0.5,
    mobileStrength: 0.34,
    radius: 6,
    resolutionScale: 0.5,
    mobileResolutionScale: 0.33,
  },
  parallax: {
    enabled: true,
    maxOffset: [0.025, 0.018],
    smoothing: 8,
  },
};
