// Solmar Bay — 100% procedural WebAudio: engine, sirens, gunfire, cash,
// explosions and a three-channel synthwave radio. No audio files, no network.
import { RADIO, midiToFreq } from './config.js';

export class GameAudio {
  constructor() {
    this.ctx = null; this.master = null; this.noiseBuf = null;
    this.engineOsc = null; this.engineOsc2 = null; this.engineGain = null; this.engineFilter = null;
    this.sirenOsc = null; this.sirenGain = null; this.sirenOn = false;
    this.radioTimer = null; this.radioStep = 0; this.radioNext = 0;
    this.channel = 0; this.radioOn = true; this.muted = false;
  }

  // Created only after a user gesture (autoplay policy); screenshots run muted.
  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp); comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 55;
      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'sine'; this.engineOsc2.frequency.value = 28;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass'; this.engineFilter.frequency.value = 420;
      this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineFilter); this.engineOsc2.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start(); this.engineOsc2.start();
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle'; this.sirenOsc.frequency.value = 720;
      this.sirenGain = this.ctx.createGain(); this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.startRadio();
    } catch (e) { this.ctx = null; }
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  setEngine(speed01, nitro) {
    if (!this.ctx || !this.engineGain) return;
    const t = this.ctx.currentTime;
    const f = 52 + speed01 * 165 + (nitro ? 55 : 0);
    this.engineOsc.frequency.setTargetAtTime(f, t, 0.06);
    this.engineOsc2.frequency.setTargetAtTime(f * 0.5, t, 0.06);
    this.engineGain.gain.setTargetAtTime(0.02 + speed01 * 0.06 + (nitro ? 0.02 : 0), t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(380 + speed01 * 900, t, 0.1);
  }

  setSiren(on) {
    if (!this.ctx || !this.sirenGain) return;
    this.sirenOn = on;
    this.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, this.ctx.currentTime, 0.15);
    if (on && !this.sirenLfo) {
      this.sirenLfo = this.ctx.createOscillator();
      this.sirenLfo.type = 'square'; this.sirenLfo.frequency.value = 0.9;
      const lg = this.ctx.createGain(); lg.gain.value = 190;
      this.sirenLfo.connect(lg); lg.connect(this.sirenOsc.frequency);
      this.sirenLfo.start();
    }
  }

  blip(freq, dur, type, vol, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(); o.type = type || 'sine'; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol || 0.12, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }

  gunshot(big) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = big ? 900 : 2400;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(big ? 0.5 : 0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (big ? 0.7 : 0.16));
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.8);
    if (big) this.blip(48, 0.6, 'sine', 0.4);
  }

  cash() { this.blip(659, 0.12, 'sine', 0.14); this.blip(831, 0.12, 'sine', 0.14, 0.07); this.blip(988, 0.22, 'sine', 0.16, 0.14); }

  explosion() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(120, t + 0.9);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.55, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 1.2);
    this.blip(42, 0.9, 'sine', 0.5);
  }

  setChannel(i) { this.channel = ((i % RADIO.length) + RADIO.length) % RADIO.length; this.radioStep = 0; }

  startRadio() {
    if (this.radioTimer || !this.ctx) return;
    this.radioNext = this.ctx.currentTime + 0.1;
    this.radioTimer = setInterval(() => this.scheduleRadio(), 90);
  }

  scheduleRadio() {
    if (!this.ctx || !this.radioOn || this.muted) return;
    const st = RADIO[this.channel];
    const stepDur = 60 / st.bpm / 2;
    while (this.radioNext < this.ctx.currentTime + 0.35) {
      const t = this.radioNext;
      const step = this.radioStep % 16;
      const bass = st.bass[Math.floor(this.radioStep / 2) % st.bass.length];
      this.note(midiToFreq(bass - 12), stepDur * 1.9, st.wave, 0.10, t);
      if (step % 8 === 0) {
        for (const p of st.pad) this.note(midiToFreq(p), stepDur * 7.5, 'sine', 0.035, t);
      }
      if (step % 2 === 0) {
        const arp = st.pad[(step / 2) % st.pad.length] + 12 + (step % 4 === 2 ? 7 : 0);
        this.note(midiToFreq(arp), stepDur * 0.9, 'triangle', 0.045, t);
      }
      if (step % 4 === 2) this.hat(t);
      this.radioNext += stepDur; this.radioStep++;
    }
  }

  note(freq, dur, type, vol, t) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }

  hat(t) {
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.03, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t); src.stop(t + 0.08);
  }
}
