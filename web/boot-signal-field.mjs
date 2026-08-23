// Boot-screen signal field — a living teal lattice with roaming flashlights and short "signal" routes,
// ported from web-about/main.js. Pure and context-based so it runs on EITHER the main thread (HTMLCanvas ctx)
// OR inside a worker (OffscreenCanvas ctx) — the caller drives the loop and resize. No requestAnimationFrame
// here (workers don't have it): tick(now) self-gates to ~33fps. English-only (OPSEC): no user-facing text.
// EVERY KNOB DEFAULTS TO THE BOOT SCREEN AS IT SHIPS [OWNER 2026-08-23: "for the nodes, set the defaults to exactly
// what we have on the loading screen now"], so a caller that passes nothing gets today's field, byte for byte. The
// app's Appearance settings pass multipliers around 1: brightness (the dots), runners (how many routes travel at
// once), speed (the hop tempo) and lights (how strongly the two roaming flashlights lift the lattice).
export function createBootSignalField(ctx, {
  reduceMotion = false,
  brightness = 1,
  runners = 1,
  speed = 1,
  lights: lightLevel = 1,
} = {}) {
  const TEAL = '48, 213, 176';
  const TWO_PI = Math.PI * 2;
  const GAP = 38;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : 1));
  const brightnessK = clamp(brightness, 0, 4);
  const runnersK = clamp(runners, 0, 4);
  const lightsK = clamp(lightLevel, 0, 4);
  const AMBIENT = 0.11 * brightnessK;
  const BOOST = 0.34 * brightnessK * lightsK;
  // The hop is a DURATION, so a faster tempo is a SHORTER hop; the trail decays on the same clock, or a fast field
  // would leave permanent tracks and a slow one would go dark between hops.
  const speedK = clamp(speed, 0.1, 4);
  const HOP = 170 / speedK;
  const TAU = 620 / speedK;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  let W = 0; let H = 0; let dpr = 1; let cols = 0; let rows = 0; let ox = 0; let oy = 0; let cx = 0; let cy = 0;
  let lights = [];
  const signals = [];
  let last = 0; let acc = 0; let gate = 0;

  function sizeLights() {
    const m = Math.min(W, H);
    if (!lights.length) {
      lights = [
        { x: W * 0.30, y: H * 0.34, ang: 0.8, sp: 92 },
        { x: W * 0.72, y: H * 0.66, ang: 3.7, sp: 72 },
      ];
    }
    const radii = [Math.max(240, Math.min(520, m * 0.44)), Math.max(180, Math.min(400, m * 0.30))];
    for (let i = 0; i < lights.length; i += 1) {
      const L = lights[i];
      L.R = radii[i] || radii[radii.length - 1];
      L.r2 = L.R * L.R;
      if (L.x > W) L.x = W;
      if (L.y > H) L.y = H;
    }
  }

  function resize(width, height, pixelRatio) {
    W = width; H = height; dpr = pixelRatio || 1;
    if (!W || !H) return;
    ctx.canvas.width = Math.floor(W * dpr);
    ctx.canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(W / GAP) + 1;
    rows = Math.ceil(H / GAP) + 1;
    ox = (W - (cols - 1) * GAP) / 2;
    oy = (H - (rows - 1) * GAP) / 2;
    cx = W / 2; cy = H / 2;
    sizeLights();
  }

  const nx = (c) => ox + c * GAP;
  const ny = (r) => oy + r * GAP;

  function edgeFade(x, y) {
    const dx = (x - cx) / (W * 0.5);
    const dy = (y - cy) / (H * 0.5);
    const d = Math.min(1, Math.sqrt(dx * dx + dy * dy));
    return 1 - 0.32 * d;
  }
  function lightAt(x, y) {
    let b = 0;
    for (let i = 0; i < lights.length; i += 1) {
      const L = lights[i];
      const ddx = x - L.x; const ddy = y - L.y;
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 < L.r2) { let f = 1 - d2 / L.r2; f *= f; if (f > b) b = f; }
    }
    return b;
  }
  function drawDots() {
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        const x = nx(c); const y = ny(r);
        const lb = lightAt(x, y);
        const a = (AMBIENT + BOOST * lb) * edgeFade(x, y);
        ctx.beginPath();
        ctx.arc(x, y, 1.3 + 1.1 * lb, 0, TWO_PI);
        ctx.fillStyle = `rgba(${TEAL},${a.toFixed(3)})`;
        ctx.fill();
      }
    }
  }
  function updateLights(dt) {
    const s = dt / 1000;
    for (let i = 0; i < lights.length; i += 1) {
      const L = lights[i];
      L.ang += (Math.random() - 0.5) * 1.4 * s;
      L.x += Math.cos(L.ang) * L.sp * s;
      L.y += Math.sin(L.ang) * L.sp * s;
      if (L.x < 0) { L.x = 0; L.ang = Math.PI - L.ang; } else if (L.x > W) { L.x = W; L.ang = Math.PI - L.ang; }
      if (L.y < 0) { L.y = 0; L.ang = -L.ang; } else if (L.y > H) { L.y = H; L.ang = -L.ang; }
    }
  }
  // The count follows the AREA (a phone gets 12, a desktop 24), scaled by the caller's runners knob — so the default
  // is exactly the shipped field on every screen size, and the setting reads as "more/fewer than usual".
  const maxSignals = () => Math.max(0, Math.round(Math.min(24, Math.max(12, Math.round((W * H) / 26000))) * runnersK));
  function spawn() {
    const path = [{ c: Math.floor(Math.random() * cols), r: Math.floor(Math.random() * rows) }];
    const len = 6 + Math.floor(Math.random() * 7);
    let prev = null;
    for (let i = 0; i < len; i += 1) {
      const cur = path[path.length - 1];
      const cand = [];
      for (let d = 0; d < DIRS.length; d += 1) {
        const nc = cur.c + DIRS[d][0]; const nr = cur.r + DIRS[d][1];
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        if (prev && nc === prev.c && nr === prev.r) continue;
        cand.push({ c: nc, r: nr });
      }
      if (!cand.length) break;
      path.push(cand[Math.floor(Math.random() * cand.length)]);
      prev = cur;
    }
    if (path.length >= 2) signals.push({ path, t: 0 });
  }
  function strokeEdge(x0, y0, x1, y1, a) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = `rgba(${TEAL},${a.toFixed(3)})`;
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }
  function litNode(x, y, inten, v) {
    // No shadowBlur — the single most expensive per-frame op; a brighter cyan fill reads the same.
    ctx.beginPath();
    ctx.arc(x, y, 1.4 + 2.2 * inten, 0, TWO_PI);
    ctx.fillStyle = inten > 0.55
      ? `rgba(210, 255, 244,${(0.9 * inten * v).toFixed(3)})`
      : `rgba(${TEAL},${(0.85 * inten * v).toFixed(3)})`;
    ctx.fill();
  }
  function drawSignals(dt) {
    for (let s = signals.length - 1; s >= 0; s -= 1) {
      const sig = signals[s];
      sig.t += dt;
      const prog = sig.t / HOP;
      const hi = Math.floor(prog);
      const n = sig.path.length;
      const top = Math.min(hi, n - 1);
      for (let i = 0; i <= top; i += 1) {
        const since = (prog - i) * HOP;
        const inten = Math.exp(-since / TAU);
        if (inten < 0.02) continue;
        const p = sig.path[i];
        const x = nx(p.c); const y = ny(p.r); const v = edgeFade(x, y);
        if (i > 0) { const pp = sig.path[i - 1]; strokeEdge(nx(pp.c), ny(pp.r), x, y, 0.5 * inten * v); }
        litNode(x, y, inten, v);
      }
      if (hi < n - 1) {
        const a = sig.path[hi]; const b = sig.path[hi + 1];
        const f = prog - hi;
        const axp = nx(a.c); const ayp = ny(a.r); const bx = nx(b.c); const by = ny(b.r);
        strokeEdge(axp, ayp, axp + (bx - axp) * f, ayp + (by - ayp) * f, 0.55 * edgeFade(axp, ayp));
      }
      if (prog > (n - 1) + (TAU * 3) / HOP) signals.splice(s, 1);
    }
  }
  function paintOnce() {
    if (!W || !H) return;
    ctx.clearRect(0, 0, W, H);
    drawDots();
    drawSignals(0);
  }
  function start() {
    if (reduceMotion) { paintOnce(); return; }
    for (let i = 0; i < maxSignals(); i += 1) { spawn(); if (signals.length) signals[signals.length - 1].t = Math.random() * HOP * 4; }
    paintOnce();
  }
  // Self-gating: call as often as you like; it advances at most ~every 30ms.
  function tick(now) {
    if (reduceMotion || !W || !H) return;
    const dt = last ? Math.min(now - last, 60) : 16;
    last = now;
    gate += dt;
    if (gate < 30) return;
    updateLights(gate);
    ctx.clearRect(0, 0, W, H);
    drawDots();
    acc += gate;
    if (acc > 240 && signals.length < maxSignals()) { spawn(); acc = 0; }
    drawSignals(gate);
    gate = 0;
  }

  return { resize, start, tick, paintOnce };
}
