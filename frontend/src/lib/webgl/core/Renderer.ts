import { FrameTimer } from "./FrameTimer";
import { CometScene } from "../comet/CometScene";
import type { CometConfig } from "../comet/CometConfig";

/** Scale a height-relative tail down on portrait screens so it does not crop. */
const REFERENCE_ASPECT = 16 / 9;
const MIN_VIEWPORT_SCALE = 0.34;
/** Reduced-motion doesn't freeze the tail outright — this damps flow/distortion to near-static. */
const REDUCED_MOTION_SCALE = 0.15;
/** Leave the final part of the sticky scene composed for reading. */
const SCROLL_ARRIVAL_FRACTION = 0.62;

/**
 * Owns the WebGL2 context, the render loop, resize/DPR handling, and
 * pause-on-hidden/reduced-motion behavior. `AegisComet.tsx` only creates
 * this and calls start()/dispose() — no rendering logic lives in React.
 */
export class Renderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private scene: CometScene | null;
  private config: CometConfig;
  private timer = new FrameTimer();
  private motionQuery: MediaQueryList;
  private pointerQuery: MediaQueryList;
  private reducedMotion: boolean;
  private finePointer: boolean;
  private viewportScale = 1;
  private aspect = 1;
  private pixelRatio = 1;
  private parallaxTargetX = 0;
  private parallaxTargetY = 0;
  private parallaxCurrentX = 0;
  private parallaxCurrentY = 0;
  private rafId: number | null = null;
  private resizeObserver: ResizeObserver;
  private contextLost = false;
  private disposed = false;
  private contextRestoreCount = 0;
  private diagnosticFrameTimes: number[] = [];
  private stillProgress: number | null = null;
  private stillReducedMotion = false;
  private scrollSource: HTMLElement | null;
  private scrollProgress: number | null = null;

  private handleVisibility = (): void => {
    if (document.visibilityState === "hidden") {
      this.stop();
      this.resetParallax(true);
    } else if (
      !this.reducedMotion &&
      !this.contextLost &&
      !this.disposed &&
      this.stillProgress === null &&
      this.rafId === null
    ) {
      // Avoid a huge delta-time jump from however long the tab was hidden.
      this.timer.reset();
      this.rafId = requestAnimationFrame(this.frame);
    }
  };

  private handleMotionPreference = (event: MediaQueryListEvent): void => {
    this.reducedMotion = event.matches;
    this.stop();
    this.timer.reset();
    this.resetParallax(true);

    if (this.stillProgress !== null) {
      this.renderStill(this.stillProgress, this.stillReducedMotion);
    } else if (this.reducedMotion) {
      this.renderReducedMotionFrame();
    } else {
      this.start();
    }
  };

  private handleWindowResize = (): void => this.resize();

  private handleScroll = (): void => {
    this.updateScrollProgress();
  };

  private handlePointerCapability = (event: MediaQueryListEvent): void => {
    this.finePointer = event.matches;
    this.resetParallax(true);
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (
      !this.config.parallax.enabled ||
      this.reducedMotion ||
      !this.finePointer ||
      !event.isPrimary ||
      event.pointerType === "touch"
    ) {
      return;
    }

    const bounds = this.canvas.getBoundingClientRect();
    if (
      bounds.width <= 0 ||
      bounds.height <= 0 ||
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    ) {
      this.resetParallax(false);
      return;
    }

    const normalizedX = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    const normalizedY = 1 - ((event.clientY - bounds.top) / bounds.height) * 2;
    this.parallaxTargetX = -normalizedX * this.config.parallax.maxOffset[0];
    this.parallaxTargetY = -normalizedY * this.config.parallax.maxOffset[1];
  };

  private handlePointerOut = (event: PointerEvent): void => {
    if (event.relatedTarget === null) this.resetParallax(false);
  };

  private handleWindowBlur = (): void => this.resetParallax(false);

  private handleContextLost = (event: Event): void => {
    // Opt in to restoration. Without preventDefault(), browsers may treat the
    // context as permanently lost and never dispatch webglcontextrestored.
    event.preventDefault();
    this.contextLost = true;
    this.stop();
    this.timer.reset();
    this.resetParallax(true);

    // Every resource wrapper belongs to the lost context generation. It must
    // not be disposed with GL calls or reused after restoration.
    this.scene = null;
    this.canvas.dataset.aegisWebglStatus = "lost";
  };

  private handleContextRestored = (): void => {
    if (this.disposed) return;

    try {
      this.scene = new CometScene(this.gl, this.config);
      this.contextLost = false;
      this.contextRestoreCount += 1;
      this.timer.reset();
      this.canvas.dataset.aegisWebglStatus = "restored";
      this.canvas.dataset.aegisContextRestores = String(this.contextRestoreCount);
      this.resize();
      if (this.stillProgress !== null) {
        this.renderStill(this.stillProgress, this.stillReducedMotion);
      } else {
        this.start();
      }
    } catch (error) {
      this.scene = null;
      this.contextLost = true;
      this.canvas.dataset.aegisWebglStatus = "restore-failed";
      console.error("[AegisComet] WebGL2 context restoration failed:", error);
    }
  };

  private resetParallax(immediate: boolean): void {
    this.parallaxTargetX = 0;
    this.parallaxTargetY = 0;
    if (immediate) {
      this.parallaxCurrentX = 0;
      this.parallaxCurrentY = 0;
    }
  }

  /** Map the sticky hero's scroll range to a stable 0..1 flight position. */
  private updateScrollProgress(): void {
    if (!this.scrollSource) {
      this.scrollProgress = null;
      delete this.canvas.dataset.aegisScrollProgress;
      return;
    }

    const bounds = this.scrollSource.getBoundingClientRect();
    const travel = Math.max(1, this.scrollSource.offsetHeight - window.innerHeight);
    const sceneProgress = Math.min(1, Math.max(0, -bounds.top / travel));
    this.scrollProgress = Math.min(1, sceneProgress / SCROLL_ARRIVAL_FRACTION);
    this.canvas.dataset.aegisScrollProgress = this.scrollProgress.toFixed(3);
  }

  /** Render the intentional settled composition for reduced-motion users. */
  private renderReducedMotionFrame(): void {
    if (!this.scene || this.contextLost || this.disposed) return;
    const settledTime = this.config.flight.arrivalDuration;
    this.timer.setElapsed(Math.max(this.timer.elapsed, settledTime));
    this.scene.update(
      settledTime,
      this.viewportScale,
      REDUCED_MOTION_SCALE,
      this.aspect,
      0,
      0,
      1
    );
    this.scene.render(this.canvas.width, this.canvas.height, this.pixelRatio);
  }

  private frame = (now: number): void => {
    if (!this.scene || this.contextLost || this.disposed) {
      this.rafId = null;
      return;
    }

    const delta = this.timer.tick(now);
    this.recordFrameDiagnostic(delta);
    const response = 1 - Math.exp(-this.config.parallax.smoothing * delta);
    this.parallaxCurrentX += (this.parallaxTargetX - this.parallaxCurrentX) * response;
    this.parallaxCurrentY += (this.parallaxTargetY - this.parallaxCurrentY) * response;
    this.scene.update(
      this.timer.elapsed,
      this.viewportScale,
      1,
      this.aspect,
      this.parallaxCurrentX,
      this.parallaxCurrentY,
      this.scrollProgress
    );
    this.scene.render(this.canvas.width, this.canvas.height, this.pixelRatio);
    this.rafId = requestAnimationFrame(this.frame);
  };

  /**
   * Publish a low-frequency development-only frame-pacing sample without
   * allocating in production or touching GPU timing extensions. The canvas
   * dataset is easy to read from DevTools or an automated visual-test client.
   */
  private recordFrameDiagnostic(delta: number): void {
    if (process.env.NODE_ENV === "production" || delta <= 0) return;

    this.diagnosticFrameTimes.push(delta * 1000);
    if (this.diagnosticFrameTimes.length < 240) return;

    const sorted = [...this.diagnosticFrameTimes].sort((a, b) => a - b);
    const total = this.diagnosticFrameTimes.reduce((sum, value) => sum + value, 0);
    const percentileIndex = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    const longFrames = this.diagnosticFrameTimes.filter((value) => value > 25).length;

    this.canvas.dataset.aegisFrameAverageMs = (total / sorted.length).toFixed(2);
    this.canvas.dataset.aegisFrameP95Ms = sorted[percentileIndex].toFixed(2);
    this.canvas.dataset.aegisLongFrames = String(longFrames);
    this.diagnosticFrameTimes.length = 0;
  }

  constructor(
    canvas: HTMLCanvasElement,
    config: CometConfig,
    scrollSource: HTMLElement | null = null
  ) {
    this.canvas = canvas;
    this.config = config;
    this.scrollSource = scrollSource;

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    });
    if (!gl) throw new Error("WebGL2 is not supported in this browser");
    this.gl = gl;

    this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.pointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    this.reducedMotion = this.motionQuery.matches;
    this.finePointer = this.pointerQuery.matches;
    this.scene = new CometScene(gl, config);
    this.canvas.dataset.aegisWebglStatus = "ready";

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.updateScrollProgress();
    this.resize();

    document.addEventListener("visibilitychange", this.handleVisibility);
    this.motionQuery.addEventListener("change", this.handleMotionPreference);
    this.pointerQuery.addEventListener("change", this.handlePointerCapability);
    window.addEventListener("resize", this.handleWindowResize);
    window.addEventListener("scroll", this.handleScroll, { passive: true });
    window.addEventListener("pointermove", this.handlePointerMove, { passive: true });
    window.addEventListener("pointerout", this.handlePointerOut, { passive: true });
    window.addEventListener("blur", this.handleWindowBlur);
    canvas.addEventListener("webglcontextlost", this.handleContextLost);
    canvas.addEventListener("webglcontextrestored", this.handleContextRestored);
  }

  start(): void {
    if (!this.scene || this.contextLost || this.disposed) return;
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
      this.scene.update(
        this.timer.elapsed,
        this.viewportScale,
        1,
        this.aspect,
        0,
        0,
        this.scrollProgress
      );
      this.scene.render(this.canvas.width, this.canvas.height, this.pixelRatio);
      return;
    }
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(this.frame);
    }
  }

  /** Render a deterministic still for screenshot baselines without starting RAF. */
  renderStill(progress: number, reducedMotion = false): void {
    if (!this.scene || this.contextLost || this.disposed) return;

    this.stop();
    const normalizedProgress = Math.min(1, Math.max(0, progress));
    this.stillProgress = normalizedProgress;
    this.stillReducedMotion = reducedMotion;
    const elapsed = this.config.flight.arrivalDuration * normalizedProgress;
    const motionScale = reducedMotion ? REDUCED_MOTION_SCALE : 1;
    this.scene.update(
      elapsed,
      this.viewportScale,
      motionScale,
      this.aspect,
      0,
      0,
      normalizedProgress
    );
    this.scene.render(this.canvas.width, this.canvas.height, this.pixelRatio);
  }

  /**
   * Exercise the browser's real loss/restoration path for Phase 6 validation.
   * This is inert unless the explicit `comet-context-test=1` query is used.
   */
  testContextRestoration(delayMs = 250): boolean {
    if (this.contextLost || this.disposed) return false;
    const extension = this.gl.getExtension("WEBGL_lose_context");
    if (!extension) {
      this.canvas.dataset.aegisWebglStatus = "context-test-unsupported";
      return false;
    }

    this.canvas.dataset.aegisWebglStatus = "context-test-started";
    extension.loseContext();
    window.setTimeout(() => {
      if (!this.disposed) extension.restoreContext();
    }, Math.max(0, delayMs));
    return true;
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private resize(): void {
    this.updateScrollProgress();
    const dpr = Math.min(window.devicePixelRatio || 1, this.config.dprCap);
    this.pixelRatio = dpr;
    const width = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const height = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    if (!this.contextLost) this.gl.viewport(0, 0, width, height);

    this.aspect = width / Math.max(height, 1);
    this.viewportScale = Math.max(
      MIN_VIEWPORT_SCALE,
      Math.min(1, this.aspect / REFERENCE_ASPECT)
    );

    if (this.stillProgress !== null) {
      this.renderStill(this.stillProgress, this.stillReducedMotion);
    } else if (this.reducedMotion) {
      this.renderReducedMotionFrame();
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.resizeObserver.disconnect();
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.motionQuery.removeEventListener("change", this.handleMotionPreference);
    this.pointerQuery.removeEventListener("change", this.handlePointerCapability);
    window.removeEventListener("resize", this.handleWindowResize);
    window.removeEventListener("scroll", this.handleScroll);
    window.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("pointerout", this.handlePointerOut);
    window.removeEventListener("blur", this.handleWindowBlur);
    this.canvas.removeEventListener("webglcontextlost", this.handleContextLost);
    this.canvas.removeEventListener("webglcontextrestored", this.handleContextRestored);
    if (!this.contextLost) this.scene?.dispose();
    this.scene = null;
    this.canvas.dataset.aegisWebglStatus = "disposed";
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
