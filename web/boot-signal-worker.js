// Boot-screen signal-field worker (module worker). Runs the lattice animation OFF the main thread on an
// OffscreenCanvas, so it stays smooth even while the main thread is blocked by the synchronous post-unlock
// crypto. Workers have no requestAnimationFrame, so the loop is a self-scheduling setTimeout at ~33fps.
// English-only (OPSEC); no user-facing text.
import { createBootSignalField } from './boot-signal-field.mjs?v=14';

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
    // The caller's Appearance settings ride in with the canvas; anything it omits falls back to the shipped field.
    field = createBootSignalField(ctx, {
      reduceMotion,
      brightness: data.brightness,
      runners: data.runners,
      speed: data.speed,
      lights: data.lights,
      ink: data.ink,
    });
    field.resize(data.width, data.height, dpr);
    field.start();
    if (!reduceMotion) loop();
    // THE MARK IS DECODED HERE, not handed over ready. Building an ImageBitmap needs a fetch and a decode, and on
    // the main thread during boot both starve behind the synchronous crypto — measured: the mark arrived after the
    // loading screen was already leaving. A data URL is a plain string, so it rides in with everything else and
    // this thread, which is busy with nothing, does the work.
    if (data.patternUrl) {
      fetch(data.patternUrl)
        .then((response) => response.blob())
        .then((blob) => createImageBitmap(blob))
        .then((bitmap) => { if (field) { field.setMark(bitmap); field.paintOnce(); } })
        .catch(() => { /* no pattern: the dots are the shipped field */ });
    }
  } else if (data.type === 'mark' && field) {
    // AN ImageBitmap, never a canvas: a canvas cannot be structured-cloned, and the main thread must not even try
    // — a throw there abandons the worker and drops the boot field onto the thread this worker exists to spare.
    field.setMark(data.bitmap || null);
    field.paintOnce();
  } else if (data.type === 'resize' && field) {
    field.resize(data.width, data.height, dpr);
    field.paintOnce();
  } else if (data.type === 'stop') {
    if (timer) { clearTimeout(timer); timer = null; }
    field = null;
    self.close();
  }
};
