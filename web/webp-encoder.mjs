import webpEncoderModuleFactory from './vendor/@jsquash/webp/codec/enc/webp_enc.js';

const WEBP_ENCODER_DEFAULT_OPTIONS = Object.freeze({
  quality: 75,
  target_size: 0,
  target_PSNR: 0,
  method: 4,
  sns_strength: 50,
  filter_strength: 60,
  filter_sharpness: 0,
  filter_type: 1,
  partitions: 0,
  segments: 4,
  pass: 1,
  show_compressed: 0,
  preprocessing: 0,
  autofilter: 0,
  partition_limit: 0,
  alpha_compression: 1,
  alpha_filtering: 1,
  alpha_quality: 100,
  lossless: 0,
  exact: 0,
  image_hint: 0,
  emulate_jpeg_size: 0,
  thread_level: 0,
  low_memory: 0,
  near_lossless: 100,
  use_delta_palette: 0,
  use_sharp_yuv: 0,
});

let webpEncoderModulePromise = null;

function clampQualityPercent(quality) {
  const value = Number.isFinite(Number(quality)) ? Number(quality) : 0.75;
  return Math.max(1, Math.min(100, Math.round(value <= 1 ? value * 100 : value)));
}

function locateWebpEncoderFile(path) {
  return new URL(`./vendor/@jsquash/webp/codec/enc/${path}`, import.meta.url).href;
}

async function loadWebpEncoderModule() {
  if (!webpEncoderModulePromise) {
    webpEncoderModulePromise = webpEncoderModuleFactory({
      noInitialRun: true,
      locateFile: locateWebpEncoderFile,
    });
  }
  return webpEncoderModulePromise;
}

export function isWebpBytes(bytesLike) {
  const bytes = bytesLike instanceof Uint8Array ? bytesLike : new Uint8Array(bytesLike ?? []);
  return bytes.length >= 12
    && bytes[0] === 0x52
    && bytes[1] === 0x49
    && bytes[2] === 0x46
    && bytes[3] === 0x46
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50;
}

export async function encodeRgbaToWebp(imageData, quality = 0.75) {
  const width = Number(imageData?.width ?? 0);
  const height = Number(imageData?.height ?? 0);
  const data = imageData?.data;
  if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0) {
    throw new Error('Invalid image dimensions');
  }
  if (!(data instanceof Uint8Array) && !(data instanceof Uint8ClampedArray)) {
    throw new Error('Invalid image pixels');
  }
  const module = await loadWebpEncoderModule();
  const output = module.encode(data, width, height, {
    ...WEBP_ENCODER_DEFAULT_OPTIONS,
    quality: clampQualityPercent(quality),
  });
  if (!output) throw new Error('WebP encoding failed');
  const bytes = output instanceof Uint8Array
    ? new Uint8Array(output)
    : new Uint8Array(output.buffer ?? output);
  if (!isWebpBytes(bytes)) throw new Error('WebP encoder returned invalid bytes');
  return bytes;
}

export async function encodeCanvasToWebp(canvas, quality = 0.75) {
  const ctx = canvas?.getContext?.('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas is unavailable');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return encodeRgbaToWebp(imageData, quality);
}
