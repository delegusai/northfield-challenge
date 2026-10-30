"""Loopback-only browser lab, using Python's standard library."""

import argparse
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import secrets
import threading
import time

from northfield import Session
from proposer import Proposer, ProposerError, load_settings


WEB = Path(__file__).parent / "web"


class LabServer(ThreadingHTTPServer):
    def __init__(self, port, proposer=None, report_file=None):
        super().__init__(("127.0.0.1", port), Handler)
        self.sessions = {}
        self.session_lock = threading.Lock()
        self.proposer = proposer or Proposer()
        self.report_file = Path(report_file) if report_file else Path(__file__).parent / "reports/live-evaluation.json"


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass  # Commands and supporting text stay out of server logs.

    def _send(self, status, body, content_type="application/json", cookie=None):
        if content_type == "application/json":
            body = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
        if cookie:
            self.send_header("Set-Cookie", "northfield=" + cookie + "; HttpOnly; SameSite=Strict; Path=/")
        self.end_headers()
        self.wfile.write(body)

    def _valid_host(self):
        return self.headers.get("Host") == "127.0.0.1:" + str(self.server.server_port)

    def _session(self, reset=False):
        cookies = SimpleCookie()
        try:
            cookies.load(self.headers.get("Cookie", ""))
        except Exception:
            pass
        key = cookies["northfield"].value if "northfield" in cookies else None
        with self.server.session_lock:
            now = time.time()
            for token, session in list(self.server.sessions.items()):
                if now - session.created_at > 3600:
                    del self.server.sessions[token]
            if not reset and key in self.server.sessions:
                return self.server.sessions[key], None
            if reset and key in self.server.sessions:
                del self.server.sessions[key]
            if len(self.server.sessions) >= 128:
                raise ValueError("Local session capacity reached. Restart the lab to clear sessions.")
            token = secrets.token_urlsafe(32)
            session = Session()
            self.server.sessions[token] = session
            return session, token

    def do_GET(self):
        if not self._valid_host():
            return self._send(403, {"error": "Use the printed local URL."})
        if self.path == "/api/evaluation":
            path = self.server.report_file
            if not path.exists():
                return self._send(200, {"available":False,"message":"No evaluation report yet. Run the local evaluation to collect results."})
            try:
                if path.is_symlink() or path.stat().st_size > 5_000_000:
                    raise ValueError("Invalid report file")
                report = json.loads(path.read_text())
                if not isinstance(report,dict) or report.get("version") != 2:
                    return self._send(200, {"available":False,"message":"This report uses an older format. Run the expanded evaluation to collect results."})
                return self._send(200, {"available":True,"report":report})
            except (OSError, ValueError):
                return self._send(500, {"error":"The local evaluation report could not be read."})
        if self.path == "/api/config":
            return self._send(200, self.server.proposer.status())
        if self.path == "/api/session":
            try:
                session, cookie = self._session()
                return self._send(200, session.snapshot(), cookie=cookie)
            except ValueError as error:
                return self._send(429, {"error": str(error)})
        files = {"/": ("index.html", "text/html; charset=utf-8"), "/app.js": ("app.js", "text/javascript; charset=utf-8"), "/style.css": ("style.css", "text/css; charset=utf-8")}
        for name, mime in (("results.html", "text/html; charset=utf-8"), ("results.js", "text/javascript; charset=utf-8"), ("results.css", "text/css; charset=utf-8")):
            files["/results" if name == "results.html" else "/" + name] = (name, mime)
        # Exact asset map preserves the server's closed static-file boundary.
        files["/assets/fonts.css"] = ("assets/fonts.css", "text/css; charset=utf-8")
        files["/assets/delegus-mark.svg"] = ("assets/delegus-mark.svg", "image/svg+xml")
        for font in ("schibsted-grotesk-600", "schibsted-grotesk-700", "public-sans-400", "public-sans-600", "martian-mono-400", "delegus-wordmark"):
            asset = "assets/fonts/" + font + ".woff2"
            files["/" + asset] = (asset, "font/woff2")
        if self.path not in files:
            return self._send(404, {"error": "Not found."})
        name, mime = files[self.path]
        self._send(200, (WEB / name).read_bytes(), mime)

    def do_POST(self):
        origin = "http://127.0.0.1:" + str(self.server.server_port)
        if not self._valid_host() or self.headers.get("Origin") != origin:
            return self._send(403, {"error": "Only requests from this local lab are accepted."})
        if self.path not in ("/api/propose", "/api/interpret", "/api/revoke", "/api/reset"):
            return self._send(404, {"error": "Not found."})
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size <= 0 or size > 16384 or self.headers.get("Content-Type") != "application/json":
                raise ValueError("Send a JSON object smaller than 16 KB.")
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict):
                raise ValueError("Send a JSON object.")
            expected = {"request", "note"} if self.path == "/api/interpret" else {"command", "note"} if self.path == "/api/propose" else set()
            if set(data) - expected:
                raise ValueError("Unknown fields are refused. Authority cannot be supplied in a request.")
            session, cookie = self._session(reset=self.path == "/api/reset")
            if self.path == "/api/interpret":
                request, note = data.get("request"), data.get("note", "")
                proposal = self.server.proposer.propose(request, note, "ai-" + secrets.token_hex(12))
                result = {"proposal":proposal,"state":session.record_interpretation(request,note,proposal)}
            elif self.path == "/api/propose":
                result = session.submit(data.get("command"), data.get("note", ""))
            elif self.path == "/api/revoke":
                result = session.revoke()
            else:
                result = session.snapshot()
            self._send(200, result, cookie=cookie)
        except (ValueError, UnicodeError) as error:
            self._send(400, {"error": str(error)})
        except ProposerError as error:
            self._send(502, {"error":str(error)})


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Start the local Northfield simulation.")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    key, model = load_settings(Path(__file__).parent)
    server = LabServer(args.port, Proposer(key,model))
    print("Northfield simulation: http://127.0.0.1:%s" % server.server_port, flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
