/**
 * ENGRAM Memory Lab — the room itself. Pure presentation: benches, consoles,
 * the counterfactual chamber shell, the evidence vault pedestal, lights and
 * drifting dust. Nothing here reads MNEME data; the systems that do place
 * their evidence objects INTO these zones (field-system, actor-system,
 * counterfactual-system, portable-system).
 *
 * Zones are physically distinct on purpose (README: "the spaces must remain
 * physically and semantically distinct"): the factual evidence bench is in
 * front, the counterfactual chamber is a separate raised ring to the left,
 * the evidence vault a separate pedestal to the right.
 */
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  FogExp2,
  Group,
  HemisphereLight,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  RingGeometry,
  Scene,
  SpotLight,
  TorusGeometry,
} from '@iwsdk/core';
import { makeLabel } from './labels.js';
import { OBS, OBSERVATORY } from './palette.js';

export type ObservatoryHandles = {
  chamberRing: MeshStandardMaterial;
  chamberLight: PointLight;
  vaultRing: MeshStandardMaterial;
  vaultLight: PointLight;
  benchStrip: MeshStandardMaterial;
  dust: Points;
  dustVelocity: Float32Array;
};

const DUST_COUNT = 420;
/** Interior height of the counterfactual containment column. */
export const CHAMBER_HEIGHT = 2.5;

export function buildObservatory(scene: Scene): ObservatoryHandles {
  scene.background = new Color(OBS.background);
  scene.fog = new FogExp2(OBS.background, 0.085);

  const root = new Group();
  root.name = 'lab-architecture';
  scene.add(root);

  // ---- Lighting rig -------------------------------------------------------
  root.add(new HemisphereLight('#3d5878', '#0a0d12', 0.55));
  const key = new DirectionalLight('#dfeaf5', 1.0);
  key.position.set(1.5, 3.2, 1.0);
  root.add(key);
  const fill = new DirectionalLight('#4e6f94', 0.3);
  fill.position.set(-2, 1.8, 0.6);
  root.add(fill);
  const benchPool = new SpotLight('#eaf3ff', 4.5, 6, Math.PI / 4.2, 0.5, 1.2);
  benchPool.position.set(0, 2.9, -0.6);
  benchPool.target.position.set(0, 1.0, -1.1);
  root.add(benchPool, benchPool.target);

  // ---- Floor --------------------------------------------------------------
  const floor = new Mesh(
    new CircleGeometry(5.5, 64),
    new MeshStandardMaterial({ color: OBS.floor, roughness: 0.6, metalness: 0.25 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.001, -1.2);
  root.add(floor);
  // Concentric floor rings instead of a square grid: the room reads as a
  // circular lab around the seated investigator.
  const ringMat = new MeshStandardMaterial({
    color: OBS.floorGrid, emissive: OBS.floorGrid, emissiveIntensity: 0.6, side: DoubleSide,
  });
  for (let r = 0.8; r <= 4.4; r += 0.6) {
    const ring = new Mesh(new RingGeometry(r - 0.006, r + 0.006, 96), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.002, -1.2);
    root.add(ring);
  }

  // ---- Walls / ceiling trim -----------------------------------------------
  const wallMat = new MeshStandardMaterial({ color: OBS.wall, roughness: 0.9, metalness: 0.05, side: DoubleSide });
  const back = new Mesh(new PlaneGeometry(12, 4.8), wallMat);
  back.position.set(0, 2.3, -4.2);
  root.add(back);
  const left = new Mesh(new PlaneGeometry(10, 4.8), wallMat);
  left.rotation.y = Math.PI / 2;
  left.position.set(-4.5, 2.3, -1.2);
  root.add(left);
  const right = new Mesh(new PlaneGeometry(10, 4.8), wallMat);
  right.rotation.y = -Math.PI / 2;
  right.position.set(4.5, 2.3, -1.2);
  root.add(right);
  const ceiling = new Mesh(new PlaneGeometry(12, 10), wallMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 3.6, -1.2);
  root.add(ceiling);

  // Light strips across the ceiling and a halo over the bench.
  const stripMat = new MeshStandardMaterial({
    color: '#9fc8ff', emissive: '#9fc8ff', emissiveIntensity: 1.6, roughness: 0.4,
  });
  for (const x of [-2.4, -1.2, 0, 1.2, 2.4]) {
    const strip = new Mesh(new BoxGeometry(0.06, 0.02, 7.5), stripMat);
    strip.position.set(x, 3.58, -1.2);
    root.add(strip);
  }
  // Columns anchoring the back wall.
  const columnMat = new MeshStandardMaterial({ color: OBS.trim, roughness: 0.5, metalness: 0.6 });
  for (const x of [-3.2, -1.6, 1.6, 3.2]) {
    const column = new Mesh(new BoxGeometry(0.18, 3.6, 0.18), columnMat);
    column.position.set(x, 1.8, -4.05);
    root.add(column);
  }

  // ---- Evidence bench (factual zone, front) --------------------------------
  const bench = new Group();
  const { benchCenter, benchRadius, benchSpanDeg } = OBSERVATORY;
  const benchMat = new MeshStandardMaterial({ color: '#111925', roughness: 0.35, metalness: 0.5 });
  const spanRad = (benchSpanDeg * Math.PI) / 180;
  // RingGeometry lies in XY; rotated -90deg about X, its +Y maps to -Z, so a
  // span centred on +90deg faces away from the seated player.
  const thetaStart = Math.PI / 2 - spanRad / 2;
  const top = new Mesh(
    new RingGeometry(benchRadius - 0.22, benchRadius + 0.2, 72, 1, thetaStart, spanRad),
    benchMat,
  );
  top.rotation.x = -Math.PI / 2;
  top.position.set(benchCenter.x, 0.86, benchCenter.z);
  bench.add(top);
  const benchStrip = new MeshStandardMaterial({
    color: OBS.evidence, emissive: OBS.evidence, emissiveIntensity: 1.2, side: DoubleSide,
  });
  const strip = new Mesh(
    new RingGeometry(benchRadius + 0.2, benchRadius + 0.225, 72, 1, thetaStart, spanRad),
    benchStrip,
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(benchCenter.x, 0.862, benchCenter.z);
  bench.add(strip);
  // Bench legs along the arc.
  for (let i = 0; i <= 6; i++) {
    const a = thetaStart + (spanRad * i) / 6;
    const leg = new Mesh(new CylinderGeometry(0.03, 0.03, 0.86, 12), columnMat);
    leg.position.set(benchCenter.x + Math.cos(a) * benchRadius, 0.43, benchCenter.z + Math.sin(a) * benchRadius);
    bench.add(leg);
  }
  const benchLabel = makeLabel(
    [{ text: 'FACTUAL FIELD', color: OBS.evidence, size: 30, weight: '700' },
     { text: 'the recorded field · live MNEME snapshot', color: '#9fb3c8', size: 20 }],
    { width: 0.5, background: '#0b121bcc', border: '#5fc9ff66' },
  );
  benchLabel.position.set(0, 0.72, -0.52);
  bench.add(benchLabel);
  root.add(bench);

  // ---- Consoles (left: provenance, right: containment) --------------------
  const consoleMat = new MeshStandardMaterial({ color: '#0f1724', roughness: 0.4, metalness: 0.45 });
  const makeConsole = (x: number, z: number, rotY: number, accent: string) => {
    const g = new Group();
    const body = new Mesh(new BoxGeometry(0.9, 0.08, 0.42), consoleMat);
    body.position.y = 0.78;
    g.add(body);
    const lip = new Mesh(
      new BoxGeometry(0.9, 0.012, 0.012),
      new MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 1.4 }),
    );
    lip.position.set(0, 0.826, 0.21);
    g.add(lip);
    const stem = new Mesh(new CylinderGeometry(0.05, 0.09, 0.76, 16), columnMat);
    stem.position.y = 0.38;
    g.add(stem);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    return g;
  };
  root.add(makeConsole(-1.62, -1.05, Math.PI / 4.3, OBS.provenance));
  root.add(makeConsole(1.62, -1.05, -Math.PI / 4.3, OBS.containment));
  const leftLight = new PointLight(OBS.provenance, 1.6, 3.5, 2);
  leftLight.position.set(-1.6, 1.7, -1.0);
  root.add(leftLight);
  const rightLight = new PointLight(OBS.containment, 1.6, 3.5, 2);
  rightLight.position.set(1.6, 1.7, -1.0);
  root.add(rightLight);

  // ---- Actor rack (back wall shelf) ---------------------------------------
  const rack = new Group();
  const shelf = new Mesh(new BoxGeometry(OBSERVATORY.actorRack.spread + 0.5, 0.04, 0.3), consoleMat);
  shelf.position.set(OBSERVATORY.actorRack.x, OBSERVATORY.actorRack.y - 0.2, OBSERVATORY.actorRack.z);
  rack.add(shelf);
  const rackLabel = makeLabel(
    [{ text: 'ACTOR REGISTRY', color: '#9fb3c8', size: 28, weight: '700' },
     { text: 'who wrote into the field · pick one up to read its grants', color: '#6f8196', size: 19 }],
    { width: 0.6, background: '#0b121bcc', border: '#36465a' },
  );
  rackLabel.position.set(OBSERVATORY.actorRack.x, OBSERVATORY.actorRack.y + 0.42, OBSERVATORY.actorRack.z);
  rack.add(rackLabel);
  root.add(rack);

  // ---- Counterfactual chamber (hypothetical zone, left, raised) -----------
  const chamber = new Group();
  const c = OBSERVATORY.chamber;
  const platform = new Mesh(new CylinderGeometry(c.radius, c.radius + 0.08, 0.12, 48), consoleMat);
  platform.position.set(c.x, 0.06, c.z);
  chamber.add(platform);
  const chamberRing = new MeshStandardMaterial({
    color: OBS.chamber, emissive: OBS.chamber, emissiveIntensity: 0.35, side: DoubleSide,
  });
  const chamberRingMesh = new Mesh(new TorusGeometry(c.radius, 0.012, 12, 96), chamberRing);
  chamberRingMesh.rotation.x = Math.PI / 2;
  chamberRingMesh.position.set(c.x, 0.125, c.z);
  chamber.add(chamberRingMesh);
  // A containment column, not a dome: the hypothetical world has to be a
  // volume the comparison can actually live inside at reading height, and
  // it has to read as sealed from across the room.
  const column = new Mesh(
    new CylinderGeometry(c.radius, c.radius, CHAMBER_HEIGHT, 48, 1, true),
    new MeshPhysicalMaterial({
      color: OBS.chamber, transparent: true, opacity: 0.07, roughness: 0.15, metalness: 0,
      side: DoubleSide, depthWrite: false,
    }),
  );
  column.position.set(c.x, 0.12 + CHAMBER_HEIGHT / 2, c.z);
  chamber.add(column);
  const topRim = new Mesh(new TorusGeometry(c.radius, 0.01, 12, 96), chamberRing);
  topRim.rotation.x = Math.PI / 2;
  topRim.position.set(c.x, 0.12 + CHAMBER_HEIGHT, c.z);
  chamber.add(topRim);
  // Four uprights so the column reads as a built instrument rather than fog.
  const strutMat = new MeshStandardMaterial({ color: OBS.trim, roughness: 0.4, metalness: 0.6 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const strut = new Mesh(new CylinderGeometry(0.012, 0.012, CHAMBER_HEIGHT, 8), strutMat);
    strut.position.set(c.x + Math.cos(a) * c.radius, 0.12 + CHAMBER_HEIGHT / 2, c.z + Math.sin(a) * c.radius);
    chamber.add(strut);
  }
  const chamberLight = new PointLight(OBS.chamber, 0.6, 4.2, 2);
  chamberLight.position.set(c.x, 1.5, c.z);
  chamber.add(chamberLight);
  const chamberLabel = makeLabel(
    [{ text: 'COUNTERFACTUAL CHAMBER', color: OBS.chamber, size: 30, weight: '700' },
     { text: 'sealed hypothetical  ·  never executed  ·  never merged', color: '#b8a6d8', size: 19 }],
    { width: 0.72, background: '#120b1fcc', border: '#b060ff66' },
  );
  chamberLabel.position.set(c.x, 0.5, c.z + c.radius * 0.1);
  chamber.add(chamberLabel);
  root.add(chamber);

  // ---- Evidence vault (portable instrument, right) ------------------------
  const vault = new Group();
  const v = OBSERVATORY.vault;
  const pedestal = new Mesh(new CylinderGeometry(0.28, 0.36, 0.9, 32), consoleMat);
  pedestal.position.set(v.x, 0.45, v.z);
  vault.add(pedestal);
  const vaultRing = new MeshStandardMaterial({
    color: OBS.vault, emissive: OBS.vault, emissiveIntensity: 0.35, side: DoubleSide,
  });
  const vaultRingMesh = new Mesh(new TorusGeometry(0.3, 0.01, 12, 64), vaultRing);
  vaultRingMesh.rotation.x = Math.PI / 2;
  vaultRingMesh.position.set(v.x, 0.905, v.z);
  vault.add(vaultRingMesh);
  const vaultColumn = new Mesh(
    new CylinderGeometry(0.3, 0.3, 0.9, 32, 1, true),
    new MeshPhysicalMaterial({
      color: OBS.vault, transparent: true, opacity: 0.06, roughness: 0.2, metalness: 0,
      side: DoubleSide, depthWrite: false,
    }),
  );
  vaultColumn.position.set(v.x, 1.35, v.z);
  vault.add(vaultColumn);
  const vaultTopRim = new Mesh(new TorusGeometry(0.3, 0.008, 10, 64), vaultRing);
  vaultTopRim.rotation.x = Math.PI / 2;
  vaultTopRim.position.set(v.x, 1.8, v.z);
  vault.add(vaultTopRim);
  const vaultLight = new PointLight(OBS.vault, 0.5, 3.0, 2);
  vaultLight.position.set(v.x, 1.4, v.z);
  vault.add(vaultLight);
  const vaultLabel = makeLabel(
    [{ text: 'VERIFICATION INSTRUMENT', color: OBS.vault, size: 30, weight: '700' },
     { text: 'sealed bundle · checked by an independent verifier process', color: '#a6d8c0', size: 19 }],
    { width: 0.6, background: '#0a1a14cc', border: '#4be0a066' },
  );
  vaultLabel.position.set(v.x, 0.52, v.z);
  vault.add(vaultLabel);
  root.add(vault);

  // ---- Drifting dust (cheap atmosphere) -----------------------------------
  const positions = new Float32Array(DUST_COUNT * 3);
  const dustVelocity = new Float32Array(DUST_COUNT);
  for (let i = 0; i < DUST_COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 7;
    positions[i * 3 + 1] = Math.random() * 3.2;
    positions[i * 3 + 2] = -1.2 + (Math.random() - 0.5) * 6;
    dustVelocity[i] = 0.02 + Math.random() * 0.05;
  }
  const dustGeo = new BufferGeometry();
  dustGeo.setAttribute('position', new BufferAttribute(positions, 3));
  const dust = new Points(
    dustGeo,
    new PointsMaterial({
      color: '#9fd0ff', size: 0.012, transparent: true, opacity: 0.45,
      blending: AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }),
  );
  root.add(dust);

  return { chamberRing, chamberLight, vaultRing, vaultLight, benchStrip, dust, dustVelocity };
}

/** Per-frame ambience: dust drift and the bench strip breathing. */
export function tickObservatory(h: ObservatoryHandles, delta: number, time: number): void {
  const pos = h.dust.geometry.getAttribute('position') as BufferAttribute;
  const arr = pos.array as Float32Array;
  for (let i = 0; i < DUST_COUNT; i++) {
    let y = arr[i * 3 + 1] + h.dustVelocity[i] * delta;
    if (y > 3.3) y = 0;
    arr[i * 3 + 1] = y;
  }
  pos.needsUpdate = true;
  h.benchStrip.emissiveIntensity = 1.0 + Math.sin(time * 1.4) * 0.25;
}
