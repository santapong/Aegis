// GLSL ES 3.00. See comet.vert.ts for why this is a .ts string export.
export const COMET_FRAG = `#version 300 es
precision highp float;

in vec2 vUV;
uniform sampler2D uTexture;
uniform vec3 uTint;

out vec4 fragColor;

void main() {
  vec4 texel = texture(uTexture, vUV);
  // Texture and context are both premultiplied-alpha, so tint the RGB and
  // let the texture's own radial falloff carry the alpha through untouched.
  fragColor = vec4(texel.rgb * uTint, texel.a);
}
`;
