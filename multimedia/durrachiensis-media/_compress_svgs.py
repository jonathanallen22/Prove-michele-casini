"""
Two passes:
  1. Path-segment thinning:  Keep every Nth segment.
  2. Precision + cleanup:  round coords to 1 decimal, strip metadata,
     drop DOCTYPE, collapse whitespace.

Run:  py _compress_svgs.py
"""
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
TARGETS = ["non-est-hic.svg", "hanc-ego.svg", "facial.svg", "winged.svg"]
# Keep 1 of every KEEP_EVERY N segments 
KEEP_EVERY = 2

# Matches a signed/unsigned decimal number with optional fractional part and exponent.
NUMBER_RE = re.compile(r"-?\d+\.\d+(?:[eE]-?\d+)?")
# Matches d="..." attribute (handles both single and double quotes).
D_ATTR_RE = re.compile(r"""\bd=(['"])(.*?)\1""", re.DOTALL)
# Matches transform="..." attribute (also has lots of decimals).
TX_ATTR_RE = re.compile(r"""\btransform=(['"])(.*?)\1""", re.DOTALL)


def round_numbers(text: str, precision: int = 1) -> str:
    def repl(m: re.Match) -> str:
        try:
            v = round(float(m.group(0)), precision)
            # Drop trailing .0 for integers (saves 2 chars per int).
            if v == int(v):
                return str(int(v))
            # Format with given precision, strip trailing zeros.
            return f"{v:.{precision}f}".rstrip("0").rstrip(".")
        except ValueError:
            return m.group(0)
    return NUMBER_RE.sub(repl, text)


def thin_path(d: str, keep_every: int) -> str:
    """Parse an Excalidraw 'M x y Q c1 e1 c2 e2 ... Z' path and keep every
    Nth Q segment. Last segment is always preserved so the path closes."""
    if keep_every <= 1:
        return d
    # Split into prefix (M ...) and the Q chain.
    m_match = re.match(r"\s*M\s*(-?\d+(?:\.\d+)?)[ ,]+(-?\d+(?:\.\d+)?)\s*", d)
    if not m_match:
        return d
    mx, my = m_match.group(1), m_match.group(2)
    rest = d[m_match.end():].strip()
    # Strip leading "Q" (case-insensitive) — coordinates after the first Q
    # implicitly chain as more Q segments.
    rest = re.sub(r"^[Qq]\s*", "", rest)
    # Strip trailing Z/z if present, remember it.
    has_z = False
    if rest.endswith(("Z", "z")):
        has_z = True
        rest = rest[:-1].rstrip()
    # Pull every number out of the Q chain. Each Q segment = 4 numbers
    # (control x, control y, end x, end y).
    nums = re.findall(r"-?\d+(?:\.\d+)?", rest)
    if len(nums) < 4:
        return d
    n_segments = len(nums) // 4
    if n_segments <= 2:
        return d
    kept = []
    for i in range(n_segments):
        if i % keep_every == 0 or i == n_segments - 1:
            kept.extend(nums[i*4:(i+1)*4])
    if not kept:
        return d
    out = f"M {mx},{my} Q " + " ".join(
        f"{kept[i]},{kept[i+1]}" for i in range(0, len(kept), 2)
    )
    if has_z:
        out += " Z"
    return out


def compress_d_attr(m: re.Match) -> str:
    quote, body = m.group(1), m.group(2)
    body = thin_path(body, KEEP_EVERY)
    body = round_numbers(body, precision=1)
    # Collapse multiple whitespace chars into one space.
    body = re.sub(r"\s+", " ", body).strip()
    return f"d={quote}{body}{quote}"


def compress_transform_attr(m: re.Match) -> str:
    quote, body = m.group(1), m.group(2)
    body = round_numbers(body, precision=2)
    body = re.sub(r"\s+", " ", body).strip()
    return f"transform={quote}{body}{quote}"


def optimize(text: str) -> str:
    # Drop DOCTYPE
    text = re.sub(r"<!DOCTYPE[^>]*>\s*", "", text)
    # Drop XML comments (but keep first declaration <?xml ?>)
    text = re.sub(r"<!--.*?-->", "", text, flags=re.DOTALL)
    # Drop <metadata>...</metadata> (Excalidraw embeds source JSON here)
    text = re.sub(r"<metadata[^>]*>.*?</metadata>", "", text, flags=re.DOTALL)
    # Compress path data
    text = D_ATTR_RE.sub(compress_d_attr, text)
    # Compress transforms (rotate/translate matrices)
    text = TX_ATTR_RE.sub(compress_transform_attr, text)
    # Collapse runs of whitespace between tags
    text = re.sub(r">\s+<", "><", text)
    return text.strip() + "\n"


def main() -> int:
    total_in = 0
    total_out = 0
    for name in TARGETS:
        src = HERE / name
        if not src.exists():
            print(f"  ! missing: {src}")
            continue
        raw = src.read_text(encoding="utf-8")
        out = optimize(raw)
        src.write_text(out, encoding="utf-8")
        before = len(raw.encode("utf-8"))
        after = len(out.encode("utf-8"))
        total_in += before
        total_out += after
        pct = 100 * (1 - after / before)
        print(f"  {name:<22} {before/1024:>6.1f} KB  ->  {after/1024:>6.1f} KB   ({pct:5.1f}% smaller)")
    if total_in:
        pct = 100 * (1 - total_out / total_in)
        print(f"  {'TOTAL':<22} {total_in/1024:>6.1f} KB  ->  {total_out/1024:>6.1f} KB   ({pct:5.1f}% smaller)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
