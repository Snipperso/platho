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
    // ExecuteBuybackChunk deliberately has NO button yet. It needs the frozen quote pair out of the contract's own
    // state and its query_id must be EXACTLY last_terminal + 1 — the strict form the seller later moved away from
    // because it is racy. Neither is hard, but neither can be written blind, and the lane cannot fire at all until
    // 51.05 GRAM has accumulated above. A button that bounces every time is worse than an honest empty space.
    actions: [],
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
    // The two ATH flushes here carry a query_id and an IN-FLIGHT RECORD rather than a plain amount, so their value
    // requirement is not the flat exec reserve the TON flushes use. Read before wired, not guessed.
    actions: [],
  },
  {
    key: 'profile_registry',
    title: 'Реестр профилей',
    manifest: 'profile_registry',
    getter: 'get_global',
    struct: 'ProfileRegistryGlobalView',
    contract: 'ProfileRegistry.tact',
    rows: [
      { field: 'treasury_due_ath', at: 11, label: 'ATH казначейству', unit: UNIT.ath, primary: true },
      { field: 'burn_due_ath', at: 12, label: 'ATH на сжигание', unit: UNIT.ath, primary: true },
    ],
    actions: [],
  },
  {
    key: 'airdrop_pool',
    title: 'Пул эйрдропа',
    manifest: 'airdrop_pool',
    getter: 'get_global',
    struct: 'AirdropGlobalView',
    contract: 'AirdropPool.tact',
    rows: [
      { field: 'remaining_budget', at: 11, label: 'Остаток к раздаче', unit: UNIT.ath, primary: true },
      { field: 'distributed_total', at: 12, label: 'Уже роздано', unit: UNIT.ath },
      { field: 'total_pool', at: 9, label: 'Пул целиком', unit: UNIT.ath },
    ],
    actions: [],
  },
];
