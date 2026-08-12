// GLSL ES 3.00. Procedural soft point sprites; no particle texture required.
export const COMET_PARTICLES_FRAG = `#version 300 es
precision highp float;

in float vAlpha;
in float vBrightness;
in float vU;

out vec4 fragColor;

void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float radius = length(p);
  float halo = 1.0 - smoothstep(0.12, 1.0, radius);
  float core = 1.0 - smoothstep(0.0, 0.28, radius);
  float shape = halo * 0.58 + core * 0.42;
  float alpha = shape * vAlpha;

  if (alpha < 0.003) discard;

  vec3 deepBlue = vec3(0.090, 0.231, 0.561);
  vec3 electricBlue = vec3(0.322, 0.659, 1.0);
  vec3 white = vec3(1.0);
  vec3 color = mix(deepBlue, electricBlue, smoothstep(0.05, 0.72, vU));
  color = mix(color, white, smoothstep(0.78, 1.0, vBrightness));

  // Premultiplied output matches the scene's ONE / ONE_MINUS_SRC_ALPHA blend.
  fragColor = vec4(color * alpha, alpha);
}
`;
