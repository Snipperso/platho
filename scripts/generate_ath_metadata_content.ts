import { beginCell, Cell, Dictionary } from '@ton/core';
import { createHash } from 'crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ARTIFACTS_DIR = join(process.cwd(), 'artifacts');
const OUTPUT_PATH = join(ARTIFACTS_DIR, 'ath_metadata_content.json');
const DRAFT_INPUT_PATH = join(ARTIFACTS_DIR, 'mainnet_ath_master_derivation_input.json');

const ONCHAIN_CONTENT_PREFIX = 0x00;
const SNAKE_PREFIX = 0x00;
const DEFAULT_DEPLOYMENT_ID = 'platho-mainnet-20260707-clean-15';

function deploymentIdFromEnv(): string {
  const value = process.env.PLATHO_ATH_DEPLOYMENT_ID?.trim();
  if (!value) return DEFAULT_DEPLOYMENT_ID;
  if (!/^[a-z0-9._-]{8,80}$/i.test(value)) {
    throw new Error('PLATHO_ATH_DEPLOYMENT_ID must be 8-80 chars of letters, digits, dot, underscore, or dash');
  }
  return value;
}

function metadataFields(deploymentId = DEFAULT_DEPLOYMENT_ID) {
  return Object.freeze({
  name: 'PLATHO',
  symbol: 'ATH',
  decimals: '9',
  description: "The utility token of Platho — a fully decentralized, post-quantum encrypted messenger that lives entirely on the TON blockchain (no backend, no servers, your keys). Earn ATH as an activity bonus for using the app, and spend it to reduce messaging fees, mint .ath usernames, and attach avatars — all on-chain.\n\nhttps://platho.app",
  image: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iIzBiMGQwZiIvPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDAgNTEyKSBzY2FsZSgxIC0xKSI+PHBhdGggZmlsbD0iIzMwZDViMCIgZmlsbC1ydWxlPSJldmVub2RkIiBkPSJNMTY3LjUgNDMyLjEgTDMzMC41IDQzMi4xIEwzNDYuNSA0MjkuOSBMMzY0LjUgNDI0LjggTDM4MC41IDQxNy43IEwzOTMuNSA0MDkuNiBMNDA0LjUgNDAxLjAgTDQxNi4wIDM4OS41IEw0MjUuOCAzNzYuNSBMNDM1LjkgMzU4LjUgTDQ0MS43IDM0My41IEw0NDUuOSAzMjUuNSBMNDQ2LjkgMjk2LjUgTDQ0NS44IDI4NS41IEw0NDIuOCAyNzEuNSBMNDM1LjcgMjUxLjUgTDQyNS45IDIzMy41IEw0MTYuOSAyMjEuNSBMNDAyLjUgMjA3LjEgTDM4Ny41IDE5Ni4xIEwzNjIuNSAxODQuMSBMMzQ4LjUgMTgwLjEgTDMzNC41IDE3OC4wIEwyMjEuNSAxNzcuMiBMMjIwLjUgNzkuMiBMMTM3LjUgNzkuNCBMMTM3LjIgMTM5LjUgTDE2Ni41IDE0MC4yIEwxNjYuOCAxNzQuNSBMMTM2LjUgMTc1LjEgTDEzNS42IDE3NC41IEwxMzUuNyAxNjMuNSBMMTM0LjUgMTYyLjggTDEwNC4xIDE2My41IEwxMDQuNSAxOTIuNyBMMTM0LjUgMTkyLjkgTDEzNS41IDE5My41IEwxMzUuNCAyMjAuNSBMMTM2LjIgMjIxLjUgTDE2Ni44IDIyMi41IEwxNjYuNSAyNTMuMCBMMTM1LjUgMjUzLjMgTDEzNC41IDIzNS4yIEwxMDUuNSAyMzUuMSBMMTA0LjEgMjM2LjUgTDEwNC4zIDI2NC41IEwxMzQuNSAyNjUuMyBMMTM1LjUgMjkyLjUgTDE5Ny41IDI5Mi43IEwxOTguNCAyOTMuNSBMMTk4LjAgMzIzLjUgTDE2Ni44IDMyNC41IEwxNjcuMyAzNjQuNSBMMTk4LjQgMzY1LjUgTDE5OC4zIDM5NC41IEwxNjYuOSAzOTUuNSBMMTY2LjcgNDMwLjUgTDE2Ny41IDQzMi4xIFogTTEwNC41IDQwNy42IEwxMzQuOSA0MDcuNSBMMTM0LjUgMzc3LjcgTDEwNC41IDM3Ny45IEwxMDQuNSA0MDcuNiBaIE0yMjEuNSAzNzIuMyBMMjIxLjUgMjM3LjIgTDMyMi41IDIzNy4xIEwzMjkuNSAyMzguMSBMMzQyLjUgMjQyLjEgTDM1Mi41IDI0Ny40IEwzNTkuNSAyNTIuOCBMMzY5LjYgMjYzLjUgTDM3Ny4wIDI3NS41IEwzODEuNSAyODguNSBMMzgzLjEgMjk4LjUgTDM4Mi43IDMxNi41IEwzNzkuNyAzMjcuNSBMMzc0LjggMzM4LjUgTDM2OC45IDM0Ny41IEwzNTguNSAzNTcuOSBMMzQ0LjUgMzY2LjcgTDMzMi41IDM3MC44IEwzMjIuNSAzNzIuNCBMMjIxLjUgMzcyLjMgWiBNNjUuNSAzMjQuMyBMOTMuNSAzMjQuMyBMOTMuOSAyOTQuNSBMNjQuOSAyOTQuNSBMNjQuNiAzMjIuNSBMNjUuNSAzMjQuMyBaIi8+PC9nPjwvc3ZnPg==",
    deployment_id: deploymentId,
  });
}

function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function metadataKey(key: string): bigint {
  return BigInt(`0x${sha256Hex(key)}`);
}

function snakeCell(value: string): Cell {
  // TEP-64 snake: 0x00 marker + the UTF-8 bytes, chained across child cells at 127 bytes/cell so large values
  // (e.g. the base64 logo data-URI) don't overflow the 1023-bit cell limit. Short values stay a single cell
  // (bit-identical to the old single-cell form), so name/symbol/decimals/description hashes are unchanged.
  const all = Buffer.concat([Buffer.from([SNAKE_PREFIX]), Buffer.from(value, 'utf8')]);
  const CHUNK = 127;
  const chunks: Buffer[] = [];
  for (let i = 0; i < all.length; i += CHUNK) chunks.push(all.subarray(i, i + CHUNK));
  if (chunks.length === 0) chunks.push(Buffer.from([]));
  let next: Cell | null = null;
  for (let i = chunks.length - 1; i >= 0; i--) {
    const b = beginCell().storeBuffer(chunks[i]);
    if (next) b.storeRef(next);
    next = b.endCell();
  }
  return next!;
}

export function buildAthMetadataContent(deploymentId = DEFAULT_DEPLOYMENT_ID): Cell {
  const dict = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
  for (const [key, value] of Object.entries(metadataFields(deploymentId))) {
    dict.set(metadataKey(key), snakeCell(value));
  }

  return beginCell()
    .storeUint(ONCHAIN_CONTENT_PREFIX, 8)
    .storeDict(dict)
    .endCell();
}

export function buildAthMetadataArtifact(deploymentId = DEFAULT_DEPLOYMENT_ID) {
  const content = buildAthMetadataContent(deploymentId);
  const boc = content.toBoc();
  const contentBocBase64 = boc.toString('base64');
  const contentHashHex = content.hash().toString('hex');
  const bocSha256Hex = sha256Hex(boc);

  return {
    document: 'PLATHO.V1.ATH_METADATA_CONTENT',
    format: 'TEP64_ONCHAIN_METADATA',
    generated_at: 'DETERMINISTIC_ARTIFACT',
    fields: metadataFields(deploymentId),
    contentBocBase64,
    contentHashHex,
    bocSha256Hex,
    note: 'Final ATHMaster StateInit also depends on final treasury owner address. deployment_id intentionally separates a clean one-shot ATHMaster deployment from abandoned earlier packets using the same treasury owner.',
  };
}

function buildDraftDerivationInput(contentBocBase64: string, contentHashHex: string) {
  let existing: any = null;
  try {
    existing = JSON.parse(readFileSync(DRAFT_INPUT_PATH, 'utf8'));
  } catch {
    existing = null;
  }
  const preserveFinal =
    existing?.document === 'PLATHO.V1.MAINNET_ATH_MASTER_DERIVATION_INPUT'
    && existing?.network === 'mainnet'
    && typeof existing?.treasuryOwnerAddress === 'string'
    && !existing.treasuryOwnerAddress.includes('REQUIRED_')
    && typeof existing?.proofRefs?.treasuryOwnerProof === 'string'
    && typeof existing?.proofRefs?.athMasterBuildArtifact === 'string';

  return {
    document: 'PLATHO.V1.MAINNET_ATH_MASTER_DERIVATION_INPUT',
    network: 'mainnet',
    status: preserveFinal ? existing.status : 'DRAFT_MAINNET_ATH_MASTER_INPUT',
    treasuryOwnerAddress: preserveFinal ? existing.treasuryOwnerAddress : 'REQUIRED_FINAL_MAINNET_ATH_TREASURY_OWNER_ADDRESS',
    contentBocBase64,
    proofRefs: {
      treasuryOwnerProof: preserveFinal ? existing.proofRefs.treasuryOwnerProof : 'required: immutable treasury owner proof path/hash',
      contentCellProof: `artifacts/ath_metadata_content.json#contentHashHex=${contentHashHex}`,
      athMasterBuildArtifact: preserveFinal ? existing.proofRefs.athMasterBuildArtifact : 'required: immutable ATHMaster build artifact path/hash',
    },
  };
}

if (require.main === module) {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const artifact = buildAthMetadataArtifact(deploymentIdFromEnv());
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(artifact, null, 2)}\n`);
  writeFileSync(
    DRAFT_INPUT_PATH,
    `${JSON.stringify(buildDraftDerivationInput(artifact.contentBocBase64, artifact.contentHashHex), null, 2)}\n`,
  );
  console.log(JSON.stringify({
    status: 'ATH_METADATA_CONTENT_GENERATED',
    output: OUTPUT_PATH,
    draftInput: DRAFT_INPUT_PATH,
    contentHashHex: artifact.contentHashHex,
    bocSha256Hex: artifact.bocSha256Hex,
  }, null, 2));
}
