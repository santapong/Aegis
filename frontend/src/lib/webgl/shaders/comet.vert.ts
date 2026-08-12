// GLSL ES 3.00. Kept as a TS string export rather than a .glsl file — Next.js
// has no raw-loader configured for arbitrary extensions, and adding webpack
// config for a two-file shader pair isn't worth the dependency.
export const COMET_VERT = `#version 300 es
precision highp float;

in vec2 aPosition; // unit quad corner, -0.5..0.5
in vec2 aUV;

uniform vec2 uPos;     // comet center
uniform vec2 uScale;   // quad half-size
uniform float uRotation;
uniform float uAspect; // viewport width / height

out vec2 vUV;

void main() {
  float c = cos(uRotation);
  float s = sin(uRotation);
  mat2 rot = mat2(c, -s, s, c);
  vec2 world = uPos + (rot * aPosition) * uScale;

  // Divide x by aspect so the quad isn't stretched on non-square viewports.
  gl_Position = vec4(world.x / uAspect, world.y, 0.0, 1.0);
  vUV = aUV;
}
`;
