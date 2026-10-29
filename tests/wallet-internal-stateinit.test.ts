import { describe, expect, it } from 'vitest';
import { Address, beginCell, Cell, loadMessageRelaxed, toNano, contractAddress } from '@ton/core';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { buildIntroPublishBrowser } from '../web/intro-publish-browser.mjs';
import { beginCell as browserBeginCell, serializeBoc } from '../web/pwa-contract-transactions.mjs';
import { introShardStateInit } from '../web/shard-address.mjs';
import { storeInternalMessage } from '../web/platho-wallet.mjs';


const toCoreCell = (browserCell: any): Cell => Cell.fromBoc(Buffer.from(serializeBoc(browserCell)))[0];
const parse = (browserCell: any) => loadMessageRelaxed(toCoreCell(browserCell).beginParse());

describe('WALLET-INTERNAL-STATEINIT — a publish can create the shard it targets', () => {
  it('WSI-01: without a stateInit the message parses as before — the existing send path is untouched', () => {
    const dest = Address.parse('UQDoCopn5mJ2r1iXlKkMF9bIguCeTGrY5x9cZAP04V5oOATH');
    const payload = beginCell().storeUint(0xdeadbeef, 32).endCell();

    const msg = parse(storeInternalMessage({
      address: dest.toString(), amount: toNano('0.05').toString(),
      payload: payload.toBoc().toString('base64'), bounce: true,
    }));

    expect(msg.info.type).toBe('internal');
    const info = msg.info as any;
    expect(info.dest.toRawString(), 'destination').toBe(dest.toRawString());
    expect(info.value.coins, 'value').toBe(toNano('0.05'));
    expect(info.bounce, 'bounce').toBe(true);
    expect(info.ihrDisabled, 'ihr disabled').toBe(true);
    expect(msg.init, 'no init when none was asked for').toBeFalsy();
    expect(msg.body.hash().toString('hex'), 'body').toBe(payload.hash().toString('hex'));
  });

  it('WSI-02: bounce:false is carried through — a non-bounceable transfer stays non-bounceable', () => {
    const dest = Address.parse('UQDoCopn5mJ2r1iXlKkMF9bIguCeTGrY5x9cZAP04V5oOATH');
    const msg = parse(storeInternalMessage({ address: dest.toString(), amount: '1', bounce: false }));
    expect((msg.info as any).bounce, 'a false bounce flag must survive serialization').toBe(false);
  });

  it('WSI-03: with a stateInit @ton/core parses BOTH the init and the body', async () => {
    const epoch = 20_000;
    const bucket = 7n;
    const init = introShardStateInit(epoch, Number(bucket));
    const coreInit = toCoreCell(init);
    const dest = contractAddress(0, await IntroShard.init(BigInt(epoch), bucket));
    const payload = beginCell().storeUint(0x49535031, 32).endCell();

    const msg = parse(storeInternalMessage({
      address: dest.toString(), amount: toNano('0.02').toString(),
      payload: payload.toBoc().toString('base64'), bounce: true, stateInit: init,
    }));

    expect(msg.init, 'the init must be present').toBeTruthy();
    expect(msg.init!.code!.hash().toString('hex'), 'code cell survived')
      .toBe(coreInit.refs[0].hash().toString('hex'));
    expect(msg.init!.data!.hash().toString('hex'), 'data cell survived')
      .toBe(coreInit.refs[1].hash().toString('hex'));
    expect(msg.body.hash().toString('hex'), 'and the body is still the body')
      .toBe(payload.hash().toString('hex'));
    expect((msg.info as any).dest.toRawString(), 'sent to the shard itself').toBe(dest.toRawString());
  });

  it('WSI-04: the attached init deploys EXACTLY the address being sent to', async () => {
    const epoch = 20_000;
    const bucket = 7n;
    const built = await buildIntroPublishBrowser({
      epoch, bucket, r: 1n, viewTag: 2n,
      header0: browserBeginCell().uint(1n, 8, 'h').endCell(),
      body: browserBeginCell().uint(2n, 8, 'b').endCell(),
      value: 15_610_000n,
    });

    const coreInit = toCoreCell(built.init);
    const derived = contractAddress(0, { code: coreInit.refs[0], data: coreInit.refs[1] });
    expect(derived.toRawString(), 'the StateInit deploys exactly the shard being addressed')
      .toBe(Address.parse(built.to).toRawString());

    const wrapper = await IntroShard.init(BigInt(epoch), bucket);
    expect(coreInit.refs[0].hash().toString('hex'), 'the code cell is the compiled IntroShard')
      .toBe(wrapper.code.hash().toString('hex'));
    expect(derived.toRawString(), 'and the whole init derives the wrapper address')
      .toBe(contractAddress(0, wrapper).toRawString());
  });
});
