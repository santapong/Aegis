import { ShaderProgram } from "../core/ShaderProgram";
import type { CometBloomConfig } from "../comet/CometConfig";
import { POSTPROCESS_VERT } from "../shaders/postprocess.vert";
import { BLOOM_EXTRACT_FRAG } from "../shaders/bloom-extract.frag";
import { BLOOM_BLUR_FRAG } from "../shaders/bloom-blur.frag";
import { BLOOM_COMPOSITE_FRAG } from "../shaders/bloom-composite.frag";

interface RenderTarget {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
}

interface ExtractUniforms {
  uTexture: WebGLUniformLocation | null;
  uThreshold: WebGLUniformLocation | null;
  uSoftKnee: WebGLUniformLocation | null;
}

interface BlurUniforms {
  uTexture: WebGLUniformLocation | null;
  uTexelSize: WebGLUniformLocation | null;
  uDirection: WebGLUniformLocation | null;
  uRadius: WebGLUniformLocation | null;
}

interface CompositeUniforms {
  uScene: WebGLUniformLocation | null;
  uBloom: WebGLUniformLocation | null;
  uStrength: WebGLUniformLocation | null;
}

/**
 * Restrained Phase 4 bloom: full-resolution scene capture, reduced-resolution
 * highlight extraction, one separable Gaussian blur pair, then a transparent
 * premultiplied composite. Targets are reused and resized only with the canvas.
 */
export class PostProcessor {
  private gl: WebGL2RenderingContext;
  private config: CometBloomConfig;
  private vao: WebGLVertexArrayObject;
  private extractProgram: ShaderProgram;
  private blurProgram: ShaderProgram;
  private compositeProgram: ShaderProgram;
  private extractUniforms: ExtractUniforms;
  private blurUniforms: BlurUniforms;
  private compositeUniforms: CompositeUniforms;
  private sceneTarget: RenderTarget;
  private bloomA: RenderTarget;
  private bloomB: RenderTarget;
  private viewportScale = 1;
  private motionScale = 1;

  constructor(gl: WebGL2RenderingContext, config: CometBloomConfig) {
    this.gl = gl;
    this.config = config;
    this.extractProgram = new ShaderProgram(gl, POSTPROCESS_VERT, BLOOM_EXTRACT_FRAG);
    this.blurProgram = new ShaderProgram(gl, POSTPROCESS_VERT, BLOOM_BLUR_FRAG);
    this.compositeProgram = new ShaderProgram(gl, POSTPROCESS_VERT, BLOOM_COMPOSITE_FRAG);

    const vao = gl.createVertexArray();
    if (!vao) throw new Error("Failed to create post-processing VAO");
    this.vao = vao;

    this.sceneTarget = this.createTarget();
    this.bloomA = this.createTarget();
    this.bloomB = this.createTarget();

    this.extractUniforms = {
      uTexture: this.extractProgram.uniformLocation("uTexture"),
      uThreshold: this.extractProgram.uniformLocation("uThreshold"),
      uSoftKnee: this.extractProgram.uniformLocation("uSoftKnee"),
    };
    this.blurUniforms = {
      uTexture: this.blurProgram.uniformLocation("uTexture"),
      uTexelSize: this.blurProgram.uniformLocation("uTexelSize"),
      uDirection: this.blurProgram.uniformLocation("uDirection"),
      uRadius: this.blurProgram.uniformLocation("uRadius"),
    };
    this.compositeUniforms = {
      uScene: this.compositeProgram.uniformLocation("uScene"),
      uBloom: this.compositeProgram.uniformLocation("uBloom"),
      uStrength: this.compositeProgram.uniformLocation("uStrength"),
    };
  }

  update(viewportScale: number, motionScale: number): void {
    this.viewportScale = viewportScale;
    this.motionScale = motionScale;
  }

  beginFrame(width: number, height: number): void {
    const gl = this.gl;
    if (!this.config.enabled) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, width, height);
    } else {
      const bloomScale = this.responsiveValue(
        this.config.mobileResolutionScale,
        this.config.resolutionScale
      );
      this.resizeTarget(this.sceneTarget, width, height);
      this.resizeTarget(
        this.bloomA,
        Math.max(1, Math.round(width * bloomScale)),
        Math.max(1, Math.round(height * bloomScale))
      );
      this.resizeTarget(this.bloomB, this.bloomA.width, this.bloomA.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneTarget.framebuffer);
      gl.viewport(0, 0, width, height);
    }

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  endFrame(width: number, height: number): void {
    if (!this.config.enabled) return;

    const gl = this.gl;
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.vao);

    // Pass 1: isolate only the core, bright filaments, and rare white motes.
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomA.framebuffer);
    gl.viewport(0, 0, this.bloomA.width, this.bloomA.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.extractProgram.use();
    this.bindTexture(this.sceneTarget.texture, 0, this.extractUniforms.uTexture);
    gl.uniform1f(this.extractUniforms.uThreshold, this.config.threshold);
    gl.uniform1f(this.extractUniforms.uSoftKnee, this.config.softKnee);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Pass 2: horizontal Gaussian blur into the second ping-pong target.
    this.blur(
      this.bloomA.texture,
      this.bloomB,
      1,
      0,
      this.responsiveValue(Math.max(3, this.config.radius - 1), this.config.radius)
    );

    // Pass 3: vertical blur back into the first target.
    this.blur(
      this.bloomB.texture,
      this.bloomA,
      0,
      1,
      this.responsiveValue(Math.max(3, this.config.radius - 1), this.config.radius)
    );

    // Pass 4: source-over composite keeps RGB valid for the resulting alpha,
    // so the transparent canvas cannot produce a black or colored rectangle.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.compositeProgram.use();
    this.bindTexture(this.sceneTarget.texture, 0, this.compositeUniforms.uScene);
    this.bindTexture(this.bloomA.texture, 1, this.compositeUniforms.uBloom);
    const strength = this.responsiveValue(
      this.config.mobileStrength,
      this.config.strength
    ) * (this.motionScale < 0.5 ? 0.8 : 1);
    gl.uniform1f(this.compositeUniforms.uStrength, strength);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindVertexArray(null);
  }

  private blur(
    source: WebGLTexture,
    destination: RenderTarget,
    directionX: number,
    directionY: number,
    radius: number
  ): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, destination.framebuffer);
    gl.viewport(0, 0, destination.width, destination.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.blurProgram.use();
    this.bindTexture(source, 0, this.blurUniforms.uTexture);
    gl.uniform2f(
      this.blurUniforms.uTexelSize,
      1 / destination.width,
      1 / destination.height
    );
    gl.uniform2f(this.blurUniforms.uDirection, directionX, directionY);
    gl.uniform1f(this.blurUniforms.uRadius, radius);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private responsiveValue(mobile: number, desktop: number): number {
    const mix = Math.max(0, Math.min(1, (this.viewportScale - 0.55) / 0.45));
    return mobile + (desktop - mobile) * mix;
  }

  private bindTexture(
    texture: WebGLTexture,
    unit: number,
    uniform: WebGLUniformLocation | null
  ): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uniform, unit);
  }

  private createTarget(): RenderTarget {
    const gl = this.gl;
    const texture = gl.createTexture();
    if (!texture) throw new Error("Failed to create bloom texture");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const framebuffer = gl.createFramebuffer();
    if (!framebuffer) throw new Error("Failed to create bloom framebuffer");
    return { framebuffer, texture, width: 0, height: 0 };
  }

  private resizeTarget(target: RenderTarget, width: number, height: number): void {
    if (target.width === width && target.height === height) return;

    const gl = this.gl;
    target.width = width;
    target.height = height;
    gl.bindTexture(gl.TEXTURE_2D, target.texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      target.texture,
      0
    );
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error("Bloom framebuffer is incomplete");
    }
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteVertexArray(this.vao);
    for (const target of [this.sceneTarget, this.bloomA, this.bloomB]) {
      gl.deleteFramebuffer(target.framebuffer);
      gl.deleteTexture(target.texture);
    }
    this.extractProgram.dispose();
    this.blurProgram.dispose();
    this.compositeProgram.dispose();
  }
}
