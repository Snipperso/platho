import { type KEM, type TRet } from './utils.ts';
/** FIPS 203: 7. Parameter Sets */
/** Public ML-KEM parameter-set description. */
export type KEMParam = {
    /** Polynomial size. */
    N: number;
    /** Module rank. */
    K: number;
    /** Prime modulus. */
    Q: number;
    /** CBD parameter used for secret-key noise. */
    ETA1: number;
    /** CBD parameter used for error noise. */
    ETA2: number;
    /** Compression width for the `u` vector. */
    du: number;
    /** Compression width for the `v` polynomial. */
    dv: number;
    /** Required strength of the randomness source in bits. */
    RBGstrength: number;
};
/** Internal params of ML-KEM versions */
/** Built-in ML-KEM parameter presets keyed by the public export names
 * `ml_kem512` / `ml_kem768` / `ml_kem1024`.
 * `RBGstrength` is Table 2's required randomness-source strength in bits,
 * not a generic security label.
 */
export declare const PARAMS: Record<string, KEMParam>;
/**
 * ML-KEM-512: Table 2 row `k=2, η1=3, η2=2, du=10, dv=4`; Table 3 sizes `800/1632/768/32`.
 * The ASD lifecycle note here is external policy guidance, not a FIPS 203 requirement.
 */
export declare const ml_kem512: TRet<KEM>;
/**
 * ML-KEM-768: Table 2 row `k=3, η1=2, η2=2, du=10, dv=4`; Table 3 sizes `1184/2400/1088/32`.
 * The ASD lifecycle note here is external policy guidance, not a FIPS 203 requirement.
 */
export declare const ml_kem768: TRet<KEM>;
/**
 * ML-KEM-1024: Table 2 row `k=4, η1=2, η2=2, du=11, dv=5`; Table 3 sizes `1568/3168/1568/32`.
 * The ASD lifecycle note here is external policy guidance, not a FIPS 203 requirement.
 */
export declare const ml_kem1024: TRet<KEM>;
export declare const __tests: any;
//# sourceMappingURL=ml-kem.d.ts.map