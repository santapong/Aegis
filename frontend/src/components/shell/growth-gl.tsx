"use client";

import { useEffect, useRef } from "react";

// Raw-WebGL rising-ember particle field, shared by the landing hero and the
// auth pages. Replaces the terrain-grid (Meridian) and orbit-ring (Pulse)
// concepts with something warmer and organic: motes drift upward from the
// bottom of the frame on a gentle sine sway, like embers or light rising off
// still water, brightening from umber to pale gold as they climb, then loop.
// Time-driven with pointer parallax; renders one static frame under
// prefers-reduced-motion. No dependencies.

const COUNT = 900;

const VERT = `
attribute vec3 aSeed;           // x offset, phase, jitter
uniform float uTime;
uniform vec2 uPointer;
uniform float uAspect;
varying float vY;
varying float vDepth;

void main() {
  float speed = mix(0.045, 0.11, aSeed.z);
  float y = fract(aSeed.y + uTime * speed);
  float sway = sin(y * 6.283185 * 2.2 + aSeed.x * 9.0) * mix(0.05, 0.22, fract(aSeed.z * 3.7));

  vec3 pos;
  pos.x = aSeed.x * 1.7 + sway;
  pos.y = mix(-1.15, 1.25, y);
  pos.z = mix(1.4, 3.2, fract(aSeed.z * 5.3));

  float ry = uPointer.x * 0.10;
  float cy = cos(ry), sy = sin(ry);
  pos.xz = mat2(cy, -sy, sy, cy) * pos.xz;
  pos.y -= uPointer.y * 0.04;

  vY = y;
  vDepth = pos.z;
  gl_Position = vec4(pos.x / uAspect, pos.y, pos.z * 0.2, pos.z);
  gl_PointSize = mix(5.5, 1.5, clamp((pos.z - 1.2) / 2.2, 0.0, 1.0));
}
`;

const FRAG = `
precision mediump float;
varying float vY;
varying float vDepth;

void main() {
  vec2 d = gl_PointCoord - 0.5;
  float alpha = smoothstep(0.5, 0.05, length(d));

  vec3 umber = vec3(0.35, 0.19, 0.09);
  vec3 amber = vec3(0.91, 0.569, 0.235);
  vec3 gold = vec3(0.98, 0.87, 0.62);
  vec3 color = mix(umber, amber, smoothstep(0.0, 0.55, vY));
  color = mix(color, gold, smoothstep(0.55, 1.0, vY));

  float spawnFade = smoothstep(0.0, 0.12, vY);
  float topFade = 1.0 - smoothstep(0.82, 1.0, vY);
  float depthFade = clamp(1.7 - vDepth * 0.42, 0.15, 1.0);

  gl_FragColor = vec4(color, alpha * spawnFade * topFade * depthFade * 0.75);
}
`;

export function GrowthGL({ className }: { className?: string }) {
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
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    // Deterministic pseudo-random jitter — no Math.random needed.
    const seeds = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const j1 = (Math.sin(i * 12.9898) * 0.5 + 0.5) % 1;
      const j2 = (Math.sin(i * 78.233) * 0.5 + 0.5) % 1;
      const j3 = (Math.sin(i * 39.346) * 0.5 + 0.5) % 1;
      seeds[i * 3] = j1 * 2 - 1; // horizontal spread
      seeds[i * 3 + 1] = j2; // phase offset, staggers the loop
      seeds[i * 3 + 2] = j3; // speed/size/depth jitter
    }
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
    const aSeed = gl.getAttribLocation(prog, "aSeed");
    gl.enableVertexAttribArray(aSeed);
    gl.vertexAttribPointer(aSeed, 3, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, "uTime");
    const uPointer = gl.getUniformLocation(prog, "uPointer");
    const uAspect = gl.getUniformLocation(prog, "uAspect");

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive: motes glow where they cross

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
      gl.drawArrays(gl.POINTS, 0, COUNT);
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
