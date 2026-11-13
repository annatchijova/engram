/**
 * ENGRAM — Nivel 2 Audited Containment: the intervention station.
 *
 * Stage -> Commit, never collapsed into one gesture (see
 * ENGRAM-ARCHITECTURAL-INVESTIGATION.md §4): Stage only calls the
 * read-only preview endpoint; Commit is a separate, explicit click that
 * calls the one mutating endpoint in the whole system
 * (POST /api/v1/actors/{id}/quarantine). Cancel never touches the server.
 *
 * Two ways to stage, one meaning:
 *  - the console button stages the demo target actor;
 *  - an actor totem physically placed in the intervention cradle stages
 *    that actor, matching the doc's Stage grammar ("tomar una entidad y
 *    colocarla en un espacio de operación ... todavía ninguna mutación").
 * Dropping a totem is explicitly NOT a commit: the doc lists "soltar para
 * ejecutar una mutación" among the gestures that must not exist. Lifting
 * the totem out of the cradle cancels the staged preview.
 *
 * While a preview is staged, every memory the server said WOULD be
 * flagged wears an amber wireframe PREVIEW ring on the field. That ring is
 * deliberately not a custody material: nothing has changed in MNEME, and
 * the real recolor only happens after Commit, when FieldSystem.refresh()
 * re-reads the field.
 */
import {
  Color,
  createSystem,
  CylinderGeometry,
  Entity,
  Grabbed,
  Group,
  Mesh,
  MeshStandardMaterial,
  Sprite,
  TorusGeometry,
  UIKitMLAsset,
  Vector3,
} from '@iwsdk/core';
import { ActorSystem } from './actor-system.js';
import { EngramApi } from './engram-api.js';
import { FieldSystem } from './field-system.js';
import { InterventionStore } from './intervention-store.js';
import { AudioCues } from './observatory/audio-cues.js';
import { disposeLabel, makeLabel } from './observatory/labels.js';
import { OBS, OBSERVATORY } from './observatory/palette.js';
import { requireElement } from './observatory/wiring.js';
import { OnboardingEvents } from './onboarding-events.js';
import { SessionStore } from './session.js';

/** The console button's target. The cradle can stage any actor the rack
 * shows; MNEME's own authority gate decides what a commit may do. */
const DEFAULT_TARGET_ACTOR_ID = 'pipeline-logs';
const STAGED_RING_GEO = new TorusGeometry(0.12, 0.004, 8, 48);
const DOCK_RADIUS = 0.26;

type StagedMark = { entity: Entity; object: Mesh | Sprite; memoryId: string; isLabel: boolean };

export class ContainmentSystem extends createSystem({}) {
  private stagedCount = 0;
  private stagedActorId: string | null = null;
  // Nivel 5 — captured at Stage time, sent back at Commit, so the server
  // can reject a Commit staged against a field that has since moved
  // (stale-snapshot precondition) rather than blindly applying it.
  private stagedFieldVersion = 0;
  private marks: StagedMark[] = [];
  private stagedMaterial = new MeshStandardMaterial({
    color: new Color(OBS.staged), emissive: new Color(OBS.staged), emissiveIntensity: 1.2,
    wireframe: true, transparent: true, opacity: 0.9,
  });
  private cradleRingMaterial = new MeshStandardMaterial({
    color: new Color(OBS.containment), emissive: new Color(OBS.containment),
    emissiveIntensity: 0.4, transparent: true, opacity: 0.9,
  });
  private cradleSlot = new Vector3(OBSERVATORY.cradle.x, OBSERVATORY.cradle.y, OBSERVATORY.cradle.z);
  private cradleLabel: Sprite | null = null;
  private cradleStatus: Sprite | null = null;
  private cradleStatusEntity: Entity | null = null;
  private dockedActorId: string | null = null;
  private showCommitControls: ((visible: boolean) => void) | null = null;
  // A finished commit (or a refusal) must survive the undock that follows
  // it: FieldSystem.refresh() rebuilds the actor rack, which lifts the
  // totem out of the cradle, and the operator would otherwise watch the
  // outcome message disappear a frame after the sweep they just authorized.
  private lastOutcome: 'none' | 'committed' | 'refused' = 'none';
  private scratch = new Vector3();
  private busy = false;

  init(): void {
    this.buildCradle();

    const panel = this.world.getSceneObject<UIKitMLAsset>('containment-panel');
    if (!panel) return;

    const hint = panel.getElementById('containment-hint');
    const stageBtn = requireElement(panel, 'containment-panel', 'stage-btn');
    const commitBtn = requireElement(panel, 'containment-panel', 'commit-btn');
    const cancelBtn = requireElement(panel, 'containment-panel', 'cancel-btn');

    const updateHint = () => {
      const session = SessionStore.get();
      hint?.setProperties({
        text: session
          ? `logged in as ${session.displayName} (${session.effectiveCapabilities.join(', ')})`
          : 'log in (console above) to commit; staging a preview needs no session',
      });
    };
    updateHint();
    this.cleanupFuncs.push(SessionStore.subscribe(updateHint));

    const onStage = () => void this.stage(DEFAULT_TARGET_ACTOR_ID);
    const onCommit = () => void this.commit();
    const onCancel = () => this.cancel(true);

    stageBtn?.addEventListener('click', onStage);
    commitBtn?.addEventListener('click', onCommit);
    cancelBtn?.addEventListener('click', onCancel);
    this.cleanupFuncs.push(
      () => stageBtn?.removeEventListener('click', onStage),
      () => commitBtn?.removeEventListener('click', onCommit),
      () => cancelBtn?.removeEventListener('click', onCancel),
    );
  }

  update(delta: number, time: number): void {
    const field = this.world.getSystem(FieldSystem);
    this.stagedMaterial.opacity = 0.6 + Math.sin(time * 3) * 0.3;
    for (const m of this.marks) {
      if (field?.getCoreWorldPosition(m.memoryId, this.scratch)) {
        if (m.isLabel) {
          m.object.position.set(this.scratch.x, this.scratch.y - 0.235, this.scratch.z + 0.06);
        } else {
          m.object.position.copy(this.scratch);
          m.object.rotation.z += delta * 0.6;
        }
      }
    }

    // Docking test: a released totem resting in the cradle stages that
    // actor's preview; lifting it out cancels. Only ever the read-only
    // preview endpoint — a drop can never commit.
    const actors = this.world.getSystem(ActorSystem);
    if (!actors) return;
    let nearest: { actorId: string; distance: number } | null = null;
    for (const t of actors.getTotems()) {
      if (t.entity.hasComponent(Grabbed)) continue;
      t.group.getWorldPosition(this.scratch);
      const distance = this.scratch.distanceTo(this.cradleSlot);
      if (distance <= DOCK_RADIUS && (!nearest || distance < nearest.distance)) {
        nearest = { actorId: t.actorId, distance };
      }
    }
    // A docked totem is seated in the cradle: it eases to the slot so the
    // dock cannot flicker when a release lands near the radius edge.
    if (this.dockedActorId) {
      const seated = actors.getTotems().find((t) => t.actorId === this.dockedActorId);
      if (seated && !seated.entity.hasComponent(Grabbed)) {
        seated.group.position.lerp(this.cradleSlot, 1 - Math.exp(-delta * 8));
      }
    }
    const nowDocked = nearest?.actorId ?? null;
    if (nowDocked !== this.dockedActorId) {
      this.dockedActorId = nowDocked;
      InterventionStore.set(nowDocked);
      if (nowDocked) {
        void this.stage(nowDocked);
      } else {
        this.cancel(false);
      }
    }
    this.cradleRingMaterial.emissiveIntensity = this.stagedCount > 0
      ? 1.0 + Math.sin(time * 3) * 0.4
      : 0.4;
  }

  private buildCradle(): void {
    const c = OBSERVATORY.cradle;
    const group = new Group();
    const pedestal = new Mesh(
      new CylinderGeometry(0.17, 0.24, c.y - 0.06, 28),
      new MeshStandardMaterial({ color: '#0f1724', roughness: 0.4, metalness: 0.5 }),
    );
    pedestal.position.y = (c.y - 0.06) / 2;
    group.add(pedestal);
    const ring = new Mesh(new TorusGeometry(0.16, 0.008, 10, 56), this.cradleRingMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = c.y - 0.06;
    group.add(ring);
    const label = makeLabel(
      [
        { text: 'INTERVENTION CRADLE', color: OBS.containment, size: 26, weight: '700' },
        { text: 'place an actor here to stage a containment preview', color: '#c8b08a', size: 18 },
        { text: 'placing stages only · committing is a separate, authorized click', color: '#8a7a5a', size: 16 },
      ],
      { width: 0.34, background: '#1a1410d9', border: '#e0a62b66' },
    );
    label.position.set(0, c.y + 0.34, 0);
    group.add(label);
    this.cradleLabel = label;
    group.position.set(c.x, 0, c.z);
    this.world.createTransformEntity(group);
  }

  private setCradleStatus(lines: { text: string; color?: string; size?: number; weight?: string }[] | null): void {
    if (this.cradleStatus) { disposeLabel(this.cradleStatus); this.cradleStatus = null; }
    this.cradleStatusEntity?.dispose();
    this.cradleStatusEntity = null;
    if (!lines) return;
    const label = makeLabel(lines, { width: 0.4, background: '#1a1410e6', border: '#e0a62b99' });
    label.position.set(this.cradleSlot.x, this.cradleSlot.y + 0.52, this.cradleSlot.z);
    this.cradleStatus = label;
    this.cradleStatusEntity = this.world.createTransformEntity(label);
  }

  private async stage(actorId: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const panel = this.world.getSceneObject<UIKitMLAsset>('containment-panel');
    const previewText = panel?.getElementById('preview-text');
    const resultText = panel?.getElementById('result-text');
    // Every control is a direct child of the panel root (no wrapper rows):
    // a nested container offsets its children in UIKit's own layout report,
    // which made the commit/cancel buttons unaimable by ray. Visibility is
    // therefore toggled per element rather than per section.
    const commitControls = ['commit-btn', 'cancel-btn', 'commit-gloss']
      .map((id) => requireElement(panel, 'containment-panel', id));
    const showCommitControls = (visible: boolean) => {
      for (const el of commitControls) el?.setProperties({ display: visible ? 'flex' : 'none' });
    };
    const showPreview = (text: string) => {
      previewText?.setProperties({ text, display: 'flex' });
    };
    this.showCommitControls = showCommitControls;
    try {
      const preview = await EngramApi.previewQuarantine(actorId);
      this.clearMarks();
      this.lastOutcome = 'none';
      this.stagedActorId = actorId;
      this.stagedCount = preview.already_quarantined ? 0 : preview.count;
      this.stagedFieldVersion = preview.field_version;
      if (preview.already_quarantined) {
        showPreview(`${actorId} is already QUARANTINED - nothing to stage.`);
        this.setCradleStatus([
          { text: actorId, color: '#f2e8d8', size: 26, weight: '700' },
          { text: 'already QUARANTINED - nothing to stage', color: OBS.staged, size: 19 },
        ]);
      } else {
        showPreview(
          `This will QUARANTINE ${actorId} and TAINT_FLAG ` +
            `${preview.count} ${preview.count === 1 ? 'memory' : 'memories'}: ` +
            `${preview.would_flag_memory_ids.join(', ')}. Flagged memories remain ` +
            `rehabilitatable in MNEME later, but this build cannot rehabilitate them. ` +
            `This flags the memory as suspect; it does not delete it.`,
        );
        this.setCradleStatus([
          { text: `STAGED: ${actorId}`, color: OBS.staged, size: 26, weight: '700' },
          { text: `would TAINT_FLAG ${preview.count} ${preview.count === 1 ? 'memory' : 'memories'}`, color: '#f2e8d8', size: 20 },
          { text: `against field_version ${preview.field_version} · nothing committed`, color: '#c8b08a', size: 17 },
        ]);
        this.markStaged(preview.would_flag_memory_ids, preview.field_version);
      }
      resultText?.setProperties({ text: '' });
      this.showCommitControls?.(!preview.already_quarantined);
      AudioCues.play('stage');
      OnboardingEvents.emit('stage-done');
    } catch (err) {
      AudioCues.play('failure');
      showPreview(`FAILED to preview: ${(err as Error).message}`);
      this.showCommitControls?.(false);
      this.setCradleStatus([
        { text: 'PREVIEW FAILED', color: '#c3ccd8', size: 24, weight: '700' },
        { text: String((err as Error).message ?? err), color: '#8d98a6', size: 17 },
      ]);
    } finally {
      this.busy = false;
    }
  }

  private async commit(): Promise<void> {
    const panel = this.world.getSceneObject<UIKitMLAsset>('containment-panel');
    const resultText = panel?.getElementById('result-text');
    const session = SessionStore.get();
    const actorId = this.stagedActorId;
    if (!actorId || this.stagedCount === 0) {
      resultText?.setProperties({ text: 'nothing staged - stage a preview first.' });
      return;
    }
    if (!session) {
      resultText?.setProperties({
        text: 'not logged in - Commit needs an operator session; MNEME authorizes the sweep, not this panel.',
      });
      AudioCues.play('failure');
      return;
    }
    try {
      const result = await EngramApi.commitQuarantine(
        actorId,
        session.sessionToken,
        'INC-hackathon containment demo',
        crypto.randomUUID(),
        this.stagedFieldVersion,
      );
      this.lastOutcome = 'committed';
      resultText?.setProperties({
        text: `committed: sweep ${result.sweep_id} flagged ${result.flagged_count} memories.`,
      });
      // The staged field_version is now spent: leaving it armed would let a
      // second Commit click fire a fresh idempotency key against a stale
      // version (an honest 409, but a confusing one).
      this.stagedCount = 0;
      this.stagedActorId = null;
      this.clearMarks();
      panel?.getElementById('preview-text')?.setProperties({ display: 'none' });
      this.setCradleStatus([
        { text: `COMMITTED: ${actorId}`, color: '#a8d8a8', size: 26, weight: '700' },
        { text: `sweep ${result.sweep_id} · ${result.flagged_count} memories TAINT_FLAGGED`, color: '#d8f0d8', size: 18 },
        { text: 'MNEME authorized and recorded this; the field below re-read itself', color: '#8aa89a', size: 16 },
      ]);
      this.showCommitControls?.(false);
      const field = this.world.getSystem(FieldSystem);
      await field?.refresh();
      AudioCues.play('commit');
      OnboardingEvents.emit('commit-done');
    } catch (err) {
      AudioCues.play('failure');
      this.lastOutcome = 'refused';
      resultText?.setProperties({ text: `FAILED to commit: ${(err as Error).message}` });
      this.setCradleStatus([
        { text: 'COMMIT REFUSED', color: '#c3ccd8', size: 24, weight: '700' },
        { text: String((err as Error).message ?? err), color: '#8d98a6', size: 17 },
        { text: 'the field is unchanged', color: '#8d98a6', size: 16 },
      ]);
    }
  }

  /** `clearOutcome` is true only for the operator's own Cancel press. An
   * undock that merely follows a commit leaves the outcome on screen. */
  private cancel(clearOutcome: boolean): void {
    const panel = this.world.getSceneObject<UIKitMLAsset>('containment-panel');
    this.showCommitControls?.(false);
    panel?.getElementById('preview-text')?.setProperties({ text: '', display: 'none' });
    this.stagedCount = 0;
    this.stagedActorId = null;
    this.clearMarks();
    if (clearOutcome || this.lastOutcome === 'none') {
      panel?.getElementById('result-text')?.setProperties({ text: '' });
      this.setCradleStatus(null);
      this.lastOutcome = 'none';
    }
  }

  private markStaged(ids: string[], fieldVersion: number): void {
    for (const memoryId of ids) {
      const ring = new Mesh(STAGED_RING_GEO, this.stagedMaterial);
      ring.rotation.x = Math.PI / 2;
      this.marks.push({ entity: this.world.createTransformEntity(ring), object: ring, memoryId, isLabel: false });
      const label = makeLabel(
        [{ text: 'PREVIEW · would be TAINT_FLAGGED', color: OBS.staged, size: 20, weight: '700' },
         { text: `staged against field_version ${fieldVersion} · nothing committed`, color: '#c8b08a', size: 16 }],
        { width: 0.26, background: '#1a1410e6', border: '#e0a62b88' },
      );
      this.marks.push({ entity: this.world.createTransformEntity(label), object: label, memoryId, isLabel: true });
    }
  }

  private clearMarks(): void {
    for (const m of this.marks) {
      if (m.isLabel) disposeLabel(m.object as Sprite);
      m.entity.dispose();
    }
    this.marks = [];
  }
}
