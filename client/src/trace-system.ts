/**
 * ENGRAM — Nivel 3 Causal Field. "Trace" per
 * ENGRAM-ARCHITECTURAL-INVESTIGATION.md §4: read-only, fully reversible,
 * pulls on DIRECT / DERIVED / DERIVED_UNATTESTED / POSSIBLE edges and
 * renders them as genuinely distinct — never as nodes at different
 * distances. Backed by MNEME's real causality.impact(), which its own
 * docstring says "deliberately does NOT quarantine anything": this system
 * never calls a mutating endpoint.
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
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
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
// Dashed classes are built from this many short segments; a WebGL line's
// `linewidth` is ignored by every browser, so an edge that must be visible
// across the room has to be geometry, not a line primitive.
const DASH_SEGMENTS = 14;
const UNIT_CYLINDER = new CylinderGeometry(1, 1, 1, 8, 1);
const UP = new Vector3(0, 1, 0);

const DRAW_SECONDS = 0.45;
const PULSE_GEO = new SphereGeometry(0.011, 10, 8);

type Endpoint = { memoryId: string } | { fixed: Vector3 };

type TraceLine = {
  /** Hairline fallback, used for POSSIBLE only. */
  geometry: BufferGeometry | null;
  line: Line | null;
  /** Volumetric segments for the causal classes. */
  segments: Mesh[];
  group: Group | null;
  from: Endpoint;
  to: Endpoint;
  cls: EdgeClass;
  elapsed: number;
  label: Sprite;
  pulse: Mesh | null;
  pulseOffset: number;
};

export class TraceSystem extends createSystem({}) {
  private traceEntities: Entity[] = [];
  private lines: TraceLine[] = [];
  private labels: Sprite[] = [];
  private lineMaterials: Record<EdgeClass, LineBasicMaterial> = {} as never;
  private tubeMaterials: Record<EdgeClass, MeshStandardMaterial> = {} as never;
  private qHelper = new Quaternion();
  private dirHelper = new Vector3();
  private pulseMaterials: Record<EdgeClass, MeshStandardMaterial> = {} as never;
  private markerMaterial = new MeshStandardMaterial({
    color: new Color(TRACE_STYLE.DIRECT.color), emissive: new Color(TRACE_STYLE.DIRECT.color),
    emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.4,
  });
  private rootId: string | null = null;
  private a = new Vector3();
  private b = new Vector3();
  private c = new Vector3();

  init(): void {
    for (const [key, style] of Object.entries(TRACE_STYLE) as [EdgeClass, typeof TRACE_STYLE[EdgeClass]][]) {
      this.lineMaterials[key] = new LineBasicMaterial({
        color: new Color(style.color), transparent: true, opacity: style.opacity,
      });
      this.tubeMaterials[key] = new MeshStandardMaterial({
        color: new Color(style.color), emissive: new Color(style.color),
        emissiveIntensity: 0.85, roughness: 0.35, metalness: 0.2,
        transparent: style.opacity < 1, opacity: style.opacity,
      });
      this.pulseMaterials[key] = new MeshStandardMaterial({
        color: new Color(style.color), emissive: new Color(style.color), emissiveIntensity: 1.2,
      });
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

  update(delta: number, time: number): void {
    for (const l of this.lines) {
      if (!this.resolve(l.from, this.a) || !this.resolve(l.to, this.b)) continue;
      l.elapsed += delta;
      // The whole edge set came back in one server response; only the
      // reveal is staggered, and endpoints keep following cores a hand
      // may have moved.
      const alpha = Math.min(1, l.elapsed / DRAW_SECONDS);
      this.c.lerpVectors(this.a, this.b, alpha);

      if (l.geometry && l.line) {
        const pos = l.geometry.attributes.position;
        pos.setXYZ(0, this.a.x, this.a.y, this.a.z);
        pos.setXYZ(1, this.c.x, this.c.y, this.c.z);
        pos.needsUpdate = true;
      }
      if (l.segments.length > 0) {
        this.dirHelper.subVectors(this.c, this.a);
        const length = this.dirHelper.length();
        if (length > 1e-5) {
          this.qHelper.setFromUnitVectors(UP, this.dirHelper.clone().normalize());
          const n = l.segments.length;
          const radius = TRACE_STYLE[l.cls].radius;
          // One continuous bar, or n dashes spaced along the same path.
          const span = n === 1 ? 1 : 0.58 / n;
          l.segments.forEach((seg, i) => {
            const t = n === 1 ? 0.5 : (i + 0.5) / n;
            seg.position.copy(this.a).addScaledVector(this.dirHelper, t);
            seg.quaternion.copy(this.qHelper);
            seg.scale.set(radius, n === 1 ? length : length * span, radius);
          });
        }
      }
      l.label.position.lerpVectors(this.a, this.b, 0.5);
      l.label.position.y += 0.035;
      l.label.visible = alpha >= 1;
      if (l.pulse) {
        const t = (time * 0.45 + l.pulseOffset) % 1;
        l.pulse.position.lerpVectors(this.a, this.b, t * alpha);
      }
    }
  }

  private drawLine(from: Endpoint, to: Endpoint, cls: EdgeClass): void {
    const style = TRACE_STYLE[cls];
    let geometry: BufferGeometry | null = null;
    let line: Line | null = null;
    const segments: Mesh[] = [];
    let group: Group | null = null;
    if (style.radius === 0) {
      // POSSIBLE: a bare hairline, no volume, no motion.
      geometry = new BufferGeometry().setFromPoints([new Vector3(), new Vector3()]);
      line = new Line(geometry, this.lineMaterials[cls]);
      line.frustumCulled = false;
      this.traceEntities.push(this.world.createTransformEntity(line));
    } else {
      group = new Group();
      const count = style.dashed ? DASH_SEGMENTS : 1;
      for (let i = 0; i < count; i++) {
        const seg = new Mesh(UNIT_CYLINDER, this.tubeMaterials[cls]);
        seg.frustumCulled = false;
        segments.push(seg);
        group.add(seg);
      }
      this.traceEntities.push(this.world.createTransformEntity(group));
    }
    const label = makeLabel(
      [{ text: EDGE_LABEL[cls].split(' — ')[0], color: TRACE_STYLE[cls].color, size: 22, weight: '700' },
       { text: EDGE_LABEL[cls].split(' — ')[1] ?? '', color: '#9fb3c8', size: 17 }],
      { width: 0.2, background: '#0b121bcc', border: `${TRACE_STYLE[cls].color}66` },
    );
    label.visible = false;
    this.labels.push(label);
    this.traceEntities.push(this.world.createTransformEntity(label));
    let pulse: Mesh | null = null;
    if (TRACE_STYLE[cls].pulse) {
      pulse = new Mesh(PULSE_GEO, this.pulseMaterials[cls]);
      this.traceEntities.push(this.world.createTransformEntity(pulse));
    }
    this.lines.push({
      geometry, line, segments, group, from, to, cls,
      elapsed: 0, label, pulse, pulseOffset: Math.random(),
    });
  }

  private drawMarker(kind: 'receipt' | 'decision', id: string, position: Vector3): void {
    const geometry = kind === 'receipt' ? new OctahedronGeometry(0.04) : new BoxGeometry(0.065, 0.065, 0.065);
    const mesh = new Mesh(geometry, this.markerMaterial);
    mesh.position.copy(position);
    this.traceEntities.push(this.world.createTransformEntity(mesh));
    const label = makeLabel(
      [{ text: kind === 'receipt' ? 'recall receipt' : 'recorded decision', color: TRACE_STYLE.DIRECT.color, size: 22, weight: '700' },
       { text: id.length > 22 ? `${id.slice(0, 22)}…` : id, color: '#d8e6f5', size: 18 }],
      { width: 0.22, background: '#0b121bd9', border: '#5fc9ff66' },
    );
    label.position.copy(position).y += 0.075;
    this.labels.push(label);
    this.traceEntities.push(this.world.createTransformEntity(label));
  }

  private clearTrace(): void {
    for (const l of this.labels) disposeLabel(l);
    this.labels = [];
    for (const entity of this.traceEntities) entity.dispose();
    this.traceEntities = [];
    this.lines = [];
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
      const markerPos = rootPos.clone().add(new Vector3(offset, 0.46, 0.2));
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
