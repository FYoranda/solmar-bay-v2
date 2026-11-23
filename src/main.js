// Solmar Bay: Heat Tide — bootstrap, game loop, driving and on-foot play,
// wanted level, police orchestration, camera, saves and screenshot mode.
// The game is a live 3D scene; the HUD is DOM (see hud.js).
import * as THREE from 'three';
import { WORLD, VEHICLES, WEAPONS, RADIO, districtAt } from './config.js';
import { buildWorld } from './world.js';
import { makeCharacter, makeVehicle, TrafficCar, Pedestrian } from './actors.js';
import { PoliceUnit, Roadblock, AirOne, Effects } from './police.js';
import { MissionRunner, loadSave, storeSave, blankSave } from './missions.js';
import { GameAudio } from './audio.js';
import { HUD } from './hud.js';
import { stageShot, shotNameFromUrl } from './shots.js';
import { initTouchControls } from './touch.js';
import { clamp, lerp, mulberry32, dist2d } from './utils.js';

window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => window.__errors.push('rejection: ' + String(e.reason)));

const $ = (id) => document.getElementById(id);

function groundHeight(x, z) {
  if (x > WORLD.bridgeX - 7 && x < WORLD.bridgeX + 7) {
    if (z >= WORLD.bridgeZ0 && z <= WORLD.bridgeZ1) return WORLD.bridgeDeckY;
    if (z > WORLD.bridgeZ1 && z < 234) return lerp(WORLD.bridgeDeckY, 0, (z - WORLD.bridgeZ1) / 24);
    if (z < WORLD.bridgeZ0 && z > -84) return lerp(0, WORLD.bridgeDeckY, (z + 84) / 24);
  }
  if (x > 52 && x < 68 && z >= 150 && z <= 268) return 1.9;
  return 0;
}

export function createGame() {
  const seed = 1;
  const rng = mulberry32(seed);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  $('game').appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1400);
  camera.position.set(-40, 26, 190);

  const world = buildWorld(scene);
  const hud = new HUD();
  const audio = new GameAudio();
  const effects = new Effects(scene);
  const roadblock = new Roadblock(scene);
  const airOne = new AirOne(scene);
  const missions = new MissionRunner(hud, audio);

  const save = loadSave() || blankSave();
  const G = {
    state: 'title', shotFrozen: false, cameraMode: 'orbit',
    camera,
    time: 0, clockMin: 17 * 60 + 19, cash: save.cash, respect: save.respect,
    wanted: 0, hiddenT: 0, kills: 0, rams: 0, stoleTarget: false,
    health: save.health, armor: save.armor,
    weapon: 'fists', ammo: Object.assign({ pistol: 24, smg: 60, rpg: 2 }, save.ammo),
    owned: save.weapons.slice(), nos: 1, condition: 1,
    inCar: null, carSpeed: 0, carHeading: 0, steerCur: 0, carLat: 0, drifting: false, nitro: false,
    camVel: new THREE.Vector3(), camLook: new THREE.Vector3(), camSnap: false,
    fovKick: 0, shake: 0, orbitAngle: 0.6, hudSpeedOverride: null,
    mouseX: 0, mouseY: 0, aimYaw: 0,
  };
  G.save = save;

  // ---- player ------------------------------------------------------------
  const player = makeCharacter({ jacket: 0x27324a, skin: '#c98d64', hair: '#1a1210', glasses: true, hat: false });
  player.group.position.set(-40, 0, 128);
  scene.add(player.group);
  const playerState = { x: -40, z: 128, heading: 0, vy: 0, onGround: true, speed: 0, coyote: 0, jumpBuf: 0 };
  G.playerState = playerState;

  // gun prop in the player's right hand
  const gunProp = new THREE.Group();
  const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.4, metalness: 0.7 }));
  gunProp.add(gunBody);
  gunProp.position.set(0, -0.68, 0.18);
  gunProp.visible = false;
  player.armR.add(gunProp);
  const muzzle = new THREE.PointLight(0xffe9a0, 0, 18, 1.8);
  muzzle.position.set(0, -0.68, 0.5);
  player.armR.add(muzzle);

  // ---- parked cars --------------------------------------------------------
  const parked = [];
  function parkCar(specId, x, z, heading, isTarget) {
    const spec = VEHICLES.find((v) => v.id === specId);
    const car = makeVehicle(spec);
    car.group.position.set(x, groundHeight(x, z), z);
    car.group.rotation.y = heading;
    car.group.userData.carRef = { spec, mesh: car.group, parked: true, isTarget: !!isTarget, condition: 1, veh: car };
    scene.add(car.group);
    parked.push(car.group.userData.carRef);
    return car.group.userData.carRef;
  }
  parkCar('comet', 30, 138, Math.PI * 0.5, false);
  parkCar('sedan', -196, 40, Math.PI, true); // mission 2 target, mid-bridge
  parkCar('muscle', -60, -118, 0, false);
  parkCar('suv', 100, 118, Math.PI / 2, false);
  parkCar('taxi', 20, -38, 0, false);
  parkCar('van', -140, 42, Math.PI / 2, false);
  parkCar('sedan', 140, -118, Math.PI, false);
  parkCar('police', 60, -100, 0, false);

  // ---- traffic + pedestrians ----------------------------------------------
  const traffic = [];
  for (let i = 0; i < 14; i++) traffic.push(new TrafficCar(scene, world, rng));
  const peds = [];
  for (let i = 0; i < 22; i++) peds.push(new Pedestrian(scene, rng));
  const rivals = [];

  // ---- police pool ----------------------------------------------------------
  const police = [new PoliceUnit(scene, 12), new PoliceUnit(scene, 38), new PoliceUnit(scene, 7)];
  for (const u of police) u.mesh.position.set(400, 0, 400);
  let roadblockPlaced = false;

  // ---- markers: gun shop + safehouse + mission beacon -----------------------
  function markerRing(x, z, color) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.18, 8, 32),
      new THREE.MeshBasicMaterial({ color }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.15; g.add(ring);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 26, 12, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.y = 13; g.add(beam);
    g.position.set(x, 0, z); scene.add(g);
    return g;
  }
  const shopMarker = markerRing(40, -120, 0xffd166);
  const safeMarker = markerRing(120, 128, 0x39ff6a);
  const beacon = new THREE.Group();
  const beaconBeam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
  beaconBeam.position.y = 30; beacon.add(beaconBeam);
  const beaconGem = new THREE.Mesh(new THREE.OctahedronGeometry(1.6),
    new THREE.MeshBasicMaterial({ color: 0xffd166 }));
  beaconGem.position.y = 8; beacon.add(beaconGem);
  beacon.visible = false; scene.add(beacon);
  const beaconPos = { x: 0, z: 0 };

  // ---- nitro flames ----------------------------------------------------------
  const flameMat = new THREE.MeshBasicMaterial({ color: 0x5aa8ff, transparent: true, opacity: 0.9 });
  const flameMat2 = new THREE.MeshBasicMaterial({ color: 0xff9f1c, transparent: true, opacity: 0.9 });
  const flames = [];
  for (const sz of [-0.4, 0.4]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.6, 8), sz < 0 ? flameMat : flameMat2);
    f.rotation.z = Math.PI / 2; f.visible = false;
    scene.add(f); flames.push(f);
  }

  // ---- input ------------------------------------------------------------------
  const keys = {};
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys[e.code] = true;
    audio.init(); audio.resume();
    if (e.code === 'Escape') { if (G.state === 'playing') pauseGame(); else if (G.state === 'paused') resumeGame(); }
    if (e.code === 'KeyM') { audio.setChannel(audio.channel + 1); hud.toast(`Radio: ${RADIO[audio.channel].name}`); }
    if (e.code === 'KeyC') { G.cameraMode = G.cameraMode === 'chase' ? 'far' : 'chase'; }
    if (e.code === 'KeyE') tryEnterCar();
    if (e.code === 'KeyF') trySafehouse();
    if (e.code === 'KeyR') reloadWeapon();
    if (e.code.startsWith('Digit')) {
      const i = parseInt(e.code.slice(5), 10) - 1;
      if (WEAPONS[i] && G.owned.includes(WEAPONS[i].id)) { G.weapon = WEAPONS[i].id; updateGunProp(); }
    }
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  addEventListener('pointermove', (e) => { G.mouseX = e.clientX; G.mouseY = e.clientY; });
  addEventListener('pointerdown', (e) => {
    if (e.target.closest && e.target.closest('#touch-controls')) return; // touch buttons drive input themselves
    audio.init(); audio.resume();
    if (G.state === 'playing' && !G.inCar) shoot();
  });
  // ---- touch controls (phones/tablets) -----------------------------------------
  // Same keys object + same actions as the keyboard; no-op on desktop.
  const touch = initTouchControls(keys, {
    onWake: () => { audio.init(); audio.resume(); },
    onCar: () => { if (G.inCar) exitCar(); else tryEnterCar(); },
    isInCar: () => !!G.inCar,
    onShoot: () => { if (G.state === 'playing' && !G.inCar) shoot(); },
    onPause: () => { if (G.state === 'playing') pauseGame(); else if (G.state === 'paused') resumeGame(); },
    onSelectWeapon: (n) => {
      const w = WEAPONS[n - 1];
      if (w && G.owned.includes(w.id)) { G.weapon = w.id; updateGunProp(); }
    },
    getWeapons: () => ({ owned: G.owned.slice(), current: G.weapon }),
  });
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  // ---- UI wiring ---------------------------------------------------------------
  function setHudVisible(v) { $('hud').style.display = v ? 'block' : 'none'; if (touch) touch.setVisible(v); }
  function hideScreens() {
    for (const id of ['title-screen', 'pause-screen', 'end-screen', 'controls-screen']) $(id).classList.add('hidden');
  }
  G.hideScreens = hideScreens;
  G.showTitleScreen = () => { $('title-screen').classList.remove('hidden'); setHudVisible(false); };
  $('btn-new').addEventListener('click', () => {
    audio.init(); audio.resume();
    Object.assign(save, blankSave()); storeSave(save);
    G.cash = save.cash; G.respect = save.respect; G.health = 100; G.armor = 0;
    G.owned = save.weapons.slice(); G.ammo = Object.assign({ pistol: 24, smg: 60, rpg: 2 }, save.ammo);
    startPlaying(1);
  });
  $('btn-continue').addEventListener('click', () => {
    audio.init(); audio.resume();
    startPlaying(Math.min(8, save.job || 1));
  });
  $('btn-controls').addEventListener('click', () => $('controls-screen').classList.remove('hidden'));
  $('btn-controls-back').addEventListener('click', () => $('controls-screen').classList.add('hidden'));
  $('btn-resume').addEventListener('click', () => resumeGame());
  $('btn-quit-title').addEventListener('click', () => { G.state = 'title'; G.cameraMode = 'orbit'; hideScreens(); G.showTitleScreen(); });
  $('btn-restart').addEventListener('click', () => { resetPlayer(); hideScreens(); G.state = 'playing'; setHudVisible(true); });
  $('btn-end-title').addEventListener('click', () => { G.state = 'title'; G.cameraMode = 'orbit'; hideScreens(); G.showTitleScreen(); });
  $('radio-ticker').addEventListener('click', () => { audio.init(); audio.setChannel(audio.channel + 1); });
  refreshSaveCards();

  function refreshSaveCards() {
    const s = save;
    const has = s.completed.length > 0 || s.cash !== 500;
    $('btn-continue').disabled = !has;
    const card = (title, meta) =>
      `<div class="save-card"><img src="${hud.portraits.tia}" alt=""><div><div class="sname">${title}</div><div class="smeta">${meta}</div></div></div>`;
    $('save-card-1').innerHTML = card('JAX MARLOWE', has
      ? `JOB ${Math.min(8, s.job)}/8 · $${s.cash.toLocaleString('en-US')} · ${s.completed.length} jobs done`
      : 'No save yet — start a new game.');
    $('save-card-2').innerHTML = card('SOLMAR COMET GT',
      'Garage: Comet GT · Muscle · SUV<br>Radio Solmar 98.6 · Heat Tide');
  }

  function startPlaying(job) {
    hideScreens(); setHudVisible(true);
    G.state = 'playing'; G.cameraMode = 'chase';
    resetPlayer();
    missions.start(job, missionCtx());
    updateGunProp();
  }
  function pauseGame() { G.state = 'paused'; $('pause-screen').classList.remove('hidden'); }
  function resumeGame() { G.state = 'playing'; $('pause-screen').classList.add('hidden'); }
  function resetPlayer() {
    exitCar(true);
    playerState.x = -40; playerState.z = 128; playerState.heading = 0; playerState.vy = 0;
    playerState.onGround = true; playerState.coyote = 0; playerState.jumpBuf = 0;
    player.group.position.set(-40, 0, 128);
    G.health = 100; G.wanted = 0; G.hiddenT = 0; G.carSpeed = 0; G.condition = 1; G.nos = 1;
    G.steerCur = 0; G.carLat = 0; G.camVel.set(0, 0, 0); G.camLook.set(-40, 2, 128); G.camSnap = true;
    for (const u of police) u.mesh.position.set(400, 0, 400);
    roadblock.clear(); roadblockPlaced = false; airOne.hide();
  }
  function endGame(kind, text) {
    if (G.state !== 'playing') return;
    G.state = kind;
    $('end-title').textContent = kind === 'busted' ? 'BUSTED' : kind === 'wasted' ? 'WASTED' : 'HEAT TIDE COMPLETE';
    $('end-text').textContent = text;
    $('end-screen').classList.remove('hidden');
    setHudVisible(false);
  }

  // ---- cars ---------------------------------------------------------------------
  function nearestCar(maxD) {
    let best = null, bd = maxD;
    for (const c of parked) {
      const d = dist2d(playerState.x, playerState.z, c.mesh.position.x, c.mesh.position.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  function tryEnterCar() {
    if (G.state !== 'playing' || G.inCar) return;
    const c = nearestCar(4.5);
    if (!c) return;
    G.inCar = c;
    c.parked = false;
    player.group.visible = false;
    G.carSpeed = 0; G.carHeading = c.mesh.rotation.y;
    if (c.isTarget) { G.stoleTarget = true; hud.popup('CAR SECURED', 'cash'); }
    else if (c.spec.kind !== 'police' || true) {
      if (!c.wasOwned) { addWanted(1, 'stole a car'); c.wasOwned = true; }
    }
    hud.toast(`${c.spec.name} — yours now.`);
  }
  function exitCar(silent) {
    if (!G.inCar) return;
    const c = G.inCar;
    const bx = c.mesh.position.x - Math.sin(c.mesh.rotation.y) * 2.6;
    const bz = c.mesh.position.z - Math.cos(c.mesh.rotation.y) * 2.6;
    playerState.x = bx; playerState.z = bz; playerState.heading = c.mesh.rotation.y;
    player.group.position.set(bx, groundHeight(bx, bz), bz);
    player.group.visible = true;
    G.inCar = null; G.carSpeed = 0;
    if (!silent) hud.toast('On foot.');
  }
  function trySafehouse() {
    if (G.state !== 'playing') return;
    if (dist2d(playerState.x, playerState.z, 120, 128) < 7) {
      if (G.wanted > 0 && G.cash >= 100) {
        G.cash -= 100; G.wanted = 0; G.hiddenT = 0; save.cash = G.cash;
        G.health = 100; G.condition = 1;
        hud.toast('Safehouse: heat gone, patched up. -$100');
      } else { G.health = 100; hud.toast('Safehouse: saved.'); }
      storeSave(save);
    } else if (dist2d(playerState.x, playerState.z, 40, -120) < 7) {
      const next = WEAPONS.find((w) => !G.owned.includes(w.id) && w.id !== 'fists' && w.id !== 'bat');
      if (next && G.cash >= 500) {
        G.cash -= 500; G.owned.push(next.id); save.weapons = G.owned.slice(); save.cash = G.cash;
        storeSave(save);
        if (touch) touch.refreshWeapons(); // un-grey the new weapon button right away
        hud.toast(`${next.name} bought — $500. Press ${WEAPONS.indexOf(next) + 1} to equip.`);
      } else if (next) hud.toast('Gun shop: need $500 for the ' + next.name + '.');
      else hud.toast('Gun shop: fully stocked.');
    }
  }
  function reloadWeapon() {
    const w = WEAPONS.find((x) => x.id === G.weapon);
    if (w && w.ammo !== Infinity && (G.ammo[w.id] ?? 0) <= 0) hud.toast('OUT OF AMMO — switch weapon.');
  }
  function updateGunProp() {
    const w = G.weapon;
    gunProp.visible = w !== 'fists' && w !== 'bat';
    player.armR.rotation.x = 0;
    if (touch) touch.refreshWeapons();
  }

  // ---- combat ---------------------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  function shoot() {
    const w = WEAPONS.find((x) => x.id === G.weapon);
    if (!w || w.id === 'fists' || w.id === 'bat') { meleeSwing(); return; }
    if ((G.ammo[w.id] ?? 0) <= 0) { hud.toast('OUT OF AMMO'); return; }
    G.ammo[w.id]--;
    audio.gunshot(w.id === 'rpg');
    muzzle.intensity = 90;
    setTimeout(() => { muzzle.intensity = 0; }, 60);
    player.setAim();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    raycaster.far = 90;
    const hits = raycaster.intersectObjects(scene.children, true);
    for (const h of hits) {
      let o = h.object, rival = null, carHit = null;
      while (o) {
        if (o.userData.rival) { rival = o.userData.rival; break; }
        if (o.userData.carRef) { carHit = o.userData.carRef; break; }
        o = o.parent;
      }
      if (rival) {
        rival.health -= w.dmg;
        if (rival.health <= 0 && !rival.dead) {
          rival.dead = true; rival.mesh.rotation.x = -Math.PI / 2; rival.mesh.position.y = 0.4;
          G.kills++; G.cash += 25; save.cash = G.cash;
          hud.popup('RIVAL DOWN +$25', 'cash');
        }
        break;
      }
      if (carHit) {
        if (carHit.spec.kind === 'police') addWanted(1, 'shot at the PD');
        else if (w.id === 'rpg') { effects.explosion(h.point.x, h.point.y, h.point.z, true); audio.explosion(); G.shake = 1; }
        break;
      }
      if (h.distance > 4) break;
    }
    if (w.id === 'rpg') {
      effects.explosion(player.group.position.x + Math.sin(playerState.heading) * 6, 1, player.group.position.z + Math.cos(playerState.heading) * 6, true);
      audio.explosion(); G.shake = 1;
    }
  }
  function meleeSwing() {
    player.armR.rotation.x = -1.6;
    setTimeout(() => { player.armR.rotation.x = 0; }, 180);
    for (const r of rivals) {
      if (!r.dead && dist2d(playerState.x, playerState.z, r.mesh.position.x, r.mesh.position.z) < 2.4) {
        r.health -= 26;
        if (r.health <= 0) { r.dead = true; r.mesh.rotation.x = -Math.PI / 2; G.kills++; G.cash += 25; save.cash = G.cash; }
      }
    }
  }

  // ---- wanted -----------------------------------------------------------------------
  function addWanted(n, reason) {
    if (G.shotFrozen) return;
    const before = G.wanted;
    G.wanted = clamp(G.wanted + n, 0, 5);
    if (G.wanted > before) { G.hiddenT = 0; hud.toast(`WANTED ${'★'.repeat(G.wanted)} — ${reason}`); }
  }
  function spawnPoliceBehind(n) {
    let placed = 0;
    for (const u of police) {
      if (placed >= n) break;
      if (u.mesh.position.x > 300) {
        const back = 26 + placed * 12;
        const lat = (placed % 2 ? 6 : -6);
        u.spawn(playerState.x - Math.sin(playerState.heading) * back + lat,
          playerState.z - Math.cos(playerState.heading) * back, playerState.heading);
        placed++;
      }
    }
  }

  // ---- rivals -------------------------------------------------------------------------
  function spawnRivals(n, x, z) {
    for (let i = 0; i < n; i++) {
      const r = makeCharacter({ jacket: 0x8a2f3c, skin: '#8a5a3b', hair: '#101010', glasses: false });
      r.group.position.set(x + (i - 1) * 3, 0, z + (i % 2) * 2);
      r.group.userData.rival = { mesh: r.group, health: 60, dead: false };
      r.group.rotation.y = Math.PI;
      scene.add(r.group);
      rivals.push(r.group.userData.rival);
    }
  }
  G.spawnRivals = spawnRivals;

  // ---- shot-mode API (used by shots.js) -------------------------------------------------
  G.setCameraMode = (m) => { G.cameraMode = m; };
  G.setWanted = (n) => { G.wanted = n; };
  G.setCash = (n) => { G.cash = n; save.cash = n; };
  G.setClockMin = (n) => { G.clockMin = n; };
  G.setRespect = (n) => { G.respect = n; save.respect = n; };
  G.setHudSpeed = (mph) => { G.hudSpeedOverride = mph; };
  G.setMissionMarker = (x, z) => { beaconPos.x = x; beaconPos.z = z; beacon.visible = true; beacon.position.set(x, 0, z); };
  G.showDialog = (npc, text) => hud.showDialog(npc, text, 30000);
  G.placePlayerOnFoot = (x, z, heading, weaponId) => {
    exitCar(true);
    playerState.x = x; playerState.z = z; playerState.heading = heading;
    player.group.position.set(x, groundHeight(x, z), z);
    player.group.rotation.y = heading;
    player.group.visible = true;
    if (weaponId && G.owned.includes(weaponId)) { G.weapon = weaponId; updateGunProp(); player.setAim(); }
  };
  G.placePlayerInCar = (specId, x, z, heading) => {
    exitCar(true);
    let c = parked.find((p) => p.spec.id === specId && p.parked);
    if (!c) c = parked[0];
    c.parked = false;
    c.mesh.position.set(x, groundHeight(x, z), z);
    c.mesh.rotation.y = heading;
    G.inCar = c; G.carHeading = heading; G.carSpeed = 0;
    playerState.x = x; playerState.z = z;
    playerState.heading = heading;
    player.group.visible = false;
  };
  G.setCarSpeed = (mps) => { G.carSpeed = mps; };
  G.setNitro = (on) => { G.nitro = on; G.fovKick = on ? 1 : 0; };
  G.setDrift = (on) => { G.drifting = on; };
  G.spawnPolice = (n, mode) => { spawnPoliceBehind(n); };
  G.setRoadblockAhead = (dist) => {
    const hx = playerState.x + Math.sin(playerState.heading) * dist;
    const hz = playerState.z + Math.cos(playerState.heading) * dist;
    roadblock.place(hx, hz, playerState.heading + Math.PI / 2, groundHeight(hx, hz));
    roadblockPlaced = true;
  };
  G.showAirOne = (x, y, z) => airOne.show(x, y, z);
  G.burnWreck = (x, z, heading) => effects.burningWreck(x, z, heading, groundHeight(x, z));
  G.startMission = (job) => { missions.start(job, missionCtx()); };

  function missionCtx() {
    return {
      pos: { x: playerState.x, z: playerState.z },
      inCar: !!G.inCar, speed: G.carSpeed, wanted: G.wanted,
      kills: G.kills, rams: G.rams, stoleTarget: G.stoleTarget, save,
    };
  }

  // ---- collision -------------------------------------------------------------------------
  function collideCircle(x, z, r) {
    let nx = x, nz = z;
    for (const c of world.colliders) {
      const cx = clamp(x, c.x0, c.x1), cz = clamp(z, c.z0, c.z1);
      const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 < 0.0001) { nx = c.x1 + r; continue; }
        const d = Math.sqrt(d2);
        nx = cx + (dx / d) * r; nz = cz + (dz / d) * r;
      }
    }
    nx = clamp(nx, -235, 235); nz = clamp(nz, -235, 262);
    if (nz > 182 && !(nx > 50 && nx < 70) && !(nx > WORLD.bridgeX - 8 && nx < WORLD.bridgeX + 8)) nz = 182;
    return [nx, nz];
  }

  // ---- sliding collision --------------------------------------------------------
  // Does a circle of radius r at (x,z) overlap any collider or the world edge?
  function hitsCollider(x, z, r) {
    for (const c of world.colliders) {
      const cx = clamp(x, c.x0, c.x1), cz = clamp(z, c.z0, c.z1);
      const dx = x - cx, dz = z - cz;
      if (dx * dx + dz * dz < r * r) return true;
    }
    if (x < -235 + r || x > 235 - r || z < -235 + r || z > 262 - r) return true;
    if (z > 182 - r && !(x > 50 && x < 70) && !(x > WORLD.bridgeX - 8 && x < WORLD.bridgeX + 8)) return true;
    return false;
  }
  // Move by (dx,dz), sliding along walls: try the full move, then x-only,
  // then z-only, so a wall graze keeps the tangential motion instead of
  // catching and stopping the player/car. Returns [nx, nz].
  function slideMove(x, z, dx, dz, r) {
    if (!hitsCollider(x + dx, z + dz, r)) return [x + dx, z + dz];
    if (dx !== 0 && !hitsCollider(x + dx, z, r)) return [x + dx, z];
    if (dz !== 0 && !hitsCollider(x, z + dz, r)) return [x, z + dz];
    return [x, z];
  }

  // ---- per-frame updates -------------------------------------------------------------------
  const clock = new THREE.Clock();
  let frames = 0;
  let driftScore = 0, driftMult = 1;

  function updatePlaying(dt) {
    const ps = playerState;
    // --- driving ---
    if (G.inCar) {
      const car = G.inCar;
      const spec = car.spec;
      const fwd = keys.KeyW || keys.ArrowUp, back = keys.KeyS || keys.ArrowDown;
      const left = keys.KeyA || keys.ArrowLeft, right = keys.KeyD || keys.ArrowRight;
      G.nitro = (keys.ShiftLeft || keys.ShiftRight) && G.nos > 0.05 && fwd;
      G.drifting = keys.Space && Math.abs(G.carSpeed) > 8;
      const top = spec.top * (G.nitro ? 1.28 : 1) * (groundHeight(car.mesh.position.x, car.mesh.position.z) > 0 ? 1 : 1);
      if (fwd) G.carSpeed += spec.accel * (G.nitro ? 1.9 : 1) * dt;
      if (back) G.carSpeed -= (G.carSpeed > 0.5 ? 30 : 12) * dt;
      if (!fwd && !back) G.carSpeed -= Math.sign(G.carSpeed) * 6 * dt;
      if (Math.abs(G.carSpeed) < 0.2 && !fwd && !back) G.carSpeed = 0;
      G.carSpeed = clamp(G.carSpeed, -14, top);
      // --- progressive steering (analog-friendly) ---
      // steerInput is continuous (-1..1): the touch joystick's analog X when
      // present, otherwise the binary A/D keys. Steering builds smoothly
      // toward the target instead of snapping, so corners feel progressive.
      const joyX = (typeof keys._joyX === 'number') ? keys._joyX : 0;
      const steerInput = joyX !== 0 ? clamp(-joyX, -1, 1) : (left ? 1 : 0) - (right ? 1 : 0);
      const steerMax = 0.55 / (1 + Math.abs(G.carSpeed) * 0.045);
      const steerTarget = steerInput * steerMax * (G.drifting ? 1.6 : 1);
      const steerRate = 3.2 + Math.abs(G.carSpeed) * 0.02;
      G.steerCur += clamp(steerTarget - G.steerCur, -steerRate * dt, steerRate * dt);
      G.carHeading += G.steerCur * clamp(Math.abs(G.carSpeed) / 8, 0, 1) * Math.sign(G.carSpeed || 1) * dt * 2.2;
      car.mesh.rotation.y = G.carHeading;
      if (car.veh) { car.veh.setSteer(G.steerCur * 0.5); car.veh.setWheelSpin(G.carSpeed * 0.9); }
      // --- lateral grip: the car carries a sideways velocity that the road
      // grips. Steering at speed pushes it sideways; grip damps the slide
      // (strong normally, loose while drifting) so corners feel like a car.
      const grip = G.drifting ? 1.6 : 7.0;
      G.carLat += G.steerCur * G.carSpeed * dt * 2.4;
      G.carLat *= Math.exp(-grip * dt);
      G.carLat = clamp(G.carLat, -9, 9);
      const fx = Math.sin(G.carHeading), fz = Math.cos(G.carHeading);
      const rx = Math.cos(G.carHeading), rz = -Math.sin(G.carHeading);
      const vx = fx * G.carSpeed + rx * G.carLat;
      const vz = fz * G.carSpeed + rz * G.carLat;
      const before = [car.mesh.position.x, car.mesh.position.z];
      const slid = slideMove(before[0], before[1], vx * dt, vz * dt, 1.9);
      const nx = slid[0], nz = slid[1];
      // Wall contact: a graze keeps sliding (small penalty); only a near
      // head-on stop costs condition and speed.
      const wantLen = Math.hypot(vx * dt, vz * dt);
      const gotLen = Math.hypot(nx - before[0], nz - before[1]);
      const hitWall = wantLen > 0.001 && gotLen < wantLen * 0.55;
      if (hitWall && Math.abs(G.carSpeed) > 6) {
        const hard = gotLen < wantLen * 0.25;
        G.condition = Math.max(0.2, G.condition - (hard ? 0.05 : 0.015));
        G.shake = Math.min(1, G.shake + (hard ? 0.4 : 0.15));
        G.carSpeed *= hard ? 0.45 : 0.85;
        G.carLat *= 0.5;
        audio.blip(70, 0.2, 'sine', 0.3);
      }
      car.mesh.position.x = nx; car.mesh.position.z = nz;
      car.mesh.position.y = lerp(car.mesh.position.y, groundHeight(nx, nz), 1 - Math.pow(0.001, dt));
      ps.x = nx; ps.z = nz; ps.heading = G.carHeading;
      // drift smoke + score
      if (G.drifting) {
        const bx = nx - Math.sin(G.carHeading) * 1.6, bz = nz - Math.cos(G.carHeading) * 1.6;
        effects.tireSmoke(bx + (Math.random() - 0.5), 0.2, bz);
        effects.skidMark(bx, bz, G.carHeading, 2.2);
        driftScore += Math.abs(G.carSpeed) * dt * 2;
        driftMult = 1 + Math.floor(driftScore / 150);
        if (driftScore > 150) {
          const bonus = 50 * driftMult;
          G.cash += bonus; save.cash = G.cash;
          hud.popup(`DRIFT x${driftMult} +$${bonus}`, 'cash');
          driftScore = 0;
        }
      } else driftScore = Math.max(0, driftScore - dt * 40);
      // nitro
      if (G.nitro) {
        G.nos = Math.max(0, G.nos - dt * 0.32);
        const ex = car.mesh.position.clone().applyEuler(new THREE.Euler(0, 0, 0));
        for (let i = 0; i < 2; i++) {
          const f = flames[i];
          f.visible = true;
          const off = new THREE.Vector3(-2.45, 0.32, i === 0 ? -0.4 : 0.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), G.carHeading);
          f.position.copy(car.mesh.position).add(off);
          f.rotation.y = G.carHeading + Math.PI / 2;
          f.scale.set(1 + Math.random() * 0.5, 1 + Math.random() * 0.8, 1);
        }
      } else {
        G.nos = Math.min(1, G.nos + dt * 0.05);
        flames.forEach((f) => { f.visible = false; });
      }
      // near miss bonus
      for (const t of traffic) {
        const d = dist2d(nx, nz, t.mesh.position.x, t.mesh.position.z);
        if (d < 3.2 && Math.abs(G.carSpeed) > 25 && !t.nearMissed) {
          t.nearMissed = true; G.cash += 250; save.cash = G.cash;
          hud.popup('NEAR MISS +$250', 'cash'); audio.cash();
          setTimeout(() => { t.nearMissed = false; }, 4000);
        }
      }
      // police contact = ram
      for (const u of police) {
        if (u.mesh.position.x > 300) continue;
        const d = dist2d(nx, nz, u.mesh.position.x, u.mesh.position.z);
        if (d < 3.4 && Math.abs(G.carSpeed) > 10) {
          G.rams++; G.shake = Math.min(1, G.shake + 0.5);
          u.speed *= 0.4;
          effects.explosion(nx, 1, nz, false);
        }
      }
      audio.setEngine(Math.abs(G.carSpeed) / 70, G.nitro);
    } else {
      // --- on foot ---
      const run = keys.ShiftLeft || keys.ShiftRight;
      const sp = run ? 8.5 : 5.2;
      // Analog joystick (touch) gives a continuous move vector; keyboard
      // gives binary keys. Joystick: _joyX +1 = right, _joyY -1 = up/forward.
      const joyX = (typeof keys._joyX === 'number') ? keys._joyX : 0;
      const joyY = (typeof keys._joyY === 'number') ? keys._joyY : 0;
      let mx = 0, mz = 0;
      const camYaw = Math.atan2(camera.position.x - ps.x, camera.position.z - ps.z);
      const fwdX = Math.sin(camYaw + Math.PI), fwdZ = Math.cos(camYaw + Math.PI);
      const leftX = Math.sin(camYaw + Math.PI / 2), leftZ = Math.cos(camYaw + Math.PI / 2);
      if (joyX !== 0 || joyY !== 0) {
        mx = fwdX * (-joyY) + (-leftX) * joyX;
        mz = fwdZ * (-joyY) + (-leftZ) * joyX;
      } else {
        if (keys.KeyW || keys.ArrowUp) { mx += fwdX; mz += fwdZ; }
        if (keys.KeyS || keys.ArrowDown) { mx -= fwdX; mz -= fwdZ; }
        if (keys.KeyA || keys.ArrowLeft) { mx += leftX; mz += leftZ; }
        if (keys.KeyD || keys.ArrowRight) { mx -= leftX; mz -= leftZ; }
      }
      const ml = Math.hypot(mx, mz);
      // Air control is decoupled: horizontal input works on the ground AND
      // in the air (slightly reduced while airborne, so jumps stay weighty).
      const airMul = ps.onGround ? 1 : 0.85;
      if (ml > 0.01) {
        const mag = Math.min(1, ml);
        mx /= ml; mz /= ml;
        const want = Math.atan2(mx, mz);
        let diff = want - ps.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        ps.heading += clamp(diff, -8 * dt, 8 * dt);
        ps.speed = sp * mag;
        const step = sp * mag * airMul * dt;
        const moved = slideMove(ps.x, ps.z, mx * step, mz * step, 0.6);
        ps.x = moved[0]; ps.z = moved[1];
        player.setWalk(dt, 1);
      } else { ps.speed = 0; player.setIdle(); }
      // Coyote time + jump buffer: jump works briefly after leaving a ledge,
      // and a jump pressed just before landing fires on landing — so running
      // while jumping is 100% smooth.
      if (ps.onGround) ps.coyote = 0.12; else ps.coyote = Math.max(0, ps.coyote - dt);
      if (keys.Space) ps.jumpBuf = 0.12; else ps.jumpBuf = Math.max(0, ps.jumpBuf - dt);
      if (ps.jumpBuf > 0 && (ps.onGround || ps.coyote > 0)) {
        ps.vy = 7; ps.onGround = false; ps.coyote = 0; ps.jumpBuf = 0;
      }
      ps.vy -= 22 * dt;
      let py = player.group.position.y + ps.vy * dt;
      const gy = groundHeight(ps.x, ps.z);
      if (py <= gy) { py = gy; ps.vy = 0; ps.onGround = true; }
      player.group.position.set(ps.x, py, ps.z);
      player.group.rotation.y = ps.heading;
      // aim pose while mouse held / weapon out
      if (G.weapon !== 'fists' && G.weapon !== 'bat') player.setAim();
      audio.setEngine(0, false);
    }

    // --- traffic + peds ---
    for (const t of traffic) t.update(dt);
    for (const p of peds) p.update(dt);
    for (const r of rivals) {
      if (r.dead) continue;
      const d = dist2d(ps.x, ps.z, r.mesh.position.x, r.mesh.position.z);
      if (d < 26 && Math.random() < dt * 0.25) {
        G.health -= 2; G.shake = Math.min(1, G.shake + 0.2);
        if (G.health <= 0) { G.health = 0; endGame('wasted', 'The rival crew got you on the boardwalk. The bay forgets fast.'); }
      }
    }

    // --- wanted + police ---
    if (G.wanted > 0) {
      spawnPoliceBehind(Math.min(3, G.wanted));
      let nearest = 999;
      for (const u of police) {
        if (u.mesh.position.x > 300) continue;
        const d = u.update(dt, { x: ps.x, z: ps.z, heading: ps.heading }, Math.abs(G.carSpeed));
        nearest = Math.min(nearest, d);
        // busted: cop touches on-foot player
        if (!G.inCar && d < 2.6 && ps.speed < 1) endGame('busted', 'Solmar PD took you in. The Comet GT is impounded — for now.');
      }
      G.inSight = nearest < 55;
      if (G.wanted >= 3) airOne.update(dt, G.time, { x: ps.x, z: ps.z, y: G.inCar ? G.inCar.mesh.position.y : 0 }, G.carHeading);
      if (G.wanted >= 3 && !airOne.active) airOne.show();
      if (G.wanted < 3 && airOne.active) airOne.hide();
      if (G.wanted >= 4 && !roadblockPlaced) {
        const hx = ps.x + Math.sin(ps.heading) * 70, hz = ps.z + Math.cos(ps.heading) * 70;
        roadblock.place(hx, hz, ps.heading + Math.PI / 2);
        roadblockPlaced = true;
      }
      if (G.wanted < 3 && roadblockPlaced) { roadblock.clear(); roadblockPlaced = false; }
      // hidden decay
      if (nearest > 70) { G.hiddenT += dt; if (G.hiddenT > 14) { G.wanted--; G.hiddenT = 0; hud.toast(`Heat cooling — ${G.wanted}★ left.`); } }
      else G.hiddenT = 0;
    } else {
      G.inSight = false;
      for (const u of police) {
        if (u.mesh.position.x > 300) continue;
        u.update(dt, { x: u.mesh.position.x + 100, z: u.mesh.position.z + 100, heading: 0 }, 0);
        if (dist2d(u.mesh.position.x, u.mesh.position.z, ps.x, ps.z) > 160) u.mesh.position.set(400, 0, 400);
      }
      if (airOne.active) airOne.hide();
      if (roadblockPlaced) { roadblock.clear(); roadblockPlaced = false; }
    }
    audio.setSiren(G.wanted > 0);

    // --- missions ---
    const ctx = missionCtx();
    missions.update(dt, ctx);
    const step = missions.stepDef();
    if (missions.active && step && step.type === 'goto') {
      beaconPos.x = step.x; beaconPos.z = step.z;
      beacon.visible = true; beacon.position.set(step.x, 0, step.z);
      beaconGem.position.y = 8 + Math.sin(G.time * 2) * 0.8;
      beaconGem.rotation.y += dt * 2;
    } else if (!missions.active) beacon.visible = false;

    // --- clock ---
    G.clockMin = (G.clockMin + dt * 0.5) % (24 * 60);

    // --- camera ---
    updateCamera(dt);

    // --- HUD ---
    hud.update(assembleHudState(), performance.now());
  }

  function assembleHudState() {
    const ps = playerState;
    const m = missions.mission();
    const step = missions.stepDef();
    const dispatch = [];
    for (const u of police) {
      if (u.mesh.position.x > 300) continue;
      const d = Math.round(dist2d(ps.x, ps.z, u.mesh.position.x, u.mesh.position.z));
      dispatch.push({
        name: `TARPON ${u.unitNo}`,
        dist: d,
        status: airOne.active ? 'SPOTLIGHT' : roadblockPlaced ? 'ROADBLOCK' : 'RAMMING',
      });
    }
    if (airOne.active) dispatch.push({ name: 'AIR ONE', dist: 36, status: 'SPOTLIGHT' });
    if (roadblockPlaced) dispatch.push({ name: 'BULWARK 2', dist: 164, status: 'ROADBLOCK' });
    const speedMph = G.hudSpeedOverride ?? (G.inCar ? Math.abs(G.carSpeed) * 2.237 : Math.abs(ps.speed || 0) * 2.237);
    return {
      jobTitle: m ? `JOB ${m.id}/8 — ${m.title}` : 'FREE ROAM — SOLMAR BAY',
      missionTime: missions.active ? missions.timeLeft() : 0,
      missionProgress: missions.active ? missions.progress01() : (missions.done ? 1 : 0),
      objective: step ? step.text : (missions.done ? 'Job complete. Next job at the pier.' : 'Explore Solmar Bay.'),
      dispatch,
      clockMin: G.clockMin, cash: G.cash, wanted: G.wanted, inSight: !!G.inSight,
      weapon: G.weapon, ammo: G.ammo, owned: G.owned,
      health: G.health, armor: G.armor, respect: G.respect,
      district: districtAt(ps.x, ps.z),
      vehicleName: G.inCar ? G.inCar.spec.name : 'ON FOOT',
      condition01: G.inCar ? G.condition : 1, nos01: G.nos,
      speedMph, radio: RADIO[audio.channel],
      player: { x: ps.x, z: ps.z, heading: ps.heading },
      police: police.filter((u) => u.mesh.position.x < 300).map((u) => ({ x: u.mesh.position.x, z: u.mesh.position.z, chasing: true })),
      traffic: traffic.map((t) => ({ x: t.mesh.position.x, z: t.mesh.position.z })),
      missionMarker: missions.active && step && step.type === 'goto' ? { x: step.x, z: step.z } : null,
    };
  }

  function updateCamera(dt) {
    const ps = playerState;
    G.shake = Math.max(0, G.shake - dt * 1.6);
    if (G.cameraMode === 'orbit') {
      G.orbitAngle += dt * 0.045;
      const cx = 60 + Math.cos(G.orbitAngle) * 95;
      const cz = 190 + Math.sin(G.orbitAngle) * 55;
      camera.position.lerp(new THREE.Vector3(cx, 30 + Math.sin(G.orbitAngle * 0.7) * 6, cz), 1 - Math.pow(0.01, dt));
      camera.lookAt(60, 12, 195);
      return;
    }
    const target = G.inCar ? G.inCar.mesh : player.group;
    const heading = G.inCar ? G.carHeading : ps.heading;
    const dist = G.inCar ? ((G.cameraMode === 'far' || G.cameraMode === 'far-wide') ? 15.5 : 10.5) : 7;
    const height = G.inCar ? ((G.cameraMode === 'far' || G.cameraMode === 'far-wide') ? 5.2 : 3.6) : 2.8;
    const back = new THREE.Vector3(-Math.sin(heading) * dist, height, -Math.cos(heading) * dist);
    const lat = G.cameraMode === 'far-wide' ? 8 : G.cameraMode === 'far' ? 3.5 : 0;
    if (lat) { back.x += Math.cos(heading) * lat; back.z += -Math.sin(heading) * lat; }
    const want = target.position.clone().add(back);
    want.y = Math.max(want.y, groundHeight(want.x, want.z) + 2.2);
    const lookRaw = target.position.clone().add(new THREE.Vector3(Math.sin(heading) * 7, G.inCar ? 1.2 : 1.6, Math.cos(heading) * 7));
    if (G.camSnap) {
      // First chase frame after a reset: snap to the ideal point (no swoop
      // from the title orbit). The spring takes over from here.
      camera.position.copy(want);
      G.camVel.set(0, 0, 0);
      G.camLook.copy(lookRaw);
      G.camSnap = false;
    } else {
      // Spring-damper chase camera: the camera is a mass on a spring chasing
      // the ideal point, so it lags and settles smoothly instead of snapping.
      const stiff = 26, damp = 9;
      G.camVel.x += (want.x - camera.position.x) * stiff * dt;
      G.camVel.y += (want.y - camera.position.y) * stiff * dt;
      G.camVel.z += (want.z - camera.position.z) * stiff * dt;
      G.camVel.multiplyScalar(Math.exp(-damp * dt));
      camera.position.addScaledVector(G.camVel, dt);
      // Smooth the look target too, so the view never whips.
      G.camLook.lerp(lookRaw, 1 - Math.pow(0.001, dt));
    }
    const look = G.camLook.clone();
    if (G.shake > 0) {
      look.x += (Math.random() - 0.5) * G.shake * 0.7;
      look.y += (Math.random() - 0.5) * G.shake * 0.5;
    }
    camera.lookAt(look);
    const targetFov = 62 + (G.nitro ? 10 : 0) + Math.abs(G.carSpeed) * 0.06;
    camera.fov = lerp(camera.fov, targetFov, 1 - Math.pow(0.01, dt));
    camera.updateProjectionMatrix();
  }

  // ---- main loop -----------------------------------------------------------------------
  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    G.time += dt;
    world.update(dt, G.time);
    effects.update(dt, G.time);
    if (G.state === 'playing' && !G.shotFrozen) updatePlaying(dt);
    else if (G.shotFrozen) {
      // frozen shot: ambient motion only, camera settles on the staged scene
      updateCamera(dt);
      hud.update(assembleHudState(), performance.now());
      // staged action stays visible while frozen: nitro flames, drift smoke, Air One
      // photo fill light: lifts the hero car / player out of the sunset shadow
      if (!G._shotLight) { G._shotLight = new THREE.PointLight(0xffe2b8, 320, 42, 1.5); scene.add(G._shotLight); }
      {
        const subj = G.inCar ? G.inCar.mesh : player.group;
        const hd = G.inCar ? G.carHeading : playerState.heading;
        G._shotLight.position.set(subj.position.x - Math.sin(hd) * 4 + Math.cos(hd) * 3, subj.position.y + 6, subj.position.z - Math.cos(hd) * 4 - Math.sin(hd) * 3);
      }
      if (G.inCar) {
        const car = G.inCar;
        if (G.nitro) {
          for (let i = 0; i < 2; i++) {
            const f = flames[i];
            f.visible = true;
            const off = new THREE.Vector3(-2.45, 0.32, i === 0 ? -0.4 : 0.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), G.carHeading);
            f.position.copy(car.mesh.position).add(off);
            f.rotation.y = G.carHeading + Math.PI / 2;
            f.scale.set(1.8 + Math.random() * 0.6, 2.2 + Math.random() * 0.8, 1);
          }
        }
        if (G.drifting && (frames % 3) === 0) {
          const bx = car.mesh.position.x - Math.sin(G.carHeading) * 3.5;
          const bz = car.mesh.position.z - Math.cos(G.carHeading) * 3.5;
          effects.tireSmoke(bx + (Math.random() - 0.5) * 2.4, car.mesh.position.y + 0.2, bz + (Math.random() - 0.5) * 1.2);
          if (!G._skidsDone) {
            G._skidsDone = true;
            for (let k = 0; k < 4; k++) effects.skidMark(bx - Math.sin(G.carHeading) * k * 2.2, bz - Math.cos(G.carHeading) * k * 2.2, G.carHeading, 2.2);
          }
        }
      }
      if (airOne.active) airOne.update(dt, G.time, { x: playerState.x, z: playerState.z, y: G.inCar ? G.inCar.mesh.position.y : 0 }, G.carHeading);
    } else if (G.state === 'title') {
      updateCamera(dt);
      for (const t of traffic) t.update(dt);
      for (const p of peds) p.update(dt);
    }
    if (muzzle.intensity > 0) muzzle.intensity = Math.max(0, muzzle.intensity - dt * 900);
    renderer.render(scene, camera);
    frames++;
    if (frames === 3) window.__shotReady = true;
  }

  // ---- boot --------------------------------------------------------------------------------
  updateGunProp();
  const shot = shotNameFromUrl();
  if (shot) {
    stageShot(G, shot);
    window.__shotName = shot;
  } else {
    G.showTitleScreen();
  }
  window.__solmar = G;
  window.__gameReady = true;
  loop();
  return G;
}

createGame();
