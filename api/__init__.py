# api/ — self-contained server-side feature modules.
# Each module exposes handle(handler, method, parsed) -> bool and is
# registered in server.py's API_MODULES list. Removing a module here +
# its line in server.py fully removes that feature; the static server
# is never affected.