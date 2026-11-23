// Solmar Bay — screenshot staging: four frozen, action-dense moments the game
// holds for the camera. Each shot sets the world, the HUD and the camera, then
// the main loop keeps only ambient motion (wheel, water, flames, sirens) alive
// so the frame stays composed while it renders.
export function stageShot(G, name) {
  const S = (n) => (name === n);
  G.shotFrozen = true;
  G.hideScreens();
  if (S('title')) {
    G.state = 'title';
    G.showTitleScreen();
    G.setCameraMode('orbit');
    G.placePlayerInCar('comet', 35, 150, Math.PI * 0.5);
    G.setCarSpeed(0);
    G.setWanted(0); G.setCash(8770); G.setClockMin(17 * 60 + 19);
    G.setRespect(250);
    return 'title';
  }
  G.state = 'playing';
  G.setCameraMode('far');
  if (S('chase')) {
    // Coastal palm road, Comet GT at full nitro with drift smoke, PD behind.
    G.setCameraMode('far-wide');
    G.placePlayerInCar('comet', -53, 128, Math.PI / 2);
    G.setCarSpeed(68); G.setNitro(true); G.setDrift(true);
    G.setWanted(4); G.setCash(8770); G.setClockMin(17 * 60 + 19);
    G.spawnPolice(2, 'behind');
    G.showAirOne(-40, 8, 136);
    G.startMission(2);
    G.setMissionMarker(-196, 60);
    G.setHudSpeed(152);
    return 'chase';
  }
  if (S('bridge')) {
    // Suspension bridge: Air One spotlight, roadblock ahead, burning wreck.
    G.placePlayerInCar('comet', -196, 150, Math.PI);
    G.setCarSpeed(41); G.setNitro(false); G.setDrift(false);
    G.setWanted(5); G.setCash(8770); G.setClockMin(17 * 60 + 24);
    G.spawnPolice(3, 'behind');
    G.setRoadblockAhead(12);
    G.showAirOne(-188, 24, 137);
    G.burnWreck(-196, 132, 0.2);
    G.startMission(6);
    G.setMissionMarker(-196, -40);
    G.setHudSpeed(91);
    return 'bridge';
  }
  // foot: boardwalk shootout, NPC dialog, palms + Ferris wheel behind.
  G.placePlayerOnFoot(24, 154, Math.PI * 0.85, 'smg');
  G.setWanted(2); G.setCash(8770); G.setClockMin(17 * 60 + 42);
  G.spawnRivals(3, 30, 141);
  G.startMission(4);
  G.showDialog('lena', 'Boardwalk is ours, Jax. Clear the rivals out — do not let them reach the wheel.');
  G.setMissionMarker(60, 200);
  G.setHudSpeed(0);
  return 'foot';
}

export function shotNameFromUrl() {
  const q = new URLSearchParams(location.search);
  return q.get('shot') || '';
}

export function seedFromUrl() {
  const q = new URLSearchParams(location.search);
  const s = parseInt(q.get('seed') || '1', 10);
  return Number.isFinite(s) ? s : 1;
}
