// Fullscreen triangle generated from gl_VertexID — no vertex buffer required.
export const POSTPROCESS_VERT = `#version 300 es
precision highp float;

out vec2 vUV;

void main() {
  vec2 position = vec2(
    float((gl_VertexID << 1) & 2),
    float(gl_VertexID & 2)
  );
  // The oversized triangle spans 0..2 at its vertices; interpolation across
  // the visible viewport produces the normalized 0..1 sampling range.
  vUV = position;
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}
`;
