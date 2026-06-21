import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { PLATHO_APP_CONFIG } from '../web/platho-config.mjs';
import { parseTonAddress } from '../web/crypto/platho-crypto.mjs';
import { beginCell, tonCell } from '../web/pwa-contract-transactions.mjs';

function buildExternalBoc(destRaw: string): string {
  const body = beginCell().uint(0x8c2a76b7n, 32, 'op').endCell();
  const root = beginCell()
    .uint(2n, 2, 'ext_in.tag')
    .uint(0n, 2, 'ext_in.src_none')
    .address(destRaw, 'ext_in.dest')
    .coins(0n, 'ext_in.import_fee')
    .uint(0n, 1, 'external.init_none')
    .uint(1n, 1, 'external.body_ref')
    .ref(body, 'external.body')
    .endCell();
  return Buffer.from(tonCell.serializeBoc(root)).toString('base64');
}

// Imports the gateway as a python module and runs `code` against `gw`, printing one JSON line.
function runGatewayPython(code: string, env: Record<string, string> = {}): any {
  const script = [
    'import importlib.util, json, os',
    "spec = importlib.util.spec_from_file_location('gw', os.environ['GW_PATH'])",
    'gw = importlib.util.module_from_spec(spec); spec.loader.exec_module(gw)',
    'out = {}',
    code,
    'print(json.dumps(out))',
  ].join('\n');
  const raw = execFileSync('python', ['-c', script], {
    env: { ...process.env, GW_PATH: gatewayPath, ...env },
    encoding: 'utf8',
  });
  return JSON.parse(raw.trim().split(/\r?\n/).pop() as string);
}

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
    expect(envExample).toMatch(/PLATHO_RPC_ALLOWED_MESSAGE_OPCODES=0xa4f862c0,0xa4f862d1,0x8c2a76b7,0x874e576a/);
    expect(envExample).not.toMatch(/Bearer|QuickNode|Chainstack/);
    // Client-direct model: no provider endpoint routes through the retired rpc.platho.app gateway,
    // and the per-user toncenter key is injected at runtime and never ships in the static bundle.
    expect(config).not.toMatch(/https:\/\/rpc\.platho\.app/);
    expect(config).not.toMatch(/PLATHO_RPC_TONCENTER_API_KEY|X-API-Key|toncenter-mainnet\.key|apiKey:/);
  });

  it('RPC-GATEWAY-02D: reads fall back to TON Access for get-methods and account; broadcast adds a redundant Orbs sendBoc; history stays toncenter-only', () => {
    const gateway = readFileSync(gatewayPath, 'utf8');
    const envExample = readFileSync('deploy/platho-rpc-gateway.env.example', 'utf8');
    const runGetMethodBranch = gateway.slice(
      gateway.indexOf('if kind == "run_get_method":'),
      gateway.indexOf('if kind == "message":'),
    );
    const messageBranch = gateway.slice(
      gateway.indexOf('if kind == "message":'),
      gateway.indexOf('if kind == "messages":'),
    );
    const messagesBranch = gateway.slice(
      gateway.indexOf('if kind == "messages":'),
      gateway.indexOf('if kind == "account":'),
    );
    const accountBranch = gateway.slice(
      gateway.indexOf('if kind == "account":'),
      gateway.indexOf('except ValueError as error:'),
    );

    expect(gateway).toMatch(/PLATHO_RPC_TON_ACCESS_READ_FALLBACK/);
    expect(gateway).toMatch(/def read_fallback_reason\(error\)/);
    // Only connectivity-level upstream trouble is fallback-worthy; ordinary
    // 4xx request errors propagate unchanged.
    expect(gateway).toMatch(/error\.code == 429 or error\.code >= 500/);
    expect(gateway).toMatch(/def log_upstream_fallback\(kind, reason\)/);
    expect(gateway).toMatch(/upstream_fallback route=\{kind\} upstream=ton-access-v2/);
    expect(runGetMethodBranch).toMatch(/read_fallback_reason\(error\)/);
    expect(runGetMethodBranch).toMatch(/log_upstream_fallback\(kind, reason\)/);
    expect(runGetMethodBranch).toMatch(/normalize_run_get_method_response\(upstream\)/);
    expect(accountBranch).toMatch(/read_fallback_reason\(error\)/);
    expect(accountBranch).toMatch(/log_upstream_fallback\(kind, reason\)/);
    // Broadcast does NOT "fall back" on error but submits a REDUNDANT copy through the
    // Orbs v2 /sendBoc path (idempotent external) so delivery never hinges on toncenter
    // alone — the documented ACK-without-delivery failure mode. Message HISTORY has no
    // v2 equivalent and stays toncenter-only.
    expect(gateway).toMatch(/BROADCAST_REDUNDANT_FALLBACK = os\.getenv\("PLATHO_RPC_BROADCAST_REDUNDANT_FALLBACK"/);
    expect(messageBranch).toMatch(/if BROADCAST_REDUNDANT_FALLBACK:/);
    expect(messageBranch).toMatch(/ton_access_base\(\)\}\/sendBoc/);
    expect(messageBranch).toMatch(/log_upstream_fallback\("message"/);
    expect(messagesBranch).not.toMatch(/ton_access_base|read_fallback_reason/);
    expect(envExample).toMatch(/PLATHO_RPC_TON_ACCESS_READ_FALLBACK=1/);
    expect(envExample).toMatch(/PLATHO_RPC_BROADCAST_REDUNDANT_FALLBACK=1/);
  });

  it('RPC-GATEWAY-02E: unknown-delivery broadcast returns 202 unconfirmed, not a false 500', () => {
    const gateway = readFileSync(gatewayPath, 'utf8');
    const messageBranch = gateway.slice(
      gateway.indexOf('if kind == "message":'),
      gateway.indexOf('if kind == "messages":'),
    );
    // When neither toncenter nor the redundant Orbs leg cleanly ACKs, the external
    // is idempotent and delivery is UNKNOWN. The gateway must NOT surface a bare
    // upstream 500 here (the documented false-500 that makes the PWA mark a
    // possibly-delivered message as failed and cascade a burst to "not sent").
    // Only a definitive client-side 4xx (other than 429) still propagates as a
    // hard rejection; everything else reports 202 "unconfirmed" so the client
    // confirms via a nonce read / idempotent re-broadcast.
    expect(messageBranch).toMatch(/primary_status = primary_error\.code if isinstance\(primary_error, HTTPError\) else None/);
    expect(messageBranch).toMatch(/if primary_status is not None and 400 <= primary_status < 500 and primary_status != 429:\s*\n\s*raise primary_error/);
    expect(messageBranch).toMatch(/payload = \{"ok": True, "delivery": "unconfirmed"\}/);
    expect(messageBranch).toMatch(/self\.send_json\(202, payload\)/);
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

  it('RPC-GATEWAY-04: abuse/DoS hardening is wired in source + config', () => {
    const gateway = readFileSync(gatewayPath, 'utf8');
    const envExample = readFileSync('deploy/platho-rpc-gateway.env.example', 'utf8');
    const unit = readFileSync('deploy/platho-rpc-gateway.service', 'utf8');
    const deployCaddy = readFileSync('deploy/Caddyfile', 'utf8');
    const serverCaddy = readFileSync('scripts/server/Caddyfile', 'utf8');

    // Rate-limit key comes from the trusted (Caddy-appended) hop, never the spoofable leftmost token.
    expect(gateway).toMatch(/FORWARDED_FOR_TRUSTED_HOPS/);
    expect(gateway).toMatch(/parts\[-FORWARDED_FOR_TRUSTED_HOPS\]/);
    // Bounded rate-limit buckets + concurrency gate + socket timeout.
    expect(gateway).toMatch(/_sweep_and_cap_buckets/);
    expect(gateway).toMatch(/MAX_RATE_LIMIT_BUCKETS/);
    expect(gateway).toMatch(/request_semaphore\.acquire\(blocking=False\)/);
    expect(gateway).toMatch(/timeout = HANDLER_TIMEOUT_SECONDS/);
    // Threshold-gated key disable + loud logging, not a single-403 global flip.
    expect(gateway).toMatch(/TONCENTER_AUTH_FAIL_THRESHOLD/);
    expect(gateway).toMatch(/toncenter_key_disabled/);
    expect(gateway).toMatch(/register_auth_success/);
    // Broadcast: dedicated limit + require-origin + structural validation + size cap.
    expect(gateway).toMatch(/BROADCAST_RATE_LIMIT_PER_MINUTE/);
    expect(gateway).toMatch(/REQUIRE_ORIGIN_FOR_BROADCAST/);
    expect(gateway).toMatch(/VALIDATE_BROADCAST_STRUCTURE/);
    expect(gateway).toMatch(/extract_external_destination/);
    expect(gateway).toMatch(/MESSAGE_BOC_NOT_EXTERNAL/);
    expect(gateway).toMatch(/MESSAGE_MAX_BOC_CHARS/);
    // Account + runGetMethod no longer pass unvalidated input to the keyed upstream.
    expect(gateway).toMatch(/validated_account_target/);
    expect(gateway).toMatch(/ACCOUNT_QUERY_NOT_ALLOWED/);
    expect(gateway).toMatch(/GET_METHOD_ADDRESS_INVALID/);
    // Orbs node id is validated before URL interpolation; weights parse totally.
    expect(gateway).toMatch(/NODE_ID_RE/);
    expect(gateway).toMatch(/def safe_weight/);
    // Upstream error bodies are not leaked to clients by default.
    expect(gateway).toMatch(/EXPOSE_UPSTREAM_ERRORS/);
    // Reject chunked transfer-encoding (the server is chunked-blind) + negative content-length.
    expect(gateway).toMatch(/TRANSFER_ENCODING_UNSUPPORTED/);
    expect(gateway).toMatch(/length < 0/);

    expect(envExample).toMatch(/PLATHO_RPC_FORWARDED_FOR_TRUSTED_HOPS=1/);
    expect(envExample).toMatch(/PLATHO_RPC_BROADCAST_RATE_LIMIT_PER_MINUTE=/);
    expect(envExample).toMatch(/PLATHO_RPC_VALIDATE_BROADCAST_STRUCTURE=1/);
    expect(envExample).toMatch(/PLATHO_RPC_REQUIRE_ORIGIN_FOR_BROADCAST=1/);
    expect(envExample).toMatch(/PLATHO_RPC_EXPOSE_UPSTREAM_ERRORS=0/);

    // systemd resource ceilings + sandbox.
    expect(unit).toMatch(/MemoryMax=/);
    expect(unit).toMatch(/TasksMax=/);
    expect(unit).toMatch(/SystemCallFilter=/);
    expect(unit).toMatch(/RestrictAddressFamilies=AF_INET AF_INET6/);

    // Both checked-in Caddyfiles pin the rpc edge controls (no config drift).
    for (const caddy of [deployCaddy, serverCaddy]) {
      expect(caddy).toMatch(/header_up X-Forwarded-For \{remote_host\}/);
      expect(caddy).toMatch(/max_size 256KiB/);
      expect(caddy).toMatch(/@badmethods not method GET POST OPTIONS/);
    }
    expect(deployCaddy).toMatch(/Alt-Svc "clear"/);
  });

  it('RPC-GATEWAY-05: broadcast accepts a real external, rejects garbage/non-externals, extracts dest', () => {
    const vaultRaw = parseTonAddress(PLATHO_APP_CONFIG.vault.address).raw;
    const boc = buildExternalBoc(vaultRaw);
    const plainCell = Buffer.from(tonCell.serializeBoc(beginCell().uint(5n, 32, 'x').endCell())).toString('base64');
    const garbage = Buffer.from('this is not a boc, just bytes here').toString('base64');

    const result = runGatewayPython(
      [
        'import json',
        "boc = os.environ['BOC']",
        'out["dest"] = gw.extract_external_destination(boc)',
        'try:',
        '    gw.validated_send_message_payload(json.dumps({"boc": boc}).encode()); out["accept_real"] = True',
        'except Exception as e: out["accept_real"] = False; out["accept_real_err"] = str(e)',
        'def rejected(b):',
        '    try:',
        '        gw.validated_send_message_payload(json.dumps({"boc": b}).encode()); return False',
        '    except PermissionError: return True',
        'out["reject_garbage"] = rejected(os.environ["GARBAGE"])',
        'out["reject_plaincell"] = rejected(os.environ["PLAINCELL"])',
      ].join('\n'),
      { BOC: boc, GARBAGE: garbage, PLAINCELL: plainCell },
    );

    expect(result.dest).toBe(vaultRaw);
    expect(result.accept_real).toBe(true);
    expect(result.reject_garbage).toBe(true);
    expect(result.reject_plaincell).toBe(true);
  });

  it('RPC-GATEWAY-05B: optional broadcast destination allowlist rejects a non-allowlisted target', () => {
    const vaultRaw = parseTonAddress(PLATHO_APP_CONFIG.vault.address).raw;
    const boc = buildExternalBoc(vaultRaw);
    const otherAddr = `0:${'0'.repeat(64)}`;

    const result = runGatewayPython(
      [
        'import json',
        'try:',
        "    gw.validated_send_message_payload(json.dumps({'boc': os.environ['BOC']}).encode()); out['accepted'] = True",
        'except PermissionError as e: out["accepted"] = False; out["err"] = str(e)',
      ].join('\n'),
      { BOC: boc, PLATHO_RPC_ALLOWED_BROADCAST_DESTINATIONS: otherAddr },
    );

    expect(result.accepted).toBe(false);
    expect(result.err).toMatch(/MESSAGE_DESTINATION_NOT_ALLOWED/);
  });

  it('RPC-GATEWAY-06: rate-limit key uses the trusted last X-Forwarded-For hop, not the spoofed leftmost', () => {
    const result = runGatewayPython(
      [
        'import types',
        'def fake(xff):',
        '    h = types.SimpleNamespace()',
        '    h.headers = {"X-Forwarded-For": xff}',
        '    h.client_address = ("127.0.0.1", 0)',
        '    return h',
        'out["spoof_leftmost"] = gw.client_ip(fake("1.2.3.4, 9.9.9.9"))',
        'out["single"] = gw.client_ip(fake("9.9.9.9"))',
        'out["empty"] = gw.client_ip(fake(""))',
      ].join('\n'),
    );
    // Attacker-supplied leftmost token (1.2.3.4) must be ignored; the Caddy-appended hop wins.
    expect(result.spoof_leftmost).toBe('9.9.9.9');
    expect(result.single).toBe('9.9.9.9');
    expect(result.empty).toBe('127.0.0.1');
  });

  it('RPC-GATEWAY-07: account route rejects extra query keys and bad addresses', () => {
    const result = runGatewayPython(
      [
        'base = "https://toncenter.com/api/v2/getAddressInformation"',
        'def check(path):',
        '    try:',
        '        gw.validated_account_target(path, base); return "ok"',
        '    except PermissionError as e: return "reject:" + str(e)',
        'out["extra_key"] = check("/api/v2/getAddressInformation?address=0:abc&evil=1")',
        'out["bad_addr"] = check("/api/v2/getAddressInformation?address=" + ("x" * 400))',
        'out["good"] = check("/api/v2/getAddressInformation?address=0:" + ("a" * 64))',
      ].join('\n'),
    );
    expect(result.extra_key).toMatch(/^reject:ACCOUNT_QUERY_NOT_ALLOWED/);
    expect(result.bad_addr).toMatch(/^reject:ACCOUNT_ADDRESS_INVALID/);
    expect(result.good).toBe('ok');
  });
});
