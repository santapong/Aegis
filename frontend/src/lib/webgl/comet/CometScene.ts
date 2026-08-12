import { ShaderProgram } from "../core/ShaderProgram";
import { COMET_VERT } from "../shaders/comet.vert";
import { COMET_FRAG } from "../shaders/comet.frag";
import { Comet } from "./Comet";
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
 * Owns the shader program and the comet(s) in frame. Phase 1 renders a
 * single Comet; the `comets` array is the seam a future particle system or
 * multi-comet field hangs off of without changing the Renderer contract.
 */
export class CometScene {
  private gl: WebGL2RenderingContext;
  private program: ShaderProgram;
  private comets: Comet[];
  private uniforms: CometUniforms;

  constructor(gl: WebGL2RenderingContext, config: CometConfig) {
    this.gl = gl;
    this.program = new ShaderProgram(gl, COMET_VERT, COMET_FRAG);
    this.comets = [new Comet(gl, this.program, config)];
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

  update(elapsed: number): void {
    for (const comet of this.comets) comet.update(elapsed);
  }

  render(width: number, height: number): void {
    const gl = this.gl;
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.program.use();
    gl.uniform1f(this.uniforms.uAspect, width / Math.max(height, 1));
    for (const comet of this.comets) comet.render(this.program, this.uniforms);
  }

  dispose(): void {
    for (const comet of this.comets) comet.dispose();
    this.program.dispose();
  }
}
