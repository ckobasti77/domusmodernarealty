import * as THREE from "three";
import { SparkRenderer, SplatFileType, SplatMesh } from "@sparkjsdev/spark";
import { maxPixelRatio, type WalkTier } from "@/lib/tours/device";
import { clampToPolygon, pointInPolygon, snapInside, type Polygon, type Vec2 } from "@/lib/tours/floor";
import { resolveSplatSource, type SparkFileType } from "@/lib/tours/splat-source";
import type { WalkAsset, WalkData } from "../types";

/**
 * The splat walkthrough without React (docs/06-3D-TOURS.md): a three.js
 * renderer with Spark's `SparkRenderer`, a first-person camera on the floor
 * plane, and every input the visitor can use: WASD / arrows, mouse-drag look,
 * a touch joystick, click/tap-to-walk on the floor and room hotspots.
 *
 * World frame: Y up. Scans come in the 3DGS/COLMAP convention (Y down), so the
 * mesh is turned 180° about X, exactly as Spark's examples do. The floor is
 * the plane y = spawn.y; `eyeHeight` is in model units (1.6 m in a metric
 * scan), and the walking speed of 1.2 m/s is scaled by the same factor.
 */

export type EnginePhase = "download" | "process" | "ready";

export type EngineCallbacks = {
  onProgress: (loaded: number, total: number) => void;
  onPhase: (phase: EnginePhase) => void;
  onError: (kind: "load" | "context") => void;
  /** The FPS guard ran out of cheaper settings: suggest the 360° tour. */
  onSlow: () => void;
  /** The visitor walked away from the room they last jumped to. */
  onLeaveRoom: () => void;
};

export type EngineOptions = {
  walk: WalkData;
  asset: WalkAsset;
  tier: WalkTier;
  reducedMotion: boolean;
};

const EYE_METRES = 1.6;
const WALK_MPS = 1.2;
const TURN_RADIANS_PER_SECOND = 1.6;
const LOOK_RADIANS_PER_PIXEL = 0.0042;
const MAX_PITCH = THREE.MathUtils.degToRad(80);
const INITIAL_PITCH = THREE.MathUtils.degToRad(-6);
/** Vertical field of view; wider distorts the room at the edges. */
const FOV_DEGREES = 60;
/** A pointer that moved less than this between down and up is a click, not a drag. */
const CLICK_SLOP_PX = 6;
/** Frame-time guard: median over the window above the budget triggers the next step. */
const GUARD_WINDOW_MS = 2000;
const GUARD_BUDGET_MS = 33;
const GUARD_WARMUP_MS = 3000;

const FILE_TYPE: Record<SparkFileType, SplatFileType> = {
  ply: SplatFileType.PLY,
  spz: SplatFileType.SPZ,
  splat: SplatFileType.SPLAT,
  ksplat: SplatFileType.KSPLAT,
  pcsogszip: SplatFileType.PCSOGSZIP,
};

function shortestAngle(from: number, to: number): number {
  return THREE.MathUtils.euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI;
}

export class WalkEngine {
  private readonly container: HTMLElement;
  private readonly options: EngineOptions;
  private readonly callbacks: EngineCallbacks;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly spark: SparkRenderer;
  private readonly cursor: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly raycaster = new THREE.Raycaster();
  private readonly floorPlane: THREE.Plane;
  private readonly abort = new AbortController();
  private readonly resizeObserver: ResizeObserver;
  private readonly clock = new THREE.Timer();
  private mesh: SplatMesh | null = null;

  private readonly polygon: Polygon | undefined;
  private readonly floorY: number;
  private readonly eye: number;
  private readonly speed: number;
  private position: Vec2;
  private yaw: number;
  /** People look slightly down while walking; a level view shows mostly ceiling. */
  private pitch = INITIAL_PITCH;

  private readonly keys = new Set<string>();
  private joystick = { x: 0, y: 0 };
  private target: { x: number; z: number; yaw?: number } | null = null;
  private drag: { id: number; x: number; y: number; startX: number; startY: number; moved: boolean } | null =
    null;

  private atRoom = false;
  private running = false;
  private disposed = false;
  private pixelRatio: number;
  private frameTimes: { at: number; ms: number }[] = [];
  private guardStep = 0;
  private guardSince = 0;

  constructor(container: HTMLElement, options: EngineOptions, callbacks: EngineCallbacks) {
    this.container = container;
    this.options = options;
    this.callbacks = callbacks;
    const { walk } = options;

    this.polygon = walk.floorPolygon !== undefined && walk.floorPolygon.length >= 3 ? walk.floorPolygon : undefined;
    this.floorY = walk.spawn.y;
    this.eye = walk.eyeHeight;
    this.speed = WALK_MPS * (walk.eyeHeight / EYE_METRES);
    this.position = snapInside({ x: walk.spawn.x, z: walk.spawn.z }, this.polygon);
    this.yaw = walk.spawn.yaw;
    this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.floorY);

    // Spark: antialiasing does not help splats and costs a lot.
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, maxPixelRatio(options.tier));
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setClearColor(0x0e0d0b);
    const canvas = this.renderer.domElement;
    canvas.className = "block size-full touch-none select-none outline-none";
    canvas.setAttribute("aria-hidden", "true");
    container.appendChild(canvas);

    this.camera = new THREE.PerspectiveCamera(FOV_DEGREES, 1, Math.max(0.02, this.eye * 0.02), this.eye * 120);
    this.spark = new SparkRenderer({ renderer: this.renderer });
    // Phones and light devices get a smaller splat budget from the start.
    if (options.tier === "light") this.spark.lodSplatScale = 0.6;
    this.scene.add(this.spark);

    const ringRadius = this.eye * 0.09;
    this.cursor = new THREE.Mesh(
      new THREE.RingGeometry(ringRadius * 0.72, ringRadius, 48),
      new THREE.MeshBasicMaterial({ color: 0xb08d57, side: THREE.DoubleSide }),
    );
    this.cursor.rotation.x = -Math.PI / 2;
    this.cursor.position.y = this.floorY + this.eye * 0.004;
    this.cursor.visible = false;
    this.scene.add(this.cursor);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.syncCamera();

    canvas.addEventListener("webglcontextlost", this.onContextLost);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerCancel);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
  }

  /** Downloads and decodes the model, then starts the render loop. */
  async load(): Promise<void> {
    const { asset } = this.options;
    try {
      this.callbacks.onPhase("download");
      const source = await resolveSplatSource(
        asset.url,
        asset.format,
        this.abort.signal,
        (loaded, total) => this.callbacks.onProgress(loaded, total),
        asset.bytes,
      );
      if (this.disposed) return;
      this.callbacks.onPhase("process");
      const fileType = FILE_TYPE[source.fileType];
      const mesh =
        source.kind === "bytes"
          ? new SplatMesh({ fileBytes: source.bytes, fileType, lod: true })
          : new SplatMesh({
              url: source.url,
              fileType,
              lod: true,
              onProgress: (event) => {
                if (event.lengthComputable) this.callbacks.onProgress(event.loaded, event.total);
              },
            });
      mesh.quaternion.set(1, 0, 0, 0);
      this.mesh = mesh;
      this.scene.add(mesh);
      await mesh.initialized;
      if (this.disposed) return;
      this.callbacks.onPhase("ready");
      this.start();
    } catch (error) {
      if (this.disposed || this.abort.signal.aborted) return;
      console.error("[walk3d] load failed:", error);
      this.callbacks.onError("load");
    }
  }

  /** Teleport (reduced motion) or walk to a room hotspot. */
  goTo(x: number, z: number, yaw: number): void {
    this.atRoom = true;
    const spot = snapInside({ x, z }, this.polygon);
    if (this.options.reducedMotion) {
      this.position = spot;
      this.yaw = yaw;
      this.pitch = INITIAL_PITCH;
      this.target = null;
      return;
    }
    this.target = { ...spot, yaw };
  }

  /** Joystick input, each axis in [-1, 1]; y > 0 walks forward. */
  setJoystick(x: number, y: number): void {
    this.joystick = { x, y };
    if (x !== 0 || y !== 0) this.target = null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.running = false;
    this.abort.abort();
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("webglcontextlost", this.onContextLost);
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointercancel", this.onPointerCancel);
    canvas.removeEventListener("pointerleave", this.onPointerLeave);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);

    if (this.mesh !== null) {
      this.scene.remove(this.mesh);
      this.mesh.dispose();
      this.mesh = null;
    }
    this.cursor.geometry.dispose();
    this.cursor.material.dispose();
    this.spark.dispose();
    this.scene.clear();
    this.renderer.dispose();
    // Phones keep a lost tab's GPU memory until the context is gone for good.
    this.renderer.forceContextLoss();
    canvas.remove();
  }

  /* ------------------------------------------------------------------ loop */

  private start(): void {
    if (this.running || this.disposed) return;
    this.running = true;
    this.clock.reset();
    this.guardSince = performance.now() + GUARD_WARMUP_MS;
    this.renderer.setAnimationLoop(this.frame);
  }

  private readonly frame = (time: number): void => {
    this.clock.update(time);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.step(dt);
    this.syncCamera();
    this.renderer.render(this.scene, this.camera);
    this.guard(dt * 1000);
  };

  private step(dt: number): void {
    const keys = this.keys;
    const forward =
      (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) + this.joystick.y;
    const strafe = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0) + this.joystick.x;
    const turn = (keys.has("ArrowLeft") ? 1 : 0) - (keys.has("ArrowRight") ? 1 : 0);
    if (turn !== 0) this.yaw += turn * TURN_RADIANS_PER_SECOND * dt;

    if (forward !== 0 || strafe !== 0) {
      this.target = null;
      this.leaveRoom();
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      let dx = -sin * forward + cos * strafe;
      let dz = -cos * forward - sin * strafe;
      const length = Math.hypot(dx, dz);
      if (length > 1) {
        dx /= length;
        dz /= length;
      }
      this.moveTo({ x: this.position.x + dx * this.speed * dt, z: this.position.z + dz * this.speed * dt });
      return;
    }

    const target = this.target;
    if (target === null) return;
    const dx = target.x - this.position.x;
    const dz = target.z - this.position.z;
    const distance = Math.hypot(dx, dz);
    const stepLength = this.speed * 1.5 * dt;
    if (distance <= stepLength) {
      this.moveTo({ x: target.x, z: target.z });
    } else {
      this.moveTo({ x: this.position.x + (dx / distance) * stepLength, z: this.position.z + (dz / distance) * stepLength });
    }
    if (target.yaw !== undefined) {
      const delta = shortestAngle(this.yaw, target.yaw);
      this.yaw += Math.sign(delta) * Math.min(Math.abs(delta), TURN_RADIANS_PER_SECOND * 1.5 * dt);
      this.pitch += (INITIAL_PITCH - this.pitch) * Math.min(1, dt * 4);
    }
    const arrived = distance <= stepLength && (target.yaw === undefined || Math.abs(shortestAngle(this.yaw, target.yaw)) < 1e-3);
    if (arrived) this.target = null;
  }

  private leaveRoom(): void {
    if (!this.atRoom) return;
    this.atRoom = false;
    this.callbacks.onLeaveRoom();
  }

  private moveTo(next: Vec2): void {
    this.position = clampToPolygon(this.position, next, this.polygon);
  }

  private syncCamera(): void {
    this.camera.position.set(this.position.x, this.floorY + this.eye, this.position.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }

  private resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Runtime FPS guard: when the median frame time stays above 33 ms for 2 s,
   * lower the pixel ratio, then the splat budget, then suggest the 360° tour.
   */
  private guard(frameMs: number): void {
    const now = performance.now();
    if (now < this.guardSince) return;
    this.frameTimes.push({ at: now, ms: frameMs });
    while (this.frameTimes.length > 0 && this.frameTimes[0].at < now - GUARD_WINDOW_MS) this.frameTimes.shift();
    if (now - this.guardSince < GUARD_WINDOW_MS || this.frameTimes.length < 10) return;

    const sorted = this.frameTimes.map((frame) => frame.ms).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    if (median <= GUARD_BUDGET_MS) return;

    this.guardStep += 1;
    this.frameTimes = [];
    this.guardSince = now;
    if (this.guardStep === 1 && this.pixelRatio > 1) {
      this.pixelRatio = Math.max(1, this.pixelRatio * 0.66);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.resize();
    } else if (this.guardStep <= 2) {
      this.spark.lodSplatScale = Math.max(0.25, this.spark.lodSplatScale * 0.5);
    } else if (this.guardStep === 3) {
      this.callbacks.onSlow();
    }
  }

  /* ----------------------------------------------------------------- input */

  private floorPointAt(clientX: number, clientY: number): Vec2 | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.floorPlane, new THREE.Vector3());
    if (hit === null) return null;
    if (hit.distanceTo(this.camera.position) > this.eye * 12) return null;
    const point = { x: hit.x, z: hit.z };
    if (this.polygon !== undefined && !pointInPolygon(point, this.polygon)) return null;
    return point;
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (this.drag !== null || (event.pointerType === "mouse" && event.button !== 0)) return;
    this.renderer.domElement.setPointerCapture(event.pointerId);
    this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false };
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const drag = this.drag;
    if (drag === null || drag.id !== event.pointerId) {
      if (event.pointerType === "mouse") this.updateCursor(event.clientX, event.clientY);
      return;
    }
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > CLICK_SLOP_PX) drag.moved = true;
    if (!drag.moved) return;
    this.cursor.visible = false;
    this.target = null;
    this.yaw += (event.clientX - drag.x) * LOOK_RADIANS_PER_PIXEL;
    this.pitch = THREE.MathUtils.clamp(this.pitch + (event.clientY - drag.y) * LOOK_RADIANS_PER_PIXEL, -MAX_PITCH, MAX_PITCH);
    drag.x = event.clientX;
    drag.y = event.clientY;
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const drag = this.drag;
    if (drag === null || drag.id !== event.pointerId) return;
    this.drag = null;
    if (drag.moved) return;
    const point = this.floorPointAt(event.clientX, event.clientY);
    if (point === null) return;
    this.leaveRoom();
    if (this.options.reducedMotion) {
      this.position = point;
      this.target = null;
    } else {
      this.target = point;
    }
  };

  private readonly onPointerCancel = (event: PointerEvent): void => {
    if (this.drag?.id === event.pointerId) this.drag = null;
  };

  private readonly onPointerLeave = (): void => {
    this.cursor.visible = false;
  };

  private updateCursor(clientX: number, clientY: number): void {
    const point = this.floorPointAt(clientX, clientY);
    this.cursor.visible = point !== null;
    if (point !== null) this.cursor.position.set(point.x, this.cursor.position.y, point.z);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
    const code = event.code;
    if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(code)) {
      event.preventDefault();
      this.keys.add(code);
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly onBlur = (): void => {
    this.keys.clear();
    this.joystick = { x: 0, y: 0 };
  };

  private readonly onContextLost = (): void => {
    this.running = false;
    this.renderer.setAnimationLoop(null);
    this.callbacks.onError("context");
  };
}
