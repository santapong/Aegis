// GLSL ES 3.00. Every particle position is derived analytically from seeds.
export const COMET_PARTICLES_VERT = `#version 300 es
precision highp float;

// base longitudinal phase, lateral offset, size mix, turbulence phase
in vec4 aSeed;
// brightness, per-particle flow-speed mix
in vec2 aStyle;

uniform vec2 uCorePos;
uniform float uAspect;
uniform float uRotation;
uniform float uTime;
uniform float uTailLength;
uniform float uTailWidth;
uniform float uCurvature;
uniform float uDistortion;
uniform float uDistortionFreq;
uniform float uFlowSpeed;
uniform float uSpread;
uniform float uTurbulence;
uniform vec2 uPointSize;
uniform float uPixelRatio;
uniform float uIntensity;

out float vAlpha;
out float vBrightness;
out float vU;
out float vDepth;

float tailCurve(float u) {
  float t = 1.0 - u;
  return t * (t - 0.46) * 2.0 * uCurvature;
}

void main() {
  float particleSpeed = mix(0.82, 1.18, aStyle.y);
  float u = fract(aSeed.x + uTime * uFlowSpeed * particleSpeed);
  float localX = -uTailLength * (1.0 - u);

  float widthEnvelope = pow(max(0.0, sin(u * 3.14159265)), 0.72);
  float width = mix(0.055, 1.0, widthEnvelope) * uTailWidth;
  float largeWave = sin(u * 3.0 * uDistortionFreq + uTime * 0.51);
  float smallWave = sin(u * 9.0 * uDistortionFreq - uTime * 1.37);
  float distortionEnvelope = sin(u * 3.14159265);
  float centerDistortion = (largeWave * 0.7 + smallWave * 0.3)
    * uDistortion
    * distortionEnvelope;

  float drift = (
    sin(u * 17.0 + aSeed.w + uTime * 1.1)
    + sin(u * 31.0 - aSeed.w * 0.7 - uTime * 1.9) * 0.45
  ) * uTurbulence * distortionEnvelope;

  float depth = aSeed.z;
  float depthSpread = mix(0.72, 1.28, depth);
  float localY = tailCurve(u)
    + centerDistortion
    + aSeed.y * width * uSpread * depthSpread
    + drift;

  float c = cos(uRotation);
  float s = sin(uRotation);
  vec2 rotated = mat2(c, s, -s, c) * vec2(localX, localY);
  gl_Position = vec4(
    uCorePos + vec2(rotated.x / uAspect, rotated.y),
    0.0,
    1.0
  );

  float lifecycle = smoothstep(0.0, 0.08, u) * (1.0 - smoothstep(0.94, 1.0, u));
  float density = smoothstep(0.02, 0.42, u);
  vAlpha = lifecycle
    * density
    * aStyle.x
    * mix(0.3, 1.0, depth)
    * uIntensity;
  vBrightness = aStyle.x;
  vU = u;
  vDepth = depth;

  float perspectiveSize = mix(0.55, 1.2, depth)
    * mix(0.72, 1.0, smoothstep(0.15, 0.9, u));
  gl_PointSize = mix(uPointSize.x, uPointSize.y, aSeed.z)
    * perspectiveSize
    * uPixelRatio;
}
`;
