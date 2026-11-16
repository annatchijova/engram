/**
 * ENGRAM Memory Observatory — the room itself.
 *
 * The room is an instrument, not a set: a graphite dais under an open dome,
 * engraved like the limb of an astrolabe, with the recorded field standing
 * on a single arc in front of the seated observer. Everything here is ink
 * or ivory (see palette.ts: hue is evidence, structure is neutral), so the
 * only saturated colour in view is whatever MNEME returned.
 *
 * Pure presentation. Nothing here reads MNEME data; the systems that do
 * place their objects INTO these zones (field-system, actor-system,
 * counterfactual-system, portable-system). No line drawn here connects two
 * zones or two memories: the engraving is concentric and radial-free on
 * purpose, so the architecture can never be read as a relationship.
 *
 * Zones are physically distinct (README: "the spaces must remain physically
 * and semantically distinct"): the factual field is in front, the sealed
 * hypothetical is a separate violet column to the left, the verification
 * instrument a separate pedestal to the right.
 */
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  ExtrudeGeometry,
  FogExp2,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  RingGeometry,
  Scene,
  Shape,
  SRGBColorSpace,
  TorusGeometry,
} from '@iwsdk/core';
import { makeLabel } from './labels.js';
import { OBS, OBSERVATORY } from './palette.js';

export type ObservatoryHandles = {
  chamberRing: MeshStandardMaterial;
  chamberLight: PointLight;
  vaultRing: MeshStandardMaterial;
  vaultLight: PointLight;
  /** Ivory edge of the field arc and its graduations: lit by field presence. */
  limb: MeshBasicMaterial;
  graduations: MeshBasicMaterial;
};

/** Interior height of the counterfactual containment column. */
export const CHAMBER_HEIGHT = 2.5;

const BENCH_TOP = 0.86;
const BENCH_INNER = 0.95;
const BENCH_OUTER = 1.35;
const LIMB_REST = 0.14;

export function buildObservatory(scene: Scene): ObservatoryHandles {
  scene.background = new Color(OBS.background);
  scene.fog = new FogExp2(OBS.background, 0.045);

  const root = new Group();
  root.name = 'observatory-architecture';
  scene.add(root);

  const { benchCenter, benchSpanDeg } = OBSERVATORY;
  const cx = benchCenter.x;
  const cz = benchCenter.z;

  // ---- Light: one key, one rim, sky fill ------------------------------------
  // Three static lights for the whole room (the two zone lamps below are the
  // only others), so every lit material pays for five lights, not eight.
  root.add(new HemisphereLight('#d7dcea', '#0b0d12', 0.55));
  const key = new DirectionalLight('#fff4e2', 1.25);
  key.position.set(1.2, 3.6, 1.6);
  root.add(key);
  const rim = new DirectionalLight('#aab8d8', 0.55);
  rim.position.set(-1.6, 1.4, -3.2);
  root.add(rim);

  // ---- Ground and dais --------------------------------------------------------
  const ground = new Mesh(
    new CircleGeometry(14, 48),
    new MeshBasicMaterial({ color: '#07080b' }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(cx, -0.012, cz);
  root.add(ground);

  const graphite = new MeshStandardMaterial({ color: OBS.floor, roughness: 0.82, metalness: 0.15 });
  const dais = new Mesh(new CircleGeometry(3.45, 96), graphite);
  dais.rotation.x = -Math.PI / 2;
  dais.position.set(cx, 0, cz);
  root.add(dais);

  // Engraving: concentric rings only. The ring at 2.59 m is the one both
  // side instruments stand on; it relates them to the observer's seat, not
  // to each other.
  const engraving = new MeshBasicMaterial({
    color: OBS.ivory, transparent: true, opacity: 0.16, depthWrite: false,
  });
  const instrumentRadius = Math.hypot(OBSERVATORY.chamber.x - cx, OBSERVATORY.chamber.z - cz);
  for (const [r, w] of [[0.6, 0.003], [instrumentRadius, 0.004], [3.45, 0.008]] as const) {
    const ring = new Mesh(new RingGeometry(r - w, r + w, 128), engraving);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(cx, 0.002, cz);
    root.add(ring);
  }

  // The limb scale: graduations every 2 degrees just outside the field arc,
  // longer every 10. Unnumbered: a number here would look like a
  // measurement, and nothing is being measured by position.
  const graduations = new MeshBasicMaterial({
    color: OBS.ivory, transparent: true, opacity: LIMB_REST, depthWrite: false, side: DoubleSide,
  });
  const ticks = new Mesh(buildTicks(BENCH_OUTER + 0.07, 2, 0.022, 0.06, 0.0028), graduations);
  ticks.position.set(cx, 0.003, cz);
  root.add(ticks);

  // ---- Dome ---------------------------------------------------------------------
  // Meridians and parallels of an observatory dome at the edge of fog. They
  // give the eye a far surface to converge on (depth comfort) and a horizon.
  const domeLines = new LineSegments(
    buildDomeLines(11, 24, 4),
    new LineBasicMaterial({ color: OBS.ivory, transparent: true, opacity: 0.07, fog: false, depthWrite: false }),
  );
  domeLines.position.set(cx, 0, cz);
  root.add(domeLines);
  const horizon = new Mesh(
    new CylinderGeometry(11.5, 11.5, 5, 64, 1, true),
    new MeshBasicMaterial({
      map: horizonTexture(), transparent: true, blending: AdditiveBlending,
      side: BackSide, depthWrite: false, fog: false,
    }),
  );
  horizon.position.set(cx, 2.3, cz);
  root.add(horizon);

  // ---- The field arc (factual zone, front) ----------------------------------------
  const spanRad = ((benchSpanDeg + 14) * Math.PI) / 180;
  const bench = new Group();
  const slabMat = new MeshStandardMaterial({ color: '#171a22', roughness: 0.55, metalness: 0.35 });
  const baseMat = new MeshStandardMaterial({ color: '#0d0f14', roughness: 0.9, metalness: 0.1 });
  // A 6 cm slab cantilevered over a recessed base: the shadow gap under it
  // is what makes it read as a made object rather than an extruded shape.
  const slab = new Mesh(arcSolid(BENCH_INNER, BENCH_OUTER, spanRad, 0.06), slabMat);
  slab.position.set(cx, BENCH_TOP - 0.06, cz);
  bench.add(slab);
  const base = new Mesh(arcSolid(BENCH_INNER + 0.07, BENCH_OUTER - 0.07, spanRad - 0.05, BENCH_TOP - 0.075), baseMat);
  base.position.set(cx, 0, cz);
  bench.add(base);

  const limb = new MeshBasicMaterial({
    color: OBS.ivory, transparent: true, opacity: LIMB_REST, side: DoubleSide,
  });
  // RingGeometry lies in XY; rotated -90deg about X, its +Y maps to -Z, so a
  // span centred on +90deg faces away from the seated observer.
  const thetaStart = Math.PI / 2 - spanRad / 2;
  const limbTop = new Mesh(new RingGeometry(BENCH_INNER, BENCH_INNER + 0.005, 96, 1, thetaStart, spanRad), limb);
  limbTop.rotation.x = -Math.PI / 2;
  limbTop.position.set(cx, BENCH_TOP + 0.0012, cz);
  bench.add(limbTop);
  const limbFace = new Mesh(
    new CylinderGeometry(BENCH_INNER - 0.0008, BENCH_INNER - 0.0008, 0.004, 96, 1, true, Math.PI - spanRad / 2, spanRad),
    limb,
  );
  limbFace.position.set(cx, BENCH_TOP - 0.002, cz);
  bench.add(limbFace);

  const benchLabel = makeLabel(
    [{ text: 'FACTUAL FIELD', color: OBS.ivory, size: 24, weight: '700' },
     { text: 'the recorded field · live MNEME snapshot', color: OBS.ivoryDim, size: 21 }],
    { width: 0.46 },
  );
  benchLabel.position.set(cx, 0.6, cz - BENCH_INNER + 0.1);
  bench.add(benchLabel);
  root.add(bench);

  // ---- Actor registry (behind and above the field) -----------------------------------
  const rackY = OBSERVATORY.actorRack.y;
  const rackZ = OBSERVATORY.actorRack.z;
  const rail = new Mesh(
    new CylinderGeometry(0.003, 0.003, OBSERVATORY.actorRack.spread + 0.5, 8),
    new MeshBasicMaterial({ color: OBS.ivory, transparent: true, opacity: 0.35 }),
  );
  rail.rotation.z = Math.PI / 2;
  rail.position.set(OBSERVATORY.actorRack.x, rackY - 0.09, rackZ);
  root.add(rail);
  const rackLabel = makeLabel(
    [{ text: 'ACTOR REGISTRY', color: OBS.ivory, size: 40, weight: '700' },
     { text: 'who wrote into the field · pick one up to read its grants', color: OBS.ivoryDim, size: 36 }],
    { width: 1.1 },
  );
  rackLabel.position.set(OBSERVATORY.actorRack.x, rackY - 0.19, rackZ);
  root.add(rackLabel);

  // ---- Counterfactual chamber (hypothetical zone, left) -------------------------------
  const chamber = new Group();
  const c = OBSERVATORY.chamber;
  const plinthMat = new MeshStandardMaterial({ color: '#12141b', roughness: 0.6, metalness: 0.3 });
  const platform = new Mesh(new CylinderGeometry(c.radius, c.radius + 0.06, 0.12, 64), plinthMat);
  platform.position.set(c.x, 0.06, c.z);
  chamber.add(platform);
  const chamberRing = new MeshStandardMaterial({
    color: '#000000', emissive: OBS.chamber, emissiveIntensity: 0.35, side: DoubleSide,
  });
  const chamberRingMesh = new Mesh(new TorusGeometry(c.radius, 0.009, 10, 96), chamberRing);
  chamberRingMesh.rotation.x = Math.PI / 2;
  chamberRingMesh.position.set(c.x, 0.125, c.z);
  chamber.add(chamberRingMesh);
  // A containment column, not a dome: the hypothetical world has to be a
  // volume the comparison can actually live inside at reading height, and
  // it has to read as sealed from across the room.
  const column = new Mesh(
    new CylinderGeometry(c.radius, c.radius, CHAMBER_HEIGHT, 64, 1, true),
    new MeshBasicMaterial({
      color: OBS.chamber, transparent: true, opacity: 0.045, side: DoubleSide, depthWrite: false,
    }),
  );
  column.position.set(c.x, 0.12 + CHAMBER_HEIGHT / 2, c.z);
  chamber.add(column);
  const topRim = new Mesh(new TorusGeometry(c.radius, 0.007, 10, 96), chamberRing);
  topRim.rotation.x = Math.PI / 2;
  topRim.position.set(c.x, 0.12 + CHAMBER_HEIGHT, c.z);
  chamber.add(topRim);
  // Four uprights so the column reads as a built instrument rather than fog.
  const strutMat = new MeshStandardMaterial({ color: OBS.trim, roughness: 0.45, metalness: 0.6 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const strut = new Mesh(new CylinderGeometry(0.009, 0.009, CHAMBER_HEIGHT, 8), strutMat);
    strut.position.set(c.x + Math.cos(a) * c.radius, 0.12 + CHAMBER_HEIGHT / 2, c.z + Math.sin(a) * c.radius);
    chamber.add(strut);
  }
  const chamberLight = new PointLight(OBS.chamber, 0.6, 4.2, 2);
  chamberLight.position.set(c.x, 1.5, c.z);
  chamber.add(chamberLight);
  const chamberLabel = makeLabel(
    [{ text: 'COUNTERFACTUAL CHAMBER', color: OBS.chamber, size: 38, weight: '700' },
     { text: 'sealed hypothetical · never executed · never merged', color: OBS.ivoryDim, size: 33 }],
    { width: 0.98, background: '#000000d0', border: OBS.chamber },
  );
  chamberLabel.position.set(c.x, 0.5, c.z + c.radius * 0.1);
  chamber.add(chamberLabel);
  root.add(chamber);

  // ---- Verification instrument (right) ---------------------------------------------
  // Neutral ivory at rest: the only colour this zone ever shows is the
  // verifier's own verdict, on the bundle artifact (portable-system.ts).
  const vault = new Group();
  const v = OBSERVATORY.vault;
  const pedestal = new Mesh(new CylinderGeometry(0.28, 0.34, 0.9, 48), plinthMat);
  pedestal.position.set(v.x, 0.45, v.z);
  vault.add(pedestal);
  const vaultRing = new MeshStandardMaterial({
    color: '#000000', emissive: OBS.ivory, emissiveIntensity: 0.35, side: DoubleSide,
  });
  const vaultRingMesh = new Mesh(new TorusGeometry(0.3, 0.007, 10, 64), vaultRing);
  vaultRingMesh.rotation.x = Math.PI / 2;
  vaultRingMesh.position.set(v.x, 0.905, v.z);
  vault.add(vaultRingMesh);
  const vaultColumn = new Mesh(
    new CylinderGeometry(0.3, 0.3, 0.9, 48, 1, true),
    new MeshBasicMaterial({
      color: OBS.ivory, transparent: true, opacity: 0.035, side: DoubleSide, depthWrite: false,
    }),
  );
  vaultColumn.position.set(v.x, 1.35, v.z);
  vault.add(vaultColumn);
  const vaultTopRim = new Mesh(new TorusGeometry(0.3, 0.006, 10, 64), vaultRing);
  vaultTopRim.rotation.x = Math.PI / 2;
  vaultTopRim.position.set(v.x, 1.8, v.z);
  vault.add(vaultTopRim);
  const vaultLight = new PointLight(OBS.ivory, 0.5, 3.0, 2);
  vaultLight.position.set(v.x, 1.4, v.z);
  vault.add(vaultLight);
  const vaultLabel = makeLabel(
    [{ text: 'VERIFICATION INSTRUMENT', color: OBS.ivory, size: 38, weight: '700' },
     { text: 'sealed bundle · checked by an independent verifier process', color: OBS.ivoryDim, size: 33 }],
    { width: 0.98, background: '#000000d0', border: OBS.ivory },
  );
  vaultLabel.position.set(v.x, 0.52, v.z + 0.36);
  vault.add(vaultLabel);
  root.add(vault);

  return { chamberRing, chamberLight, vaultRing, vaultLight, limb, graduations };
}

/** Per-frame room state: the limb eases toward the real field presence. */
export function tickObservatory(h: ObservatoryHandles, delta: number, fieldPresence: number): void {
  const k = 1 - Math.exp(-delta * 3.2);
  const limbTarget = LIMB_REST + (0.95 - LIMB_REST) * fieldPresence;
  h.limb.opacity += (limbTarget - h.limb.opacity) * k;
  const gradTarget = LIMB_REST + (0.42 - LIMB_REST) * fieldPresence;
  h.graduations.opacity += (gradTarget - h.graduations.opacity) * k;
}

/** A solid arc sector (Y-up, opening toward -Z) of the given height. */
function arcSolid(inner: number, outer: number, spanRad: number, height: number): ExtrudeGeometry {
  const a0 = Math.PI / 2 - spanRad / 2;
  const a1 = Math.PI / 2 + spanRad / 2;
  const shape = new Shape();
  shape.moveTo(Math.cos(a0) * outer, Math.sin(a0) * outer);
  shape.absarc(0, 0, outer, a0, a1, false);
  shape.lineTo(Math.cos(a1) * inner, Math.sin(a1) * inner);
  shape.absarc(0, 0, inner, a1, a0, true);
  shape.closePath();
  const geo = new ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 64 });
  // Shape XY -> world XZ (shape +Y is world -Z), extrusion depth -> world +Y.
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/** Radial tick marks as one mesh of thin quads lying in the XZ plane. */
function buildTicks(radius: number, stepDeg: number, short: number, long: number, halfWidth: number): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  let n = 0;
  for (let deg = 0; deg < 360; deg += stepDeg) {
    const a = (deg * Math.PI) / 180;
    const len = deg % 10 === 0 ? long : short;
    const dx = Math.sin(a);
    const dz = -Math.cos(a);
    const tx = -dz * halfWidth;
    const tz = dx * halfWidth;
    const r0 = radius;
    const r1 = radius + len;
    positions.push(
      dx * r0 - tx, 0, dz * r0 - tz,
      dx * r0 + tx, 0, dz * r0 + tz,
      dx * r1 + tx, 0, dz * r1 + tz,
      dx * r1 - tx, 0, dz * r1 - tz,
    );
    indices.push(n, n + 1, n + 2, n, n + 2, n + 3);
    n += 4;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geo.setIndex(indices);
  return geo;
}

/** Meridians and parallels of a hemisphere as line segments. */
function buildDomeLines(radius: number, meridians: number, parallels: number): BufferGeometry {
  const pts: number[] = [];
  const STEPS = 20;
  for (let m = 0; m < meridians; m++) {
    const a = (m / meridians) * Math.PI * 2;
    for (let s = 0; s < STEPS; s++) {
      const e0 = (s / STEPS) * (Math.PI / 2) * 0.96;
      const e1 = ((s + 1) / STEPS) * (Math.PI / 2) * 0.96;
      pts.push(
        Math.sin(a) * Math.cos(e0) * radius, Math.sin(e0) * radius, Math.cos(a) * Math.cos(e0) * radius,
        Math.sin(a) * Math.cos(e1) * radius, Math.sin(e1) * radius, Math.cos(a) * Math.cos(e1) * radius,
      );
    }
  }
  const SEG = 96;
  for (let p = 1; p <= parallels; p++) {
    const e = (p / (parallels + 1)) * (Math.PI / 2);
    for (let s = 0; s < SEG; s++) {
      const a0 = (s / SEG) * Math.PI * 2;
      const a1 = ((s + 1) / SEG) * Math.PI * 2;
      pts.push(
        Math.sin(a0) * Math.cos(e) * radius, Math.sin(e) * radius, Math.cos(a0) * Math.cos(e) * radius,
        Math.sin(a1) * Math.cos(e) * radius, Math.sin(e) * radius, Math.cos(a1) * Math.cos(e) * radius,
      );
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3));
  return geo;
}

/** A soft band of light at the horizon, fading to nothing above and below. */
function horizonTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.72, 'rgba(46,52,74,0.0)');
  g.addColorStop(0.9, 'rgba(58,64,92,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
