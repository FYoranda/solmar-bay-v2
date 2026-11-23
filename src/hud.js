// Solmar Bay — the dense console HUD: mission tracker, live police dispatch,
// clock/cash/wanted/weapon bar, circular radar minimap, health/armor, respect,
// district name, NPC dialog, radio ticker, condition/NOS gauges and the big
// digital speedometer. All DOM; the 3D scene never draws UI.
import { WEAPONS, CREW, RADIO, districtAt, respectRank } from './config.js';
import { makePortrait, clamp } from './utils.js';

const WEAPON_SVG = {
  fists: '<svg viewBox="0 0 26 22"><circle cx="9" cy="10" r="6" fill="#cfd8ff"/><circle cx="18" cy="12" r="6" fill="#9fb0e8"/><rect x="6" y="15" width="14" height="5" rx="2" fill="#cfd8ff"/></svg>',
  bat: '<svg viewBox="0 0 26 22"><rect x="11" y="1" width="5" height="15" rx="2.5" transform="rotate(24 13 8)" fill="#d8a05a"/><rect x="10" y="14" width="7" height="7" rx="2" fill="#8a5a2a"/></svg>',
  pistol: '<svg viewBox="0 0 26 22"><path d="M4 4h16v5H12v9H8v-9H4z" fill="#cfd8ff"/><rect x="12" y="9" width="4" height="4" fill="#9fb0e8"/></svg>',
  smg: '<svg viewBox="0 0 26 22"><path d="M2 7h18v4H10l-2 8H5l2-8H2z" fill="#cfd8ff"/><rect x="18" y="5" width="6" height="3" fill="#9fb0e8"/></svg>',
  rpg: '<svg viewBox="0 0 26 22"><rect x="2" y="9" width="17" height="5" rx="2" fill="#8a9a8a"/><path d="M19 7l6 4-6 4z" fill="#ff8a5a"/><rect x="6" y="14" width="3" height="6" fill="#cfd8ff"/></svg>',
};

export class HUD {
  constructor() {
    this.el = {};
    for (const id of ['job-label', 'mission-timer', 'mission-stage-fill', 'mission-objective', 'dispatch-list',
      'clock', 'cash', 'stars', 'insight-badge', 'weapon-bar', 'crew-cards', 'radar', 'health-fill', 'armor-fill',
      'respect-badge', 'district-name', 'dialog', 'dialog-portrait', 'dialog-name', 'dialog-text',
      'radio-station', 'radio-track', 'vehicle-name', 'condition-fill', 'nos-fill', 'speedo', 'popups', 'toast']) {
      this.el[id] = document.getElementById(id);
    }
    this.radarCtx = this.el.radar.getContext('2d');
    this.portraits = {};
    for (const c of CREW) this.portraits[c.id] = makePortrait(c);
    this.buildWeaponBar();
    this.buildCrewCards();
    this.dialogUntil = 0;
    this.lastText = 0;
  }

  buildWeaponBar() {
    this.el['weapon-bar'].innerHTML = WEAPONS.map((w, i) =>
      `<div class="wslot" data-w="${w.id}">${WEAPON_SVG[w.id]}<div class="wname">${w.name}</div><div class="ammo">—</div></div>`).join('');
    this.slots = [...this.el['weapon-bar'].children];
  }

  buildCrewCards() {
    this.el['crew-cards'].innerHTML = CREW.slice(0, 2).map((c) =>
      `<div class="crew"><img src="${this.portraits[c.id]}" alt=""><div class="cname">${c.name}</div><div class="crole">${c.role}</div></div>`).join('');
  }

  showDialog(npcId, text, dur) {
    const npc = CREW.find((c) => c.id === npcId) || CREW[0];
    this.el['dialog-portrait'].src = this.portraits[npc.id];
    this.el['dialog-name'].textContent = npc.name;
    this.el['dialog-text'].textContent = text;
    this.el.dialog.classList.add('show');
    this.dialogUntil = performance.now() + (dur || 4200);
  }

  popup(text, kind) {
    const d = document.createElement('div');
    d.className = 'popup' + (kind === 'cash' ? ' cash' : '');
    d.textContent = text;
    this.el.popups.appendChild(d);
    setTimeout(() => d.remove(), 2200);
    while (this.el.popups.children.length > 3) this.el.popups.firstChild.remove();
  }

  toast(text, ms) {
    this.el.toast.textContent = text;
    this.el.toast.style.display = 'block';
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => { this.el.toast.style.display = 'none'; }, ms || 2400);
  }

  // state: {job, jobTitle, missionTime, missionProgress, objective, dispatch[],
  //  clockMin, cash, wanted, inSight, weapon, ammo{}, owned[], health, armor,
  //  respect, district, vehicleName, condition01, nos01, speedMph, radio,
  //  player:{x,z,heading}, police:[{x,z}], traffic:[{x,z}], missionMarker}
  update(s, now) {
    if (now > this.dialogUntil) this.el.dialog.classList.remove('show');
    // text updates throttled to ~10 Hz
    if (now - this.lastText > 100) {
      this.lastText = now;
      this.el['job-label'].textContent = s.jobTitle;
      const mm = Math.floor(s.missionTime / 60), ss = Math.floor(s.missionTime % 60);
      this.el['mission-timer'].textContent = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
      this.el['mission-stage-fill'].style.width = `${Math.round(s.missionProgress * 100)}%`;
      this.el['mission-objective'].textContent = s.objective;
      this.el['dispatch-list'].innerHTML = s.dispatch.length ? s.dispatch.map((u) =>
        `<div class="unit"><span>▸ ${u.name} <b>${u.dist}m</b></span><span>${u.status}</span></div>`).join('')
        : '<div class="unit"><span>NO ACTIVE PURSUIT</span><b>—</b></div>';
      const hh = Math.floor(s.clockMin / 60), mi = Math.floor(s.clockMin % 60);
      this.el.clock.textContent = `${String(hh).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
      this.el.cash.textContent = `$${s.cash.toLocaleString('en-US')}`;
      const stars = [...this.el.stars.children];
      stars.forEach((sp, i) => sp.classList.toggle('on', i < s.wanted));
      this.el['insight-badge'].classList.toggle('hidden', !s.inSight);
      this.slots.forEach((slot, i) => {
        const w = WEAPONS[i];
        slot.classList.toggle('active', s.weapon === w.id);
        slot.classList.toggle('locked', !s.owned.includes(w.id));
        const ammoEl = slot.querySelector('.ammo');
        ammoEl.textContent = w.ammo === Infinity ? '∞' : String(s.ammo[w.id] ?? 0);
      });
      this.el['health-fill'].style.width = `${clamp(s.health, 0, 100)}%`;
      this.el['armor-fill'].style.width = `${clamp(s.armor, 0, 100)}%`;
      const rank = respectRank(s.respect);
      this.el['respect-badge'].textContent = `RESPECT — ${rank.name} · ${s.respect}${rank.nextAt ? '/' + rank.nextAt : ' MAX'}`;
      this.el['district-name'].textContent = s.district;
      this.el['vehicle-name'].textContent = s.vehicleName;
      this.el['condition-fill'].style.width = `${Math.round(s.condition01 * 100)}%`;
      this.el['nos-fill'].style.width = `${Math.round(s.nos01 * 100)}%`;
      this.el.speedo.innerHTML = `${Math.round(s.speedMph)} <small>MPH</small>`;
      this.el['radio-station'].textContent = `♪ ${s.radio.name}`;
      this.el['radio-track'].textContent = s.radio.track;
    }
    this.drawRadar(s);
  }

  drawRadar(s) {
    const g = this.radarCtx, W = 190, C = W / 2;
    g.clearRect(0, 0, W, W);
    g.save();
    g.beginPath(); g.arc(C, C, C - 2, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#0d1526'; g.fillRect(0, 0, W, W);
    const scale = W / 520;
    const px = (x) => C + x * scale, pz = (z) => C + z * scale;
    // sea + sand
    g.fillStyle = '#0a5f8a'; g.fillRect(0, pz(182), W, W - pz(182));
    g.fillStyle = '#c9a35f'; g.fillRect(0, pz(150), W, pz(182) - pz(150));
    // canal
    g.fillStyle = '#0a5f8a'; g.fillRect(px(-10), pz(64), (140) * scale, 16 * scale);
    // roads
    g.strokeStyle = 'rgba(200,205,220,0.55)'; g.lineWidth = 2;
    for (const z of [-160, -120, -80, -40, 0, 40, 120, 128]) {
      g.beginPath(); g.moveTo(px(-190), pz(z)); g.lineTo(px(190), pz(z)); g.stroke();
    }
    for (const x of [-160, -120, -80, -40, 0, 40, 80, 120, 160]) {
      g.beginPath(); g.moveTo(px(x), pz(-180)); g.lineTo(px(x), pz(128)); g.stroke();
    }
    // pier + bridge
    g.strokeStyle = '#c9a35f'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(px(60), pz(150)); g.lineTo(px(60), pz(268)); g.stroke();
    g.strokeStyle = '#c1272d'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(px(-196), pz(-60)); g.lineTo(px(-196), pz(210)); g.stroke();
    // mission marker
    if (s.missionMarker) {
      g.fillStyle = '#ffd166';
      g.save(); g.translate(px(s.missionMarker.x), pz(s.missionMarker.z)); g.rotate(Math.PI / 4);
      g.fillRect(-5, -5, 10, 10); g.restore();
    }
    // traffic + police blips
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (const t of s.traffic) { g.beginPath(); g.arc(px(t.x), pz(t.z), 1.8, 0, Math.PI * 2); g.fill(); }
    for (const p of s.police) {
      g.fillStyle = p.chasing ? '#ff3860' : '#7df9ff';
      g.beginPath(); g.arc(px(p.x), pz(p.z), 3.2, 0, Math.PI * 2); g.fill();
    }
    // player arrow (centre of radar is the player)
    g.fillStyle = '#39ff6a';
    g.save(); g.translate(C, C); g.rotate(s.player.heading);
    g.beginPath(); g.moveTo(0, -8); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath(); g.fill(); g.restore();
    // north tick + range ring
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1;
    g.beginPath(); g.arc(C, C, C - 2, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#ffd166'; g.font = '900 11px Verdana'; g.textAlign = 'center';
    g.fillText('N', C, 12);
    g.restore();
  }
}
