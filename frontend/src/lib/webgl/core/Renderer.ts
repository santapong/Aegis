import { FrameTimer } from "./FrameTimer";
import { CometScene } from "../comet/CometScene";
import type { CometConfig } from "../comet/CometConfig";

/**
 * Owns the WebGL2 context, the render loop, resize/DPR handling, and
 * pause-on-hidden/reduced-motion behavior. `AegisComet.tsx` only creates
 * this and calls start()/dispose() — no rendering logic lives in React.
 */
export class Renderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private scene: CometScene;
  private config: CometConfig;
  private timer = new FrameTimer();
  private reducedMotion: boolean;
  private rafId: number | null = null;
  private resizeObserver: ResizeObserver;

  private handleVisibility = (): void => {
    if (document.visibilityState === "hidden") {
      this.stop();
    } else if (!this.reducedMotion && this.rafId === null) {
      // Avoid a huge delta-time jump from however long the tab was hidden.
      this.timer.reset();
      this.rafId = requestAnimationFrame(this.frame);
    }
  };

  private frame = (now: number): void => {
    this.timer.tick(now);
    this.scene.update(this.timer.elapsed);
    this.scene.render(this.canvas.width, this.canvas.height);
    this.rafId = requestAnimationFrame(this.frame);
  };

  constructor(canvas: HTMLCanvasElement, config: CometConfig) {
    this.canvas = canvas;
    this.config = config;

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    });
    if (!gl) throw new Error("WebGL2 is not supported in this browser");
    this.gl = gl;

    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.scene = new CometScene(gl, config);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();

    document.addEventListener("visibilitychange", this.handleVisibility);
  }

  start(): void {
    if (this.reducedMotion) {
      // One settled frame — no continuous animation, per prefers-reduced-motion.
      this.scene.update(0);
      this.scene.render(this.canvas.width, this.canvas.height);
      return;
    }
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(this.frame);
    }
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, this.config.dprCap);
    const width = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const height = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.gl.viewport(0, 0, width, height);
    if (this.reducedMotion) {
      this.scene.render(width, height);
    }
  }

  dispose(): void {
    this.stop();
    this.resizeObserver.disconnect();
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.scene.dispose();
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
