import { createBootSignalField } from './boot-signal-field.mjs?v=16';

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
    if (data.patternUrl) {
      Promise.resolve(data.patternUrl)
        .then((url) => { const [head, body] = String(url).split(','); const mime = /^data:([^;]+)/.exec(head)?.[1] ?? 'image/png'; const bin = atob(body); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i); return new Blob([bytes], { type: mime }); })
        .then((blob) => createImageBitmap(blob))
        .then((bitmap) => { if (field) { field.setMark(bitmap); field.paintOnce(); } })
        .catch(() => { });
    }
  } else if (data.type === 'mark' && field) {
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
