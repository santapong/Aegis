export const BLOOM_COMPOSITE_FRAG = `#version 300 es
precision highp float;

in vec2 vUV;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uStrength;
out vec4 fragColor;

void main() {
  vec4 scene = texture(uScene, vUV);
  vec4 bloom = texture(uBloom, vUV) * uStrength;
  bloom = min(bloom, vec4(1.0));

  // Place glow behind the sharp source using premultiplied source-over.
  // This guarantees rgb <= alpha for valid transparent-canvas compositing.
  vec3 rgb = scene.rgb + bloom.rgb * (1.0 - scene.a);
  float alpha = scene.a + bloom.a * (1.0 - scene.a);
  fragColor = vec4(min(rgb, vec3(alpha)), alpha);
}
`;
