/**
 * Camera controller for mouse and touch input handling.
 */

import type { OrbitCamera } from "./orbit-camera";

export interface ControllerOptions {
  /** Orbit rotation speed (radians per pixel) */
  orbitSpeed?: number;
  /** Zoom speed multiplier */
  zoomSpeed?: number;
  /** Pan speed multiplier */
  panSpeed?: number;
  /** Enable touch support */
  enableTouch?: boolean;
}

const DEFAULT_OPTIONS: Required<ControllerOptions> = {
  orbitSpeed: 0.005,
  zoomSpeed: 0.1,
  panSpeed: 0.002,
  enableTouch: true,
};

export class CameraController {
  private camera: OrbitCamera;
  private canvas: HTMLCanvasElement;
  private options: Required<ControllerOptions>;

  private isDragging = false;
  private isPanning = false;
  private lastMouse: [number, number] = [0, 0];

  // Touch handling
  private lastTouchDistance = 0;
  private lastTouchCenter: [number, number] = [0, 0];
  private activeTouches: Touch[] = [];

  // Bound event handlers for cleanup
  private boundHandlers: {
    mousedown: (e: MouseEvent) => void;
    mousemove: (e: MouseEvent) => void;
    mouseup: (e: MouseEvent) => void;
    wheel: (e: WheelEvent) => void;
    contextmenu: (e: Event) => void;
    touchstart: (e: TouchEvent) => void;
    touchmove: (e: TouchEvent) => void;
    touchend: (e: TouchEvent) => void;
  };

  constructor(camera: OrbitCamera, canvas: HTMLCanvasElement, options: ControllerOptions = {}) {
    this.camera = camera;
    this.canvas = canvas;
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Bind handlers
    this.boundHandlers = {
      mousedown: this.onMouseDown.bind(this),
      mousemove: this.onMouseMove.bind(this),
      mouseup: this.onMouseUp.bind(this),
      wheel: this.onWheel.bind(this),
      contextmenu: (e: Event) => e.preventDefault(),
      touchstart: this.onTouchStart.bind(this),
      touchmove: this.onTouchMove.bind(this),
      touchend: this.onTouchEnd.bind(this),
    };

    this.attachListeners();
  }

  /**
   * Attach event listeners to canvas.
   */
  private attachListeners(): void {
    const { canvas, boundHandlers } = this;

    canvas.addEventListener("mousedown", boundHandlers.mousedown);
    window.addEventListener("mousemove", boundHandlers.mousemove);
    window.addEventListener("mouseup", boundHandlers.mouseup);
    canvas.addEventListener("wheel", boundHandlers.wheel, { passive: false });
    canvas.addEventListener("contextmenu", boundHandlers.contextmenu);

    if (this.options.enableTouch) {
      canvas.addEventListener("touchstart", boundHandlers.touchstart, { passive: false });
      canvas.addEventListener("touchmove", boundHandlers.touchmove, { passive: false });
      canvas.addEventListener("touchend", boundHandlers.touchend);
    }
  }

  /**
   * Remove event listeners and clean up.
   */
  dispose(): void {
    const { canvas, boundHandlers } = this;

    canvas.removeEventListener("mousedown", boundHandlers.mousedown);
    window.removeEventListener("mousemove", boundHandlers.mousemove);
    window.removeEventListener("mouseup", boundHandlers.mouseup);
    canvas.removeEventListener("wheel", boundHandlers.wheel);
    canvas.removeEventListener("contextmenu", boundHandlers.contextmenu);

    if (this.options.enableTouch) {
      canvas.removeEventListener("touchstart", boundHandlers.touchstart);
      canvas.removeEventListener("touchmove", boundHandlers.touchmove);
      canvas.removeEventListener("touchend", boundHandlers.touchend);
    }
  }

  // Mouse handlers

  private onMouseDown(e: MouseEvent): void {
    this.isDragging = true;
    // Right-click or middle-click or shift+click = pan
    this.isPanning = e.button === 2 || e.button === 1 || e.shiftKey;
    this.lastMouse = [e.clientX, e.clientY];
    this.canvas.style.cursor = this.isPanning ? "move" : "grabbing";
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.isDragging) return;

    const dx = e.clientX - this.lastMouse[0];
    const dy = e.clientY - this.lastMouse[1];
    this.lastMouse = [e.clientX, e.clientY];

    if (this.isPanning) {
      this.camera.pan(dx * this.options.panSpeed, dy * this.options.panSpeed);
    } else {
      this.camera.orbit(-dx * this.options.orbitSpeed, -dy * this.options.orbitSpeed);
    }
  }

  private onMouseUp(): void {
    this.isDragging = false;
    this.isPanning = false;
    this.canvas.style.cursor = "grab";
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const delta = -e.deltaY * this.options.zoomSpeed * 0.01;
    this.camera.zoom(delta);
  }

  // Touch handlers

  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    this.activeTouches = Array.from(e.touches);

    if (this.activeTouches.length === 1) {
      // Single touch = orbit
      this.lastMouse = [this.activeTouches[0].clientX, this.activeTouches[0].clientY];
    } else if (this.activeTouches.length === 2) {
      // Two fingers = pinch zoom and pan
      this.lastTouchDistance = this.getTouchDistance();
      this.lastTouchCenter = this.getTouchCenter();
    }
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    this.activeTouches = Array.from(e.touches);

    if (this.activeTouches.length === 1) {
      // Single touch = orbit
      const touch = this.activeTouches[0];
      const dx = touch.clientX - this.lastMouse[0];
      const dy = touch.clientY - this.lastMouse[1];
      this.lastMouse = [touch.clientX, touch.clientY];

      this.camera.orbit(-dx * this.options.orbitSpeed, -dy * this.options.orbitSpeed);
    } else if (this.activeTouches.length === 2) {
      // Pinch to zoom
      const newDistance = this.getTouchDistance();
      const zoomDelta = (newDistance - this.lastTouchDistance) * 0.01;
      this.camera.zoom(zoomDelta);
      this.lastTouchDistance = newDistance;

      // Pan with two fingers
      const newCenter = this.getTouchCenter();
      const dx = newCenter[0] - this.lastTouchCenter[0];
      const dy = newCenter[1] - this.lastTouchCenter[1];
      this.camera.pan(dx * this.options.panSpeed, dy * this.options.panSpeed);
      this.lastTouchCenter = newCenter;
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    this.activeTouches = Array.from(e.touches);

    if (this.activeTouches.length === 1) {
      this.lastMouse = [this.activeTouches[0].clientX, this.activeTouches[0].clientY];
    } else if (this.activeTouches.length === 2) {
      this.lastTouchDistance = this.getTouchDistance();
      this.lastTouchCenter = this.getTouchCenter();
    }
  }

  private getTouchDistance(): number {
    if (this.activeTouches.length < 2) return 0;
    const dx = this.activeTouches[1].clientX - this.activeTouches[0].clientX;
    const dy = this.activeTouches[1].clientY - this.activeTouches[0].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private getTouchCenter(): [number, number] {
    if (this.activeTouches.length < 2) {
      return this.activeTouches.length === 1
        ? [this.activeTouches[0].clientX, this.activeTouches[0].clientY]
        : [0, 0];
    }
    return [
      (this.activeTouches[0].clientX + this.activeTouches[1].clientX) / 2,
      (this.activeTouches[0].clientY + this.activeTouches[1].clientY) / 2,
    ];
  }
}
