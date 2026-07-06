#!/usr/bin/env python3
"""
Servidor backend para Alumital SAS — Carpintería en Aluminio
=============================================================
Funcionalidades:
  • Archivos estáticos en /
  • Proxy Siigo API en /proxy/siigo/*
  • API REST completa:
      - Autenticación (login / session / logout)
      - Clientes CRUD
      - Cotizaciones CRUD
      - Órdenes de producción

Dependencias: NINGUNA externa — solo stdlib de Python 3.
Base de datos: SQLite (alumital.db junto a este archivo).
Sesiones: en memoria (dict).
"""

import http.server
import urllib.request
import urllib.error
import urllib.parse
import json
import os
import sys
import sqlite3
import hashlib
import uuid
import re
from datetime import datetime

# ─────────────────────────────────────────────
# Configuración
# ─────────────────────────────────────────────
PORT = int(os.environ.get("PORT", 8001))
SIIGO_BASE = "https://api.siigo.com"
PROXY_PREFIX = "/proxy/siigo"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "alumital.db")

# Sesiones activas: {token: usuario_dict}
SESSIONS: dict[str, dict] = {}


# ─────────────────────────────────────────────
# Base de datos — inicialización
# ─────────────────────────────────────────────
def get_db() -> sqlite3.Connection:
    """Abre una conexión a la BD con row_factory = sqlite3.Row."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Crea las tablas si no existen y siembra el usuario admin."""
    conn = get_db()
    cur = conn.cursor()

    cur.executescript("""
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            rol TEXT DEFAULT 'operario',
            fecha_creacion TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS clientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            nit TEXT,
            telefono TEXT,
            email TEXT,
            direccion TEXT,
            fecha_creacion TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS cotizaciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id INTEGER,
            usuario_id INTEGER,
            items_json TEXT,
            precios_json TEXT,
            total REAL DEFAULT 0,
            estado TEXT DEFAULT 'borrador',
            notas TEXT,
            fecha TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (cliente_id) REFERENCES clientes(id),
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        );

        CREATE TABLE IF NOT EXISTS ordenes_produccion (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cotizacion_id INTEGER,
            estado TEXT DEFAULT 'pendiente',
            notas TEXT,
            fecha TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (cotizacion_id) REFERENCES cotizaciones(id)
        );
    """)

    # Sembrar usuario administrador si la tabla está vacía
    count = cur.execute("SELECT COUNT(*) FROM usuarios").fetchone()[0]
    if count == 0:
        pwd_hash = hashlib.sha256("alumital2026".encode()).hexdigest()
        cur.execute(
            "INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)",
            ("Administrador", "admin", pwd_hash, "admin"),
        )
        print("[DB] ✅ Usuario admin creado (email: admin / clave: alumital2026)")

    conn.commit()
    conn.close()
    print(f"[DB] ✅ Base de datos inicializada en {DB_PATH}")


# ─────────────────────────────────────────────
# Utilidades
# ─────────────────────────────────────────────
def row_to_dict(row):
    """Convierte una sqlite3.Row a dict plano."""
    if row is None:
        return None
    return dict(row)


def rows_to_list(rows: list) -> list[dict]:
    """Convierte una lista de sqlite3.Row a lista de dicts."""
    return [dict(r) for r in rows]


def hash_password(password: str) -> str:
    """Hash SHA-256 de la contraseña."""
    return hashlib.sha256(password.encode()).hexdigest()


# ─────────────────────────────────────────────
# Handler principal
# ─────────────────────────────────────────────
class AlumitalHandler(http.server.SimpleHTTPRequestHandler):
    """
    Maneja tres tipos de peticiones:
      1. /proxy/siigo/*   → Proxy inverso a Siigo API
      2. /api/*           → API REST (JSON)
      3. Cualquier otra   → Archivos estáticos
    """

    # ── Logging ──────────────────────────────
    def log_message(self, fmt, *args):
        print(f"[Alumital] {self.address_string()} - {fmt % args}")

    # ── CORS ─────────────────────────────────
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, Partner-Id")

    # ── Respuestas JSON ──────────────────────
    def _json_response(self, data, status=200):
        """Envía una respuesta JSON con headers CORS."""
        body = json.dumps(data, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _error_response(self, status, message):
        """Envía un error JSON."""
        self._json_response({"error": message}, status)

    # ── Leer cuerpo JSON ─────────────────────
    def _read_json_body(self):
        """Lee y parsea el body JSON de la petición."""
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            return {}
        raw = self.rfile.read(content_length)
        try:
            return json.loads(raw.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return None

    # ── Autenticación ────────────────────────
    def _get_current_user(self):
        """Extrae el token del header Authorization y devuelve el usuario o None."""
        auth = self.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return None
        token = auth[7:].strip()
        return SESSIONS.get(token)

    def _require_auth(self):
        """Verifica auth; si falla, envía 401 y devuelve None."""
        user = self._get_current_user()
        if user is None:
            self._error_response(401, "No autorizado. Inicie sesión.")
            return None
        return user

    # ── Parseo de ruta ───────────────────────
    def _parse_path(self) -> tuple[str, dict]:
        """Separa la ruta del query string."""
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)
        # Aplanar valores del query string (tomar primer valor)
        params = {k: v[0] for k, v in qs.items()}
        return parsed.path, params

    # ══════════════════════════════════════════
    # Métodos HTTP
    # ══════════════════════════════════════════

    def do_OPTIONS(self):
        """Preflight CORS para cualquier ruta."""
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        path, params = self._parse_path()
        if path.startswith(PROXY_PREFIX):
            self._proxy_request("GET")
        elif path.startswith("/api/"):
            self._route_api("GET", path, params)
        else:
            super().do_GET()

    def do_POST(self):
        path, params = self._parse_path()
        if path.startswith(PROXY_PREFIX):
            self._proxy_request("POST")
        elif path.startswith("/api/"):
            self._route_api("POST", path, params)
        else:
            self.send_error(405, "Method Not Allowed")

    def do_PUT(self):
        path, params = self._parse_path()
        if path.startswith("/api/"):
            self._route_api("PUT", path, params)
        else:
            self.send_error(405, "Method Not Allowed")

    def do_DELETE(self):
        path, params = self._parse_path()
        if path.startswith("/api/"):
            self._route_api("DELETE", path, params)
        else:
            self.send_error(405, "Method Not Allowed")

    # ══════════════════════════════════════════
    # Router API
    # ══════════════════════════════════════════

    def _route_api(self, method: str, path: str, params: dict):
        """Enruta las peticiones /api/* al handler correcto."""

        # ── Autenticación ────────────────────
        if path == "/api/login" and method == "POST":
            return self._handle_login()
        if path == "/api/session" and method == "GET":
            return self._handle_session()
        if path == "/api/logout" and method == "POST":
            return self._handle_logout()

        # ── Clientes ─────────────────────────
        match_cliente = re.match(r"^/api/clientes/(\d+)$", path)
        if path == "/api/clientes":
            if method == "GET":
                return self._handle_clientes_list(params)
            if method == "POST":
                return self._handle_clientes_create()
        if match_cliente:
            cid = int(match_cliente.group(1))
            if method == "GET":
                return self._handle_clientes_get(cid)
            if method == "PUT":
                return self._handle_clientes_update(cid)
            if method == "DELETE":
                return self._handle_clientes_delete(cid)

        # ── Cotizaciones ─────────────────────
        match_cot = re.match(r"^/api/cotizaciones/(\d+)$", path)
        if path == "/api/cotizaciones":
            if method == "GET":
                return self._handle_cotizaciones_list(params)
            if method == "POST":
                return self._handle_cotizaciones_create()
        if match_cot:
            cid = int(match_cot.group(1))
            if method == "GET":
                return self._handle_cotizaciones_get(cid)
            if method == "PUT":
                return self._handle_cotizaciones_update(cid)
            if method == "DELETE":
                return self._handle_cotizaciones_delete(cid)

        # ── Órdenes de producción ────────────
        match_orden = re.match(r"^/api/ordenes/(\d+)$", path)
        if path == "/api/ordenes":
            if method == "GET":
                return self._handle_ordenes_list(params)
            if method == "POST":
                return self._handle_ordenes_create()
        if match_orden:
            oid = int(match_orden.group(1))
            if method == "PUT":
                return self._handle_ordenes_update(oid)

        # ── Ruta no encontrada ───────────────
        self._error_response(404, f"Endpoint no encontrado: {method} {path}")

    # ══════════════════════════════════════════
    # AUTH handlers
    # ══════════════════════════════════════════

    def _handle_login(self):
        """POST /api/login — Autentica usuario y devuelve token."""
        body = self._read_json_body()
        if body is None:
            return self._error_response(400, "JSON inválido")

        email = body.get("email", "").strip()
        password = body.get("password", "")

        if not email or not password:
            return self._error_response(400, "Email y contraseña requeridos")

        pwd_hash = hash_password(password)

        conn = get_db()
        row = conn.execute(
            "SELECT * FROM usuarios WHERE email = ? AND password_hash = ?",
            (email, pwd_hash),
        ).fetchone()
        conn.close()

        if row is None:
            return self._error_response(401, "Credenciales inválidas")

        # Crear sesión
        usuario = row_to_dict(row)
        del usuario["password_hash"]  # No exponer el hash
        token = uuid.uuid4().hex
        SESSIONS[token] = usuario

        self._json_response({"token": token, "usuario": usuario})

    def _handle_session(self):
        """GET /api/session — Devuelve el usuario de la sesión actual."""
        user = self._require_auth()
        if user is None:
            return
        self._json_response({"usuario": user})

    def _handle_logout(self):
        """POST /api/logout — Invalida el token."""
        auth = self.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:].strip()
            SESSIONS.pop(token, None)
        self._json_response({"ok": True})

    # ══════════════════════════════════════════
    # CLIENTES handlers
    # ══════════════════════════════════════════

    def _handle_clientes_list(self, params):
        """GET /api/clientes?q=texto — Lista clientes con búsqueda opcional."""
        user = self._require_auth()
        if user is None:
            return

        conn = get_db()
        q = params.get("q", "").strip()
        if q:
            like = f"%{q}%"
            rows = conn.execute(
                "SELECT * FROM clientes WHERE nombre LIKE ? OR nit LIKE ? OR email LIKE ? ORDER BY nombre",
                (like, like, like),
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM clientes ORDER BY nombre").fetchall()
        conn.close()

        self._json_response(rows_to_list(rows))

    def _handle_clientes_create(self):
        """POST /api/clientes — Crea un nuevo cliente."""
        user = self._require_auth()
        if user is None:
            return

        body = self._read_json_body()
        if body is None:
            return self._error_response(400, "JSON inválido")

        nombre = body.get("nombre", "").strip()
        if not nombre:
            return self._error_response(400, "El nombre es obligatorio")

        conn = get_db()
        cur = conn.execute(
            "INSERT INTO clientes (nombre, nit, telefono, email, direccion) VALUES (?, ?, ?, ?, ?)",
            (nombre, body.get("nit"), body.get("telefono"), body.get("email"), body.get("direccion")),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM clientes WHERE id = ?", (cur.lastrowid,)).fetchone()
        conn.close()

        self._json_response(row_to_dict(row), 201)

    def _handle_clientes_get(self, cid):
        """GET /api/clientes/<id> — Devuelve un cliente."""
        user = self._require_auth()
        if user is None:
            return

        conn = get_db()
        row = conn.execute("SELECT * FROM clientes WHERE id = ?", (cid,)).fetchone()
        conn.close()

        if row is None:
            return self._error_response(404, "Cliente no encontrado")
        self._json_response(row_to_dict(row))

    def _handle_clientes_update(self, cid):
        """PUT /api/clientes/<id> — Actualiza un cliente."""
        user = self._require_auth()
        if user is None:
            return

        body = self._read_json_body()
        if body is None:
            return self._error_response(400, "JSON inválido")

        conn = get_db()
        existing = conn.execute("SELECT * FROM clientes WHERE id = ?", (cid,)).fetchone()
        if existing is None:
            conn.close()
            return self._error_response(404, "Cliente no encontrado")

        # Actualizar solo campos proporcionados (merge con existentes)
        nombre = body.get("nombre", existing["nombre"])
        nit = body.get("nit", existing["nit"])
        telefono = body.get("telefono", existing["telefono"])
        email = body.get("email", existing["email"])
        direccion = body.get("direccion", existing["direccion"])

        conn.execute(
            "UPDATE clientes SET nombre=?, nit=?, telefono=?, email=?, direccion=? WHERE id=?",
            (nombre, nit, telefono, email, direccion, cid),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM clientes WHERE id = ?", (cid,)).fetchone()
        conn.close()

        self._json_response(row_to_dict(row))

    def _handle_clientes_delete(self, cid):
        """DELETE /api/clientes/<id> — Elimina un cliente."""
        user = self._require_auth()
        if user is None:
            return

        conn = get_db()
        existing = conn.execute("SELECT * FROM clientes WHERE id = ?", (cid,)).fetchone()
        if existing is None:
            conn.close()
            return self._error_response(404, "Cliente no encontrado")

        conn.execute("DELETE FROM clientes WHERE id = ?", (cid,))
        conn.commit()
        conn.close()

        self._json_response({"ok": True, "message": f"Cliente {cid} eliminado"})

    # ══════════════════════════════════════════
    # COTIZACIONES handlers
    # ══════════════════════════════════════════

    def _handle_cotizaciones_list(self, params):
        """GET /api/cotizaciones?cliente_id=X&estado=X — Lista cotizaciones."""
        user = self._require_auth()
        if user is None:
            return

        conn = get_db()
        query = "SELECT * FROM cotizaciones WHERE 1=1"
        binds: list = []

        if "cliente_id" in params:
            query += " AND cliente_id = ?"
            binds.append(int(params["cliente_id"]))
        if "estado" in params:
            query += " AND estado = ?"
            binds.append(params["estado"])

        query += " ORDER BY fecha DESC"
        rows = conn.execute(query, binds).fetchall()
        conn.close()

        self._json_response(rows_to_list(rows))

    def _handle_cotizaciones_create(self):
        """POST /api/cotizaciones — Crea una cotización."""
        user = self._require_auth()
        if user is None:
            return

        body = self._read_json_body()
        if body is None:
            return self._error_response(400, "JSON inválido")

        cliente_id = body.get("cliente_id")
        if cliente_id is None:
            return self._error_response(400, "cliente_id es obligatorio")

        # Serializar items y precios como JSON string si vienen como objeto
        items_json = body.get("items_json", "[]")
        if isinstance(items_json, (list, dict)):
            items_json = json.dumps(items_json, ensure_ascii=False)

        precios_json = body.get("precios_json", "{}")
        if isinstance(precios_json, (list, dict)):
            precios_json = json.dumps(precios_json, ensure_ascii=False)

        total = body.get("total", 0)
        notas = body.get("notas", "")

        conn = get_db()
        # Verificar que el cliente exista
        cli = conn.execute("SELECT id FROM clientes WHERE id = ?", (cliente_id,)).fetchone()
        if cli is None:
            conn.close()
            return self._error_response(404, "Cliente no encontrado")

        cur = conn.execute(
            """INSERT INTO cotizaciones (cliente_id, usuario_id, items_json, precios_json, total, notas)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (cliente_id, user["id"], items_json, precios_json, total, notas),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM cotizaciones WHERE id = ?", (cur.lastrowid,)).fetchone()
        conn.close()

        self._json_response(row_to_dict(row), 201)

    def _handle_cotizaciones_get(self, cid):
        """GET /api/cotizaciones/<id> — Devuelve una cotización."""
        user = self._require_auth()
        if user is None:
            return

        conn = get_db()
        row = conn.execute("SELECT * FROM cotizaciones WHERE id = ?", (cid,)).fetchone()
        conn.close()

        if row is None:
            return self._error_response(404, "Cotización no encontrada")
        self._json_response(row_to_dict(row))

    def _handle_cotizaciones_update(self, cid):
        """PUT /api/cotizaciones/<id> — Actualiza una cotización."""
        user = self._require_auth()
        if user is None:
            return

        body = self._read_json_body()
        if body is None:
            return self._error_response(400, "JSON inválido")

        conn = get_db()
        existing = conn.execute("SELECT * FROM cotizaciones WHERE id = ?", (cid,)).fetchone()
        if existing is None:
            conn.close()
            return self._error_response(404, "Cotización no encontrada")

        # Validar estado si se envía
        ESTADOS_VALIDOS = ("borrador", "enviada", "aprobada", "rechazada")
        estado = body.get("estado", existing["estado"])
        if estado not in ESTADOS_VALIDOS:
            conn.close()
            return self._error_response(400, f"Estado inválido. Valores permitidos: {', '.join(ESTADOS_VALIDOS)}")

        # Serializar items/precios si vienen como objeto
        items_json = body.get("items_json", existing["items_json"])
        if isinstance(items_json, (list, dict)):
            items_json = json.dumps(items_json, ensure_ascii=False)

        precios_json = body.get("precios_json", existing["precios_json"])
        if isinstance(precios_json, (list, dict)):
            precios_json = json.dumps(precios_json, ensure_ascii=False)

        total = body.get("total", existing["total"])
        notas = body.get("notas", existing["notas"])
        cliente_id = body.get("cliente_id", existing["cliente_id"])

        conn.execute(
            """UPDATE cotizaciones
               SET cliente_id=?, items_json=?, precios_json=?, total=?, estado=?, notas=?
               WHERE id=?""",
            (cliente_id, items_json, precios_json, total, estado, notas, cid),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM cotizaciones WHERE id = ?", (cid,)).fetchone()
        conn.close()

        self._json_response(row_to_dict(row))

    def _handle_cotizaciones_delete(self, cid):
        """DELETE /api/cotizaciones/<id> — Elimina una cotización."""
        user = self._require_auth()
        if user is None:
            return

        conn = get_db()
        existing = conn.execute("SELECT * FROM cotizaciones WHERE id = ?", (cid,)).fetchone()
        if existing is None:
            conn.close()
            return self._error_response(404, "Cotización no encontrada")

        conn.execute("DELETE FROM cotizaciones WHERE id = ?", (cid,))
        conn.commit()
        conn.close()

        self._json_response({"ok": True, "message": f"Cotización {cid} eliminada"})

    # ══════════════════════════════════════════
    # ÓRDENES DE PRODUCCIÓN handlers
    # ══════════════════════════════════════════

    def _handle_ordenes_list(self, params):
        """GET /api/ordenes?estado=X — Lista órdenes de producción."""
        user = self._require_auth()
        if user is None:
            return

        conn = get_db()
        if "estado" in params:
            rows = conn.execute(
                "SELECT * FROM ordenes_produccion WHERE estado = ? ORDER BY fecha DESC",
                (params["estado"],),
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM ordenes_produccion ORDER BY fecha DESC").fetchall()
        conn.close()

        self._json_response(rows_to_list(rows))

    def _handle_ordenes_create(self):
        """POST /api/ordenes — Crea una orden de producción."""
        user = self._require_auth()
        if user is None:
            return

        body = self._read_json_body()
        if body is None:
            return self._error_response(400, "JSON inválido")

        cotizacion_id = body.get("cotizacion_id")
        if cotizacion_id is None:
            return self._error_response(400, "cotizacion_id es obligatorio")

        conn = get_db()
        # Verificar que la cotización exista
        cot = conn.execute("SELECT id FROM cotizaciones WHERE id = ?", (cotizacion_id,)).fetchone()
        if cot is None:
            conn.close()
            return self._error_response(404, "Cotización no encontrada")

        notas = body.get("notas", "")
        cur = conn.execute(
            "INSERT INTO ordenes_produccion (cotizacion_id, notas) VALUES (?, ?)",
            (cotizacion_id, notas),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM ordenes_produccion WHERE id = ?", (cur.lastrowid,)).fetchone()
        conn.close()

        self._json_response(row_to_dict(row), 201)

    def _handle_ordenes_update(self, oid):
        """PUT /api/ordenes/<id> — Actualiza estado de una orden."""
        user = self._require_auth()
        if user is None:
            return

        body = self._read_json_body()
        if body is None:
            return self._error_response(400, "JSON inválido")

        conn = get_db()
        existing = conn.execute("SELECT * FROM ordenes_produccion WHERE id = ?", (oid,)).fetchone()
        if existing is None:
            conn.close()
            return self._error_response(404, "Orden no encontrada")

        ESTADOS_VALIDOS = ("pendiente", "en_proceso", "terminada")
        estado = body.get("estado", existing["estado"])
        if estado not in ESTADOS_VALIDOS:
            conn.close()
            return self._error_response(400, f"Estado inválido. Valores permitidos: {', '.join(ESTADOS_VALIDOS)}")

        notas = body.get("notas", existing["notas"])
        conn.execute(
            "UPDATE ordenes_produccion SET estado=?, notas=? WHERE id=?",
            (estado, notas, oid),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM ordenes_produccion WHERE id = ?", (oid,)).fetchone()
        conn.close()

        self._json_response(row_to_dict(row))

    # ══════════════════════════════════════════
    # PROXY SIIGO (se mantiene igual al original)
    # ══════════════════════════════════════════

    def _proxy_request(self, method):
        """Proxea peticiones a la API de Siigo para evitar bloqueo CORS."""
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
                method=method,
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


# ─────────────────────────────────────────────
# Punto de entrada
# ─────────────────────────────────────────────
if __name__ == "__main__":
    os.chdir(BASE_DIR)

    # Inicializar base de datos
    init_db()

    print()
    print("=" * 55)
    print("  🏗️  Alumital SAS — Servidor Backend")
    print("=" * 55)
    print(f"  🌐 URL:              http://localhost:{PORT}")
    print(f"  📁 Archivos estáticos: /")
    print(f"  🔌 Proxy Siigo API:  /proxy/siigo/* → {SIIGO_BASE}/*")
    print(f"  📡 API REST:         /api/*")
    print(f"  🗄️  Base de datos:    {DB_PATH}")
    print()
    print("  Endpoints disponibles:")
    print("    POST   /api/login           → Iniciar sesión")
    print("    GET    /api/session          → Verificar sesión")
    print("    POST   /api/logout           → Cerrar sesión")
    print("    GET    /api/clientes         → Listar clientes")
    print("    POST   /api/clientes         → Crear cliente")
    print("    GET    /api/clientes/<id>    → Ver cliente")
    print("    PUT    /api/clientes/<id>    → Actualizar cliente")
    print("    DELETE /api/clientes/<id>    → Eliminar cliente")
    print("    GET    /api/cotizaciones     → Listar cotizaciones")
    print("    POST   /api/cotizaciones     → Crear cotización")
    print("    GET    /api/cotizaciones/<id>→ Ver cotización")
    print("    PUT    /api/cotizaciones/<id>→ Actualizar cotización")
    print("    DELETE /api/cotizaciones/<id>→ Eliminar cotización")
    print("    GET    /api/ordenes          → Listar órdenes")
    print("    POST   /api/ordenes          → Crear orden")
    print("    PUT    /api/ordenes/<id>     → Actualizar orden")
    print("=" * 55)
    print()

    httpd = http.server.HTTPServer(("", PORT), AlumitalHandler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[Alumital] Servidor detenido.")
        httpd.server_close()
