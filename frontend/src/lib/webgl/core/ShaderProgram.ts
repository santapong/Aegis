/** Compiles, links, and owns one WebGL2 shader program. */
export class ShaderProgram {
  readonly program: WebGLProgram;
  private gl: WebGL2RenderingContext;

  constructor(gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string) {
    this.gl = gl;
    const vert = this.compile(gl.VERTEX_SHADER, vertSrc);
    const frag = this.compile(gl.FRAGMENT_SHADER, fragSrc);

    const program = gl.createProgram();
    if (!program) throw new Error("Failed to create WebGL program");
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);

    // Shaders are only needed during linking; free them either way.
    gl.deleteShader(vert);
    gl.deleteShader(frag);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`WebGL program link failed: ${info}`);
    }

    this.program = program;
  }

  private compile(type: number, src: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Failed to create WebGL shader");
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`WebGL shader compile failed: ${info}`);
    }
    return shader;
  }

  use(): void {
    this.gl.useProgram(this.program);
  }

  attribLocation(name: string): number {
    return this.gl.getAttribLocation(this.program, name);
  }

  uniformLocation(name: string): WebGLUniformLocation | null {
    return this.gl.getUniformLocation(this.program, name);
  }

  dispose(): void {
    this.gl.deleteProgram(this.program);
  }
}
