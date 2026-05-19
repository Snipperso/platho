import qrcode from './vendor/qrcode-generator/qrcode.js';
import {
  parseTransportPackage,
  serializeTransportPackage,
} from './no-backend-transport.mjs';

export const TRANSPORT_QR_MAX_BYTES = 2950;

function textBytes(text) {
  return new TextEncoder().encode(text).length;
}

function assertPackage(pkg) {
  if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) {
    throw new Error('Transport package must be an object');
  }
  return pkg;
}

export function createTransportSharePayload(pkg) {
  const text = serializeTransportPackage(assertPackage(pkg));
  return {
    text,
    bytes: textBytes(text),
    filename: transportShareFilename(pkg),
    mimeType: 'application/json',
  };
}

export function transportShareFilename(pkg) {
  assertPackage(pkg);
  const rawId = pkg.capsuleId ?? pkg.bundleKeyId ?? 'package';
  const id = String(rawId).replace(/[^a-z0-9_-]/gi, '').slice(0, 24) || 'package';
  const label = pkg.kind === 'platho.public-bundle.v1'
    ? 'key'
    : pkg.kind === 'platho.private-capsule.v1'
      ? 'capsule'
      : 'package';
  return `platho-${label}-${id}.platho.json`;
}

export function canRenderTransportQr(pkg, options = {}) {
  const payload = createTransportSharePayload(pkg);
  return payload.bytes <= (options.maxBytes ?? TRANSPORT_QR_MAX_BYTES);
}

export function createTransportQrSvg(pkg, options = {}) {
  const payload = createTransportSharePayload(pkg);
  const maxBytes = options.maxBytes ?? TRANSPORT_QR_MAX_BYTES;
  if (payload.bytes > maxBytes) {
    throw new Error(`Transport package is too large for QR (${payload.bytes} bytes)`);
  }
  const qr = qrcode(0, options.errorCorrectionLevel ?? 'L');
  qr.addData(payload.text, 'Byte');
  qr.make();
  return {
    svg: qr.createSvgTag(options.cellSize ?? 4, options.margin ?? 8, 'Platho transport package', 'Platho transport'),
    moduleCount: qr.getModuleCount(),
    bytes: payload.bytes,
    text: payload.text,
  };
}

export function parseTransportShareText(text, options = {}) {
  return parseTransportPackage(text, options);
}
