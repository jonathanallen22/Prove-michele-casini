#!/usr/bin/env python3
"""
merge_explore.py

Extracts the main explore section from explore.html and injects it into
index.html to produce index.with-explore.html. Also writes explore-fragment.html
containing only the extracted section so it can be edited separately.

Usage: python3 tools/merge_explore.py
"""
import re
import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INDEX = Path(__file__).resolve().parents[2] / 'index.html'
INDEX = ROOT / 'index.html'
EXPLORE = ROOT / 'explore.html'
FRAGMENT = ROOT / 'explore-fragment.html'
OUT = ROOT / 'index.with-explore.html'


def read(p: Path) -> str:
    return p.read_text(encoding='utf-8')


def write(p: Path, text: str):
    p.write_text(text, encoding='utf-8')
    print(f'Wrote: {p}')


def extract_standard_page(html: str) -> str:
    # Greedy match for the <section class="standard-page"> ... </section>
    m = re.search(r"(<section[^>]*class=[\'\"]?standard-page[\'\"]?[^>]*>.*?</section>)", html, re.S)
    if not m:
        raise RuntimeError('Could not find <section class="standard-page"> in explore.html')
    return m.group(1)


def inject_after_screen2(index_html: str, fragment_html: str) -> str:
    # Find the closing tag of the section with id="screen-2" and insert after it
    m = re.search(r"(<section[^>]*id=[\'\"]screen-2[\'\"][^>]*>.*?</section>)", index_html, re.S)
    if not m:
        # Fallback: append to end of body
        print('Warning: screen-2 not found; appending fragment before </body>')
        return re.sub(r"</body>", fragment_html + "\n</body>", index_html, flags=re.I)
    # Insert fragment after the matched section
    return index_html.replace(m.group(1), m.group(1) + '\n\n<!-- BEGIN injected explore -->\n' + fragment_html + '\n<!-- END injected explore -->')


def main():
    p = argparse.ArgumentParser(description='Merge explore into index')
    p.add_argument('--index', help='Path to index.html to inject into', default=str(DEFAULT_INDEX))
    args = p.parse_args()

    index_path = Path(args.index)
    if not index_path.exists():
        print('index.html not found at', index_path)
        return
    if not EXPLORE.exists():
        print('explore.html not found in', ROOT)
        return

    explore_html = read(EXPLORE)
    index_html = read(index_path)

    fragment = extract_standard_page(explore_html)
    write(FRAGMENT, fragment)

    merged = inject_after_screen2(index_html, fragment)
    write(OUT, merged)

    print('\nDone. Preview the merged file at:')
    print('  ', OUT)


if __name__ == '__main__':
    main()
