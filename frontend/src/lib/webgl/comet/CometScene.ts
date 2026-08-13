import { ShaderProgram } from "../core/ShaderProgram";
import { COMET_VERT } from "../shaders/comet.vert";
import { COMET_FRAG } from "../shaders/comet.frag";
import { Comet } from "./Comet";
import { ParticleSystem } from "./ParticleSystem";
import { EnergyStrands } from "./EnergyStrands";
import { PostProcessor } from "../postprocessing/PostProcessor";
import type { CometConfig } from "./CometConfig";

interface CometUniforms {
  uPos: WebGLUniformLocation | null;
  uScale: WebGLUniformLocation | null;
  uRotation: WebGLUniformLocation | null;
  uTint: WebGLUniformLocation | null;
  uAspect: WebGLUniformLocation | null;
  uTexture: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation | null;
  uMotionScale: WebGLUniformLocation | null;
}

/**
 * Owns the core shader, the comet (core + procedural tail), and Phase 3's
 * separate particle layer. Rendering stays ordered back-to-front:
 * tail -> energy particles -> bright core.
 */
export class CometScene {
  private gl: WebGL2RenderingContext;
  private program: ShaderProgram;
  private comet: Comet;
  private particles: ParticleSystem;
  private strands: EnergyStrands;
  private postProcessor: PostProcessor;
  private uniforms: CometUniforms;

  constructor(gl: WebGL2RenderingContext, config: CometConfig) {
    this.gl = gl;
    this.program = new ShaderProgram(gl, COMET_VERT, COMET_FRAG);
    this.comet = new Comet(gl, this.program, config);
    this.strands = new EnergyStrands(gl, config.strands, config.tail);
    this.particles = new ParticleSystem(gl, config.particles, config.tail);
    this.postProcessor = new PostProcessor(gl, config.bloom);
    this.uniforms = {
      uPos: this.program.uniformLocation("uPos"),
      uScale: this.program.uniformLocation("uScale"),
      uRotation: this.program.uniformLocation("uRotation"),
      uTint: this.program.uniformLocation("uTint"),
      uAspect: this.program.uniformLocation("uAspect"),
      uTexture: this.program.uniformLocation("uTexture"),
      uTime: this.program.uniformLocation("uTime"),
      uMotionScale: this.program.uniformLocation("uMotionScale"),
    };

    gl.enable(gl.BLEND);
    // Premultiplied-alpha blending, matching the premultipliedAlpha:true
    // context and UNPACK_PREMULTIPLY_ALPHA_WEBGL texture upload.
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  update(
    elapsed: number,
    viewportScale: number,
    motionScale: number,
    aspect: number,
    parallaxX = 0,
    parallaxY = 0,
    flightProgress: number | null = null
  ): void {
    this.comet.update(
      elapsed,
      viewportScale,
      motionScale,
      aspect,
      parallaxX,
      parallaxY,
      flightProgress
    );
    const pose = this.comet.pose;
    const [coreX, coreY] = pose.position;
    this.strands.update(
      elapsed,
      coreX,
      coreY,
      pose.rotation,
      pose.scale,
      viewportScale,
      motionScale
    );
    this.particles.update(
      elapsed,
      coreX,
      coreY,
      pose.rotation,
      pose.scale,
      viewportScale,
      motionScale
    );
    this.postProcessor.update(viewportScale, motionScale);
  }

  render(width: number, height: number, pixelRatio: number): void {
    const gl = this.gl;
    this.postProcessor.beginFrame(width, height);

    const aspect = width / Math.max(height, 1);
    this.comet.renderTail(aspect);
    this.strands.render(aspect);
    this.particles.render(aspect, pixelRatio);

    this.program.use();
    gl.uniform1f(this.uniforms.uAspect, aspect);
    this.comet.renderCore(this.program, this.uniforms);

    this.postProcessor.endFrame(width, height);
  }

  dispose(): void {
    this.comet.dispose();
    this.strands.dispose();
    this.particles.dispose();
    this.postProcessor.dispose();
    this.program.dispose();
  }
}
