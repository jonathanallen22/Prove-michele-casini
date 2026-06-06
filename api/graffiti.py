# ════════════════════════════════════════════════════════════════════
#  api/graffiti.py — shared graffiti wall (for Durrachiensis article)
#
#  Routes (both under /api/graffiti):
#     GET   → newest contributions, oldest-first (each = wall PNGs)
#     POST  → save one contribution, IP-rate-limited, FIFO-trim
#
#  Walls are flat textures, so we store the painted 2D images, never
#  3D coordinates. The page wraps them back onto the 3D walls on load.
# ════════════════════════════════════════════════════════════════════

import json
import os
import re
import sqlite3
import time

ROUTE = '/api/graffiti'

# ── Tunables ─────────────────────────────────────────────────────────
DB_PATH        = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'graffiti.db')
RING_SIZE      = 50          # newest N kept in the DB (FIFO)
RENDER_DEFAULT = 30          # how many the page asks for / layers
WALL_NAMES     = ('front', 'right', 'back', 'left', 'ceiling', 'floor')

MAX_BODY_BYTES    = 6 * 1024 * 1024     # 6 MB total request body
MAX_PNG_B64_CHARS = 1_400_000           # ~1 MB decoded, per wall image

MAX_ENTRIES_PER_IP  = 9      # most live marks one IP may hold
MIN_SECONDS_BETWEEN = 2     # cooldown between an IP's submissions

# Master switch — GRAFFITI_OPEN=0 freezes submissions (reads still work).
SUBMISSIONS_OPEN = os.environ.get('GRAFFITI_OPEN', '1') != '0'

_DATAURL_RE = re.compile(r'^data:image/png;base64,[A-Za-z0-9+/=\s]+$')


# ── Database ─────────────────────────────────────────────────────────
def _db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init():
    """One-time setup, called by the server on startup."""
    with _db() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS graffiti (
                id    INTEGER PRIMARY KEY AUTOINCREMENT,
                ts    REAL    NOT NULL,
                ip    TEXT    NOT NULL,
                walls TEXT    NOT NULL   -- JSON { wallName: pngDataURL }
            )
        ''')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_ts ON graffiti(ts)')


def _fetch_recent(n):
    n = max(1, min(RING_SIZE, int(n)))
    with _db() as conn:
        rows = conn.execute(
            'SELECT id, ts, walls FROM graffiti ORDER BY id DESC LIMIT ?', (n,)
        ).fetchall()
    out = []
    for r in reversed(rows):              # oldest-first → chronological layering
        try:
            walls = json.loads(r['walls'])
        except Exception:
            continue
        out.append({'id': r['id'], 'ts': r['ts'], 'walls': walls})
    return out


def _insert_and_trim(ip, walls):
    with _db() as conn:
        conn.execute('INSERT INTO graffiti (ts, ip, walls) VALUES (?, ?, ?)',
                     (time.time(), ip, json.dumps(walls)))
        conn.execute('''
            DELETE FROM graffiti
            WHERE id NOT IN (SELECT id FROM graffiti ORDER BY id DESC LIMIT ?)
        ''', (RING_SIZE,))


def _ip_recent(ip):
    """(count, last_ts) for this IP among the live (un-trimmed) rows."""
    with _db() as conn:
        rows = conn.execute('''
            SELECT ts FROM graffiti
            WHERE id IN (SELECT id FROM graffiti ORDER BY id DESC LIMIT ?)
              AND ip = ?
            ORDER BY ts DESC
        ''', (RING_SIZE, ip)).fetchall()
    return len(rows), (rows[0]['ts'] if rows else 0)


# ── Validation ───────────────────────────────────────────────────────
def _validate(data):
    if not isinstance(data, dict):
        return False, 'body must be a JSON object'
    walls_in = data.get('walls')
    if not isinstance(walls_in, dict):
        return False, 'missing "walls" object'
    walls_out = {}
    for name, url in walls_in.items():
        if name not in WALL_NAMES:
            return False, f'unknown wall "{name}"'
        if not isinstance(url, str):
            return False, f'wall "{name}" must be a data URL string'
        if len(url) > MAX_PNG_B64_CHARS:
            return False, f'wall "{name}" image too large'
        if not _DATAURL_RE.match(url):
            return False, f'wall "{name}" is not a PNG data URL'
        walls_out[name] = url
    if not walls_out:
        return False, 'no painted walls submitted'
    return True, walls_out


# ── Small response helper (works with the core's handler) ────────────
def _json(handler, code, obj):
    body = json.dumps(obj).encode('utf-8')
    handler.send_response(code)
    handler.send_header('Content-Type', 'application/json')
    handler.send_header('Content-Length', str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _client_ip(handler):
    fwd = handler.headers.get('X-Forwarded-For')   # set by nginx in prod
    if fwd:
        return fwd.split(',')[0].strip()
    return handler.client_address[0]


# ── The single entry point the server calls ──────────────────────────
def handle(handler, method, parsed):
    if parsed.path != ROUTE:
        return False                       # not ours → let static serving run

    if method == 'GET':
        _handle_get(handler, parsed)
        return True
    if method == 'POST':
        _handle_post(handler)
        return True

    _json(handler, 405, {'error': 'method not allowed'})
    return True


def _handle_get(handler, parsed):
    n = RENDER_DEFAULT
    for part in (parsed.query or '').split('&'):
        if part.startswith('n='):
            try:
                n = int(part[2:])
            except ValueError:
                pass
    entries = _fetch_recent(n)
    _json(handler, 200, {
        'open': SUBMISSIONS_OPEN,
        'count': len(entries),
        'entries': entries,
    })


def _handle_post(handler):
    if not SUBMISSIONS_OPEN:
        return _json(handler, 403, {'error': 'submissions are closed'})

    length = int(handler.headers.get('Content-Length') or 0)
    if length <= 0:
        return _json(handler, 400, {'error': 'empty body'})
    if length > MAX_BODY_BYTES:
        return _json(handler, 413, {'error': 'payload too large'})

    raw = handler.rfile.read(length)
    try:
        data = json.loads(raw.decode('utf-8'))
    except Exception:
        return _json(handler, 400, {'error': 'invalid JSON'})

    ok, result = _validate(data)
    if not ok:
        return _json(handler, 400, {'error': result})

    ip = _client_ip(handler)
    count, last_ts = _ip_recent(ip)
    now = time.time()
    if now - last_ts < MIN_SECONDS_BETWEEN:
            return _json(handler, 429, {'error': 'slow down — wait a second'})
    if count >= MAX_ENTRIES_PER_IP:
        return _json(handler, 429, {
            'error': f'too many marks from you — come work with us'})

    _insert_and_trim(ip, result)
    _json(handler, 201, {'ok': True})