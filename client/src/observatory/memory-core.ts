/**
 * ENGRAM Memory Observatory — one memory rendered as an "engram plate":
 * three sheets of glass standing on a graphite foot, the middle sheet
 * carrying the record's custody mark. It is the object on the ENGRAM
 * poster (the layered memory plate) and the diamond of the ENGRAM mark,
 * given a body.
 *
 * Shape and size are identical for every memory (size never means
 * authority). The only per-memory visual variable that carries meaning is
 * the colour of the mark and of the frame around it, which comes from
 * CUSTODY_COLOR in field-system.ts. The glass, the foot and the ivory edge
 * are the same for all.
 *
 * QUARANTINED additionally gets a containment frame, in addition to its
 * colour, never instead of it (precedent set by the earlier slab design).
 *
 * The three sheets can separate in depth (`setPlateSpread`). The field
 * system drives that from real events only: the field arriving, a pointer
 * resting on the plate, the record being opened.
 */
import {
  BoxGeometry,
  ExtrudeGeometry,
  Group,
  LineBasicMaterial,
  Material,
  Mesh,
  OctahedronGeometry,
  Path,
  Shape,
  ShapeGeometry,
  Sprite,
} from '@iwsdk/core';

export type MemoryCore = {
  root: Group;
  float: Group;
  /** The custody mark (diamond) inside the middle sheet. */
  crystal: Mesh;
  /** The custody frame around the middle sheet. */
  halo: Mesh;
  /** Front sheet; kept under its historical name for the systems that read it. */
  capsule: Mesh;
  plates: Mesh[];
  label: Sprite;
  phase: number;
  /** 0 = sheets closed, 1 = fully opened. Presentation state only. */
  spread: number;
  /** 0 = not yet arrived, 1 = standing on the field. Presentation state only. */
  arrival: number;
};

export type CoreMaterials = {
  crystal: Material;
  halo: Material;
  capsule: Material;
  base: Material;
  /** Kept for API compatibility; the foot edge now uses `edge`. */
  baseEdge: LineBasicMaterial;
  edge?: Material;
  cage?: Material;
};

export const PLATE = {
  width: 0.118,
  height: 0.158,
  thickness: 0.0035,
  chamfer: 0.016,
  /** Depth gap between sheets at rest and when opened. */
  restGap: 0.014,
  openGap: 0.034,
  /** Centre of the sheets above the core origin. */
  centerY: 0.0,
  /** Top of the foot; the foot's underside sits on the arc. */
  footY: -0.098,
} as const;

function chamferedRect(w: number, h: number, c: number): Shape {
  const x = w / 2;
  const y = h / 2;
  const s = new Shape();
  s.moveTo(-x + c, -y);
  s.lineTo(x - c, -y);
  s.lineTo(x, -y + c);
  s.lineTo(x, y - c);
  s.lineTo(x - c, y);
  s.lineTo(-x + c, y);
  s.lineTo(-x, y - c);
  s.lineTo(-x, -y + c);
  s.closePath();
  return s;
}

function frameShape(w: number, h: number, c: number, t: number): Shape {
  const outer = chamferedRect(w, h, c);
  const inner = chamferedRect(w - t * 2, h - t * 2, Math.max(0.001, c - t * 0.6));
  const hole = new Path();
  const pts = inner.getPoints();
  hole.moveTo(pts[0].x, pts[0].y);
  for (let i = pts.length - 1; i >= 0; i--) hole.lineTo(pts[i].x, pts[i].y);
  outer.holes.push(hole);
  return outer;
}

// Shared geometry: N cores never mint their own.
const plateGeo = new ExtrudeGeometry(chamferedRect(PLATE.width, PLATE.height, PLATE.chamfer), {
  depth: PLATE.thickness, bevelEnabled: false,
});
plateGeo.translate(0, 0, -PLATE.thickness / 2);

const GEO = {
  plate: plateGeo,
  frame: new ShapeGeometry(frameShape(PLATE.width + 0.006, PLATE.height + 0.006, PLATE.chamfer + 0.002, 0.0036)),
  sheetEdge: new ShapeGeometry(frameShape(PLATE.width + 0.002, PLATE.height + 0.002, PLATE.chamfer + 0.0007, 0.0014)),
  mark: new OctahedronGeometry(0.027, 0),
  foot: new BoxGeometry(0.15, 0.022, 0.085),
  footEdge: new BoxGeometry(0.15, 0.0022, 0.0022),
  cagePost: new BoxGeometry(0.0038, 0.212, 0.0038),
  cageX: new BoxGeometry(0.166, 0.0038, 0.0038),
  cageZ: new BoxGeometry(0.0038, 0.0038, 0.1),
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

  // Foot: graphite block with one ivory line along its viewer-facing edge.
  const foot = new Mesh(GEO.foot, materials.base);
  foot.position.y = PLATE.footY - 0.011;
  root.add(foot);
  if (materials.edge) {
    const edge = new Mesh(GEO.footEdge, materials.edge);
    edge.position.set(0, PLATE.footY + 0.0005, 0.0425);
    // Decorative only: never a pointer target.
    edge.raycast = () => {};
    root.add(edge);
  }

  const plates: Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const plate = new Mesh(GEO.plate, materials.capsule);
    plate.renderOrder = 2 + i;
    float.add(plate);
    plates.push(plate);
    // The outer sheets carry a faint ivory edge so three layers read as
    // three layers; the middle sheet's edge is the custody frame below.
    if (i !== 1 && materials.edge) {
      const sheetEdge = new Mesh(GEO.sheetEdge, materials.edge);
      sheetEdge.raycast = () => {};
      plate.add(sheetEdge);
    }
  }

  // The custody mark: the diamond of the ENGRAM mark, flattened into the
  // middle sheet so it reads as inscribed in the glass, not floating in it.
  const crystal = new Mesh(GEO.mark, materials.crystal);
  crystal.scale.set(1, 1.28, 0.16);
  crystal.renderOrder = 1;
  plates[1].add(crystal);

  const halo = new Mesh(GEO.frame, materials.halo);
  halo.renderOrder = 1;
  halo.raycast = () => {};
  plates[1].add(halo);

  if (quarantined && materials.cage) {
    const cage = new Group();
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const post = new Mesh(GEO.cagePost, materials.cage);
      post.position.set(sx * 0.081, 0.006, sz * 0.048);
      cage.add(post);
    }
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const bar = new Mesh(GEO.cageX, materials.cage);
        bar.position.set(0, 0.006 + sy * 0.104, sz * 0.048);
        cage.add(bar);
      }
      for (const sx of [-1, 1]) {
        const bar = new Mesh(GEO.cageZ, materials.cage);
        bar.position.set(sx * 0.081, 0.006 + sy * 0.104, 0);
        cage.add(bar);
      }
    }
    cage.traverse((o) => { o.raycast = () => {}; });
    float.add(cage);
  }

  // Caption below the plate, mounted on the viewer-facing edge of the arc
  // the way a specimen is captioned: the air above the field stays free
  // for the custody tower, the causal arcs and the guide marker.
  placeCaption(label);
  root.add(label);

  const core: MemoryCore = {
    root, float, crystal, halo, capsule: plates[2], plates, label, phase, spread: 0, arrival: 1,
  };
  setPlateSpread(core, 0);
  return core;
}

/** Hang a caption sprite just under the limb line, top edge aligned. */
export function placeCaption(label: Sprite): void {
  label.position.set(0, PLATE.footY - 0.04 - label.scale.y / 2, 0.262);
}

/** Position the three sheets for an opening amount in [0, 1]. Local +Z of a
 * core faces the seated viewer, so the sheets fan toward and away from them. */
export function setPlateSpread(core: MemoryCore, spread: number): void {
  core.spread = spread;
  const gap = PLATE.restGap + (PLATE.openGap - PLATE.restGap) * spread;
  core.plates[0].position.z = -gap;
  core.plates[1].position.z = 0;
  core.plates[2].position.z = gap;
}
