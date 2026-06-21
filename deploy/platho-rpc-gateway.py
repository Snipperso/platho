#!/usr/bin/env python3
"""Platho read-only/broadcast TON RPC gateway.

Security posture (see deploy/platho-rpc-gateway.env.example for the knobs):
  * The gateway is an UNAUTHENTICATED public endpoint (a static-PWA backend cannot
    ship a secret). CORS is a browser-only convenience header and is NOT treated as
    access control. The real defenses are: a real client-IP rate limit (keyed on the
    Caddy-appended hop, never the client-supplied X-Forwarded-For), a dedicated
    stricter broadcast limit, an optional global keyed-upstream ceiling, a bounded
    request-concurrency gate, request/socket timeouts, and structural validation of
    every relayed external.
  * The paid TonCenter key is read from a root-only file and only ever attached to
    TonCenter requests (never Orbs). It is never returned to clients or logged.
"""
import base64
import json
import os
import random
import re
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse
from urllib.request import Request, urlopen


def env_flag(name, default):
    return os.getenv(name, default).strip().lower() not in ("0", "false", "off", "no")


# Production allowlist is set via PLATHO_RPC_ALLOWED_ORIGINS. The default is
# prod-only (platho.app); localhost dev origins are added back ONLY when
# PLATHO_RPC_DEV=1 so an unset env var fails closed in production.
DEFAULT_ALLOWED_ORIGINS = [
    "https://platho.app",
    "https://www.platho.app",
]
DEV_ALLOWED_ORIGINS = [
    "http://127.0.0.1:8787",
    "http://localhost:8787",
]

DEFAULT_ALLOWED_GET_METHODS = [
    "dnsresolve",
    "get_ath_wallet_address",
    "get_ath_withdrawal_id",
    "get_avatar",
    "get_avatar_version",
    "get_canonical_publish_charge",
    "get_global",
    "get_jetton_data",
    "get_key_record",
    "get_name_record",
    "get_pending_ath_withdrawal_for",
    "get_pending_burn_flush",
    "get_pending_mint",
    "get_pending_notification",
    "get_pending_treasury_flush",
    "get_private_entry",
    "get_private_recipient_index",
    "get_private_sender_index",
    "get_private_page",
    "get_public_entry",
    "get_public_page",
    "get_receive_intent",
    "get_receive_intent_commitment",
    "get_receive_intent_id",
    "get_state",
    "get_user",
    "get_username_item_address",
    "get_username_price",
    "get_wallet_address",
    "get_wallet_data",
    "seqno",
]

ROUTES = {
    ("POST", "/api/v3/runGetMethod"): "run_get_method",
    ("POST", "/api/v3/message"): "message",
    ("GET", "/api/v3/messages"): "messages",
    ("GET", "/api/v2/getAddressInformation"): "account",
}

DEFAULT_ALLOWED_MESSAGE_OPCODES = [
    "0xa4f862c0",  # PublishPrivateFromVault
    "0x8c2a76b7",  # PublishPublicFromVault
    "0x874e576a",  # CapsuleHub publish ACK
]

MESSAGE_QUERY_ALLOWED_KEYS = {
    "destination",
    "source",
    "opcode",
    "exclude_externals",
    "limit",
    "sort",
    "body_hash",
    "start_utime",
    "end_utime",
    "offset",
}

# Only `address` may reach the keyed v2 account read; the raw client query is never
# forwarded verbatim (it used to be — an unmetered arbitrary-account read primitive).
ACCOUNT_QUERY_ALLOWED_KEYS = {"address"}

BOC_BASE64_RE = re.compile(r"^[A-Za-z0-9+/=_-]+$")
# Permissive-but-bounded: blocks query injection / oversized values without pinning a
# single address form (raw `wc:hex`, base64, base64url all pass). Account BALANCE reads
# are inherently for arbitrary user wallets, so we validate shape, not identity.
TON_ADDRESS_RE = re.compile(r"^[-0-9A-Za-z_:/+=]{1,256}$")

BOC_MAGIC = b"\xb5\xee\x9c\x72"


def split_list(value, fallback):
    if not value:
        return list(fallback)
    return [item.strip() for item in value.split(",") if item.strip()]


HOST = os.getenv("PLATHO_RPC_HOST", "127.0.0.1")
PORT = int(os.getenv("PLATHO_RPC_PORT", "8790"))
UPSTREAM_KIND = os.getenv("PLATHO_RPC_UPSTREAM_KIND", "ton-access-v2").lower()
TON_ACCESS_HOST = os.getenv("PLATHO_RPC_TON_ACCESS_HOST", "ton.access.orbs.network")
TON_ACCESS_NETWORK = os.getenv("PLATHO_RPC_TON_ACCESS_NETWORK", "mainnet")
TON_ACCESS_MANAGER_PATH = os.getenv("PLATHO_RPC_TON_ACCESS_MANAGER_PATH", "/mngr/nodes?npm_version=2.3.0")
TON_ACCESS_NODE_TTL_MS = int(os.getenv("PLATHO_RPC_TON_ACCESS_NODE_TTL_MS", "60000"))
# Read-method resilience: when the primary toncenter-v3 upstream times out or
# fails server-side, get-method and account reads retry once through the
# anonymous TON Access (Orbs) v2 path. Broadcast and message history have no
# v2 equivalent and intentionally never fall back.
TON_ACCESS_READ_FALLBACK = os.getenv("PLATHO_RPC_TON_ACCESS_READ_FALLBACK", "1").strip().lower() not in ("0", "false", "off", "no")
# Broadcast resilience: toncenter v3 /message can ACK (HTTP 200 + message_hash) WITHOUT the
# external actually reaching the network (upstream queue/timeout — the documented gateway
# upstream-timeout failure mode). When enabled, every broadcast is ALSO submitted through the
# keyless Orbs (TON Access) v2 /sendBoc path, so delivery no longer depends on a single
# provider. The external is idempotent (fixed wallet seqno) — a duplicate broadcast is
# harmless: at most one copy is ever accepted on-chain.
BROADCAST_REDUNDANT_FALLBACK = os.getenv("PLATHO_RPC_BROADCAST_REDUNDANT_FALLBACK", "1").strip().lower() not in ("0", "false", "off", "no")
TONCENTER_V3_BASE = os.getenv("PLATHO_RPC_TONCENTER_V3_BASE", "https://toncenter.com/api/v3").rstrip("/")
TONCENTER_V2_BASE = os.getenv("PLATHO_RPC_TONCENTER_V2_BASE", "https://toncenter.com/api/v2").rstrip("/")
TONCENTER_API_KEY = os.getenv("PLATHO_RPC_TONCENTER_API_KEY", "").strip()
TONCENTER_API_KEY_FILE = os.getenv("PLATHO_RPC_TONCENTER_API_KEY_FILE", "").strip()
TONCENTER_AUTH_RETRY_MS = int(os.getenv("PLATHO_RPC_TONCENTER_AUTH_RETRY_MS", "60000"))
# A single transient upstream 401/403 (often a Cloudflare/WAF challenge attributed to the
# request, not the key) must NOT silently flip the whole process keyless. Only after this
# many CONSECUTIVE 401s do we disable the key process-wide; 403 only degrades that one
# request. Any keyed 2xx resets the counter.
TONCENTER_AUTH_FAIL_THRESHOLD = int(os.getenv("PLATHO_RPC_TONCENTER_AUTH_FAIL_THRESHOLD", "3"))
MAX_BODY_BYTES = int(os.getenv("PLATHO_RPC_MAX_BODY_BYTES", "262144"))
# A valid single TON external is capped at 65535 bytes (config-43); its base64 is ~87380
# chars. Cap the /message boc well under MAX_BODY_BYTES so a 256KB padding blob can never be
# relayed (and so the redundant double-broadcast can't be used as a bandwidth amplifier).
MESSAGE_MAX_BOC_CHARS = int(os.getenv("PLATHO_RPC_MESSAGE_MAX_BOC_CHARS", "90000"))
UPSTREAM_TIMEOUT_SECONDS = float(os.getenv("PLATHO_RPC_UPSTREAM_TIMEOUT_MS", "15000")) / 1000.0
# Inbound socket timeout caps slowloris / dribbled bodies (BaseHTTPRequestHandler.timeout
# defaults to None = never).
HANDLER_TIMEOUT_SECONDS = float(os.getenv("PLATHO_RPC_HANDLER_TIMEOUT_MS", "15000")) / 1000.0
UPSTREAM_USER_AGENT = os.getenv("PLATHO_RPC_UPSTREAM_USER_AGENT", "PlathoRpcGateway/1.0 (+https://platho.app)").strip()
RATE_LIMIT_PER_MINUTE = int(os.getenv("PLATHO_RPC_RATE_LIMIT_PER_MINUTE", "240"))
# A much tighter dedicated limit for the state-changing broadcast route.
BROADCAST_RATE_LIMIT_PER_MINUTE = int(os.getenv("PLATHO_RPC_BROADCAST_RATE_LIMIT_PER_MINUTE", "30"))
# Optional global circuit breaker on key-bearing upstream calls (0 = off). Bounds total
# paid-key spend even under distributed abuse; set after observing real traffic.
GLOBAL_UPSTREAM_PER_MINUTE = int(os.getenv("PLATHO_RPC_GLOBAL_UPSTREAM_PER_MINUTE", "0"))
# Bounded request concurrency: caps simultaneously in-flight handlers so thread-per-connection
# floods / slow-upstream pile-ups can't exhaust threads+FDs. Excess requests get a fast 503.
MAX_CONCURRENT_REQUESTS = int(os.getenv("PLATHO_RPC_MAX_CONCURRENT_REQUESTS", "64"))
# Hard ceiling on distinct rate-limit buckets (defense-in-depth against dict-growth DoS).
MAX_RATE_LIMIT_BUCKETS = int(os.getenv("PLATHO_RPC_MAX_RATE_LIMIT_BUCKETS", "50000"))
# Number of trusted reverse-proxy hops in front of the gateway (Caddy = 1). The real client
# IP is the Nth-from-last X-Forwarded-For token; client-supplied leftmost tokens are ignored.
# 0 = ignore X-Forwarded-For entirely and use the TCP peer.
FORWARDED_FOR_TRUSTED_HOPS = int(os.getenv("PLATHO_RPC_FORWARDED_FOR_TRUSTED_HOPS", "1"))
# Reject the state-changing broadcast when no Origin is present (cheap brake on no-Origin curl
# abuse; Origin is spoofable so this is only one layer).
REQUIRE_ORIGIN_FOR_BROADCAST = env_flag("PLATHO_RPC_REQUIRE_ORIGIN_FOR_BROADCAST", "1")
# Structurally validate every relayed external (well-formed single ext-in message with a
# standard internal destination). Rejects garbage/non-external blobs. Our builders always
# produce valid externals, so this never rejects a legitimate send.
VALIDATE_BROADCAST_STRUCTURE = env_flag("PLATHO_RPC_VALIDATE_BROADCAST_STRUCTURE", "1")
# Never echo raw upstream error bodies to clients (upstream recon + future-key-reflection
# risk). Server logs still keep the full detail.
EXPOSE_UPSTREAM_ERRORS = env_flag("PLATHO_RPC_EXPOSE_UPSTREAM_ERRORS", "0")

_dev_origins = DEV_ALLOWED_ORIGINS if env_flag("PLATHO_RPC_DEV", "0") else []
ALLOWED_ORIGINS = set(split_list(os.getenv("PLATHO_RPC_ALLOWED_ORIGINS"), DEFAULT_ALLOWED_ORIGINS + _dev_origins))
ALLOWED_GET_METHODS = set(split_list(os.getenv("PLATHO_RPC_ALLOWED_GET_METHODS"), DEFAULT_ALLOWED_GET_METHODS))
ALLOWED_MESSAGE_DESTINATIONS = set(split_list(os.getenv("PLATHO_RPC_ALLOWED_MESSAGE_DESTINATIONS"), []))
ALLOWED_MESSAGE_SOURCES = set(split_list(os.getenv("PLATHO_RPC_ALLOWED_MESSAGE_SOURCES"), []))
ALLOWED_MESSAGE_OPCODES = {
    item.lower()
    for item in split_list(os.getenv("PLATHO_RPC_ALLOWED_MESSAGE_OPCODES"), DEFAULT_ALLOWED_MESSAGE_OPCODES)
}
# Optional destination allowlist specifically for the BROADCAST route (empty = structural
# validation only). Leave empty unless EVERY broadcast target is known — wallet
# activation/transfer externals are addressed to the user's own wallet, so a hard allowlist
# here would break onboarding.
ALLOWED_BROADCAST_DESTINATIONS = set(split_list(os.getenv("PLATHO_RPC_ALLOWED_BROADCAST_DESTINATIONS"), []))
MESSAGE_MAX_OFFSET = int(os.getenv("PLATHO_RPC_MESSAGES_MAX_OFFSET", "8000"))
NODE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,128}$")

ton_access_nodes_cache = {"expires_at": 0, "nodes": []}
toncenter_api_key_cache = {"path": None, "mtime": None, "value": None}
toncenter_auth_state = {"disabled_until": 0, "consecutive_failures": 0}
rate_limit_buckets = {}
global_upstream_bucket = {"count": 0, "reset_at": 0}
key_fail_open_logged = {"at": 0}

# Guards the small read-modify-write sections on the shared dicts above. Held only for
# microscopic critical sections, never across network I/O.
_state_lock = threading.Lock()
# Single-flight for the Orbs node-manager refresh so a cache miss doesn't thunder.
_nodes_lock = threading.Lock()
# Bounds concurrent in-flight handlers.
request_semaphore = threading.BoundedSemaphore(max(1, MAX_CONCURRENT_REQUESTS))


def json_response(handler, status, payload, extra_headers=None):
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("X-Content-Type-Options", "nosniff")
    if extra_headers:
        for key, value in extra_headers.items():
            handler.send_header(key, value)
    handler.end_headers()
    handler.wfile.write(json.dumps(payload, separators=(",", ":")).encode("utf-8"))


def fetch_json(url, method="GET", body=None, extra_headers=None):
    headers = {"Accept": "application/json"}
    if UPSTREAM_USER_AGENT:
        headers["User-Agent"] = UPSTREAM_USER_AGENT
    if extra_headers:
        headers.update(extra_headers)
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body, separators=(",", ":")).encode("utf-8")
    request = Request(url, data=data, headers=headers, method=method)
    with urlopen(request, timeout=UPSTREAM_TIMEOUT_SECONDS) as response:
        raw = response.read()
        if not raw:
            return response.status, {}
        return response.status, json.loads(raw.decode("utf-8"))


def upstream_error_detail(raw):
    text = str(raw or "").strip()
    if not text:
        return ""
    try:
        payload = json.loads(text)
        detail = (
            payload.get("error")
            or payload.get("message")
            or payload.get("description")
            or (payload.get("result") or {}).get("error")
            or (payload.get("result") or {}).get("message")
            or (payload.get("result") or {}).get("description")
        )
        if detail:
            return str(detail)[:1000]
    except Exception:
        pass
    return text[:1000]


def http_error_detail(error):
    try:
        raw = error.read().decode("utf-8", errors="replace")
    except Exception:
        return ""
    return upstream_error_detail(raw)


def log_upstream_error(kind, error, detail=""):
    safe_detail = f" detail={detail}" if detail else ""
    print(f"upstream_error route={kind} status={getattr(error, 'code', 'unknown')}{safe_detail}", file=sys.stderr, flush=True)


def log_upstream_fallback(kind, reason):
    print(f"upstream_fallback route={kind} upstream=ton-access-v2 reason={reason}", file=sys.stderr, flush=True)


def log_security(event, detail=""):
    safe_detail = f" {detail}" if detail else ""
    print(f"security_event {event}{safe_detail}", file=sys.stderr, flush=True)


def read_fallback_reason(error):
    # Only connectivity-level upstream trouble is fallback-worthy. Client
    # errors (4xx other than 429) describe the request, not the upstream,
    # and must propagate unchanged.
    if isinstance(error, HTTPError):
        if error.code == 429 or error.code >= 500:
            return f"http_{error.code}"
        return None
    if isinstance(error, TimeoutError):
        return "timeout"
    if isinstance(error, URLError):
        return "network"
    return None


def safe_weight(raw):
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return 1
    if value < 1:
        return 1
    if value > 1_000_000:
        return 1_000_000
    return value


def weighted_node(nodes):
    total = sum(safe_weight(node.get("Weight")) for node in nodes)
    roll = random.randrange(max(1, total))
    for node in nodes:
        roll -= safe_weight(node.get("Weight"))
        if roll < 0:
            return node
    return nodes[0]


def toncenter_api_key():
    if TONCENTER_API_KEY:
        return TONCENTER_API_KEY
    if not TONCENTER_API_KEY_FILE:
        return ""
    try:
        stat = os.stat(TONCENTER_API_KEY_FILE)
        with _state_lock:
            cached = (
                toncenter_api_key_cache["path"] == TONCENTER_API_KEY_FILE
                and toncenter_api_key_cache["mtime"] == stat.st_mtime
                and toncenter_api_key_cache["value"] is not None
            )
            if cached:
                return toncenter_api_key_cache["value"]
        with open(TONCENTER_API_KEY_FILE, "r", encoding="utf-8") as handle:
            value = handle.read().strip()
        with _state_lock:
            toncenter_api_key_cache.update({"path": TONCENTER_API_KEY_FILE, "mtime": stat.st_mtime, "value": value})
        if not value:
            note_key_fail_open("key file is empty")
        return value
    except OSError:
        note_key_fail_open("key file is configured but unreadable")
        return ""


def note_key_fail_open(reason):
    # A configured-but-unusable key must be LOUD, not a silent keyless downgrade.
    now = int(time.time() * 1000)
    with _state_lock:
        if now - key_fail_open_logged["at"] < 60000:
            return
        key_fail_open_logged["at"] = now
    log_security("key_fail_open", reason)


def toncenter_headers():
    api_key = toncenter_api_key()
    with _state_lock:
        disabled = int(time.time() * 1000) < toncenter_auth_state["disabled_until"]
    if disabled:
        return {}
    return {"X-API-Key": api_key} if api_key else {}


def register_auth_failure(code):
    # 401 = the key is genuinely rejected -> count toward the global-disable threshold.
    # 403 = usually a per-request WAF/geo block attributed to the request, NOT the key ->
    # retry THIS call keyless without poisoning global state for everyone.
    if code != 401:
        return
    now = int(time.time() * 1000)
    with _state_lock:
        toncenter_auth_state["consecutive_failures"] += 1
        fails = toncenter_auth_state["consecutive_failures"]
        if fails >= TONCENTER_AUTH_FAIL_THRESHOLD:
            toncenter_auth_state["disabled_until"] = now + TONCENTER_AUTH_RETRY_MS
            crossed = True
        else:
            crossed = False
    if crossed:
        log_security("toncenter_key_disabled", f"consecutive_401={fails} retry_ms={TONCENTER_AUTH_RETRY_MS}")


def register_auth_success():
    with _state_lock:
        if toncenter_auth_state["consecutive_failures"]:
            toncenter_auth_state["consecutive_failures"] = 0


def fetch_toncenter_json(url, method="GET", body=None):
    headers = toncenter_headers()
    if not headers:
        return fetch_json(url, method=method, body=body)
    try:
        result = fetch_json(url, method=method, body=body, extra_headers=headers)
        register_auth_success()
        return result
    except HTTPError as error:
        if error.code not in (401, 403):
            raise
        register_auth_failure(error.code)
        return fetch_json(url, method=method, body=body)


def global_upstream_allowed():
    if GLOBAL_UPSTREAM_PER_MINUTE <= 0:
        return True
    now = int(time.time() * 1000)
    with _state_lock:
        if global_upstream_bucket["reset_at"] <= now:
            global_upstream_bucket["count"] = 1
            global_upstream_bucket["reset_at"] = now + 60000
            return True
        global_upstream_bucket["count"] += 1
        return global_upstream_bucket["count"] <= GLOBAL_UPSTREAM_PER_MINUTE


def ton_access_base():
    now = int(time.time() * 1000)
    with _state_lock:
        if ton_access_nodes_cache["expires_at"] > now and ton_access_nodes_cache["nodes"]:
            node = weighted_node(ton_access_nodes_cache["nodes"])
            return f"https://{TON_ACCESS_HOST}/{node['NodeId']}/1/{TON_ACCESS_NETWORK}/toncenter-api-v2"

    # Single-flight the manager refresh so a cache miss under load doesn't thunder.
    with _nodes_lock:
        now = int(time.time() * 1000)
        with _state_lock:
            if ton_access_nodes_cache["expires_at"] > now and ton_access_nodes_cache["nodes"]:
                node = weighted_node(ton_access_nodes_cache["nodes"])
                return f"https://{TON_ACCESS_HOST}/{node['NodeId']}/1/{TON_ACCESS_NETWORK}/toncenter-api-v2"

        status, nodes = fetch_json(f"https://{TON_ACCESS_HOST}{TON_ACCESS_MANAGER_PATH}")
        if status < 200 or status >= 300 or not isinstance(nodes, list):
            raise RuntimeError(f"TON_ACCESS_MANAGER_{status}")
        health_key = f"v2-{TON_ACCESS_NETWORK}"
        healthy = [
            node
            for node in nodes
            if str(node.get("Healthy")) == "1"
            and node.get("Mngr", {}).get("health", {}).get(health_key) is True
            and isinstance(node.get("NodeId"), str)
            and NODE_ID_RE.fullmatch(node.get("NodeId"))
        ]
        if not healthy:
            raise RuntimeError("TON_ACCESS_NO_HEALTHY_V2_NODE")
        with _state_lock:
            ton_access_nodes_cache["expires_at"] = now + TON_ACCESS_NODE_TTL_MS
            ton_access_nodes_cache["nodes"] = healthy
        node = weighted_node(healthy)
        url = f"https://{TON_ACCESS_HOST}/{node['NodeId']}/1/{TON_ACCESS_NETWORK}/toncenter-api-v2"
        # Belt-and-suspenders: NodeId is regex-confined to the path, but never let it move the host.
        if urlparse(url).netloc != TON_ACCESS_HOST:
            raise RuntimeError("TON_ACCESS_NODE_ID_REJECTED")
        return url


def to_legacy_stack_item(item):
    if isinstance(item, list):
        return item
    item_type = str(item.get("type", "")).lower() if isinstance(item, dict) else ""
    value = None
    if isinstance(item, dict):
        value = item.get("value", item.get("boc", item.get("cell")))
    if item_type in ("num", "int"):
        return ["num", str(value if value is not None else "0")]
    if item_type == "slice":
        return ["tvm.Slice", str(value or "")]
    if item_type == "cell":
        return ["tvm.Cell", str(value or "")]
    raise ValueError(f"UNSUPPORTED_STACK_ITEM:{item_type or 'missing'}")


def to_v3_stack_item(item):
    if not isinstance(item, list):
        return item
    item_type = str(item[0] if len(item) > 0 else "").lower()
    raw = item[1] if len(item) > 1 else None
    if isinstance(raw, dict):
        value = raw.get("bytes", raw.get("value", raw.get("boc", raw.get("cell"))))
    else:
        value = raw
    if "num" in item_type or "int" in item_type:
        return {"type": "num", "value": str(value if value is not None else "0")}
    if "slice" in item_type:
        return {"type": "slice", "value": str(value or ""), "boc": str(value or "")}
    if "cell" in item_type:
        cell = str(value or "")
        return {"type": "cell", "value": cell, "boc": cell, "cell": cell}
    return {"type": item_type or "unsupported", "value": value}


def load_run_get_method_payload(body_bytes):
    payload = json.loads(body_bytes.decode("utf-8") if body_bytes else "{}")
    method = str(payload.get("method") or "")
    if method not in ALLOWED_GET_METHODS:
        raise PermissionError(f"GET_METHOD_NOT_ALLOWED:{method or 'missing'}")
    address = str(payload.get("address") or "")
    if not TON_ADDRESS_RE.fullmatch(address):
        raise PermissionError("GET_METHOD_ADDRESS_INVALID")
    stack = payload.get("stack") or []
    if not isinstance(stack, list) or len(stack) > 16:
        raise PermissionError("GET_METHOD_STACK_INVALID")
    return payload


def normalize_run_get_method(body_bytes):
    payload = load_run_get_method_payload(body_bytes)
    method = str(payload.get("method") or "")
    return {
        "jsonrpc": "2.0",
        "id": "platho",
        "method": "runGetMethod",
        "params": {
            "address": payload.get("address"),
            "method": method,
            "stack": [to_legacy_stack_item(item) for item in payload.get("stack") or []],
        },
    }


def normalize_run_get_method_response(upstream_json):
    result = upstream_json.get("result") or {}
    stack = [to_v3_stack_item(item) for item in result.get("stack") or []]
    normalized_result = dict(result)
    normalized_result["stack"] = stack
    return {
        "ok": upstream_json.get("ok") is not False,
        "result": normalized_result,
        "exit_code": result.get("exit_code", 0),
        "stack": stack,
    }


def validated_account_target(path, base):
    parsed = urlparse(path)
    params = parse_qs(parsed.query, keep_blank_values=True)
    extra_keys = set(params) - ACCOUNT_QUERY_ALLOWED_KEYS
    if extra_keys:
        raise PermissionError(f"ACCOUNT_QUERY_NOT_ALLOWED:{sorted(extra_keys)[0]}")
    values = params.get("address")
    if not values:
        raise PermissionError("ACCOUNT_QUERY_MISSING:address")
    if len(values) != 1:
        raise PermissionError("ACCOUNT_QUERY_REPEATED:address")
    address = values[0]
    if not TON_ADDRESS_RE.fullmatch(address):
        raise PermissionError("ACCOUNT_ADDRESS_INVALID")
    upstream = urlparse(base)
    return urlunparse((upstream.scheme, upstream.netloc, upstream.path, "", urlencode({"address": address}), ""))


def single_query_value(params, key, required=False):
    values = params.get(key)
    if not values:
        if required:
            raise PermissionError(f"MESSAGES_QUERY_MISSING:{key}")
        return None
    if len(values) != 1:
        raise PermissionError(f"MESSAGES_QUERY_REPEATED:{key}")
    return values[0]


def validated_int_query(params, key, minimum=0, maximum=None, required=False):
    value = single_query_value(params, key, required=required)
    if value is None:
        return None
    if not re.fullmatch(r"[0-9]+", value):
        raise PermissionError(f"MESSAGES_QUERY_INVALID:{key}")
    parsed = int(value)
    if parsed < minimum or (maximum is not None and parsed > maximum):
        raise PermissionError(f"MESSAGES_QUERY_OUT_OF_RANGE:{key}")
    return str(parsed)


def validated_messages_query(path):
    parsed = urlparse(path)
    params = parse_qs(parsed.query, keep_blank_values=True)
    extra_keys = set(params) - MESSAGE_QUERY_ALLOWED_KEYS
    if extra_keys:
        raise PermissionError(f"MESSAGES_QUERY_NOT_ALLOWED:{sorted(extra_keys)[0]}")
    destination = single_query_value(params, "destination", required=True)
    if destination not in ALLOWED_MESSAGE_DESTINATIONS:
        raise PermissionError("MESSAGES_DESTINATION_NOT_ALLOWED")
    source = single_query_value(params, "source")
    if source is not None and (not ALLOWED_MESSAGE_SOURCES or source not in ALLOWED_MESSAGE_SOURCES):
        raise PermissionError("MESSAGES_SOURCE_NOT_ALLOWED")
    opcode = single_query_value(params, "opcode", required=True)
    if opcode.lower() not in ALLOWED_MESSAGE_OPCODES:
        raise PermissionError("MESSAGES_OPCODE_NOT_ALLOWED")
    sort = single_query_value(params, "sort") or "desc"
    if sort not in ("asc", "desc"):
        raise PermissionError("MESSAGES_QUERY_INVALID:sort")
    exclude_externals = single_query_value(params, "exclude_externals")
    if exclude_externals is not None and exclude_externals.lower() not in ("true", "false", "1", "0"):
        raise PermissionError("MESSAGES_QUERY_INVALID:exclude_externals")
    body_hash = single_query_value(params, "body_hash")
    if body_hash is not None and not re.fullmatch(r"(0x)?[0-9a-fA-F]{64}", body_hash):
        raise PermissionError("MESSAGES_QUERY_INVALID:body_hash")
    start_utime = validated_int_query(params, "start_utime")
    end_utime = validated_int_query(params, "end_utime")
    limit = validated_int_query(params, "limit", minimum=1, maximum=1000) or "100"
    offset = validated_int_query(params, "offset", minimum=0, maximum=MESSAGE_MAX_OFFSET)
    cleaned = {
        "destination": destination,
        "opcode": opcode,
        "exclude_externals": exclude_externals if exclude_externals is not None else "true",
        "limit": limit,
        "sort": sort,
    }
    if source is not None:
        cleaned["source"] = source
    if body_hash is not None:
        cleaned["body_hash"] = body_hash
    if start_utime is not None:
        cleaned["start_utime"] = start_utime
    if end_utime is not None:
        cleaned["end_utime"] = end_utime
    if offset is not None:
        cleaned["offset"] = offset
    upstream = urlparse(f"{TONCENTER_V3_BASE}/messages")
    return urlunparse((upstream.scheme, upstream.netloc, upstream.path, "", urlencode(cleaned), ""))


# --- BoC structural validation (ported from web/pwa-contract-transactions.mjs parseBocBase64
# + crypto/platho-crypto.mjs; matches the externals our builders serialize) -----------------

def _boc_read_uint(data, offset, length, name):
    if offset + length > len(data):
        raise ValueError(f"{name}_truncated")
    out = 0
    for i in range(length):
        out = (out << 8) | data[offset + i]
    return out, offset + length


def parse_boc_root_cell(raw):
    if len(raw) < 10 or raw[0:4] != BOC_MAGIC:
        raise ValueError("boc_magic")
    offset = 4
    flags = raw[offset]; offset += 1
    has_index = bool(flags & 0x80)
    has_crc32 = bool(flags & 0x40)
    has_cache_bits = bool(flags & 0x20)
    boc_flags = (flags >> 3) & 0x03
    size_bytes = flags & 0x07
    off_bytes = raw[offset]; offset += 1
    if has_cache_bits or boc_flags != 0:
        raise ValueError("boc_flags")
    if not (1 <= size_bytes <= 4) or not (1 <= off_bytes <= 4):
        raise ValueError("boc_counter_width")
    cells_count, offset = _boc_read_uint(raw, offset, size_bytes, "cells_count")
    roots_count, offset = _boc_read_uint(raw, offset, size_bytes, "roots_count")
    absent_count, offset = _boc_read_uint(raw, offset, size_bytes, "absent_count")
    total_cells_size, offset = _boc_read_uint(raw, offset, off_bytes, "total_cells_size")
    if roots_count != 1 or absent_count != 0:
        raise ValueError("boc_root_count")
    if cells_count < 1 or cells_count > 4096:
        raise ValueError("boc_cells_count")
    root_index, offset = _boc_read_uint(raw, offset, size_bytes, "root_index")
    if has_index:
        index_bytes = cells_count * off_bytes
        if offset + index_bytes > len(raw):
            raise ValueError("boc_index_truncated")
        offset += index_bytes
    cells_end = offset + total_cells_size
    trailer = 4 if has_crc32 else 0
    if cells_end + trailer > len(raw):
        raise ValueError("boc_data_truncated")
    parsed = []
    for _ in range(cells_count):
        if offset + 2 > len(raw):
            raise ValueError("boc_descriptor_truncated")
        d1 = raw[offset]; d2 = raw[offset + 1]; offset += 2
        refs_count = d1 & 0x07
        if (d1 & 0xf8) != 0:
            raise ValueError("boc_exotic_cell")
        data_length = (d2 + 1) // 2
        if offset + data_length > len(raw):
            raise ValueError("boc_cell_data_truncated")
        data = bytearray(raw[offset:offset + data_length]); offset += data_length
        bit_length = data_length * 8
        if d2 % 2 != 0:
            terminator = -1
            for bit in range(bit_length - 1, -1, -1):
                if (data[bit >> 3] >> (7 - (bit & 7))) & 1:
                    terminator = bit
                    break
            if terminator < 0:
                raise ValueError("boc_missing_terminator")
            data[terminator >> 3] &= ~(1 << (7 - (terminator & 7)))
            bit_length = terminator
            data = data[: (bit_length + 7) // 8]
        for _ref in range(refs_count):
            _, offset = _boc_read_uint(raw, offset, size_bytes, "ref_index")
        parsed.append((bytes(data), bit_length))
    if offset != cells_end:
        raise ValueError("boc_size_mismatch")
    if root_index >= len(parsed):
        raise ValueError("boc_root_index")
    return parsed[root_index]


def _read_bits(data, bit_length, cursor, count):
    if cursor + count > bit_length:
        raise ValueError("bits_truncated")
    value = 0
    for i in range(count):
        bit = cursor + i
        value = (value << 1) | ((data[bit >> 3] >> (7 - (bit & 7))) & 1)
    return value, cursor + count


def extract_external_destination(boc_b64):
    normalized = boc_b64.replace("-", "+").replace("_", "/")
    normalized += "=" * ((-len(normalized)) % 4)
    raw = base64.b64decode(normalized)
    data, bit_length = parse_boc_root_cell(raw)
    cursor = 0
    tag, cursor = _read_bits(data, bit_length, cursor, 2)
    if tag != 0b10:
        raise ValueError("not_ext_in")
    src, cursor = _read_bits(data, bit_length, cursor, 2)
    if src != 0b00:
        raise ValueError("ext_src_not_none")
    addr_tag, cursor = _read_bits(data, bit_length, cursor, 2)
    if addr_tag != 0b10:
        raise ValueError("dest_not_addr_std")
    anycast, cursor = _read_bits(data, bit_length, cursor, 1)
    if anycast != 0:
        raise ValueError("dest_anycast_unsupported")
    workchain, cursor = _read_bits(data, bit_length, cursor, 8)
    if workchain >= 128:
        workchain -= 256
    address, cursor = _read_bits(data, bit_length, cursor, 256)
    return "%d:%064x" % (workchain, address)


def validated_send_message_payload(body_bytes):
    payload = json.loads(body_bytes.decode("utf-8") if body_bytes else "{}")
    if not isinstance(payload, dict):
        raise PermissionError("MESSAGE_BODY_INVALID")
    extra_keys = set(payload) - {"boc"}
    if extra_keys:
        raise PermissionError(f"MESSAGE_BODY_NOT_ALLOWED:{sorted(extra_keys)[0]}")
    boc = str(payload.get("boc") or "").strip()
    if not boc:
        raise PermissionError("MESSAGE_BOC_MISSING")
    if len(boc) > MAX_BODY_BYTES or (MESSAGE_MAX_BOC_CHARS and len(boc) > MESSAGE_MAX_BOC_CHARS):
        raise PermissionError("MESSAGE_BOC_TOO_LARGE")
    if not BOC_BASE64_RE.fullmatch(boc):
        raise PermissionError("MESSAGE_BOC_INVALID")
    if VALIDATE_BROADCAST_STRUCTURE:
        try:
            destination = extract_external_destination(boc)
        except Exception:
            # Not a well-formed single ext-in external — every legitimate Platho send is one,
            # so this is garbage / relay-abuse. Fail closed.
            raise PermissionError("MESSAGE_BOC_NOT_EXTERNAL")
        if ALLOWED_BROADCAST_DESTINATIONS and destination not in ALLOWED_BROADCAST_DESTINATIONS:
            raise PermissionError("MESSAGE_DESTINATION_NOT_ALLOWED")
    return {"boc": boc}


def client_ip(handler):
    # The rate-limit key MUST come from a hop the attacker cannot forge. Caddy appends the
    # real peer as the LAST X-Forwarded-For token, so we take the Nth-from-last
    # (FORWARDED_FOR_TRUSTED_HOPS), never the client-supplied leftmost value.
    if FORWARDED_FOR_TRUSTED_HOPS > 0:
        parts = [item.strip() for item in handler.headers.get("X-Forwarded-For", "").split(",") if item.strip()]
        if len(parts) >= FORWARDED_FOR_TRUSTED_HOPS:
            candidate = parts[-FORWARDED_FOR_TRUSTED_HOPS]
            if candidate:
                return candidate
    return handler.client_address[0] or "unknown"


def _sweep_and_cap_buckets(now):
    # Called under _state_lock. Drop expired buckets; if still over the hard cap, evict the
    # entries closest to expiry. Keeps the dict bounded regardless of client-IP cardinality.
    expired = [key for key, bucket in rate_limit_buckets.items() if bucket["reset_at"] <= now]
    for key in expired:
        del rate_limit_buckets[key]
    overflow = len(rate_limit_buckets) - MAX_RATE_LIMIT_BUCKETS
    if overflow > 0:
        victims = sorted(rate_limit_buckets, key=lambda key: rate_limit_buckets[key]["reset_at"])[:overflow]
        for key in victims:
            del rate_limit_buckets[key]


def check_rate_limit(handler, limit, scope):
    if limit <= 0:
        return True
    key = f"{scope}|{client_ip(handler)}"
    now = int(time.time() * 1000)
    with _state_lock:
        bucket = rate_limit_buckets.get(key)
        if not bucket or bucket["reset_at"] <= now:
            if len(rate_limit_buckets) >= MAX_RATE_LIMIT_BUCKETS:
                _sweep_and_cap_buckets(now)
            rate_limit_buckets[key] = {"count": 1, "reset_at": now + 60000}
            return True
        bucket["count"] += 1
        return bucket["count"] <= limit


class PlathoRpcGatewayHandler(BaseHTTPRequestHandler):
    server_version = "PlathoRpcGateway"
    # Cap slowloris / dribbled-body connections (default None = never times out).
    timeout = HANDLER_TIMEOUT_SECONDS if HANDLER_TIMEOUT_SECONDS > 0 else None

    def log_message(self, fmt, *args):
        return

    def cors_headers(self):
        origin = self.headers.get("Origin")
        if not origin:
            return {}
        if origin not in ALLOWED_ORIGINS:
            return None
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "600",
        }

    def send_json(self, status, payload):
        headers = self.cors_headers()
        if headers is None:
            json_response(self, 403, {"ok": False, "error": "origin is not allowed"})
            return
        json_response(self, status, payload, headers)

    def read_body(self):
        # The gateway speaks HTTP/1.0 and does NOT decode chunked transfer-encoding; reject it
        # rather than silently mis-reading a 0-length body.
        if self.headers.get("Transfer-Encoding"):
            raise ValueError("TRANSFER_ENCODING_UNSUPPORTED")
        length = int(self.headers.get("Content-Length") or "0")
        if length < 0 or length > MAX_BODY_BYTES:
            raise ValueError("REQUEST_TOO_LARGE" if length > MAX_BODY_BYTES else "REQUEST_INVALID")
        return self.rfile.read(length)

    def do_OPTIONS(self):
        headers = self.cors_headers()
        if headers is None:
            json_response(self, 403, {"ok": False, "error": "origin is not allowed"})
            return
        self.send_response(204)
        for key, value in headers.items():
            self.send_header(key, value)
        self.end_headers()

    def do_GET(self):
        self.handle_route()

    def do_POST(self):
        self.handle_route()

    def handle_route(self):
        # Bound concurrent in-flight handlers; a flood gets a fast 503 instead of piling threads.
        if not request_semaphore.acquire(blocking=False):
            self.send_json(503, {"ok": False, "error": "gateway busy"})
            return
        try:
            self._handle_route()
        finally:
            request_semaphore.release()

    def _handle_route(self):
        parsed = urlparse(self.path)
        if self.command == "GET" and parsed.path == "/healthz":
            with _state_lock:
                key_disabled = int(time.time() * 1000) < toncenter_auth_state["disabled_until"]
            self.send_json(200, {"ok": True, "service": "platho-rpc-gateway", "key_disabled": key_disabled})
            return
        kind = ROUTES.get((self.command, parsed.path))
        if not kind:
            self.send_json(404, {"ok": False, "error": "route is not allowed"})
            return
        if not check_rate_limit(self, RATE_LIMIT_PER_MINUTE, "all"):
            self.send_json(429, {"ok": False, "error": "rate limit exceeded"})
            return
        if kind == "message" and not check_rate_limit(self, BROADCAST_RATE_LIMIT_PER_MINUTE, "broadcast"):
            self.send_json(429, {"ok": False, "error": "rate limit exceeded"})
            return
        try:
            if UPSTREAM_KIND not in ("ton-access-v2", "toncenter-v3"):
                self.send_json(503, {"ok": False, "error": "unsupported upstream kind"})
                return
            if not global_upstream_allowed():
                self.send_json(503, {"ok": False, "error": "gateway upstream ceiling reached"})
                return
            if kind == "run_get_method":
                body = self.read_body()
                if UPSTREAM_KIND == "toncenter-v3":
                    request = load_run_get_method_payload(body)
                    try:
                        status, upstream = fetch_toncenter_json(
                            f"{TONCENTER_V3_BASE}/runGetMethod",
                            method="POST",
                            body=request,
                        )
                    except (HTTPError, URLError, TimeoutError) as error:
                        reason = read_fallback_reason(error)
                        if not TON_ACCESS_READ_FALLBACK or reason is None:
                            raise
                        log_upstream_fallback(kind, reason)
                        fallback_request = normalize_run_get_method(body)
                        status, upstream = fetch_json(f"{ton_access_base()}/jsonRPC", method="POST", body=fallback_request)
                        upstream = normalize_run_get_method_response(upstream)
                    self.send_json(status, upstream)
                else:
                    request = normalize_run_get_method(body)
                    status, upstream = fetch_json(f"{ton_access_base()}/jsonRPC", method="POST", body=request)
                    self.send_json(status, normalize_run_get_method_response(upstream))
                return
            if kind == "message":
                if UPSTREAM_KIND != "toncenter-v3":
                    self.send_json(503, {"ok": False, "error": "message broadcast is not supported by this upstream"})
                    return
                if REQUIRE_ORIGIN_FOR_BROADCAST and not self.headers.get("Origin"):
                    self.send_json(403, {"ok": False, "error": "origin is required"})
                    return
                request = validated_send_message_payload(self.read_body())
                status, upstream, primary_error = None, None, None
                try:
                    status, upstream = fetch_toncenter_json(
                        f"{TONCENTER_V3_BASE}/message",
                        method="POST",
                        body=request,
                    )
                except (HTTPError, URLError, TimeoutError) as error:
                    primary_error = error
                    log_upstream_error(kind, error, http_error_detail(error) if isinstance(error, HTTPError) else "")
                # toncenter v3 can ACK a broadcast without it reaching the network; submit the
                # same idempotent external through the Orbs v2 /sendBoc path too so delivery is
                # provider-independent. Best-effort: failure here never masks a primary success.
                if BROADCAST_REDUNDANT_FALLBACK:
                    try:
                        fb_status, fb_upstream = fetch_json(
                            f"{ton_access_base()}/sendBoc",
                            method="POST",
                            body={"boc": request["boc"]},
                        )
                        log_upstream_fallback("message", "redundant" if primary_error is None else f"primary_{read_fallback_reason(primary_error) or 'error'}")
                        if status is None:
                            status, upstream = fb_status, fb_upstream
                    except (HTTPError, URLError, TimeoutError, RuntimeError) as fb_error:
                        detail = http_error_detail(fb_error) if isinstance(fb_error, HTTPError) else str(fb_error)
                        log_upstream_error("message_fallback", fb_error, detail)
                if status is None:
                    # Neither leg cleanly ACKed. Distinguish a DEFINITIVE rejection
                    # from UNKNOWN delivery. A toncenter 4xx (other than 429) means
                    # the external itself is bad (invalid BOC / underfunded / bad
                    # request) — propagate it so the client fails fast. Anything else
                    # (toncenter 5xx, timeout, URL error, or 429) leaves delivery
                    # UNKNOWN: toncenter may have applied the idempotent external
                    # before erroring, and the redundant Orbs leg did not confirm.
                    # Returning a bare 500 here is the documented "false 500" that
                    # makes the PWA treat a possibly-delivered message as failed.
                    # The external is idempotent (fixed seqno), so report 202
                    # "unconfirmed" and let the client confirm via a nonce read /
                    # idempotent re-broadcast instead of surfacing a hard error.
                    primary_status = primary_error.code if isinstance(primary_error, HTTPError) else None
                    if primary_status is not None and 400 <= primary_status < 500 and primary_status != 429:
                        raise primary_error
                    detail = http_error_detail(primary_error) if isinstance(primary_error, HTTPError) else str(primary_error)
                    payload = {"ok": True, "delivery": "unconfirmed"}
                    if primary_status is not None:
                        payload["upstream_status"] = primary_status
                    if detail and EXPOSE_UPSTREAM_ERRORS:
                        payload["upstream_error"] = detail
                    self.send_json(202, payload)
                    return
                self.send_json(status, upstream)
                return
            if kind == "messages":
                if UPSTREAM_KIND != "toncenter-v3":
                    self.send_json(503, {"ok": False, "error": "message history is not supported by this upstream"})
                    return
                target = validated_messages_query(self.path)
                status, upstream = fetch_toncenter_json(target)
                self.send_json(status, upstream)
                return
            if kind == "account":
                if UPSTREAM_KIND == "toncenter-v3":
                    target = validated_account_target(self.path, f"{TONCENTER_V2_BASE}/getAddressInformation")
                    try:
                        status, upstream = fetch_toncenter_json(target)
                    except (HTTPError, URLError, TimeoutError) as error:
                        reason = read_fallback_reason(error)
                        if not TON_ACCESS_READ_FALLBACK or reason is None:
                            raise
                        log_upstream_fallback(kind, reason)
                        fallback_target = validated_account_target(self.path, f"{ton_access_base()}/getAddressInformation")
                        status, upstream = fetch_json(fallback_target)
                else:
                    target = validated_account_target(self.path, f"{ton_access_base()}/getAddressInformation")
                    status, upstream = fetch_json(target)
                self.send_json(status, upstream)
                return
            self.send_json(503, {"ok": False, "error": f"{kind} is not supported"})
        except ValueError as error:
            status = 413 if str(error) == "REQUEST_TOO_LARGE" else 400
            self.send_json(status, {"ok": False, "error": str(error)})
        except PermissionError as error:
            self.send_json(403, {"ok": False, "error": str(error)})
        except HTTPError as error:
            detail = http_error_detail(error)
            log_upstream_error(kind, error, detail)
            payload = {"ok": False, "error": "upstream request failed", "upstream_status": error.code}
            if detail and EXPOSE_UPSTREAM_ERRORS:
                payload["upstream_error"] = detail
            self.send_json(error.code, payload)
        except (URLError, TimeoutError) as error:
            self.send_json(504, {"ok": False, "error": "upstream timeout"})
        except Exception:
            self.send_json(502, {"ok": False, "error": "upstream request failed"})


def main():
    server = ThreadingHTTPServer((HOST, PORT), PlathoRpcGatewayHandler)
    server.daemon_threads = True
    log_security("startup", f"origins={sorted(ALLOWED_ORIGINS)} upstream={UPSTREAM_KIND}")
    print(f"platho-rpc-gateway listening on http://{HOST}:{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
