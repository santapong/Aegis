// GLSL ES 3.00. Hairline energy strands with depth-dependent color and flow.
export const COMET_STRANDS_FRAG = `#version 300 es
precision highp float;

in float vU;
in float vSide;
in float vDepth;
in float vPhase;

uniform float uTime;
uniform float uFlowSpeed;
uniform float uIntensity;

out vec4 fragColor;

void main() {
  float edge = 1.0 - smoothstep(0.12, 1.0, abs(vSide));
  float endpoint = smoothstep(0.0, 0.1, vU);
  float pulse = 0.68 + 0.32 * sin(
    vU * mix(18.0, 30.0, vDepth)
      - uTime * uFlowSpeed * mix(1.4, 2.3, vDepth)
      + vPhase
  );
  float depthAlpha = mix(0.28, 0.86, vDepth);
  float alpha = edge * endpoint * pulse * depthAlpha * uIntensity;

  if (alpha < 0.003) discard;

  vec3 deepBlue = vec3(0.07, 0.18, 0.48);
  vec3 electricBlue = vec3(0.22, 0.62, 1.0);
  vec3 cyan = vec3(0.38, 0.88, 1.0);
  vec3 violet = vec3(0.45, 0.38, 0.95);
  vec3 color = mix(deepBlue, electricBlue, vDepth);
  color = mix(color, cyan, smoothstep(0.72, 1.0, vDepth) * vU);
  color = mix(color, violet, (1.0 - vDepth) * 0.12);

  fragColor = vec4(color * alpha, alpha);
}
`;
