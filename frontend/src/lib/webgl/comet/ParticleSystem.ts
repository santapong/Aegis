import { ShaderProgram } from "../core/ShaderProgram";
import { COMET_PARTICLES_VERT } from "../shaders/comet-particles.vert";
import { COMET_PARTICLES_FRAG } from "../shaders/comet-particles.frag";
import type { CometParticleConfig, CometTailConfig } from "./CometConfig";

const FLOATS_PER_PARTICLE = 6;

interface ParticleUniformLocations {
  uCorePos: WebGLUniformLocation | null;
  uAspect: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation | null;
  uTailLength: WebGLUniformLocation | null;
  uTailWidth: WebGLUniformLocation | null;
  uCurvature: WebGLUniformLocation | null;
  uDistortion: WebGLUniformLocation | null;
  uDistortionFreq: WebGLUniformLocation | null;
  uFlowSpeed: WebGLUniformLocation | null;
  uSpread: WebGLUniformLocation | null;
  uTurbulence: WebGLUniformLocation | null;
  uPointSize: WebGLUniformLocation | null;
  uPixelRatio: WebGLUniformLocation | null;
  uIntensity: WebGLUniformLocation | null;
}

/** Stable pseudo-random value in [0, 1), used only while building seeds. */
function hash(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * A single-draw-call field of comet-tail energy motes. JavaScript uploads one
 * immutable seed buffer; the vertex shader handles every position, lifecycle,
 * curve, and drift calculation from elapsed time. There are no per-frame
 * particle objects or buffer writes.
 */
export class ParticleSystem {
  private gl: WebGL2RenderingContext;
  private program: ShaderProgram;
  private vao: WebGLVertexArrayObject;
  private vbo: WebGLBuffer;
  private uniforms: ParticleUniformLocations;
  private config: CometParticleConfig;
  private tailConfig: CometTailConfig;

  private coreX = 0;
  private coreY = 0;
  private elapsed = 0;
  private viewportScale = 1;
  private motionScale = 1;

  constructor(
    gl: WebGL2RenderingContext,
    config: CometParticleConfig,
    tailConfig: CometTailConfig
  ) {
    this.gl = gl;
    this.config = config;
    this.tailConfig = tailConfig;
    this.program = new ShaderProgram(gl, COMET_PARTICLES_VERT, COMET_PARTICLES_FRAG);

    const seeds = new Float32Array(config.count * FLOATS_PER_PARTICLE);
    for (let i = 0; i < config.count; i++) {
      const offset = i * FLOATS_PER_PARTICLE;
      // Golden-ratio ordering keeps every prefix of the buffer distributed
      // across the full tail, so mobile can draw fewer vertices without
      // clustering them into one longitudinal region.
      seeds[offset] = (i * 0.61803398875 + hash(i + 0.17) / config.count) % 1;
      seeds[offset + 1] = hash(i + 11.3) * 2 - 1; // lateral side
      seeds[offset + 2] = hash(i + 29.7); // point-size mix
      seeds[offset + 3] = hash(i + 47.1) * Math.PI * 2; // turbulence phase
      // Most motes stay restrained; a small deterministic minority become
      // near-white accents like the brighter specks in the reference.
      const accent = hash(i + 83.9);
      seeds[offset + 4] = accent > 0.92 ? 1 : 0.35 + accent * 0.5;
      seeds[offset + 5] = hash(i + 101.2); // per-particle flow-speed mix
    }

    const vao = gl.createVertexArray();
    if (!vao) throw new Error("Failed to create particle VAO");
    this.vao = vao;
    gl.bindVertexArray(vao);

    const vbo = gl.createBuffer();
    if (!vbo) throw new Error("Failed to create particle VBO");
    this.vbo = vbo;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);

    const stride = FLOATS_PER_PARTICLE * Float32Array.BYTES_PER_ELEMENT;
    const aSeed = this.program.attribLocation("aSeed");
    gl.enableVertexAttribArray(aSeed);
    gl.vertexAttribPointer(aSeed, 4, gl.FLOAT, false, stride, 0);

    const aStyle = this.program.attribLocation("aStyle");
    gl.enableVertexAttribArray(aStyle);
    gl.vertexAttribPointer(
      aStyle,
      2,
      gl.FLOAT,
      false,
      stride,
      4 * Float32Array.BYTES_PER_ELEMENT
    );
    gl.bindVertexArray(null);

    this.uniforms = {
      uCorePos: this.program.uniformLocation("uCorePos"),
      uAspect: this.program.uniformLocation("uAspect"),
      uTime: this.program.uniformLocation("uTime"),
      uTailLength: this.program.uniformLocation("uTailLength"),
      uTailWidth: this.program.uniformLocation("uTailWidth"),
      uCurvature: this.program.uniformLocation("uCurvature"),
      uDistortion: this.program.uniformLocation("uDistortion"),
      uDistortionFreq: this.program.uniformLocation("uDistortionFreq"),
      uFlowSpeed: this.program.uniformLocation("uFlowSpeed"),
      uSpread: this.program.uniformLocation("uSpread"),
      uTurbulence: this.program.uniformLocation("uTurbulence"),
      uPointSize: this.program.uniformLocation("uPointSize"),
      uPixelRatio: this.program.uniformLocation("uPixelRatio"),
      uIntensity: this.program.uniformLocation("uIntensity"),
    };
  }

  update(
    elapsed: number,
    coreX: number,
    coreY: number,
    viewportScale: number,
    motionScale: number
  ): void {
    this.elapsed = elapsed;
    this.coreX = coreX;
    this.coreY = coreY;
    this.viewportScale = viewportScale;
    this.motionScale = motionScale;
  }

  render(aspect: number, pixelRatio: number): void {
    const gl = this.gl;
    const c = this.config;
    const tail = this.tailConfig;
    const visualScale = 0.55 + 0.45 * this.viewportScale;
    const responsiveMix = Math.max(0, Math.min(1, (this.viewportScale - 0.55) / 0.45));
    const responsiveCount = c.mobileCount + (c.count - c.mobileCount) * responsiveMix;
    const activeCount = this.motionScale < 0.5 ? c.reducedMotionCount : responsiveCount;

    this.program.use();
    gl.uniform2f(this.uniforms.uCorePos, this.coreX, this.coreY);
    gl.uniform1f(this.uniforms.uAspect, aspect);
    gl.uniform1f(this.uniforms.uTime, this.elapsed);
    gl.uniform1f(this.uniforms.uTailLength, tail.length * this.viewportScale);
    gl.uniform1f(this.uniforms.uTailWidth, tail.width * visualScale);
    gl.uniform1f(this.uniforms.uCurvature, tail.curvature);
    gl.uniform1f(
      this.uniforms.uDistortion,
      tail.distortion * this.viewportScale * this.motionScale
    );
    gl.uniform1f(this.uniforms.uDistortionFreq, tail.distortionFrequency);
    gl.uniform1f(this.uniforms.uFlowSpeed, c.flowSpeed * this.motionScale);
    gl.uniform1f(this.uniforms.uSpread, c.spread);
    gl.uniform1f(this.uniforms.uTurbulence, c.turbulence * this.motionScale * visualScale);
    gl.uniform2f(this.uniforms.uPointSize, c.size[0] * visualScale, c.size[1] * visualScale);
    gl.uniform1f(this.uniforms.uPixelRatio, pixelRatio);
    gl.uniform1f(
      this.uniforms.uIntensity,
      c.intensity * (0.5 + 0.5 * this.viewportScale) * (this.motionScale < 0.5 ? 0.55 : 1)
    );

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.POINTS, 0, Math.ceil(activeCount));
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteVertexArray(this.vao);
    gl.deleteBuffer(this.vbo);
    this.program.dispose();
  }
}
