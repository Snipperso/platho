#!/usr/bin/env node

// Tact 1.6.13 installs process-level Func/Fift failure handlers once per
// compiled project. Our config currently has more than Node's default listener
// warning threshold, so raise the process listener cap before invoking the
// official CLI. This does not change compiler inputs or outputs.
const currentMaxListeners = process.getMaxListeners();
if (currentMaxListeners !== 0 && currentMaxListeners < 64) {
  process.setMaxListeners(64);
}

const { main } = require('@tact-lang/compiler/dist/cli/tact/index.js');

if (process.argv.length <= 2) {
  process.argv = [process.argv[0], 'tact', '--config', 'tact.config.json'];
} else {
  process.argv = [process.argv[0], 'tact', ...process.argv.slice(2)];
}

main();
