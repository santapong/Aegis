import { ShaderProgram } from "../core/ShaderProgram";
import { COMET_VERT } from "../shaders/comet.vert";
import { COMET_FRAG } from "../shaders/comet.frag";
import { Comet } from "./Comet";
import { ParticleSystem } from "./ParticleSystem";
import type { CometConfig } from "./CometConfig";

interface CometUniforms {
  uPos: WebGLUniformLocation | null;
  uScale: WebGLUniformLocation | null;
  uRotation: WebGLUniformLocation | null;
  uTint: WebGLUniformLocation | null;
  uAspect: WebGLUniformLocation | null;
  uTexture: WebGLUniformLocation | null;
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
  private uniforms: CometUniforms;

  constructor(gl: WebGL2RenderingContext, config: CometConfig) {
    this.gl = gl;
    this.program = new ShaderProgram(gl, COMET_VERT, COMET_FRAG);
    this.comet = new Comet(gl, this.program, config);
    this.particles = new ParticleSystem(gl, config.particles, config.tail);
    this.uniforms = {
      uPos: this.program.uniformLocation("uPos"),
      uScale: this.program.uniformLocation("uScale"),
      uRotation: this.program.uniformLocation("uRotation"),
      uTint: this.program.uniformLocation("uTint"),
      uAspect: this.program.uniformLocation("uAspect"),
      uTexture: this.program.uniformLocation("uTexture"),
    };

    gl.enable(gl.BLEND);
    // Premultiplied-alpha blending, matching the premultipliedAlpha:true
    // context and UNPACK_PREMULTIPLY_ALPHA_WEBGL texture upload.
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  update(elapsed: number, viewportScale: number, motionScale: number, aspect: number): void {
    this.comet.update(elapsed, viewportScale, motionScale, aspect);
    const [coreX, coreY] = this.comet.position;
    this.particles.update(elapsed, coreX, coreY, viewportScale, motionScale);
  }

  render(width: number, height: number, pixelRatio: number): void {
    const gl = this.gl;
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const aspect = width / Math.max(height, 1);
    this.comet.renderTail(aspect);
    this.particles.render(aspect, pixelRatio);

    this.program.use();
    gl.uniform1f(this.uniforms.uAspect, aspect);
    this.comet.renderCore(this.program, this.uniforms);
  }

  dispose(): void {
    this.comet.dispose();
    this.particles.dispose();
    this.program.dispose();
  }
}
