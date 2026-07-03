// Boot-screen signal-field worker (module worker). Runs the lattice animation OFF the main thread on an
// OffscreenCanvas, so it stays smooth even while the main thread is blocked by the synchronous post-unlock
// crypto. Workers have no requestAnimationFrame, so the loop is a self-scheduling setTimeout at ~33fps.
// English-only (OPSEC); no user-facing text.
import { createBootSignalField } from './boot-signal-field.mjs?v=1';

let field = null;
let timer = null;
let dpr = 1;
let reduceMotion = false;

function loop() {
  if (!field) return;
  field.tick(performance.now());
  timer = setTimeout(loop, 30);
}

self.onmessage = (event) => {
  const data = event.data || {};
  if (data.type === 'init') {
    dpr = data.dpr || 1;
    reduceMotion = Boolean(data.reduceMotion);
    const ctx = data.canvas.getContext('2d');
    if (!ctx) return;
    field = createBootSignalField(ctx, { reduceMotion });
    field.resize(data.width, data.height, dpr);
    field.start();
    if (!reduceMotion) loop();
  } else if (data.type === 'resize' && field) {
    field.resize(data.width, data.height, dpr);
    field.paintOnce();
  } else if (data.type === 'stop') {
    if (timer) { clearTimeout(timer); timer = null; }
    field = null;
    self.close();
  }
};
