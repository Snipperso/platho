import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Cell } from '@ton/core';
import * as sealed from '../web/shard-code-18.mjs';
import * as clean17Cells from '../web/shard-code.mjs';


const SEALED: Record<string, { name: string; hash: string; depth: number }> = {
  RECORDSHARD_CODE_BOC_18: { name: 'RecordShard', hash: '3a14d23b4d6512e46071cbd9d3f54ce46cce0373076bb4fc4297940083aab861', depth: 7 },
  INTROSHARD_CODE_BOC_18: { name: 'IntroShard', hash: '421f4553d6cfb2bd42f8958d89a55d9ee6fa5cca4b555278aaf15423854388c4', depth: 8 },
  PUBLICSHARD_CODE_BOC_18: { name: 'PublicShard', hash: '0e13cd438ed54f91ac305de069bf708d271852e0408b4e3262964ea8a84f1743', depth: 11 },
  FEEVAULT_CODE_BOC_18: { name: 'FeeVault', hash: '518d5ea091aa39845a1c4c9acac5da5d886ccf87823d796b19cb6ccca16f8b5b', depth: 10 },
  KEYSHARD_CODE_BOC_18: { name: 'KeyShard', hash: '6253fbab38916dd70fe5e718d924ddb6f17ebcf96a2f302a59f8e70a599dc0a0', depth: 8 },
  REPORTSHARD_CODE_BOC_18: { name: 'ReportShard', hash: '4468d6fc37a3b3ffcc728440bb17d764a631bbddfe37890e837ff1fd59e0e73a', depth: 9 },
  SANCTIONSHARD_CODE_BOC_18: { name: 'SanctionShard', hash: '521771ffefc4927a2a9c0f5557ed61846f585c646d6fd408d14540b39c98c6c7', depth: 6 },
};

const record = JSON.parse(readFileSync('artifacts/mainnet_clean18_ceremony.json', 'utf8'));

describe('GEN18-SEALED — the shipped generation-18 cells are the ones the ceremony deployed', () => {
  it('GEN18-SEALED-01: every cell in web/shard-code-18.mjs is the sealed one, hash AND depth', () => {
    const exported = Object.keys(sealed).sort();
    expect(exported, 'the module exports exactly the seven sealed cells').toEqual(Object.keys(SEALED).sort());
    for (const [key, want] of Object.entries(SEALED)) {
      const cell = Cell.fromBoc(Buffer.from((sealed as Record<string, string>)[key], 'base64'))[0];
      expect(cell.hash().toString('hex'), `${want.name}: code hash`).toBe(want.hash);
      expect(cell.depth(), `${want.name}: code depth`).toBe(want.depth);
    }
  });

  it('GEN18-SEALED-02: the literals are the ceremony record’s — two sources, one truth', () => {
    for (const want of Object.values(SEALED)) {
      expect(record.code_hashes[want.name], `the ceremony record names ${want.name}`).toBeTruthy();
      expect(record.code_hashes[want.name].hash, `${want.name}: record hash`).toBe(want.hash);
      expect(record.code_hashes[want.name].depth, `${want.name}: record depth`).toBe(want.depth);
    }
    expect(record.predecessor_keyshard_code_hash).toBe('81761197119847160003106cbbe7d9751f80d6683e0f5f609a61c9c8f9857dbd');
    const clean17 = Cell.fromBoc(Buffer.from(clean17Cells.KEYSHARD_CODE_BOC, 'base64'))[0];
    expect(clean17.hash().toString('hex'), 'the shipped clean-17 KeyShard cell is the predecessor the registry adopts from')
      .toBe(record.predecessor_keyshard_code_hash);
  });
});
