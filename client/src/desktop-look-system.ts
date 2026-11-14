/**
 * ENGRAM — flat-screen look control.
 *
 * The observatory is composed for a seated person who turns their head:
 * the inspector, the containment console, the counterfactual chamber and
 * the verification instrument sit at roughly 40-60 degrees to either
 * side. In a headset that is one comfortable glance. On a flat screen
 * there is no head, so those consoles fell outside the frame and several
 * operations could not be reached at all — the audit's first-severity
 * defect.
 *
 * This gives a flat-screen viewer the same degree of freedom and nothing
 * more: drag (or arrow keys) turns the view, within the same seated
 * comfort cone a person would use. It never moves the viewer, so every
 * distance and angle the composition relies on still holds, and it is
 * inert while an immersive session is presenting, where the headset owns
 * the camera. Presentation only: it reads no MNEME data and changes none.
 */
import { createSystem, Grabbed, MathUtils, Pressed } from '@iwsdk/core';

const YAW_LIMIT = MathUtils.degToRad(100);
const PITCH_LIMIT = MathUtils.degToRad(26);
// Screen pixels to radians, calibrated so a drag across most of a 1080p
// window turns about 70 degrees: far enough to bring a side console to
// centre in one gesture, slow enough to stop on a button.
const DRAG_SENSITIVITY = 0.0013;
const KEY_SPEED = MathUtils.degToRad(70);
// A press that moves less than this stays a click, so selecting a memory
// by clicking it keeps working exactly as before.
const DRAG_THRESHOLD_PX = 6;

export class DesktopLookSystem extends createSystem({
  // A press that landed on something is that object's press, not a look.
  held: { required: [Grabbed] },
  pressed: { required: [Pressed] },
}) {
  private yaw = 0;
  private pitch = 0;
  private baseYaw = 0;
  private basePitch = 0;
  private captured = false;
  private dragging = false;
  /** Set once per drag, one frame after the press, from whether the press
   * landed on an interactable. Dragging a memory core carries the core;
   * dragging the room turns the view. The two must never happen at once. */
  private blocked: boolean | null = null;
  private moved = 0;
  private lastX = 0;
  private lastY = 0;
  private keys = new Set<string>();

  init(): void {
    const canvas = this.world.renderer.domElement;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || this.presenting()) return;
      this.dragging = true;
      this.blocked = null;
      this.moved = 0;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      if (!this.dragging || this.presenting()) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.moved += Math.abs(dx) + Math.abs(dy);
      if (this.moved < DRAG_THRESHOLD_PX || this.blocked !== false) return;
      this.capture();
      this.yaw = clamp(this.yaw - dx * DRAG_SENSITIVITY, -YAW_LIMIT, YAW_LIMIT);
      this.pitch = clamp(this.pitch - dy * DRAG_SENSITIVITY, -PITCH_LIMIT, PITCH_LIMIT);
      this.apply();
    };
    const onUp = () => { this.dragging = false; this.blocked = null; };
    const onKeyDown = (e: KeyboardEvent) => {
      if (LOOK_KEYS.has(e.key)) { this.keys.add(e.key); e.preventDefault(); }
      if (e.key === 'Home') { this.yaw = 0; this.pitch = 0; this.capture(); this.apply(); }
    };
    const onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key);

    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    this.cleanupFuncs.push(
      () => canvas.removeEventListener('pointerdown', onDown),
      () => window.removeEventListener('pointermove', onMove),
      () => window.removeEventListener('pointerup', onUp),
      () => window.removeEventListener('keydown', onKeyDown),
      () => window.removeEventListener('keyup', onKeyUp),
    );
  }

  update(delta: number): void {
    // Resolve, one frame after the press, whether this drag belongs to an
    // object. The pointer-events system has by then tagged what was hit.
    if (this.dragging && this.blocked === null) {
      this.blocked = this.queries.held.entities.size > 0
        || this.queries.pressed.entities.size > 0;
    }
    if (this.keys.size === 0 || this.presenting()) return;
    const step = KEY_SPEED * delta;
    if (this.keys.has('ArrowLeft')) this.yaw += step;
    if (this.keys.has('ArrowRight')) this.yaw -= step;
    if (this.keys.has('ArrowUp')) this.pitch += step * 0.6;
    if (this.keys.has('ArrowDown')) this.pitch -= step * 0.6;
    this.yaw = clamp(this.yaw, -YAW_LIMIT, YAW_LIMIT);
    this.pitch = clamp(this.pitch, -PITCH_LIMIT, PITCH_LIMIT);
    this.capture();
    this.apply();
  }

  /** True while an immersive session is presenting: the headset's pose is
   * then the only thing allowed to move the camera. */
  private presenting(): boolean {
    return this.world.session !== undefined;
  }

  /** The authored hero view is applied after level load, so the rest pose
   * is taken from wherever the camera is at the first look input. */
  private capture(): void {
    if (this.captured) return;
    const camera = this.world.camera;
    camera.rotation.reorder('YXZ');
    this.baseYaw = camera.rotation.y;
    this.basePitch = camera.rotation.x;
    this.captured = true;
  }

  private apply(): void {
    const camera = this.world.camera;
    camera.rotation.order = 'YXZ';
    camera.rotation.y = this.baseYaw + this.yaw;
    camera.rotation.x = this.basePitch + this.pitch;
    camera.rotation.z = 0;
  }
}

const LOOK_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
