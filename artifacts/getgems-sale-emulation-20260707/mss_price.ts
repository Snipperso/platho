// Pricing monotonicity + no-underpay-per-tranche across all 20 tranches.
const TRANCHE=3000000000000000n, base=3000000000n;
const ceilDiv=(n:bigint,d:bigint)=> n===0n?0n:((n-1n)/d)+1n;
const quote=(mult:bigint,amount:bigint)=> ceilDiv(base*mult*amount, TRANCHE);
let prev=0n;
for(let t=0;t<20;t++){ const mult=BigInt(2+t); const full=quote(mult,TRANCHE);
  console.log(`tranche ${t} (x${mult}): full-tranche price = ${full} nanoTON, per-nanoATH avg = ${(full*1000000n)/TRANCHE} (x1e-6)`);
  if(full<=prev) console.log('   !!! NOT strictly increasing vs prev', prev); prev=full; }
// smallest nonzero: amount=1 at min mult=2
console.log('quote(1 nanoATH, x2) =', quote(2n,1n), '(ceilDiv rounds UP => always >=1, never free)');
// Can rounding ever let buyer get amount for LESS than fair share? ceilDiv rounds UP => buyer always pays >= exact fraction. Never underpays.
// Sum of all full-tranche prices vs naive:
let sum=0n; for(let t=0;t<20;t++){ sum+=quote(BigInt(2+t),TRANCHE);} console.log('total TON to buy entire 60M reserve =', sum, 'nanoTON =', Number(sum)/1e9,'TON (at base=3 TON/tranche)');
