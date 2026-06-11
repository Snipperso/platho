import { beginCell, Cell, Dictionary } from '@ton/core';
import { createHash } from 'crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ARTIFACTS_DIR = join(process.cwd(), 'artifacts');
const OUTPUT_PATH = join(ARTIFACTS_DIR, 'ath_metadata_content.json');
const DRAFT_INPUT_PATH = join(ARTIFACTS_DIR, 'mainnet_ath_master_derivation_input.json');

const ONCHAIN_CONTENT_PREFIX = 0x00;
const SNAKE_PREFIX = 0x00;
const DEFAULT_DEPLOYMENT_ID = 'platho-mainnet-20260610-clean-06';

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
  name: 'Platho ATH',
  symbol: 'ATH',
  decimals: '9',
  description: 'Utility token of the Platho communication protocol.',
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
  const bytes = Buffer.from(value, 'utf8');
  return beginCell()
    .storeUint(SNAKE_PREFIX, 8)
    .storeBuffer(bytes)
    .endCell();
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
