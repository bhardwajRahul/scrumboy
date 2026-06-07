#!/usr/bin/env python3
"""Serve architecture diagrams from this script's directory (not the shell cwd)."""
from __future__ import annotations

import http.server
import os
import socketserver
import sys
import webbrowser
from pathlib import Path

PORT = 8775
HOST = "127.0.0.1"
ROOT = Path(__file__).resolve().parent


def main() -> int:
    os.chdir(ROOT)
    index = ROOT / "index.html"
    md_files = list(ROOT.glob("scrumboy_*.md"))

    print()
    print("Scrumboy architecture diagrams")
    print(f"  Folder: {ROOT}")
    print(f"  Files:  index.html={'yes' if index.is_file() else 'MISSING'}, {len(md_files)} diagram markdown file(s)")
    print()

    if not index.is_file():
        print("ERROR: index.html not found in this folder.", file=sys.stderr)
        print("You may be on the wrong git branch or the diagrams were not created yet.", file=sys.stderr)
        return 1

    if len(md_files) == 0:
        print("ERROR: no scrumboy_*.md files found.", file=sys.stderr)
        return 1

    url = f"http://{HOST}:{PORT}/"
    print(f"  Open:   {url}")
    print("  Stop:   Ctrl+C")
    print()

    handler = http.server.SimpleHTTPRequestHandler
    try:
        with socketserver.TCPServer((HOST, PORT), handler) as httpd:
            try:
                webbrowser.open(url)
            except OSError:
                pass
            httpd.serve_forever()
    except OSError as exc:
        print(f"ERROR: could not bind {HOST}:{PORT} - {exc}", file=sys.stderr)
        print("Another server may be using this port. Stop it (Ctrl+C) and retry.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
