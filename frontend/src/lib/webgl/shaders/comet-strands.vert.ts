// GLSL ES 3.00. One lightweight ribbon is instanced into depth-separated
// energy strands; no per-frame geometry uploads are required.
export const COMET_STRANDS_VERT = `#version 300 es
precision highp float;

// x = longitudinal u (0 far tail, 1 core), y = ribbon side (-1 or 1).
in vec2 aUV;

uniform vec2 uCorePos;
uniform float uAspect;
uniform float uTailLength;
uniform float uCurvature;
uniform float uTime;
uniform float uFlowSpeed;
uniform float uWidth;
uniform float uSpread;

out float vU;
out float vSide;
out float vDepth;
out float vPhase;

float hash11(float value) {
  return fract(sin(value * 127.1) * 43758.5453123);
}

void main() {
  float u = aUV.x;
  float id = float(gl_InstanceID);
  float phase = hash11(id + 0.37) * 6.2831853;
  float depth = hash11(id + 5.71);
  float direction = mix(-1.0, 1.0, step(0.5, hash11(id + 2.13)));
  float envelope = sin(u * 3.14159265);
  float far = 1.0 - u;

  // Each instance follows the comet but uses a different sweep, phase, and
  // apparent depth. All offsets are pinned at the head for a clean attachment.
  float broadArc = direction
    * envelope
    * uSpread
    * mix(0.36, 1.0, hash11(id + 8.19));
  float crossingArc = sin(u * 5.2 + phase)
    * envelope
    * uSpread
    * mix(0.08, 0.24, depth);
  float slowFlow = sin(
    u * mix(5.0, 9.0, depth)
      - uTime * uFlowSpeed * mix(0.45, 0.9, depth)
      + phase
  ) * envelope * 0.018;

  float localX = -uTailLength * far * mix(0.9, 1.08, depth);
  float localY = far * far * uCurvature
    + broadArc
    + crossingArc
    + slowFlow;
  float strandWidth = uWidth * mix(0.72, 1.18, depth);
  localY += aUV.y * strandWidth;

  gl_Position = vec4(
    uCorePos + vec2(localX / uAspect, localY),
    mix(0.25, -0.25, depth),
    1.0
  );

  vU = u;
  vSide = aUV.y;
  vDepth = depth;
  vPhase = phase;
}
`;
