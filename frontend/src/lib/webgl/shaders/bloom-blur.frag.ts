export const BLOOM_BLUR_FRAG = `#version 300 es
precision highp float;

in vec2 vUV;
uniform sampler2D uTexture;
uniform vec2 uTexelSize;
uniform vec2 uDirection;
uniform float uRadius;
out vec4 fragColor;

void main() {
  vec2 stepUV = uTexelSize * uDirection * uRadius;
  vec4 color = texture(uTexture, vUV) * 0.227027;
  color += texture(uTexture, vUV + stepUV * 1.384615) * 0.316216;
  color += texture(uTexture, vUV - stepUV * 1.384615) * 0.316216;
  color += texture(uTexture, vUV + stepUV * 3.230769) * 0.070270;
  color += texture(uTexture, vUV - stepUV * 3.230769) * 0.070270;
  fragColor = color;
}
`;
