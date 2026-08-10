"use client";

import { useEffect, useRef } from "react";

// Raw-WebGL 3D wireframe terrain for the landing hero. Amber highlights, teal
// shadow — the Meridian duotone. Camera and wave phase are scroll-bound (never
// a timer alone), pointer adds a small parallax. Renders one static frame when
// prefers-reduced-motion is set.

const GRID = 90; // vertices per side

const VERT = `
attribute vec2 aPos;            // grid coords in [-1,1]
uniform float uPhase;
uniform float uTilt;
uniform float uAspect;
uniform vec2 uPointer;
varying float vHeight;
varying float vDepth;

float wave(vec2 p, float t) {
  return 0.10 * sin(p.x * 4.0 + t)
       + 0.07 * sin(p.y * 6.0 - t * 1.3)
       + 0.05 * sin((p.x + p.y) * 9.0 + t * 0.7)
       + 0.16 * exp(-8.0 * dot(p - vec2(0.15, -0.2), p - vec2(0.15, -0.2))) * sin(t * 0.9);
}

void main() {
  float h = wave(aPos, uPhase);
  vHeight = h;
  vec3 pos = vec3(aPos.x * 2.2, h, aPos.y * 2.2);

  float cx = cos(uTilt), sx = sin(uTilt);
  pos.yz = mat2(cx, -sx, sx, cx) * pos.yz;         // tilt toward the camera
  float ry = uPointer.x * 0.12;
  float cy = cos(ry), sy = sin(ry);
  pos.xz = mat2(cy, -sy, sy, cy) * pos.xz;         // pointer parallax

  pos.z += 2.6;
  pos.y -= 0.35 + uPointer.y * 0.05;
  vDepth = pos.z;

  gl_Position = vec4(pos.x / uAspect, pos.y, pos.z * 0.25, pos.z);
}
`;

const FRAG = `
precision mediump float;
varying float vHeight;
varying float vDepth;

void main() {
  vec3 teal = vec3(0.18, 0.42, 0.447);
  vec3 amber = vec3(0.91, 0.569, 0.235);
  float m = smoothstep(-0.12, 0.22, vHeight);      // valleys teal, crests amber
  vec3 color = mix(teal, amber, m);
  float fade = clamp(1.6 - vDepth * 0.35, 0.0, 1.0);
  gl_FragColor = vec4(color * fade, fade * 0.85);
}
`;

function buildGrid() {
  const verts: number[] = [];
  const step = 2 / (GRID - 1);
  const at = (i: number) => -1 + i * step;
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID - 1; c++) {
      verts.push(at(c), at(r), at(c + 1), at(r)); // row lines
      verts.push(at(r), at(c), at(r), at(c + 1)); // column lines
    }
  }
  return new Float32Array(verts);
}

export function MeridianGL({ className }: { className?: string }) {
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

    const grid = buildGrid();
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, grid, gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uPhase = gl.getUniformLocation(prog, "uPhase");
    const uTilt = gl.getUniformLocation(prog, "uTilt");
    const uAspect = gl.getUniformLocation(prog, "uAspect");
    const uPointer = gl.getUniformLocation(prog, "uPointer");

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let pointer = { x: 0, y: 0 };
    let raf = 0;
    let start = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = host.clientWidth * dpr;
      canvas.height = host.clientHeight * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();

    const draw = () => {
      const scroll = Math.min(window.scrollY / 700, 1); // scroll-bound: reverses on scroll-up
      const t = reduced ? 0 : (performance.now() - start) / 1000;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uPhase, t * 0.6 + scroll * 4.0);
      gl.uniform1f(uTilt, 1.05 + scroll * 0.25);
      gl.uniform1f(uAspect, canvas.width / Math.max(canvas.height, 1));
      gl.uniform2f(uPointer, pointer.x, pointer.y);
      gl.drawArrays(gl.LINES, 0, grid.length / 2);
      if (!reduced) raf = requestAnimationFrame(draw);
    };

    const onPointer = (e: PointerEvent) => {
      pointer = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      };
    };
    window.addEventListener("resize", resize);
    if (!reduced) window.addEventListener("pointermove", onPointer);
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      host.removeChild(canvas);
    };
  }, []);

  return <div ref={hostRef} className={className} aria-hidden="true" />;
}
