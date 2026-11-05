/**
 * ENGRAM — Nivel 1 Provenance Field.
 *
 * Fetches the real MNEME field from the read adapter (never invents data)
 * and lays memories out as a seated arc in front of the player — no
 * locomotion, no gravity/explosion metaphor. Each node's color comes ONLY
 * from a fixed, declared custody_status map; the legend panel renders that
 * exact map plus the adapter's own stated meaning for each status, so the
 * mapping is never implicit.
 */
import {
  Color,
  createSystem,
  Entity,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  BoxGeometry,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  OneHandGrabbable,
  RayInteractable,
  UIKitMLAsset,
} from '@iwsdk/core';
import { EngramApi } from './engram-api.js';
import { CustodyStatus, MemoryNode } from './memory-node-component.js';

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

const ARC_CENTER = { x: 0, y: 1.3, z: -1.6 };
const ARC_RADIUS = 0.9;
const ARC_SPAN_DEG = 140;
// update(delta, time)'s units aren't documented; the reference example
// (elevator.ts: Math.sin(time * 0.5) as a slow bob) only makes sense if
// both are in SECONDS, matching three.js Clock convention. Tracking
// elapsed-via-delta-accumulation instead of an absolute clock means this
// transition is correct regardless of what time's epoch/zero-point is.
const TRANSITION_SECONDS = 0.4;

// One real custody-status change, mid-lerp between its old and new
// CUSTODY_COLOR entries — never a third color, never started before
// refresh() already applied the server's real new status.
type ColorTransition = {
  material: MeshStandardMaterial;
  from: Color;
  to: Color;
  toStatus: string;
  mesh: Mesh;
  elapsed: number;
};

export class FieldSystem extends createSystem({}) {
  // Evidence slabs, not spheres: a flat forensic tag whose face takes the
  // custody material. Size is reading distance only — never authority.
  private geometry = new BoxGeometry(0.21, 0.13, 0.025);
  // A thin, neutral-gray edge outline shared by every slab regardless of
  // custody_status — purely a "card has a defined edge" cosmetic. It is
  // the same color/width on every node, so it carries no evidence meaning
  // on its own; only CUSTODY_COLOR does that.
  private edgeGeometry = new EdgesGeometry(this.geometry);
  private edgeMaterial = new LineBasicMaterial({ color: new Color('#05070a') });
  private nodeEntities: Entity[] = [];
  // One shared material per custody_status: N nodes × M refreshes must not
  // mint a new MeshStandardMaterial each — the custody→appearance mapping
  // is CUSTODY_COLOR, and sharing enforces that literally (mutating a
  // shared material would recolor every node of that status at once).
  // roughness/metalness/emissive are rendering quality only: every status
  // material gets the SAME values, differing only in the CUSTODY_COLOR hex
  // itself (used for both base color and emissive) — no second channel of
  // evidence meaning is introduced.
  private statusMaterials: Record<string, MeshStandardMaterial> = {};
  private fallbackMaterial = new MeshStandardMaterial({
    color: new Color('#999999'),
    emissive: new Color('#999999'),
    emissiveIntensity: 0.12,
    roughness: 0.4,
    metalness: 0.2,
  });
  // memory_id -> custody_status as of the last refresh, so the next refresh
  // can tell which specific nodes actually changed (never animate a status
  // that didn't really change, never guess from a recreated/disposed node).
  private previousStatus = new Map<string, string>();
  // Reused every frame — never allocate inside update().
  private transitions: ColorTransition[] = [];

  init(): void {
    for (const [status, hex] of Object.entries(CUSTODY_COLOR)) {
      this.statusMaterials[status] = new MeshStandardMaterial({
        color: new Color(hex),
        emissive: new Color(hex),
        emissiveIntensity: 0.12,
        roughness: 0.4,
        metalness: 0.2,
      });
    }
    void this.refresh();
  }

  update(delta: number): void {
    for (let i = this.transitions.length - 1; i >= 0; i--) {
      const t = this.transitions[i];
      t.elapsed += delta;
      const alpha = Math.min(1, t.elapsed / TRANSITION_SECONDS);
      if (alpha >= 1) {
        // Finished: hand the node back to the shared material (per Nivel 6
        // hardening, N nodes must not each keep minting their own) and
        // dispose the transitional instance so it doesn't leak.
        t.mesh.material = this.statusMaterials[t.toStatus] ?? this.fallbackMaterial;
        t.material.dispose();
        this.transitions.splice(i, 1);
      } else {
        t.material.color.lerpColors(t.from, t.to, alpha);
      }
    }
  }

  /** Re-fetches the field and rebuilds the memory nodes. Public so
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
    this.populateLegend(legend, overview.custody_status_meaning);

    let memories;
    try {
      memories = (await EngramApi.listMemories()).memories;
    } catch (err) {
      this.reportLoadError(legend, err);
      return;
    }

    for (const entity of this.nodeEntities) entity.dispose();
    this.nodeEntities = [];
    // A transitioning node's mesh is about to be disposed along with
    // everything above — any transition still in flight for it is now
    // chasing a destroyed mesh. Drop those in-flight records and finish
    // the stale material instance rather than lerping into nothing.
    for (const t of this.transitions) t.material.dispose();
    this.transitions = [];

    const count = memories.length;
    const startDeg = -ARC_SPAN_DEG / 2;
    const nextStatus = new Map<string, string>();
    memories.forEach((m, i) => {
      const angleDeg = count <= 1 ? 0 : startDeg + (ARC_SPAN_DEG * i) / (count - 1);
      const angle = (angleDeg * Math.PI) / 180;
      const x = ARC_CENTER.x + ARC_RADIUS * Math.sin(angle);
      const z = ARC_CENTER.z - ARC_RADIUS * Math.cos(angle);

      // Unknown status (server-side vocabulary newer than this client)
      // gets the neutral fallback material — visible as "unmapped", never
      // silently painted as a known status.
      const targetMaterial = this.statusMaterials[m.custody_status] ?? this.fallbackMaterial;
      const priorStatus = this.previousStatus.get(m.memory_id);
      // A real, server-confirmed change (never a guess, never on click):
      // this memory existed before refresh() and its status is now
      // different. Start the mesh on its OWN material at the OLD color and
      // let update() lerp it toward the new one — only CUSTODY_COLOR
      // values are ever either endpoint.
      const changed = priorStatus !== undefined && priorStatus !== m.custody_status
        && CUSTODY_COLOR[priorStatus] !== undefined && CUSTODY_COLOR[m.custody_status] !== undefined;

      const mesh = changed
        ? new Mesh(
            this.geometry,
            new MeshStandardMaterial({
              color: new Color(CUSTODY_COLOR[priorStatus!]),
              emissive: new Color(CUSTODY_COLOR[priorStatus!]),
              emissiveIntensity: 0.12,
              roughness: 0.4,
              metalness: 0.2,
            }),
          )
        : new Mesh(this.geometry, targetMaterial);
      mesh.position.set(x, ARC_CENTER.y, z);
      // Face the seated viewer at the arc center's origin so slab faces
      // (and their labels) stay readable across the 140-degree span.
      // Orientation is presentation only; it encodes no relationship.
      mesh.lookAt(0, ARC_CENTER.y, 0);
      // A defined edge on every slab, regardless of status — purely a
      // "this is a solid tag, not a flat decal" read, same neutral color
      // on every node.
      mesh.add(new LineSegments(this.edgeGeometry, this.edgeMaterial));
      // QUARANTINED gets a containment treatment in addition to color,
      // never instead of it: the existing wireframe frame, plus a faint
      // translucent shell in the SAME custody-red — reads as an isolation
      // field around the tag rather than just a thin outline, without
      // adding any hue the mapping doesn't already declare.
      if (m.custody_status === CustodyStatus.QUARANTINED) {
        const frame = new Mesh(
          new BoxGeometry(0.23, 0.15, 0.03),
          new MeshStandardMaterial({ color: new Color('#c13030'), wireframe: true }),
        );
        mesh.add(frame);
        const shell = new Mesh(
          new BoxGeometry(0.27, 0.19, 0.07),
          new MeshBasicMaterial({
            color: new Color('#c13030'),
            transparent: true,
            opacity: 0.07,
            depthWrite: false,
          }),
        );
        mesh.add(shell);
      }

      if (changed) {
        this.transitions.push({
          material: mesh.material as MeshStandardMaterial,
          from: new Color(CUSTODY_COLOR[priorStatus!]),
          to: new Color(CUSTODY_COLOR[m.custody_status]),
          toStatus: m.custody_status,
          mesh,
          elapsed: 0,
        });
      }

      const entity = this.world.createTransformEntity(mesh);
      entity.addComponent(RayInteractable);
      // Hands-first (per the project's own "hands-first, seated" target):
      // an evidence slab can be directly hand-pinched off the arc and
      // turned/pulled close to read, same as the ray-select path already
      // above it — this is presentation only (position in a scene graph),
      // never a MNEME write, exactly like the Canvas desktop drag. Bounds
      // keep a grabbed slab inside the seated room rather than letting it
      // disappear behind the player or through the floor; refresh() rebuilds
      // every node from scratch, so a dropped slab's position resets on the
      // next real custody change regardless of where a hand left it.
      entity.addComponent(OneHandGrabbable, {
        translateMin: [-1.3, 0.6, -2.3],
        translateMax: [1.3, 2.0, -0.05],
      });
      entity.addComponent(MemoryNode, {
        memoryId: m.memory_id,
        custodyStatus: m.custody_status,
        topic: m.topic ?? '',
        contentPreview: m.content_preview ?? '',
      });
      this.nodeEntities.push(entity);
      nextStatus.set(m.memory_id, m.custody_status);
    });
    this.previousStatus = nextStatus;
  }

  private populateLegend(
    legend: UIKitMLAsset | undefined,
    meaning: Record<string, string>,
  ): void {
    if (!legend) return;
    for (const status of Object.keys(CUSTODY_COLOR)) {
      const swatch = legend.getElementById(`swatch-${status}`);
      const text = legend.getElementById(`text-${status}`);
      swatch?.setProperties({ backgroundColor: CUSTODY_COLOR[status] });
      text?.setProperties({ text: `${status} — ${meaning[status] ?? 'unknown'}` });
    }
  }

  private reportLoadError(legend: UIKitMLAsset | undefined, err: unknown): void {
    // Honest degradation (CLAUDE.md §5.3): a failed fetch must show a
    // visible FAIL, never an empty field that looks like "zero memories".
    // eslint-disable-next-line no-console
    console.error('[ENGRAM] failed to load field from adapter:', err);
    const status = legend?.getElementById('legend-status');
    status?.setProperties({
      text: `FAILED to load field: ${(err as Error).message ?? err}`,
      color: '#c13030',
      display: 'flex',
    });
  }
}
