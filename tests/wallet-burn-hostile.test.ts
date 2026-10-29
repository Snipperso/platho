import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Blockchain } from '@ton/sandbox';
import { Cell, WalletContractV5R1, beginCell, contractAddress, internal, toNano } from '@ton/ton';
import { mnemonicNew, mnemonicToPrivateKey } from '@ton/crypto';
import { compileFunc } from '@ton-community/func-js';
import { BURN_ADDRESS, BURN_VALUE_NANOTONS, buildJettonTransferBody, buildNftTransferBody } from '../web/wallet-transfers.mjs';
import { serializeBoc } from '../web/pwa-contract-transactions.mjs';


const evilSource = readFileSync('tests/fixtures/hostile-junk-contract.fc', 'utf8');
const toCore = (appCell: unknown) => Cell.fromBoc(Buffer.from(serializeBoc(appCell)))[0];

async function burnInto(kind: 'token' | 'nft', { ownerInstalledEvilAsExtension = false } = {}) {
  const compiled: any = await compileFunc({ targets: ['evil.fc'], sources: { 'evil.fc': evilSource } });
  if (compiled.status !== 'ok') throw new Error(compiled.message);
  const evilCode = Cell.fromBase64(compiled.codeBoc);
  const chain = await Blockchain.create();
  const treasury = await chain.treasury('treasury');
  const attacker = await chain.treasury('attacker');
  const keys = await mnemonicToPrivateKey(await mnemonicNew());
  const wallet = chain.openContract(WalletContractV5R1.create({ workchain: 0, publicKey: keys.publicKey }));
  await treasury.send({ to: wallet.address, value: toNano('10'), bounce: false });
  await wallet.sendTransfer({ seqno: 0, secretKey: keys.secretKey, sendMode: 3, messages: [internal({ to: treasury.address, value: toNano('0.01'), bounce: false })] });
  const data = beginCell().storeAddress(attacker.address).endCell();
  const evil = contractAddress(0, { code: evilCode, data });
  await treasury.send({ to: evil, value: toNano('0.02'), bounce: false, init: { code: evilCode, data } });
  if (ownerInstalledEvilAsExtension) await wallet.sendAddExtension({ seqno: await wallet.getSeqno(), secretKey: keys.secretKey, extensionAddress: evil });
  const self = wallet.address.toRawString();
  const body = toCore(kind === 'token'
    ? buildJettonTransferBody({ queryId: 1n, amount: 123456789n, destination: BURN_ADDRESS, responseDestination: self, forwardTonAmount: 0n })
    : buildNftTransferBody({ queryId: 1n, newOwner: BURN_ADDRESS, responseDestination: self, forwardAmount: 0n }));
  const before = (await chain.getContract(wallet.address)).balance;
  const result = await wallet.sendTransfer({ seqno: await wallet.getSeqno(), secretKey: keys.secretKey, sendMode: 3,
    messages: [internal({ to: evil, value: BURN_VALUE_NANOTONS, bounce: true, body })] });
  const lost = before - (await chain.getContract(wallet.address)).balance;
  const unsignedSends = result.transactions
    .filter((tx: any) => tx.inMessage?.info?.dest?.equals?.(wallet.address) && tx.inMessage.info.type !== 'external-in')
    .reduce((sum: number, tx: any) => sum + tx.outMessagesCount, 0);
  return { lost, unsignedSends };
}

describe('burning junk cannot drain the wallet', () => {
  it('BURN-HOSTILE-01: a junk token\'s or NFT\'s hostile contract keeps at most the 0.05 GRAM the burn carried', async () => {
    for (const kind of ['token', 'nft'] as const) {
      const { lost, unsignedSends } = await burnInto(kind);
      expect(unsignedSends, `${kind}: nothing sent that the owner did not sign`).toBe(0);
      expect(lost <= BURN_VALUE_NANOTONS + toNano('0.01'), `${kind}: lost ${lost}`).toBe(true);
    }
  }, 60_000);

  it('BURN-HOSTILE-02 (control): the probe sees a drain — once the owner himself signs the hostile contract in as an extension', async () => {
    const { lost, unsignedSends } = await burnInto('token', { ownerInstalledEvilAsExtension: true });
    expect(unsignedSends).toBeGreaterThan(0);
    expect(lost > toNano('1')).toBe(true);
  }, 60_000);

  it('BURN-HOSTILE-03: the app never installs an extension — every transfer it signs says "no extended actions"', () => {
    const wallet = readFileSync('web/platho-wallet.mjs', 'utf8');
    expect(wallet).toContain(".uint(0n, 1, 'wallet.actions.extended_none');");
    expect(wallet).not.toMatch(/extended_some|add_extension|addExtension/);
    expect(wallet).toMatch(/const safeSendMode = sendMode \| 2;/);
  });
});
