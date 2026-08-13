import type { ShaderProgram } from "../core/ShaderProgram";
import type { CometConfig, CometFlightPath } from "./CometConfig";
import { Tail } from "./Tail";

// Triangle-strip unit quad: x, y, u, v.
const QUAD = new Float32Array([
  -0.5, -0.5, 0.0, 0.0,
  0.5, -0.5, 1.0, 0.0,
  -0.5, 0.5, 0.0, 1.0,
  0.5, 0.5, 1.0, 1.0,
]);

interface CometUniformLocations {
  uPos: WebGLUniformLocation | null;
  uScale: WebGLUniformLocation | null;
  uRotation: WebGLUniformLocation | null;
  uTint: WebGLUniformLocation | null;
  uTexture: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation | null;
  uMotionScale: WebGLUniformLocation | null;
}

export interface CometPose {
  position: readonly [number, number];
  rotation: number;
  scale: number;
  arrived: boolean;
}

/**
 * A comet: a bright core (this class's own geometry/texture/position) plus
 * a Tail that trails behind it with independent shader parameters and its
 * own animation clock. The core controls position/scale/rotation; the tail
 * reads the core's position each frame but otherwise runs its own motion.
 */
export class Comet {
  private gl: WebGL2RenderingContext;
  private config: CometConfig;
  private vao: WebGLVertexArrayObject;
  private vbo: WebGLBuffer;
  private texture: WebGLTexture;
  private tail: Tail;

  private x = -1.2;
  private y = 0;
  private visualScale = 1;
  private elapsed = 0;
  private motionScale = 1;
  private rotation = 0;
  private poseScale = 1;
  private arrived = false;

  constructor(gl: WebGL2RenderingContext, program: ShaderProgram, config: CometConfig) {
    this.gl = gl;
    this.config = config;
    this.tail = new Tail(gl, config.tail);

    const vao = gl.createVertexArray();
    if (!vao) throw new Error("Failed to create VAO");
    this.vao = vao;
    gl.bindVertexArray(vao);

    const vbo = gl.createBuffer();
    if (!vbo) throw new Error("Failed to create VBO");
    this.vbo = vbo;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);

    const stride = 4 * Float32Array.BYTES_PER_ELEMENT;
    const aPosition = program.attribLocation("aPosition");
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, stride, 0);

    const aUV = program.attribLocation("aUV");
    gl.enableVertexAttribArray(aUV);
    gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);

    gl.bindVertexArray(null);

    this.texture = this.createGlowTexture();
  }

  /**
   * Placeholder comet texture: a soft radial glow, generated on a 2D canvas
   * rather than loaded from a file — Phase 1 needs "a" texture, not a
   * specific piece of art, and this keeps the component dependency-free.
   */
  private createGlowTexture(): WebGLTexture {
    const gl = this.gl;
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2D context for comet texture");

    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.25, "rgba(255,255,255,0.9)");
    gradient.addColorStop(0.6, "rgba(255,255,255,0.25)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = gl.createTexture();
    if (!texture) throw new Error("Failed to create WebGL texture");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }

  /**
   * `elapsed` is cumulative seconds, unaffected by pauses (see FrameTimer).
   * `flightProgress` optionally decouples connected-system translation from
   * that clock so the landing page can scrub the Bézier with scroll position.
   * `viewportScale` (mobile) and `motionScale` (reduced-motion) are forwarded
   * to the tail, which reacts to them independently of the core's own motion.
   */
  update(
    elapsed: number,
    viewportScale: number,
    motionScale: number,
    aspect: number,
    parallaxX: number,
    parallaxY: number,
    flightProgress: number | null = null
  ): void {
    this.elapsed = elapsed;
    this.motionScale = motionScale;
    const flight = this.config.flight;
    // The landing page supplies scroll progress so translation is scrubbed by
    // the visitor. Keeping elapsed separate lets plasma, motes, and bloom stay
    // alive even while the page is stationary. The time fallback preserves the
    // renderer's standalone behaviour and existing deterministic tooling.
    const progress = flightProgress === null
      ? clamp01(elapsed / flight.arrivalDuration)
      : clamp01(flightProgress);
    const eased = smootherstep(progress);
    const desktopMix = smoothstep(0.55, 0.9, viewportScale);
    const path = interpolatePath(flight.compact, flight.desktop, desktopMix);
    const [pathX, pathY] = cubicBezier(path, eased);
    const [tangentX, tangentY] = cubicBezierTangent(path, eased);
    const trajectoryHeading = Math.atan2(tangentY, tangentX * aspect);
    const headingBlend = smoothstep(0.68, 1, eased);
    this.rotation = mix(trajectoryHeading, path.settledHeading, headingBlend);
    this.arrived = progress >= 1;

    const settledElapsed = Math.max(0, elapsed - flight.arrivalDuration);
    const breathingPhase = settledElapsed * flight.breathingSpeed * Math.PI * 2;
    const scrollControlled = flightProgress !== null;
    const breathingEnabled = motionScale >= 0.5
      && (scrollControlled ? progress > 0.94 : this.arrived);
    const breathingRamp = breathingEnabled
      ? scrollControlled
        ? smoothstep(0.94, 1, progress)
        : smoothstep(0, 1.2, settledElapsed)
      : 0;
    const breathingX = breathingEnabled
      ? Math.sin(breathingPhase) * flight.breathingOffset[0] * breathingRamp
      : 0;
    const breathingY = breathingEnabled
      ? Math.sin(breathingPhase * 0.73) * flight.breathingOffset[1] * breathingRamp
      : 0;
    const breathingScale = breathingEnabled
      ? 1 + Math.sin(breathingPhase * 0.61) * flight.breathingScale * breathingRamp
      : 1;

    this.poseScale = breathingScale;
    this.visualScale = (0.55 + 0.45 * viewportScale) * this.poseScale;
    this.x = pathX + breathingX + parallaxX;
    this.y = pathY + breathingY + parallaxY;

    this.tail.update(
      elapsed,
      this.x,
      this.y,
      this.rotation,
      this.poseScale,
      viewportScale,
      motionScale
    );
  }

  get pose(): CometPose {
    return {
      position: [this.x, this.y],
      rotation: this.rotation,
      scale: this.poseScale,
      arrived: this.arrived,
    };
  }

  renderTail(aspect: number): void {
    this.tail.render(aspect);
  }

  renderCore(program: ShaderProgram, uniforms: CometUniformLocations): void {
    const gl = this.gl;
    program.use();

    gl.uniform2f(uniforms.uPos, this.x, this.y);
    gl.uniform2f(
      uniforms.uScale,
      this.config.scale[0] * this.visualScale,
      this.config.scale[1] * this.visualScale
    );
    gl.uniform1f(uniforms.uRotation, this.rotation);
    gl.uniform3f(uniforms.uTint, this.config.tint[0], this.config.tint[1], this.config.tint[2]);
    gl.uniform1f(uniforms.uTime, this.elapsed);
    gl.uniform1f(uniforms.uMotionScale, this.motionScale);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(uniforms.uTexture, 0);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteVertexArray(this.vao);
    gl.deleteBuffer(this.vbo);
    gl.deleteTexture(this.texture);
    this.tail.dispose();
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function mix(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const x = clamp01((value - edge0) / (edge1 - edge0));
  return x * x * (3 - 2 * x);
}

function smootherstep(value: number): number {
  const x = clamp01(value);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function interpolatePath(
  compact: CometFlightPath,
  desktop: CometFlightPath,
  amount: number
): CometFlightPath {
  const point = (
    compactPoint: [number, number],
    desktopPoint: [number, number]
  ): [number, number] => [
    mix(compactPoint[0], desktopPoint[0], amount),
    mix(compactPoint[1], desktopPoint[1], amount),
  ];

  return {
    start: point(compact.start, desktop.start),
    control1: point(compact.control1, desktop.control1),
    control2: point(compact.control2, desktop.control2),
    end: point(compact.end, desktop.end),
    settledHeading: mix(compact.settledHeading, desktop.settledHeading, amount),
  };
}

function cubicBezier(path: CometFlightPath, t: number): [number, number] {
  const inverse = 1 - t;
  const a = inverse * inverse * inverse;
  const b = 3 * inverse * inverse * t;
  const c = 3 * inverse * t * t;
  const d = t * t * t;
  return [
    path.start[0] * a + path.control1[0] * b + path.control2[0] * c + path.end[0] * d,
    path.start[1] * a + path.control1[1] * b + path.control2[1] * c + path.end[1] * d,
  ];
}

function cubicBezierTangent(path: CometFlightPath, t: number): [number, number] {
  const inverse = 1 - t;
  return [
    3 * inverse * inverse * (path.control1[0] - path.start[0])
      + 6 * inverse * t * (path.control2[0] - path.control1[0])
      + 3 * t * t * (path.end[0] - path.control2[0]),
    3 * inverse * inverse * (path.control1[1] - path.start[1])
      + 6 * inverse * t * (path.control2[1] - path.control1[1])
      + 3 * t * t * (path.end[1] - path.control2[1]),
  ];
}
