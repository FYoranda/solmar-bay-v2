// Solmar Bay — actors: the articulated player character, detailed vehicles
// (incl. the Solmar Comet GT hero supercar), traffic cars and pedestrians.
import * as THREE from 'three';
import { VEHICLES } from './config.js';
import { mulberry32, makeCanvas } from './utils.js';

const glassMat = new THREE.MeshStandardMaterial({ color: 0x0d1520, roughness: 0.12, metalness: 0.85 });
const tireMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 });
const hubMat = new THREE.MeshStandardMaterial({ color: 0xb8bec8, roughness: 0.3, metalness: 0.8 });
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd8dde6, roughness: 0.2, metalness: 0.9 });

export function makeCharacter(opts = {}) {
  const skin = opts.skin || '#c98d64';
  const jacket = opts.jacket || 0x27324a;
  const pants = opts.pants || 0x1c1f28;
  const hair = opts.hair || '#1a1210';
  const g = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.75 });
  const jacketMat = new THREE.MeshStandardMaterial({ color: jacket, roughness: 0.85 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.9 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.9 });
  // legs (pivot at hip)
  function limb(w, h, d, mat, x, y) {
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.y = -h / 2; m.castShadow = true; pivot.add(m); g.add(pivot); return pivot;
  }
  const legL = limb(0.24, 0.8, 0.26, pantsMat, -0.16, 0.82);
  const legR = limb(0.24, 0.8, 0.26, pantsMat, 0.16, 0.82);
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.7 });
  for (const leg of [legL, legR]) {
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.42), shoeMat);
    shoe.position.set(0, -0.8, 0.06); leg.add(shoe);
  }
  // torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.72, 0.34), jacketMat);
  torso.position.y = 1.18; torso.castShadow = true; g.add(torso);
  const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 0.36),
    new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.9 }));
  shirt.position.set(0, 1.18, 0.02); g.add(shirt);
  // arms (pivot at shoulder)
  const armL = limb(0.17, 0.66, 0.2, jacketMat, -0.38, 1.5);
  const armR = limb(0.17, 0.66, 0.2, jacketMat, 0.38, 1.5);
  for (const arm of [armL, armR]) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), skinMat);
    hand.position.y = -0.7; arm.add(hand);
  }
  // head + hair + glasses
  const headG = new THREE.Group(); headG.position.y = 1.72; g.add(headG);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), skinMat);
  head.castShadow = true; headG.add(head);
  const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
  hairM.position.y = 0.04; headG.add(hairM);
  if (opts.hat) {
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.1, 12),
      new THREE.MeshStandardMaterial({ color: 0x8a1f2b, roughness: 0.8 }));
    hat.position.y = 0.24; headG.add(hat);
  }
  if (opts.glasses !== false) {
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x101018, roughness: 0.15, metalness: 0.6 });
    for (const sx of [-0.11, 0.11]) {
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.03), lensMat);
      lens.position.set(sx, 0.02, 0.23); headG.add(lens);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.02), lensMat);
    bridge.position.set(0, 0.02, 0.23); headG.add(bridge);
  }
  let walkPhase = 0;
  return {
    group: g, armL, armR, legL, legR, headG,
    setWalk(dt, speed01) {
      walkPhase += dt * (4 + speed01 * 8);
      const s = Math.sin(walkPhase) * (0.25 + speed01 * 0.45);
      legL.rotation.x = s; legR.rotation.x = -s;
      armL.rotation.x = -s * 0.8; armR.rotation.x = s * 0.8;
      g.position.y = Math.abs(Math.sin(walkPhase)) * 0.05 * speed01;
    },
    setIdle() { legL.rotation.x = 0; legR.rotation.x = 0; armL.rotation.x = 0; armR.rotation.x = 0; },
    setAim() {
      armR.rotation.x = -Math.PI / 2 + 0.15; armR.rotation.z = -0.1;
      armL.rotation.x = -Math.PI / 2 + 0.35; armL.rotation.z = 0.45;
      legL.rotation.x = 0.12; legR.rotation.x = -0.18;
    },
    setSurrender() {
      armL.rotation.z = 2.4; armR.rotation.z = -2.4;
      armL.rotation.x = 0; armR.rotation.x = 0;
    },
  };
}

function sideDecalTexture(text) {
  const c = makeCanvas(256, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.font = '900 34px Verdana, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ffffff'; g.fillText(text, w / 2, h / 2);
  });
  return c;
}

export function makeVehicle(spec, unitNo) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({
    color: spec.color, roughness: spec.kind === 'supercar' ? 0.22 : 0.4,
    metalness: spec.kind === 'supercar' ? 0.9 : 0.55,
  });
  const carbon = new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.35, metalness: 0.7 });
  const low = spec.kind === 'supercar';
  const bodyH = low ? 0.62 : 0.85;
  const bodyY = low ? 0.52 : 0.68;
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.6, bodyH, 2.0), paint);
  body.position.y = bodyY; body.castShadow = true; g.add(body);
  // hood slope + trunk
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 1.9), spec.carbon ? carbon : paint);
  hood.position.set(1.9, bodyY + bodyH / 2 + 0.04, 0); hood.rotation.z = -0.1; g.add(hood);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.55, 1.7), glassMat);
  cabin.position.set(-0.2, bodyY + bodyH / 2 + 0.28, 0); cabin.castShadow = true; g.add(cabin);
  if (spec.carbon) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 1.6), carbon);
    roof.position.set(-0.2, bodyY + bodyH / 2 + 0.6, 0); g.add(roof);
  }
  // bumpers + grille
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 2.0),
    new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.6 }));
  bumperF.position.set(2.35, 0.32, 0); g.add(bumperF);
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 1.2), chromeMat);
  grille.position.set(2.42, 0.62, 0); g.add(grille);
  // headlights (emissive) + full-width LED taillight bar
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xffe9a0, emissiveIntensity: 1.6 });
  for (const sz of [-0.62, 0.62]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.5), headMat);
    hl.position.set(2.32, 0.72, sz); g.add(hl);
  }
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1a1a, emissiveIntensity: 1.8 });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 1.9), tailMat);
  tail.position.set(-2.32, 0.74, 0); g.add(tail);
  // GT wing on twin pillars (Comet GT)
  if (spec.spoiler) {
    for (const sz of [-0.7, 0.7]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), carbon);
      pillar.position.set(-2.05, 1.15, sz); g.add(pillar);
    }
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.07, 2.1), carbon);
    wing.position.set(-2.1, 1.44, 0); wing.rotation.z = 0.12; wing.castShadow = true; g.add(wing);
    const wingEnd = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.06), carbon);
    wingEnd.position.set(-2.1, 1.5, -1.05); g.add(wingEnd);
    const wingEnd2 = wingEnd.clone(); wingEnd2.position.z = 1.05; g.add(wingEnd2);
    // rear diffuser
    const diff = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 1.8), carbon);
    diff.position.set(-2.2, 0.22, 0); g.add(diff);
    // dual exhausts
    for (const sz of [-0.4, 0.4]) {
      const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 8), chromeMat);
      ex.rotation.z = Math.PI / 2; ex.position.set(-2.42, 0.3, sz); g.add(ex);
    }
  }
  // police light bar + livery
  let lightBar = null;
  if (spec.kind === 'police') {
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 1.3),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }));
    barBase.position.set(-0.2, 1.42, 0); g.add(barBase);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.2, 0.58),
      new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2020, emissiveIntensity: 2.2 }));
    red.position.set(-0.2, 1.56, -0.32); g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.2, 0.58),
      new THREE.MeshStandardMaterial({ color: 0x000033, emissive: 0x2040ff, emissiveIntensity: 2.2 }));
    blue.position.set(-0.2, 1.56, 0.32); g.add(blue);
    lightBar = { red, blue };
    const decal = new THREE.CanvasTexture(sideDecalTexture(`SOLMAR PD · UNIT ${unitNo || 12}`));
    decal.colorSpace = THREE.SRGBColorSpace;
    for (const sz of [-1.01, 1.01]) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65),
        new THREE.MeshBasicMaterial({ map: decal, transparent: true }));
      d.position.set(0.1, 0.68, sz); d.rotation.y = sz > 0 ? 0 : Math.PI; g.add(d);
    }
    // push bar
    const push = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 1.9), chromeMat);
    push.position.set(2.5, 0.45, 0); g.add(push);
  }
  if (spec.kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffd166, emissiveIntensity: 1.2 }));
    sign.position.set(-0.2, 1.55, 0); g.add(sign);
  }
  // wheels
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.32, 14);
  const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.34, 10);
  for (const [wx, wz, front] of [[1.5, -0.95, true], [1.5, 0.95, true], [-1.5, -0.95, false], [-1.5, 0.95, false]]) {
    const pivot = new THREE.Group(); pivot.position.set(wx, 0.38, wz);
    const wheel = new THREE.Mesh(wheelGeo, tireMat); wheel.rotation.x = Math.PI / 2; wheel.castShadow = true;
    const hub = new THREE.Mesh(hubGeo, hubMat); hub.rotation.x = Math.PI / 2;
    pivot.add(wheel); pivot.add(hub); g.add(pivot);
    wheels.push({ pivot, wheel, front });
  }
  return {
    group: g, wheels, lightBar, spec,
    setWheelSpin(angle) { for (const w of wheels) w.wheel.rotation.y = angle; },
    setSteer(angle) { for (const w of wheels) if (w.front) w.pivot.rotation.y = angle; },
    setSirenPhase(phase) {
      if (!lightBar) return;
      lightBar.red.material.emissiveIntensity = phase ? 2.6 : 0.15;
      lightBar.blue.material.emissiveIntensity = phase ? 0.15 : 2.6;
    },
  };
}

export class TrafficCar {
  constructor(scene, world, rng) {
    this.rng = rng;
    const spec = VEHICLES[3 + Math.floor(rng() * 4)];
    this.car = makeVehicle(spec);
    this.mesh = this.car.group;
    scene.add(this.mesh);
    this.pickBlock(world);
    this.speed = 7 + rng() * 6;
    this.leg = 0;
  }
  pickBlock(world) {
    const ok = world.blocks.filter((b) => b.cz < 20 || b.cz > 100);
    const b = ok[Math.floor(this.rng() * ok.length)];
    const r = 20;
    this.loop = [
      [b.cx - r, b.cz - r], [b.cx + r, b.cz - r], [b.cx + r, b.cz + r], [b.cx - r, b.cz + r],
    ];
    this.leg = 0;
    this.mesh.position.set(this.loop[0][0], 0, this.loop[0][1]);
  }
  update(dt) {
    const target = this.loop[(this.leg + 1) % 4];
    const dx = target[0] - this.mesh.position.x, dz = target[1] - this.mesh.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.5) { this.leg = (this.leg + 1) % 4; return; }
    const want = Math.atan2(dx, dz);
    let diff = want - this.mesh.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.mesh.rotation.y += THREE.MathUtils.clamp(diff, -2.4 * dt, 2.4 * dt);
    this.mesh.position.x += Math.sin(this.mesh.rotation.y) * this.speed * dt;
    this.mesh.position.z += Math.cos(this.mesh.rotation.y) * this.speed * dt;
    this.car.setWheelSpin(this.mesh.position.x * 0.4);
  }
}

export class Pedestrian {
  constructor(scene, rng) {
    this.rng = rng;
    const jackets = [0x8a2f3c, 0x2f5d8a, 0x3c7a4d, 0xd8a03c, 0x6a4d8a, 0x2a2d38];
    this.char = makeCharacter({
      jacket: jackets[Math.floor(rng() * jackets.length)],
      skin: ['#c98d64', '#8a5a3b', '#e8b48c'][Math.floor(rng() * 3)],
      hair: ['#101010', '#4a2f1a', '#7a1f2b'][Math.floor(rng() * 3)],
      glasses: rng() < 0.3,
    });
    this.mesh = this.char.group;
    scene.add(this.mesh);
    this.x = -170 + rng() * 340; this.z = -160 + rng() * 290;
    this.mesh.position.set(this.x, 0, this.z);
    this.target = null; this.idle = 0; this.speed = 1.2 + rng() * 0.8;
  }
  update(dt) {
    if (this.idle > 0) { this.idle -= dt; this.char.setIdle(); return; }
    if (!this.target || Math.hypot(this.target[0] - this.x, this.target[1] - this.z) < 1) {
      if (this.rng() < 0.25) { this.idle = 1 + this.rng() * 3; return; }
      this.target = [this.x + (this.rng() - 0.5) * 60, this.z + (this.rng() - 0.5) * 60];
      this.target[0] = THREE.MathUtils.clamp(this.target[0], -180, 180);
      this.target[1] = THREE.MathUtils.clamp(this.target[1], -170, 145);
    }
    const dx = this.target[0] - this.x, dz = this.target[1] - this.z;
    const d = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    let diff = want - this.mesh.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.mesh.rotation.y += THREE.MathUtils.clamp(diff, -3 * dt, 3 * dt);
    this.x += Math.sin(this.mesh.rotation.y) * this.speed * dt;
    this.z += Math.cos(this.mesh.rotation.y) * this.speed * dt;
    this.mesh.position.set(this.x, 0, this.z);
    this.char.setWalk(dt, 0.4);
  }
}
