/**
 * ENGRAM — provenance structure (Phase C-B): the custody tower and the
 * supersession lineage link.
 *
 * When a memory is selected, the REAL payloads SelectionSystem already
 * fetched (published through SelectedMemory.setRecord) are given physical
 * form above the selected core:
 *
 *  - the custody chain becomes a stack of hash-linked blocks, one per
 *    custody event, in server `seq` order, each labeled with the event
 *    type, the actor and the `entry_hash` prefix the server returned;
 *  - a SUPERSEDED memory gets a labeled lineage link to its successor,
 *    because the architecture doc is explicit that a superseded node is a
 *    retired historical node connected to its successor and must never be
 *    shown as deleted. The successor id comes from MNEME's own
 *    `superseded_by` field, never inferred from position or time.
 *
 * Nothing here verifies or recomputes a hash: the tower is a reading of
 * the chain, not a verdict on it. A chain the server returned empty is
 * labeled INCOMPLETE rather than drawn as a clean one-block stack.
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
  MeshStandardMaterial,
  Sprite,
  Vector3,
} from '@iwsdk/core';
import type { CustodyChain, MemoryDetail } from './engram-api.js';
import { FieldSystem } from './field-system.js';
import { disposeLabel, makeLabel } from './observatory/labels.js';
import { OBS } from './observatory/palette.js';
import { SelectedMemory } from './selected-memory.js';

const BLOCK_GEO = new BoxGeometry(0.075, 0.028, 0.045);
const BLOCK_STEP = 0.088;
// The custody tower rises just behind the core and the impact markers sit
// in front of it, so provenance and causality never stack on one another.
const TOWER_BASE = 0.24;
const TOWER_DEPTH = -0.12;
const LINEAGE_COLOR = '#9aa4b2';

export class CustodyChainSystem extends createSystem({}) {
  private entities: Entity[] = [];
  private tower: Group | null = null;
  private labels: Sprite[] = [];
  private blocks: Mesh[] = [];
  private blockMaterial = new MeshStandardMaterial({
    color: new Color('#8f8c85'), emissive: new Color(OBS.provenance),
    emissiveIntensity: 0.12, roughness: 0.4, metalness: 0.4,
  });
  private headMaterial = new MeshStandardMaterial({
    color: new Color('#ffffff'), emissive: new Color(OBS.provenance),
    emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.5,
  });
  private linkMaterial = new LineBasicMaterial({ color: new Color(OBS.provenance), transparent: true, opacity: 0.8 });
  // Supersession is a lineage relation, not a causal edge: it is drawn in a
  // neutral grey that appears in neither CUSTODY_COLOR nor TRACE_STYLE, and
  // always carries its own text label.
  private lineageMaterial = new LineBasicMaterial({ color: new Color(LINEAGE_COLOR), transparent: true, opacity: 0.75 });
  private memoryId: string | null = null;
  private lineage: { geometry: BufferGeometry; from: string; to: string; label: Sprite } | null = null;
  private scratch = new Vector3();
  private scratchB = new Vector3();
  private riseElapsed = 0;

  init(): void {
    this.cleanupFuncs.push(
      SelectedMemory.subscribeRecord((chain, detail) => this.rebuild(chain, detail)),
      SelectedMemory.subscribe((id) => { if (id === null) this.clear(); }),
    );
  }

  update(delta: number): void {
    const field = this.world.getSystem(FieldSystem);
    if (this.tower && this.memoryId) {
      const pos = field?.getCoreWorldPosition(this.memoryId, this.scratch);
      if (pos) this.tower.position.set(pos.x, pos.y + TOWER_BASE, pos.z + TOWER_DEPTH);
      this.riseElapsed += delta;
      // Only the blocks rise in; a label sprite's scale IS its physical
      // size, so it is never animated.
      this.blocks.forEach((block, i) => {
        const t = Math.min(1, Math.max(0, (this.riseElapsed - i * 0.05) / 0.25));
        block.scale.setScalar(t);
      });
    }
    if (this.lineage) {
      const a = field?.getCoreWorldPosition(this.lineage.from, this.scratch);
      const b = field?.getCoreWorldPosition(this.lineage.to, this.scratchB);
      if (a && b) {
        const pos = this.lineage.geometry.attributes.position;
        pos.setXYZ(0, a.x, a.y, a.z);
        pos.setXYZ(1, b.x, b.y, b.z);
        pos.needsUpdate = true;
        this.lineage.label.position.lerpVectors(a, b, 0.5);
        this.lineage.label.position.y -= 0.14;
      }
    }
  }

  private clear(): void {
    for (const l of this.labels) disposeLabel(l);
    this.labels = [];
    this.blocks = [];
    this.lineage = null;
    for (const e of this.entities) e.dispose();
    this.entities = [];
    this.tower = null;
    this.memoryId = null;
  }

  private rebuild(chain: CustodyChain | null, detail: MemoryDetail | null): void {
    this.clear();
    if (!chain) return;
    const tower = new Group();
    const entries = [...chain.entries].sort((a, b) => a.seq - b.seq);

    if (entries.length === 0) {
      // Honest degradation: an empty chain is stated, never drawn as clean.
      const warn = makeLabel(
        [{ text: 'CUSTODY CHAIN INCOMPLETE', color: '#c3ccd8', size: 24, weight: '700' },
         { text: 'the server returned no custody events for this memory', color: '#a9a69e', size: 18 }],
        { width: 0.34, background: '#000000d9', border: '#c3ccd8' },
      );
      tower.add(warn);
      this.labels.push(warn);
    }

    entries.forEach((e, i) => {
      const y = i * BLOCK_STEP;
      const isHead = i === entries.length - 1;
      const block = new Mesh(BLOCK_GEO, isHead ? this.headMaterial : this.blockMaterial);
      block.position.set(0, y, 0);
      block.scale.setScalar(0);
      tower.add(block);
      this.blocks.push(block);
      if (i > 0) {
        const link = new Line(
          new BufferGeometry().setFromPoints([new Vector3(0, y - BLOCK_STEP + 0.014, 0), new Vector3(0, y - 0.014, 0)]),
          this.linkMaterial,
        );
        tower.add(link);
      }
      const label = makeLabel(
        [
          { text: `#${e.seq} ${e.event_type}`, color: '#EEE9DF', size: 24, weight: '700' },
          { text: `${e.actor_id} · ${e.entry_hash.slice(0, 12)}…`, color: '#a9a69e', size: 21, font: 'mono' },
        ],
        { width: 0.34, background: '#000000d9', align: 'left' },
      );
      label.position.set(0.225, y, 0);
      tower.add(label);
      this.labels.push(label);
    });

    const head = makeLabel(
      [
        { text: `CUSTODY CHAIN · ${chain.chain_length} EVENTS`, color: OBS.provenance, size: 24, weight: '700' },
        { text: `head ${chain.head_hash.slice(0, 16)}…`, color: '#a9a69e', size: 21, font: 'mono' },
        { text: 'hash-linked record as MNEME returned it — read-only', color: '#8a8880', size: 16 },
      ],
      { width: 0.36, background: '#000000d9', border: OBS.provenance },
    );
    head.position.set(0.1, entries.length * BLOCK_STEP + 0.07, 0);
    tower.add(head);
    this.labels.push(head);

    this.tower = tower;
    this.memoryId = chain.memory_id;
    this.riseElapsed = 0;
    this.entities.push(this.world.createTransformEntity(tower));

    // Supersession lineage: only when MNEME itself reported a successor AND
    // that successor is a core currently on the bench.
    const successor = detail?.superseded_by ?? null;
    const field = this.world.getSystem(FieldSystem);
    if (successor && field?.getCoreWorldPosition(successor, this.scratchB)) {
      const geometry = new BufferGeometry().setFromPoints([new Vector3(), new Vector3()]);
      const line = new Line(geometry, this.lineageMaterial);
      line.frustumCulled = false;
      const label = makeLabel(
        [{ text: 'SUPERSEDED_BY', color: LINEAGE_COLOR, size: 22, weight: '700' },
         { text: `replaced by ${successor} — retired, not deleted`, color: '#a9a69e', size: 17 }],
        { width: 0.3, background: '#000000d9', border: LINEAGE_COLOR },
      );
      this.labels.push(label);
      this.lineage = { geometry, from: chain.memory_id, to: successor, label };
      // Same entity list as the tower, so one clear() removes every piece
      // of the provenance structure.
      this.entities.push(this.world.createTransformEntity(line));
      this.entities.push(this.world.createTransformEntity(label));
    }
  }
}
