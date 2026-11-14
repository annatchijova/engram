/**
 * ENGRAM — spatial guide. Marks, in the room, the one object the current
 * question is answered with: a slow-breathing white ring plus a short
 * label ("START HERE", "NEXT"), placed on a memory core, above a console,
 * or over a zone. Pure presentation: white is no custody colour, the ring
 * carries no evidence meaning, and it disappears the moment the stage it
 * belongs to is passed or the tour is left.
 */
import {
  Color,
  ConeGeometry,
  createSystem,
  Entity,
  Group,
  Mesh,
  MeshStandardMaterial,
  Sprite,
  TorusGeometry,
  UIKitMLAsset,
  Vector3,
} from '@iwsdk/core';
import { FieldSystem } from './field-system.js';
import { disposeLabel, makeLabel } from './observatory/labels.js';
import { OBS, OBSERVATORY } from './observatory/palette.js';
import { OnboardingStageValue } from './onboarding-stage-machine.js';
import { GuideTarget, TOUR } from './tour-script.js';
import { TourState } from './tour-state.js';

const RING_GEO = new TorusGeometry(0.15, 0.007, 10, 56);
// A pointer that cannot be mistaken for evidence: white, cone-shaped,
// aimed down at the one object the current question is answered with.
// The audit found the QUARANTINED containment cage out-competing the
// tour's target, so the marker needs a form of its own rather than more
// brightness, which in this room is never allowed to mean anything.
const CONE_GEO = new ConeGeometry(0.035, 0.08, 4);

export class GuideSystem extends createSystem({}) {
  private entity: Entity | null = null;
  private group: Group | null = null;
  private ring: Mesh | null = null;
  private cone: Mesh | null = null;
  private label: Sprite | null = null;
  private target: GuideTarget = { kind: 'none' };
  private coneBase = 0;
  private material = new MeshStandardMaterial({
    color: new Color(OBS.hover), emissive: new Color(OBS.hover), emissiveIntensity: 1.0,
    transparent: true, opacity: 0.9,
  });
  private scratch = new Vector3();

  init(): void {
    this.cleanupFuncs.push(TourState.subscribe((stage) => this.apply(stage)));
    this.apply(TourState.get());
  }

  update(delta: number, time: number): void {
    if (!this.group || !this.ring) return;
    const pulse = 1 + Math.sin(time * 2.2) * 0.06;
    this.ring.scale.setScalar(pulse);
    this.ring.rotation.z += delta * 0.5;
    this.material.emissiveIntensity = 0.8 + Math.sin(time * 2.2) * 0.3;
    if (this.cone) {
      this.cone.position.y = this.coneBase + Math.sin(time * 2.6) * 0.022;
      this.cone.rotation.y += delta * 0.9;
    }
    if (this.target.kind === 'core') {
      // Follow the core even if a hand moved it.
      const field = this.world.getSystem(FieldSystem);
      if (field?.getCoreWorldPosition(this.target.memoryId, this.scratch)) {
        this.group.position.copy(this.scratch);
      }
    }
  }

  private clear(): void {
    if (this.label) disposeLabel(this.label);
    this.label = null;
    this.entity?.dispose();
    this.entity = null;
    this.group = null;
    this.ring = null;
    this.cone = null;
    this.target = { kind: 'none' };
  }

  private apply(stage: string): void {
    this.clear();
    const step = TOUR[stage];
    if (!step || stage === OnboardingStageValue.COMPLETE || step.target.kind === 'none') return;
    const pos = this.resolve(step.target);
    if (!pos) return;
    this.target = step.target;
    const onCore = step.target.kind === 'core';
    const group = new Group();
    const ring = new Mesh(RING_GEO, this.material);
    ring.rotation.x = Math.PI / 2;
    // On a memory core the ring sits at its base, so the mark reads as
    // "this object", not as something hovering near it.
    ring.position.y = onCore ? -0.26 : 0;
    group.add(ring);
    let cone: Mesh | null = null;
    if (onCore) {
      cone = new Mesh(CONE_GEO, this.material);
      cone.rotation.x = Math.PI;
      this.coneBase = 0.16;
      cone.position.y = this.coneBase;
      group.add(cone);
    }
    // Naming the target removes the last ambiguity: the brightest object
    // on the bench is a QUARANTINED memory in its containment cage, which
    // competed with the marker for a newcomer's attention.
    const head = stage === OnboardingStageValue.DISCOVER ? 'START HERE' : 'NEXT';
    const label = makeLabel(
      [{ text: onCore ? `${head}: ${step.target.kind === 'core' ? step.target.memoryId : ''}` : head,
         color: OBS.hover, size: 38, weight: '800' },
       { text: step.action, color: '#e8f0f8', size: 24 }],
      { width: 0.56, background: '#070b12f2', border: '#ffffffaa' },
    );
    label.position.y = onCore ? 0.3 : 0.11;
    group.add(label);
    group.position.copy(pos);
    this.label = label;
    this.ring = ring;
    this.cone = cone;
    this.group = group;
    this.entity = this.world.createTransformEntity(group);
  }

  private resolve(target: GuideTarget): Vector3 | null {
    if (target.kind === 'core') {
      const field = this.world.getSystem(FieldSystem);
      const p = field?.getCoreWorldPosition(target.memoryId, this.scratch);
      // The field may still be loading; the per-frame follow fixes it up.
      return p ? p.clone() : new Vector3(-0.37, 1.08, -1.44);
    }
    if (target.kind === 'panel') {
      const panel = this.world.getSceneObject<UIKitMLAsset>(target.panelId) as unknown as
        { position?: Vector3; parent?: { position?: Vector3 } } | undefined;
      const obj = panel as unknown as { getWorldPosition?: (v: Vector3) => Vector3 } | undefined;
      if (obj?.getWorldPosition) {
        const p = obj.getWorldPosition(new Vector3());
        return p.setY(p.y + 0.32);
      }
      return null;
    }
    if (target.kind === 'zone') {
      const z = OBSERVATORY[target.zone];
      return new Vector3(z.x, (z as { y: number }).y + (target.zone === 'cradle' ? 0.62 : 1.2), z.z);
    }
    return null;
  }
}
