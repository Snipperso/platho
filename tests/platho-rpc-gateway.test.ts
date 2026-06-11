import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { PLATHO_APP_CONFIG } from '../web/platho-config.mjs';
import { parseTonAddress } from '../web/crypto/platho-crypto.mjs';

const gatewayPath = 'deploy/platho-rpc-gateway.py';

function envValue(source: string, key: string): string {
  const line = source
    .split(/\r?\n/)
    .find((entry) => entry.startsWith(`${key}=`));
  if (!line) throw new Error(`${key} is missing from deploy/platho-rpc-gateway.env.example`);
  return line.slice(key.length + 1);
}

describe('Platho RPC gateway', () => {
  it('RPC-GATEWAY-01: gateway Python source compiles without external dependencies', () => {
    execFileSync('python', [
      '-c',
      `import ast, pathlib; ast.parse(pathlib.Path(${JSON.stringify(gatewayPath)}).read_text(encoding='utf-8'))`,
    ], { stdio: 'pipe' });
  });

  it('RPC-GATEWAY-02: checked-in gateway keeps the TonCenter key server-side and route-limited', () => {
    const gateway = readFileSync(gatewayPath, 'utf8');
    const envExample = readFileSync('deploy/platho-rpc-gateway.env.example', 'utf8');
    const config = readFileSync('web/platho-config.mjs', 'utf8');

    expect(gateway).toMatch(/ton\.access\.orbs\.network/);
    expect(gateway).toMatch(/TONCENTER_API_KEY_FILE/);
    expect(gateway).toMatch(/TONCENTER_AUTH_RETRY_MS/);
    expect(gateway).toMatch(/"X-API-Key"/);
    expect(gateway).toMatch(/fetch_toncenter_json/);
    expect(gateway).toMatch(/error\.code not in \(401, 403\)/);
    expect(gateway).toMatch(/http_error_detail/);
    expect(gateway).toMatch(/upstream_status/);
    expect(gateway).toMatch(/upstream_error/);
    expect(gateway).toMatch(/log_upstream_error/);
    expect(gateway).toMatch(/UPSTREAM_USER_AGENT/);
    expect(gateway).toMatch(/PlathoRpcGateway\/1\.0/);
    expect(gateway).toMatch(/GET_METHOD_NOT_ALLOWED/);
    expect(gateway).toMatch(/MESSAGES_DESTINATION_NOT_ALLOWED/);
    expect(gateway).toMatch(/MESSAGES_SOURCE_NOT_ALLOWED/);
    expect(gateway).toMatch(/MESSAGES_OPCODE_NOT_ALLOWED/);
    expect(gateway).toMatch(/MESSAGE_QUERY_ALLOWED_KEYS/);
    expect(gateway).toMatch(/0x874e576a/);
    expect(gateway).toMatch(/ALLOWED_MESSAGE_SOURCES/);
    expect(gateway).toMatch(/\("POST", "\/api\/v3\/runGetMethod"\)/);
    expect(gateway).toMatch(/\("POST", "\/api\/v3\/message"\)/);
    expect(gateway).toMatch(/\("GET", "\/api\/v3\/messages"\)/);
    expect(gateway).toMatch(/\("GET", "\/api\/v2\/getAddressInformation"\)/);
    expect(gateway).toMatch(/validated_send_message_payload/);
    expect(gateway).toMatch(/MESSAGE_BODY_NOT_ALLOWED/);
    expect(gateway).toMatch(/MESSAGE_BOC_MISSING/);
    expect(gateway).toMatch(/MESSAGE_BOC_INVALID/);
    expect(gateway).not.toMatch(/UPSTREAM_AUTH|Authorization/);
    expect(envExample).toMatch(/PLATHO_RPC_TONCENTER_API_KEY_FILE=\/etc\/platho\/toncenter-mainnet\.key/);
    expect(envExample).toMatch(/PLATHO_RPC_TONCENTER_AUTH_RETRY_MS=60000/);
    expect(envExample).toMatch(/PLATHO_RPC_ALLOWED_MESSAGE_OPCODES=0xa4f862c0,0x8c2a76b7,0x874e576a/);
    expect(envExample).not.toMatch(/Bearer|QuickNode|Chainstack/);
    expect(config).toMatch(/sendBocEndpoint:\s*'https:\/\/rpc\.platho\.app\/api\/v3\/message'/);
    // Direct TonCenter endpoints in the PWA are the keyless emergency
    // fallback; the API key never ships in the static bundle and stays
    // behind the Platho RPC gateway.
    expect(config).toMatch(/id:\s*'toncenter-mainnet'[\s\S]*verifierOnly:\s*true[\s\S]*emergencyFallback:\s*true[\s\S]*sendBocEndpoint:\s*'https:\/\/toncenter\.com\/api\/v3\/message'/);
    expect(config).toMatch(/messagesEndpoint:\s*'https:\/\/rpc\.platho\.app\/api\/v3\/messages'/);
    expect(config).not.toMatch(/PLATHO_RPC_TONCENTER_API_KEY|X-API-Key|toncenter-mainnet\.key|apiKey:/);
  });

  it('RPC-GATEWAY-02C: message history allowlist tracks the production Vault and CapsuleHub', () => {
    const envExample = readFileSync('deploy/platho-rpc-gateway.env.example', 'utf8');
    const destinations = envValue(envExample, 'PLATHO_RPC_ALLOWED_MESSAGE_DESTINATIONS').split(',');
    const sources = envValue(envExample, 'PLATHO_RPC_ALLOWED_MESSAGE_SOURCES').split(',');
    const vaultRaw = parseTonAddress(PLATHO_APP_CONFIG.vault.address).raw;
    const capsuleHubRaw = parseTonAddress(PLATHO_APP_CONFIG.capsuleHub.address).raw;

    expect(destinations).toContain(capsuleHubRaw);
    expect(destinations).toContain(vaultRaw);
    expect(sources).toContain(vaultRaw);
    expect(sources).toContain(capsuleHubRaw);
  });

  it('RPC-GATEWAY-02B: gateway allowlist covers PWA read-only get-methods', () => {
    const gateway = readFileSync(gatewayPath, 'utf8');
    const config = readFileSync('web/platho-config.mjs', 'utf8');
    for (const method of [
      'get_receive_intent',
      'get_receive_intent_id',
      'get_receive_intent_commitment',
      'get_ath_wallet_address',
      'get_pending_ath_withdrawal_for',
      'get_pending_notification',
      'get_pending_mint',
      'get_pending_treasury_flush',
      'get_pending_burn_flush',
      'seqno',
    ]) {
      expect(gateway, `gateway allowlist must include ${method}`).toMatch(new RegExp(`"${method}"`));
      expect(config, `PWA gateway capability must include ${method}`).toMatch(new RegExp(`'${method}'`));
    }
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
