// Solmar Bay — small helpers: seeded random, procedural canvas textures and
// runtime-drawn NPC portraits. Nothing here loads a file or the network.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2d = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function makeCanvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}

// Building facade: lit windows on a dusk gradient, with a neon roof trim line.
export function buildingTexture(rng, base, trim) {
  return makeCanvas(128, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, base); grad.addColorStop(1, '#1a1226');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    const cols = 6, rows = 14, cw = w / cols, ch = h / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const lit = rng() < 0.55;
        g.fillStyle = lit ? (rng() < 0.75 ? '#ffd166' : '#7df9ff') : '#0c0a18';
        g.globalAlpha = lit ? 0.95 : 1;
        g.fillRect(x * cw + 3, y * ch + 4, cw - 6, ch - 8);
      }
    }
    g.globalAlpha = 1;
    g.fillStyle = trim; g.fillRect(0, 0, w, 5);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 40; i++) g.fillRect(rng() * w, rng() * h, 2, 2);
  });
}

// Asphalt with a dashed centre line and worn edges.
export function roadTexture() {
  return makeCanvas(128, 128, (g, w, h) => {
    g.fillStyle = '#23262e'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 260; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    g.fillStyle = '#e8c33a';
    g.fillRect(w / 2 - 2, 0, 4, 26); g.fillRect(w / 2 - 2, 64, 4, 26);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillRect(2, 0, 3, h); g.fillRect(w - 5, 0, 3, h);
  });
}

export function sandTexture() {
  return makeCanvas(128, 128, (g, w, h) => {
    g.fillStyle = '#e0b96f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,235,180,0.5)' : 'rgba(160,120,60,0.35)';
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(0, 0, w, 4);
  });
}

export function waterTexture() {
  return makeCanvas(256, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#0e7fa8'); grad.addColorStop(0.5, '#0a5f8a'); grad.addColorStop(1, '#0e8fb8');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5;
    for (let i = 0; i < 26; i++) {
      const y = Math.random() * h;
      g.beginPath();
      g.moveTo(Math.random() * w, y);
      g.bezierCurveTo(w * 0.3, y - 6, w * 0.6, y + 6, w, y - 3);
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 60; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 1);
  });
}

// Neon sign board with text, drawn once and reused as an emissive texture.
export function neonSignTexture(text, color, bg) {
  return makeCanvas(512, 128, (g, w, h) => {
    g.fillStyle = bg || '#12081f'; g.fillRect(0, 0, w, h);
    g.strokeStyle = color; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    g.font = '900 56px Verdana, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 22;
    g.fillStyle = color; g.fillText(text, w / 2, h / 2 + 2);
    g.shadowBlur = 0; g.fillStyle = '#ffffff';
    g.font = '900 54px Verdana, sans-serif';
    g.fillText(text, w / 2, h / 2 + 2);
  });
}

// Stylised NPC portrait (face, hair, eyes, smile) as a data URL for HUD cards.
export function makePortrait(npc) {
  const c = makeCanvas(96, 96, (g) => {
    g.fillStyle = npc.accent; g.fillRect(0, 0, 96, 96);
    g.fillStyle = '#1b1430';
    g.beginPath(); g.arc(48, 50, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = npc.skin;
    g.beginPath(); g.arc(48, 52, 27, 0, Math.PI * 2); g.fill();
    g.fillStyle = npc.hair;
    if (npc.hairStyle === 'bun') {
      g.beginPath(); g.arc(48, 28, 16, Math.PI, 0); g.fill();
      g.beginPath(); g.arc(48, 16, 9, 0, Math.PI * 2); g.fill();
    } else if (npc.hairStyle === 'long') {
      g.fillRect(21, 24, 54, 40);
      g.beginPath(); g.arc(48, 30, 26, Math.PI, 0); g.fill();
    } else {
      g.beginPath(); g.arc(48, 30, 25, Math.PI * 1.05, Math.PI * 1.95); g.fill();
      g.fillRect(23, 28, 50, 8);
    }
    g.fillStyle = '#101018';
    g.beginPath(); g.arc(38, 50, 3.4, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(58, 50, 3.4, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#7a3b2e'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.arc(48, 62, 9, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.beginPath(); g.arc(48, 88, 26, Math.PI, 0); g.fill();
  });
  return c.toDataURL('image/png');
}
