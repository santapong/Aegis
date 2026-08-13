// GLSL ES 3.00. See comet.vert.ts for why this is a .ts string export.
export const COMET_FRAG = `#version 300 es
precision highp float;

in vec2 vUV;
uniform sampler2D uTexture;
uniform vec3 uTint;
uniform float uTime;
uniform float uMotionScale;

out vec4 fragColor;

float ellipseRing(vec2 point, float angle, vec2 stretch, float radius, float width) {
  float c = cos(angle);
  float s = sin(angle);
  vec2 rotated = mat2(c, -s, s, c) * point;
  float distanceToRing = abs(length(rotated * stretch) - radius);
  return 1.0 - smoothstep(width * 0.35, width, distanceToRing);
}

void main() {
  vec2 p = vUV * 2.0 - 1.0;
  vec4 texel = texture(uTexture, vUV);

  // The reference's brightest point sits on the forward edge of its orbital
  // loops, not in the middle of a large disc. Offset and shrink the sphere so
  // the head reads as a compact star carried by a larger energy structure.
  vec2 spherePoint = p - vec2(0.3, 0.0);
  const float sphereRadius = 0.2;
  vec2 sphereXY = spherePoint / sphereRadius;
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
  float orbitMotion = sin(uTime * 0.16 * uMotionScale) * 0.08;
  float orbitA = ellipseRing(p, -0.3 + orbitMotion, vec2(0.8, 1.5), 0.58, 0.05);
  float orbitB = ellipseRing(p + vec2(0.06, -0.02), 0.48 - orbitMotion * 0.7, vec2(0.95, 1.65), 0.67, 0.035);
  float orbitC = ellipseRing(p - vec2(0.04, 0.02), -0.75 + orbitMotion * 0.45, vec2(1.35, 0.86), 0.74, 0.026);
  float orbitOcclusion = mix(0.34, 1.0, smoothstep(-0.3, 0.42, p.y));
  float orbitAlpha = clamp(
    (orbitA * 0.7 + orbitB * 0.42 + orbitC * 0.24) * orbitOcclusion,
    0.0,
    0.96
  );

  // A short forward flare makes the head directional rather than a flat disc.
  float horizontalFlare = exp(-abs(spherePoint.y) * 76.0)
    * (1.0 - smoothstep(0.05, 0.86, abs(spherePoint.x)));
  float verticalFlare = exp(-abs(spherePoint.x) * 82.0)
    * (1.0 - smoothstep(0.04, 0.64, abs(spherePoint.y)));
  float flareAlpha = clamp(horizontalFlare * 0.52 + verticalFlare * 0.25, 0.0, 0.9);

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
