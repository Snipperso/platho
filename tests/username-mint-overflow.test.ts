import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { findTransaction } from '@ton/test-utils';
import { createHash } from 'crypto';
import {
  ATHWallet,
  ATHInternalTransferRegistryMintUsername,
  AthTransferNotificationRegistryMintUsername,
  storeAthTransferNotificationRegistryMintUsername,
  loadAthTransferNotificationRegistryMintUsername,
} from '../build/ATHWallet/ATHWallet_ATHWallet';


const MASTER = new Address(0, createHash('sha256').update('PLATHO.V1.MINT.OVERFLOW.MASTER').digest());

function fixtureAddress(label: string): Address {
  return new Address(0, createHash('sha256').update(`PLATHO.V1.MINT.OVERFLOW.${label}`).digest());
}

function nameSlice(name: string) {
  return beginCell().storeBuffer(Buffer.from(name, 'ascii')).endCell().beginParse();
}

function inspectWalletHop(res: any, from: Address, to: Address) {
  const tx = findTransaction(res.transactions, { from, to });
  const generic = tx?.description.type === 'generic' ? tx.description : null;
  const vm = generic && generic.computePhase.type === 'vm' ? generic.computePhase : null;
  const notifEmitted = tx
    ? [...tx.outMessages.values()].some((m: any) => {
        if (m.info.type !== 'internal') return false;
        const s = m.body.beginParse();
        return s.remainingBits >= 32 && s.preloadUint(32) === 0x89129D60;
      })
    : false;
  return { found: tx !== undefined, success: !!(vm && vm.success), exit: vm ? vm.exitCode : null, notifEmitted };
}

async function deployWallet(blockchain: Blockchain, owner: Address, balance: bigint) {
  const zeroInit = await ATHWallet.init(0n, owner, MASTER);
  const dataInit = await ATHWallet.init(balance, owner, MASTER);
  const address = contractAddress(owner.workChain, zeroInit);
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: zeroInit.code,
    data: dataInit.data,
    balance: toNano('1'),
    workchain: address.workChain,
  }));
  return blockchain.openContract(new ATHWallet(address, zeroInit));
}

async function derivedWalletAddress(owner: Address): Promise<Address> {
  const init = await ATHWallet.init(0n, owner, MASTER);
  return contractAddress(owner.workChain, init);
}

const SIXTEEN = 'abcdefghijklmnop';
const TWELVE = 'abcdefghijkl';

describe('§4c registry username-mint notification overflow', () => {
  it('USERNAME-OVERFLOW-01: 16-char notification serializes and round-trips with a FLAT username', () => {
    const body = beginCell().store(storeAthTransferNotificationRegistryMintUsername({
      $$type: 'AthTransferNotificationRegistryMintUsername',
      query_id: 1n,
      sender_key: 0n,
      amount: 100n,
      payer_wallet: fixtureAddress('PAYER'),
      owner_wallet: fixtureAddress('OWNER'),
      username_len: BigInt(SIXTEEN.length),
      username: nameSlice(SIXTEEN).asCell(),
    } as AthTransferNotificationRegistryMintUsername)).endCell();

    const parsed = loadAthTransferNotificationRegistryMintUsername(body.beginParse());
    expect(parsed.username_len).toBe(16n);
    const usernameSlice = parsed.username.beginParse();
    expect(usernameSlice.remainingBits).toBe(16 * 8);
    expect(usernameSlice.remainingRefs).toBe(0);
    expect(usernameSlice.loadBuffer(16).toString('ascii')).toBe(SIXTEEN);
    expect(parsed.payer_wallet.equals(fixtureAddress('PAYER'))).toBe(true);
    expect(parsed.owner_wallet.equals(fixtureAddress('OWNER'))).toBe(true);
  });

  it('USERNAME-OVERFLOW-02: official ATH wallet emits the mint notification for a 16-char name (no exit 8)', async () => {
    const blockchain = await Blockchain.create();
    const registryOwner = fixtureAddress('REGISTRY_OWNER');
    const payerOwner = fixtureAddress('PAYER_OWNER');
    const nftOwner = fixtureAddress('NFT_OWNER');

    const official = await deployWallet(blockchain, registryOwner, 0n);
    const senderWallet = await derivedWalletAddress(payerOwner);

    const res = await official.send(
      blockchain.sender(senderWallet),
      { value: toNano('0.5') },
      {
        $$type: 'ATHInternalTransferRegistryMintUsername',
        query_id: 7n,
        amount: 100_000_000_000n,
        sender_owner: payerOwner,
        response_destination: payerOwner,
        notify_value: 45_000_000n,
        owner_wallet: nftOwner,
        username_len: BigInt(SIXTEEN.length),
        username: nameSlice(SIXTEEN),
      } as ATHInternalTransferRegistryMintUsername,
    );

    const hop = inspectWalletHop(res, senderWallet, official.address);
    expect(hop.found).toBe(true);
    expect(hop.exit).not.toBe(8);
    expect(hop.success).toBe(true);
    expect(hop.notifEmitted).toBe(true);
  });

  it('USERNAME-OVERFLOW-03: 12-char name still works end to end through the same hop', async () => {
    const blockchain = await Blockchain.create();
    const registryOwner = fixtureAddress('REGISTRY_OWNER_12');
    const payerOwner = fixtureAddress('PAYER_OWNER_12');
    const nftOwner = fixtureAddress('NFT_OWNER_12');

    const official = await deployWallet(blockchain, registryOwner, 0n);
    const senderWallet = await derivedWalletAddress(payerOwner);

    const res = await official.send(
      blockchain.sender(senderWallet),
      { value: toNano('0.5') },
      {
        $$type: 'ATHInternalTransferRegistryMintUsername',
        query_id: 9n,
        amount: 100_000_000_000n,
        sender_owner: payerOwner,
        response_destination: payerOwner,
        notify_value: 45_000_000n,
        owner_wallet: nftOwner,
        username_len: BigInt(TWELVE.length),
        username: nameSlice(TWELVE),
      } as ATHInternalTransferRegistryMintUsername,
    );

    const hop = inspectWalletHop(res, senderWallet, official.address);
    expect(hop.found).toBe(true);
    expect(hop.success).toBe(true);
    expect(hop.notifEmitted).toBe(true);
  });
});
