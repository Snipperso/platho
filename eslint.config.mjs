import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

// Baseline lint for the TypeScript tooling under scripts/. The rule set is
// intentionally conservative: it catches genuinely risky patterns (unused
// symbols, unsafe declaration merging) without fighting the existing,
// deliberate style of these deployment scripts (empty catch guards around
// best-effort cleanup, BOM-stripping regexes, occasional require()).
export default tseslint.config(
  {
    ignores: [
      'build/**',
      'artifacts/**',
      'node_modules/**',
      'web/**',
      'web-about/**',
      'deploy/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/**/*.ts'],
    rules: {
      // These scripts legitimately use `any` for TON cell/slice plumbing.
      '@typescript-eslint/no-explicit-any': 'off',
      // Warn (don't fail) on unused symbols; allow underscore-prefixed.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Empty catch/guards are used intentionally for best-effort cleanup.
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Some scripts read files while stripping a leading BOM via /^\ufeff/.
      'no-irregular-whitespace': [
        'error',
        { skipStrings: true, skipComments: true, skipRegExps: true, skipTemplates: true },
      ],
      // A few scripts mix require() for CommonJS-only deps; not worth churn.
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
