/**
 * ENGRAM Memory Lab — one memory rendered as a physical "memory core":
 * a crystal sealed in a glass capsule on a metal base, with a readable
 * label. Shape and size are identical for every memory (size never means
 * authority); the only per-memory visual variable that carries meaning is
 * the crystal/halo color, which comes from CUSTODY_COLOR in field-system.ts.
 *
 * QUARANTINED additionally gets a containment cage, in addition to its
 * color, never instead of it (precedent set by the earlier slab design).
 */
import {
  BoxGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Material,
  Mesh,
  OctahedronGeometry,
  Sprite,
  TorusGeometry,
} from '@iwsdk/core';

export type MemoryCore = {
  root: Group;
  float: Group;
  crystal: Mesh;
  halo: Mesh;
  capsule: Mesh;
  label: Sprite;
  phase: number;
};

export type CoreMaterials = {
  crystal: Material;
  halo: Material;
  capsule: Material;
  base: Material;
  baseEdge: LineBasicMaterial;
  cage?: Material;
};

// Shared geometry: N cores never mint their own.
const GEO = {
  crystal: new OctahedronGeometry(0.052, 0),
  halo: new TorusGeometry(0.066, 0.0035, 10, 48),
  capsule: new CylinderGeometry(0.082, 0.082, 0.235, 28, 1, true),
  capsuleCap: new CylinderGeometry(0.082, 0.082, 0.006, 28),
  base: new CylinderGeometry(0.075, 0.095, 0.024, 28),
  baseEdge: new EdgesGeometry(new CylinderGeometry(0.075, 0.095, 0.024, 28)),
  cage: new BoxGeometry(0.2, 0.3, 0.2, 3, 4, 3),
};

export function buildMemoryCore(
  materials: CoreMaterials,
  label: Sprite,
  quarantined: boolean,
  phase: number,
): MemoryCore {
  const root = new Group();
  const float = new Group();
  root.add(float);

  const base = new Mesh(GEO.base, materials.base);
  base.position.y = -0.13;
  root.add(base);
  const edge = new LineSegments(GEO.baseEdge, materials.baseEdge);
  edge.position.y = -0.13;
  // Decorative only: Line.raycast uses a 1 m default threshold, which made
  // every pointer ray 'hit' the nearest core's base edges instead of the
  // core actually under the pointer.
  edge.raycast = () => {};
  root.add(edge);

  const capsule = new Mesh(GEO.capsule, materials.capsule);
  capsule.position.y = 0;
  float.add(capsule);
  const cap = new Mesh(GEO.capsuleCap, materials.base);
  cap.position.y = 0.12;
  float.add(cap);

  const crystal = new Mesh(GEO.crystal, materials.crystal);
  crystal.position.y = 0;
  float.add(crystal);

  const halo = new Mesh(GEO.halo, materials.halo);
  halo.rotation.x = Math.PI / 2;
  float.add(halo);

  if (quarantined && materials.cage) {
    const cage = new Mesh(GEO.cage, materials.cage);
    cage.position.y = -0.005;
    float.add(cage);
  }

  label.position.set(0, 0.235, 0);
  float.add(label);

  return { root, float, crystal, halo, capsule, label, phase };
}
