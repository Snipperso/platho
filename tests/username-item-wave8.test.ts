import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { readFileSync } from 'node:fs';
import { UsernameNFTItem } from '../build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem';

const NOW = 1_790_000_000;
const NAME = 'wave8it';
const NAME_HASH_DOMAIN = 0xc5cc7cd6;

// Read the two reserves OUT OF THE CONTRACT. Hard-coding 3,000,000 + 2,000,000 here would make this test compare a
// literal to a literal: lowering the constant back to its old value would still leave the test green while the very
// shortfall it exists to catch reappeared. `\d` is escaped twice on purpose — inside a template literal a single
// backslash collapses and the pattern silently becomes `(d+)`, which matches nothing (hit twice already in this repo).
function sourceConst(name: string): bigint {
  const src = readFileSync('contracts/UsernameNFTItem.tact', 'utf8');
  const m = src.match(new RegExp(`const ${name}: Int = (\\d+);`));
  if (!m) throw new Error(`${name} not found in contracts/UsernameNFTItem.tact`);
  return BigInt(m[1]);
}

function fixtureAddress(label: string): Address {
  return new Address(0, createHash('sha256').update(`PLATHO.V1.ITEM.W8.${label}`).digest());
}

function nameHash(name: string): bigint {
  const cell = beginCell()
    .storeUint(NAME_HASH_DOMAIN, 32)
    .storeBuffer(Buffer.from(name, 'ascii'))
    .endCell();
  return BigInt('0x' + cell.hash().toString('hex'));
}

async function liveItem(bc: Blockchain, registry: Address, balance: bigint) {
  const hash = nameHash(NAME);
  const init = await UsernameNFTItem.init(registry, hash);
  const addr = contractAddress(0, init);
  await bc.setShardAccount(addr, createShardAccount({
    address: addr, code: init.code, data: init.data, balance, workchain: 0,
  }));
  return { item: bc.openContract(new UsernameNFTItem(addr, init)), addr, hash };
}

describe('UsernameNFTItem wave-8', () => {
  it('ITEM-18015-01: an initialization funded EXACTLY at the gate no longer eats into the item\'s own rent', async () => {
    const bc = await Blockchain.create();
    bc.now = NOW;
    const registry = await bc.treasury('w8-item-registry');
    const owner = fixtureAddress('OWNER');
    const startBalance = toNano('0.05');
    const { item, addr } = await liveItem(bc, registry.address, startBalance);

    // The gate is ACK_FORWARD_RESERVE + ACK_EXEC_RESERVE. At the old 1,000,000 exec reserve that came to 4,000,000
    // against a MEASURED true cost of 4,056,601 (14,194 gas = 946,267, plus 110,334 forwarding, plus the 3,000,000
    // the ACK body carries), so an item funded exactly at its own gate went 56,602 into its rent endowment and
    // reported success. Measure the delta rather than trusting the arithmetic.
    const gateExact = sourceConst('USERNAME_ITEM_ACK_FORWARD_RESERVE') + sourceConst('USERNAME_ITEM_ACK_EXEC_RESERVE');
    expect(gateExact, 'the gate must cover the measured 4,056,601').toBeGreaterThan(4_056_601n);
    const res = await item.send(bc.sender(registry.address), { value: gateExact }, {
      $$type: 'InitializeUsernameItem',
      owner_wallet: owner,
      mint_nonce: 1n,
      username_len: BigInt(NAME.length),
      username: beginCell().storeBuffer(Buffer.from(NAME, 'ascii')).endCell().beginParse(),
    } as any);

    const tx: any = res.transactions.find((t: any) => t.inMessage?.info?.dest?.equals?.(addr));
    expect(tx?.description?.computePhase?.exitCode, 'the honest minimum passes the gate').toBe(0);
    expect((await item.getGetState()).initialized).toBe(true);
    const after = (await bc.getContract(addr)).balance;
    expect(after, `MEASURED delta at the exact gate: ${after - startBalance}`).toBeGreaterThanOrEqual(startBalance);
  });

  it('ITEM-STATIC-01: TEP-62 get_static_data is answered instead of bouncing with exit 130', async () => {
    const bc = await Blockchain.create();
    bc.now = NOW;
    const registry = await bc.treasury('w8-static-registry');
    const asker = await bc.treasury('w8-static-asker');
    const owner = fixtureAddress('STATIC_OWNER');
    const { item, addr, hash } = await liveItem(bc, registry.address, toNano('0.05'));
    await item.send(bc.sender(registry.address), { value: toNano('0.02') }, {
      $$type: 'InitializeUsernameItem',
      owner_wallet: owner,
      mint_nonce: 1n,
      username_len: BigInt(NAME.length),
      username: beginCell().storeBuffer(Buffer.from(NAME, 'ascii')).endCell().beginParse(),
    } as any);

    // The router did not know 0x2FCB26A2 and fell into the generic throw(130). get_nft_data was correct all along,
    // but the MESSAGE surface — what off-chain indexers and marketplaces use — answered nothing at all.
    const res = await item.send(asker.getSender(), { value: toNano('0.02') }, {
      $$type: 'GetStaticData', query_id: 77n,
    } as any);

    const tx: any = res.transactions.find((t: any) => t.inMessage?.info?.dest?.equals?.(addr));
    expect(tx?.description?.computePhase?.exitCode, 'answered, not thrown').toBe(0);

    const reply = res.transactions
      .flatMap((t: any) => t.outMessages?.values?.() ?? [])
      .find((m: any) => m.info?.dest?.equals?.(asker.address) && m.body);
    expect(reply, 'report_static_data comes back').toBeTruthy();
    const s = reply!.body.beginParse();
    expect(s.loadUint(32), 'TEP-62 report_static_data opcode').toBe(0x8b771735);
    expect(s.loadUintBig(64)).toBe(77n);
    expect(s.loadUintBig(256), 'index is the name hash, matching get_nft_data').toBe(hash);
    expect(s.loadAddress().equals(registry.address), 'collection is the registry').toBe(true);
  });
});
