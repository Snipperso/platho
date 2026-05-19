import {
  openEncryptedPrivateCapsule,
  verifyEncryptedPrivateCapsule,
  verifySignedPublicKeyBundle,
} from './crypto/platho-crypto.mjs';

export const PLATHO_TRANSPORT_VERSION = 1;

export const PLATHO_TRANSPORT_KIND = Object.freeze({
  PUBLIC_BUNDLE: 'platho.public-bundle.v1',
  PRIVATE_CAPSULE: 'platho.private-capsule.v1',
});

const MAX_TRANSPORT_JSON_BYTES = 2 * 1024 * 1024;

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value;
}

function assertString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

function optionalString(value, name) {
  if (value === null || value === undefined) return null;
  return assertString(value, name);
}

function nowIso(options) {
  return options.createdAt ?? new Date().toISOString();
}

function safeClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertTransportHeader(pkg, kind) {
  assertObject(pkg, 'transport package');
  if (pkg.version !== PLATHO_TRANSPORT_VERSION) {
    throw new Error('Unsupported Platho transport package version');
  }
  if (pkg.kind !== kind) {
    throw new Error(`Expected ${kind} transport package`);
  }
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
}

export function serializeTransportPackage(pkg) {
  assertObject(pkg, 'transport package');
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

export function serializeCanonicalTransportPackage(pkg) {
  assertObject(pkg, 'transport package');
  return `${stableStringify(pkg)}\n`;
}

export function parseTransportPackage(text, options = {}) {
  if (typeof text !== 'string') throw new TypeError('Transport package text must be a string');
  const maxBytes = options.maxBytes ?? MAX_TRANSPORT_JSON_BYTES;
  if (new TextEncoder().encode(text).length > maxBytes) {
    throw new Error('Transport package is too large');
  }
  try {
    return assertObject(JSON.parse(text), 'transport package');
  } catch (error) {
    if (error.message?.includes('transport package')) throw error;
    throw new Error('Transport package is not valid JSON');
  }
}

export function classifyTransportPackage(pkg) {
  assertObject(pkg, 'transport package');
  if (pkg.kind === PLATHO_TRANSPORT_KIND.PUBLIC_BUNDLE) return pkg.kind;
  if (pkg.kind === PLATHO_TRANSPORT_KIND.PRIVATE_CAPSULE) return pkg.kind;
  throw new Error('Unknown Platho transport package kind');
}

export function createPublicBundleTransportPackage(signedBundle, options = {}) {
  assertObject(signedBundle, 'signed public key bundle');
  const bundle = assertObject(signedBundle.bundle, 'signed public key bundle payload');
  return {
    version: PLATHO_TRANSPORT_VERSION,
    kind: PLATHO_TRANSPORT_KIND.PUBLIC_BUNDLE,
    createdAt: nowIso(options),
    label: optionalString(options.label, 'label') ?? null,
    bundleKeyId: assertString(bundle.keyId, 'bundle.keyId'),
    suite: assertString(bundle.suite, 'bundle.suite'),
    signedBundle: safeClone(signedBundle),
  };
}

export async function readPublicBundleTransportPackage(pkg, options = {}) {
  assertTransportHeader(pkg, PLATHO_TRANSPORT_KIND.PUBLIC_BUNDLE);
  const signedBundle = assertObject(pkg.signedBundle, 'signed public key bundle');
  const verifiedBundle = await verifySignedPublicKeyBundle(signedBundle, options);
  if (pkg.bundleKeyId !== verifiedBundle.bundle.keyId) {
    throw new Error('Transport public bundle key id mismatch');
  }
  if (pkg.suite !== verifiedBundle.bundle.suite) {
    throw new Error('Transport public bundle suite mismatch');
  }
  return {
    package: pkg,
    signedBundle,
    verifiedBundle,
  };
}

export function createPrivateCapsuleTransportPackage(capsule, options = {}) {
  assertObject(capsule, 'private capsule');
  const header0 = assertObject(capsule.header0, 'private capsule header0');
  const header1 = assertObject(capsule.header1, 'private capsule header1');
  return {
    version: PLATHO_TRANSPORT_VERSION,
    kind: PLATHO_TRANSPORT_KIND.PRIVATE_CAPSULE,
    createdAt: nowIso(options),
    label: optionalString(options.label, 'label') ?? null,
    capsuleId: assertString(capsule.id, 'capsule.id'),
    threadId: optionalString(header1.threadId, 'capsule.header1.threadId'),
    suite: assertString(header0.suite, 'capsule.header0.suite'),
    senderKeyId: assertString(header0.senderKeyId, 'capsule.header0.senderKeyId'),
    recipientKeyId: assertString(header0.recipientKeyId, 'capsule.header0.recipientKeyId'),
    expiresAt: header1.expiresAt,
    capsule: safeClone(capsule),
  };
}

export async function readPrivateCapsuleTransportPackage(pkg, options = {}) {
  assertTransportHeader(pkg, PLATHO_TRANSPORT_KIND.PRIVATE_CAPSULE);
  const verified = await verifyEncryptedPrivateCapsule(assertObject(pkg.capsule, 'private capsule'), options);
  const capsule = verified.capsule;
  if (pkg.capsuleId !== capsule.id) throw new Error('Transport capsule id mismatch');
  if (pkg.threadId !== (capsule.header1.threadId ?? null)) throw new Error('Transport capsule thread mismatch');
  if (pkg.suite !== capsule.header0.suite) throw new Error('Transport capsule suite mismatch');
  if (pkg.senderKeyId !== capsule.header0.senderKeyId) throw new Error('Transport capsule sender mismatch');
  if (pkg.recipientKeyId !== capsule.header0.recipientKeyId) throw new Error('Transport capsule recipient mismatch');
  if (pkg.expiresAt !== capsule.header1.expiresAt) throw new Error('Transport capsule expiry mismatch');
  return {
    package: pkg,
    capsule,
    publish: verified.publish,
  };
}

export async function openPrivateCapsuleTransportPackage(pkg, recipientKeyPair, options = {}) {
  const verified = await readPrivateCapsuleTransportPackage(pkg, options);
  const opened = await openEncryptedPrivateCapsule(verified.capsule, recipientKeyPair, options);
  return {
    ...opened,
    package: pkg,
  };
}

export function createMemoryTransportStore(seed = {}) {
  const state = {
    peers: [...(seed.peers ?? [])],
    outbox: [...(seed.outbox ?? [])],
    inbox: [...(seed.inbox ?? [])],
  };
  return {
    read() {
      return safeClone(state);
    },
    write(next) {
      state.peers = [...(next.peers ?? [])];
      state.outbox = [...(next.outbox ?? [])];
      state.inbox = [...(next.inbox ?? [])];
      return this.read();
    },
  };
}
