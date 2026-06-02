import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';

const gatewayPath = 'deploy/platho-rpc-gateway.py';

describe('Platho RPC gateway', () => {
  it('RPC-GATEWAY-01: gateway Python source compiles without external dependencies', () => {
    execFileSync('python', ['-m', 'py_compile', gatewayPath], { stdio: 'pipe' });
  });

  it('RPC-GATEWAY-02: checked-in gateway remains anonymous, read-only, and Orbs-based', () => {
    const gateway = readFileSync(gatewayPath, 'utf8');
    const envExample = readFileSync('deploy/platho-rpc-gateway.env.example', 'utf8');
    const config = readFileSync('web/platho-config.mjs', 'utf8');

    expect(gateway).toMatch(/ton\.access\.orbs\.network/);
    expect(gateway).toMatch(/GET_METHOD_NOT_ALLOWED/);
    expect(gateway).toMatch(/\("POST", "\/api\/v3\/runGetMethod"\)/);
    expect(gateway).toMatch(/\("GET", "\/api\/v2\/getAddressInformation"\)/);
    expect(gateway).not.toMatch(/api\/v3\/messages|sendBoc|UPSTREAM_API_KEY|UPSTREAM_AUTH|X-API-Key|Authorization/);
    expect(envExample).not.toMatch(/API_KEY|AUTH|Bearer|QuickNode|Chainstack/);
    expect(config).toMatch(/messagesEndpoint:\s*false/);
    expect(config).not.toMatch(/https:\/\/rpc\.platho\.app\/api\/v3\/messages/);
  });

  it('RPC-GATEWAY-03: local healthcheck works without calling TON upstream', async () => {
    const port = String(8910 + Math.floor(Math.random() * 500));
    const child = spawn('python', [gatewayPath], {
      env: { ...process.env, PLATHO_RPC_PORT: port, PLATHO_RPC_UPSTREAM_KIND: 'ton-access-v2' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('gateway did not start')), 3000);
        child.stdout?.on('data', (chunk) => {
          if (String(chunk).includes('listening')) {
            clearTimeout(timer);
            resolve(undefined);
          }
        });
        child.on('exit', (code) => {
          clearTimeout(timer);
          reject(new Error(`gateway exited early: ${code}`));
        });
      });
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      await expect(response.json()).resolves.toMatchObject({ ok: true, service: 'platho-rpc-gateway' });
    } finally {
      child.kill();
    }
  });
});
