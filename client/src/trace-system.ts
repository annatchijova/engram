/**
 * ENGRAM — Nivel 3 Causal Field. "Trace" per
 * docs/ENGRAM-ARCHITECTURAL-INVESTIGATION.md §4: read-only, fully reversible,
 * pulls on DIRECT / DERIVED / DERIVED_UNATTESTED / POSSIBLE edges and
 * renders them as genuinely distinct — never as nodes at different
 * distances. Backed by MNEME's real causality.impact(), which its own
 * docstring says "deliberately does NOT quarantine anything": this system
 * never calls a mutating endpoint.
 *
 * Edges are drawn as arcs over the field (see ARC_SEGMENTS below), revealed
 * in the order the report listed them.
 *
 * Every edge carries a text label with its class at the midpoint, so the
 * meaning never rides on color or dash pattern alone. DIRECT and DERIVED
 * edges additionally carry a travelling pulse (toward the target) as a
 * reading aid; POSSIBLE edges deliberately get no pulse and stay faint.
 * Receipt/decision markers use non-core geometry (octahedron/box) so they
 * never read as memories.
 */
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  createSystem,
  CylinderGeometry,
  Entity,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  Quaternion,
  Sprite,
  SphereGeometry,
  UIKitMLAsset,
  Vector3,
} from '@iwsdk/core';
import { EngramApi, ImpactReport } from './engram-api.js';
import { FieldSystem } from './field-system.js';
import { AudioCues } from './observatory/audio-cues.js';
import { disposeLabel, makeLabel } from './observatory/labels.js';
import { OBS } from './observatory/palette.js';
import { OnboardingEvents } from './onboarding-events.js';
import { requireElement } from './observatory/wiring.js';
import { SelectedMemory } from './selected-memory.js';
import { EDGE_LABEL, EdgeClass } from './shared-projection.js';

// Declared once — the only place an edge class maps to appearance. Never
// let POSSIBLE read as visually equivalent to DIRECT (doc's own warning).
//
// Four independent channels separate the classes, so no single one has to
// carry the meaning: solidity (continuous bar vs dashes vs hairline),
// radius, color, and whether a pulse travels along it. POSSIBLE is
// deliberately the only class drawn as a bare hairline with no volume and
// no motion: it is not a cause, and it must never read as one.
const TRACE_STYLE: Record<EdgeClass, {
  color: string; dashed: boolean; opacity: number; pulse: boolean; radius: number;
}> = {
  DIRECT: { color: '#5fc9ff', dashed: false, opacity: 1, pulse: true, radius: 0.0042 },
  DERIVED: { color: '#e0a62b', dashed: true, opacity: 0.95, pulse: true, radius: 0.0034 },
  DERIVED_UNATTESTED: { color: '#8a6a2a', dashed: true, opacity: 0.7, pulse: false, radius: 0.0022 },
  POSSIBLE: { color: '#8c97a6', dashed: false, opacity: 0.3, pulse: false, radius: 0 },
};
// Every edge is an arc over the field, not a chord through it: a straight
// line between two plates on the same arc would run in front of every plate
// between them. The arc's height depends only on the distance between its
// two endpoints, by the same rule for every class, so it carries no meaning.
// A WebGL line's `linewidth` is ignored by every browser, so an edge that
// must be visible across the room is geometry: ARC_SEGMENTS instanced
// cylinders along the curve, one draw call per edge. A solid class fills
// each step; a dashed class fills DASH_FILL of it.
const ARC_SEGMENTS = 20;
const DASH_FILL = 0.52;
const UNIT_CYLINDER = new CylinderGeometry(1, 1, 1, 6, 1);
const UP = new Vector3(0, 1, 0);

const DRAW_SECONDS = 0.7;
const PULSE_GEO = new SphereGeometry(0.011, 10, 8);

type Endpoint = { memoryId: string } | { fixed: Vector3 };

type TraceLine = {
  /** Hairline, used for POSSIBLE only. */
  geometry: BufferGeometry | null;
  line: Line | null;
  /** Volumetric arc for the causal classes. */
  tube: InstancedMesh | null;
  from: Endpoint;
  to: Endpoint;
  cls: EdgeClass;
  elapsed: number;
  /** Seconds to wait before this edge starts drawing (reveal order only). */
  delay: number;
  label: Sprite;
  labelled: boolean;
  pulse: Mesh | null;
  pulseOffset: number;
};

export class TraceSystem extends createSystem({}) {
  private traceEntities: Entity[] = [];
  private lines: TraceLine[] = [];
  private labels: Sprite[] = [];
  private lineMaterials: Record<EdgeClass, LineBasicMaterial> = {} as never;
  private tubeMaterials: Record<EdgeClass, MeshBasicMaterial> = {} as never;
  private qHelper = new Quaternion();
  private dirHelper = new Vector3();
  private pulseMaterials: Record<EdgeClass, MeshBasicMaterial> = {} as never;
  private markerMaterial = new MeshStandardMaterial({
    color: new Color(TRACE_STYLE.DIRECT.color), emissive: new Color(TRACE_STYLE.DIRECT.color),
    emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.4,
  });
  private rootId: string | null = null;
  private a = new Vector3();
  private b = new Vector3();
  private c = new Vector3();
  private p0 = new Vector3();
  private p1 = new Vector3();
  private mid = new Vector3();
  private scaleHelper = new Vector3();
  private matrix = new Matrix4();

  init(): void {
    for (const [key, style] of Object.entries(TRACE_STYLE) as [EdgeClass, typeof TRACE_STYLE[EdgeClass]][]) {
      this.lineMaterials[key] = new LineBasicMaterial({
        color: new Color(style.color), transparent: true, opacity: style.opacity,
      });
      // Unlit: an edge shows its declared class colour exactly, from any
      // angle and under any lamp.
      this.tubeMaterials[key] = new MeshBasicMaterial({
        color: new Color(style.color), transparent: style.opacity < 1, opacity: style.opacity,
      });
      this.pulseMaterials[key] = new MeshBasicMaterial({ color: new Color(style.color) });
    }
    this.populateTraceLegend();

    const panel = this.world.getSceneObject<UIKitMLAsset>('detail-panel');
    const traceBtn = requireElement(panel, 'detail-panel', 'detail-trace');
    const onTrace = () => void this.runTrace();
    // A UIKit click needs press and release within @pmndrs/pointer-events'
    // 300 ms clickThresholdMs: a longer hold is a grab gesture elsewhere in
    // this scene and deliberately does nothing on a panel button.
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

  private resolve(ep: Endpoint, target: Vector3): boolean {
    if ('fixed' in ep) { target.copy(ep.fixed); return true; }
    const field = this.world.getSystem(FieldSystem);
    return field?.getCoreWorldPosition(ep.memoryId, target) !== undefined;
  }

  /** Point at parameter t on the arc from a to b (control point in c). */
  private arcPoint(t: number, target: Vector3): Vector3 {
    const u = 1 - t;
    return target
      .copy(this.a).multiplyScalar(u * u)
      .addScaledVector(this.c, 2 * u * t)
      .addScaledVector(this.b, t * t);
  }

  update(delta: number, time: number): void {
    for (const l of this.lines) {
      if (!this.resolve(l.from, this.a) || !this.resolve(l.to, this.b)) continue;
      l.elapsed += delta;
      // The whole edge set came back in one server response; only the
      // reveal is staggered, and endpoints keep following cores a hand
      // may have moved.
      const alpha = Math.min(1, Math.max(0, (l.elapsed - l.delay) / DRAW_SECONDS));
      // Control point: above the midpoint, by a height that depends only
      // on how far apart the endpoints are.
      const span = this.a.distanceTo(this.b);
      this.c.lerpVectors(this.a, this.b, 0.5);
      this.c.y += 0.16 + span * 0.42;

      if (l.geometry && l.line) {
        const pos = l.geometry.attributes.position;
        for (let i = 0; i <= ARC_SEGMENTS; i++) {
          this.arcPoint(i / ARC_SEGMENTS, this.p0);
          pos.setXYZ(i, this.p0.x, this.p0.y, this.p0.z);
        }
        pos.needsUpdate = true;
        l.geometry.setDrawRange(0, Math.floor(alpha * ARC_SEGMENTS) + 1);
      }
      if (l.tube) {
        const style = TRACE_STYLE[l.cls];
        const fill = style.dashed ? DASH_FILL : 1.02;
        this.arcPoint(0, this.p0);
        for (let i = 0; i < ARC_SEGMENTS; i++) {
          this.arcPoint((i + 1) / ARC_SEGMENTS, this.p1);
          this.dirHelper.subVectors(this.p1, this.p0);
          const length = this.dirHelper.length();
          this.mid.lerpVectors(this.p0, this.p1, 0.5);
          if (length > 1e-6) this.qHelper.setFromUnitVectors(UP, this.dirHelper.multiplyScalar(1 / length));
          this.scaleHelper.set(style.radius, length * fill, style.radius);
          this.matrix.compose(this.mid, this.qHelper, this.scaleHelper);
          l.tube.setMatrixAt(i, this.matrix);
          this.p0.copy(this.p1);
        }
        l.tube.count = Math.floor(alpha * ARC_SEGMENTS);
        l.tube.instanceMatrix.needsUpdate = true;
      }
      // One labelled exemplar per class, placed past the apex of its own
      // arc: four captions instead of one per edge, which is what turned
      // four POSSIBLE labels into an unreadable clump.
      if (l.labelled) {
        this.arcPoint(0.66, l.label.position);
        l.label.position.y += 0.035;
        l.label.visible = alpha >= 1;
      }
      if (l.pulse) {
        l.pulse.visible = alpha > 0;
        const t = (time * 0.4 + l.pulseOffset) % 1;
        this.arcPoint(t * alpha, l.pulse.position);
      }
    }
  }

  /** Classes already carrying a label in this trace. The audit found four
   * POSSIBLE labels stacking into an unreadable clump, which made the
   * class of any one edge ambiguous — the opposite of what the label is
   * for. One labelled exemplar per class, staggered along its own edge,
   * plus the always-visible class legend, keeps the distinction readable
   * without repeating it once per line. */
  private labelledClasses = new Set<EdgeClass>();

  private drawLine(from: Endpoint, to: Endpoint, cls: EdgeClass): void {
    const style = TRACE_STYLE[cls];
    let geometry: BufferGeometry | null = null;
    let line: Line | null = null;
    let tube: InstancedMesh | null = null;
    if (style.radius === 0) {
      // POSSIBLE: a bare hairline, no volume, no motion.
      geometry = new BufferGeometry().setFromPoints(
        Array.from({ length: ARC_SEGMENTS + 1 }, () => new Vector3()),
      );
      line = new Line(geometry, this.lineMaterials[cls]);
      line.frustumCulled = false;
      line.raycast = () => {};
      this.traceEntities.push(this.world.createTransformEntity(line));
    } else {
      tube = new InstancedMesh(UNIT_CYLINDER, this.tubeMaterials[cls], ARC_SEGMENTS);
      tube.count = 0;
      tube.frustumCulled = false;
      tube.raycast = () => {};
      this.traceEntities.push(this.world.createTransformEntity(tube));
    }
    // One short line per edge: the class name, in the class colour. The
    // sentence explaining each class is in the legend, once, instead of
    // being repeated on every edge; POSSIBLE alone keeps its disclaimer on
    // the edge itself, because it is the one class that must never be
    // mistaken for a cause. Only the first edge of each class carries it.
    const first = !this.labelledClasses.has(cls);
    this.labelledClasses.add(cls);
    const name = EDGE_LABEL[cls].split(' — ')[0].toUpperCase();
    const label = makeLabel(
      [{ text: cls === 'POSSIBLE' ? `${name} · NOT CAUSAL` : name, color: TRACE_STYLE[cls].color, size: 21, weight: '700' }],
      { width: cls === 'DIRECT' ? 0.12 : 0.3, background: '#000000d9', padding: 10 },
    );
    label.visible = false;
    if (first) {
      this.labels.push(label);
      this.traceEntities.push(this.world.createTransformEntity(label));
    } else {
      disposeLabel(label);
    }
    let pulse: Mesh | null = null;
    if (TRACE_STYLE[cls].pulse) {
      pulse = new Mesh(PULSE_GEO, this.pulseMaterials[cls]);
      pulse.visible = false;
      pulse.raycast = () => {};
      this.traceEntities.push(this.world.createTransformEntity(pulse));
    }
    this.lines.push({
      geometry, line, tube, from, to, cls,
      elapsed: 0, delay: this.lines.length * 0.12, label, labelled: first,
      pulse, pulseOffset: Math.random(),
    });
  }

  private drawMarker(kind: 'receipt' | 'decision', id: string, position: Vector3): void {
    const geometry = kind === 'receipt' ? new OctahedronGeometry(0.04) : new BoxGeometry(0.065, 0.065, 0.065);
    const mesh = new Mesh(geometry, this.markerMaterial);
    mesh.position.copy(position);
    this.traceEntities.push(this.world.createTransformEntity(mesh));
    const label = makeLabel(
      [{ text: kind === 'receipt' ? 'RECALL RECEIPT' : 'RECORDED DECISION', color: TRACE_STYLE.DIRECT.color, size: 21, weight: '700' },
       { text: id.length > 22 ? `${id.slice(0, 22)}…` : id, color: OBS.ivory, size: 21, font: 'mono' }],
      { width: 0.27, background: '#000000d9', border: TRACE_STYLE.DIRECT.color },
    );
    label.position.copy(position).y += 0.09;
    this.labels.push(label);
    this.traceEntities.push(this.world.createTransformEntity(label));
  }

  private clearTrace(): void {
    for (const l of this.labels) disposeLabel(l);
    this.labels = [];
    for (const entity of this.traceEntities) entity.dispose();
    this.traceEntities = [];
    this.lines = [];
    this.labelledClasses.clear();
    this.rootId = null;
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
      AudioCues.play('failure');
      impactText?.setProperties({ text: `FAILED to trace: ${(err as Error).message}` });
      return;
    }

    this.clearTrace();
    const field = this.world.getSystem(FieldSystem);
    const rootPos = field?.getCoreWorldPosition(memoryId, new Vector3());
    if (!rootPos) {
      impactText?.setProperties({ text: 'cannot trace: node not found in the rendered field.' });
      return;
    }
    this.rootId = memoryId;
    const root: Endpoint = { memoryId };

    const drawTo = (ids: string[], cls: EdgeClass) => {
      for (const id of ids) {
        if (field?.getCoreWorldPosition(id, this.a)) this.drawLine(root, { memoryId: id }, cls);
      }
    };
    drawTo(report.derived_memories, 'DERIVED');
    drawTo(report.derived_unattested, 'DERIVED_UNATTESTED');
    drawTo(report.possible_memories, 'POSSIBLE');

    const markerTargets = [
      ...report.direct_receipts.map((id) => ({ id, kind: 'receipt' as const })),
      ...report.direct_decisions.map((id) => ({ id, kind: 'decision' as const })),
    ];
    const n = markerTargets.length;
    markerTargets.forEach((m, i) => {
      const offset = (i - (n - 1) / 2) * 0.22;
      // Beside the plate, on the side away from the custody tower's captions
      // (which extend to the right), so provenance and causality never stack.
      const markerPos = rootPos.clone().add(new Vector3(-0.3 - i * 0.34, 0.3, 0.02));
      void offset;
      this.drawMarker(m.kind, m.id, markerPos);
      this.drawLine(root, { fixed: markerPos }, 'DIRECT');
    });

    impactText?.setProperties({
      text:
        `DIRECT: ${report.direct_receipts.length} receipt(s), ` +
        `${report.direct_decisions.length} decision(s)\n` +
        `DERIVED: ${report.derived_memories.join(', ') || 'none'}\n` +
        `DERIVED (unattested): ${report.derived_unattested.join(', ') || 'none'}\n` +
        `POSSIBLE (not causal): ${report.possible_memories.join(', ') || 'none'}\n` +
        `impact ${report.impact_sha256.slice(0, 16)}...`,
    });
    AudioCues.play('trace');
    OnboardingEvents.emit('trace-run');
  }
}
