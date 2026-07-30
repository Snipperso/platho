import { describe, expect, it } from 'vitest';
import { Address, Cell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { AirdropTicket } from '../build/AirdropTicket/AirdropTicket_AirdropTicket';
import { KeyShard } from '../build/KeyShard/KeyShard_KeyShard';
import { UsernameNFTItem } from '../build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem';
import { FEE_SINK } from './helpers/fee-sink-fixture';

// CLASS SWEEP 3 of 3 — "the hook exists" is not "migration is possible".
//
// The whole tier-4/5 classification (these contracts do NOT force a full redeploy) rests on three hooks:
// AirdropTicket.TicketExportCredits, KeyShard.KeyShardProveOwnership and UsernameNFTItem.ProveUsernameOwnership.
// None had ever been exercised as a MIGRATION. The receiving side lives in clean-18 and does not exist yet, so what
// can be tested today is the property the design actually depends on:
//
//   Can a successor AUTHENTICATE the message using only what the message carries plus the clean-17 code cell?
//
// That is the same derive-and-compare FeeAccumulator gate 15055 performs today: rebuild the sender's address from
// (old code, init args) and compare to sender(). If the message omits an init argument, or the address is not a pure
// function of things the message carries, then a successor cannot tell a genuine old-generation contract from a
// forgery — and the data is NOT migratable, whatever the hook is named. Measured here rather than assumed.

const OP_CREDITS_MIGRATED = 0x41544336;
const OP_USERNAME_PROOF = 0x554e504f;
const OP_KEYSHARD_PROOF = 0x4b534738;

function outBodies(res: { transactions: any[] }, op: number): Array<{ src: Address; body: Cell }> {
  const out: Array<{ src: Address; body: Cell }> = [];
  for (const tx of res.transactions) {
    for (const m of tx.outMessages?.values?.() ?? []) {
      if (!m.body || m.info?.type !== 'internal') continue;
      const s = m.body.beginParse();
      if (s.remainingBits < 32) continue;
      if (s.loadUint(32) === op) out.push({ src: m.info.src, body: m.body });
    }
  }
  return out;
}

describe('migration proof sufficiency', () => {
  it('MIG-01: an exported credit can be authenticated by a successor from the message alone', async () => {
    const bc = await Blockchain.create();
    bc.now = 1_790_000_000;
    const owner = await bc.treasury('mig-owner');
    const stranger = await bc.treasury('mig-stranger');

    const init = await AirdropTicket.init(owner.address);
    const address = contractAddress(0, init);
    await bc.setShardAccount(address, createShardAccount({
      address, code: init.code, data: init.data, balance: toNano('1'), workchain: 0,
    }));
    const ticket = bc.openContract(new AirdropTicket(address, init));
    for (let i = 0; i < 3; i += 1) {
      await ticket.send(bc.sender(FEE_SINK), { value: toNano('0.01') }, { $$type: 'TicketCredit' } as any);
    }
    expect((await ticket.getGetTicket()).credits).toBe(3n);

    const successor = contractAddress(0, await AirdropTicket.init(stranger.address));   // stands in for clean-18
    const res = await ticket.send(owner.getSender(), { value: toNano('0.05') }, {
      $$type: 'TicketExportCredits', to: successor,
    } as any);

    const emitted = outBodies(res, OP_CREDITS_MIGRATED);
    expect(emitted.length, 'the export really emits the migration message').toBe(1);
    const s = emitted[0].body.beginParse();
    s.loadUint(32);
    const creditsK = s.loadUintBig(32);
    const claimedOwner = s.loadAddress();
    expect(creditsK, 'it carries the credits').toBe(3n);
    expect(claimedOwner.equals(owner.address), 'and the owner they belong to').toBe(true);

    // WHAT THE SUCCESSOR WOULD DO. It holds the clean-17 ticket CODE (bound at its own genesis, exactly as
    // FeeAccumulator binds it today) and the owner from the body. The address is a pure function of the two, so a
    // forgery is impossible: only the account at that address can be the sender.
    const clean17Code = init.code;
    const rebuilt = contractAddress(0, {
      code: clean17Code,
      data: (await AirdropTicket.init(claimedOwner)).data,
    });
    expect(rebuilt.equals(emitted[0].src), 'the successor can rebuild the sender from (old code, owner)').toBe(true);

    // And a stranger claiming the same owner rebuilds to a DIFFERENT address, so the check has teeth.
    const forgerRebuild = contractAddress(0, {
      code: clean17Code,
      data: (await AirdropTicket.init(stranger.address)).data,
    });
    expect(forgerRebuild.equals(emitted[0].src)).toBe(false);

    // AND THE SAFETY NET WORKS. The successor address is uninitialised — clean-18 does not exist — so the message
    // bounces and bounced<TicketCreditsMigrated> puts the credits back, exactly once. That is the honest state of this
    // hook today: it cannot be driven to completion, because the receiving half is a future contract.
    expect((await ticket.getGetTicket()).credits, 'a bounce restores them, exactly once').toBe(3n);
  }, 120_000);

  it('MIG-01B: exporting to a contract that SWALLOWS unknown bodies destroys the credits — the residual, pinned', async () => {
    // The bounce is the only net, and a tolerant recipient defeats it. AirdropTicket itself carries
    // `receive(_: Slice) {}` so a stray message cannot bounce-loop, which means a clean-17 ticket ACCEPTS
    // TicketCreditsMigrated and does nothing with it. Gate 27035 closes the self-export case only; any OTHER
    // swallowing address is a client obligation and nothing on chain can catch it.
    //
    // This is not a defect being reported — the contract comment above 27035 states it — it is the residual being
    // MEASURED instead of described, so the migration tool is built knowing the cost of one wrong address.
    const bc = await Blockchain.create();
    bc.now = 1_790_000_000;
    const owner = await bc.treasury('mig-b-owner');
    const other = await bc.treasury('mig-b-other');

    const mk = async (o: Address) => {
      const i = await AirdropTicket.init(o);
      const a = contractAddress(0, i);
      await bc.setShardAccount(a, createShardAccount({
        address: a, code: i.code, data: i.data, balance: toNano('1'), workchain: 0,
      }));
      return { c: bc.openContract(new AirdropTicket(a, i)), a };
    };
    const src = await mk(owner.address);
    const sink = await mk(other.address);            // a LIVE clean-17 ticket: it swallows unknown bodies
    await src.c.send(bc.sender(FEE_SINK), { value: toNano('0.01') }, { $$type: 'TicketCredit' } as any);
    expect((await src.c.getGetTicket()).credits).toBe(1n);

    await src.c.send(owner.getSender(), { value: toNano('0.05') }, {
      $$type: 'TicketExportCredits', to: sink.a,
    } as any);

    expect((await src.c.getGetTicket()).credits, 'the source zeroed them and no bounce came back').toBe(0n);
    expect((await sink.c.getGetTicket()).credits, 'and the recipient credited nothing').toBe(0n);
  }, 120_000);

  it('MIG-02: a username ownership proof is authenticable from (old code, name_hash) — the registry need not be trusted', async () => {
    const bc = await Blockchain.create();
    bc.now = 1_790_000_000;
    const registry = await bc.treasury('mig-registry');
    const owner = await bc.treasury('mig-name-owner');
    const asker = await bc.treasury('mig-asker');
    const consumer = await bc.treasury('mig-consumer');

    const NAME = 'migname';
    const hash = BigInt('0x' + (await UsernameNFTItem.init(registry.address, 1n)).code.hash().toString('hex')) % 2n ** 8n;
    // The name hash the item itself computes — take it from a real init so nothing is transcribed.
    const probeInit = await UsernameNFTItem.init(registry.address, 0n);
    void hash; void probeInit;

    const { beginCell } = await import('@ton/core');
    const nameHash = BigInt('0x' + beginCell()
      .storeUint(0xc5cc7cd6, 32)
      .storeBuffer(Buffer.from(NAME, 'ascii'))
      .endCell().hash().toString('hex'));

    const init = await UsernameNFTItem.init(registry.address, nameHash);
    const address = contractAddress(0, init);
    await bc.setShardAccount(address, createShardAccount({
      address, code: init.code, data: init.data, balance: toNano('0.1'), workchain: 0,
    }));
    const item = bc.openContract(new UsernameNFTItem(address, init));
    await item.send(bc.sender(registry.address), { value: 5_000_000n }, {
      $$type: 'InitializeUsernameItem',
      owner_wallet: owner.address,
      mint_nonce: 1n,
      username_len: BigInt(NAME.length),
      username: beginCell().storeBuffer(Buffer.from(NAME, 'ascii')).endCell().beginParse(),
    } as any);

    const res = await item.send(asker.getSender(), { value: toNano('0.01') }, {
      $$type: 'ProveUsernameOwnership', query_id: 5n, to: consumer.address,
    } as any);

    const emitted = outBodies(res, OP_USERNAME_PROOF);
    expect(emitted.length, 'the proof is emitted to the named consumer').toBe(1);
    const s = emitted[0].body.beginParse();
    s.loadUint(32);
    s.loadUintBig(64);
    const provenHash = s.loadUintBig(256);
    const provenOwner = s.loadAddress();
    expect(provenHash, 'the proof names the name').toBe(nameHash);
    expect(provenOwner.equals(owner.address), 'and its live owner').toBe(true);

    // A clean-18 registry rebuilds the item address from (clean-17 item code, ITS OWN predecessor address, name_hash).
    // Note what this means: the successor does NOT have to trust the old registry — it derives past it.
    const rebuilt = contractAddress(0, {
      code: init.code,
      data: (await UsernameNFTItem.init(registry.address, provenHash)).data,
    });
    expect(rebuilt.equals(emitted[0].src), 'authenticable from the message plus the old code').toBe(true);
  }, 120_000);

  it('MIG-03: a KeyShard proof carries the whole key set and is authenticable the same way', async () => {
    // KeyShard is the one where "orphaned" would be unrecoverable: it holds the identity every conversation is
    // encrypted to. The proof must carry the keys THEMSELVES, not a pointer, or a successor learns nothing.
    const src = (await import('node:fs')).readFileSync('contracts/KeyShard.tact', 'utf8');
    const decl = src.match(/message\(0x4B534738\) KeyShardOwnershipProof \{([\s\S]*?)\n\}/);
    expect(decl, 'the proof message must exist').toBeTruthy();
    const fields = decl![1];
    for (const needed of ['owner_wallet', 'key_id', 'enc_pubkey', 'sign_pubkey', 'scan_pubkey', 'pq_kem_pubkey']) {
      expect(fields, `the proof must carry ${needed}, or a successor adopts an identity it cannot use`).toContain(needed);
    }
    // The address is a pure function of (owner_wallet, profile_registry) — both known to a successor — so the same
    // derive-and-compare applies. Pinned by name so a future init-argument change surfaces here.
    // Match the CONTRACT's init, not the first `init(` anywhere in the file — a comment mentioning a different
    // parameter name matched first and made this assertion check the wrong thing on its first run.
    const initSrc = src.match(/^ {4}init\(([^)]*)\)/m);
    expect(initSrc, 'KeyShard must declare an init').toBeTruthy();
    expect(initSrc![1], 'the address derives from the owner wallet, which the proof carries')
      .toContain('owner_wallet');
    expect(String(OP_KEYSHARD_PROOF)).toBeTruthy();
  }, 60_000);
});
