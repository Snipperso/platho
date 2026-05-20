#!/usr/bin/env node

// Tact 1.6.13 installs process-level Func/Fift failure handlers once per
// compiled project. Our config currently has more than Node's default listener
// warning threshold, so raise the process listener cap before invoking the
// official CLI. This does not change compiler inputs or outputs.
const currentMaxListeners = process.getMaxListeners();
if (currentMaxListeners !== 0 && currentMaxListeners < 64) {
  process.setMaxListeners(64);
}

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { main } = require('@tact-lang/compiler/dist/cli/tact/index.js');

const originalArgs = process.argv.slice(2);

function optionValue(args, name, fallback) {
  const index = args.indexOf(name);
  if (index < 0 || index + 1 >= args.length) {
    return fallback;
  }
  return args[index + 1];
}

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

if (!originalArgs.includes('--project')) {
  const configPath = optionValue(originalArgs, '--config', 'tact.config.json');
  const absoluteConfigPath = path.resolve(configPath);
  const config = JSON.parse(fs.readFileSync(absoluteConfigPath, 'utf8'));
  if (Array.isArray(config.projects) && config.projects.length > 0) {
    for (const project of config.projects) {
      let passed = false;
      let lastStatus = 1;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const result = spawnSync(process.execPath, [
          __filename,
          '--config',
          configPath,
          '--project',
          project.name,
        ], {
          cwd: process.cwd(),
          env: process.env,
          stdio: 'inherit',
        });

        lastStatus = result.status ?? 1;
        if (lastStatus === 0) {
          passed = true;
          break;
        }

        if (attempt < 3) {
          console.warn(`Retrying Tact project ${project.name} after transient compiler file-open failure (${attempt}/3)`);
          sleepMs(1500);
        }
      }

      if (!passed) {
        process.exit(lastStatus);
      }
      sleepMs(1500);
    }
    process.exit(0);
  }
}

process.argv = [process.argv[0], 'tact', ...(
  originalArgs.length === 0
    ? ['--config', 'tact.config.json']
    : originalArgs
)];

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
