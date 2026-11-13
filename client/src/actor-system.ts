/**
 * ENGRAM — the actor registry rack and its authority inspector.
 *
 * Projects MNEME's real actor list (GET /api/v1/actors: actor_id, kind,
 * status) as totems on the shelf behind the factual field. Shape = kind
 * (HUMAN capsule, AGENT icosahedron, PIPELINE cylinder) and color = actor
 * status, both from the fixed declared maps below — never a
 * client-invented category. The only red used is the same hex as the
 * QUARANTINED custody color, so "quarantined" reads consistently whether
 * it is a memory or the actor that wrote it.
 *
 * Selecting a totem fetches that actor's REAL authority chain
 * (GET /api/v1/actors/{id}/authority) and shows the grants with the issuer
 * MNEME recorded for each. The architecture doc is explicit that authority
 * is "estructura separada, no halo de prestigio": nothing about a totem's
 * size, height or brightness encodes authority, and the capability list is
 * read from the server rather than inferred from kind or status.
 *
 * A totem can also be picked up and placed in the intervention cradle to
 * stage a containment preview for that actor — see ContainmentSystem. The
 * placement itself only ever triggers the read-only preview endpoint.
 */
import {
  CapsuleGeometry,
  Color,
  createSystem,
  CylinderGeometry,
  DistanceGrabbable,
  Entity,
  Grabbed,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  MovementMode,
  Pressed,
  RayInteractable,
  Sprite,
  TorusGeometry,
  UIKitMLAsset,
  Vector3,
} from '@iwsdk/core';
import { ActorTotem } from './actor-totem-component.js';
import { ActorSummary, EngramApi } from './engram-api.js';
import { FieldEvents } from './field-events.js';
import { InterventionStore } from './intervention-store.js';
import { AudioCues } from './observatory/audio-cues.js';
import { disposeLabel, makeLabel } from './observatory/labels.js';
import { OBSERVATORY } from './observatory/palette.js';

export const ACTOR_STATUS_COLOR: Record<string, string> = {
  ACTIVE: '#6fa8dc',
  QUARANTINED: '#c13030',
};
const UNKNOWN_ACTOR_COLOR = '#999999';

const GEO = {
  HUMAN: new CapsuleGeometry(0.045, 0.09, 6, 16),
  AGENT: new IcosahedronGeometry(0.065, 1),
  PIPELINE: new CylinderGeometry(0.05, 0.05, 0.15, 20),
  ring: new TorusGeometry(0.085, 0.004, 8, 40),
  cage: new CylinderGeometry(0.11, 0.11, 0.26, 10, 3, true),
};

type Totem = {
  entity: Entity;
  group: Group;
  mesh: Mesh;
  label: Sprite;
  actorId: string;
  home: Vector3;
  phase: number;
};

export class ActorSystem extends createSystem({
  totems: { required: [ActorTotem] },
  pressed: { required: [ActorTotem, Pressed] },
}) {
  private totems: Totem[] = [];
  private materials: Record<string, MeshStandardMaterial> = {};
  private fallback = new MeshStandardMaterial({ color: new Color(UNKNOWN_ACTOR_COLOR) });
  private cageMaterial = new MeshStandardMaterial({
    color: new Color(ACTOR_STATUS_COLOR.QUARANTINED),
    emissive: new Color(ACTOR_STATUS_COLOR.QUARANTINED),
    emissiveIntensity: 0.6,
    wireframe: true,
  });
  private busy = false;
  private scratch = new Vector3();

  init(): void {
    for (const [status, hex] of Object.entries(ACTOR_STATUS_COLOR)) {
      this.materials[status] = new MeshStandardMaterial({
        color: new Color(hex), emissive: new Color(hex), emissiveIntensity: 0.35,
        roughness: 0.3, metalness: 0.5,
      });
    }
    this.queries.pressed.subscribe('qualify', (entity) => {
      const actorId = entity.getValue(ActorTotem, 'actorId') as string;
      void this.showAuthority(actorId);
    });
    const panel = this.world.getSceneObject<UIKitMLAsset>('authority-panel');
    const close = panel?.getElementById('authority-close');
    const hide = () => panel?.getElementById('authority-root')?.setProperties({ display: 'none' });
    close?.addEventListener('click', hide);
    this.cleanupFuncs.push(
      () => close?.removeEventListener('click', hide),
      FieldEvents.subscribe(() => void this.refresh()),
    );
  }

  update(delta: number, time: number): void {
    const docked = InterventionStore.get();
    const k = 1 - Math.exp(-delta * 6);
    for (const t of this.totems) {
      t.mesh.rotation.y += delta * 0.4;
      const held = t.entity.hasComponent(Grabbed);
      t.mesh.position.y = 0.08 + Math.sin(time * 0.9 + t.phase) * 0.008;
      // Released anywhere that is not the cradle: glide back to its shelf
      // slot rather than being lost in the room. Position is presentation
      // only; nothing about where a totem sits changes MNEME state.
      if (!held && docked !== t.actorId) {
        t.group.getWorldPosition(this.scratch);
        if (this.scratch.distanceTo(t.home) > 0.015) {
          t.group.position.lerp(t.home, k);
        }
      }
    }
  }

  /** Live totems, for the intervention cradle's docking test. */
  getTotems(): { actorId: string; group: Group; entity: Entity }[] {
    return this.totems.map((t) => ({ actorId: t.actorId, group: t.group, entity: t.entity }));
  }

  private async showAuthority(actorId: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const panel = this.world.getSceneObject<UIKitMLAsset>('authority-panel');
    panel?.getElementById('authority-title')?.setProperties({ text: `${actorId} — reading grants...` });
    panel?.getElementById('authority-root')?.setProperties({ display: 'flex' });
    AudioCues.play('select');
    try {
      const authority = await EngramApi.getAuthority(actorId);
      const chainText = authority.chain
        .map((e) => {
          let caps = '';
          try {
            const payload = JSON.parse(e.payload_json) as { capabilities?: string[] };
            if (payload.capabilities) caps = `\n  capabilities: ${payload.capabilities.join(', ')}`;
          } catch {
            // A payload this client cannot parse is shown as-is rather than
            // dropped: unknown stays unknown.
            caps = `\n  payload: ${e.payload_json}`;
          }
          return `#${e.seq} ${e.event_type} - issued by ${e.issuer_id}\n  "${e.reason}"${caps}\n  ${e.entry_hash.slice(0, 16)}...`;
        })
        .join('\n\n');
      panel?.getElementById('authority-title')?.setProperties({ text: authority.actor_id });
      panel?.getElementById('authority-caps')?.setProperties({
        text: authority.effective_capabilities.length
          ? `effective capabilities: ${authority.effective_capabilities.join(', ')}`
          : 'effective capabilities: none (MNEME grants this actor nothing right now)',
      });
      panel?.getElementById('authority-chain')?.setProperties({
        text: `authority chain (${authority.chain.length} events):\n\n${chainText}`,
      });
      AudioCues.play('open');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[ENGRAM] failed to load authority:', err);
      AudioCues.play('failure');
      panel?.getElementById('authority-title')?.setProperties({ text: `FAILED to load ${actorId}` });
      panel?.getElementById('authority-caps')?.setProperties({ text: String((err as Error).message ?? err) });
      panel?.getElementById('authority-chain')?.setProperties({ text: '' });
    } finally {
      this.busy = false;
    }
  }

  async refresh(): Promise<void> {
    let actors: ActorSummary[];
    try {
      actors = (await EngramApi.listActors()).actors;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[ENGRAM] failed to load actors:', err);
      return;
    }
    for (const t of this.totems) { disposeLabel(t.label); t.entity.dispose(); }
    this.totems = [];

    const { x: cx, y: cy, z: cz, spread } = OBSERVATORY.actorRack;
    const n = actors.length;
    actors.forEach((a, i) => {
      const x = n <= 1 ? cx : cx - spread / 2 + (spread * i) / (n - 1);
      const group = new Group();
      const geometry = GEO[a.kind as keyof typeof GEO] ?? GEO.AGENT;
      const material = this.materials[a.status] ?? this.fallback;
      const mesh = new Mesh(geometry, material);
      mesh.position.y = 0.08;
      group.add(mesh);
      const ring = new Mesh(GEO.ring, material);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.04;
      group.add(ring);
      if (a.status === 'QUARANTINED') {
        const cage = new Mesh(GEO.cage, this.cageMaterial);
        cage.position.y = 0.08;
        group.add(cage);
      }
      const label = makeLabel(
        [
          { text: a.display_name, color: '#f2f6fa', size: 26, weight: '700' },
          { text: `${a.kind} · ${a.status}`, color: ACTOR_STATUS_COLOR[a.status] ?? UNKNOWN_ACTOR_COLOR, size: 21, weight: '600' },
        ],
        { width: 0.26, background: '#0b121bd9', border: '#2a3a4d' },
      );
      label.position.y = 0.3;
      group.add(label);
      group.position.set(x, cy, cz);

      const entity = this.world.createTransformEntity(group);
      entity.addComponent(RayInteractable);
      // Same one-pointer grammar as a memory core: a short press inspects
      // the actor's grants, a held press carries the totem along the ray so
      // it can be placed in the intervention cradle.
      entity.addComponent(DistanceGrabbable, {
        movementMode: MovementMode.MoveFromTarget,
        scale: false,
        translateMin: [-2.6, 0.4, -3.2],
        translateMax: [2.6, 2.4, -0.05],
      });
      entity.addComponent(ActorTotem, {
        actorId: a.actor_id,
        displayName: a.display_name,
        kind: a.kind,
        status: a.status,
        homeX: x, homeY: cy, homeZ: cz,
      });
      this.totems.push({
        entity, group, mesh, label, actorId: a.actor_id,
        home: new Vector3(x, cy, cz), phase: i * 1.3,
      });
    });
  }
}
