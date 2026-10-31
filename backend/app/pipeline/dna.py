"""Source DNA: find sources that copy each other, so agreement between copies isn't counted twice.

Pure code, no LLM. Two signals per pair of readable sources:
- overlap: share of the smaller text's 5-word shingles that also appear in the other text (containment);
- shared sentences: identical sentences (after normalising) that appear in both.
"""
from __future__ import annotations

import re

from ..models import DnaPair, FetchedSource, SourceDNA
from .verify import normalise

SHINGLE = 5
COPIED = 50      # % containment: the smaller page is mostly the other page
OVERLAP = 15     # % containment: they share whole passages
MIN_SENTENCE_WORDS = 8
_SPLIT = re.compile(r"(?<=[.!?])\s+|\n+")


def sentences(text: str) -> list[str]:
    out = []
    for raw in _SPLIT.split(text or ""):
        raw = raw.strip()
        if len(raw.split()) >= MIN_SENTENCE_WORDS:
            out.append(raw)
    return out


def shingles(text: str, n: int = SHINGLE) -> set[str]:
    words = normalise(text).split()
    return {" ".join(words[i:i + n]) for i in range(len(words) - n + 1)}


def containment(a: set[str], b: set[str]) -> int:
    if not a or not b:
        return 0
    return round(100 * len(a & b) / min(len(a), len(b)))


def relation(overlap: int) -> str:
    if overlap >= COPIED:
        return "copied"
    if overlap >= OVERLAP:
        return "overlap"
    return "independent"


def analyse(sources: list[FetchedSource], max_shared: int = 4) -> SourceDNA:
    readable = [s for s in sources if s.readable]
    if len(readable) < 2:
        return SourceDNA(pairs=[], clusters=[], note="Source DNA needs at least two readable sources.")
    prints = {s.id: shingles(s.text) for s in readable}
    sents = {s.id: {normalise(x): x for x in sentences(s.text)} for s in readable}
    pairs: list[DnaPair] = []
    for i, a in enumerate(readable):
        for b in readable[i + 1:]:
            overlap = containment(prints[a.id], prints[b.id])
            common = [sents[a.id][k] for k in sents[a.id] if k in sents[b.id]]
            common.sort(key=len, reverse=True)
            pairs.append(DnaPair(a=a.id, b=b.id, overlap=overlap, relation=relation(overlap), shared_sentences=common[:max_shared], shared_count=len(common)))

    # Group copies with a small union-find, so "S3 copies S4 copies S5" becomes one cluster.
    parent = {s.id: s.id for s in readable}

    def find(x: str) -> str:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for p in pairs:
        if p.relation == "copied":
            parent[find(p.a)] = find(p.b)
    groups: dict[str, list[str]] = {}
    for s in readable:
        groups.setdefault(find(s.id), []).append(s.id)
    clusters = [sorted(g) for g in groups.values() if len(g) > 1]
    pairs.sort(key=lambda p: p.overlap, reverse=True)
    note = (f"{len(clusters)} group(s) of sources look like copies of each other; treat each group as one voice."
            if clusters else "No source copies another; agreement between them counts as independent.")
    return SourceDNA(pairs=pairs, clusters=clusters, note=note)
