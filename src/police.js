// Solmar Bay — police: interceptor chase AI (RAMMING), roadblocks, the Air One
// helicopter with its spotlight cone, explosions, tire smoke and skid marks.
import * as THREE from 'three';
import { VEHICLES } from './config.js';
import { makeVehicle } from './actors.js';
import { clamp } from './utils.js';

export class PoliceUnit {
  constructor(scene, unitNo) {
    this.car = makeVehicle(VEHICLES[2], unitNo);
    this.mesh = this.car.group;
    scene.add(this.mesh);
    this.unitNo = unitNo;
    this.speed = 0; this.maxSpeed = 34;
    this.state = 'chase'; this.phase = Math.random() * 10;
    this.sirenT = 0;
  }
  spawn(x, z, heading) {
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    this.speed = 12;
  }
  update(dt, playerPos, playerSpeed) {
    this.sirenT += dt;
    this.car.setSirenPhase(Math.sin(this.sirenT * 9) > 0);
    const dx = playerPos.x - this.mesh.position.x, dz = playerPos.z - this.mesh.position.z;
    const d = Math.hypot(dx, dz);
    // aim slightly ahead of the player for the ram
    const lead = 0.35;
    const tx = playerPos.x + Math.sin(playerPos.heading || 0) * playerSpeed * lead;
    const tz = playerPos.z + Math.cos(playerPos.heading || 0) * playerSpeed * lead;
    const want = Math.atan2(tx - this.mesh.position.x, tz - this.mesh.position.z);
    let diff = want - this.mesh.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = clamp(diff, -1, 1);
    this.mesh.rotation.y += steer * 2.6 * dt * (0.4 + Math.min(1, this.speed / 20));
    const targetSpeed = d > 6 ? this.maxSpeed : this.maxSpeed * 0.55;
    this.speed += clamp(targetSpeed - this.speed, -26 * dt, 16 * dt);
    this.mesh.position.x += Math.sin(this.mesh.rotation.y) * this.speed * dt;
    this.mesh.position.z += Math.cos(this.mesh.rotation.y) * this.speed * dt;
    this.car.setWheelSpin(this.mesh.position.x * 0.5);
    this.car.setSteer(steer * 0.42);
    return d;
  }
}

export class Roadblock {
  constructor(scene) {
    this.group = new THREE.Group();
    const stripe = new THREE.CanvasTexture(
      (() => {
        const c = document.createElement('canvas'); c.width = 128; c.height = 32;
        const g = c.getContext('2d');
        for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f2f2f2' : '#d21f3c'; g.fillRect(i * 16, 0, 16, 32); }
        return c;
      })(),
    );
    stripe.colorSpace = THREE.SRGBColorSpace;
    for (const [x, z, rot] of [[-3.4, 0, 0.5], [3.4, 0, -0.5]]) {
      const car = makeVehicle(VEHICLES[2], 7);
      car.group.position.set(x, 0, z); car.group.rotation.y = rot;
      this.group.add(car.group);
    }
    for (const [x, z] of [[-1.2, 2.6], [1.2, -2.6]]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1, 0.5),
        new THREE.MeshStandardMaterial({ map: stripe, roughness: 0.7 }));
      bar.position.set(x, 0.9, z); bar.rotation.y = 0.4; bar.castShadow = true;
      this.group.add(bar);
    }
    this.group.visible = false;
    scene.add(this.group);
    this.active = false;
  }
  place(x, z, heading, y = 0) {
    this.group.position.set(x, y, z);
    this.group.rotation.y = heading;
    this.group.visible = true; this.active = true;
  }
  clear() { this.group.visible = false; this.active = false; }
}

export class AirOne {
  constructor(scene) {
    this.group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x7d90b8, roughness: 0.35, metalness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.8, 2.2), bodyMat);
    body.castShadow = true; this.group.add(body);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(1.05, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x0d1520, roughness: 0.15, metalness: 0.8 }));
    nose.position.set(2.4, -0.1, 0); nose.scale.set(1.2, 0.9, 1); this.group.add(nose);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.5, 4.6, 8), bodyMat);
    tail.rotation.z = Math.PI / 2; tail.position.set(-4, 0.3, 0); this.group.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.6, 0.2), bodyMat);
    fin.position.set(-6, 1, 0); this.group.add(fin);
    this.rotor = new THREE.Group();
    for (const a of [0, Math.PI / 2]) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.08, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 }));
      blade.rotation.y = a; this.rotor.add(blade);
    }
    this.rotor.position.y = 1.3; this.group.add(this.rotor);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 4.8, 0.06, 24),
      new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.28, side: THREE.DoubleSide }));
    disc.position.y = 1.3; this.group.add(disc);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1, 8), bodyMat);
    mast.position.y = 0.9; this.group.add(mast);
    // spotlight cone + real light
    this.spot = new THREE.SpotLight(0xfff2b0, 900, 160, 0.32, 0.45, 1.1);
    this.spot.position.set(0, -0.8, 0);
    this.group.add(this.spot); this.group.add(this.spot.target);
    const coneGeo = new THREE.ConeGeometry(9, 46, 20, 1, true);
    this.cone = new THREE.Mesh(coneGeo,
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }));
    this.cone.position.y = -24; this.cone.rotation.x = Math.PI;
    this.group.add(this.cone);
    this.group.visible = false;
    scene.add(this.group);
    this.active = false;
  }
  update(dt, t, target, heading = 0) {
    if (!this.active) return;
    this.rotor.rotation.y += dt * 22;
    const fx = Math.sin(heading), fz = Math.cos(heading);
    const rx = Math.cos(heading), rz = -Math.sin(heading);
    const baseY = (target.y || 0) + 8;
    const want = new THREE.Vector3(target.x + fx * 13 - rx * 8, baseY + Math.sin(t * 0.6) * 2, target.z + fz * 13 - rz * 8);
    this.group.position.lerp(want, 1 - Math.pow(0.02, dt));
    this.spot.target.position.set(target.x - this.group.position.x, (target.y || 0) - this.group.position.y, target.z - this.group.position.z);
    this.cone.lookAt(target.x, target.y || 0, target.z);
    this.cone.rotateX(-Math.PI / 2 + 0.02);
    this.cone.material.opacity = 0.18 + Math.sin(t * 7) * 0.03;
  }
  show(x, y, z) {
    if (x !== undefined) this.group.position.set(x, y, z);
    this.group.visible = true; this.active = true;
  }
  hide() { this.group.visible = false; this.active = false; }
}

// Explosions, fire, smoke and skid marks — one pool, no allocations per frame.
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.parts = [];
    this.skids = [];
    this.fires = [];
    const fireGeo = new THREE.SphereGeometry(1, 12, 10);
    this.fireGeo = fireGeo;
    this.smokeMat = new THREE.MeshBasicMaterial({ color: 0x555560, transparent: true, opacity: 0.5 });
    this.fireMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.95 });
    this.flash = new THREE.PointLight(0xff8a2a, 0, 40, 1.6);
    scene.add(this.flash);
  }
  explosion(x, y, z, big) {
    const s = big ? 3.2 : 1.8;
    const ball = new THREE.Mesh(this.fireGeo, this.fireMat.clone());
    ball.position.set(x, y + 1, z); ball.scale.setScalar(0.4);
    this.scene.add(ball);
    this.parts.push({ mesh: ball, life: 0.9, max: 0.9, grow: s * 3.2, rise: 3, fade: true });
    for (let i = 0; i < (big ? 14 : 8); i++) {
      const p = new THREE.Mesh(this.fireGeo, this.smokeMat.clone());
      p.position.set(x + (Math.random() - 0.5) * 2, y + 1 + Math.random() * 2, z + (Math.random() - 0.5) * 2);
      p.scale.setScalar(0.5 + Math.random() * 0.9);
      this.scene.add(p);
      this.parts.push({ mesh: p, life: 1.6 + Math.random(), max: 2.2, grow: 1.2, rise: 5 + Math.random() * 3, fade: true, vx: (Math.random() - 0.5) * 6, vz: (Math.random() - 0.5) * 6 });
    }
    this.flash.position.set(x, y + 4, z);
    this.flash.intensity = big ? 900 : 420;
    return ball;
  }
  tireSmoke(x, y, z) {
    const p = new THREE.Mesh(this.fireGeo, this.smokeMat.clone());
    p.material.opacity = 0.55;
    p.position.set(x, y + 0.3, z); p.scale.setScalar(0.5);
    this.scene.add(p);
    this.parts.push({ mesh: p, life: 1.1, max: 1.1, grow: 2.4, rise: 1.2, fade: true });
  }
  skidMark(x, z, angle, len) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.55, len),
      new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.6 }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = angle;
    m.position.set(x, 0.07, z);
    this.scene.add(m);
    this.skids.push({ mesh: m, life: 9 });
  }
  // a wreck that keeps burning (bridge shot centrepiece)
  burningWreck(x, z, heading, y = 0) {
    const g = new THREE.Group();
    const wreck = makeVehicle(VEHICLES[2], 9);
    wreck.group.rotation.z = 0.14; wreck.group.rotation.y = heading;
    g.add(wreck.group);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(2.0, 6, 10),
      new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.9 }));
    flame.position.set(0, 3.2, 0); g.add(flame);
    const light = new THREE.PointLight(0xff7a1a, 380, 34, 1.6);
    light.position.set(0, 4, 0); g.add(light);
    g.position.set(x, y, z);
    this.scene.add(g);
    const fire = { group: g, flame, light, t: Math.random() * 10, smokeT: 0 };
    this.fires.push(fire);
    return fire;
  }
  update(dt, t) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.scene.remove(p.mesh); p.mesh.material.dispose(); this.parts.splice(i, 1); continue; }
      const k = 1 - p.life / p.max;
      p.mesh.scale.setScalar(0.4 + k * p.grow);
      p.mesh.position.y += p.rise * dt;
      if (p.vx) { p.mesh.position.x += p.vx * dt; p.mesh.position.z += p.vz * dt; }
      if (p.fade) p.mesh.material.opacity = Math.max(0, (p.life / p.max) * 0.9);
    }
    for (let i = this.skids.length - 1; i >= 0; i--) {
      const s = this.skids[i]; s.life -= dt;
      if (s.life <= 0) { this.scene.remove(s.mesh); s.mesh.material.dispose(); this.skids.splice(i, 1); continue; }
      s.mesh.material.opacity = Math.min(0.6, s.life * 0.08);
    }
    this.flash.intensity = Math.max(0, this.flash.intensity - dt * 1400);
    for (const f of this.fires) {
      f.t += dt;
      f.flame.scale.set(1 + Math.sin(f.t * 13) * 0.18, 1 + Math.sin(f.t * 17) * 0.25, 1);
      f.light.intensity = 360 + Math.sin(f.t * 11) * 80;
      f.smokeT -= dt;
      if (f.smokeT <= 0) {
        f.smokeT = 0.12;
        const wp = new THREE.Vector3(); f.group.getWorldPosition(wp);
        this.tireSmoke(wp.x + 2.2, wp.y + 4.2, wp.z);
      }
    }
  }
}
