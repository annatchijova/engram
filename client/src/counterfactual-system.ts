/**
 * ENGRAM — Nivel 4 Counterfactual Chambers. The project's own README calls
 * this its defining interaction: hold a factual world and a sealed
 * hypothetical world apart, never merge them, never let the hypothetical
 * read as evidence about the real field.
 *
 * The authority asymmetry IS the demo: exclusion (narrowing) needs no
 * login; containment (widening — it discloses what custody withheld)
 * needs the Nivel 2 session. MNEME's own field.recall() enforces that
 * check, not this file — see server/app.py's containment-effect endpoint.
 *
 * Ghost nodes use a violet, transparent material that appears nowhere in
 * CUSTODY_COLOR (field-system.ts), so a hypothetical node can never be
 * mistaken for a real custody-status one. They live in their own offset
 * arc, further back and lower than the factual field — a different
 * spatial region, not a recolor of the same one (the investigation doc
 * explicitly calls a background-color change insufficient).
 */
import {
  BufferGeometry,
  Color,
  createSystem,
  Entity,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  UIKitMLAsset,
  Vector3,
} from '@iwsdk/core';
import { CounterfactualDelta, EngramApi } from './engram-api.js';
import { MemoryNode } from './memory-node-component.js';
import { SessionStore } from './session.js';

const CHAMBER_CENTER = { x: 0, y: 0.75, z: -2.3 };
const CHAMBER_RADIUS = 0.6;
const GHOST_COLOR = '#b060ff';
const TIE_LINE_COLOR = '#7040a0';

export class CounterfactualSystem extends createSystem({
  nodes: { required: [MemoryNode] },
}) {
  private chamberEntities: Entity[] = [];
  private ghostGeometry = new SphereGeometry(0.06, 20, 14);
  private ghostMaterial = new MeshStandardMaterial({
    color: new Color(GHOST_COLOR), transparent: true, opacity: 0.4,
  });
  private tieLineMaterial = new LineBasicMaterial({
    color: new Color(TIE_LINE_COLOR), transparent: true, opacity: 0.5,
  });

  init(): void {
    const panel = this.world.getSceneObject<UIKitMLAsset>('counterfactual-panel');
    if (!panel) return;

    const exclusionBtn = panel.getElementById('cf-exclusion');
    const containmentBtn = panel.getElementById('cf-containment');
    const collapseBtn = panel.getElementById('cf-collapse');

    const onExclusion = () => void this.run(() => EngramApi.exclusionEffect());
    const onContainment = () =>
      void this.run(() => {
        const session = SessionStore.get();
        if (!session) {
          throw new Error('log in first (top-right) — containment widens the custody gate.');
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

  private findNodePosition(memoryId: string): Vector3 | undefined {
    for (const entity of this.queries.nodes.entities) {
      if (entity.getValue(MemoryNode, 'memoryId') === memoryId) {
        const obj = entity.object3D;
        return obj ? obj.position.clone() : undefined;
      }
    }
    return undefined;
  }

  private clearChamber(): void {
    for (const entity of this.chamberEntities) entity.dispose();
    this.chamberEntities = [];
    const panel = this.world.getSceneObject<UIKitMLAsset>('counterfactual-panel');
    panel?.getElementById('cf-result')?.setProperties({ text: '' });
  }

  private async run(call: () => Promise<CounterfactualDelta>): Promise<void> {
    const panel = this.world.getSceneObject<UIKitMLAsset>('counterfactual-panel');
    const result = panel?.getElementById('cf-result');
    let delta: CounterfactualDelta;
    try {
      delta = await call();
    } catch (err) {
      result?.setProperties({ text: `FAILED: ${(err as Error).message}` });
      return;
    }

    this.clearChamber();

    // Everything that differs between the two worlds — the hypothetical
    // chamber shows exactly this set, nothing more.
    const changed = Array.from(new Set([
      ...delta.removed_from_serving,
      ...delta.entered_top_k,
    ]));
    const n = changed.length;
    changed.forEach((memoryId, i) => {
      const angle = n <= 1 ? 0 : ((i / (n - 1)) - 0.5) * (Math.PI / 2);
      const ghostPos = new Vector3(
        CHAMBER_CENTER.x + CHAMBER_RADIUS * Math.sin(angle),
        CHAMBER_CENTER.y,
        CHAMBER_CENTER.z - CHAMBER_RADIUS * Math.cos(angle),
      );
      const mesh = new Mesh(this.ghostGeometry, this.ghostMaterial);
      mesh.position.copy(ghostPos);
      const entity = this.world.createTransformEntity(mesh);
      this.chamberEntities.push(entity);

      const realPos = this.findNodePosition(memoryId);
      if (realPos) {
        const geometry = new BufferGeometry().setFromPoints([ghostPos, realPos]);
        const line = new Line(geometry, this.tieLineMaterial);
        const lineEntity = this.world.createTransformEntity(line);
        this.chamberEntities.push(lineEntity);
      }
    });

    result?.setProperties({
      text:
        `${delta.summary}\n` +
        `removed: ${delta.removed_from_serving.join(', ') || 'none'}\n` +
        `entered: ${delta.entered_top_k.join(', ') || 'none'}\n` +
        `reranked: ${delta.rank_changed.length}  claims flipped: ` +
        `${delta.claim_outcome_changed.length}\n` +
        `receipt A ${delta.receipt_a_sha256.slice(0, 12)}...  ` +
        `receipt B ${delta.receipt_b_sha256.slice(0, 12)}...\n` +
        `delta ${delta.delta_sha256.slice(0, 16)}...`,
    });
  }
}
