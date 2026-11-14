/**
 * ENGRAM — Nivel 4 Counterfactual Chamber. The project's own README calls
 * this its defining interaction: hold a factual world and a sealed
 * hypothetical world apart, never merge them, never let the hypothetical
 * read as evidence about the real field.
 *
 * The authority asymmetry IS the demo: exclusion (narrowing) needs no
 * login; containment (widening — it discloses what custody withheld)
 * needs the Nivel 2 session. MNEME's own field.recall() enforces that
 * check, not this file — see server/app.py's containment-effect endpoint.
 *
 * The chamber is a physically separate raised ring to the left of the
 * evidence bench (built in lab-environment.ts). Inside it, two rows of
 * tokens show exactly what MNEME served in world A (recorded) and world B
 * (hypothetical, sealed, never executed), ghost cores mark every memory
 * whose serving changed, and thin tie lines point back to the factual
 * cores on the bench. Ghosts use a violet that appears nowhere in
 * CUSTODY_COLOR, so a hypothetical node can never be mistaken for a real
 * custody-status one. "Collapse chamber" removes all of it; the factual
 * field is never touched by any of this.
 */
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  createSystem,
  Entity,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  SphereGeometry,
  Sprite,
  TorusGeometry,
  UIKitMLAsset,
  Vector3,
} from '@iwsdk/core';
import { CounterfactualDelta, EngramApi } from './engram-api.js';
import { FieldSystem } from './field-system.js';
import { ObservatoryScene } from './observatory/observatory-handles.js';
import { AudioCues } from './observatory/audio-cues.js';
import { disposeLabel, makeLabel } from './observatory/labels.js';
import { OBS, OBSERVATORY } from './observatory/palette.js';
import { OnboardingEvents } from './onboarding-events.js';
import { SessionStore } from './session.js';

const GHOST_COLOR = '#b060ff';
const TIE_LINE_COLOR = '#7040a0';
const WORLD_A_COLOR = '#cfe3ff';
const WORLD_B_COLOR = '#d8b4ff';

const GHOST_GEO = new OctahedronGeometry(0.05, 0);
const GHOST_RING_GEO = new TorusGeometry(0.065, 0.003, 8, 40);
const TOKEN_GEO = new SphereGeometry(0.022, 14, 10);

type Tie = { geometry: BufferGeometry; ghost: Group; memoryId: string };

export class CounterfactualSystem extends createSystem({}) {
  private chamberEntities: Entity[] = [];
  private labels: Sprite[] = [];
  private ghosts: Group[] = [];
  private ties: Tie[] = [];
  private active = false;
  private ghostMaterial = new MeshPhysicalMaterial({
    color: new Color(GHOST_COLOR), emissive: new Color(GHOST_COLOR), emissiveIntensity: 0.5,
    transparent: true, opacity: 0.45, roughness: 0.2, clearcoat: 1,
  });
  private ghostRingMaterial = new MeshStandardMaterial({
    color: new Color(GHOST_COLOR), emissive: new Color(GHOST_COLOR), emissiveIntensity: 1.2,
    transparent: true, opacity: 0.8,
  });
  private tieLineMaterial = new LineBasicMaterial({
    color: new Color(TIE_LINE_COLOR), transparent: true, opacity: 0.55,
  });
  private tokenA = new MeshStandardMaterial({ color: new Color(WORLD_A_COLOR), emissive: new Color(WORLD_A_COLOR), emissiveIntensity: 0.4 });
  private tokenB = new MeshStandardMaterial({ color: new Color(WORLD_B_COLOR), emissive: new Color(GHOST_COLOR), emissiveIntensity: 0.6 });
  private tokenChanged = new MeshStandardMaterial({ color: new Color('#ffffff'), emissive: new Color(GHOST_COLOR), emissiveIntensity: 1.4 });
  private a = new Vector3();
  private b = new Vector3();

  init(): void {
    const panel = this.world.getSceneObject<UIKitMLAsset>('counterfactual-panel');
    if (!panel) return;

    const exclusionBtn = panel.getElementById('cf-exclusion');
    const containmentBtn = panel.getElementById('cf-containment');
    const collapseBtn = panel.getElementById('cf-collapse');

    const onExclusion = () =>
      void this.run('exclusion-run', () => EngramApi.exclusionEffect());
    const onContainment = () =>
      void this.run('containment-cf-run', () => {
        const session = SessionStore.get();
        if (!session) {
          throw new Error('log in first (right console) - containment widens the custody gate.');
        }
        return EngramApi.containmentEffect(session.sessionToken);
      });
    const onCollapse = () => this.clearChamber();

    exclusionBtn?.addEventListener('click', onExclusion);
    containmentBtn?.addEventListener('click', onContainment);
    collapseBtn?.addEventListener('click', onCollapse);
    this.cleanupFuncs.push(
      () => exclusionBtn?.removeEventListener('click', onExclusion),
      () => containmentBtn?.removeEventListener('click', onContainment),
      () => collapseBtn?.removeEventListener('click', onCollapse),
    );
  }

  update(delta: number, time: number): void {
    const h = ObservatoryScene.get();
    if (h) {
      const ringTarget = this.active ? 1.4 : 0.35;
      const lightTarget = this.active ? 2.4 : 0.6;
      const k = 1 - Math.exp(-delta * 4);
      h.chamberRing.emissiveIntensity += (ringTarget - h.chamberRing.emissiveIntensity) * k;
      h.chamberLight.intensity += (lightTarget - h.chamberLight.intensity) * k;
    }
    for (let i = 0; i < this.ghosts.length; i++) {
      const g = this.ghosts[i];
      g.rotation.y += delta * 0.7;
      g.position.y += Math.sin(time * 1.3 + i) * 0.00025;
    }
    const field = this.world.getSystem(FieldSystem);
    for (const tie of this.ties) {
      if (!field?.getCoreWorldPosition(tie.memoryId, this.b)) continue;
      tie.ghost.getWorldPosition(this.a);
      const pos = tie.geometry.attributes.position;
      pos.setXYZ(0, this.a.x, this.a.y, this.a.z);
      pos.setXYZ(1, this.b.x, this.b.y, this.b.z);
      pos.needsUpdate = true;
    }
  }

  private clearChamber(): void {
    for (const l of this.labels) disposeLabel(l);
    this.labels = [];
    for (const entity of this.chamberEntities) entity.dispose();
    this.chamberEntities = [];
    this.ghosts = [];
    this.ties = [];
    this.active = false;
    const panel = this.world.getSceneObject<UIKitMLAsset>('counterfactual-panel');
    panel?.getElementById('cf-result')?.setProperties({ text: '' });
  }

  private place(obj: Group | Mesh | Sprite | Line): void {
    this.chamberEntities.push(this.world.createTransformEntity(obj));
  }

  private async run(
    kind: 'exclusion-run' | 'containment-cf-run',
    call: () => Promise<CounterfactualDelta>,
  ): Promise<void> {
    const panel = this.world.getSceneObject<UIKitMLAsset>('counterfactual-panel');
    const result = panel?.getElementById('cf-result');
    let delta: CounterfactualDelta;
    try {
      delta = await call();
    } catch (err) {
      AudioCues.play('failure');
      result?.setProperties({ text: `FAILED: ${(err as Error).message}` });
      return;
    }

    this.clearChamber();
    this.active = true;
    const c = OBSERVATORY.chamber;

    // ---- World A / World B served rows (exactly what MNEME returned) ------
    // Two rails stacked at reading height inside the chamber, A above B, so
    // the operator compares two orders of the same ids rather than reading
    // two lists of text. Sizes are set for the ~2.2 m seated viewing
    // distance to this zone, not for a screenshot taken up close.
    const changedSet = new Set([...delta.removed_from_serving, ...delta.entered_top_k]);
    const row = (
      ids: string[], y: number, material: MeshStandardMaterial,
      title: string, color: string, receipt: string,
    ) => {
      const n = ids.length;
      const rail = new Mesh(
        new BoxGeometry(Math.max(0.4, n * 0.28), 0.005, 0.005),
        new MeshStandardMaterial({
          color: new Color(color), emissive: new Color(color), emissiveIntensity: 0.7,
          transparent: true, opacity: 0.55,
        }),
      );
      rail.position.set(c.x, y, c.z);
      this.place(rail);
      ids.forEach((id, i) => {
        const x = c.x + (n <= 1 ? 0 : (i - (n - 1) / 2) * 0.28);
        const token = new Mesh(TOKEN_GEO, changedSet.has(id) ? this.tokenChanged : material);
        token.position.set(x, y, c.z);
        token.scale.setScalar(changedSet.has(id) ? 2.0 : 1.4);
        this.place(token);
        const label = makeLabel(
          [{ text: id, color: changedSet.has(id) ? '#ffffff' : color, size: 34, weight: changedSet.has(id) ? '700' : '500' }],
          { width: 0.26, background: '#120b1fe6' },
        );
        label.position.set(x, y + 0.095, c.z);
        this.labels.push(label);
        this.place(label);
      });
      const head = makeLabel(
        [{ text: title, color, size: 42, weight: '700' },
         { text: `${n} served · receipt ${receipt.slice(0, 12)}…`, color: '#b8a6d8', size: 30 }],
        { width: 0.92, background: '#120b1ff2', border: `${color}88` },
      );
      head.position.set(c.x, y - 0.14, c.z);
      this.labels.push(head);
      this.place(head);
    };
    row(delta.served_a, 1.74, this.tokenA, 'WORLD A · the recorded field', WORLD_A_COLOR, delta.receipt_a_sha256);
    row(delta.served_b, 1.36, this.tokenB, 'WORLD B · sealed hypothetical, never executed', WORLD_B_COLOR, delta.receipt_b_sha256);

    // ---- Ghost cores for everything whose serving changed ------------------
    const changed = Array.from(changedSet);
    const n = changed.length;
    changed.forEach((memoryId, i) => {
      const ghost = new Group();
      const body = new Mesh(GHOST_GEO, this.ghostMaterial);
      body.scale.setScalar(1.8);
      ghost.add(body);
      const ring = new Mesh(GHOST_RING_GEO, this.ghostRingMaterial);
      ring.rotation.x = Math.PI / 2;
      ring.scale.setScalar(1.8);
      ghost.add(ring);
      const removed = delta.removed_from_serving.includes(memoryId);
      const label = makeLabel(
        [{ text: memoryId, color: '#f2e8ff', size: 42, weight: '700' },
         { text: removed ? 'removed from serving in B' : 'entered top-k in B', color: GHOST_COLOR, size: 32, weight: '600' },
         { text: 'hypothetical · not a custody status', color: '#9f8cc0', size: 26 }],
        { width: 0.52, background: '#120b1ff2', border: '#b060ffaa' },
      );
      label.position.y = 0.26;
      ghost.add(label);
      this.labels.push(label);
      ghost.position.set(
        c.x + (n <= 1 ? 0 : (i - (n - 1) / 2) * 0.46),
        2.18,
        c.z,
      );
      this.ghosts.push(ghost);
      this.place(ghost);

      const geometry = new BufferGeometry().setFromPoints([new Vector3(), new Vector3()]);
      const line = new Line(geometry, this.tieLineMaterial);
      line.frustumCulled = false;
      this.place(line);
      this.ties.push({ geometry, ghost, memoryId });
    });

    // ---- Sealed delta summary ------------------------------------------------
    const summary = makeLabel(
      [
        { text: kind === 'exclusion-run' ? 'EXCLUSION FORECAST' : 'CONTAINMENT EFFECT', color: GHOST_COLOR, size: 46, weight: '700' },
        { text: delta.summary, color: '#f2e8ff', size: 32 },
        { text: `reranked ${delta.rank_changed.length} · claims flipped ${delta.claim_outcome_changed.length} · interference ${delta.interference ? 'yes' : 'no'}`, color: '#c8b8e8', size: 29 },
        { text: `delta ${delta.delta_sha256.slice(0, 20)}…`, color: '#9f8cc0', size: 27 },
        { text: 'sealed comparison · the recorded field was not touched', color: '#8d7aa8', size: 26 },
      ],
      { width: 1.25, background: '#120b1ff7', border: '#b060ffcc' },
    );
    summary.position.set(c.x, 2.62, c.z);
    this.labels.push(summary);
    this.place(summary);

    result?.setProperties({
      text:
        `${delta.summary}\n` +
        `removed: ${delta.removed_from_serving.join(', ') || 'none'}\n` +
        `entered: ${delta.entered_top_k.join(', ') || 'none'}\n` +
        `reranked: ${delta.rank_changed.length}  claims flipped: ` +
        `${delta.claim_outcome_changed.length}\n` +
        `receipt A ${delta.receipt_a_sha256.slice(0, 12)}...  ` +
        `receipt B ${delta.receipt_b_sha256.slice(0, 12)}...\n` +
        `delta ${delta.delta_sha256.slice(0, 16)}...` +
        (delta.read_audit ? `\nread audit: ${delta.read_audit}` : ''),
    });
    AudioCues.play('chamber');
    OnboardingEvents.emit(kind);
  }
}
