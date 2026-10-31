"""Lists frontend exports that nothing else imports (dead code candidates) and files nothing imports.
Usage: python scripts/audit-exports.py   (run from frontend/)"""
import re
from pathlib import Path

SRC = Path('src')
files = [p for p in SRC.rglob('*') if p.suffix in {'.js', '.jsx'}]
text = {p: p.read_text(encoding='utf-8') for p in files}
all_text = '\n'.join(text.values())

export_re = re.compile(r'export\s+(?:default\s+)?(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_]+)')
print('Exports used only inside their own file (or nowhere):')
for p, src in sorted(text.items()):
    for name in export_re.findall(src):
        elsewhere = sum(len(re.findall(rf'\b{name}\b', t)) for q, t in text.items() if q != p)
        inside = len(re.findall(rf'\b{name}\b', src)) - 1
        if elsewhere == 0:
            print(f'  {str(p).replace(chr(92), "/"):<34} {name:<22} {"used inside file" if inside > 0 else "UNUSED"}')

print('\nFiles nothing imports:')
for p in files:
    if p.name in {'main.jsx'}:
        continue
    stem = p.stem
    refs = [q for q, t in text.items() if q != p and re.search(rf"['\"/]{re.escape(stem)}(\.jsx?)?['\"]", t)]
    if not refs:
        print('  ', str(p).replace(chr(92), '/'))

print('\nDuplicated constants (same literal in 2+ files):')
for needle in ["'Primary'", "TYPE_COLOR", "TYPE_COLORS", "TIER_NAME", "blindspot."]:
    hits = [str(p).replace(chr(92), '/') for p, t in text.items() if needle in t]
    if len(hits) > 2 and needle != "blindspot.":
        print(f'  {needle}: {", ".join(hits)}')
keys = re.findall(r"['\"](blindspot\.[a-z0-9.\-]+)['\"]", all_text)
print('  storage keys:', sorted(set(keys)))
