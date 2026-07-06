#!/usr/bin/env python3
"""
Servidor local para Alumital SAS App
- Sirve archivos estáticos en /
- Proxea /proxy/siigo/* → https://api.siigo.com/*
  (evita el bloqueo CORS del navegador)
"""
import http.server
import urllib.request
import urllib.error
import json
import os
import sys

PORT = int(os.environ.get("PORT", 8001))
SIIGO_BASE = "https://api.siigo.com"
PROXY_PREFIX = "/proxy/siigo"

class AlumitalHandler(http.server.SimpleHTTPRequestHandler):

    def log_message(self, format, *args):
        print(f"[Alumital] {self.address_string()} - {format % args}")

    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, Partner-Id")

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path.startswith(PROXY_PREFIX):
            self._proxy_request("GET")
        else:
            super().do_GET()

    def do_POST(self):
        if self.path.startswith(PROXY_PREFIX):
            self._proxy_request("POST")
        else:
            self.send_error(405, "Method Not Allowed")

    def _proxy_request(self, method):
        # Construir URL destino
        siigo_path = self.path[len(PROXY_PREFIX):]  # quitar /proxy/siigo
        target_url = SIIGO_BASE + siigo_path
        print(f"[Proxy] {method} {target_url}")

        # Leer cuerpo si existe
        body = None
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length > 0:
            body = self.rfile.read(content_length)

        # Construir cabeceras para Siigo
        forward_headers = {}
        for key in ["Content-Type", "Authorization", "Partner-Id"]:
            val = self.headers.get(key)
            if val:
                forward_headers[key] = val

        try:
            req = urllib.request.Request(
                target_url,
                data=body,
                headers=forward_headers,
                method=method
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                resp_body = resp.read()
                self.send_response(resp.status)
                self._send_cors_headers()
                ct = resp.headers.get("Content-Type", "application/json")
                self.send_header("Content-Type", ct)
                self.send_header("Content-Length", str(len(resp_body)))
                self.end_headers()
                self.wfile.write(resp_body)

        except urllib.error.HTTPError as e:
            resp_body = e.read()
            self.send_response(e.code)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp_body)))
            self.end_headers()
            self.wfile.write(resp_body)

        except Exception as e:
            err = json.dumps({"error": str(e)}).encode()
            self.send_response(502)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(err)))
            self.end_headers()
            self.wfile.write(err)


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print(f"✅ Alumital SAS Server corriendo en http://localhost:{PORT}")
    print(f"   Archivos estáticos: /")
    print(f"   Proxy Siigo API:    /proxy/siigo/* → {SIIGO_BASE}/*")
    httpd = http.server.HTTPServer(("", PORT), AlumitalHandler)
    httpd.serve_forever()
