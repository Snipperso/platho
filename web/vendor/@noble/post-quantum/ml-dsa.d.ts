import { type CryptoKeys, type Signer, type SigOpts, type TArg, type TRet, type VerOpts } from './utils.ts';
/** Internal ML-DSA options. */
export type DSAInternalOpts = {
    /**
     * Whether `internal.sign` / `internal.verify` receive a caller-supplied 64-byte `mu`
     * instead of the usual FIPS 204 formatted message `M'` / prehash-formatted message.
     * validateInternalOpts() only checks this flag; callers still must supply the right input length.
     */
    externalMu?: boolean;
};
/** ML-DSA signer surface with access to the internal message formatting mode. */
export type DSAInternal = CryptoKeys & {
    lengths: Signer['lengths'];
    sign: (msg: TArg<Uint8Array>, secretKey: TArg<Uint8Array>, opts?: TArg<SigOpts & DSAInternalOpts>) => TRet<Uint8Array>;
    verify: (sig: TArg<Uint8Array>, msg: TArg<Uint8Array>, pubKey: TArg<Uint8Array>, opts?: TArg<VerOpts & DSAInternalOpts>) => boolean;
};
/** Public ML-DSA signer surface. */
export type DSA = Signer & {
    internal: TRet<DSAInternal>;
};
/** Various lattice params. */
/** Public ML-DSA parameter-set description. */
export type DSAParam = {
    /** Matrix row count. */
    K: number;
    /** Matrix column count. */
    L: number;
    /** Bit width used when rounding `t`. */
    D: number;
    /** Bound used for the `y` sampling range. */
    GAMMA1: number;
    /** Bound used during decomposition and hints. */
    GAMMA2: number;
    /** Number of non-zero challenge coefficients. */
    TAU: number;
    /** Centered-binomial noise parameter. */
    ETA: number;
    /** Maximum number of hint bits in a signature. */
    OMEGA: number;
};
/** Internal params for different versions of ML-DSA  */
/** Built-in ML-DSA parameter presets keyed by security categories `2/3/5`
 * for `ml_dsa44` / `ml_dsa65` / `ml_dsa87`.
 * This is only the Table 1 subset used directly here: `BETA = TAU * ETA` is derived later,
 * while `C_TILDE_BYTES`, `TR_BYTES`, `CRH_BYTES`, and `securityLevel` live in the preset wrappers.
 */
export declare const PARAMS: Record<string, DSAParam>;
/** ML-DSA-44 for 128-bit security level. Not recommended after 2030, as per ASD. */
export declare const ml_dsa44: TRet<DSA>;
/** ML-DSA-65 for 192-bit security level. Not recommended after 2030, as per ASD. */
export declare const ml_dsa65: TRet<DSA>;
/** ML-DSA-87 for 256-bit security level. OK after 2030, as per ASD. */
export declare const ml_dsa87: TRet<DSA>;
//# sourceMappingURL=ml-dsa.d.ts.map