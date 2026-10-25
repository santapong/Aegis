import { ShaderProgram } from "../core/ShaderProgram";
import { COMET_TAIL_VERT } from "../shaders/comet-tail.vert";
import { COMET_TAIL_FRAG } from "../shaders/comet-tail.frag";
import type { CometTailConfig } from "./CometConfig";

const SEGMENTS = 48;

/** Development-only: not exposed as a runtime control, just a local flip. */
const COMET_DEBUG = false;

interface TailUniformLocations {
  uCorePos: WebGLUniformLocation | null;
  uAspect: WebGLUniformLocation | null;
  uRotation: WebGLUniformLocation | null;
  uTailLength: WebGLUniformLocation | null;
  uTailWidth: WebGLUniformLocation | null;
  uCurvature: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation | null;
  uFlowSpeed: WebGLUniformLocation | null;
  uDistortion: WebGLUniformLocation | null;
  uDistortionFreq: WebGLUniformLocation | null;
  uIntensity: WebGLUniformLocation | null;
  uDebug: WebGLUniformLocation | null;
}

/**
 * A tapered ribbon mesh trailing from the comet core, with its own shader
 * program — separate parameters (length, width, flow, distortion, fade,
 * curvature) from the core, and its own internal animation clock. Built as
 * a single lightweight triangle strip; the shader supplies width tapering,
 * curvature, distortion, and fade, so geometry stays cheap (SEGMENTS+1)*2
 * vertices, one draw call.
 */
export class Tail {
  private gl: WebGL2RenderingContext;
  private program: ShaderProgram;
  private vao: WebGLVertexArrayObject;
  private vbo: WebGLBuffer;
  private uniforms: TailUniformLocations;
  private vertexCount: number;
  private config: CometTailConfig;

  private coreX = 0;
  private coreY = 0;
  private elapsed = 0;
  private rotation = 0;
  private poseScale = 1;
  private viewportScale = 1;
  private motionScale = 1;

  constructor(gl: WebGL2RenderingContext, config: CometTailConfig) {
    this.gl = gl;
    this.config = config;
    this.program = new ShaderProgram(gl, COMET_TAIL_VERT, COMET_TAIL_FRAG);

    const verts: number[] = [];
    for (let i = 0; i <= SEGMENTS; i++) {
      const u = i / SEGMENTS;
      verts.push(u, -1);
      verts.push(u, 1);
    }
    const data = new Float32Array(verts);
    this.vertexCount = data.length / 2;

    const vao = gl.createVertexArray();
    if (!vao) throw new Error("Failed to create tail VAO");
    this.vao = vao;
    gl.bindVertexArray(vao);

    const vbo = gl.createBuffer();
    if (!vbo) throw new Error("Failed to create tail VBO");
    this.vbo = vbo;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

    const aUV = this.program.attribLocation("aUV");
    gl.enableVertexAttribArray(aUV);
    gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);

    this.uniforms = {
      uCorePos: this.program.uniformLocation("uCorePos"),
      uAspect: this.program.uniformLocation("uAspect"),
      uRotation: this.program.uniformLocation("uRotation"),
      uTailLength: this.program.uniformLocation("uTailLength"),
      uTailWidth: this.program.uniformLocation("uTailWidth"),
      uCurvature: this.program.uniformLocation("uCurvature"),
      uTime: this.program.uniformLocation("uTime"),
      uFlowSpeed: this.program.uniformLocation("uFlowSpeed"),
      uDistortion: this.program.uniformLocation("uDistortion"),
      uDistortionFreq: this.program.uniformLocation("uDistortionFreq"),
      uIntensity: this.program.uniformLocation("uIntensity"),
      uDebug: this.program.uniformLocation("uDebug"),
    };
  }

  /**
   * `viewportScale` shrinks length/intensity/distortion on narrow
   * viewports (mobile); `motionScale` damps flow/distortion under
   * prefers-reduced-motion without fully freezing the glow.
   */
  update(
    elapsed: number,
    coreX: number,
    coreY: number,
    rotation: number,
    poseScale: number,
    viewportScale: number,
    motionScale: number
  ): void {
    this.elapsed = elapsed;
    this.coreX = coreX;
    this.coreY = coreY;
    this.rotation = rotation;
    this.poseScale = poseScale;
    this.viewportScale = viewportScale;
    this.motionScale = motionScale;
  }

  render(aspect: number): void {
    const gl = this.gl;
    const c = this.config;
    const visualScale = 0.55 + 0.45 * this.viewportScale;

    this.program.use();
    gl.uniform2f(this.uniforms.uCorePos, this.coreX, this.coreY);
    gl.uniform1f(this.uniforms.uAspect, aspect);
    gl.uniform1f(this.uniforms.uRotation, this.rotation);
    gl.uniform1f(
      this.uniforms.uTailLength,
      c.length * this.viewportScale * this.poseScale
    );
    gl.uniform1f(this.uniforms.uTailWidth, c.width * visualScale * this.poseScale);
    gl.uniform1f(this.uniforms.uCurvature, c.curvature * this.poseScale);
    gl.uniform1f(this.uniforms.uTime, this.elapsed);
    gl.uniform1f(this.uniforms.uFlowSpeed, c.flowSpeed * this.motionScale);
    gl.uniform1f(this.uniforms.uDistortion, c.distortion * this.motionScale * this.viewportScale);
    gl.uniform1f(this.uniforms.uDistortionFreq, c.distortionFrequency);
    gl.uniform1f(this.uniforms.uIntensity, c.intensity * (0.55 + 0.45 * this.viewportScale));
    if (this.uniforms.uDebug) gl.uniform1f(this.uniforms.uDebug, COMET_DEBUG ? 1 : 0);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.vertexCount);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteVertexArray(this.vao);
    gl.deleteBuffer(this.vbo);
    this.program.dispose();
  }
}
