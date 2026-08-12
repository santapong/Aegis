import type { ShaderProgram } from "../core/ShaderProgram";
import type { CometConfig } from "./CometConfig";

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
}

/** Owns one comet's geometry, glow texture, and left-to-right loop position. */
export class Comet {
  private gl: WebGL2RenderingContext;
  private config: CometConfig;
  private vao: WebGLVertexArrayObject;
  private vbo: WebGLBuffer;
  private texture: WebGLTexture;

  private x = -1.2;
  private y = 0;

  constructor(gl: WebGL2RenderingContext, program: ShaderProgram, config: CometConfig) {
    this.gl = gl;
    this.config = config;

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

  /** `elapsed` is cumulative seconds, unaffected by pauses (see FrameTimer). */
  update(elapsed: number): void {
    const progress = (elapsed % this.config.loopDuration) / this.config.loopDuration;
    // easeInOutSine: a cinematic cruise rather than constant-velocity travel.
    const eased = 0.5 - 0.5 * Math.cos(progress * Math.PI);
    this.x = -1.2 + eased * 2.4;
    this.y = Math.sin(progress * Math.PI * 2) * 0.04; // subtle organic drift
  }

  render(program: ShaderProgram, uniforms: CometUniformLocations): void {
    const gl = this.gl;
    gl.uniform2f(uniforms.uPos, this.x, this.y);
    gl.uniform2f(uniforms.uScale, this.config.scale[0], this.config.scale[1]);
    gl.uniform1f(uniforms.uRotation, 0);
    gl.uniform3f(uniforms.uTint, this.config.tint[0], this.config.tint[1], this.config.tint[2]);

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
  }
}
