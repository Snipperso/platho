import { describe, expect, it } from 'vitest';
import {
  CLOUD_RECORD_FIELDS, CLOUD_WALLET_PREFIX, DEVICE_WALLETS_MAX, LEGACY_CLOUD_SLOT_KEY, SIGNED_FIELDS, WALLET_RECORD_KIND,
  cloudFormOf, cloudKeyFor, cloudValueFor, counted, isCloudWalletKey, isSigned, isUntaggedCloudKey, keyringFind, keyringForget, keyringPut, keyringRecords,
  keyringWithout, newerSeal, nextSeq, normalizeKeyring, parseCloudValue, planWalletSync, recordSeq, sameWallet, sealedFieldsText, supersedes, SEQ_CEILING,
} from '../web/wallet-keyring.mjs';
import * as keyringModule from '../web/wallet-keyring.mjs';


const owner = (n: number) => `o1:${n.toString(16).padStart(32, '0')}`;
const b64 = (text: string) => Buffer.from(text.padEnd(24, '.')).toString('base64');
const seal = (wallet: number, seq: number, extra: Record<string, any> = {}) => ({
  kind: WALLET_RECORD_KIND, version: 1, kdf: 'pbkdf2', iterations: 600_000, salt: `s${wallet}-${seq}`, cipher: 'aes-gcm', iv: `iv${wallet}-${seq}`,
  ciphertext: b64(`w${wallet}-seq${seq}-${extra.tag ?? ''}`), owner: owner(wallet), seq, ...extra,
});
const ids = (state: any) => keyringRecords(state).map((r: any) => `${r.owner.slice(-2)}@${r.seq}`);

describe('the device list', () => {
  it('KR-LIST-01: one entry per wallet, its newer seal; the wallet in use is never one of the others; nothing that is not a record', () => {
    const state = normalizeKeyring({
      active: seal(1, 2),
      others: [{ at: 1, record: seal(1, 1) }, { at: 2, record: seal(2, 1) }, { at: 3, record: seal(2, 3) }, { at: 4, record: { kind: 'other' } }, { at: 5 }],
    });
    expect(ids(state)).toEqual(['01@2', '02@3']);
  });

  it('KR-LIST-02: a wallet made or brought becomes the one in use, the one before kept — never lost; the same wallet re-sealed replaces its seal', () => {
    let state = normalizeKeyring({ active: seal(1, 1) });
    state = keyringPut(state, seal(2, 1), { makeActive: true });
    expect(ids(state)).toEqual(['02@1', '01@1']);
    state = keyringPut(state, seal(2, 2));
    expect(ids(state), 'the wallet in use, its new password').toEqual(['02@2', '01@1']);
    state = keyringPut(state, seal(3, 1));
    expect(ids(state), 'another wallet added beside').toEqual(['02@2', '03@1', '01@1']);
    state = keyringPut(state, seal(1, 1), { makeActive: true });
    expect(ids(state), 'a switch: the other comes to the front, the one in use is kept').toEqual(['01@1', '02@2', '03@1']);
    expect(ids(keyringForget(state, seal(3, 9)))).toEqual(['01@1', '02@2']);
    expect(ids(keyringForget(state, seal(1, 1))), 'the wallet in use is never taken out by a forget').toEqual(['01@1', '02@2', '03@1']);
  });

  it('KR-LIST-03: a full list refuses a new wallet — nothing is pushed out; the address this device keeps survives a seal that came without it', () => {
    let state: any = normalizeKeyring({});
    for (let n = 1; n <= DEVICE_WALLETS_MAX; n += 1) state = keyringPut(state, seal(n, 1));
    expect(keyringRecords(state)).toHaveLength(DEVICE_WALLETS_MAX);
    expect(() => keyringPut(state, seal(999, 1))).toThrow(expect.objectContaining({ code: 'KEYRING_FULL' }));
    expect(() => keyringPut(state, seal(999, 1), { makeActive: true })).toThrow(expect.objectContaining({ code: 'KEYRING_FULL' }));
    expect(keyringRecords(keyringPut(state, seal(5, 2))), 'a new seal of a wallet held is no new wallet').toHaveLength(DEVICE_WALLETS_MAX);
    const here = normalizeKeyring({ active: seal(7, 1, { address: 'EQ_seven', walletKind: 'v5r1', networkGlobalId: -239 }) });
    const fromCloud = cloudFormOf(seal(7, 2));
    expect(keyringPut(here, fromCloud).active).toMatchObject({ seq: 2, address: 'EQ_seven', walletKind: 'v5r1' });
  });

  it('KR-SEAL-01: the newer seal is the higher seq, then the ciphertext — what both sides hold, so the same answer on every device', () => {
    expect(newerSeal(seal(1, 1), seal(1, 2)).seq).toBe(2);
    expect(newerSeal(seal(1, 3), seal(1, 2)).seq).toBe(3);
    const a = seal(1, 2, { createdAt: 20, tag: 'a' });
    const b = cloudFormOf(seal(1, 2, { tag: 'b' }));
    expect(newerSeal(a, b), 'a time one side keeps alone does not decide').toBe(newerSeal(b, a));
    const c = seal(1, 2, { tag: 'c' });
    const d = seal(1, 2, { tag: 'd' });
    expect(newerSeal(c, d)).toBe(newerSeal(d, c));
    expect(nextSeq([seal(1, 4)], seal(1, 2), null)).toBe(5);
    expect(nextSeq()).toBe(1);
    expect(recordSeq({ seq: -1 })).toBe(0);
    expect(sameWallet({ address: 'EQ_A', ciphertext: 'x' }, { address: 'eq_a', ciphertext: 'y' })).toBe(true);
  });

  it('KR-SEAL-02: a seal replaces another by its higher seq; two from before versions (seq 0) replace neither — nobody knows which is newer', () => {
    expect([supersedes(seal(1, 2), seal(1, 1)), supersedes(seal(1, 1), seal(1, 2))]).toEqual([true, false]);
    const here = seal(1, 0, { tag: 'here' });
    const there = cloudFormOf(seal(1, 0, { tag: 'there' }));
    expect([supersedes(here, there), supersedes(there, here)], 'an earlier version\'s two seals: each side keeps its own').toEqual([false, false]);
    const c = seal(1, 3, { tag: 'c' });
    const d = seal(1, 3, { tag: 'd' });
    expect(Number(supersedes(c, d)) + Number(supersedes(d, c)), 'two seals of one version: exactly one wins, the same on every side').toBe(1);
    expect([supersedes(c, c), supersedes(c, null), supersedes(null, c)]).toEqual([false, true, false]);
    expect(supersedes(seal(1, 1), here), 'a seal made from now on settles an earlier version\'s').toBe(true);
  });

  it('KR-SEAL-03: a version past the ceiling is damaged — read as none, never a pin no password set later can pass [round 29 — F4-1]', () => {
    const pinned = seal(1, Number.MAX_SAFE_INTEGER, { tag: 'pinned' });
    expect([recordSeq(pinned), recordSeq(seal(1, SEQ_CEILING)), recordSeq(seal(1, SEQ_CEILING + 1))]).toEqual([0, SEQ_CEILING, 0]);
    const later = seal(1, nextSeq(pinned, seal(1, 1_760_000_000_000)), { tag: 'set later' });
    expect(supersedes(later, pinned), 'MEASURED by round 29 F4-1: every new password read back as 0 and lost').toBe(true);
    expect(supersedes(pinned, seal(1, 5)), 'and a damaged one never wins').toBe(false);
  });

  it('KR-SEAL-04: ONE class of versions — any version above none, the higher above the lower; no stamp rides a copy [decided 2026-10-15]', () => {
    const legacy = seal(1, 0, { tag: 'old' });
    const first = seal(1, 1_000, { tag: 'phone 1, unlocked first' });
    const changed = seal(1, 1_500, { tag: 'a password changed' });
    expect([supersedes(first, legacy), supersedes(legacy, first), supersedes(changed, first), supersedes(first, changed)]).toEqual([true, false, true, false]);
    expect(newerSeal(first, changed)).toBe(changed);
    expect(cloudFormOf({ ...first, stamped: true }), 'the stamps of a stand build are not carried on').not.toHaveProperty('stamped');
    expect(keyringModule, 'the seal classes are gone').not.toHaveProperty('recordRank');
  });

  it('KR-LIST-04: one very seal taken out, wherever it is — the wallet in use too, for its own seal to be put back', () => {
    const state = normalizeKeyring({ active: seal(1, 1), others: [{ at: 1, record: seal(2, 1) }] });
    expect(keyringWithout(state, seal(1, 1)).active).toBeNull();
    expect(ids(keyringWithout(state, seal(2, 1)))).toEqual(['01@1']);
    expect(ids(keyringWithout(state, seal(2, 5))), 'another seal of the wallet is not that seal').toEqual(['01@1', '02@1']);
  });
});


const MAC = 'ab'.repeat(32);
const signed = (record: any) => ({ ...record, mac: MAC });
const untagged = (record: any) => { const form: any = cloudFormOf(record); delete form.owner; delete form.mac; return form; };

describe('Telegram', () => {
  it('KR-CLOUD-01: a wallet is kept under its own key — its owner tag, or an earlier version\'s untagged copy\'s seal or 1.4.22\'s slot; the value holds the record\'s named fields and its sealed name', () => {
    expect(cloudKeyFor(seal(10, 1))).toBe(`${CLOUD_WALLET_PREFIX}${'0'.repeat(30)}0a`);
    const key = cloudKeyFor(untagged(seal(11, 0)))!;
    expect(key).toMatch(/^platho_wallet_v2_x[0-9a-f]{32}$/);
    expect([isCloudWalletKey(key), isCloudWalletKey(cloudKeyFor(seal(10, 1))), isCloudWalletKey(LEGACY_CLOUD_SLOT_KEY), isCloudWalletKey('platho_toncenter_key_v1')])
      .toEqual([true, true, true, false]);
    expect([isUntaggedCloudKey(key), isUntaggedCloudKey(cloudKeyFor(seal(10, 1))), isUntaggedCloudKey(LEGACY_CLOUD_SLOT_KEY)]).toEqual([true, false, true]);
    const value = cloudValueFor(signed(seal(12, 3, { address: 'EQ_twelve', createdAt: 99 })), { iv: 'i', ct: 'c' });
    expect(JSON.parse(value).r, 'no address, no time in Telegram').not.toHaveProperty('address');
    expect(JSON.parse(value).r).not.toHaveProperty('createdAt');
    expect(JSON.parse(value).r.mac, 'its signature rides it').toBe(MAC);
    expect(parseCloudValue(value)).toEqual({ record: cloudFormOf(signed(seal(12, 3))), name: { iv: 'i', ct: 'c' } });
    expect(parseCloudValue(JSON.stringify(seal(13, 0, { address: 'EQ_thirteen', createdAt: 5 })))).toEqual({ record: cloudFormOf(seal(13, 0)), name: null });
    expect(parseCloudValue('{"r":{"kind":"nope"}}')).toBeNull();
    expect(parseCloudValue('not json')).toBeNull();
    expect(keyringModule, 'stand builds\' keys are not read, nor moved').not.toHaveProperty('planLegacyMigration');
    expect(keyringModule).not.toHaveProperty('LEGACY_CLOUD_PREVIOUS_KEYS');
  });

  it('KR-SYNC-01: a sync brings Telegram\'s wallets here and sends the device\'s signed newer seals there — it replaces nothing here and takes nothing away [1.4.24]', () => {
    const device = normalizeKeyring({ active: signed(seal(1, 2)), others: [{ at: 1, record: signed(seal(2, 1)) }, { at: 2, record: signed(seal(4, 1)) }] });
    const cloud = [
      { key: cloudKeyFor(seal(1, 1)), record: cloudFormOf(signed(seal(1, 1))) },
      { key: cloudKeyFor(seal(2, 3)), record: cloudFormOf(signed(seal(2, 3))) },
      { key: cloudKeyFor(seal(3, 1)), record: cloudFormOf(signed(seal(3, 1))) },
    ];
    const plan = planWalletSync(device, cloud);
    expect(ids(plan.state)).toEqual(['01@2', '03@1', '02@1', '04@1']);
    expect(plan.push.map((p: any) => [p.key, p.record.seq])).toEqual([[cloudKeyFor(seal(1, 1)), 2]]);
    expect([plan.added.map((r: any) => r.seq), plan.retire, plan.full]).toEqual([[1], [], false]);
    expect(Object.keys(plan).sort(), 'a sync has no seed: nothing to replace a seal with').toEqual(['added', 'full', 'push', 'retire', 'state']);
    const same = [{ key: cloudKeyFor(seal(1, 1)), record: cloudFormOf(signed(seal(1, 2))) }, cloud[2]];
    expect(planWalletSync(plan.state, same).push, 'the same seal both sides: nothing to do').toEqual([]);
    expect(ids(planWalletSync(device, []).state), 'Telegram keeping none takes nothing away here').toEqual(ids(device));
  });

  it('KR-SYNC-02: a new device — empty — takes every wallet Telegram keeps, the first in use; a full one says so and loses nothing', () => {
    const plan = planWalletSync(normalizeKeyring({}), [3, 1, 2].map((n) => ({ key: cloudKeyFor(seal(n, 1)), record: cloudFormOf(signed(seal(n, 1))) })));
    expect(ids(plan.state), 'the first in use, the rest newest first').toEqual(['03@1', '02@1', '01@1']);
    let state: any = normalizeKeyring({});
    for (let n = 1; n <= DEVICE_WALLETS_MAX; n += 1) state = keyringPut(state, seal(n, 1));
    const over = planWalletSync(state, [{ key: cloudKeyFor(seal(500, 1)), record: cloudFormOf(seal(500, 1)) }]);
    expect([over.full, keyringRecords(over.state).length]).toEqual([true, DEVICE_WALLETS_MAX]);
  });

  it('KR-SYNC-03: two devices and Telegram, passwords changed, wallets kept, syncs and unlocks in any order — no sync replaces a seal here, lowers Telegram\'s or loses a wallet; once each has synced and unlocked, every wallet is at its newest everywhere', () => {
    let seed = 7;
    const rand = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    for (let run = 0; run < 300; run += 1) {
      const devices: any[] = [normalizeKeyring({ active: signed(seal(1, 1)) }), normalizeKeyring({ active: signed(seal(2, 1)) })];
      const cloud = new Map<string, any>();
      const kept = new Set<number>();
      const born = new Set([1, 2]);
      let tick = 0;
      const sync = (d: number) => {
        const before = keyringRecords(devices[d]);
        const plan = planWalletSync(devices[d], [...cloud.entries()].map(([key, record]) => ({ key, record })));
        for (const record of before) expect(keyringFind(plan.state, record), `run ${run}: a sync replaced a seal here`).toBe(record);
        devices[d] = plan.state;
        for (const { key, record } of plan.push) {
          expect(supersedes(record, counted(cloud.get(key))), `run ${run}: a push lowered Telegram's seal`).toBe(true);
          cloud.set(key, cloudFormOf(record));
        }
      };
      const unlock = (d: number) => {
        for (const record of keyringRecords(devices[d])) {
          const there = cloud.get(cloudKeyFor(record)!);
          if (there && isSigned(there) && supersedes(there, record)) devices[d] = keyringPut(devices[d], there);
        }
      };
      for (let step = 0; step < 25; step += 1) {
        const d = rand(2);
        const all = keyringRecords(devices[d]);
        const pick = all[rand(all.length)];
        const n = parseInt(pick.owner.slice(-4), 16);
        switch (rand(6)) {
          case 0: {
            tick += 1;
            const key = cloudKeyFor(pick)!;
            const record = signed(seal(n, nextSeq(all.filter((r: any) => sameWallet(r, pick)), cloud.get(key) ?? null), { tag: `t${tick}`, createdAt: tick }));
            devices[d] = keyringPut(devices[d], record);
            if (cloud.has(key) && supersedes(record, counted(cloud.get(key)))) cloud.set(key, cloudFormOf(record));
            break;
          }
          case 1: { if (!cloud.has(cloudKeyFor(pick)!)) { cloud.set(cloudKeyFor(pick)!, cloudFormOf(pick)); kept.add(n); } break; }
          case 2: { const fresh = 10 + run * 100 + step; born.add(fresh); devices[d] = keyringPut(devices[d], signed(seal(fresh, 1)), { makeActive: true }); break; }
          case 3: unlock(d); break;
          default: sync(d);
        }
      }
      sync(0); sync(1); unlock(0); unlock(1);
      for (const n of kept) {
        const key = cloudKeyFor(seal(n, 1))!;
        const holders = [cloud.get(key), keyringFind(devices[0], seal(n, 1)), keyringFind(devices[1], seal(n, 1))];
        const best = holders.reduce((a: any, b: any) => newerSeal(a, b));
        for (const holder of holders) expect(holder && holder.ciphertext, `run ${run}: wallet ${n} at its newest seal everywhere`).toBe(best.ciphertext);
      }
      for (const n of born) {
        const here = [keyringFind(devices[0], seal(n, 1)), keyringFind(devices[1], seal(n, 1)), cloud.get(cloudKeyFor(seal(n, 1))!)].filter(Boolean);
        expect(here.length, `run ${run}: wallet ${n} kept somewhere`).toBeGreaterThan(0);
      }
    }
  });

  it('KR-SYNC-04: an earlier version\'s seals settle nothing between them; its untagged copy is read where it lies, and goes once its wallet\'s own key holds that very seal or one above it', () => {
    const device = normalizeKeyring({ active: seal(1, 0, { tag: 'here' }) });
    const tie = planWalletSync(device, [{ key: cloudKeyFor(seal(1, 0))!, record: cloudFormOf(seal(1, 0, { tag: 'there' })) }]);
    expect([tie.push, tie.retire, ids(tie.state)], 'each side keeps its own').toEqual([[], [], ['01@0']]);
    expect(tie.state.active.ciphertext).toBe(seal(1, 0, { tag: 'here' }).ciphertext);

    const mine = { ...seal(5, 0, { address: 'EQ_five' }), seq: 1, mac: MAC };
    const bare = untagged(seal(5, 0));
    const xKey = cloudKeyFor(bare)!;
    expect(xKey).toMatch(/_x[0-9a-f]{32}$/);
    const lying = planWalletSync(normalizeKeyring({ active: mine }), [{ key: xKey, record: bare }]);
    expect([lying.push, lying.retire, lying.added, ids(lying.state)], 'nothing moves it at the boot: the unlock writes the seal under its tag (app.js sendNewSealToTelegram)')
      .toEqual([[], [], [], ['05@1']]);
    const slot = planWalletSync(normalizeKeyring({ active: mine }), [{ key: LEGACY_CLOUD_SLOT_KEY, record: bare }, { key: cloudKeyFor(mine)!, record: cloudFormOf(mine) }]);
    expect([slot.retire, slot.push, slot.added.length], 'its tag holds that very seal: 1.4.22\'s slot goes').toEqual([[LEGACY_CLOUD_SLOT_KEY], [], 0]);
    const newer = cloudFormOf(signed(seal(5, 2)));
    const both = planWalletSync(normalizeKeyring({ active: mine }), [{ key: xKey, record: bare }, { key: cloudKeyFor(newer)!, record: newer }]);
    expect([both.retire, both.push], 'a newer seal under its tag: the copy only goes — read in either order').toEqual([[xKey], []]);
    expect(ids(both.state), 'and the newer seal waits for the wallet\'s unlock').toEqual(['05@1']);
    const other = cloudFormOf(seal(5, 0, { tag: 'another phone' }));
    const tagTie = planWalletSync(normalizeKeyring({ active: seal(5, 0, { address: 'EQ_five' }) }), [{ key: cloudKeyFor(other)!, record: other }, { key: xKey, record: bare }]);
    expect([tagTie.retire, tagTie.push], 'MEASURED by review 30: retired on a tie — after CLEAR only the other phone\'s password opened it').toEqual([[], []]);
    const unknown = planWalletSync(normalizeKeyring({ active: signed(seal(6, 1)) }), [{ key: xKey, record: bare }]);
    expect([unknown.added.length, unknown.retire], 'an untagged copy nobody here can place is brought, as it is').toEqual([1, []]);
    const inUse = { ...seal(7, 0), address: 'EQ_seven' };
    const sameThere = { ...cloudFormOf(signed(seal(7, 3_000))), ciphertext: inUse.ciphertext, iv: inUse.iv };
    expect(planWalletSync(normalizeKeyring({ active: inUse }), [{ key: cloudKeyFor(sameThere)!, record: sameThere }]).state.active).toBe(inUse);
  });

  it('KR-SYNC-05: a version without a signature counts as none — a value anyone with the person\'s Telegram account wrote takes no seal and pins no version [round 30 — F4-1]', () => {
    const here = normalizeKeyring({ active: signed(seal(1, 5)) });
    const planted = cloudFormOf(seal(1, SEQ_CEILING, { tag: 'planted' }));
    const plan = planWalletSync(here, [{ key: cloudKeyFor(planted)!, record: planted }]);
    expect([plan.push.map((p: any) => p.record.seq), plan.state.active.seq], 'MEASURED by round 30 F4-1: it took the seal here at the boot, or held every push back for good')
      .toEqual([[5], 5]);
    const fresh = planWalletSync(normalizeKeyring({}), [
      { key: cloudKeyFor(seal(7, 1))!, record: cloudFormOf(seal(7, 9_000)) },
      { key: cloudKeyFor(seal(8, 1))!, record: cloudFormOf(signed(seal(8, 9_000))) },
    ]);
    expect(fresh.added.map((r: any) => [r.owner.slice(-2), r.seq]), 'a wallet brought comes at the version it counts: none unsigned, its own signed').toEqual([['07', 0], ['08', 9_000]]);
    const forged = cloudFormOf({ ...seal(1, SEQ_CEILING, { tag: 'forged' }), mac: 'cd'.repeat(32) });
    expect(planWalletSync(here, [{ key: cloudKeyFor(forged)!, record: forged }]).push).toEqual([]);
    expect(planWalletSync(normalizeKeyring({ active: seal(1, 5) }), [{ key: cloudKeyFor(seal(1, 1))!, record: cloudFormOf(seal(1, 1)) }]).push).toEqual([]);
  });
});

describe('signatures', () => {
  it('KR-SIGN-01: a signature covers every open field but itself, in order — the version as it counts and the owner tag among them; what only this device keeps is not in it', () => {
    expect(SIGNED_FIELDS).toEqual(CLOUD_RECORD_FIELDS.filter((field) => field !== 'mac'));
    const record = seal(1, 7);
    const text = sealedFieldsText(record);
    expect(JSON.parse(text)).toEqual(SIGNED_FIELDS.map((field) => (record as any)[field]));
    for (const field of SIGNED_FIELDS) {
      const changed = { ...record, [field]: field === 'seq' ? 8 : `${(record as any)[field]}x` };
      expect(sealedFieldsText(changed), `${field} is signed`).not.toBe(text);
    }
    expect(sealedFieldsText({ ...record, address: 'EQ_x', createdAt: 5, walletKind: 'v5r1', mac: MAC }), 'an address, a time, the signature itself').toBe(text);
    expect(sealedFieldsText({ ...record, seq: Number.MAX_SAFE_INTEGER }), 'a version past the ceiling is signed as none, as it counts').toBe(sealedFieldsText({ ...record, seq: 0 }));
    expect([isSigned(record), isSigned({ ...record, mac: MAC }), isSigned({ ...record, mac: 'AB'.repeat(32) }), isSigned({ ...record, mac: 'ab' })]).toEqual([false, true, false, false]);
    expect([counted(record).seq, counted({ ...record, mac: MAC }).seq, counted(seal(1, 0)).seq, counted(null)]).toEqual([0, 7, 0, null]);
    expect(counted(record), 'a copy, the record itself untouched').not.toBe(record);
    expect(record.seq).toBe(7);
    expect(keyringModule, 'no bound for unsigned versions: they count as none').not.toHaveProperty('UNSIGNED_SEQ_CEILING');
  });
});
