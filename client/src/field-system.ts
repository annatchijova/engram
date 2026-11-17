/**
 * ENGRAM — Nivel 1 Provenance Field, Memory Observatory edition.
 *
 * Fetches the real MNEME field from the read adapter (never invents data)
 * and places every memory as a physical "memory core" on the evidence bench
 * in front of the seated investigator — no locomotion, no gravity metaphor.
 * Each core's mark/frame color comes ONLY from the fixed, declared
 * custody_status map below; the legend panel renders that exact map plus
 * the adapter's own stated meaning for each status.
 *
 * Motion policy: the field is still unless the system changed. A plate
 * moves for exactly four reasons, each a real event:
 *   - ARRIVAL: the field was read (or the observer entered the session);
 *     plates stand up in the server's list order and the room's limb lights
 *     with the fraction that has arrived. A failed read lights nothing.
 *   - ATTENTION: a pointer rests on a plate; its sheets part slightly and
 *     ivory focus brackets frame it.
 *   - OPEN: the record is selected, or a pinch holds it in the hand; the
 *     sheets open fully and, when selected, the brackets close on it.
 *   - CUSTODY CHANGE: MNEME reported a different status after a refresh;
 *     the mark's colour moves from the old declared hue to the new one.
 * All four are identical for every custody status: motion, size and
 * brightness never encode authority or truth. There is no idle animation.
 */
import {
  Color,
  createSystem,
  Group,
  Entity,
  Grabbed,
  Hovered,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  DistanceGrabbable,
  DoubleSide,
  MovementMode,
  RayInteractable,
  Shape,
  ShapeGeometry,
  Sprite,
  TorusGeometry,
  UIKitMLAsset,
  Vector3,
} from '@iwsdk/core';
import { EngramApi } from './engram-api.js';
import { FieldEvents } from './field-events.js';
import { disposeLabel, makeLabel } from './observatory/labels.js';
import { buildMemoryCore, CoreMaterials, MemoryCore, placeCaption, PLATE, setPlateSpread } from './observatory/memory-core.js';
import { ObservatoryScene } from './observatory/observatory-handles.js';
import { OBS, OBSERVATORY } from './observatory/palette.js';
import { CustodyStatus, MemoryNode } from './memory-node-component.js';
import { SelectedMemory } from './selected-memory.js';
import { TourState } from './tour-state.js';
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
const TRANSITION_SECONDS = 0.9;

// Arrival choreography. One plate every ARRIVAL_STAGGER seconds, in the
// order the server listed them; each takes ARRIVAL_SECONDS to stand up.
const ARRIVAL_STAGGER = 0.14;
const ARRIVAL_SECONDS = 0.9;
/** A beat of stillness before the first plate, so the dark room registers. */
const ARRIVAL_LEAD_IN = 0.7;

type ColorTransition = {
  crystal: MeshStandardMaterial;
  halo: MeshBasicMaterial;
  from: Color;
  to: Color;
  toStatus: string;
  core: MemoryCore;
  elapsed: number;
};

type PlacedCore = {
  entity: Entity;
  core: MemoryCore;
  memoryId: string;
  /** Identity + status. Always-on caption. */
  caption: Sprite;
  /** Identity + status + plain gloss. Shown while attended or open. */
  captionFull: Sprite;
  /** Seconds after the arrival clock's zero at which this plate starts. */
  arrivalAt: number;
};

/** Request/transport states shown ON a core. Deliberately NOT custody
 * states: they are rendered in a neutral instrument grey that appears in
 * no custody map, and always carry text saying so. */
export type CoreState = 'idle' | 'loading' | 'failed';
type StateMark = { entity: Entity; group: Group; ring: Mesh; label: Sprite; state: CoreState };

const STATE_RING_GEO = new TorusGeometry(0.075, 0.0035, 8, 44);
// Neutral instrument grey: never a custody hue, so a transport failure can
// never read as a MNEME state.
const STATE_COLOR = '#c3ccd8';

/** Four corner brackets framing a plate: the bracket of the ENGRAM mark,
 * used as the room's one focus indicator. */
function bracketGeometry(w: number, h: number, arm: number, t: number): ShapeGeometry {
  const shapes: Shape[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const x = (sx * w) / 2;
    const y = (sy * h) / 2;
    const s = new Shape();
    s.moveTo(x, y);
    s.lineTo(x - sx * arm, y);
    s.lineTo(x - sx * arm, y - sy * t);
    s.lineTo(x - sx * t, y - sy * t);
    s.lineTo(x - sx * t, y - sy * arm);
    s.lineTo(x, y - sy * arm);
    s.closePath();
    shapes.push(s);
  }
  return new ShapeGeometry(shapes);
}
const BRACKET_GEO = bracketGeometry(PLATE.width + 0.05, PLATE.height + 0.05, 0.024, 0.0034);

type Focus = { mesh: Mesh; material: MeshBasicMaterial; scale: number; opacity: number };

function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

export class FieldSystem extends createSystem({
  nodes: { required: [MemoryNode] },
}) {
  private crystalMaterials: Record<string, MeshStandardMaterial> = {};
  private haloMaterials: Record<string, MeshBasicMaterial> = {};
  private fallbackCrystal = makeCrystalMaterial(UNKNOWN_STATUS_COLOR);
  private fallbackHalo = makeHaloMaterial(UNKNOWN_STATUS_COLOR);
  // Glass: a standard material, not a physical one. Clearcoat and
  // transmission cost a second lighting pass per fragment on a mobile GPU
  // for a difference nobody reads at 1.5 m; the layered look comes from
  // three real sheets and their parallax, not from the shader.
  private capsuleMaterial = new MeshStandardMaterial({
    color: new Color(OBS.glass),
    transparent: true,
    opacity: 0.11,
    roughness: 0.06,
    metalness: 0.0,
    depthWrite: false,
    side: DoubleSide,
  });
  private baseMaterial = new MeshStandardMaterial({
    color: new Color(OBS.metal), roughness: 0.5, metalness: 0.55,
  });
  private baseEdgeMaterial = new LineBasicMaterial({ color: new Color(OBS.ivory) });
  private edgeMaterial = new MeshBasicMaterial({
    color: new Color(OBS.ivory), transparent: true, opacity: 0.42, side: DoubleSide, depthWrite: false,
  });
  private cageMaterial = new MeshBasicMaterial({
    color: new Color(CUSTODY_COLOR[CustodyStatus.QUARANTINED]),
  });

  private placed: PlacedCore[] = [];
  private previousStatus = new Map<string, string>();
  private transitions: ColorTransition[] = [];
  // Focus brackets: interaction feedback only, ivory, identical for every
  // custody status. One pair follows the pointer, one holds the selection.
  private hoverFocus = makeFocus();
  private selectFocus = makeFocus();
  private stateMarks = new Map<string, StateMark>();
  private stateMaterial = new MeshBasicMaterial({
    color: new Color(STATE_COLOR), transparent: true, opacity: 0.9,
  });
  private scratch = new Vector3();
  /** Seconds since the current arrival began; negative during the lead-in. */
  private arrivalClock = Number.POSITIVE_INFINITY;
  private arrived = false;

  init(): void {
    for (const [status, hex] of Object.entries(CUSTODY_COLOR)) {
      this.crystalMaterials[status] = makeCrystalMaterial(hex);
      this.haloMaterials[status] = makeHaloMaterial(hex);
    }
    this.world.createTransformEntity(this.hoverFocus.mesh);
    this.world.createTransformEntity(this.selectFocus.mesh);
    // Entering the immersive session is an arrival too: the observer was
    // not in the room when the page first read the field, so the field
    // presents itself again. No data is re-fetched or altered by this.
    const xr = this.world.renderer.xr;
    const onSessionStart = () => { if (this.arrived) this.beginArrival(); };
    xr.addEventListener('sessionstart', onSessionStart);
    this.cleanupFuncs.push(() => xr.removeEventListener('sessionstart', onSessionStart));
    void this.refresh();
  }

  /** Restart the arrival choreography for the cores currently placed. */
  private beginArrival(): void {
    this.arrivalClock = -ARRIVAL_LEAD_IN;
    this.placed.forEach((p, i) => { p.arrivalAt = i * ARRIVAL_STAGGER; });
  }

  update(delta: number): void {
    const selectedId = SelectedMemory.get();
    const welcome = TourState.get() === 'WELCOME';
    const smoothing = 1 - Math.exp(-delta * 9);
    let selectedCore: MemoryCore | null = null;
    let hoveredCore: MemoryCore | null = null;
    if (this.arrivalClock < 1e6) this.arrivalClock += delta;
    let presence = 0;

    for (const p of this.placed) {
      const { core, entity } = p;
      const hovered = entity.hasComponent(Hovered);
      // A pinch that holds the core is a real event, like opening it: the
      // sheets open fully in the hand so the mark can be read up close.
      // Presentation only, and identical for every custody status.
      const held = entity.hasComponent(Grabbed);
      const selected = p.memoryId === selectedId;
      if (selected) selectedCore = core;
      else if (hovered) hoveredCore = core;

      const t = Math.min(1, Math.max(0, (this.arrivalClock - p.arrivalAt) / ARRIVAL_SECONDS));
      const arrival = easeOutCubic(t);
      core.arrival = arrival;
      presence += arrival;
      core.float.visible = t > 0;
      core.float.scale.setScalar(0.9 + 0.1 * arrival);

      // Focus: while one memory is open, the other captions step back so
      // the provenance tower and edges have room to read. Plates themselves
      // stay fully visible; only text yields. An attended or open plate
      // shows the longer caption with the plain-language gloss.
      // On the welcome card no caption is shown at all: first contact is
      // one question, not nine captions.
      const captionOn = !welcome && t >= 1 && (selectedId === null || selected || hovered);
      const full = selected || hovered;
      p.caption.visible = captionOn && !full;
      p.captionFull.visible = captionOn && full;

      const targetSpread = Math.max(selected || held ? 1 : hovered ? 0.4 : 0, 1 - arrival);
      const targetLift = (selected ? 0.03 : 0) - (1 - arrival) * 0.05;
      setPlateSpread(core, core.spread + (targetSpread - core.spread) * smoothing);
      core.float.position.y += (targetLift - core.float.position.y) * smoothing;
    }
    ObservatoryScene.setFieldPresence(this.placed.length ? presence / this.placed.length : 0);

    this.driveFocus(this.selectFocus, selectedCore, 1.0, 0.95, smoothing);
    this.driveFocus(this.hoverFocus, hoveredCore, 1.12, 0.6, smoothing);

    // Transport-state marks ride their core and turn only while loading.
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
        // The sheets open while the record is being re-marked and close as
        // the new status settles: the change is visible as an event, not
        // only as a different colour found later.
        setPlateSpread(t.core, Math.max(t.core.spread, Math.sin(alpha * Math.PI)));
      }
    }
  }

  private driveFocus(focus: Focus, core: MemoryCore | null, scale: number, opacity: number, k: number): void {
    if (core) {
      if (!focus.mesh.visible) {
        // Appear wide and close in: the eye is led to the plate.
        focus.scale = scale * 1.25;
        focus.opacity = 0;
        focus.mesh.visible = true;
      }
      core.float.getWorldPosition(focus.mesh.position);
      core.root.getWorldQuaternion(focus.mesh.quaternion);
      focus.scale += (scale - focus.scale) * k;
      focus.opacity += (opacity - focus.opacity) * k;
    } else if (focus.mesh.visible) {
      focus.opacity += (0 - focus.opacity) * k * 1.5;
      if (focus.opacity < 0.02) focus.mesh.visible = false;
    }
    focus.mesh.scale.setScalar(focus.scale);
    focus.material.opacity = focus.opacity;
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
    ring.position.y = 0.125;
    group.add(ring);
    const label = state === 'loading'
      ? makeLabel(
          [{ text: 'READING RECORD', color: STATE_COLOR, size: 22, weight: '700' },
           { text: 'request in flight', color: OBS.ivoryDim, size: 21 }],
          { width: 0.24, background: '#000000e0', border: STATE_COLOR },
        )
      : makeLabel(
          [{ text: 'READ FAILED', color: STATE_COLOR, size: 22, weight: '700' },
           { text: 'transport error, not a custody status', color: OBS.ivoryDim, size: 21 }],
          { width: 0.3, background: '#000000e0', border: STATE_COLOR },
        );
    label.position.y = 0.2;
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
      disposeLabel(p.caption);
      disposeLabel(p.captionFull);
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
        edge: this.edgeMaterial,
        cage: this.cageMaterial,
      };

      const presentation = CUSTODY_PRESENTATION[m.custody_status];
      // Identity and state only: topic and excerpt belong to the hover
      // card and the inspector (progressive disclosure), so the field reads
      // as objects, not as a wall of text. The plain gloss joins the
      // caption while the plate is attended or open.
      const statusColor = knownStatus ? CUSTODY_COLOR[m.custody_status] : UNKNOWN_STATUS_COLOR;
      const idLine = { text: m.memory_id, color: OBS.ivory, size: 27, weight: '500', font: 'mono' as const };
      const statusLine = {
        text: presentation ? `${presentation.glyph} ${m.custody_status}` : `? ${m.custody_status} (unmapped)`,
        // SUPERSEDED's declared grey is too dark to read as text on ink; the
        // caption states the status in words and glyph, the mark keeps the hex.
        color: m.custody_status === CustodyStatus.SUPERSEDED ? '#a3a7ae' : statusColor,
        size: 22,
        weight: '700',
      };
      const caption = makeLabel([idLine, statusLine], { width: 0.25, background: '#000000b8' });
      const captionFull = makeLabel(
        [idLine, statusLine,
         { text: CUSTODY_GLOSS[m.custody_status] ?? 'status not in this client\'s vocabulary', color: OBS.ivoryDim, size: 21 }],
        { width: 0.27, background: '#000000ee', border: OBS.ivory },
      );

      const core = buildMemoryCore(
        materials, caption, m.custody_status === CustodyStatus.QUARANTINED, i * 0.9,
      );
      placeCaption(captionFull);
      captionFull.visible = false;
      core.root.add(captionFull);
      core.root.position.set(x, coreHeight, z);
      // Face the seated viewer so the sheets read squarely; orientation is
      // presentation only and encodes no relationship.
      core.root.lookAt(0, coreHeight, 0);

      if (changed) {
        this.transitions.push({
          crystal: materials.crystal as MeshStandardMaterial,
          halo: materials.halo as MeshBasicMaterial,
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
      // A refresh after the first arrival (a commit, for instance) does not
      // replay the entrance: those plates are already standing.
      this.placed.push({ entity, core, memoryId: m.memory_id, caption, captionFull, arrivalAt: -ARRIVAL_SECONDS });
      nextStatus.set(m.memory_id, m.custody_status);
    });
    this.previousStatus = nextStatus;
    if (!this.arrived) {
      this.arrived = true;
      this.beginArrival();
    }
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
      // Label and gloss are two stacked lines. Writing the whole sentence
      // into the label wrapped it over the gloss beneath, so the count stays
      // on the label and MNEME's own wording replaces the plain-language
      // placeholder only when the engine actually supplied one.
      text?.setProperties({ text: `${status} (${n})` });
      const engineMeaning = meaning[status];
      if (engineMeaning) {
        legend.getElementById(`gloss-${status}`)?.setProperties({ text: engineMeaning });
      }
    }
    legend.getElementById('legend-field')?.setProperties({
      text: `${overview.total_memories} memories / field_version ${overview.field_version}`,
    });
    legend.getElementById('legend-status')?.setProperties({ display: 'none' });
    this.world.getSceneObject<UIKitMLAsset>('welcome-panel')?.getElementById('welcome-status')?.setProperties({
      text: `Live field: ${overview.total_memories} memories, field_version ${overview.field_version}.`,
      color: OBS.ivoryDim,
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
      color: STATE_COLOR,
      display: 'flex',
    });
    // The welcome card is the first thing a newcomer reads: it must carry
    // the failure too, or the room looks merely empty.
    this.world.getSceneObject<UIKitMLAsset>('welcome-panel')?.getElementById('welcome-status')?.setProperties({
      text: `FAILED to load the field: ${(err as Error).message ?? err}`,
      color: STATE_COLOR,
    });
  }
}

function makeFocus(): Focus {
  const material = new MeshBasicMaterial({
    color: new Color(OBS.selected), transparent: true, opacity: 0, side: DoubleSide, depthWrite: false,
  });
  const mesh = new Mesh(BRACKET_GEO, material);
  mesh.visible = false;
  mesh.renderOrder = 6;
  mesh.raycast = () => {};
  return { mesh, material, scale: 1, opacity: 0 };
}

// The custody mark is lit, so it has facets; emissive keeps the declared
// hue readable in shadow. Intensity is the same for every status.
function makeCrystalMaterial(hex: string): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: new Color(hex),
    emissive: new Color(hex),
    emissiveIntensity: 0.75,
    roughness: 0.3,
    metalness: 0.1,
    flatShading: true,
  });
}

// The custody frame is unlit: the declared hex, exactly, from any angle.
function makeHaloMaterial(hex: string): MeshBasicMaterial {
  return new MeshBasicMaterial({ color: new Color(hex), side: DoubleSide });
}
