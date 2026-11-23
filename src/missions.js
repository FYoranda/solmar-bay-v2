// Solmar Bay — story missions: 8 jobs with stages, NPC dialog, cash rewards,
// respect and a localStorage save. The runner only reads game state; it never
// touches the renderer.
import { MISSIONS, SAVE_KEY, RESPECT_RANKS } from './config.js';
import { dist2d } from './utils.js';

export function blankSave() {
  return { cash: 500, job: 1, respect: 0, health: 100, armor: 0, weapons: ['fists', 'bat'], ammo: { pistol: 24, smg: 60, rpg: 2 }, completed: [] };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s.cash !== 'number') return null;
    return Object.assign(blankSave(), s);
  } catch (e) { return null; }
}

export function storeSave(s) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { /* private mode */ }
}

export function respectRank(respect) {
  let rank = RESPECT_RANKS[0];
  for (const r of RESPECT_RANKS) if (respect >= r.at) rank = r;
  const next = RESPECT_RANKS.find((r) => r.at > respect);
  return { name: rank.name, nextAt: next ? next.at : null };
}

const DIALOG = {
  1: [['tia', 'Jax, mijo. The bay is hot tonight — but the money is hotter. Meet me at the pier.'],
    ['tia', 'Good. Marco has the Comet GT fuelled. Take it downtown, nice and easy.'],
    ['marco', 'Hold the door, Jax. Two minutes and she is loaded.']],
  2: [['tia', 'The valet called it in. A Calyx Sprint, mid-bridge. Go get our car back.'],
    ['tia', 'That is our Sprint. Bring her home to El Desguace — no scratches.']],
  3: [['marco', 'Crates at the marina, Jax. Move them before the PD sweep at dusk.'],
    ['marco', 'Easy… easy… One more crate and we are gone.']],
  4: [['lena', 'The beach gym belongs to us tonight. Clear the rivals out, Jax.'],
    ['lena', 'Boardwalk is ours. Meet me at the wheel — I have the next job.']],
  5: [['marco', 'PD put a roadblock on the coastal road. Smash straight through it.'],
    ['marco', 'They are on you now. Lose them in the back streets!']],
  6: [['lena', 'Air One is over the bay. Draw it off while Marco moves the goods.'],
    ['lena', 'They are all watching you. Now vanish — marina safehouse.']],
  7: [['tia', 'A neon run through downtown. No brakes, no mercy, mijo.'],
    ['tia', 'Checkpoint one down. The canal next — do not slow down.']],
  8: [['tia', 'One last job, Jax. The whole bay is watching tonight.'],
    ['tia', 'Hold the pier! Hold it! Then run for the bridge and do not look back.']],
};

export class MissionRunner {
  constructor(hud, audio) {
    this.hud = hud; this.audio = audio;
    this.job = 1; this.step = 0; this.stepT = 0;
    this.active = false; this.done = false;
    this.killsAtStart = 0; this.ramsAtStart = 0;
    this.chaseT = 0; this.hiddenT = 0;
    this.dialogQ = [];
  }

  start(job, ctx) {
    const m = MISSIONS[job - 1];
    if (!m) { this.active = false; this.done = true; return; }
    this.job = job; this.step = 0; this.stepT = 0; this.active = true; this.done = false;
    this.killsAtStart = ctx.kills; this.ramsAtStart = ctx.rams;
    this.chaseT = 0; this.hiddenT = 0;
    this.say(m.giver, m.brief);
    this.announceStep();
  }

  mission() { return MISSIONS[this.job - 1] || null; }
  stepDef() { const m = this.mission(); return m ? m.steps[this.step] : null; }

  say(npcId, text) { this.hud.showDialog(npcId, text, 5200); }

  announceStep() {
    const s = this.stepDef(); if (!s) return;
    const m = this.mission();
    const lines = DIALOG[m.id] || [];
    if (lines[this.step]) this.say(lines[this.step][0], lines[this.step][1]);
    else if (s.text) this.say(m.giver, s.text);
  }

  progress01() {
    const m = this.mission(); if (!m) return 1;
    return this.step / m.steps.length;
  }

  update(dt, ctx) {
    if (!this.active) return;
    const m = this.mission(); if (!m) return;
    const s = this.stepDef();
    if (!s) { this.complete(ctx); return; }
    this.stepT += dt;
    let done = false;
    if (s.type === 'goto') {
      done = dist2d(ctx.pos.x, ctx.pos.z, s.x, s.z) < s.r;
    } else if (s.type === 'wait') {
      done = this.stepT >= s.t;
    } else if (s.type === 'steal') {
      done = ctx.stoleTarget === true;
    } else if (s.type === 'shoot') {
      done = ctx.kills - this.killsAtStart >= s.n;
    } else if (s.type === 'ram') {
      done = ctx.rams - this.ramsAtStart >= s.n;
    } else if (s.type === 'lose') {
      if (ctx.wanted === 0) this.hiddenT += dt; else this.hiddenT = 0;
      done = this.hiddenT >= s.t;
    } else if (s.type === 'chase') {
      if (ctx.wanted >= 3) this.chaseT += dt; else this.chaseT = Math.max(0, this.chaseT - dt);
      done = this.chaseT >= s.t;
    }
    if (done) {
      this.step++; this.stepT = 0;
      this.killsAtStart = ctx.kills; this.ramsAtStart = ctx.rams;
      if (this.step >= m.steps.length) this.complete(ctx);
      else this.announceStep();
    }
  }

  timeLeft() {
    const m = this.mission(); if (!m) return 0;
    return Math.max(0, m.time - this.stepT);
  }

  complete(ctx) {
    const m = this.mission();
    this.active = false; this.done = true;
    ctx.save.cash += m.reward;
    ctx.save.respect += 120 + m.id * 40;
    if (!ctx.save.completed.includes(m.id)) ctx.save.completed.push(m.id);
    this.audio.cash();
    this.hud.popup(`JOB COMPLETE — +$${m.reward}`, 'cash');
    this.say(m.giver, `Job done, Jax. $${m.reward} is yours. The bay remembers.`);
    storeSave(ctx.save);
    this.job = Math.min(8, m.id + 1);
  }
}
