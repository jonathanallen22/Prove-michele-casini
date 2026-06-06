#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════
#  Antitesi dev server
#
#  Serves the static site: clean URLs (/about → about.html), 404 →
#  /404.html, and correct MIME types for .js/.mjs/.css. This is the
#  whole job of the server, and it behaves identically to the original.
#
#  API endpoints (e.g. the graffiti wall for one article) are NOT part
#  of the core. They live as self-contained modules in  api/  and
#  register themselves below. The server just asks each registered
#  module "do you handle this path?" before falling back to files.
#  Delete a module from API_MODULES and that feature is gone — the
#  static server is untouched.
#
#  Run:  python3 server.py        (or ./server.sh)
# ════════════════════════════════════════════════════════════════════

import http.server
import os
from urllib.parse import urlparse

PORT = 8000

# ── Registered API modules ───────────────────────────────────────────
# Each module exposes:  handle(handler, method, parsed) -> bool
#   returns True if it handled the request (and wrote a response),
#   False to let the server fall through to normal static serving.
# Optionally:  init()  for one-time setup (e.g. create its DB).
#
# To add a feature: write api/<name>.py and append it here.
# To remove one: delete the line (and the file). The core is unaffected.
API_MODULES = []
try:
    from api import graffiti
    API_MODULES.append(graffiti)
except Exception as e:                          # a broken/absent module must
    print(f'[api] graffiti disabled: {e}')      # never take the static site down


class Handler(http.server.SimpleHTTPRequestHandler):

    # ── API dispatch: give each module first refusal, else fall through ──
    def _dispatch_api(self, method):
        parsed = urlparse(self.path)
        for mod in API_MODULES:
            try:
                if mod.handle(self, method, parsed):
                    return True
            except Exception as e:
                # An API module erroring must not crash the connection;
                # respond 500 on its behalf and stop.
                try:
                    self.send_response(500)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(b'{"error":"internal error"}')
                except Exception:
                    pass
                print(f'[api] {mod.__name__} error: {e}')
                return True
        return False

    def do_GET(self):
        if self._dispatch_api('GET'):
            return
        # ── static: clean-URL rewrite (identical to original) ──
        parsed = urlparse(self.path)
        url_path = parsed.path
        if not os.path.splitext(url_path)[1] and not url_path.endswith('/'):
            candidate = url_path.lstrip('/') + '.html'
            if os.path.isfile(candidate):
                self.path = '/' + candidate
                if parsed.query:
                    self.path += '?' + parsed.query
        return super().do_GET()

    def do_POST(self):
        if self._dispatch_api('POST'):
            return
        self.send_error(404)        # no static resource accepts POST

    def send_error(self, code, message=None, explain=None):
        if code == 404:
            self.send_response(302)
            self.send_header('Location', '/404.html')
            self.end_headers()
            return
        super().send_error(code, message, explain)

    def guess_type(self, path):
        ext = os.path.splitext(path)[1].lower()
        types = {'.js': 'application/javascript',
                 '.mjs': 'application/javascript',
                 '.css': 'text/css'}
        return types.get(ext) or super().guess_type(path)


if __name__ == '__main__':
    for mod in API_MODULES:                     # one-time module setup
        if hasattr(mod, 'init'):
            try:
                mod.init()
            except Exception as e:
                print(f'[api] {mod.__name__} init failed: {e}')
    print(f'Serving on http://localhost:{PORT}')
    if API_MODULES:
        print('API modules: ' + ', '.join(m.__name__.split('.')[-1] for m in API_MODULES))
    # ThreadingHTTPServer so a slow POST can't block page loads.
    http.server.ThreadingHTTPServer(('', PORT), Handler).serve_forever()