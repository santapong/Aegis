import { FrameTimer } from "./FrameTimer";
import { CometScene } from "../comet/CometScene";
import type { CometConfig } from "../comet/CometConfig";

/** Scale a height-relative tail down on portrait screens so it does not crop. */
const REFERENCE_ASPECT = 16 / 9;
const MIN_VIEWPORT_SCALE = 0.34;
/** Reduced-motion doesn't freeze the tail outright — this damps flow/distortion to near-static. */
const REDUCED_MOTION_SCALE = 0.15;

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
  private motionQuery: MediaQueryList;
  private reducedMotion: boolean;
  private viewportScale = 1;
  private aspect = 1;
  private pixelRatio = 1;
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

  private handleMotionPreference = (event: MediaQueryListEvent): void => {
    this.reducedMotion = event.matches;
    this.stop();
    this.timer.reset();

    if (this.reducedMotion) {
      this.renderReducedMotionFrame();
      return;
    }

    this.start();
  };

  private handleWindowResize = (): void => this.resize();

  /** Render an intentional mid-flight still instead of freezing offscreen at t=0. */
  private renderReducedMotionFrame(): void {
    const settledTime = this.config.loopDuration * 0.5;
    this.scene.update(
      settledTime,
      this.viewportScale,
      REDUCED_MOTION_SCALE,
      this.aspect
    );
    this.scene.render(this.canvas.width, this.canvas.height, this.pixelRatio);
  }

  private frame = (now: number): void => {
    this.timer.tick(now);
    this.scene.update(this.timer.elapsed, this.viewportScale, 1, this.aspect);
    this.scene.render(this.canvas.width, this.canvas.height, this.pixelRatio);
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

    this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.reducedMotion = this.motionQuery.matches;
    this.scene = new CometScene(gl, config);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();

    document.addEventListener("visibilitychange", this.handleVisibility);
    this.motionQuery.addEventListener("change", this.handleMotionPreference);
    window.addEventListener("resize", this.handleWindowResize);
  }

  start(): void {
    if (this.reducedMotion) {
      // One settled frame — no continuous animation, per prefers-reduced-motion.
      // motionScale stays low (not zero) so the tail keeps a subtle glow
      // rather than an arbitrary frozen distortion phase.
      this.renderReducedMotionFrame();
      return;
    }
    if (document.visibilityState === "hidden") {
      // Render one frame so there's something on screen, but don't spin up
      // the RAF loop yet — handleVisibility starts it once the document is
      // actually visible. Without this check, start() would schedule a
      // frame anyway and rely on the browser to throttle it, rather than
      // us deliberately not running work on a hidden page.
      this.scene.update(this.timer.elapsed, this.viewportScale, 1, this.aspect);
      this.scene.render(this.canvas.width, this.canvas.height, this.pixelRatio);
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
    this.pixelRatio = dpr;
    const width = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const height = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.gl.viewport(0, 0, width, height);

    this.aspect = width / Math.max(height, 1);
    this.viewportScale = Math.max(
      MIN_VIEWPORT_SCALE,
      Math.min(1, this.aspect / REFERENCE_ASPECT)
    );

    if (this.reducedMotion) {
      this.renderReducedMotionFrame();
    }
  }

  dispose(): void {
    this.stop();
    this.resizeObserver.disconnect();
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.motionQuery.removeEventListener("change", this.handleMotionPreference);
    window.removeEventListener("resize", this.handleWindowResize);
    this.scene.dispose();
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
