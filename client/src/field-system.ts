/**
 * ENGRAM — Nivel 1 Provenance Field, Memory Observatory edition.
 *
 * Fetches the real MNEME field from the read adapter (never invents data)
 * and places every memory as a physical "memory core" on the evidence bench
 * in front of the seated investigator — no locomotion, no gravity metaphor.
 * Each core's crystal/halo color comes ONLY from the fixed, declared
 * custody_status map below; the legend panel renders that exact map plus
 * the adapter's own stated meaning for each status.
 *
 * Interaction feedback (hover swell, selection lift and beam, the slow bob
 * and crystal spin) is presentation only and identical for every status:
 * motion, size and brightness never encode authority or truth.
 */
import {
  Color,
  createSystem,
  CylinderGeometry,
  Group,
  Entity,
  Hovered,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  DistanceGrabbable,
  MovementMode,
  RayInteractable,
  Sprite,
  TorusGeometry,
  UIKitMLAsset,
  Vector3,
} from '@iwsdk/core';
import { EngramApi } from './engram-api.js';
import { FieldEvents } from './field-events.js';
import { disposeLabel, makeLabel } from './observatory/labels.js';
import { buildMemoryCore, CoreMaterials, MemoryCore } from './observatory/memory-core.js';
import { OBS, OBSERVATORY } from './observatory/palette.js';
import { CustodyStatus, MemoryNode } from './memory-node-component.js';
import { SelectedMemory } from './selected-memory.js';
import { CUSTODY_PRESENTATION } from './shared-projection.js';
import { CUSTODY_GLOSS } from './tour-script.js';

// Declared once, referenced everywhere a status needs a color — this is
// the single place the custody_status -> appearance mapping is allowed
// to exist. Brightness/size must never imply authority or truth (see
// ENGRAM-ARCHITECTURAL-INVESTIGATION.md, "Geometry is evidence-bearing").
export const CUSTODY_COLOR: Record<string, string> = {
  [CustodyStatus.CLEAN]: '#3fa34d',
  [CustodyStatus.TAINT_FLAGGED]: '#e0a62b',
  [CustodyStatus.QUARANTINED]: '#c13030',
  [CustodyStatus.SUPERSEDED]: '#6b6f76',
};

const UNKNOWN_STATUS_COLOR = '#999999';
// update(delta)'s delta is in seconds (three.js Clock convention, confirmed
// by the reference examples); accumulating delta keeps this independent of
// the absolute time epoch.
const TRANSITION_SECONDS = 0.6;

type ColorTransition = {
  crystal: MeshPhysicalMaterial;
  halo: MeshStandardMaterial;
  from: Color;
  to: Color;
  toStatus: string;
  core: MemoryCore;
  elapsed: number;
};

type PlacedCore = { entity: Entity; core: MemoryCore; memoryId: string };

/** Request/transport states shown ON a core. Deliberately NOT custody
 * states: they are rendered in a neutral instrument grey that appears in
 * no custody map, and always carry text saying so. */
export type CoreState = 'idle' | 'loading' | 'failed';
type StateMark = { entity: Entity; group: Group; ring: Mesh; label: Sprite; state: CoreState };

const STATE_RING_GEO = new TorusGeometry(0.115, 0.0045, 8, 44);
const SELECT_RING_GEO = new TorusGeometry(0.105, 0.0035, 8, 48);
// Neutral instrument grey: never a custody hue, so a transport failure can
// never read as a MNEME state.
const STATE_COLOR = '#c3ccd8';

export class FieldSystem extends createSystem({
  nodes: { required: [MemoryNode] },
}) {
  private crystalMaterials: Record<string, MeshPhysicalMaterial> = {};
  private haloMaterials: Record<string, MeshStandardMaterial> = {};
  private fallbackCrystal = makeCrystalMaterial(UNKNOWN_STATUS_COLOR);
  private fallbackHalo = makeHaloMaterial(UNKNOWN_STATUS_COLOR);
  private capsuleMaterial = new MeshPhysicalMaterial({
    color: new Color(OBS.glass),
    transparent: true,
    opacity: 0.16,
    roughness: 0.08,
    metalness: 0.0,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    depthWrite: false,
  });
  private baseMaterial = new MeshStandardMaterial({
    color: new Color(OBS.metal), roughness: 0.35, metalness: 0.7,
  });
  private baseEdgeMaterial = new LineBasicMaterial({ color: new Color('#5a6b80') });
  private cageMaterial = new MeshStandardMaterial({
    color: new Color(CUSTODY_COLOR[CustodyStatus.QUARANTINED]),
    emissive: new Color(CUSTODY_COLOR[CustodyStatus.QUARANTINED]),
    emissiveIntensity: 0.6,
    wireframe: true,
  });

  private placed: PlacedCore[] = [];
  private previousStatus = new Map<string, string>();
  private transitions: ColorTransition[] = [];
  // Selection beam: a soft column of light from the ceiling onto the
  // selected core. Interaction feedback, not evidence.
  private beam = new Mesh(
    new CylinderGeometry(0.02, 0.11, 2.4, 20, 1, true),
    new MeshBasicMaterial({
      color: new Color(OBS.selected), transparent: true, opacity: 0.12, depthWrite: false,
    }),
  );
  private beamEntity: Entity | null = null;
  // One selection ring, moved under whichever core is selected: pure
  // interaction feedback, identical for every custody status.
  private selectRing = new Mesh(
    SELECT_RING_GEO,
    new MeshStandardMaterial({
      color: new Color(OBS.selected), emissive: new Color(OBS.selected),
      emissiveIntensity: 1.3, transparent: true, opacity: 0.9,
    }),
  );
  private stateMarks = new Map<string, StateMark>();
  private stateMaterial = new MeshStandardMaterial({
    color: new Color(STATE_COLOR), emissive: new Color(STATE_COLOR),
    emissiveIntensity: 0.9, transparent: true, opacity: 0.9,
  });
  private scratch = new Vector3();

  init(): void {
    for (const [status, hex] of Object.entries(CUSTODY_COLOR)) {
      this.crystalMaterials[status] = makeCrystalMaterial(hex);
      this.haloMaterials[status] = makeHaloMaterial(hex);
    }
    this.beam.visible = false;
    this.beamEntity = this.world.createTransformEntity(this.beam);
    this.selectRing.rotation.x = Math.PI / 2;
    this.selectRing.visible = false;
    this.world.createTransformEntity(this.selectRing);
    void this.refresh();
  }

  update(delta: number, time: number): void {
    const selectedId = SelectedMemory.get();
    const smoothing = 1 - Math.exp(-delta * 9);
    let selectedCore: MemoryCore | null = null;

    for (const p of this.placed) {
      const { core, entity } = p;
      const hovered = entity.hasComponent(Hovered);
      const selected = p.memoryId === selectedId;
      if (selected) selectedCore = core;
      // Focus: while one memory is open, the other labels step back so the
      // provenance tower and edges have room to read. Cores themselves stay
      // fully visible; only text yields.
      core.label.visible = selectedId === null || selected || hovered;
      const targetScale = selected ? 1.22 : hovered ? 1.1 : 1;
      const targetLift = selected ? 0.1 : 0;
      const bob = Math.sin(time * 1.1 + core.phase) * 0.01;
      const s = core.float.scale.x + (targetScale - core.float.scale.x) * smoothing;
      core.float.scale.setScalar(s);
      core.float.position.y += (targetLift + bob - core.float.position.y) * smoothing;
      core.crystal.rotation.y += delta * (selected ? 1.6 : 0.55);
      core.halo.rotation.z += delta * 0.8;
    }

    if (selectedCore) {
      selectedCore.root.getWorldPosition(this.scratch);
      this.beam.position.set(this.scratch.x, this.scratch.y + 1.25, this.scratch.z);
      this.beam.visible = true;
      this.selectRing.position.set(this.scratch.x, this.scratch.y - 0.15, this.scratch.z);
      this.selectRing.rotation.z += delta * 0.4;
      this.selectRing.visible = true;
    } else {
      this.beam.visible = false;
      this.selectRing.visible = false;
    }

    // Transport-state marks ride their core and pulse only while loading.
    for (const [memoryId, mark] of this.stateMarks) {
      if (this.getCoreWorldPosition(memoryId, this.scratch)) {
        mark.group.position.copy(this.scratch);
      }
      if (mark.state === 'loading') mark.ring.rotation.z += delta * 2.4;
    }

    for (let i = this.transitions.length - 1; i >= 0; i--) {
      const t = this.transitions[i];
      t.elapsed += delta;
      const alpha = Math.min(1, t.elapsed / TRANSITION_SECONDS);
      if (alpha >= 1) {
        // Finished: hand the core back to the shared status materials and
        // dispose the transitional instances so they do not leak.
        t.core.crystal.material = this.crystalMaterials[t.toStatus] ?? this.fallbackCrystal;
        t.core.halo.material = this.haloMaterials[t.toStatus] ?? this.fallbackHalo;
        t.crystal.dispose();
        t.halo.dispose();
        this.transitions.splice(i, 1);
      } else {
        t.crystal.color.lerpColors(t.from, t.to, alpha);
        t.crystal.emissive.copy(t.crystal.color);
        t.halo.color.copy(t.crystal.color);
        t.halo.emissive.copy(t.crystal.color);
      }
    }
  }

  /** Show a transport state on one core: a request in flight (LOADING) or
   * a read that did not return (FAILED). Never a MNEME value — the mark is
   * grey and says so in words. `idle` removes it. */
  setCoreState(memoryId: string, state: CoreState): void {
    const existing = this.stateMarks.get(memoryId);
    if (existing) {
      disposeLabel(existing.label);
      existing.entity.dispose();
      this.stateMarks.delete(memoryId);
    }
    if (state === 'idle') return;
    const group = new Group();
    const ring = new Mesh(STATE_RING_GEO, this.stateMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.2;
    group.add(ring);
    const label = state === 'loading'
      ? makeLabel(
          [{ text: 'READING RECORD...', color: STATE_COLOR, size: 22, weight: '700' },
           { text: 'request in flight', color: '#8d98a6', size: 17 }],
          { width: 0.2, background: '#0b121bd9', border: '#c3ccd866' },
        )
      : makeLabel(
          [{ text: 'READ FAILED', color: STATE_COLOR, size: 22, weight: '700' },
           { text: 'transport error, not a custody status', color: '#8d98a6', size: 17 }],
          { width: 0.24, background: '#0b121bd9', border: '#c3ccd866' },
        );
    label.position.y = 0.3;
    group.add(label);
    if (this.getCoreWorldPosition(memoryId, this.scratch)) group.position.copy(this.scratch);
    const entity = this.world.createTransformEntity(group);
    this.stateMarks.set(memoryId, { entity, group, ring, label, state });
  }

  /** World position of a rendered core (the bench slot, or wherever a hand
   * left it). Undefined when the id is not in the rendered field. */
  getCoreWorldPosition(memoryId: string, target: Vector3): Vector3 | undefined {
    const p = this.placed.find((x) => x.memoryId === memoryId);
    if (!p) return undefined;
    p.core.root.getWorldPosition(target);
    return target;
  }

  getCoreObject(memoryId: string): Object3D | undefined {
    return this.placed.find((x) => x.memoryId === memoryId)?.core.root;
  }

  /** Re-fetches the field and rebuilds the memory cores. Public so
   * ContainmentSystem can call it after a commit changes custody_status. */
  async refresh(): Promise<void> {
    const legend = this.world.getSceneObject<UIKitMLAsset>('legend-panel');

    let overview;
    try {
      overview = await EngramApi.overview();
    } catch (err) {
      this.reportLoadError(legend, err);
      return;
    }
    this.populateLegend(legend, overview.custody_status_meaning, overview);

    let memories;
    try {
      memories = (await EngramApi.listMemories()).memories;
    } catch (err) {
      this.reportLoadError(legend, err);
      return;
    }

    for (const p of this.placed) {
      disposeLabel(p.core.label);
      p.entity.dispose();
    }
    this.placed = [];
    for (const memoryId of Array.from(this.stateMarks.keys())) this.setCoreState(memoryId, 'idle');
    for (const t of this.transitions) { t.crystal.dispose(); t.halo.dispose(); }
    this.transitions = [];

    const count = memories.length;
    const spanRad = (OBSERVATORY.benchSpanDeg * Math.PI) / 180;
    const { benchCenter, benchRadius, coreHeight } = OBSERVATORY;
    const nextStatus = new Map<string, string>();

    memories.forEach((m, i) => {
      const angle = count <= 1 ? 0 : -spanRad / 2 + (spanRad * i) / (count - 1);
      const x = benchCenter.x + benchRadius * Math.sin(angle);
      const z = benchCenter.z - benchRadius * Math.cos(angle);

      const knownStatus = CUSTODY_COLOR[m.custody_status] !== undefined;
      const priorStatus = this.previousStatus.get(m.memory_id);
      // A real, server-confirmed change (never a guess, never on click):
      // this memory existed before refresh() and its status is now
      // different. Start the core on its OWN materials at the OLD color and
      // let update() lerp toward the new one — only CUSTODY_COLOR values
      // are ever either endpoint.
      const changed = priorStatus !== undefined && priorStatus !== m.custody_status
        && CUSTODY_COLOR[priorStatus] !== undefined && knownStatus;

      const materials: CoreMaterials = {
        crystal: changed
          ? makeCrystalMaterial(CUSTODY_COLOR[priorStatus!])
          : (this.crystalMaterials[m.custody_status] ?? this.fallbackCrystal),
        halo: changed
          ? makeHaloMaterial(CUSTODY_COLOR[priorStatus!])
          : (this.haloMaterials[m.custody_status] ?? this.fallbackHalo),
        capsule: this.capsuleMaterial,
        base: this.baseMaterial,
        baseEdge: this.baseEdgeMaterial,
        cage: this.cageMaterial,
      };

      const presentation = CUSTODY_PRESENTATION[m.custody_status];
      // Identity and state only: topic and excerpt belong to the hover
      // card and the inspector (progressive disclosure), so the field reads
      // as objects, not as a wall of text.
      const label = makeLabel(
        [
          { text: m.memory_id, color: '#f2f6fa', size: 32, weight: '700' },
          {
            text: presentation ? `${presentation.glyph} ${m.custody_status}` : `? ${m.custody_status} (unmapped)`,
            color: knownStatus ? CUSTODY_COLOR[m.custody_status] : UNKNOWN_STATUS_COLOR,
            size: 25,
            weight: '600',
          },
          { text: CUSTODY_GLOSS[m.custody_status] ?? 'status not in this client\'s vocabulary', color: '#9fb3c8', size: 18 },
        ],
        { width: 0.26, background: '#0b121bd9', border: '#2a3a4d' },
      );

      const core = buildMemoryCore(
        materials, label, m.custody_status === CustodyStatus.QUARANTINED, i * 0.9,
      );
      core.root.position.set(x, coreHeight, z);
      // Face the seated viewer so the containment cage reads squarely;
      // orientation is presentation only and encodes no relationship.
      core.root.lookAt(0, coreHeight, 0);

      if (changed) {
        this.transitions.push({
          crystal: materials.crystal as MeshPhysicalMaterial,
          halo: materials.halo as MeshStandardMaterial,
          from: new Color(CUSTODY_COLOR[priorStatus!]),
          to: new Color(CUSTODY_COLOR[m.custody_status]),
          toStatus: m.custody_status,
          core,
          elapsed: 0,
        });
      }

      const entity = this.world.createTransformEntity(core.root);
      entity.addComponent(RayInteractable);
      // Hands-first, one pointer: a short pinch/trigger on the ray selects
      // the core (Pressed -> SelectionSystem); a held pinch grabs it along
      // the same ray so it can be pulled off the bench and turned to read.
      // DistanceGrabbable is deliberate: GrabSystem marks OneHandGrabbable
      // objects `pointerEventsType = { deny: 'ray' }`, which made cores
      // unreachable by the XR ray entirely (verified in the emulated Quest 3
      // runtime). Moving a core is presentation only — a position in the
      // scene graph, never a MNEME write. refresh() rebuilds every core, so
      // a moved core's position resets on the next real custody change.
      entity.addComponent(DistanceGrabbable, {
        movementMode: MovementMode.MoveFromTarget,
        scale: false,
        translateMin: [-2.4, 0.5, -3.2],
        translateMax: [2.4, 2.2, -0.05],
      });
      entity.addComponent(MemoryNode, {
        memoryId: m.memory_id,
        custodyStatus: m.custody_status,
        topic: m.topic ?? '',
        contentPreview: m.content_preview ?? '',
      });
      this.placed.push({ entity, core, memoryId: m.memory_id });
      nextStatus.set(m.memory_id, m.custody_status);
    });
    this.previousStatus = nextStatus;
    FieldEvents.emitRefreshed();
  }

  private populateLegend(
    legend: UIKitMLAsset | undefined,
    meaning: Record<string, string>,
    overview: { total_memories: number; field_version: number; custody_status_distribution: Record<string, number> },
  ): void {
    if (!legend) return;
    for (const status of Object.keys(CUSTODY_COLOR)) {
      const swatch = legend.getElementById(`swatch-${status}`);
      const text = legend.getElementById(`text-${status}`);
      const n = overview.custody_status_distribution[status] ?? 0;
      swatch?.setProperties({ backgroundColor: CUSTODY_COLOR[status] });
      text?.setProperties({ text: `${status} (${n}) - ${meaning[status] ?? 'unknown'}` });
    }
    legend.getElementById('legend-field')?.setProperties({
      text: `${overview.total_memories} memories / field_version ${overview.field_version}`,
    });
    legend.getElementById('legend-status')?.setProperties({ display: 'none' });
    this.world.getSceneObject<UIKitMLAsset>('welcome-panel')?.getElementById('welcome-status')?.setProperties({
      text: `Live field: ${overview.total_memories} memories, field_version ${overview.field_version}.`,
      color: '#7fd4a8',
    });
  }

  private reportLoadError(legend: UIKitMLAsset | undefined, err: unknown): void {
    // Honest degradation (CLAUDE.md §5.3): a failed fetch must show a
    // visible FAIL, never an empty bench that looks like "zero memories".
    // eslint-disable-next-line no-console
    console.error('[ENGRAM] failed to load field from adapter:', err);
    const status = legend?.getElementById('legend-status');
    status?.setProperties({
      text: `FAILED to load field: ${(err as Error).message ?? err}`,
      color: '#ff8080',
      display: 'flex',
    });
    // The welcome card is the first thing a newcomer reads: it must carry
    // the failure too, or the room looks merely empty.
    this.world.getSceneObject<UIKitMLAsset>('welcome-panel')?.getElementById('welcome-status')?.setProperties({
      text: `FAILED to load the field: ${(err as Error).message ?? err}`,
      color: '#ff8080',
    });
  }
}

function makeCrystalMaterial(hex: string): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    color: new Color(hex),
    emissive: new Color(hex),
    emissiveIntensity: 0.5,
    roughness: 0.22,
    metalness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.15,
  });
}

function makeHaloMaterial(hex: string): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: new Color(hex),
    emissive: new Color(hex),
    emissiveIntensity: 1.6,
    roughness: 0.4,
    metalness: 0.2,
  });
}
