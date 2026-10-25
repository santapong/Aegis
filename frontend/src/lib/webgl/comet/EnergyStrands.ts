import { ShaderProgram } from "../core/ShaderProgram";
import { COMET_STRANDS_VERT } from "../shaders/comet-strands.vert";
import { COMET_STRANDS_FRAG } from "../shaders/comet-strands.frag";
import type { CometStrandConfig, CometTailConfig } from "./CometConfig";

const SEGMENTS = 32;

interface StrandUniforms {
  uCorePos: WebGLUniformLocation | null;
  uAspect: WebGLUniformLocation | null;
  uRotation: WebGLUniformLocation | null;
  uTailLength: WebGLUniformLocation | null;
  uCurvature: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation | null;
  uFlowSpeed: WebGLUniformLocation | null;
  uWidth: WebGLUniformLocation | null;
  uSpread: WebGLUniformLocation | null;
  uIntensity: WebGLUniformLocation | null;
}

/**
 * Reference-driven depth layer: one static ribbon is instanced into several
 * independent spline-like energy strands. The GPU supplies their separation,
 * flow, and depth variation; JavaScript only selects a responsive instance
 * count.
 */
export class EnergyStrands {
  private gl: WebGL2RenderingContext;
  private config: CometStrandConfig;
  private tailConfig: CometTailConfig;
  private program: ShaderProgram;
  private vao: WebGLVertexArrayObject;
  private vbo: WebGLBuffer;
  private uniforms: StrandUniforms;
  private vertexCount: number;

  private elapsed = 0;
  private coreX = 0;
  private coreY = 0;
  private rotation = 0;
  private poseScale = 1;
  private viewportScale = 1;
  private motionScale = 1;

  constructor(
    gl: WebGL2RenderingContext,
    config: CometStrandConfig,
    tailConfig: CometTailConfig
  ) {
    this.gl = gl;
    this.config = config;
    this.tailConfig = tailConfig;
    this.program = new ShaderProgram(gl, COMET_STRANDS_VERT, COMET_STRANDS_FRAG);

    const vertices: number[] = [];
    for (let index = 0; index <= SEGMENTS; index++) {
      const u = index / SEGMENTS;
      vertices.push(u, -1, u, 1);
    }
    const data = new Float32Array(vertices);
    this.vertexCount = data.length / 2;

    const vao = gl.createVertexArray();
    if (!vao) throw new Error("Failed to create energy-strand VAO");
    this.vao = vao;
    gl.bindVertexArray(vao);

    const vbo = gl.createBuffer();
    if (!vbo) throw new Error("Failed to create energy-strand VBO");
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
      uCurvature: this.program.uniformLocation("uCurvature"),
      uTime: this.program.uniformLocation("uTime"),
      uFlowSpeed: this.program.uniformLocation("uFlowSpeed"),
      uWidth: this.program.uniformLocation("uWidth"),
      uSpread: this.program.uniformLocation("uSpread"),
      uIntensity: this.program.uniformLocation("uIntensity"),
    };
  }

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
    const compactMix = smoothstep(0.55, 0.9, this.viewportScale);
    const responsiveCount = Math.round(
      c.mobileCount + (c.count - c.mobileCount) * compactMix
    );
    const instanceCount = this.motionScale < 0.5
      ? c.reducedMotionCount
      : responsiveCount;

    this.program.use();
    gl.uniform2f(this.uniforms.uCorePos, this.coreX, this.coreY);
    gl.uniform1f(this.uniforms.uAspect, aspect);
    gl.uniform1f(this.uniforms.uRotation, this.rotation);
    gl.uniform1f(
      this.uniforms.uTailLength,
      this.tailConfig.length * this.viewportScale * this.poseScale
    );
    gl.uniform1f(this.uniforms.uCurvature, this.tailConfig.curvature * this.poseScale);
    gl.uniform1f(this.uniforms.uTime, this.elapsed);
    gl.uniform1f(this.uniforms.uFlowSpeed, c.flowSpeed * this.motionScale);
    gl.uniform1f(
      this.uniforms.uWidth,
      c.width * (0.72 + 0.28 * this.viewportScale) * this.poseScale
    );
    gl.uniform1f(
      this.uniforms.uSpread,
      c.spread * this.viewportScale * this.poseScale
    );
    gl.uniform1f(
      this.uniforms.uIntensity,
      c.intensity * (0.62 + 0.38 * this.viewportScale)
    );

    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, this.vertexCount, instanceCount);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteVertexArray(this.vao);
    gl.deleteBuffer(this.vbo);
    this.program.dispose();
  }
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const x = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return x * x * (3 - 2 * x);
}
