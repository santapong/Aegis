// GLSL ES 3.00. String export rather than a .glsl file — see comet.vert.ts.
export const COMET_TAIL_FRAG = `#version 300 es
precision highp float;

in float vU;    // 0 far .. 1 core
in float vSide;  // -1 .. 1 across the ribbon

uniform float uTime;
uniform float uFlowSpeed;
uniform float uIntensity;
uniform float uDebug;

out vec4 fragColor;

void main() {
  // Dev-only UV visualization — u across red/blue, side across green.
  // Toggled from the COMET_DEBUG constant in Tail.ts, never a runtime control.
  if (uDebug > 0.5) {
    fragColor = vec4(vU, (vSide + 1.0) * 0.5, 1.0 - vU, 1.0);
    return;
  }

  // Broad plasma envelope with feathered edges.
  float edge = 1.0 - smoothstep(0.18, 1.0, abs(vSide));
  edge *= edge;

  // Longitudinal fade: dim/thin far from the core, bright and opaque near it.
  float fade = smoothstep(0.0, 0.92, vU);

  // Energy flowing toward the core, modulated rather than a raw scroll so
  // it reads as plasma pulses instead of a looping texture.
  float flowA = sin(vU * 19.0 - uTime * uFlowSpeed * 2.1);
  float flowB = sin(vU * 37.0 - uTime * uFlowSpeed * 3.4 + 1.7);
  float flow = mix(0.58, 1.0, clamp(flowA * 0.34 + flowB * 0.16 + 0.5, 0.0, 1.0));

  // Three narrow, independently moving energy filaments break up the
  // ribbon silhouette without extra geometry or draw calls. Their lateral
  // motion also settles at the core so the attachment stays visually clean.
  float filamentMotion = 1.0 - smoothstep(0.65, 1.0, vU);
  float filamentCenter = sin(vU * 8.0 - uTime * uFlowSpeed * 0.8)
    * 0.16
    * filamentMotion;
  float filamentA = 1.0 - smoothstep(0.025, 0.12, abs(vSide - filamentCenter));
  float filamentB = 1.0 - smoothstep(
    0.035,
    0.16,
    abs(vSide + 0.38 - sin(vU * 13.0 - uTime * uFlowSpeed * 1.3) * 0.08 * filamentMotion)
  );
  float filamentC = 1.0 - smoothstep(
    0.04,
    0.18,
    abs(vSide - 0.43 - sin(vU * 11.0 + uTime * uFlowSpeed) * 0.07 * filamentMotion)
  );
  float filaments = filamentA + (filamentB + filamentC) * 0.42;

  float body = edge * (0.42 + filaments * 0.34);
  float alpha = clamp(body * fade * flow * uIntensity, 0.0, 0.92);

  vec3 white = vec3(1.0, 1.0, 1.0);
  vec3 electricBlue = vec3(0.322, 0.659, 1.0);  // #52A8FF
  vec3 deepBlue = vec3(0.090, 0.231, 0.561);    // #173B8F
  vec3 violet = vec3(0.478, 0.424, 1.0);        // #7A6CFF

  vec3 color = mix(deepBlue, electricBlue, smoothstep(0.0, 0.6, vU));
  color = mix(color, white, smoothstep(0.6, 1.0, vU));
  color = mix(color, white, clamp(filaments * 0.16, 0.0, 0.32));

  // A whisper of violet through the mid-tail only — kept subtle per the
  // "very subtle violet" brief, not a visible third band.
  float violetZone = (1.0 - abs(vU - 0.4) * 2.0) * step(0.0, vU) * step(vU, 0.8);
  color = mix(color, violet, clamp(violetZone, 0.0, 1.0) * 0.12);

  fragColor = vec4(color * alpha, alpha);
}
`;
