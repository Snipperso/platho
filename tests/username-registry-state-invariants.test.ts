import { describe, expect, it } from 'vitest';
import { sealArtAndCollectionMeta } from './helpers/username-registry-genesis';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  UsernameRegistry,
  BindOfficialAthWallet,
  SealGenesis,
  AthTransferNotificationRegistryMintUsername,
  PrunePendingUsernameMint,
} from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import { MockUsernameNFTItemNoAck } from '../build/MockUsernameNFTItemNoAck/MockUsernameNFTItemNoAck_MockUsernameNFTItemNoAck';
import { UsernameNFTItem } from '../build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem';

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
  await sealArtAndCollectionMeta(registry, deployer);
  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as SealGenesis);

  return { blockchain, registry, officialAthWallet, pruner, vaultAddress };
}

// THE ITEM IS THE RECORD (2026-07-20). UsernameRegistry.name_records is gone, so "is this name minted, and to
// whom" is no longer a registry lookup — it is read off the chain itself:
//   * the item's address is a pure function of (registry, name_hash), recomputed here rather than stored;
//   * the name is minted iff that account is a LIVE UsernameNFTItem whose get_state().initialized is true;
//   * owner_wallet is the item's live owner — the deleted record only ever held the MINTER, and never tracked
//     a TEP-62 transfer, so this is a strictly stronger read than the one it replaces.
// The code-hash check is load-bearing for THIS suite: the stuck-pending fixture installs MockUsernameNFTItemNoAck
// at the very same address, so "account is active" alone would report an unminted name as minted. Comparing code
// distinguishes the fixture without swallowing a getter failure the way a bare try/catch would.
async function readItem(blockchain: Blockchain, registryAddress: Address, nameHashValue: bigint) {
  const init = await UsernameNFTItem.init(registryAddress, nameHashValue);
  const address = contractAddress(0, init);
  const state = (await blockchain.getContract(address)).accountState;
  if (state?.type !== 'active') return { address, initialized: false, owner: null as Address | null };
  if (!state.state.code?.equals(init.code)) return { address, initialized: false, owner: null as Address | null };
  const view = await blockchain.openContract(new UsernameNFTItem(address, init)).getGetState();
  return { address, initialized: view.initialized, owner: view.owner_wallet as Address | null };
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
    $$type: 'AthTransferNotificationRegistryMintUsername',
    query_id: params.queryId,
    amount: params.amount,
    sender_key: 0n,
    payer_wallet: params.payerWallet,
    owner_wallet: params.owner,
    username_len: BigInt(Buffer.from(params.username, 'ascii').length),
    username: usernameSlice(params.username).asCell(),
  } as AthTransferNotificationRegistryMintUsername);
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

      // Every name the walk can possibly touch — including the two that must NEVER mint. get_global used to carry
      // name_record_count, and that scalar was the only thing proving no name OUTSIDE the model had been recorded
      // (an invalid or underpaid mint quietly succeeding). There is no global counter any more, so the sweep is
      // done per name over the whole universe instead: each item must be initialized iff the model says minted.
      // That is strictly stronger than the count it replaces — a count can be right while the wrong name holds it.
      const universeNames = [...normalNames, ...stuckNames, 'Larisa', 'bad.name'];

      async function assertModel() {
        let pendingCount = 0n;
        for (const name of universeNames) {
          const model = nameModel.get(name);
          const hash = nameHash(name);
          const item = await readItem(blockchain, registry.address, hash);
          const pending = await registry.getGetPendingMint(hash);
          if (model?.status === 'registered') {
            expect(item.initialized, `${debugContext}: ${name} item initialized`).toBe(true);
            // The item's LIVE owner, which is what the deleted record's minter_wallet approximated. Identical
            // immediately after a mint; unlike the record it would also follow a TEP-62 transfer.
            expect(item.owner!.toString()).toBe(model.owner.toString());
            expect(pending.exists, `${debugContext}: ${name} no pending`).toBe(false);
            // registered_at is gone with the record and nothing on chain holds it — no assertion is possible.
          } else if (model?.status === 'pending') {
            pendingCount += 1n;
            expect(item.initialized, `${debugContext}: ${name} item not initialized`).toBe(false);
            expect(pending.exists, `${debugContext}: ${name} pending exists`).toBe(true);
            expect(pending.owner_wallet.toString()).toBe(model.owner.toString());
            expect(pending.price_paid).toBe(model.amount);
          } else {
            expect(item.initialized, `${debugContext}: ${name} never minted`).toBe(false);
            expect(pending.exists, `${debugContext}: ${name} never pending`).toBe(false);
          }
        }

        const global = await registry.getGetGlobal();
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
          // Re-minting an ALREADY REGISTERED name is the one genuine behavioural change of the name_records
          // deletion. It is no longer refused in COMPUTE at 19172 with zero state touched: the registry now takes
          // the pending slot, deploys onto the existing item, the ITEM refuses at its own gate 18011, the message
          // bounces, and bounced<InitializeUsernameItem> clears the pending slot and refunds the buyer. The model
          // below is unchanged for that case on purpose — the walk asserts, after every step, that the round trip
          // left NOTHING behind: no extra pending, no second accrual to treasury_due/burn_due, owner untouched.
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
