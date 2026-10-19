"""Vercel Python function: POST assumptions JSON, get dcf.py results back.

Serves /api/dcf on Vercel. Local dev runs python/runner.py via the Next route
instead (see src/server/dcf.ts), so both paths share the same code.
"""
import json, os, sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "python"))
import runner  # noqa: E402


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("content-length") or 0)
        if length > 200_000:
            return self._send(413, {"ok": False, "error": "assumptions too large"})
        try:
            cfg = json.loads(self.rfile.read(length) or b"{}")
            if isinstance(cfg.get("montecarlo"), dict):
                cfg["montecarlo"]["n"] = min(int(cfg["montecarlo"].get("n", 2000)), 5000)
            self._send(200, {"ok": True, "result": runner.value(cfg)})
        except (ValueError, KeyError, TypeError, ZeroDivisionError) as e:
            self._send(400, {"ok": False, "error": str(e)})

    def _send(self, status, body):
        data = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(data)
