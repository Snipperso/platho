#!/usr/bin/env python3
import json
import os
import random
import re
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse
from urllib.request import Request, urlopen

DEFAULT_ALLOWED_ORIGINS = [
    "https://platho.app",
    "https://www.platho.app",
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

BOC_BASE64_RE = re.compile(r"^[A-Za-z0-9+/=_-]+$")


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
MAX_BODY_BYTES = int(os.getenv("PLATHO_RPC_MAX_BODY_BYTES", "262144"))
UPSTREAM_TIMEOUT_SECONDS = float(os.getenv("PLATHO_RPC_UPSTREAM_TIMEOUT_MS", "15000")) / 1000.0
UPSTREAM_USER_AGENT = os.getenv("PLATHO_RPC_UPSTREAM_USER_AGENT", "PlathoRpcGateway/1.0 (+https://platho.app)").strip()
RATE_LIMIT_PER_MINUTE = int(os.getenv("PLATHO_RPC_RATE_LIMIT_PER_MINUTE", "240"))
MESSAGE_MAX_OFFSET = int(os.getenv("PLATHO_RPC_MESSAGES_MAX_OFFSET", "8000"))
ALLOWED_ORIGINS = set(split_list(os.getenv("PLATHO_RPC_ALLOWED_ORIGINS"), DEFAULT_ALLOWED_ORIGINS))
ALLOWED_GET_METHODS = set(split_list(os.getenv("PLATHO_RPC_ALLOWED_GET_METHODS"), DEFAULT_ALLOWED_GET_METHODS))
ALLOWED_MESSAGE_DESTINATIONS = set(split_list(os.getenv("PLATHO_RPC_ALLOWED_MESSAGE_DESTINATIONS"), []))
ALLOWED_MESSAGE_SOURCES = set(split_list(os.getenv("PLATHO_RPC_ALLOWED_MESSAGE_SOURCES"), []))
ALLOWED_MESSAGE_OPCODES = {
    item.lower()
    for item in split_list(os.getenv("PLATHO_RPC_ALLOWED_MESSAGE_OPCODES"), DEFAULT_ALLOWED_MESSAGE_OPCODES)
}

ton_access_nodes_cache = {"expires_at": 0, "nodes": []}
toncenter_api_key_cache = {"path": None, "mtime": None, "value": None}
toncenter_auth_state = {"disabled_until": 0}
rate_limit_buckets = {}


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


def weighted_node(nodes):
    total = sum(max(1, int(node.get("Weight") or 1)) for node in nodes)
    roll = random.randrange(max(1, total))
    for node in nodes:
        roll -= max(1, int(node.get("Weight") or 1))
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
        if (
            toncenter_api_key_cache["path"] == TONCENTER_API_KEY_FILE
            and toncenter_api_key_cache["mtime"] == stat.st_mtime
            and toncenter_api_key_cache["value"] is not None
        ):
            return toncenter_api_key_cache["value"]
        with open(TONCENTER_API_KEY_FILE, "r", encoding="utf-8") as handle:
            value = handle.read().strip()
        toncenter_api_key_cache.update({"path": TONCENTER_API_KEY_FILE, "mtime": stat.st_mtime, "value": value})
        return value
    except OSError:
        return ""


def toncenter_headers():
    api_key = toncenter_api_key()
    if int(time.time() * 1000) < toncenter_auth_state["disabled_until"]:
        return {}
    return {"X-API-Key": api_key} if api_key else {}


def fetch_toncenter_json(url, method="GET", body=None):
    headers = toncenter_headers()
    if not headers:
        return fetch_json(url, method=method, body=body)
    try:
        return fetch_json(url, method=method, body=body, extra_headers=headers)
    except HTTPError as error:
        if error.code not in (401, 403):
            raise
        toncenter_auth_state["disabled_until"] = int(time.time() * 1000) + TONCENTER_AUTH_RETRY_MS
        return fetch_json(url, method=method, body=body)


def ton_access_base():
    now = int(time.time() * 1000)
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
        if str(node.get("Healthy")) == "1" and node.get("Mngr", {}).get("health", {}).get(health_key) is True
    ]
    if not healthy:
        raise RuntimeError("TON_ACCESS_NO_HEALTHY_V2_NODE")
    ton_access_nodes_cache["expires_at"] = now + TON_ACCESS_NODE_TTL_MS
    ton_access_nodes_cache["nodes"] = healthy
    node = weighted_node(healthy)
    return f"https://{TON_ACCESS_HOST}/{node['NodeId']}/1/{TON_ACCESS_NETWORK}/toncenter-api-v2"


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


def append_original_query(endpoint, path):
    upstream = urlparse(endpoint)
    incoming = urlparse(path)
    return urlunparse((upstream.scheme, upstream.netloc, upstream.path, "", incoming.query, ""))


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
    if len(boc) > MAX_BODY_BYTES:
        raise PermissionError("MESSAGE_BOC_TOO_LARGE")
    if not BOC_BASE64_RE.fullmatch(boc):
        raise PermissionError("MESSAGE_BOC_INVALID")
    return {"boc": boc}


def client_ip(handler):
    forwarded = handler.headers.get("X-Forwarded-For", "").split(",")[0].strip()
    return forwarded or handler.client_address[0] or "unknown"


def check_rate_limit(handler):
    if RATE_LIMIT_PER_MINUTE <= 0:
        return True
    key = client_ip(handler)
    now = int(time.time() * 1000)
    bucket = rate_limit_buckets.get(key)
    if not bucket or bucket["reset_at"] <= now:
        rate_limit_buckets[key] = {"count": 1, "reset_at": now + 60000}
        return True
    bucket["count"] += 1
    return bucket["count"] <= RATE_LIMIT_PER_MINUTE


class PlathoRpcGatewayHandler(BaseHTTPRequestHandler):
    server_version = "PlathoRpcGateway"

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
        length = int(self.headers.get("Content-Length") or "0")
        if length > MAX_BODY_BYTES:
            raise ValueError("REQUEST_TOO_LARGE")
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
        parsed = urlparse(self.path)
        if self.command == "GET" and parsed.path == "/healthz":
            self.send_json(200, {"ok": True, "service": "platho-rpc-gateway"})
            return
        if not check_rate_limit(self):
            self.send_json(429, {"ok": False, "error": "rate limit exceeded"})
            return
        kind = ROUTES.get((self.command, parsed.path))
        if not kind:
            self.send_json(404, {"ok": False, "error": "route is not allowed"})
            return
        try:
            if UPSTREAM_KIND not in ("ton-access-v2", "toncenter-v3"):
                self.send_json(503, {"ok": False, "error": "unsupported upstream kind"})
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
                    raise primary_error
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
                    target = append_original_query(f"{TONCENTER_V2_BASE}/getAddressInformation", self.path)
                    try:
                        status, upstream = fetch_toncenter_json(target)
                    except (HTTPError, URLError, TimeoutError) as error:
                        reason = read_fallback_reason(error)
                        if not TON_ACCESS_READ_FALLBACK or reason is None:
                            raise
                        log_upstream_fallback(kind, reason)
                        fallback_target = append_original_query(f"{ton_access_base()}/getAddressInformation", self.path)
                        status, upstream = fetch_json(fallback_target)
                else:
                    target = append_original_query(f"{ton_access_base()}/getAddressInformation", self.path)
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
            if detail:
                payload["upstream_error"] = detail
            self.send_json(error.code, payload)
        except (URLError, TimeoutError) as error:
            self.send_json(504, {"ok": False, "error": "upstream timeout"})
        except Exception:
            self.send_json(502, {"ok": False, "error": "upstream request failed"})


def main():
    server = ThreadingHTTPServer((HOST, PORT), PlathoRpcGatewayHandler)
    print(f"platho-rpc-gateway listening on http://{HOST}:{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
