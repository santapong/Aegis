"use client";

import { useEffect, useRef } from "react";

// Raw-WebGL particle rings for the auth pages: three tilted orbits of points
// in the Pulse series colors (fuchsia, teal, violet) drifting on graphite.
// Time-driven with pointer parallax; renders one static frame under
// prefers-reduced-motion. No dependencies.

// Ring colors come from the active theme at mount: accent, accent-alt, ink.
const RINGS = [
  { cssVar: "--accent", fallback: [0.91, 0.569, 0.235], radius: 0.62, tilt: 0.45, speed: 0.14, count: 260 },
  { cssVar: "--accent-2", fallback: [0.18, 0.42, 0.447], radius: 0.86, tilt: -0.32, speed: -0.09, count: 320 },
  { cssVar: "--dim", fallback: [0.62, 0.647, 0.659], radius: 1.08, tilt: 0.18, speed: 0.06, count: 380 },
];

function cssColor(name: string, fallback: number[]): number[] {
  const raw = getComputedStyle(document.body).getPropertyValue(name).trim();
  const m = raw.match(/^#([0-9a-f]{6})$/i);
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const VERT = `
attribute vec3 aSeed;           // angle, ringIndex, jitter
uniform float uTime;
uniform vec2 uPointer;
uniform float uAspect;
uniform vec4 uRing0;            // radius, tilt, speed, count (unused)
uniform vec4 uRing1;
uniform vec4 uRing2;
varying float vRing;
varying float vDepth;

void main() {
  vec4 ring = aSeed.y < 0.5 ? uRing0 : (aSeed.y < 1.5 ? uRing1 : uRing2);
  float a = aSeed.x + uTime * ring.z;
  float r = ring.x + aSeed.z * 0.02;
  vec3 pos = vec3(cos(a) * r * 1.5, sin(a) * r * 0.45, sin(a) * r * 1.2);

  float tilt = ring.y + uPointer.y * 0.08;
  float ct = cos(tilt), st = sin(tilt);
  pos.yz = mat2(ct, -st, st, ct) * pos.yz;
  float ry = uPointer.x * 0.15 + uTime * 0.02;
  float cy = cos(ry), sy = sin(ry);
  pos.xz = mat2(cy, -sy, sy, cy) * pos.xz;

  pos.z += 2.2;
  vRing = aSeed.y;
  vDepth = pos.z;
  gl_Position = vec4(pos.x / uAspect, pos.y, pos.z * 0.25, pos.z);
  gl_PointSize = mix(6.0, 2.0, clamp((pos.z - 1.2) / 2.0, 0.0, 1.0));
}
`;

const FRAG = `
precision mediump float;
uniform vec3 uColor0;
uniform vec3 uColor1;
uniform vec3 uColor2;
varying float vRing;
varying float vDepth;

void main() {
  vec2 d = gl_PointCoord - 0.5;
  float alpha = smoothstep(0.5, 0.1, length(d));
  vec3 color = vRing < 0.5 ? uColor0 : (vRing < 1.5 ? uColor1 : uColor2);
  float fade = clamp(1.7 - vDepth * 0.45, 0.15, 1.0);
  gl_FragColor = vec4(color, alpha * fade * 0.55);
}
`;

export function PulseGL({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const canvas = document.createElement("canvas");
    host.appendChild(canvas);
    const gl = canvas.getContext("webgl", { antialias: true, alpha: true });
    if (!gl) {
      host.removeChild(canvas);
      return;
    }

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const seeds: number[] = [];
    RINGS.forEach((ring, i) => {
      for (let k = 0; k < ring.count; k++) {
        // deterministic jitter — no Math.random needed
        const j = Math.sin(k * 12.9898 + i * 78.233) * 0.5;
        seeds.push((k / ring.count) * Math.PI * 2, i, j);
      }
    });
    const seedArr = new Float32Array(seeds);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, seedArr, gl.STATIC_DRAW);
    const aSeed = gl.getAttribLocation(prog, "aSeed");
    gl.enableVertexAttribArray(aSeed);
    gl.vertexAttribPointer(aSeed, 3, gl.FLOAT, false, 0, 0);

    const u = (name: string) => gl.getUniformLocation(prog, name);
    RINGS.forEach((ring, i) => {
      gl.uniform4f(u(`uRing${i}`), ring.radius, ring.tilt, ring.speed, ring.count);
      const c = cssColor(ring.cssVar, ring.fallback);
      gl.uniform3f(u(`uColor${i}`), c[0], c[1], c[2]);
    });
    const uTime = u("uTime");
    const uPointer = u("uPointer");
    const uAspect = u("uAspect");

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive: points glow where orbits cross

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let pointer = { x: 0, y: 0 };
    let raf = 0;
    const start = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = host.clientWidth * dpr;
      canvas.height = host.clientHeight * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();

    const draw = () => {
      const t = reduced ? 0 : (performance.now() - start) / 1000;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uTime, t);
      gl.uniform2f(uPointer, pointer.x, pointer.y);
      gl.uniform1f(uAspect, canvas.width / Math.max(canvas.height, 1));
      gl.drawArrays(gl.POINTS, 0, seedArr.length / 3);
      if (!reduced) raf = requestAnimationFrame(draw);
    };

    const onPointer = (e: PointerEvent) => {
      pointer = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      };
    };
    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) draw();
    });
    ro.observe(host);
    window.addEventListener("resize", resize);
    if (!reduced) window.addEventListener("pointermove", onPointer);
    draw();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      host.removeChild(canvas);
    };
  }, []);

  return <div ref={hostRef} className={className} aria-hidden="true" />;
}
