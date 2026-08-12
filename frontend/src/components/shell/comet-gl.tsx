"use client";

import { useEffect, useRef } from "react";

// Raw-WebGL comet field, shared by the landing hero and the auth pages.
// A handful of comets — bright head, fading tail — arc across the void on
// looping parabolic paths. Each comet's tail cools toward either the
// redshift or blueshift accent (alternating), echoing the outflow/inflow
// color language used elsewhere in the product. Time-driven with pointer
// parallax; renders one static frame under prefers-reduced-motion. No
// dependencies.

const COMETS = 7;
const TAIL = 34;
const COUNT = COMETS * TAIL;

const VERT = `
attribute vec3 aSeed;           // cometId, tailIndex, jitter
uniform float uTime;
uniform vec2 uPointer;
uniform float uAspect;
varying float vTailFrac;
varying float vCharge;
varying float vAlpha;

void main() {
  float cometId = aSeed.x;
  float speed = mix(0.05, 0.095, fract(cometId * 0.371));
  float phase = fract(cometId * 0.617);
  float laneY = mix(-0.65, 0.65, fract(cometId * 0.293));
  float arcH = mix(0.18, 0.5, fract(cometId * 0.831));
  float charge = mod(cometId, 2.0);

  float tailFrac = aSeed.y / float(${TAIL - 1});
  float progress = fract(uTime * speed + phase - aSeed.y * 0.008);

  float x = mix(-1.65, 1.65, progress);
  float arc = sin(progress * 3.14159265) * arcH;
  float y = laneY + arc;
  float z = mix(1.5, 3.1, fract(cometId * 0.531));

  float ry = uPointer.x * 0.08;
  float cy = cos(ry), sy = sin(ry);
  vec2 xz = mat2(cy, -sy, sy, cy) * vec2(x, z - 2.2);
  x = xz.x;
  z = xz.y + 2.2;
  y -= uPointer.y * 0.03;

  float edgeFade = smoothstep(0.0, 0.06, progress) * smoothstep(1.0, 0.94, progress);
  vTailFrac = tailFrac;
  vCharge = charge;
  vAlpha = edgeFade;

  gl_Position = vec4(x / uAspect, y, z * 0.2, z);
  gl_PointSize = mix(6.5, 1.8, tailFrac) * mix(1.0, 0.5, clamp((z - 1.5) / 1.8, 0.0, 1.0));
}
`;

const FRAG = `
precision mediump float;
varying float vTailFrac;
varying float vCharge;
varying float vAlpha;

void main() {
  vec2 d = gl_PointCoord - 0.5;
  float dot = smoothstep(0.5, 0.05, length(d));

  vec3 head = vec3(1.0, 0.95, 0.85);
  vec3 redshift = vec3(0.97, 0.4, 0.26);
  vec3 blueshift = vec3(0.28, 0.78, 0.98);
  vec3 tailColor = mix(blueshift, redshift, vCharge);
  vec3 color = mix(head, tailColor, smoothstep(0.0, 0.35, vTailFrac));

  float tailFade = 1.0 - smoothstep(0.0, 1.0, vTailFrac) * 0.65;
  gl_FragColor = vec4(color, dot * tailFade * vAlpha * 0.85);
}
`;

export function CometGL({ className }: { className?: string }) {
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
    let idx = 0;
    for (let c = 0; c < COMETS; c++) {
      for (let k = 0; k < TAIL; k++) {
        const jitter = Math.sin(c * 12.9898 + k * 3.11) * 0.5 + 0.5;
        seeds[idx * 3] = c;
        seeds[idx * 3 + 1] = k;
        seeds[idx * 3 + 2] = jitter;
        idx++;
      }
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
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive: comet trails glow where they overlap

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
