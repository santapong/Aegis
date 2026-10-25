export const BLOOM_EXTRACT_FRAG = `#version 300 es
precision highp float;

in vec2 vUV;
uniform sampler2D uTexture;
uniform float uThreshold;
uniform float uSoftKnee;
out vec4 fragColor;

void main() {
  vec4 source = texture(uTexture, vUV);
  float brightness = max(max(source.r, source.g), source.b);
  float knee = max(uSoftKnee, 0.0001);
  float soft = clamp((brightness - uThreshold + knee) / (2.0 * knee), 0.0, 1.0);
  soft = soft * soft * knee;
  float contribution = max(brightness - uThreshold, soft) / max(brightness, 0.0001);
  fragColor = source * clamp(contribution, 0.0, 1.0);
}
`;
