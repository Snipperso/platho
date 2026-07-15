import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  UsernameRegistry,
  BindOfficialAthWallet,
  BindUsernameVault,
  SealGenesis,
  AthTransferNotificationVaultMintUsername,
  PrunePendingUsernameMint,
} from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import { MockUsernameNFTItemNoAck } from '../build/MockUsernameNFTItemNoAck/MockUsernameNFTItemNoAck_MockUsernameNFTItemNoAck';

const MANIFEST_HASH = 0x9999888877776666555544443333222211110000ffffeeeeddddccccbbbbaaaan;
const NAME_HASH_DOMAIN = 0xC5CC7CD6n;
const PRICE_4 = 10_000_000_000_000n;
const PRICE_5 = 1_000_000_000_000n;
const PRICE_6_PLUS = 100_000_000_000n;
const STALE_TTL = 86_400;

type ModelName = {
  owner: Address;
  amount: bigint;
  status: 'pending' | 'registered';
  createdAt: number;
};

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.USERNAME.INV.${label}`).digest());
}

function usernameSlice(name: string) {
  return beginCell().storeBuffer(Buffer.from(name, 'ascii')).endCell().beginParse();
}

function nameHash(name: string): bigint {
  return BigInt('0x' + beginCell()
    .storeUint(NAME_HASH_DOMAIN, 32)
    .storeBuffer(Buffer.from(name, 'ascii'))
    .endCell()
    .hash()
    .toString('hex'));
}

function makeRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}

function priceFor(name: string): bigint {
  if (name.length === 4) return PRICE_4;
  if (name.length === 5) return PRICE_5;
  return PRICE_6_PLUS;
}

function senderForAddress(blockchain: Blockchain, address: Address) {
  return { address, getSender: () => blockchain.sender(address) };
}

async function deploySealedRegistry() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const deployer = await blockchain.treasury('username-inv-deployer');
  const pruner = await blockchain.treasury('username-inv-pruner');
  const placeholderAthWallet = fixtureAddress('PLACEHOLDER_ATH_WALLET');
  const athMasterAddress = fixtureAddress('ATH_MASTER');
  const treasuryAthReceiver = fixtureAddress('TREASURY_ATH_RECEIVER');
  const vaultAddress = fixtureAddress('USERNAME_INV_VAULT');

  const registryInit = await UsernameRegistry.init(placeholderAthWallet, athMasterAddress, treasuryAthReceiver, false, 0n, 0n, deployer.address);
  const registryAddress = contractAddress(0, registryInit);
  await blockchain.setShardAccount(registryAddress, createShardAccount({
    address: registryAddress,
    code: registryInit.code,
    data: registryInit.data,
    balance: toNano('5'),
    workchain: registryAddress.workChain,
  }));
  const registry = blockchain.openContract(new UsernameRegistry(registryAddress, registryInit));
  const officialAthWalletAddress = await registry.getGetAthWalletAddress(registryAddress);
  const officialAthWallet = senderForAddress(blockchain, officialAthWalletAddress);

  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindOfficialAthWallet',
    deployment_manifest_hash: MANIFEST_HASH,
    official_ath_wallet_address: officialAthWalletAddress,
  } as BindOfficialAthWallet);
  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindUsernameVault',
    deployment_manifest_hash: MANIFEST_HASH,
    vault_address: vaultAddress,
  } as BindUsernameVault);
  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as SealGenesis);

  return { blockchain, registry, officialAthWallet, pruner, vaultAddress };
}

async function installNoAckAt(blockchain: Blockchain, address: Address) {
  const noAckInit = await MockUsernameNFTItemNoAck.init();
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: noAckInit.code,
    data: noAckInit.data,
    balance: toNano('0.05'),
    workchain: address.workChain,
  }));
}

async function sendMint(params: {
  registry: any;
  officialAthWallet: any;
  owner: Address;
  username: string;
  amount: bigint;
  queryId: bigint;
  payerWallet: Address;
  value?: bigint;
}) {
  // Registry now retains 511M (6M + 500M item deploy reserve + 1M + 4M), so the mint notification must carry >= that.
  await params.registry.send(params.officialAthWallet.getSender(), { value: params.value ?? toNano('1.2') }, {
    $$type: 'AthTransferNotificationVaultMintUsername',
    query_id: params.queryId,
    amount: params.amount,
    sender_key: 0n,
    payer_wallet: params.payerWallet,
    owner_wallet: params.owner,
    username_len: BigInt(Buffer.from(params.username, 'ascii').length),
    username: usernameSlice(params.username),
  } as AthTransferNotificationVaultMintUsername);
}

describe('UsernameRegistry state-machine invariants', () => {
  it('USERNAME-REG-INV-01: deterministic mint/reject/pending/prune walks preserve registry accounting', async () => {
    for (const seed of [0x501a2026, 0x9e3779b9, 0xdecafbad]) {
      const { blockchain, registry, officialAthWallet, pruner, vaultAddress } = await deploySealedRegistry();
      const rng = makeRng(seed);
      const owners = [
        fixtureAddress(`OWNER_${seed}_0`),
        fixtureAddress(`OWNER_${seed}_1`),
        fixtureAddress(`OWNER_${seed}_2`),
      ];
      const normalNames = ['abcd', 'abcde', 'platho', 'user01', 'user_2', 'user-3'];
      const stuckNames = ['hold01', 'hold_2', 'hold-3', 'hold04'];
      const nameModel = new Map<string, ModelName>();
      let treasuryDue = 0n;
      let burnDue = 0n;
      let queryId = BigInt(seed & 0xffff) + 1n;
      let debugContext = `seed ${seed} initial`;

      async function assertModel() {
        let registeredCount = 0n;
        let pendingCount = 0n;
        for (const [name, model] of nameModel.entries()) {
          const hash = nameHash(name);
          const record = await registry.getGetNameRecord(hash);
          const pending = await registry.getGetPendingMint(hash);
          if (model.status === 'registered') {
            registeredCount += 1n;
            expect(record.exists, `${debugContext}: ${name} record exists`).toBe(true);
            expect(record.minter_wallet.toString()).toBe(model.owner.toString());
            expect(pending.exists, `${debugContext}: ${name} no pending`).toBe(false);
          } else {
            pendingCount += 1n;
            expect(record.exists, `${debugContext}: ${name} no record`).toBe(false);
            expect(pending.exists, `${debugContext}: ${name} pending exists`).toBe(true);
            expect(pending.owner_wallet.toString()).toBe(model.owner.toString());
            expect(pending.price_paid).toBe(model.amount);
          }
        }

        const global = await registry.getGetGlobal();
        expect(global.name_record_count, `${debugContext}: record count`).toBe(registeredCount);
        expect(global.pending_mint_count, `${debugContext}: pending count`).toBe(pendingCount);
        expect(global.treasury_due_ath, `${debugContext}: treasury due`).toBe(treasuryDue);
        expect(global.burn_due_ath, `${debugContext}: burn due`).toBe(burnDue);
      }

      for (let step = 0; step < 50; step += 1) {
        const owner = owners[rng() % owners.length];
        const op = rng() % 7;
        if (op <= 1) {
          const name = normalNames[rng() % normalNames.length];
          const amount = priceFor(name);
          debugContext = `seed ${seed} step ${step} valid-mint ${name}`;
          await sendMint({ registry, officialAthWallet, owner, username: name, amount, queryId, payerWallet: vaultAddress });
          const existing = nameModel.get(name);
          if (existing == null) {
            nameModel.set(name, { owner, amount, status: 'registered', createdAt: blockchain.now ?? 0 });
            treasuryDue += amount / 2n;
            burnDue += amount - (amount / 2n);
          }
        } else if (op === 2) {
          const invalidName = (rng() % 2) === 0 ? 'Larisa' : 'bad.name';
          debugContext = `seed ${seed} step ${step} invalid-mint ${invalidName}`;
          await sendMint({ registry, officialAthWallet, owner, username: invalidName, amount: PRICE_6_PLUS, queryId, payerWallet: vaultAddress });
        } else if (op === 3) {
          const name = normalNames[rng() % normalNames.length];
          debugContext = `seed ${seed} step ${step} underpay ${name}`;
          await sendMint({ registry, officialAthWallet, owner, username: name, amount: priceFor(name) - 1n, queryId, payerWallet: vaultAddress });
        } else if (op === 4) {
          const available = stuckNames.filter((name) => !nameModel.has(name));
          if (available.length > 0) {
            const name = available[rng() % available.length];
            const amount = priceFor(name);
            const hash = nameHash(name);
            const itemAddress = await registry.getGetUsernameItemAddress(hash);
            await installNoAckAt(blockchain, itemAddress);
            debugContext = `seed ${seed} step ${step} stuck-pending ${name}`;
            await sendMint({ registry, officialAthWallet, owner, username: name, amount, queryId, payerWallet: vaultAddress });
            nameModel.set(name, { owner, amount, status: 'pending', createdAt: blockchain.now ?? 0 });
          }
        } else if (op === 5) {
          const pending = [...nameModel.entries()].filter(([, model]) => model.status === 'pending');
          if (pending.length > 0) {
            const [name, model] = pending[rng() % pending.length];
            debugContext = `seed ${seed} step ${step} duplicate-pending ${name}`;
            await sendMint({ registry, officialAthWallet, owner, username: name, amount: model.amount, queryId, payerWallet: vaultAddress });
          }
        } else {
          const pending = [...nameModel.entries()].filter(([, model]) => model.status === 'pending');
          if (pending.length > 0) {
            const [name, model] = pending[rng() % pending.length];
            const hash = nameHash(name);
            const currentNow = blockchain.now ?? 0;
            const canStillBeEarly = currentNow < model.createdAt + STALE_TTL - 1;
            const tooEarly = canStillBeEarly && (rng() % 3) === 0;
            blockchain.now = tooEarly
              ? Math.max(currentNow + 1, model.createdAt + STALE_TTL - 1)
              : Math.max(currentNow + 1, model.createdAt + STALE_TTL + 1);
            debugContext = `seed ${seed} step ${step} prune ${name} tooEarly=${tooEarly}`;
            await registry.send(pruner.getSender(), { value: toNano('0.03') }, {
              $$type: 'PrunePendingUsernameMint',
              name_hash: hash,
            } as PrunePendingUsernameMint);
          }
        }
        queryId += 1n;
        await assertModel();
      }
    }
  }, 60_000);
});
