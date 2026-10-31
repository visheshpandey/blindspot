"""Quote verification: an LLM quote must be found in the fetched page text, or the claim is dropped."""
from __future__ import annotations

import re
import unicodedata

from rapidfuzz import fuzz

MATCH_THRESHOLD = 85
MIN_QUOTE_CHARS = 12

_QUOTES = str.maketrans({"‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", " ": " "})
_CURRENCY = re.compile(r"(₹|\brs\.?|\binr\b)\s*", re.I)
_PUNCT = re.compile(r"[^\w\s]", re.UNICODE)
_SPACE = re.compile(r"\s+")


def normalise(text: str) -> str:
    text = unicodedata.normalize("NFKC", text or "").translate(_QUOTES).lower()
    text = _CURRENCY.sub("rs ", text)
    text = re.sub(r"(?<=\d),(?=\d)", "", text)  # 2,50,000 -> 250000
    text = _PUNCT.sub(" ", text)
    return _SPACE.sub(" ", text).strip()


def quote_score(quote: str, source_text: str) -> int:
    q, s = normalise(quote), normalise(source_text)
    if len(q) < MIN_QUOTE_CHARS or not s:
        return 0
    if q in s:
        return 100
    return round(fuzz.partial_ratio(q, s))


def is_verified(quote: str, source_text: str) -> tuple[bool, int]:
    score = quote_score(quote, source_text)
    return score >= MATCH_THRESHOLD, score
