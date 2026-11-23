// Solmar Bay: Heat Tide — touch controls for phones / tablets.
//
// Drives the SAME `keys` object and action callbacks the keyboard uses, so
// touch and desktop stay in sync. Only built on touch devices: on desktop
// this module returns null and adds no DOM and no listeners.
//
// Layout (touch only):
//   - virtual joystick, bottom-left: drag sets W/S/A/D (forward/back/strafe)
//   - action buttons, bottom-right: FIRE (tap/hold), JUMP (hold = Space),
//     NITRO (hold = Shift), CAR (tap = E, enter/exit car)
//   - pause button, top-centre (same as Esc)
// The HUD is shifted up / compacted on touch (see CSS below) so the joystick
// and buttons never cover the minimap, mission panel or speedometer.
export function initTouchControls(keys, actions) {
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0
    || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  if (!isTouch) return null;
  document.documentElement.classList.add('touch');

  const style = document.createElement('style');
  style.textContent = `
#touch-controls { position: fixed; inset: 0; z-index: 6; pointer-events: none; display: none; }
#touch-controls.on { display: block; }
#touch-controls .tbtn, #stick { pointer-events: auto; touch-action: none;
  -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
#stick { position: absolute; left: 16px; bottom: 16px; width: 132px; height: 132px;
  border-radius: 50%; background: rgba(8,12,24,.45); border: 2px solid rgba(255,179,71,.55); }
#stick-knob { position: absolute; left: 50%; top: 50%; width: 56px; height: 56px; margin: -28px 0 0 -28px;
  border-radius: 50%; background: radial-gradient(circle at 35% 35%, #ffd166, #ff9f1c);
  box-shadow: 0 0 12px rgba(255,159,28,.7); }
#touch-buttons { position: absolute; right: 16px; bottom: 16px; display: grid;
  grid-template-columns: 64px 64px; gap: 10px; }
.tbtn { width: 64px; height: 64px; border-radius: 50%; border: 2px solid rgba(255,209,102,.6);
  background: rgba(8,12,24,.6); color: #ffd166; font: 800 11px/1 "Segoe UI", Verdana, sans-serif;
  letter-spacing: 1px; }
.tbtn.active { background: rgba(255,159,28,.75); color: #201400; }
#tbtn-fire { border-color: rgba(255,56,96,.7); color: #ff8fa3; }
#tbtn-fire.active { background: rgba(255,56,96,.8); color: #fff; }
#touch-pause { position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
  width: 44px; height: 44px; border-radius: 8px; font-size: 13px; letter-spacing: 0; }
html.touch #hud-bl { bottom: 164px; width: 170px; }
html.touch #crew-cards { display: none; }
html.touch #radar-wrap, html.touch #radar { width: 120px; height: 120px; }
html.touch #hud-br { bottom: 164px; }
html.touch #speedo { font-size: 38px; }
html.touch #radio-ticker { display: none; }
html.touch #cash { font-size: 26px; }
html.touch #hud-tl { width: 260px; }
@media (max-height: 500px) {
  #stick { width: 104px; height: 104px; }
  #stick-knob { width: 44px; height: 44px; margin: -22px 0 0 -22px; }
  #touch-buttons { grid-template-columns: 52px 52px; gap: 8px; }
  .tbtn { width: 52px; height: 52px; font-size: 10px; }
  html.touch #radar-wrap, html.touch #radar { width: 72px; height: 72px; }
  html.touch #hud-bl { bottom: 125px; }
  html.touch #hud-br { bottom: 125px; }
  html.touch #speedo { font-size: 30px; }
  html.touch #hud-tl { width: 230px; }
  html.touch #mission-objective { font-size: 11px; }
  html.touch #dispatch-panel { display: none; }
}`;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'touch-controls';
  root.innerHTML = `
    <button id="touch-pause" class="tbtn" aria-label="Pause">&#10074;&#10074;</button>
    <div id="stick"><div id="stick-knob"></div></div>
    <div id="touch-buttons">
      <button id="tbtn-fire" class="tbtn">FIRE</button>
      <button id="tbtn-jump" class="tbtn">JUMP</button>
      <button id="tbtn-nitro" class="tbtn">NITRO</button>
      <button id="tbtn-car" class="tbtn">ENTER</button>
    </div>`;
  document.body.appendChild(root);

  const $ = (id) => document.getElementById(id);
  let woke = false;
  const wake = () => { if (!woke) { woke = true; if (actions.onWake) actions.onWake(); } };

  // ---- virtual joystick (bottom-left) -> W/S/A/D ------------------------------
  const stick = $('stick');
  const knob = $('stick-knob');
  const R = 44; // max knob travel, px
  const DZ = 0.28; // dead zone (fraction of R)
  let stickId = null;
  function setStick(dx, dy) {
    const len = Math.hypot(dx, dy);
    const cl = len > R ? R / len : 1;
    const x = dx * cl, y = dy * cl;
    knob.style.transform = `translate(${x}px, ${y}px)`;
    const nx = x / R, ny = y / R;
    keys.KeyW = ny < -DZ; keys.KeyS = ny > DZ;
    keys.KeyA = nx < -DZ; keys.KeyD = nx > DZ;
  }
  function clearStick() {
    keys.KeyW = keys.KeyS = keys.KeyA = keys.KeyD = false;
    knob.style.transform = 'translate(0px, 0px)';
  }
  function stickVec(e) {
    const r = stick.getBoundingClientRect();
    return [e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)];
  }
  stick.addEventListener('pointerdown', (e) => {
    if (stickId !== null) return;
    wake();
    stickId = e.pointerId;
    try { stick.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
    const [dx, dy] = stickVec(e);
    setStick(dx, dy);
  });
  stick.addEventListener('pointermove', (e) => {
    if (e.pointerId !== stickId) return;
    const [dx, dy] = stickVec(e);
    setStick(dx, dy);
  });
  const endStick = (e) => {
    if (e.pointerId !== stickId) return;
    stickId = null;
    clearStick();
  };
  stick.addEventListener('pointerup', endStick);
  stick.addEventListener('pointercancel', endStick);

  // ---- buttons ------------------------------------------------------------------
  // Hold-style: press-and-hold sets a key (or repeats an action); release clears.
  function holdButton(el, down, up, repeatMs) {
    let pid = null;
    let timer = null;
    el.addEventListener('pointerdown', (e) => {
      if (pid !== null) return;
      wake();
      pid = e.pointerId;
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
      el.classList.add('active');
      down();
      if (repeatMs) timer = setInterval(down, repeatMs);
    });
    const release = (e) => {
      if (e.pointerId !== pid) return;
      pid = null;
      if (timer) { clearInterval(timer); timer = null; }
      el.classList.remove('active');
      if (up) up();
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
  }
  // Tap-style: one action per press.
  function tapButton(el, fn) {
    el.addEventListener('pointerdown', (e) => {
      wake();
      e.preventDefault();
      el.classList.add('active');
      setTimeout(() => el.classList.remove('active'), 120);
      fn();
    });
  }

  holdButton($('tbtn-jump'), () => { keys.Space = true; }, () => { keys.Space = false; });
  holdButton($('tbtn-nitro'), () => { keys.ShiftLeft = true; }, () => { keys.ShiftLeft = false; });
  holdButton($('tbtn-fire'), () => { actions.onShoot(); }, null, 220);
  tapButton($('tbtn-car'), () => {
    const carBtn = $('tbtn-car');
    carBtn.textContent = actions.isInCar() ? 'EXIT' : 'ENTER';
    actions.onCar();
  });
  tapButton($('touch-pause'), () => { actions.onPause(); });

  function clearAll() {
    clearStick();
    keys.Space = false; keys.ShiftLeft = false;
    for (const b of root.querySelectorAll('.tbtn')) b.classList.remove('active');
  }

  let visible = false;
  return {
    setVisible(v) {
      visible = !!v;
      root.classList.toggle('on', visible);
      if (!visible) clearAll();
    },
    get visible() { return visible; },
  };
}
