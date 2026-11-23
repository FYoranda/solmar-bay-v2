// Solmar Bay: Heat Tide — shared constants, world layout, vehicles, weapons,
// missions, radio and crew. Every name, place and character is original.
export const WORLD = {
  size: 480, half: 240,
  beachZ: 150, seaZ: 182, pierX: 60, pierZ0: 150, pierZ1: 268,
  canalZ: 72, canalHalf: 8, canalX0: -10, canalX1: 130,
  bridgeX: -196, bridgeZ0: -60, bridgeZ1: 210, bridgeDeckY: 16,
  roadGap: 40, roadHalf: 5,
  seaLevel: 0.4,
};

export const DISTRICTS = [
  { name: 'SANTA MARIA BEACH', x0: -240, x1: 240, z0: 146, z1: 300 },
  { name: 'VERONA CANAL', x0: -10, x1: 130, z0: 48, z1: 96 },
  { name: 'SOLMAR DOWNTOWN', x0: -240, x1: 240, z0: -240, z1: -60 },
  { name: 'MARINA BAY', x0: 120, x1: 240, z0: 96, z1: 146 },
  { name: 'SOLMAR DOWNTOWN', x0: -240, x1: 240, z0: -60, z1: 146 },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) return d.name;
  }
  return 'SOLMAR DOWNTOWN';
}

export const VEHICLES = [
  { id: 'comet', name: 'SOLMAR COMET GT', kind: 'supercar', top: 68, accel: 26, grip: 2.6, color: 0xff4d00, carbon: true, spoiler: true, price: 0 },
  { id: 'muscle', name: 'DUCHESS MUSCLE', kind: 'muscle', top: 52, accel: 20, grip: 2.1, color: 0x7a1f2b, carbon: false, spoiler: false, price: 0 },
  { id: 'police', name: 'SOLMAR PD CRUISER', kind: 'police', top: 56, accel: 22, grip: 2.4, color: 0x1a2436, carbon: false, spoiler: false, price: 0 },
  { id: 'suv', name: 'TERRA SUV', kind: 'suv', top: 46, accel: 16, grip: 2.0, color: 0x2e5d43, carbon: false, spoiler: false, price: 0 },
  { id: 'taxi', name: 'BAY TAXI', kind: 'taxi', top: 44, accel: 15, grip: 2.0, color: 0xf2b705, carbon: false, spoiler: false, price: 0 },
  { id: 'van', name: 'DOCK VAN', kind: 'van', top: 38, accel: 12, grip: 1.8, color: 0x8a8f98, carbon: false, spoiler: false, price: 0 },
  { id: 'sedan', name: 'CALYX SPRINT', kind: 'sedan', top: 48, accel: 17, grip: 2.2, color: 0x3d5a80, carbon: false, spoiler: false, price: 0 },
];

export const WEAPONS = [
  { id: 'fists', name: 'FISTS', dmg: 12, rate: 0.35, ammo: Infinity, auto: false },
  { id: 'bat', name: 'BAT', dmg: 26, rate: 0.55, ammo: Infinity, auto: false },
  { id: 'pistol', name: 'PISTOL', dmg: 22, rate: 0.28, ammo: 84, auto: false },
  { id: 'smg', name: 'SMG', dmg: 14, rate: 0.09, ammo: 208, auto: true },
  { id: 'rpg', name: 'RPG', dmg: 140, rate: 1.4, ammo: 6, auto: false },
];

export const CREW = [
  { id: 'tia', name: 'TIA ROSA', role: 'DINER OWNER · FAMILY', skin: '#c98d64', hair: '#2b1a12', hairStyle: 'bun', accent: '#ff3860' },
  { id: 'marco', name: 'MARCO VANE', role: 'GETAWAY DRIVER', skin: '#8a5a3b', hair: '#101010', hairStyle: 'flat', accent: '#7df9ff' },
  { id: 'lena', name: 'LENA COSTA', role: 'FIXER · RADIO', skin: '#e8b48c', hair: '#7a1f2b', hairStyle: 'long', accent: '#ffd166' },
];

export const RADIO = [
  { name: 'Radio Solmar 98.6', track: '“Guava Sunrise” — Neon Coast', bpm: 96, wave: 'sawtooth', bass: [45, 45, 52, 48, 43, 45, 57, 52], pad: [69, 72, 76] },
  { name: 'Neon Coast FM 101.2', track: '“Midnight Boardwalk” — Velvet Static', bpm: 116, wave: 'square', bass: [41, 41, 48, 46, 44, 41, 53, 50], pad: [65, 68, 72] },
  { name: 'Bay Talk 101.9', track: '“Heat Tide Nights” — DJ Marisol', bpm: 82, wave: 'triangle', bass: [38, 38, 43, 41, 36, 38, 45, 43], pad: [62, 65, 69] },
];

export const MISSIONS = [
  { id: 1, title: 'HEAT TIDE', giver: 'tia', reward: 400, time: 240,
    brief: 'Meet Tia Rosa at the Santa Maria Pier. She has a job for you.',
    steps: [
      { type: 'goto', x: 60, z: 156, r: 6, text: 'Go to the pier entrance and meet Tia Rosa.' },
      { type: 'goto', x: -40, z: 128, r: 7, text: 'Drive the Comet GT to the downtown garage.' },
      { type: 'wait', t: 4, text: 'Hold the garage door while Marco loads the car.' },
    ] },
  { id: 2, title: 'REPO RODEO', giver: 'tia', reward: 650, time: 210,
    brief: 'The valet called it in. Repossess the Calyx Sprint on Tarpon Bridge.',
    steps: [
      { type: 'goto', x: -196, z: 60, r: 8, text: 'Reach the Tarpon Bridge south tower.' },
      { type: 'steal', text: 'Take the Calyx Sprint parked mid-bridge.' },
      { type: 'goto', x: 40, z: 128, r: 8, text: 'Deliver the car to El Desguace in Puerto Viejo.' },
    ] },
  { id: 3, title: 'DOCK HAND', giver: 'marco', reward: 900, time: 240,
    brief: 'Crates at the marina. Move them before the PD sweep.',
    steps: [
      { type: 'goto', x: 170, z: 120, r: 7, text: 'Reach the marina crates.' },
      { type: 'wait', t: 5, text: 'Load the crates. Keep watch.' },
      { type: 'goto', x: -120, z: -100, r: 8, text: 'Drop the crates at the downtown lockup.' },
    ] },
  { id: 4, title: 'HIGH TIDE', giver: 'lena', reward: 1200, time: 240,
    brief: 'Clear out the beach gym guards. The boardwalk must be ours by dusk.',
    steps: [
      { type: 'goto', x: 20, z: 158, r: 7, text: 'Reach the beach gym on the boardwalk.' },
      { type: 'shoot', n: 3, text: 'Clear out the rival crew (3).' },
      { type: 'goto', x: 60, z: 200, r: 7, text: 'Meet Lena at the Ferris wheel.' },
    ] },
  { id: 5, title: 'GATE CRASHER', giver: 'marco', reward: 1800, time: 200,
    brief: 'The PD set a roadblock on the coastal road. Smash through it.',
    steps: [
      { type: 'goto', x: -60, z: 128, r: 8, text: 'Reach the coastal road checkpoint.' },
      { type: 'ram', n: 2, text: 'Ram through the roadblock (2 cruisers).' },
      { type: 'lose', t: 20, text: 'Lose the heat — stay out of sight for 20s.' },
    ] },
  { id: 6, title: 'AIR ONE', giver: 'lena', reward: 2400, time: 220,
    brief: 'Air One is over the bay. Draw it off while Marco moves the goods.',
    steps: [
      { type: 'goto', x: -196, z: 140, r: 9, text: 'Get on the bridge and make noise.' },
      { type: 'chase', t: 25, text: 'Keep 3+ stars for 25s. Do not get busted.' },
      { type: 'goto', x: 120, z: 128, r: 8, text: 'Break off to the marina safehouse.' },
    ] },
  { id: 7, title: 'NEON RUN', giver: 'tia', reward: 3200, time: 200,
    brief: 'A neon-lit run through downtown. No brakes, no mercy.',
    steps: [
      { type: 'goto', x: 0, z: -120, r: 8, text: 'Start line: downtown plaza.' },
      { type: 'goto', x: -160, z: -120, r: 8, text: 'Checkpoint 1: west arcade.' },
      { type: 'goto', x: -160, z: 40, r: 8, text: 'Checkpoint 2: Verona Canal.' },
      { type: 'goto', x: 60, z: 128, r: 8, text: 'Finish: Santa Maria Beach.' },
    ] },
  { id: 8, title: 'HEAT TIDE FINALE', giver: 'tia', reward: 5000, time: 300,
    brief: 'One last job. The whole bay is watching.',
    steps: [
      { type: 'goto', x: 60, z: 240, r: 7, text: 'Meet Tia at the lighthouse.' },
      { type: 'shoot', n: 4, text: 'Hold the pier against the rival crew (4).' },
      { type: 'goto', x: -196, z: -40, r: 9, text: 'Escape across the bridge. Finish the story.' },
    ] },
];

export const SAVE_KEY = 'solmar-bay-save-v2';
export const RESPECT_RANKS = [
  { at: 0, name: 'ROOKIE' }, { at: 250, name: 'HUSTLER' }, { at: 800, name: 'RUNNER' },
  { at: 1800, name: 'KINGPIN' }, { at: 3500, name: 'BAY LEGEND' },
];
export const WANTED_DECAY_S = 14;

export function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }
export function respectRank(respect) {
  const list = Array.isArray(RESPECT_RANKS) ? RESPECT_RANKS : [];
  let cur = list[0];
  for (const r of list) {
    const min = (r && typeof r === 'object') ? (r.min ?? r.threshold ?? r.at ?? r.points ?? 0) : 0;
    if (respect >= min) cur = r;
  }
  return cur;
}
