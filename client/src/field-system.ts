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
  MeshStandardMaterial,
  RayInteractable,
  SphereGeometry,
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
const NODE_RADIUS = 0.055;

export class FieldSystem extends createSystem({}) {
  private geometry = new SphereGeometry(NODE_RADIUS, 24, 16);
  private nodeEntities: Entity[] = [];
  // One shared material per custody_status: N nodes × M refreshes must not
  // mint a new MeshStandardMaterial each — the custody→appearance mapping
  // is CUSTODY_COLOR, and sharing enforces that literally (mutating a
  // shared material would recolor every node of that status at once).
  private statusMaterials: Record<string, MeshStandardMaterial> = {};
  private fallbackMaterial = new MeshStandardMaterial({ color: new Color('#999999') });

  init(): void {
    for (const [status, hex] of Object.entries(CUSTODY_COLOR)) {
      this.statusMaterials[status] = new MeshStandardMaterial({
        color: new Color(hex),
      });
    }
    void this.refresh();
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

    const count = memories.length;
    const startDeg = -ARC_SPAN_DEG / 2;
    memories.forEach((m, i) => {
      const angleDeg = count <= 1 ? 0 : startDeg + (ARC_SPAN_DEG * i) / (count - 1);
      const angle = (angleDeg * Math.PI) / 180;
      const x = ARC_CENTER.x + ARC_RADIUS * Math.sin(angle);
      const z = ARC_CENTER.z - ARC_RADIUS * Math.cos(angle);

      // Unknown status (server-side vocabulary newer than this client)
      // gets the neutral fallback material — visible as "unmapped", never
      // silently painted as a known status.
      const material = this.statusMaterials[m.custody_status] ?? this.fallbackMaterial;
      const mesh = new Mesh(this.geometry, material);
      mesh.position.set(x, ARC_CENTER.y, z);

      const entity = this.world.createTransformEntity(mesh);
      entity.addComponent(RayInteractable);
      entity.addComponent(MemoryNode, {
        memoryId: m.memory_id,
        custodyStatus: m.custody_status,
      });
      this.nodeEntities.push(entity);
    });
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
