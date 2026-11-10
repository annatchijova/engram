/**
 * ENGRAM — Nivel 3 Causal Field. "Trace" per
 * ENGRAM-ARCHITECTURAL-INVESTIGATION.md §4: read-only, fully reversible,
 * pulls on DIRECT / DERIVED / DERIVED_UNATTESTED / POSSIBLE edges and
 * renders them as genuinely distinct — never as nodes at different
 * distances. Backed by MNEME's real causality.impact(), which its own
 * docstring says "deliberately does NOT quarantine anything": this system
 * never calls a mutating endpoint.
 *
 * Receipt/decision markers use non-sphere geometry on purpose — memory
 * nodes are spheres, and the investigation doc's architecture critique #4
 * warns against "una sola clase Entity" mixing memory/claim/decision/grant.
 */
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  createSystem,
  Entity,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  UIKitMLAsset,
  Vector3,
} from '@iwsdk/core';
import { EngramApi, ImpactReport } from './engram-api.js';
import { MemoryNode } from './memory-node-component.js';
import { OnboardingEvents } from './onboarding-events.js';
import { SelectedMemory } from './selected-memory.js';

type EdgeClass = 'DIRECT' | 'DERIVED' | 'DERIVED_UNATTESTED' | 'POSSIBLE';

// Declared once — the only place an edge class maps to appearance. Never
// let POSSIBLE read as visually equivalent to DIRECT (doc's own warning).
const TRACE_STYLE: Record<EdgeClass, { color: string; dashed: boolean; opacity: number }> = {
  DIRECT: { color: '#5fc9ff', dashed: false, opacity: 1 },
  DERIVED: { color: '#e0a62b', dashed: true, opacity: 0.9 },
  DERIVED_UNATTESTED: { color: '#8a6a2a', dashed: true, opacity: 0.6 },
  POSSIBLE: { color: '#888888', dashed: false, opacity: 0.35 },
};

// Same elapsed-accumulation reasoning as field-system.ts's color
// transition (update(delta, time)'s units aren't documented; accumulating
// delta avoids depending on them). This only ever reveals a line the
// server's own causality.impact() already returned in full — the draw-on
// is purely how it's shown, never a guess running ahead of the response.
const DRAW_SECONDS = 0.4;

type LineReveal = {
  geometry: BufferGeometry;
  line: Line;
  from: Vector3;
  to: Vector3;
  dashed: boolean;
  elapsed: number;
};

export class TraceSystem extends createSystem({
  nodes: { required: [MemoryNode] },
}) {
  private traceEntities: Entity[] = [];
  private lineMaterials: Record<EdgeClass, LineBasicMaterial> = {} as never;
  // Shared across all receipt/decision markers — allocating one per marker
  // per trace leaks GPU materials on every re-run.
  private markerMaterial = new MeshStandardMaterial({
    color: new Color(TRACE_STYLE.DIRECT.color),
  });
  // Reused every frame — never allocate inside update().
  private reveals: LineReveal[] = [];
  private scratch = new Vector3();

  init(): void {
    for (const [key, style] of Object.entries(TRACE_STYLE) as [EdgeClass, typeof TRACE_STYLE[EdgeClass]][]) {
      this.lineMaterials[key] = style.dashed
        ? new LineDashedMaterial({
            color: new Color(style.color), transparent: true,
            opacity: style.opacity, dashSize: 0.03, gapSize: 0.02,
          })
        : new LineBasicMaterial({
            color: new Color(style.color), transparent: true, opacity: style.opacity,
          });
    }
    this.populateTraceLegend();

    const panel = this.world.getSceneObject<UIKitMLAsset>('detail-panel');
    const traceBtn = panel?.getElementById('detail-trace');
    const onTrace = () => void this.runTrace();
    traceBtn?.addEventListener('click', onTrace);
    this.cleanupFuncs.push(
      () => traceBtn?.removeEventListener('click', onTrace),
      SelectedMemory.subscribe(() => this.clearTrace()),
    );
  }

  private populateTraceLegend(): void {
    const legend = this.world.getSceneObject<UIKitMLAsset>('legend-panel');
    if (!legend) return;
    for (const [key, style] of Object.entries(TRACE_STYLE) as [EdgeClass, typeof TRACE_STYLE[EdgeClass]][]) {
      legend.getElementById(`swatch-${key}`)?.setProperties({ backgroundColor: style.color });
    }
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

  update(delta: number): void {
    for (let i = this.reveals.length - 1; i >= 0; i--) {
      const r = this.reveals[i];
      r.elapsed += delta;
      const alpha = Math.min(1, r.elapsed / DRAW_SECONDS);
      this.scratch.lerpVectors(r.from, r.to, alpha);
      r.geometry.attributes.position.setXYZ(1, this.scratch.x, this.scratch.y, this.scratch.z);
      r.geometry.attributes.position.needsUpdate = true;
      if (r.dashed) r.line.computeLineDistances();
      if (alpha >= 1) this.reveals.splice(i, 1);
    }
  }

  private drawLine(from: Vector3, to: Vector3, cls: EdgeClass): void {
    // Starts as a zero-length line at `from` and is extended toward `to`
    // by update() over DRAW_SECONDS — the data itself (both endpoints) is
    // already fully known here; only the reveal is staggered.
    const geometry = new BufferGeometry().setFromPoints([from, from]);
    const line = new Line(geometry, this.lineMaterials[cls]);
    const dashed = TRACE_STYLE[cls].dashed;
    if (dashed) line.computeLineDistances();
    const entity = this.world.createTransformEntity(line);
    this.traceEntities.push(entity);
    this.reveals.push({ geometry, line, from, to, dashed, elapsed: 0 });
  }

  private drawMarker(kind: 'receipt' | 'decision', position: Vector3): Entity {
    const geometry = kind === 'receipt' ? new OctahedronGeometry(0.045) : new BoxGeometry(0.07, 0.07, 0.07);
    const mesh = new Mesh(geometry, this.markerMaterial);
    mesh.position.copy(position);
    const entity = this.world.createTransformEntity(mesh);
    this.traceEntities.push(entity);
    return entity;
  }

  private clearTrace(): void {
    for (const entity of this.traceEntities) entity.dispose();
    this.traceEntities = [];
    // Any reveal still in flight is now chasing a disposed geometry.
    this.reveals = [];
    const panel = this.world.getSceneObject<UIKitMLAsset>('detail-panel');
    panel?.getElementById('detail-impact')?.setProperties({ text: '' });
  }

  private async runTrace(): Promise<void> {
    const memoryId = SelectedMemory.get();
    if (!memoryId) return;
    const panel = this.world.getSceneObject<UIKitMLAsset>('detail-panel');
    const impactText = panel?.getElementById('detail-impact');

    let report: ImpactReport;
    try {
      report = await EngramApi.getImpact(memoryId);
    } catch (err) {
      impactText?.setProperties({ text: `FAILED to trace: ${(err as Error).message}` });
      return;
    }

    this.clearTrace();
    const rootPos = this.findNodePosition(memoryId);
    if (!rootPos) {
      impactText?.setProperties({ text: 'cannot trace: node not found in the rendered field.' });
      return;
    }

    for (const id of report.derived_memories) {
      const pos = this.findNodePosition(id);
      if (pos) this.drawLine(rootPos, pos, 'DERIVED');
    }
    for (const id of report.derived_unattested) {
      const pos = this.findNodePosition(id);
      if (pos) this.drawLine(rootPos, pos, 'DERIVED_UNATTESTED');
    }
    for (const id of report.possible_memories) {
      const pos = this.findNodePosition(id);
      if (pos) this.drawLine(rootPos, pos, 'POSSIBLE');
    }

    const markerTargets = [
      ...report.direct_receipts.map((id) => ({ id, kind: 'receipt' as const })),
      ...report.direct_decisions.map((id) => ({ id, kind: 'decision' as const })),
    ];
    const n = markerTargets.length;
    markerTargets.forEach((m, i) => {
      const offset = (i - (n - 1) / 2) * 0.1;
      const markerPos = rootPos.clone().add(new Vector3(offset, 0.18, 0));
      this.drawMarker(m.kind, markerPos);
      this.drawLine(rootPos, markerPos, 'DIRECT');
    });

    impactText?.setProperties({
      text:
        `DIRECT: ${report.direct_receipts.length} receipt(s), ` +
        `${report.direct_decisions.length} decision(s)\n` +
        `DERIVED: ${report.derived_memories.join(', ') || 'none'}\n` +
        `DERIVED (unattested): ${report.derived_unattested.join(', ') || 'none'}\n` +
        `POSSIBLE (not causal): ${report.possible_memories.join(', ') || 'none'}`,
    });
    OnboardingEvents.emit('trace-run');
  }
}
