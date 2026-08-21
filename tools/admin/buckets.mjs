// WHAT THE PROTOCOL IS HOLDING, and which of it can be moved by pressing a button.
//
// This file exists because "built on chain" and "somebody can actually run it" turned out to be different things.
// The market-stability seller had 20.5 GRAM of sale proceeds due, a flush receiver to move them, a passing sandbox
// test proving the flush works — and no executor anywhere in the project: the only mentions of the message were in
// three tests. Nobody would have noticed for months, because nothing asks the question.
//
// SO THE DASHBOARD IS THE POINT, not the buttons. Every accounting bucket in the system, read in one pass, on one
// screen. The buttons are the cheap part.
//
// NO PRIVILEGED KEY IS INVOLVED, and that is a property of the contracts rather than a convenience here: the genesis
// controller was revoked at seal, and every operation below is PERMISSIONLESS with its destination bound at genesis.
// A caller cannot redirect a single nanoton — the worst a stranger with this page can do is pay gas to move the
// protocol's money to the protocol's own treasury. That is why a throwaway wallet with a couple of GRAM is the
// correct security posture and not a shortcut.
//
// THE FIELD INDICES ARE THE DANGEROUS PART. A getter stack has no names, so every reader here is positional, and a
// field APPENDED to the middle of a struct would hand every later value to the wrong label — silently, on a screen
// whose whole job is to be believed. tests/admin-console.test.ts re-derives every index below from the .tact struct
// declarations and fails on a mismatch; the map is written out rather than computed so that the failure names the
// field instead of the file.

/** Nanoton value that must ride along with a flush. Both are returned to the caller — see 'change-returned'. */
export const MARKET_STABILITY_FLUSH_EXEC = 2_000_000n;
export const FEE_ACCUMULATOR_FLUSH_EXEC = 5_000_000n;
// The registries' ATH flushes are 'in-flight-record' rather than 'change-returned': the caller funds TRANSPORT for a
// jetton hop, the amount itself is held in a pending record and restored on failure or bounce. So these are not
// refunded the way the TON flushes are — 0.05 GRAM for a treasury hop, 0.007 for a burn. I had left all four out as
// "not going to guess the value"; the owner asked why there was no burn button and the answer was two greps away.
export const USERNAME_ATH_TREASURY_EXEC = 50_000_000n;   // USERNAME_ATH_TRANSFER_EXEC_RESERVE + LOCAL
export const USERNAME_ATH_BURN_EXEC = 7_000_000n;        // USERNAME_ATH_BURN_EXEC_RESERVE + LOCAL
export const PROFILE_ATH_TREASURY_EXEC = 50_000_000n;
export const PROFILE_ATH_BURN_EXEC = 7_000_000n;
// The buyback pays for its own STON.fi hop out of the RESERVE it accumulated; the caller funds only the compute that
// starts it. NOT returned, unlike the flushes above — there is no refund path in the receiver and the surplus simply
// joins the contract's balance. It is 0.05 GRAM, and it is the protocol's own contract, so this is a rounding error
// rather than a cost, but a note that claimed a refund would be a lie.
export const BUYBACK_EXECUTE_EXEC = 50_000_000n;         // BUYBACK_PTON_TRANSFER_GAS_NANOTONS (gate 22216)
/** What must have ACCUMULATED before a chunk can fire at all (gate 22212). One chunk spends exactly this. */
export const BUYBACK_FUNDING_ENVELOPE = 51_050_000_000n; // BUYBACK_FUNDING_ENVELOPE_NANOTONS

/** GRAM = 9 decimals, ATH = 9 decimals. Kept separate because the unit is what a reader gets wrong, not the scale. */
export const UNIT = { gram: 'GRAM', ath: 'ATH', bool: 'bool' };

/**
 * One readable contract. `struct` names the .tact declaration the indices belong to, so the gate can check them
 * without a second copy of the mapping.
 */
export const BUCKETS = [
  {
    key: 'market_stability_seller',
    title: 'Продавец резерва ATH',
    manifest: 'market_stability_seller',
    getter: 'get_market_stability_seller_state',
    struct: 'MarketStabilitySellerStateView',
    contract: 'MarketStabilitySeller.tact',
    rows: [
      { field: 'treasury_due_ton', at: 2, label: 'Выручка к выводу', unit: UNIT.gram, primary: true },
      { field: 'reserve_due_ath', at: 1, label: 'Резерв не продан', unit: UNIT.ath },
      { field: 'current_multiplier', at: 11, label: 'Ступень цены', unit: null },
      { field: 'current_tranche_remaining_ath', at: 12, label: 'Осталось на ступени', unit: UNIT.ath },
      { field: 'phase', at: 0, label: 'Фаза (0 = свободен)', unit: null },
    ],
    actions: [
      {
        id: 'mss-flush',
        label: 'Вывести выручку',
        // "MSFT" — op(32) | amount(uint128). Destination is the genesis-bound treasury, never the caller.
        opcode: 0x4D534654n,
        arg: { kind: 'amountFrom', field: 'treasury_due_ton', bits: 128 },
        value: MARKET_STABILITY_FLUSH_EXEC,
        note: 'Уходит на казначейский адрес, зашитый в контракт. 0.002 GRAM на исполнение возвращаются.',
      },
    ],
  },
  {
    key: 'fee_accumulator',
    title: 'Накопитель комиссий',
    manifest: 'fee_accumulator',
    getter: 'get_state',
    struct: 'FeeAccumulatorStateView',
    contract: 'FeeAccumulator.tact',
    rows: [
      { field: 'treasury_due_ton', at: 1, label: 'Казначейству к выводу', unit: UNIT.gram, primary: true },
      { field: 'buyback_due_ton', at: 2, label: 'На выкуп к переводу', unit: UNIT.gram, primary: true },
      { field: 'accumulated_ton', at: 0, label: 'Собрано всего', unit: UNIT.gram },
      // Without this the card reads as a contradiction: 3.27 GRAM collected and nothing due. Before the one-way
      // split is enabled the accrual goes to the bootstrap bucket, not to treasury/buyback — so the operator needs
      // to see WHICH regime they are looking at, not just the two zeroes it produces.
      { field: 'buyback_split_enabled', at: 3, label: 'Разделение включено', unit: UNIT.bool },
      { field: 'storage_reserve_ton', at: 6, label: 'Резерв хранения', unit: UNIT.gram },
    ],
    actions: [
      {
        id: 'fee-flush-treasury',
        label: 'Вывести казначейскую долю',
        opcode: 0xDDAB4641n,
        arg: { kind: 'amountFrom', field: 'treasury_due_ton', bits: 128 },
        value: FEE_ACCUMULATOR_FLUSH_EXEC,
        note: 'Получатель зашит на генезисе. 0.005 GRAM на исполнение возвращаются.',
      },
      {
        id: 'fee-flush-buyback',
        label: 'Отправить долю на выкуп',
        opcode: 0xB3D2C52Dn,
        arg: { kind: 'amountFrom', field: 'buyback_due_ton', bits: 128 },
        value: FEE_ACCUMULATOR_FLUSH_EXEC,
        note: 'Уходит в BuybackBurn — оттуда ATH выкупается и сжигается.',
      },
    ],
  },
  {
    key: 'buyback_burn',
    title: 'Выкуп и сжигание',
    manifest: 'buyback_burn',
    getter: 'get_buyback_burn_state',
    struct: 'BuybackBurnStateView',
    contract: 'BuybackBurn.tact',
    rows: [
      { field: 'reserve_due_ton', at: 1, label: 'Накоплено на выкуп', unit: UNIT.gram, primary: true },
      { field: 'phase', at: 0, label: 'Фаза (0 = свободен)', unit: null },
      { field: 'route_refund_due_ton', at: 8, label: 'Возврат с маршрута', unit: UNIT.gram },
      { field: 'last_terminal_query_id', at: 10, label: 'Последний query_id', unit: null },
    ],
    // A SECOND read, and the only card that needs one: the execution quote is frozen into the CONFIG view while
    // everything else the operator looks at lives in the state view. Showing it rather than fetching it silently is
    // the point — these two numbers ARE the price the swap will accept, and the operator signs them.
    extra: {
      getter: 'get_buyback_burn_config',
      struct: 'BuybackBurnConfigView',
      rows: [
        { field: 'route_frozen', at: 4, label: 'Маршрут заморожен', unit: UNIT.bool },
        { field: 'evidence_quote_out_atomic_ath', at: 19, label: 'Котировка (ожидаемый выход)', unit: UNIT.ath },
        { field: 'evidence_dex_min_out_atomic_ath', at: 20, label: 'Минимум с биржи', unit: UNIT.ath },
      ],
    },
    actions: [
      {
        id: 'buyback-execute',
        label: 'Выкупить и сжечь',
        // "BYEX" — op(32) | query_id(64) | quote_out(128) | dex_min_out(128). The operator types NOTHING: all three
        // come out of the contract's own state, because all three are values the contract will compare against
        // itself. query_id must be EXACTLY last_terminal + 1 (gate 22044) and the pair must equal the frozen
        // evidence (22046/22047) — a hand-entered figure here could only ever be wrong.
        opcode: 0x42594558n,
        arg: { kind: 'buybackExecute' },
        enabledBy: 'reserve_due_ton',
        unit: UNIT.gram,
        value: BUYBACK_EXECUTE_EXEC,
        // FOUR preconditions, not one, and this is why the button did not exist until now. `enabledBy` alone would
        // have offered it at 3.27 GRAM accumulated and bounced on 22212 every time — the failure this file's own
        // header calls worse than an honest empty space. Each unmet condition names itself under the button.
        requires: [
          { field: 'route_frozen', equals: 1n, unmet: 'маршрут STON.fi ещё не заморожен' },
          { field: 'phase', equals: 0n, unmet: 'предыдущий выкуп ещё не завершён' },
          { field: 'reserve_due_ton', atLeast: BUYBACK_FUNDING_ENVELOPE, unmet: 'накоплено меньше 51.05 GRAM на один выкуп' },
          { field: 'evidence_quote_out_atomic_ath', atLeast: 1n, unmet: 'котировка маршрута не зафиксирована' },
        ],
        note: 'Один выкуп тратит ровно 51.05 GRAM из накопленного: GRAM уходит на STON.fi, купленный ATH сжигается. '
          + 'Котировка и query_id берутся из состояния контракта. 0.05 GRAM на исполнение НЕ возвращаются.',
      },
    ],
  },
  {
    key: 'username_registry',
    title: 'Реестр имён',
    manifest: 'username_registry',
    getter: 'get_global',
    struct: 'UsernameRegistryGlobalView',
    contract: 'UsernameRegistry.tact',
    rows: [
      { field: 'treasury_due_ath', at: 7, label: 'ATH казначейству', unit: UNIT.ath, primary: true },
      { field: 'burn_due_ath', at: 8, label: 'ATH на сжигание', unit: UNIT.ath, primary: true },
    ],
    // These carry a query_id, not an amount: the contract flushes its WHOLE due and files a pending record under
    // that id. The id only has to be positive and unused, so a timestamp is safe and cannot be raced.
    actions: [
      {
        id: 'username-flush-treasury',
        label: 'Вывести ATH казначейству',
        opcode: 0x60A9BDDBn,
        arg: { kind: 'queryId', bits: 64 },
        enabledBy: 'treasury_due_ath',
        value: USERNAME_ATH_TREASURY_EXEC,
        note: 'Уходит весь долг целиком на казначейский адрес. 0.05 GRAM на перенос жетона.',
      },
      {
        id: 'username-flush-burn',
        label: 'Сжечь ATH',
        opcode: 0xE9A2C2CBn,
        arg: { kind: 'queryId', bits: 64 },
        enabledBy: 'burn_due_ath',
        value: USERNAME_ATH_BURN_EXEC,
        note: 'Весь долг уходит в сжигание через ATHMaster. 0.007 GRAM на исполнение.',
      },
    ],
  },
  {
    key: 'profile_registry',
    title: 'Реестр профилей',
    manifest: 'profile_registry',
    getter: 'get_global',
    struct: 'ProfileRegistryGlobalView',
    contract: 'ProfileRegistry.tact',
    rows: [
      // PEOPLE, and the only per-person figure the protocol exposes. Platho keeps no server and no analytics by
      // construction, so "did anything we did bring anyone" can only be answered from the chain.
      //
      // The label says avatars rather than profiles because that is what the counter is: it rises only on
      // `msg.version == 1`, a FIRST avatar purchase, so it counts wallets that have bought one at least once and
      // never counts the same wallet twice. Calling it "профилей создано" cost an evening — put next to the
      // airdrop's payout counter it read as a funnel, and the two measure different KINDS of thing.
      { field: 'profile_count', at: 8, label: 'Кошельков купили аватар', unit: null },
      { field: 'treasury_due_ath', at: 11, label: 'ATH казначейству', unit: UNIT.ath, primary: true },
      { field: 'burn_due_ath', at: 12, label: 'ATH на сжигание', unit: UNIT.ath, primary: true },
    ],
    actions: [
      {
        id: 'profile-flush-treasury',
        label: 'Вывести ATH казначейству',
        opcode: 0x50A61110n,
        arg: { kind: 'queryId', bits: 64 },
        enabledBy: 'treasury_due_ath',
        value: PROFILE_ATH_TREASURY_EXEC,
        note: 'Уходит весь долг целиком на казначейский адрес. 0.05 GRAM на перенос жетона.',
      },
      {
        id: 'profile-flush-burn',
        label: 'Сжечь ATH',
        opcode: 0x50A61111n,
        arg: { kind: 'queryId', bits: 64 },
        enabledBy: 'burn_due_ath',
        value: PROFILE_ATH_BURN_EXEC,
        note: 'Весь долг уходит в сжигание через ATHMaster. 0.007 GRAM на исполнение.',
      },
    ],
  },
  {
    key: 'airdrop_pool',
    title: 'Пул эйрдропа',
    manifest: 'airdrop_pool',
    getter: 'get_global',
    struct: 'AirdropGlobalView',
    contract: 'AirdropPool.tact',
    rows: [
      // PAYOUTS, NOT PEOPLE, and the difference is the whole reason this row is labelled the way it is.
      //
      // claim_count rises once per delivered payout (AirdropPool line 433), and a payout fires whenever credits
      // accrue — one capsule is one credit is 10 ATH. So one active person publishing all week shows up here many
      // times over, and this number can and does exceed the number of humans who have ever opened the app. Read as
      // "people" it flatters activity into adoption, which is the single most expensive thing a growth figure can
      // quietly do. Divide distributed_total by 10 ATH for the credits behind these payouts.
      { field: 'claim_count', at: 13, label: 'Выплат эйрдропа (не людей)', unit: null },
      { field: 'remaining_budget', at: 11, label: 'Остаток к раздаче', unit: UNIT.ath, primary: true },
      { field: 'distributed_total', at: 12, label: 'Уже роздано', unit: UNIT.ath },
      { field: 'total_pool', at: 9, label: 'Пул целиком', unit: UNIT.ath },
    ],
    actions: [],
  },
];
