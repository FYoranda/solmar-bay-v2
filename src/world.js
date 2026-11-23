// Solmar Bay — the world: a sun-soaked coastal city. Red suspension bridge,
// Santa Maria Pier with a glowing Ferris wheel and lighthouse, Verona Canal,
// golden beach, Art Deco downtown with neon, palms and lamps. All procedural.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { mulberry32, buildingTexture, roadTexture, sandTexture, waterTexture, neonSignTexture, makeCanvas } from './utils.js';

const SUNSET = 0xff9a5c;

export function buildWorld(scene) {
  const rng = mulberry32(1337);
  const anim = { ferris: null, beam: null, sea: null, foam: [], neon: [] };
  const colliders = [];
  const blocks = [];

  // ---- sky, sun, light -------------------------------------------------
  const skyTex = new THREE.CanvasTexture(makeCanvas(16, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#1b2a5e'); grad.addColorStop(0.45, '#7a4a8f');
    grad.addColorStop(0.68, '#ff7e4a'); grad.addColorStop(0.82, '#ffb347'); grad.addColorStop(1, '#ffd166');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  }));
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(880, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }));
  scene.add(sky);
  const sun = new THREE.Mesh(new THREE.CircleGeometry(46, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false }));
  sun.position.set(-620, 95, 260); sun.lookAt(0, 40, 0); scene.add(sun);
  const sunGlow = new THREE.Mesh(new THREE.CircleGeometry(90, 32),
    new THREE.MeshBasicMaterial({ color: 0xff9a4a, transparent: true, opacity: 0.28, fog: false }));
  sunGlow.position.copy(sun.position).add(new THREE.Vector3(0, 0, -2)); sunGlow.lookAt(0, 40, 0); scene.add(sunGlow);
  scene.fog = new THREE.Fog(SUNSET, 160, 820);
  const hemi = new THREE.HemisphereLight(0xff9a6b, 0x33415e, 1.15); scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xffb36b, 2.8);
  sunLight.position.set(-220, 110, 140); sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -260; sunLight.shadow.camera.right = 260;
  sunLight.shadow.camera.top = 260; sunLight.shadow.camera.bottom = -260;
  sunLight.shadow.camera.far = 700; sunLight.shadow.bias = -0.0004;
  scene.add(sunLight); scene.add(sunLight.target);

  // ---- ground, roads, sidewalks ----------------------------------------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(560, 560),
    new THREE.MeshStandardMaterial({ color: 0x2a2d38, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 0); ground.receiveShadow = true; scene.add(ground);
  const roadTex = new THREE.CanvasTexture(roadTexture());
  roadTex.colorSpace = THREE.SRGBColorSpace;
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.95 });
  const roads = [];
  function addRoad(cx, cz, w, l, horizontal) {
    const tex = roadTex.clone(); tex.needsUpdate = true;
    tex.repeat.set(horizontal ? l / 12 : w / 12, horizontal ? w / 12 : l / 12);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = horizontal ? 0 : Math.PI / 2;
    m.position.set(cx, 0.03, cz); m.receiveShadow = true; scene.add(m);
    roads.push({ axis: horizontal ? 'x' : 'z', at: horizontal ? cz : cx, from: horizontal ? cx - l / 2 : cz - l / 2, to: horizontal ? cx + l / 2 : cz + l / 2 });
  }
  const hz = [-160, -120, -80, -40, 0, 40, 120, 128];
  for (const z of hz) addRoad(0, z, 11, 380, true);
  const vx = [-160, -120, -80, -40, 0, 40, 80, 120, 160];
  for (const x of vx) { addRoad(x, -30, 11, 300, false); addRoad(x, 104, 11, 48, false); }
  // sidewalks: lighter strips along the coastal road and downtown
  const walkMat = new THREE.MeshStandardMaterial({ color: 0x8d8578, roughness: 1 });
  for (const z of [-120, -40, 40, 120]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(380, 3.4), walkMat);
    s.rotation.x = -Math.PI / 2; s.position.set(0, 0.05, z + 7.2); s.receiveShadow = true; scene.add(s);
  }
  const boardwalk = new THREE.Mesh(new THREE.PlaneGeometry(480, 8),
    new THREE.MeshStandardMaterial({ color: 0x9a7b52, roughness: 1 }));
  boardwalk.rotation.x = -Math.PI / 2; boardwalk.position.set(0, 0.06, 150); boardwalk.receiveShadow = true; scene.add(boardwalk);

  // ---- beach + sea -------------------------------------------------------
  const sandTex = new THREE.CanvasTexture(sandTexture());
  sandTex.colorSpace = THREE.SRGBColorSpace; sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping; sandTex.repeat.set(24, 3);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(480, 34),
    new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1 }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.02, 166); sand.receiveShadow = true; scene.add(sand);
  const seaTex = new THREE.CanvasTexture(waterTexture());
  seaTex.colorSpace = THREE.SRGBColorSpace; seaTex.wrapS = seaTex.wrapT = THREE.RepeatWrapping; seaTex.repeat.set(10, 6);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(560, 240),
    new THREE.MeshStandardMaterial({ map: seaTex, roughness: 0.35, metalness: 0.25, transparent: true, opacity: 0.94 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, WORLD.seaLevel, 300); scene.add(sea);
  anim.sea = seaTex;
  for (let i = 0; i < 5; i++) {
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(480, 1.6 + i * 0.7),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 - i * 0.05 }));
    foam.rotation.x = -Math.PI / 2; foam.position.set(0, 0.08, 183 + i * 2.2); scene.add(foam); anim.foam.push(foam);
  }

  // ---- Verona Canal ------------------------------------------------------
  const canalTex = new THREE.CanvasTexture(waterTexture());
  canalTex.colorSpace = THREE.SRGBColorSpace; canalTex.wrapS = canalTex.wrapT = THREE.RepeatWrapping; canalTex.repeat.set(6, 1);
  const canal = new THREE.Mesh(new THREE.PlaneGeometry(140, 16),
    new THREE.MeshStandardMaterial({ map: canalTex, roughness: 0.3, metalness: 0.2 }));
  canal.rotation.x = -Math.PI / 2; canal.position.set(60, 0.12, WORLD.canalZ); scene.add(canal);
  const bankMat = new THREE.MeshStandardMaterial({ color: 0x6b6258, roughness: 1 });
  for (const z of [WORLD.canalZ - 9.5, WORLD.canalZ + 9.5]) {
    const bank = new THREE.Mesh(new THREE.BoxGeometry(144, 1.2, 3), bankMat);
    bank.position.set(60, 0.6, z); bank.castShadow = true; scene.add(bank);
  }
  // arched footbridges over the canal
  const archMat = new THREE.MeshStandardMaterial({ color: 0xd8cfc0, roughness: 0.9 });
  for (const bx of [20, 90]) {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(6, 0.8, 22), archMat);
    deck.position.set(bx, 1.6, WORLD.canalZ); deck.castShadow = true; scene.add(deck);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(8, 0.9, 8, 16, Math.PI), archMat);
    arch.position.set(bx, 0.4, WORLD.canalZ); arch.rotation.y = Math.PI / 2; scene.add(arch);
  }

  // ---- Santa Maria Pier + Ferris wheel + lighthouse -----------------------
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 1 });
  const pierDeck = new THREE.Mesh(new THREE.BoxGeometry(14, 1.4, 118), pierMat);
  pierDeck.position.set(WORLD.pierX, 1.2, 209); pierDeck.castShadow = true; pierDeck.receiveShadow = true; scene.add(pierDeck);
  colliders.push({ x0: 52, z0: 150, x1: 68, z1: 268, y: 1.9 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 1 });
  for (const x of [WORLD.pierX - 6.8, WORLD.pierX + 6.8]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 118), railMat);
    rail.position.set(x, 2.6, 209); scene.add(rail);
  }
  // pier lamps
  const lampGlow = new THREE.MeshBasicMaterial({ color: 0xffe6a3 });
  for (let i = 0; i < 8; i++) {
    const z = 158 + i * 15;
    for (const x of [WORLD.pierX - 5.5, WORLD.pierX + 5.5]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 4.4, 6),
        new THREE.MeshStandardMaterial({ color: 0x2a2a33, roughness: 0.7, metalness: 0.5 }));
      pole.position.set(x, 4, z); scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), lampGlow);
      bulb.position.set(x, 6.4, z); scene.add(bulb);
    }
  }
  // Ferris wheel
  const wheel = new THREE.Group();
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0xd8d8e8, roughness: 0.4, metalness: 0.6, emissive: 0x331133, emissiveIntensity: 0.4 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(15, 0.55, 8, 40), wheelMat);
  wheel.add(rim);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xff5ea8 });
  const bulbMat2 = new THREE.MeshBasicMaterial({ color: 0x7df9ff });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 15, 6), wheelMat);
    spoke.position.set(Math.cos(a) * 7.5, Math.sin(a) * 7.5, 0); spoke.rotation.z = a + Math.PI / 2; wheel.add(spoke);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), i % 2 ? bulbMat : bulbMat2);
    bulb.position.set(Math.cos(a) * 15, Math.sin(a) * 15, 0); wheel.add(bulb);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 2.2),
      new THREE.MeshStandardMaterial({ color: [0xff3860, 0x7df9ff, 0xffd166, 0xff9f1c][i % 4], roughness: 0.5 }));
    cab.position.set(Math.cos(a) * 15, Math.sin(a) * 15, 1.4); wheel.add(cab);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 3, 12), wheelMat);
  hub.rotation.x = Math.PI / 2; wheel.add(hub);
  wheel.position.set(WORLD.pierX, 19, 208);
  scene.add(wheel); anim.ferris = wheel;
  for (const dx of [-9, 9]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1, 20, 8), wheelMat);
    leg.position.set(WORLD.pierX + dx, 10, 208); leg.rotation.z = dx > 0 ? -0.42 : 0.42; scene.add(leg);
  }
  // lighthouse at the pier end
  const stripeTex = new THREE.CanvasTexture(makeCanvas(64, 128, (g, w, h) => {
    for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#f2f2f2' : '#d21f3c'; g.fillRect(0, i * h / 6, w, h / 6); }
  }));
  stripeTex.colorSpace = THREE.SRGBColorSpace;
  const light = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.2, 24, 14),
    new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.7 }));
  light.position.set(WORLD.pierX, 14, 262); light.castShadow = true; scene.add(light);
  const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 3, 12),
    new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.4, metalness: 0.6, emissive: 0xffe6a3, emissiveIntensity: 0.8 }));
  lampRoom.position.set(WORLD.pierX, 27, 262); scene.add(lampRoom);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(7, 60, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
  beam.position.set(WORLD.pierX, 27, 262); beam.rotation.z = Math.PI / 2; beam.translateY(30);
  scene.add(beam); anim.beam = beam;

  // ---- red suspension bridge ----------------------------------------------
  const bridge = new THREE.Group();
  const redMat = new THREE.MeshStandardMaterial({ color: 0xc1272d, roughness: 0.55, metalness: 0.35 });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x2b2e36, roughness: 0.95 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(13, 1.4, 272), deckMat);
  deck.position.set(WORLD.bridgeX, WORLD.bridgeDeckY, 75); deck.castShadow = true; deck.receiveShadow = true; bridge.add(deck);
  for (const z of [20, 130]) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(3.4, 58, 3.4), redMat);
    tower.position.set(WORLD.bridgeX - 5.4, WORLD.bridgeDeckY + 29, z); tower.castShadow = true; bridge.add(tower);
    const tower2 = tower.clone(); tower2.position.x = WORLD.bridgeX + 5.4; bridge.add(tower2);
    const cross = new THREE.Mesh(new THREE.BoxGeometry(14.2, 3, 3), redMat);
    cross.position.set(WORLD.bridgeX, WORLD.bridgeDeckY + 52, z); bridge.add(cross);
    colliders.push({ x0: WORLD.bridgeX - 7.5, z0: z - 2.5, x1: WORLD.bridgeX - 3.5, z1: z + 2.5 });
    colliders.push({ x0: WORLD.bridgeX + 3.5, z0: z - 2.5, x1: WORLD.bridgeX + 7.5, z1: z + 2.5 });
  }
  // main cables (catenary-ish) + suspenders
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x8a1f24, roughness: 0.6, metalness: 0.5 });
  for (const sx of [-5.4, 5.4]) {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const z = -60 + (i / 24) * 270;
      const y = WORLD.bridgeDeckY + 54 - 30 * Math.sin((Math.PI * (z + 60)) / 270) * 0 + 0;
      pts.push(new THREE.Vector3(WORLD.bridgeX + sx, y, z));
    }
    // sag between towers: lower the cable mid-span
    for (let i = 0; i < pts.length; i++) {
      const z = pts[i].z;
      const sag = z > 20 && z < 130 ? 26 * Math.sin(Math.PI * (z - 20) / 110) : 0;
      pts[i].y = WORLD.bridgeDeckY + 54 - sag;
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.35, 6), cableMat);
    bridge.add(cable);
    for (let z = -40; z <= 200; z += 12) {
      const sag = z > 20 && z < 130 ? 26 * Math.sin(Math.PI * (z - 20) / 110) : 0;
      const top = WORLD.bridgeDeckY + 54 - sag;
      const h = top - WORLD.bridgeDeckY;
      if (h < 2) continue;
      const sus = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, h, 5), cableMat);
      sus.position.set(WORLD.bridgeX + sx, WORLD.bridgeDeckY + h / 2, z); bridge.add(sus);
    }
  }
  // deck edge rails + lamps
  for (const sx of [-6.2, 6.2]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 272), redMat);
    rail.position.set(WORLD.bridgeX + sx, WORLD.bridgeDeckY + 1.2, 75); bridge.add(rail);
  }
  // ramps at both ends
  for (const [z, dir] of [[-78, 1], [228, -1]]) {
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(13, 1.2, 36), deckMat);
    ramp.position.set(WORLD.bridgeX, WORLD.bridgeDeckY / 2 + 0.4, z);
    ramp.rotation.x = dir * 0.42; bridge.add(ramp);
  }
  scene.add(bridge);

  // ---- downtown buildings --------------------------------------------------
  const signNames = [['SOLMAR', '#ff5ea8'], ['PIER 9', '#7df9ff'], ['CASINO', '#ffd166'], ['HOTEL', '#ff9f1c'], ['NEON', '#c084fc'], ['RADIO', '#39ff6a']];
  const bases = ['#3a2f4d', '#2f3a4d', '#4d2f33', '#2f4d3a', '#4d442f', '#33304d'];
  const trims = ['#ff5ea8', '#7df9ff', '#ffd166', '#ff3860', '#39ff6a', '#ff9f1c'];
  let signI = 0;
  for (let bx = -4; bx <= 4; bx++) {
    for (let bz = -4; bz <= 2; bz++) {
      const cx = bx * 40, cz = bz * 40;
      if (Math.abs(cx) < 12 && Math.abs(cz - 72) < 14) continue; // canal gap
      if (cz > 100) continue;
      const n = 1 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) {
        const w = 12 + rng() * 14, d = 12 + rng() * 14, hgt = 12 + rng() * rng() * 48;
        const ox = cx - 8 + rng() * 16, oz = cz - 8 + rng() * 16;
        if (Math.abs(ox) < 10 && Math.abs(oz - 72) < 14) continue;
        const tex = new THREE.CanvasTexture(buildingTexture(rng, bases[Math.floor(rng() * bases.length)], trims[Math.floor(rng() * trims.length)]));
        tex.colorSpace = THREE.SRGBColorSpace;
        const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.9 });
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), mat);
        b.position.set(ox, hgt / 2, oz); b.castShadow = true; b.receiveShadow = true; scene.add(b);
        colliders.push({ x0: ox - w / 2, z0: oz - d / 2, x1: ox + w / 2, z1: oz + d / 2 });
        if (hgt > 34 && signI < 24) {
          const [txt, col] = signNames[signI % signNames.length]; signI++;
          const stex = new THREE.CanvasTexture(neonSignTexture(txt, col));
          stex.colorSpace = THREE.SRGBColorSpace;
          const sign = new THREE.Mesh(new THREE.PlaneGeometry(16, 4),
            new THREE.MeshBasicMaterial({ map: stex, transparent: false }));
          sign.position.set(ox, hgt + 2.4, oz + d / 2 + 0.2); scene.add(sign);
          anim.neon.push(sign.material);
        }
        if (rng() < 0.4) {
          const ac = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 2.4),
            new THREE.MeshStandardMaterial({ color: 0x555a66, roughness: 0.9 }));
          ac.position.set(ox + w / 4, hgt + 0.7, oz); scene.add(ac);
        }
      }
      blocks.push({ cx, cz });
    }
  }

  // ---- elevated road (viaduct) ----------------------------------------------
  const viaMat = new THREE.MeshStandardMaterial({ color: 0x3a3d47, roughness: 0.95 });
  const via = new THREE.Mesh(new THREE.BoxGeometry(360, 1.6, 11), viaMat);
  via.position.set(0, 12, -40); via.castShadow = true; scene.add(via);
  const barMat = new THREE.MeshStandardMaterial({ color: 0x9a938a, roughness: 1 });
  for (const z of [-46, -34]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(360, 1.6, 0.8), barMat);
    bar.position.set(0, 13.6, z); scene.add(bar);
  }
  for (let x = -160; x <= 160; x += 40) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(3, 12, 3), viaMat);
    pillar.position.set(x, 6, -40); scene.add(pillar);
  }

  // ---- palms, lamps, beach props ---------------------------------------------
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2f8f4e, roughness: 0.9, side: THREE.DoubleSide });
  const palmGeo = new THREE.CylinderGeometry(0.22, 0.42, 7, 7);
  const frondGeo = new THREE.ConeGeometry(0.9, 4.6, 4);
  function makePalm(x, z, lean) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(palmGeo, trunkMat);
    trunk.position.y = 3.5; trunk.rotation.z = lean; trunk.castShadow = true; g.add(trunk);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const f = new THREE.Mesh(frondGeo, frondMat);
      f.position.set(Math.cos(a) * 1.1 + lean * 2, 7.2, Math.sin(a) * 1.1);
      f.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1 - 0.5);
      f.scale.set(1, 1, 0.28); f.castShadow = true; g.add(f);
    }
    const nuts = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x8a6b3a, roughness: 1 }));
    nuts.position.set(lean * 2, 6.9, 0); g.add(nuts);
    g.position.set(x, 0, z); scene.add(g);
    return g;
  }
  const palmSpots = [];
  for (let x = -180; x <= 180; x += 24) { palmSpots.push([x + 8, 134]); palmSpots.push([x - 4, 146]); }
  for (let i = 0; i < 14; i++) palmSpots.push([-170 + rng() * 340, -150 + rng() * 220]);
  for (const [x, z] of palmSpots) makePalm(x, z, (rng() - 0.5) * 0.5);
  // Art Deco street lamps
  const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x1c1c26, roughness: 0.5, metalness: 0.6 });
  for (const z of [-120, -40, 40, 120]) {
    for (let x = -170; x <= 170; x += 34) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 6.4, 6), lampPoleMat);
      pole.position.set(x, 3.2, z + 6.4); scene.add(pole);
      const globe = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xffe6a3 }));
      globe.position.set(x, 6.7, z + 6.4); scene.add(globe);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.9, 8),
        new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.7, roughness: 0.4 }));
      cap.position.set(x, 7.5, z + 6.4); scene.add(cap);
    }
  }
  // lifeguard towers, umbrellas, beach gym
  const lgWhite = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.8 });
  const lgRed = new THREE.MeshStandardMaterial({ color: 0xd21f3c, roughness: 0.8 });
  for (const [x, z] of [[-40, 168], [20, 170], [120, 168], [-120, 170]]) {
    const g = new THREE.Group();
    for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 4.4, 6), lgWhite);
      leg.position.set(dx, 2.2, dz); g.add(leg);
    }
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 3), lgRed);
    cab.position.y = 5.2; cab.castShadow = true; g.add(cab);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.4, 4), lgWhite);
    roof.position.y = 7; roof.rotation.y = Math.PI / 4; g.add(roof);
    g.position.set(x, 0, z); scene.add(g);
    colliders.push({ x0: x - 1.8, z0: z - 1.6, x1: x + 1.8, z1: z + 1.6 });
  }
  const umbColors = [0xff3860, 0xffd166, 0x7df9ff, 0xff9f1c, 0xc084fc];
  for (let i = 0; i < 16; i++) {
    const x = -180 + rng() * 360, z = 156 + rng() * 22;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 6),
      new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.8 }));
    pole.position.set(x, 1.3, z); scene.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1, 8),
      new THREE.MeshStandardMaterial({ color: umbColors[i % umbColors.length], roughness: 0.8, side: THREE.DoubleSide }));
    top.position.set(x, 2.9, z); top.castShadow = true; scene.add(top);
  }
  // beach gym: pull-up bars + bench
  const gymMat = new THREE.MeshStandardMaterial({ color: 0x2a2d38, metalness: 0.6, roughness: 0.5 });
  for (const [x, z] of [[-8, 160], [4, 162]]) {
    for (const dx of [-1.4, 1.4]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3, 8), gymMat);
      post.position.set(x + dx, 1.5, z); scene.add(post);
    }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.2, 8), gymMat);
    bar.rotation.z = Math.PI / 2; bar.position.set(x, 3, z); scene.add(bar);
  }
  // yachts + speedboats
  function makeBoat(x, z, big) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(big ? 9 : 5, 1.4, big ? 3 : 1.8),
      new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 }));
    hull.position.y = 0.6; g.add(hull);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(big ? 4 : 2, 1.6, big ? 2.4 : 1.4),
      new THREE.MeshStandardMaterial({ color: 0x2a3a55, roughness: 0.3, metalness: 0.4 }));
    cab.position.set(-0.5, 1.9, 0); g.add(cab);
    if (big) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 6, 6), gymMat);
      mast.position.set(1.5, 4.4, 0); g.add(mast);
    }
    g.position.set(x, WORLD.seaLevel, z); g.rotation.y = rng() * Math.PI;
    scene.add(g); return g;
  }
  makeBoat(30, 84, true); makeBoat(100, 80, true);
  makeBoat(-120, 240, false); makeBoat(150, 250, false); makeBoat(200, 220, true);

  // ---- update ---------------------------------------------------------------
  let time = 0;
  return {
    roads, colliders, blocks,
    update(dt, t) {
      time = t;
      if (anim.ferris) anim.ferris.rotation.z += dt * 0.12;
      if (anim.beam) anim.beam.rotation.y = t * 0.5;
      if (anim.sea) { anim.sea.offset.x += dt * 0.008; anim.sea.offset.y += dt * 0.003; }
      for (let i = 0; i < anim.foam.length; i++) {
        anim.foam[i].position.z = 183 + i * 2.2 + Math.sin(t * 0.7 + i) * 0.8;
        anim.foam[i].material.opacity = 0.3 - i * 0.04 + Math.sin(t + i * 2) * 0.06;
      }
      for (const m of anim.neon) { if (m.opacity !== undefined) m.opacity = 0.92 + Math.sin(t * 3 + 1) * 0.08; }
    },
  };
}
