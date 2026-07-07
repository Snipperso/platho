// RED-TEAM attack suite against the rewritten UsernameNFTItem.tact NftTransfer surface.
// Run: npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" artifacts/getgems-sale-emulation-20260707/redteam_item_attacks.ts
import { Address, beginCell, Cell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { UsernameNFTItem, InitializeUsernameItem } from '../../build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem';

const REGISTRY = new Address(0, createHash('sha256').update('RT.REGISTRY').digest());
const OWNER = new Address(0, createHash('sha256').update('RT.OWNER').digest());
const ATTACKER = new Address(0, createHash('sha256').update('RT.ATTACKER').digest());
const RANDO = new Address(0, createHash('sha256').update('RT.RANDO').digest());

const nameHash = (name: string) => BigInt('0x' + beginCell()
  .storeUint(0xC5CC7CD6, 32).storeBuffer(Buffer.from(name, 'ascii')).endCell().hash().toString('hex'));

const NFT_TRANSFER_OP = 0x5FCC3D14;

// Safe helpers over loosely-typed message info.
function isInternalFrom(tx: any, src: Address): boolean {
  const i = tx.inMessage?.info;
  return i?.type === 'internal' && i.src?.equals?.(src);
}
function isInternalTo(tx: any, src: Address, dest: Address): boolean {
  const i = tx.inMessage?.info;
  return i?.type === 'internal' && i.src?.equals?.(src) && i.dest?.equals?.(dest);
}
function msgValue(tx: any): bigint {
  const i = tx.inMessage?.info;
  return i?.type === 'internal' ? (i.value?.coins ?? 0n) : 0n;
}

function phase(tx: any) {
  const d = tx.description;
  const compute = d.computePhase?.type === 'vm' ? d.computePhase.exitCode : d.computePhase?.type;
  const action = d.actionPhase ? d.actionPhase.resultCode : 'none';
  return { compute, action, aborted: d.aborted };
}

// Build a TEP-62 transfer body. options let us craft malformed variants.
function transferBody(opts: {
  queryId?: bigint;
  newOwner: Address | 'none';       // addr_none for the new owner (attack b)
  responseDest: Address | 'none';
  forwardAmount: bigint;
  customPayload?: boolean;
  forwardPayload?: Cell | 'inline';
  truncateAfterNewOwner?: boolean;  // drop everything after new owner (attack b: parse fail-open)
  truncateAfterResponse?: boolean;
}): Cell {
  const b = beginCell();
  b.storeUint(NFT_TRANSFER_OP, 32);
  b.storeUint(opts.queryId ?? 0n, 64);
  if (opts.newOwner === 'none') b.storeUint(0, 2); else b.storeAddress(opts.newOwner);
  if (opts.truncateAfterNewOwner) return b.endCell();
  if (opts.responseDest === 'none') b.storeUint(0, 2); else b.storeAddress(opts.responseDest);
  if (opts.truncateAfterResponse) return b.endCell();
  b.storeBit(!!opts.customPayload);
  if (opts.customPayload) b.storeRef(beginCell().storeUint(0xdead, 16).endCell());
  b.storeCoins(opts.forwardAmount);
  if (opts.forwardPayload === 'inline' || opts.forwardPayload === undefined) {
    b.storeBit(false); // Either: inline empty
  } else {
    b.storeBit(true).storeRef(opts.forwardPayload);
  }
  return b.endCell();
}

async function freshItem(bc: Blockchain, balance: bigint) {
  const hash = nameHash('victim');
  const init = await UsernameNFTItem.init(REGISTRY, hash);
  const addr = contractAddress(0, init);
  await bc.setShardAccount(addr, createShardAccount({
    address: addr, code: init.code, data: init.data, balance, workchain: 0,
  }));
  const item = bc.openContract(new UsernameNFTItem(addr, init));
  await item.send(bc.sender(REGISTRY), { value: 100_000_000n }, {
    $$type: 'InitializeUsernameItem',
    owner_wallet: OWNER,
    username_len: 6n,
    username: beginCell().storeBuffer(Buffer.from('victim', 'ascii')).endCell().beginParse(),
  } as InitializeUsernameItem);
  const st = await item.getGetState();
  if (!st.initialized) throw new Error('init failed');
  if (!st.owner_wallet.equals(OWNER)) throw new Error('owner not set to OWNER');
  return { item, addr, init };
}

function sendRaw(bc: Blockchain, src: Address, dest: Address, value: bigint, body: Cell, lt: bigint, bounced = false) {
  return bc.sendMessage({
    info: {
      type: 'internal', ihrDisabled: true, bounce: true, bounced,
      src, dest, value: { coins: value }, ihrFee: 0n, forwardFee: 0n, createdAt: bc.now!, createdLt: lt,
    },
    body,
  } as any);
}

const results: Array<{ name: string; verdict: string; note: string }> = [];
function record(name: string, verdict: string, note: string) {
  results.push({ name, verdict, note });
  console.log(`\n### [${verdict}] ${name}\n${note}`);
}

async function main() {
  const bc = await Blockchain.create();
  bc.now = 1783000000;
  let lt = 100n;

  // ---------- ATTACK A1: non-owner (attacker) sends NftTransfer to steal ----------
  {
    const { item, addr } = await freshItem(bc, toNano('0.5'));
    const body = transferBody({ newOwner: ATTACKER, responseDest: ATTACKER, forwardAmount: 0n });
    const res = await sendRaw(bc, ATTACKER, addr, 200_000_000n, body, lt++);
    const itemTx = res.transactions.find((t: any) => t.inMessage?.info?.dest?.equals(addr));
    const p = phase(itemTx);
    const owner = (await item.getGetState()).owner_wallet;
    const stolen = owner.equals(ATTACKER);
    record('A1 non-owner NftTransfer steals NFT', stolen ? 'SUCCEEDED' : 'FAILED',
      `attacker=${ATTACKER.toString().slice(0,12)} sent transfer. item compute exit=${p.compute} (expect 18031). owner after=${owner.equals(OWNER)?'OWNER (unchanged)':owner.equals(ATTACKER)?'ATTACKER (STOLEN)':'other'}.`);
  }

  // ---------- ATTACK A2: bounced-message spoof (bounced=true from registry to flip state) ----------
  {
    const { item, addr } = await freshItem(bc, toNano('0.5'));
    // Attacker cannot set src to owner, but test: does a BOUNCED inbound get treated as a normal transfer?
    const body = transferBody({ newOwner: ATTACKER, responseDest: ATTACKER, forwardAmount: 0n });
    const res = await sendRaw(bc, OWNER, addr, 200_000_000n, body, lt++, /*bounced*/ true);
    const itemTx = res.transactions.find((t: any) => t.inMessage?.info?.dest?.equals(addr));
    const p = phase(itemTx);
    const owner = (await item.getGetState()).owner_wallet;
    // A bounced message with src=OWNER: Tact receivers normally ignore bounced unless bounced() receiver.
    const flipped = owner.equals(ATTACKER);
    record('A2 bounced-message flips owner', flipped ? 'SUCCEEDED' : 'FAILED',
      `bounced=true, src spoofed=OWNER. item compute exit=${p.compute}. owner after=${owner.equals(OWNER)?'OWNER (unchanged)':'CHANGED'}. (Tact routes bounced msgs to bounced receiver only; body-op receivers skip them.)`);
  }

  // ---------- ATTACK B1: truncated body after new owner (parse fail-open?) ----------
  {
    const { item, addr } = await freshItem(bc, toNano('0.5'));
    const body = transferBody({ newOwner: ATTACKER, responseDest: ATTACKER, forwardAmount: 0n, truncateAfterNewOwner: true });
    const res = await sendRaw(bc, OWNER, addr, 200_000_000n, body, lt++);
    const itemTx = res.transactions.find((t: any) => t.inMessage?.info?.dest?.equals(addr));
    const p = phase(itemTx);
    const owner = (await item.getGetState()).owner_wallet;
    // Owner IS the sender here (legit owner), but body is truncated -> preloadUint(2) on empty should throw.
    const changed = owner.equals(ATTACKER);
    record('B1 truncated-after-newowner parse fail-open', (changed && p.compute===0) ? 'SUCCEEDED' : 'FAILED',
      `legit owner sends truncated body. item compute exit=${p.compute} (expect non-zero: read past end). owner after=${owner.equals(OWNER)?'OWNER (unchanged/reverted)':'ATTACKER'}.`);
  }

  // ---------- ATTACK B2: response_destination absent but forwardAmount huge, forward payload big ----------
  {
    const { item, addr } = await freshItem(bc, toNano('0.5'));
    const body = transferBody({ newOwner: ATTACKER, responseDest: 'none', forwardAmount: 0n });
    const res = await sendRaw(bc, OWNER, addr, 200_000_000n, body, lt++);
    const itemTx = res.transactions.find((t: any) => t.inMessage?.info?.dest?.equals(addr));
    const p = phase(itemTx);
    const owner = (await item.getGetState()).owner_wallet;
    record('B2 legit transfer addr_none response (baseline)', 'INCONCLUSIVE',
      `owner transfers with addr_none response. compute=${p.compute} action=${p.action}. owner now=${owner.equals(ATTACKER)?'ATTACKER (legit transfer)':'unchanged'}. This is the legit path — confirms parse works.`);
  }

  // ---------- ATTACK C1: forward math drain — forwardAmount + excesses > context.value ----------
  // Try to make the item pay out MORE than inbound value from its own balance.
  {
    const { item, addr } = await freshItem(bc, toNano('5')); // fat item balance to drain
    const balBefore = (await bc.getContract(addr)).balance;
    // forwardAmount close to inbound; response present -> excesses tries to pay rest.
    // If restAmount computed wrong, item pays forward + excesses from own balance.
    const inbound = 100_000_000n;
    const body = transferBody({ newOwner: ATTACKER, responseDest: ATTACKER, forwardAmount: inbound }); // forward == full inbound
    const res = await sendRaw(bc, OWNER, addr, inbound, body, lt++);
    const itemTx = res.transactions.find((t: any) => t.inMessage?.info?.dest?.equals(addr));
    const p = phase(itemTx);
    const balAfter = (await bc.getContract(addr)).balance;
    // count outbound value from item
    let paidOut = 0n;
    for (const tx of res.transactions) {
      if (isInternalFrom(tx, addr)) paidOut += msgValue(tx);
    }
    const drained = balBefore - balAfter;
    record('C1 forward==inbound drains item balance', (p.compute!==0 || balAfter >= balBefore - 3_000_000n) ? 'FAILED' : 'SUCCEEDED',
      `item bal before=${balBefore} after=${balAfter} drop=${drained}. compute exit=${p.compute} (18035 if guard fired). paidOut(from item)=${paidOut}, inbound=${inbound}. Guard: restAmount = value - 2M - forward - fwdAllowance must be >=0.`);
  }

  // ---------- ATTACK C2: forwardAmount so large restAmount<0 but guard uses stale? ----------
  {
    const { item, addr } = await freshItem(bc, toNano('5'));
    const balBefore = (await bc.getContract(addr)).balance;
    const inbound = 50_000_000n;
    const body = transferBody({ newOwner: ATTACKER, responseDest: ATTACKER, forwardAmount: 1_000_000_000n }); // forward >> inbound
    const res = await sendRaw(bc, OWNER, addr, inbound, body, lt++);
    const itemTx = res.transactions.find((t: any) => t.inMessage?.info?.dest?.equals(addr));
    const p = phase(itemTx);
    const balAfter = (await bc.getContract(addr)).balance;
    const owner = (await item.getGetState()).owner_wallet;
    record('C2 forward >> inbound (over-forward drain)', (p.compute===0 && balAfter < balBefore - 3_000_000n) ? 'SUCCEEDED' : 'FAILED',
      `inbound=${inbound}, forward=1e9. compute exit=${p.compute} (expect 18035). bal before=${balBefore} after=${balAfter}. owner changed=${owner.equals(ATTACKER)}. If guard threw, state reverts, no drain.`);
  }

  // ---------- ATTACK C3: excesses to attacker-chosen dest larger than inbound ----------
  {
    const { item, addr } = await freshItem(bc, toNano('5'));
    const balBefore = (await bc.getContract(addr)).balance;
    const inbound = 30_000_000n; // small inbound, response present -> restAmount = 30M - 2M - 0 - 10M = 18M excesses
    const body = transferBody({ newOwner: ATTACKER, responseDest: RANDO, forwardAmount: 0n });
    const res = await sendRaw(bc, OWNER, addr, inbound, body, lt++);
    const itemTx = res.transactions.find((t: any) => t.inMessage?.info?.dest?.equals(addr));
    const p = phase(itemTx);
    // excesses out value
    let excessOut = 0n;
    for (const tx of res.transactions) {
      if (isInternalTo(tx, addr, RANDO)) excessOut += msgValue(tx);
    }
    const balAfter = (await bc.getContract(addr)).balance;
    record('C3 excesses exceed inbound (leak from balance)', (excessOut > inbound || balAfter < balBefore - 3_000_000n) ? 'SUCCEEDED' : 'FAILED',
      `inbound=${inbound}. excess paid to RANDO=${excessOut} (must be < inbound-reserve-allowance ~18M). bal before=${balBefore} after=${balAfter}. compute=${p.compute}.`);
  }

  // ---------- ATTACK D1: addr_none new owner (brick: NFT owned by nobody) ----------
  {
    const { item, addr } = await freshItem(bc, toNano('0.5'));
    const body = transferBody({ newOwner: 'none', responseDest: ATTACKER, forwardAmount: 0n });
    const res = await sendRaw(bc, OWNER, addr, 200_000_000n, body, lt++);
    const itemTx = res.transactions.find((t: any) => t.inMessage?.info?.dest?.equals(addr));
    const p = phase(itemTx);
    const owner = (await item.getGetState()).owner_wallet;
    // isBasechainAddress(addr_none) — parseStdAddress on addr_none should throw or fail guard 18032.
    record('D1 addr_none new owner bricks NFT', (p.compute===0 && !owner.equals(OWNER)) ? 'SUCCEEDED' : 'FAILED',
      `new owner = addr_none. compute exit=${p.compute} (expect throw: parseStdAddress on addr_none, or 18032). owner after=${owner.equals(OWNER)?'OWNER (unchanged)':'CHANGED/none'}.`);
  }

  // ---------- ATTACK D2: addr_none response_destination (legit per TEP; check no leak) ----------
  {
    const { item, addr } = await freshItem(bc, toNano('0.5'));
    const balBefore = (await bc.getContract(addr)).balance;
    const body = transferBody({ newOwner: ATTACKER, responseDest: 'none', forwardAmount: 10_000_000n });
    const res = await sendRaw(bc, OWNER, addr, 200_000_000n, body, lt++);
    const itemTx = res.transactions.find((t: any) => t.inMessage?.info?.dest?.equals(addr));
    const p = phase(itemTx);
    const owner = (await item.getGetState()).owner_wallet;
    const balAfter = (await bc.getContract(addr)).balance;
    record('D2 addr_none response no-excess (legit)', 'FAILED',
      `addr_none response. compute=${p.compute} action=${p.action}. owner=${owner.equals(ATTACKER)?'ATTACKER (legit)':'?'} bal ${balBefore}->${balAfter}. No excess msg should be sent (hasResponseDestination=false).`);
  }

  // ---------- ATTACK E1: re-init a live item (InitializeUsernameItem to change owner) ----------
  {
    const { item, addr } = await freshItem(bc, toNano('0.5'));
    // attacker tries to re-init from REGISTRY-spoof (can't spoof src), and from REGISTRY legit (should hit 18011).
    const body = beginCell()
      .storeUint(0x554E494E, 32)
      .storeAddress(ATTACKER)      // owner_wallet
      .storeUint(6, 8)             // username_len
      .storeBuffer(Buffer.from('victim', 'ascii'))
      .endCell();
    const res = await sendRaw(bc, REGISTRY, addr, 100_000_000n, body, lt++);
    const itemTx = res.transactions.find((t: any) => t.inMessage?.info?.dest?.equals(addr));
    const p = phase(itemTx);
    const owner = (await item.getGetState()).owner_wallet;
    record('E1 re-init changes owner', (p.compute===0 && owner.equals(ATTACKER)) ? 'SUCCEEDED' : 'FAILED',
      `re-init from REGISTRY. compute exit=${p.compute} (expect 18011 !initialized). owner after=${owner.equals(OWNER)?'OWNER (unchanged)':'ATTACKER (RE-INIT)'}.`);
  }

  // ---------- ATTACK E2: InitializeUsernameItem from non-registry sender ----------
  {
    const hash = nameHash('victim');
    const init = await UsernameNFTItem.init(REGISTRY, hash);
    const addr = contractAddress(0, init);
    await bc.setShardAccount(addr, createShardAccount({
      address: addr, code: init.code, data: init.data, balance: toNano('0.5'), workchain: 0,
    }));
    const item = bc.openContract(new UsernameNFTItem(addr, init));
    // uninitialized item; attacker (not registry) tries to initialize with themselves as owner
    const body = beginCell()
      .storeUint(0x554E494E, 32)
      .storeAddress(ATTACKER)
      .storeUint(6, 8)
      .storeBuffer(Buffer.from('victim', 'ascii'))
      .endCell();
    const res = await sendRaw(bc, ATTACKER, addr, 100_000_000n, body, lt++);
    const itemTx = res.transactions.find((t: any) => t.inMessage?.info?.dest?.equals(addr));
    const p = phase(itemTx);
    const st = await item.getGetState();
    record('E2 non-registry initializes item', (p.compute===0 && st.initialized && st.owner_wallet.equals(ATTACKER)) ? 'SUCCEEDED' : 'FAILED',
      `attacker inits uninitialized item. compute exit=${p.compute} (expect 18010 sender!=registry). initialized=${st.initialized} owner=${st.owner_wallet.equals(ATTACKER)?'ATTACKER':'registry/other'}.`);
  }

  // ---------- ATTACK E3: ResendDeployedAck abuse (drain via ack forward) ----------
  {
    const { item, addr } = await freshItem(bc, toNano('0.5'));
    const balBefore = (await bc.getContract(addr)).balance;
    // Send max value; ack forwards ACK_FORWARD_RESERVE to registry. Spam to drain? Value cap 20M.
    const body = beginCell().storeUint(0x639CFC6C, 32).endCell();
    // Try with value ABOVE the 20M cap -> should throw 18022 (fail-closed, no drain)
    const resHigh = await sendRaw(bc, ATTACKER, addr, 100_000_000n, body, lt++);
    const txHigh = resHigh.transactions.find((t: any) => t.inMessage?.info?.dest?.equals(addr));
    const pHigh = phase(txHigh);
    // legit-value resend from attacker (permissionless): does it drain item balance?
    const resOk = await sendRaw(bc, ATTACKER, addr, 10_000_000n, body, lt++);
    const txOk = resOk.transactions.find((t: any) => t.inMessage?.info?.dest?.equals(addr));
    const pOk = phase(txOk);
    let ackOut = 0n;
    for (const tx of resOk.transactions) {
      if (isInternalFrom(tx, addr)) ackOut += msgValue(tx);
    }
    const balAfter = (await bc.getContract(addr)).balance;
    const drainedFromBalance = balBefore - balAfter;
    record('E3 ResendDeployedAck drains item balance', drainedFromBalance > 5_000_000n ? 'SUCCEEDED' : 'FAILED',
      `high-value(100M) resend compute=${pHigh.compute} (expect 18022 cap). legit(10M) resend compute=${pOk.compute} ackOut=${ackOut}. item bal ${balBefore}->${balAfter} net drop=${drainedFromBalance}. Attacker pays the 10M inbound; ack forward (3M) funded by inbound not balance.`);
  }

  // ---------- SUMMARY ----------
  console.log('\n\n========== RED-TEAM SUMMARY ==========');
  let anySucceeded = false;
  for (const r of results) {
    if (r.verdict.startsWith('SUCCEEDED') && !r.verdict.includes('expected legit')) anySucceeded = true;
    console.log(`${r.verdict.padEnd(22)} ${r.name}`);
  }
  console.log(`\nANY REAL EXPLOIT SUCCEEDED: ${anySucceeded}`);
}

main().catch((e) => { console.error('SUITE ERROR:', e); process.exit(1); });
