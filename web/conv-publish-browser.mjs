
import { beginCell, computeCellHashAndDepth } from './pwa-contract-transactions.mjs?v=59';
import { recordShardAddressBytesFor, recordShardStateInitFor, rawAddress } from './shard-address.mjs?v=47';
import { generationForEpochAt, CUTOVER_EPOCH } from './cutover-epoch.mjs?v=7';
import { ed25519 } from './vendor/@noble/curves/ed25519.js';

const RS_FRAME_DOMAIN = 0x52534643n;
const RS_WRITE_DOMAIN = 0x52535744n;
const CAPSULE_PUBLISH_OPCODE = 0x52535031n;

const bytesToBig = (b) => { let x = 0n; for (const byte of b) x = (x << 8n) | BigInt(byte & 0xff); return x; };

async function cellHashBig(cell) {
  const { hash } = await computeCellHashAndDepth(cell);
  return bytesToBig(hash);
}

export async function convFrameCommit(header0, header1, body) {
  const h0 = await cellHashBig(header0);
  const h1 = await cellHashBig(header1);
  const bh = await cellHashBig(body);
  const cell = beginCell()
    .uint(RS_FRAME_DOMAIN, 32, 'RS_FRAME_DOMAIN')
    .uint(h0, 256, 'header0 hash')
    .uint(h1, 256, 'header1 hash')
    .uint(bh, 256, 'body hash')
    .endCell();
  return cellHashBig(cell);
}

export function buildConvPublishBody({ seq, header0, header1, body, sig }) {
  const sigCell = beginCell().bytesValue(sig, 64, 'sig').endCell();
  const bodySig = beginCell().ref(body, 'body').ref(sigCell, 'sig').endCell();
  return beginCell()
    .uint(CAPSULE_PUBLISH_OPCODE, 32, 'CapsulePublish opcode')
    .uint(BigInt(seq), 64, 'seq')
    .ref(header0, 'header_0')
    .ref(header1, 'header_1')
    .ref(bodySig, 'body+sig sub-cell')
    .endCell();
}

export function convWriteDigestCell({ seq, commit, epoch, boundary = CUTOVER_EPOCH }) {
  if (epoch === undefined || epoch === null) {
    throw new RangeError('convWriteDigestCell: epoch is required — it names the generation the digest is for');
  }
  const cell = beginCell()
    .uint(RS_WRITE_DOMAIN, 32, 'RS_WRITE_DOMAIN')
    .uint(BigInt(seq), 64, 'seq')
    .uint(commit, 256, 'frameCommit');
  if (generationForEpochAt(Number(epoch), boundary) >= 18) cell.uint(BigInt(epoch), 32, 'epoch');
  return cell.endCell();
}

export async function buildConvPublishBrowser({ writePublicKey, writeSecret, sign, seq, epoch, header0, header1, body, value, boundary = CUTOVER_EPOCH }) {
  const commit = await convFrameCommit(header0, header1, body);
  const { hash: digest } = await computeCellHashAndDepth(convWriteDigestCell({ seq, commit, epoch, boundary }));
  if ((writeSecret === undefined) === (sign === undefined)) {
    throw new TypeError('buildConvPublishBrowser needs exactly one of writeSecret or sign');
  }
  const sig = sign === undefined ? ed25519.sign(digest, writeSecret) : await sign(digest);
  if (!(sig instanceof Uint8Array) || sig.length !== 64) throw new TypeError('the signer must return 64 bytes');
  const pubBig = bytesToBig(writePublicKey);
  const generation = generationForEpochAt(Number(epoch), boundary);
  const address = await recordShardAddressBytesFor(generation, pubBig, epoch);
  return {
    to: rawAddress(address),
    addressBytes: address,
    generation,
    value,
    body: buildConvPublishBody({ seq, header0, header1, body, sig }),
    init: recordShardStateInitFor(generation, pubBig, epoch),
    commit,
  };
}
