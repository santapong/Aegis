// GLSL ES 3.00. String export rather than a .glsl file — see comet.vert.ts.
export const COMET_TAIL_VERT = `#version 300 es
precision highp float;

// x = u: 0 at the far end of the tail, 1 at the core.
// y = side: -1 or 1, which edge of the ribbon this vertex is on.
in vec2 aUV;

uniform vec2 uCorePos;
uniform float uAspect;
uniform float uTailLength;
uniform float uTailWidth;
uniform float uCurvature;
uniform float uTime;
uniform float uFlowSpeed;
uniform float uDistortion;
uniform float uDistortionFreq;

out float vU;
out float vSide;

// Thin at the far end, widest right at the core — smooth and continuous
// since u is an exact per-vertex value, not a stepped texture lookup.
float tailWidth(float u) {
  return mix(0.05, 1.0, smoothstep(0.0, 1.0, u)) * uTailWidth;
}

// Bend increases toward the far end, so the tail sweeps rather than
// running perfectly straight from the core.
float tailCurve(float u) {
  float t = 1.0 - u;
  return t * t * uCurvature;
}

void main() {
  float u = aUV.x;

  // Local space: the core sits at local (0,0); the tail trails behind it
  // (toward -x) as the comet travels left-to-right.
  float localX = -uTailLength * (1.0 - u);

  float w = tailWidth(u);
  float curve = tailCurve(u);

  // Two-octave sine approximation of flowing plasma: a slow broad sweep
  // plus a faster ripple on top, so it doesn't read as a single sine wave.
  float largeWave = sin(u * 3.0 * uDistortionFreq + uTime * uFlowSpeed * 0.6);
  float smallWave = sin(u * 9.0 * uDistortionFreq - uTime * uFlowSpeed * 1.7);
  // Pin the distortion at both endpoints. In particular, u=1 must remain
  // attached to the core instead of orbiting around it as the waves move.
  float distortionEnvelope = sin(u * 3.14159265);
  float distort = (largeWave * 0.7 + smallWave * 0.3)
    * uDistortion
    * distortionEnvelope;

  float localY = aUV.y * w + curve + distort;

  vec2 local = vec2(localX / uAspect, localY);
  gl_Position = vec4(uCorePos + local, 0.0, 1.0);

  vU = u;
  vSide = aUV.y;
}
`;
