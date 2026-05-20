import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { keyPairFromSeed, sign } from '@ton/crypto';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import {
  Vault,
  DepositTon,
  SetSession,
  TopUpMessageBudget,
} from '../build/Vault/Vault_Vault';

const GENESIS_HASH = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
const MAGIC = 0x504c5352n;
const VERSION = 1n;
const OP_PRIVATE = 0x686694C6n;
const OP_PUBLIC = 0x900EC906n;
const KIND_PRIVATE = 1n;
const KIND_PUBLIC = 2n;
const SIZE_STANDARD = 1n;
const SUITE_PUBLIC = 0n;
const SUITE_CLASSICAL = 1n;
const INVALID_SESSION_REQUEST_CHARGE_TON = 6_000_000n;

const BODY_HASH = 0x1111000000000000000000000000000000000000000000000000000000000001n;
const HEADER0 = 0x2222000000000000000000000000000000000000000000000000000000000002n;
const HEADER1 = 0x3333000000000000000000000000000000000000000000000000000000000003n;

function bufToBigInt(buf: Buffer): bigint {
  return BigInt('0x' + buf.toString('hex'));
}

function bigintToBuffer(v: bigint, bytes = 32): Buffer {
  return Buffer.from(v.toString(16).padStart(bytes * 2, '0'), 'hex');
}

async function setup() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const user = await blockchain.treasury('vault-ext-user');
  const athWallet = await blockchain.treasury('vault-ath-wallet');
  const capsuleHub = await blockchain.treasury('capsule-hub');

  const init = await Vault.init(athWallet.address, athWallet.address, capsuleHub.address, GENESIS_HASH, true, true, 0n);
  const address = contractAddress(0, init);

  await blockchain.setShardAccount(
    address,
    createShardAccount({
      address,
      code: init.code,
      data: init.data,
      balance: toNano('1'),
      workchain: address.workChain,
    }),
  );

  const vault = blockchain.openContract(new Vault(address, init));
  return { blockchain, vault, user, capsuleHub };
}

async function fundSession(vault: any, user: any, sessionPubkey: bigint, expiresAt: number, budget = toNano('0.2')) {
  await vault.send(user.getSender(), { value: toNano('1.1') }, {
    $$type: 'DepositTon',
    amount: toNano('1'),
  } as DepositTon);

  await vault.send(user.getSender(), { value: toNano('0.1') }, {
    $$type: 'SetSession',
    session_pubkey: sessionPubkey,
    expires_at: BigInt(expiresAt),
  } as SetSession);

  await vault.send(user.getSender(), { value: toNano('0.1') }, {
    $$type: 'TopUpMessageBudget',
    amount: budget,
  } as TopUpMessageBudget);
}

async function fundSessionWithoutBudget(vault: any, user: any, sessionPubkey: bigint, expiresAt: number) {
  await vault.send(user.getSender(), { value: toNano('1.1') }, {
    $$type: 'DepositTon',
    amount: toNano('1'),
  } as DepositTon);

  await vault.send(user.getSender(), { value: toNano('0.1') }, {
    $$type: 'SetSession',
    session_pubkey: sessionPubkey,
    expires_at: BigInt(expiresAt),
  } as SetSession);
}

async function buildExternalRequest(params: {
  vault: any;
  op: bigint;
  owner: Address;
  sessionId: bigint;
  nonce: bigint;
  validUntil: bigint;
  publishKind: bigint;
  sizeClass: bigint;
  cryptoSuite: bigint;
  maxCharge: bigint;
  bodyHash?: bigint;
  header0?: bigint;
  header1?: bigint;
  secretKey: Buffer;
  mutateSignature?: boolean;
  signatureTrailingData?: 'bits' | 'ref';
}) {
  const bodyHash = params.bodyHash ?? BODY_HASH;
  const header0 = params.header0 ?? HEADER0;
  const header1 = params.header1 ?? HEADER1;

  const sigHash = await params.vault.getGetSessionPublishHash(
    params.op,
    params.owner,
    params.sessionId,
    params.nonce,
    params.validUntil,
    params.publishKind,
    params.sizeClass,
    params.cryptoSuite,
    params.maxCharge,
    bodyHash,
    header0,
    header1,
  );

  const signature = sign(bigintToBuffer(sigHash), params.secretKey);
  if (params.mutateSignature) {
    signature[0] ^= 0xff;
  }

  const hashesRef = beginCell()
    .storeUint(bodyHash, 256)
    .storeUint(header0, 256)
    .storeUint(header1, 256)
    .endCell();

  const signatureBuilder = beginCell().storeBuffer(signature);
  if (params.signatureTrailingData === 'bits') {
    signatureBuilder.storeUint(1n, 1);
  } else if (params.signatureTrailingData === 'ref') {
    signatureBuilder.storeRef(beginCell().storeUint(1n, 1).endCell());
  }
  const signatureRef = signatureBuilder.endCell();

  return beginCell()
    .storeUint(MAGIC, 32)
    .storeUint(VERSION, 8)
    .storeUint(params.op, 32)
    .storeAddress(params.owner)
    .storeUint(params.sessionId, 256)
    .storeUint(params.nonce, 64)
    .storeUint(params.validUntil, 32)
    .storeUint(params.publishKind, 8)
    .storeUint(params.sizeClass, 8)
    .storeUint(params.cryptoSuite, 8)
    .storeUint(params.maxCharge, 128)
    .storeRef(hashesRef)
    .storeRef(signatureRef)
    .endCell()
    .beginParse();
}

async function tryExternal(vault: any, external: any) {
  try {
    await vault.sendExternal(external);
  } catch (_e) {
    // Sandbox throws when an external message is not accepted before acceptMessage().
  }
}

describe('Vault milestone 6: external session pre-accept gate and pending publish', () => {
  it('VAULT-M6-EXT-01: valid signed request consumes nonce, debits max_charge, and creates pending publish when no ACK exists yet', async () => {
    const { vault, user, blockchain } = await setup();
    const kp = keyPairFromSeed(Buffer.alloc(32, 7));
    const pub = bufToBigInt(kp.publicKey);
    const now = blockchain.now ?? 0;

    await fundSession(vault, user, pub, now + 1000);
    const session = await vault.getGetSession(user.address);
    const maxCharge = await vault.getGetCanonicalSessionMaxCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);
    const before = await vault.getGetUser(user.address);

    const external = await buildExternalRequest({
      vault,
      op: OP_PRIVATE,
      owner: user.address,
      sessionId: session.session_id,
      nonce: 0n,
      validUntil: BigInt(now + 100),
      publishKind: KIND_PRIVATE,
      sizeClass: SIZE_STANDARD,
      cryptoSuite: SUITE_CLASSICAL,
      maxCharge,
      secretKey: kp.secretKey,
    });

    await vault.sendExternal(external);

    const afterUser = await vault.getGetUser(user.address);
    const afterSession = await vault.getGetSession(user.address);
    const afterGlobal = await vault.getGetGlobal();
    expect(afterSession.nonce).toBe(1n);
    expect(before.message_budget_ton - afterUser.message_budget_ton).toBe(maxCharge);
    expect(afterGlobal.pending_publish_count).toBe(1n);
  });

  it('VAULT-EXT-01: invalid signature is rejected before nonce/budget mutation', async () => {
    const { vault, user, blockchain } = await setup();
    const kp = keyPairFromSeed(Buffer.alloc(32, 8));
    const pub = bufToBigInt(kp.publicKey);
    const now = blockchain.now ?? 0;

    await fundSession(vault, user, pub, now + 1000);
    const session = await vault.getGetSession(user.address);
    const maxCharge = await vault.getGetCanonicalSessionMaxCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);
    const before = await vault.getGetUser(user.address);

    const external = await buildExternalRequest({
      vault,
      op: OP_PRIVATE,
      owner: user.address,
      sessionId: session.session_id,
      nonce: 0n,
      validUntil: BigInt(now + 100),
      publishKind: KIND_PRIVATE,
      sizeClass: SIZE_STANDARD,
      cryptoSuite: SUITE_CLASSICAL,
      maxCharge,
      secretKey: kp.secretKey,
      mutateSignature: true,
    });

    await tryExternal(vault, external);

    const afterUser = await vault.getGetUser(user.address);
    const afterSession = await vault.getGetSession(user.address);
    expect(afterSession.nonce).toBe(0n);
    expect(afterUser.message_budget_ton).toBe(before.message_budget_ton);
  });

  it('VAULT-EXT-CANONICAL-SIG-01: signatureRef with trailing bits or refs is rejected before mutation', async () => {
    const { vault, user, blockchain } = await setup();
    const kp = keyPairFromSeed(Buffer.alloc(32, 28));
    const pub = bufToBigInt(kp.publicKey);
    const now = blockchain.now ?? 0;

    await fundSession(vault, user, pub, now + 1000);
    const session = await vault.getGetSession(user.address);
    const maxCharge = await vault.getGetCanonicalSessionMaxCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);
    const before = await vault.getGetUser(user.address);

    for (const signatureTrailingData of ['bits', 'ref'] as const) {
      const external = await buildExternalRequest({
        vault,
        op: OP_PRIVATE,
        owner: user.address,
        sessionId: session.session_id,
        nonce: 0n,
        validUntil: BigInt(now + 100),
        publishKind: KIND_PRIVATE,
        sizeClass: SIZE_STANDARD,
        cryptoSuite: SUITE_CLASSICAL,
        maxCharge,
        secretKey: kp.secretKey,
        signatureTrailingData,
      });

      await tryExternal(vault, external);
      expect((await vault.getGetSession(user.address)).nonce).toBe(0n);
      expect((await vault.getGetUser(user.address)).message_budget_ton).toBe(before.message_budget_ton);
    }
  });

  it('VAULT-EXT-07: duplicate external request cannot be accepted twice', async () => {
    const { vault, user, blockchain } = await setup();
    const kp = keyPairFromSeed(Buffer.alloc(32, 9));
    const pub = bufToBigInt(kp.publicKey);
    const now = blockchain.now ?? 0;

    await fundSession(vault, user, pub, now + 1000);
    const session = await vault.getGetSession(user.address);
    const maxCharge = await vault.getGetCanonicalSessionMaxCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);

    const external1 = await buildExternalRequest({
      vault,
      op: OP_PRIVATE,
      owner: user.address,
      sessionId: session.session_id,
      nonce: 0n,
      validUntil: BigInt(now + 100),
      publishKind: KIND_PRIVATE,
      sizeClass: SIZE_STANDARD,
      cryptoSuite: SUITE_CLASSICAL,
      maxCharge,
      secretKey: kp.secretKey,
    });
    const external2 = await buildExternalRequest({
      vault,
      op: OP_PRIVATE,
      owner: user.address,
      sessionId: session.session_id,
      nonce: 0n,
      validUntil: BigInt(now + 100),
      publishKind: KIND_PRIVATE,
      sizeClass: SIZE_STANDARD,
      cryptoSuite: SUITE_CLASSICAL,
      maxCharge,
      secretKey: kp.secretKey,
    });

    await vault.sendExternal(external1);
    const afterFirst = await vault.getGetUser(user.address);
    await tryExternal(vault, external2);
    const afterSecond = await vault.getGetUser(user.address);
    const sessionAfter = await vault.getGetSession(user.address);

    expect(sessionAfter.nonce).toBe(1n);
    expect(afterSecond.message_budget_ton).toBe(afterFirst.message_budget_ton);
  });

  it('VAULT-EXT-07A/07B/07B1/07B2: invalid op/profile/max_charge consumes replay nonce and charges invalid-request budget', async () => {
    const { vault, user, blockchain } = await setup();
    const kp = keyPairFromSeed(Buffer.alloc(32, 10));
    const pub = bufToBigInt(kp.publicKey);
    const now = blockchain.now ?? 0;

    await fundSession(vault, user, pub, now + 1000);
    const session = await vault.getGetSession(user.address);
    const maxCharge = await vault.getGetCanonicalSessionMaxCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);
    const before = await vault.getGetUser(user.address);

    const bad = await buildExternalRequest({
      vault,
      op: OP_PUBLIC,
      owner: user.address,
      sessionId: session.session_id,
      nonce: 0n,
      validUntil: BigInt(now + 100),
      publishKind: KIND_PUBLIC,
      sizeClass: SIZE_STANDARD,
      cryptoSuite: SUITE_PUBLIC,
      maxCharge: maxCharge - 1n,
      header0: 0n,
      header1: 0n,
      secretKey: kp.secretKey,
    });

    await tryExternal(vault, bad);

    const after = await vault.getGetUser(user.address);
    const afterSession = await vault.getGetSession(user.address);
    const afterGlobal = await vault.getGetGlobal();
    expect(afterSession.nonce).toBe(1n);
    expect(before.message_budget_ton - after.message_budget_ton).toBe(INVALID_SESSION_REQUEST_CHARGE_TON);
    expect(afterGlobal.pending_publish_count).toBe(0n);
  });

  it('VAULT-EXT-03: expired session rejected before mutation', async () => {
    const { vault, user, blockchain } = await setup();
    const kp = keyPairFromSeed(Buffer.alloc(32, 11));
    const pub = bufToBigInt(kp.publicKey);
    const now = blockchain.now ?? 0;

    await fundSession(vault, user, pub, now + 10);
    blockchain.now = now + 20;
    const session = await vault.getGetSession(user.address);
    const maxCharge = await vault.getGetCanonicalSessionMaxCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);
    const before = await vault.getGetUser(user.address);

    const external = await buildExternalRequest({
      vault,
      op: OP_PRIVATE,
      owner: user.address,
      sessionId: session.session_id,
      nonce: 0n,
      validUntil: BigInt(now + 100),
      publishKind: KIND_PRIVATE,
      sizeClass: SIZE_STANDARD,
      cryptoSuite: SUITE_CLASSICAL,
      maxCharge,
      secretKey: kp.secretKey,
    });

    await tryExternal(vault, external);

    expect((await vault.getGetSession(user.address)).nonce).toBe(0n);
    expect((await vault.getGetUser(user.address)).message_budget_ton).toBe(before.message_budget_ton);
  });

  it('VAULT-EXT-REPLAY-LOW-BUDGET-01: low-budget signed external is rejected before acceptMessage', async () => {
    const { vault, user, blockchain } = await setup();
    const kp = keyPairFromSeed(Buffer.alloc(32, 21));
    const pub = bufToBigInt(kp.publicKey);
    const now = blockchain.now ?? 0;

    await fundSessionWithoutBudget(vault, user, pub, now + 1000);
    const session = await vault.getGetSession(user.address);
    const maxCharge = await vault.getGetCanonicalSessionMaxCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);
    const beforeUser = await vault.getGetUser(user.address);
    const beforeBalance = (await blockchain.getContract(vault.address)).balance;

    const external1 = await buildExternalRequest({
      vault,
      op: OP_PRIVATE,
      owner: user.address,
      sessionId: session.session_id,
      nonce: 0n,
      validUntil: BigInt(now + 100),
      publishKind: KIND_PRIVATE,
      sizeClass: SIZE_STANDARD,
      cryptoSuite: SUITE_CLASSICAL,
      maxCharge,
      secretKey: kp.secretKey,
    });
    const external2 = await buildExternalRequest({
      vault,
      op: OP_PRIVATE,
      owner: user.address,
      sessionId: session.session_id,
      nonce: 0n,
      validUntil: BigInt(now + 100),
      publishKind: KIND_PRIVATE,
      sizeClass: SIZE_STANDARD,
      cryptoSuite: SUITE_CLASSICAL,
      maxCharge,
      secretKey: kp.secretKey,
    });

    await tryExternal(vault, external1);
    const afterFirstUser = await vault.getGetUser(user.address);
    const afterFirstSession = await vault.getGetSession(user.address);
    const afterFirstBalance = (await blockchain.getContract(vault.address)).balance;

    await tryExternal(vault, external2);
    const afterSecondUser = await vault.getGetUser(user.address);
    const afterSecondSession = await vault.getGetSession(user.address);
    const afterSecondBalance = (await blockchain.getContract(vault.address)).balance;

    expect(beforeUser.message_budget_ton).toBe(0n);
    expect(afterFirstSession.nonce).toBe(0n);
    expect(afterSecondSession.nonce).toBe(0n);
    expect(afterFirstUser.message_budget_ton).toBe(0n);
    expect(afterSecondUser.message_budget_ton).toBe(0n);
    expect(afterFirstBalance).toBe(beforeBalance);
    expect(afterSecondBalance).toBe(beforeBalance);
  });

  it('VAULT-EXT-REPLAY-MAXCHARGE-01: signed external with too-low maxCharge is rejected before acceptMessage', async () => {
    const { vault, user, blockchain } = await setup();
    const kp = keyPairFromSeed(Buffer.alloc(32, 22));
    const pub = bufToBigInt(kp.publicKey);
    const now = blockchain.now ?? 0;

    await fundSession(vault, user, pub, now + 1000);
    const session = await vault.getGetSession(user.address);
    const beforeUser = await vault.getGetUser(user.address);
    const beforeBalance = (await blockchain.getContract(vault.address)).balance;
    const lowMaxCharge = toNano('0.001');

    const external1 = await buildExternalRequest({
      vault,
      op: OP_PRIVATE,
      owner: user.address,
      sessionId: session.session_id,
      nonce: 0n,
      validUntil: BigInt(now + 100),
      publishKind: KIND_PRIVATE,
      sizeClass: SIZE_STANDARD,
      cryptoSuite: SUITE_CLASSICAL,
      maxCharge: lowMaxCharge,
      secretKey: kp.secretKey,
    });
    const external2 = await buildExternalRequest({
      vault,
      op: OP_PRIVATE,
      owner: user.address,
      sessionId: session.session_id,
      nonce: 0n,
      validUntil: BigInt(now + 100),
      publishKind: KIND_PRIVATE,
      sizeClass: SIZE_STANDARD,
      cryptoSuite: SUITE_CLASSICAL,
      maxCharge: lowMaxCharge,
      secretKey: kp.secretKey,
    });

    await tryExternal(vault, external1);
    const afterFirstUser = await vault.getGetUser(user.address);
    const afterFirstSession = await vault.getGetSession(user.address);
    const afterFirstBalance = (await blockchain.getContract(vault.address)).balance;

    await tryExternal(vault, external2);
    const afterSecondUser = await vault.getGetUser(user.address);
    const afterSecondSession = await vault.getGetSession(user.address);
    const afterSecondBalance = (await blockchain.getContract(vault.address)).balance;

    expect(afterFirstSession.nonce).toBe(0n);
    expect(afterSecondSession.nonce).toBe(0n);
    expect(afterFirstUser.message_budget_ton).toBe(beforeUser.message_budget_ton);
    expect(afterSecondUser.message_budget_ton).toBe(beforeUser.message_budget_ton);
    expect(afterFirstBalance).toBe(beforeBalance);
    expect(afterSecondBalance).toBe(beforeBalance);
  });
});
