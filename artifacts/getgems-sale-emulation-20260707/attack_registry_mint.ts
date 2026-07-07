// RED-TEAM: UsernameRegistry mint->item flow attacks.
// Run: npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" artifacts/getgems-sale-emulation-20260707/attack_registry_mint.ts
import { Address, beginCell, contractAddress, toNano, Cell } from '@ton/core';
import { Blockchain, createShardAccount, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  UsernameRegistry,
  BindOfficialAthWallet,
  BindUsernameVault,
  SealGenesis,
  AthTransferNotificationVaultMintUsername,
} from '../../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import {
  UsernameNFTItem,
  UsernameItemDeployedAck,
  NftTransfer,
} from '../../build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem';

const MANIFEST_HASH = 0x9999888877776666555544443333222211110000ffffeeeeddddccccbbbbaaaan;
const NAME_HASH_DOMAIN = 0xC5CC7CD6n;
const PRICE_6_PLUS = 100_000_000_000n;

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}
function usernameSlice(name: string) {
  return beginCell().storeBuffer(Buffer.from(name, 'ascii')).endCell().beginParse();
}
function nameHash(name: string): bigint {
  return BigInt('0x' + beginCell().storeUint(NAME_HASH_DOMAIN, 32)
    .storeBuffer(Buffer.from(name, 'ascii')).endCell().hash().toString('hex'));
}
function senderForAddress(blockchain: Blockchain, address: Address) {
  return { address, getSender: () => blockchain.sender(address) };
}
function phase(tx: any) {
  const d = tx.description;
  const compute = d.computePhase?.type === 'vm' ? d.computePhase.exitCode : d.computePhase?.type;
  const action = d.actionPhase ? d.actionPhase.resultCode : 'none';
  return { compute, action, aborted: d.aborted };
}
function txExit(res: any): { compute: any; action: any; aborted: any } {
  // last transaction in the result that has a compute phase for the target
  const txs = res.transactions;
  return phase(txs[txs.length - 1]);
}
// exit code of the tx whose message went TO `addr`
function txExitTo(res: any, addr: Address): { compute: any; action: any; aborted: any } | null {
  for (const tx of res.transactions) {
    const dest = tx.inMessage?.info?.dest;
    if (dest && typeof dest !== 'string' && dest.equals && dest.equals(addr)) return phase(tx);
  }
  return null;
}

async function deploySealedRegistry() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const deployer = await blockchain.treasury('reg-deployer');
  const attacker = await blockchain.treasury('reg-attacker');
  const placeholderAthWallet = fixtureAddress('PH_ATH_WALLET');
  const athMasterAddress = fixtureAddress('ATH_MASTER');
  const treasuryAthReceiver = fixtureAddress('TREASURY_ATH_RECEIVER');
  const vaultAddress = fixtureAddress('VAULT');

  const registryInit = await UsernameRegistry.init(placeholderAthWallet, athMasterAddress, treasuryAthReceiver, false, 0n, 0n, deployer.address);
  const registryAddress = contractAddress(0, registryInit);
  await blockchain.setShardAccount(registryAddress, createShardAccount({
    address: registryAddress, code: registryInit.code, data: registryInit.data,
    balance: toNano('2'), workchain: 0,
  }));
  const registry = blockchain.openContract(new UsernameRegistry(registryAddress, registryInit));
  const officialAthWalletAddress = await registry.getGetAthWalletAddress(registryAddress);
  const officialAthWallet = senderForAddress(blockchain, officialAthWalletAddress);

  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindOfficialAthWallet', deployment_manifest_hash: MANIFEST_HASH,
    official_ath_wallet_address: officialAthWalletAddress,
  } as BindOfficialAthWallet);
  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindUsernameVault', deployment_manifest_hash: MANIFEST_HASH, vault_address: vaultAddress,
  } as BindUsernameVault);
  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis', deployment_manifest_hash: MANIFEST_HASH,
  } as SealGenesis);

  return { blockchain, registry, registryAddress, officialAthWallet, officialAthWalletAddress, attacker, vaultAddress, deployer };
}

function mintBody(name: string, owner: Address, amount: bigint, payer: Address): AthTransferNotificationVaultMintUsername {
  return {
    $$type: 'AthTransferNotificationVaultMintUsername',
    query_id: 1n, sender_key: 0n, amount, payer_wallet: payer, owner_wallet: owner,
    username_len: BigInt(Buffer.from(name, 'ascii').length), username: usernameSlice(name),
  };
}

const results: string[] = [];
function log(s: string) { console.log(s); results.push(s); }

async function main() {
  // ============ ATTACK A: spoof mint notification from attacker (free mint / no payment) ============
  {
    const env = await deploySealedRegistry();
    const owner = fixtureAddress('VICTIM_OWNER');
    // attacker sends the mint notification directly, NOT via official ATH wallet
    const res = await env.registry.send(env.attacker.getSender(), { value: toNano('0.6') },
      mintBody('attackername', owner, PRICE_6_PLUS, env.vaultAddress));
    const ex = txExitTo(res, env.registryAddress);
    const rec = await env.registry.getGetNameRecord(nameHash('attackername'));
    const pend = await env.registry.getGetPendingMint(nameHash('attackername'));
    log(`ATTACK A (spoof sender free mint): registry_compute=${ex?.compute} name_registered=${rec.exists} pending=${pend.exists} => ${(!rec.exists && !pend.exists) ? 'FAILED(defended)' : 'SUCCEEDED'}`);
  }

  // ============ ATTACK B: official wallet sender but spoofed payer_wallet (bypass payer bind) ============
  {
    const env = await deploySealedRegistry();
    const owner = fixtureAddress('VICTIM_OWNER');
    const res = await env.registry.send(env.officialAthWallet.getSender(), { value: toNano('0.6') },
      mintBody('payerspoof', owner, PRICE_6_PLUS, env.attacker.address)); // wrong payer
    const ex = txExit(res);
    const pend = await env.registry.getGetPendingMint(nameHash('payerspoof'));
    log(`ATTACK B (spoofed payer_wallet): compute=${ex.compute} pending=${pend.exists} => ${(!pend.exists) ? 'FAILED(defended)' : 'SUCCEEDED'}`);
  }

  // ============ ATTACK C: underpayment (amount < price) via official wallet ============
  {
    const env = await deploySealedRegistry();
    const owner = fixtureAddress('VICTIM_OWNER');
    const res = await env.registry.send(env.officialAthWallet.getSender(), { value: toNano('0.6') },
      mintBody('underpay', owner, PRICE_6_PLUS - 1n, env.vaultAddress));
    const ex = txExit(res);
    const pend = await env.registry.getGetPendingMint(nameHash('underpay'));
    log(`ATTACK C (underpay amount): compute=${ex.compute} pending=${pend.exists} => ${(!pend.exists) ? 'FAILED(defended)' : 'SUCCEEDED'}`);
  }

  // ============ ATTACK D: forge UsernameItemDeployedAck from a non-item sender (free finalize / register name w/o paying, or hijack) ============
  {
    const env = await deploySealedRegistry();
    const owner = fixtureAddress('VICTIM_OWNER');
    // attacker forges the finalization ACK directly
    const res = await env.registry.send(env.attacker.getSender(), { value: toNano('0.1') }, {
      $$type: 'UsernameItemDeployedAck', name_hash: nameHash('forgeack'), owner_wallet: owner,
    } as UsernameItemDeployedAck);
    const ex = txExitTo(res, env.registryAddress);
    const rec = await env.registry.getGetNameRecord(nameHash('forgeack'));
    log(`ATTACK D (forge deployed-ACK): registry_compute=${ex?.compute} name_registered=${rec.exists} => ${(!rec.exists) ? 'FAILED(defended)' : 'SUCCEEDED'}`);
  }

  // ============ ATTACK E: legit mint then attacker double-mints same name (hijack pending) ============
  {
    const env = await deploySealedRegistry();
    const owner = fixtureAddress('LEGIT_OWNER');
    // legit mint (creates pending + deploys item)
    await env.registry.send(env.officialAthWallet.getSender(), { value: toNano('0.6') },
      mintBody('takenname', owner, PRICE_6_PLUS, env.vaultAddress));
    // attacker attempts to re-mint same name to hijack, via official wallet (worst case: attacker controls official wallet msg? no — but test dup guard)
    const res = await env.registry.send(env.officialAthWallet.getSender(), { value: toNano('0.6') },
      mintBody('takenname', fixtureAddress('HIJACKER'), PRICE_6_PLUS, env.vaultAddress));
    const ex = txExitTo(res, env.registryAddress);
    // legit mint auto-finalizes in sandbox; verify the FINAL on-chain item owner is still the legit owner.
    const recTaken = await env.registry.getGetNameRecord(nameHash('takenname'));
    const itemTaken = env.blockchain.openContract(new UsernameNFTItem(recTaken.item_address,
      await UsernameNFTItem.init(env.registryAddress, nameHash('takenname'))));
    let ownerTaken: Address | null = null; try { ownerTaken = (await itemTaken.getGetState()).owner_wallet; } catch {}
    const legitIntact = recTaken.exists && ownerTaken != null && ownerTaken.equals(owner);
    log(`ATTACK E (double-mint dup): registry_compute=${ex?.compute} name_registered=${recTaken.exists} item_owner_is_legit=${legitIntact} => ${((ex?.compute === 19172 || ex?.compute === 19173) && legitIntact) ? 'FAILED(defended, dup rejected)' : (legitIntact ? 'FAILED(legit owner intact)' : 'SUCCEEDED(hijacked)')}`);
  }

  // ============ ATTACK F: full legit mint to completion, then re-mint registered name ============
  {
    const env = await deploySealedRegistry();
    const owner = fixtureAddress('LEGIT_OWNER2');
    await env.registry.send(env.officialAthWallet.getSender(), { value: toNano('0.6') },
      mintBody('donebro', owner, PRICE_6_PLUS, env.vaultAddress));
    // The item deploy + ACK happens automatically via message routing in sandbox.
    const rec1 = await env.registry.getGetNameRecord(nameHash('donebro'));
    // now attacker tries to re-register the finalized name
    const res = await env.registry.send(env.officialAthWallet.getSender(), { value: toNano('0.6') },
      mintBody('donebro', fixtureAddress('HIJACKER2'), PRICE_6_PLUS, env.vaultAddress));
    const ex = txExitTo(res, env.registryAddress);
    const item = env.blockchain.openContract(new UsernameNFTItem(rec1.item_address,
      await UsernameNFTItem.init(env.registryAddress, nameHash('donebro'))));
    let ownerAfter: Address | null = null;
    try { ownerAfter = (await item.getGetState()).owner_wallet; } catch {}
    log(`ATTACK F (re-register finalized name): name1_registered=${rec1.exists} re-mint registry_compute=${ex?.compute} item_owner_still_legit=${ownerAfter?.equals(owner)} => ${(rec1.exists && ex?.compute === 19172 && ownerAfter?.equals(owner)) ? 'FAILED(defended, name_records dup)' : (ownerAfter?.equals(owner) ? 'FAILED(owner intact)' : 'SUCCEEDED(hijacked)')}`);
  }

  // ============ ATTACK G: hijack someone else's item via NftTransfer (not the owner) ============
  {
    const env = await deploySealedRegistry();
    const owner = fixtureAddress('ITEM_OWNER');
    await env.registry.send(env.officialAthWallet.getSender(), { value: toNano('0.6') },
      mintBody('myitem', owner, PRICE_6_PLUS, env.vaultAddress));
    const rec = await env.registry.getGetNameRecord(nameHash('myitem'));
    const itemInit = await UsernameNFTItem.init(env.registryAddress, nameHash('myitem'));
    const item = env.blockchain.openContract(new UsernameNFTItem(rec.item_address, itemInit));
    const before = (await item.getGetState()).owner_wallet;
    // attacker (not owner) attempts NftTransfer to themselves
    const payload = beginCell().storeAddress(env.attacker.address).storeUint(0, 2).storeMaybeRef(null).storeCoins(0n).storeBit(0).endCell().beginParse();
    const res = await item.send(env.attacker.getSender(), { value: toNano('0.2') }, {
      $$type: 'NftTransfer', query_id: 7n, payload,
    } as NftTransfer);
    const ex = txExitTo(res, rec.item_address);
    const after = (await item.getGetState()).owner_wallet;
    log(`ATTACK G (hijack item via NftTransfer non-owner): item_compute=${ex?.compute} owner_unchanged=${before.equals(after)} => ${(before.equals(after)) ? 'FAILED(defended)' : 'SUCCEEDED'}`);
  }

  // ============ ATTACK H: item pays excesses from own balance (drain) via crafted forward/response ============
  {
    const env = await deploySealedRegistry();
    const owner = await env.blockchain.treasury('item-real-owner');
    await env.registry.send(env.officialAthWallet.getSender(), { value: toNano('0.6') },
      mintBody('draintest', owner.address, PRICE_6_PLUS, env.vaultAddress));
    const rec = await env.registry.getGetNameRecord(nameHash('draintest'));
    const itemInit = await UsernameNFTItem.init(env.registryAddress, nameHash('draintest'));
    const item = env.blockchain.openContract(new UsernameNFTItem(rec.item_address, itemInit));
    const balBefore = (await env.blockchain.getContract(rec.item_address)).balance;
    // owner transfers with forwardAmount close to inbound value + response destination = attacker, trying to make item overpay
    const inbound = toNano('0.05');
    const payload = beginCell().storeAddress(env.attacker.address /*new owner*/)
      .storeAddress(env.attacker.address /*response dest*/)
      .storeMaybeRef(null).storeCoins(toNano('0.04') /*forward*/).storeBit(0).endCell().beginParse();
    const res = await item.send(owner.getSender(), { value: inbound }, {
      $$type: 'NftTransfer', query_id: 9n, payload,
    } as NftTransfer);
    const ex = txExit(res);
    const balAfter = (await env.blockchain.getContract(rec.item_address)).balance;
    // If item drained (balance dropped a lot below reserve), that's the v1 defect.
    log(`ATTACK H (item self-pay drain, tight budget): compute=${ex.compute} balBefore=${balBefore} balAfter=${balAfter} delta=${balBefore - balAfter} => ${(ex.compute === 18035) ? 'FAILED(defended, restAmount guard threw)' : (balAfter >= balBefore - inbound ? 'FAILED(no self-pay, conserved)' : 'SUCCEEDED(drained)')}`);
  }

  // ============ ATTACK I: pending-mint stuck/unrecoverable — prune always throws 19307 ============
  {
    const env = await deploySealedRegistry();
    const owner = fixtureAddress('STUCK_OWNER');
    // Use a MOCK item that never ACKs? Instead: cause item deploy but no ACK by draining item value below ACK reserve.
    // Simpler: create pending then advance time and attempt prune. By design prune throws 19307.
    await env.registry.send(env.officialAthWallet.getSender(), { value: toNano('0.6') },
      mintBody('stuckname', owner, PRICE_6_PLUS, env.vaultAddress));
    // Note: in sandbox the item auto-deploys+ACKs, so pending clears. This attack targets the *policy* that
    // prune is a hard no-op. We assert whether a genuinely-stuck pending could ever be recovered.
    const pendAfter = await env.registry.getGetPendingMint(nameHash('stuckname'));
    log(`ATTACK I (pending recoverability): auto-finalized pending_exists=${pendAfter.exists} (see notes) => policy: prune ALWAYS throws 19307 by design`);
  }

  // ============ ATTACK B2/C2: explicit registry-tx exit for payer-spoof & underpay ============
  {
    const env = await deploySealedRegistry();
    const owner = fixtureAddress('VO');
    const rB = await env.registry.send(env.officialAthWallet.getSender(), { value: toNano('0.6') },
      mintBody('payerspoof2', owner, PRICE_6_PLUS, env.attacker.address));
    const exB = txExitTo(rB, env.registryAddress);
    const rC = await env.registry.send(env.officialAthWallet.getSender(), { value: toNano('0.6') },
      mintBody('underpay2', owner, PRICE_6_PLUS - 1n, env.vaultAddress));
    const exC = txExitTo(rC, env.registryAddress);
    log(`ATTACK B2/C2 registry exits: payer_spoof=${exB?.compute} (expect 19182)  underpay=${exC?.compute} (expect 19171)`);
  }

  // ============ ATTACK J: front-run — pre-deploy REAL item at the name's deterministic address, then trigger mint ============
  {
    const env = await deploySealedRegistry();
    const owner = fixtureAddress('FR_OWNER');
    const h = nameHash('frontrun');
    const itemInit = await UsernameNFTItem.init(env.registryAddress, h);
    const itemAddr = contractAddress(0, itemInit);
    // attacker pre-deploys the real item code at the deterministic address, funds it
    await env.blockchain.setShardAccount(itemAddr, createShardAccount({
      address: itemAddr, code: itemInit.code, data: itemInit.data, balance: toNano('0.5'), workchain: 0,
    }));
    const itemPre = env.blockchain.openContract(new UsernameNFTItem(itemAddr, itemInit));
    // attacker tries to initialize it themselves (spoof registry) -> should throw 18010
    let preInitExit: any = 'n/a';
    try {
      const pr = await itemPre.send(env.attacker.getSender(), { value: toNano('0.1') }, {
        $$type: 'InitializeUsernameItem', owner_wallet: env.attacker.address,
        username_len: 8n, username: usernameSlice('frontrun'),
      } as any);
      preInitExit = txExitTo(pr, itemAddr)?.compute;
    } catch (e: any) { preInitExit = 'throw'; }
    const preState = await itemPre.getGetState();
    // now the legit mint fires
    const res = await env.registry.send(env.officialAthWallet.getSender(), { value: toNano('0.6') },
      mintBody('frontrun', owner, PRICE_6_PLUS, env.vaultAddress));
    const rec = await env.registry.getGetNameRecord(h);
    const postState = await itemPre.getGetState();
    const legit = rec.exists && postState.owner_wallet.equals(owner) && postState.initialized;
    log(`ATTACK J (front-run pre-deploy item): attacker_init_exit=${preInitExit} pre_initialized=${preState.initialized} => after legit mint: registered=${rec.exists} item_owner_legit=${legit} => ${legit ? 'FAILED(defended, mint owns item)' : 'SUCCEEDED(front-run stole/bricked)'}`);
  }

  // ============ ATTACK K: mint before genesis seal (unsealed registry) ============
  {
    const blockchain = await Blockchain.create();
    blockchain.now = 1_700_000_000;
    const deployer = await blockchain.treasury('k-deployer');
    const ph = fixtureAddress('PH_ATH_WALLET');
    const am = fixtureAddress('ATH_MASTER');
    const tr = fixtureAddress('TREASURY_ATH_RECEIVER');
    const init = await UsernameRegistry.init(ph, am, tr, false, 0n, 0n, deployer.address);
    const addr = contractAddress(0, init);
    await blockchain.setShardAccount(addr, createShardAccount({ address: addr, code: init.code, data: init.data, balance: toNano('2'), workchain: 0 }));
    const reg = blockchain.openContract(new UsernameRegistry(addr, init));
    const off = senderForAddress(blockchain, await reg.getGetAthWalletAddress(addr));
    // NOT sealed; official wallet not bound. Fire mint.
    const res = await reg.send(off.getSender(), { value: toNano('0.6') }, mintBody('unsealed', fixtureAddress('UO'), PRICE_6_PLUS, tr));
    const ex = txExitTo(res, addr);
    const pend = await reg.getGetPendingMint(nameHash('unsealed'));
    log(`ATTACK K (mint before seal): registry_compute=${ex?.compute} (expect 19100 requireSealed) pending=${pend.exists} => ${(!pend.exists) ? 'FAILED(defended)' : 'SUCCEEDED'}`);
  }

  console.log('\n==== SUMMARY ====');
  for (const r of results) console.log(r);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
