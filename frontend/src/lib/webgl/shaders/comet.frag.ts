// GLSL ES 3.00. See comet.vert.ts for why this is a .ts string export.
export const COMET_FRAG = `#version 300 es
precision highp float;

in vec2 vUV;
uniform sampler2D uTexture;
uniform vec3 uTint;
uniform float uTime;
uniform float uMotionScale;

out vec4 fragColor;

void main() {
  vec2 p = vUV * 2.0 - 1.0;
  vec4 texel = texture(uTexture, vUV);

  // The compact head is shaded like a tiny emissive sphere. Its reconstructed
  // normal and off-axis light create volume without introducing a 3D engine.
  const float sphereRadius = 0.34;
  vec2 sphereXY = p / sphereRadius;
  float sphereR2 = dot(sphereXY, sphereXY);
  float sphereMask = 1.0 - smoothstep(0.7, 1.0, sphereR2);
  float sphereZ = sqrt(max(0.0, 1.0 - sphereR2));
  vec3 normal = normalize(vec3(sphereXY, sphereZ));
  float diffuse = max(dot(normal, normalize(vec3(-0.35, 0.48, 0.8))), 0.0);
  float rim = pow(1.0 - sphereZ, 2.2) * sphereMask;
  float hotCore = exp(-sphereR2 * 5.5);
  float sphereAlpha = sphereMask * (0.48 + diffuse * 0.42 + hotCore * 0.55);
  vec3 sphereColor = mix(uTint * 0.72, vec3(1.0), diffuse * 0.65 + hotCore * 0.5);

  // A slowly precessing elliptical orbit supplies the strongest reference-art
  // depth cue. Reduced motion freezes it into an intentional composition.
  float orbitAngle = -0.28 + sin(uTime * 0.16 * uMotionScale) * 0.1;
  float c = cos(orbitAngle);
  float s = sin(orbitAngle);
  vec2 orbitP = mat2(c, -s, s, c) * p;
  vec2 ellipse = vec2(orbitP.x * 0.78, orbitP.y * 1.55);
  float orbitDistance = abs(length(ellipse) - 0.58);
  float orbit = 1.0 - smoothstep(0.018, 0.055, orbitDistance);
  float orbitOcclusion = mix(0.28, 1.0, smoothstep(-0.22, 0.38, orbitP.y));
  float orbitAlpha = orbit * orbitOcclusion * 0.82;

  // A short forward flare makes the head directional rather than a flat disc.
  float flare = exp(-abs(p.y) * 70.0)
    * smoothstep(0.02, 0.18, p.x)
    * (1.0 - smoothstep(0.18, 0.96, p.x));
  float flareAlpha = flare * 0.48;

  float haloAlpha = texel.a * 0.34;
  float alpha = 1.0
    - (1.0 - haloAlpha)
    * (1.0 - min(sphereAlpha, 1.0))
    * (1.0 - orbitAlpha)
    * (1.0 - flareAlpha);
  vec3 premultiplied = texel.rgb * uTint * 0.34
    + sphereColor * sphereAlpha
    + mix(uTint, vec3(1.0), 0.72) * orbitAlpha
    + vec3(0.72, 0.9, 1.0) * flareAlpha;

  fragColor = vec4(min(premultiplied, vec3(alpha)), alpha);
}
`;
