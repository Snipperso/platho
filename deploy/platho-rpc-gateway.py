#!/usr/bin/env python3
import json
import os
import random
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
    "get_avatar",
    "get_avatar_version",
    "get_canonical_publish_charge",
    "get_global",
    "get_jetton_data",
    "get_key_record",
    "get_name_record",
    "get_private_entry",
    "get_private_page",
    "get_public_entry",
    "get_public_page",
    "get_state",
    "get_user",
    "get_username_item_address",
    "get_username_price",
    "get_wallet_address",
    "get_wallet_data",
]

ROUTES = {
    ("POST", "/api/v3/runGetMethod"): "run_get_method",
    ("GET", "/api/v2/getAddressInformation"): "account",
}


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
MAX_BODY_BYTES = int(os.getenv("PLATHO_RPC_MAX_BODY_BYTES", "262144"))
UPSTREAM_TIMEOUT_SECONDS = float(os.getenv("PLATHO_RPC_UPSTREAM_TIMEOUT_MS", "15000")) / 1000.0
RATE_LIMIT_PER_MINUTE = int(os.getenv("PLATHO_RPC_RATE_LIMIT_PER_MINUTE", "240"))
ALLOWED_ORIGINS = set(split_list(os.getenv("PLATHO_RPC_ALLOWED_ORIGINS"), DEFAULT_ALLOWED_ORIGINS))
ALLOWED_GET_METHODS = set(split_list(os.getenv("PLATHO_RPC_ALLOWED_GET_METHODS"), DEFAULT_ALLOWED_GET_METHODS))

ton_access_nodes_cache = {"expires_at": 0, "nodes": []}
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


def fetch_json(url, method="GET", body=None):
    headers = {"Accept": "application/json"}
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


def weighted_node(nodes):
    total = sum(max(1, int(node.get("Weight") or 1)) for node in nodes)
    roll = random.randrange(max(1, total))
    for node in nodes:
        roll -= max(1, int(node.get("Weight") or 1))
        if roll < 0:
            return node
    return nodes[0]


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


def normalize_run_get_method(body_bytes):
    payload = json.loads(body_bytes.decode("utf-8") if body_bytes else "{}")
    method = str(payload.get("method") or "")
    if method not in ALLOWED_GET_METHODS:
        raise PermissionError(f"GET_METHOD_NOT_ALLOWED:{method or 'missing'}")
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
            if UPSTREAM_KIND != "ton-access-v2":
                self.send_json(503, {"ok": False, "error": "unsupported upstream kind"})
                return
            if kind == "run_get_method":
                body = self.read_body()
                request = normalize_run_get_method(body)
                status, upstream = fetch_json(f"{ton_access_base()}/jsonRPC", method="POST", body=request)
                self.send_json(status, normalize_run_get_method_response(upstream))
                return
            if kind == "account":
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
            self.send_json(error.code, {"ok": False, "error": "upstream request failed"})
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
