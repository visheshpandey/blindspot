"""Credibility tiers and year/cycle detection. Pure code, no LLM."""
from __future__ import annotations

import re
from urllib.parse import urlparse

from .. import traplab
from ..models import CredType, FetchedSource

PRIMARY_SUFFIXES = (".gov.in", ".nic.in", ".gov", ".gov.uk", ".europa.eu")
PRIMARY_HOSTS = {
    "scholarships.gov.in", "scholarshipportal.mp.nic.in", "mpbse.nic.in", "india.gov.in",
    "myscheme.gov.in", "socialjustice.gov.in", "tribal.nic.in", "minorityaffairs.gov.in",
}
INSTITUTIONAL_SUFFIXES = (".ac.in", ".edu", ".edu.in", ".ac.uk", ".res.in")
INSTITUTIONAL_WORDS = re.compile(r"\b(university|college|institute|vidyalaya|vishwavidyalaya|iit|nit|iiit|school)\b", re.I)

# 2025-26, 2025–26, 2025/26, 2025-2026
CYCLE_RE = re.compile(r"\b(20\d{2})\s*[-–—/]\s*(\d{2}|20\d{2})\b")
YEAR_RE = re.compile(r"\b(20[0-4]\d)\b")
DATE_HINT_RE = re.compile(
    r"(?:last\s+updated|updated\s+on|updated|published\s+on|published|posted\s+on|dated?)\s*[:\-]?\s*"
    r"(\d{1,2}[\s./-][A-Za-z]{3,9}[\s./-]\d{2,4}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})",
    re.I,
)


def host_of(url: str) -> str:
    host = urlparse(url).netloc.lower()
    return host[4:] if host.startswith("www.") else host


def credibility(host: str, title: str = "", readable: bool = True) -> CredType:
    if not readable:
        return "Unverified"
    host = host.lower()
    lab = traplab.tier_for(host)
    if lab:
        return lab
    if host in PRIMARY_HOSTS or host.endswith(PRIMARY_SUFFIXES):
        return "Primary"
    if host.endswith(INSTITUTIONAL_SUFFIXES) or INSTITUTIONAL_WORDS.search(title or "") or INSTITUTIONAL_WORDS.search(host.replace("-", " ").replace(".", " ")):
        return "Institutional"
    return "Secondary"


def normalise_cycle(text: str | None) -> str:
    """'2026-2027', '2026/27', 'session 2026-27' -> '2026–27'. A lone year '2026' -> '2026'. Else ''."""
    if not text:
        return ""
    m = CYCLE_RE.search(text)
    if m:
        start = int(m.group(1))
        end = m.group(2)
        end_short = end[-2:]
        if int(end_short) == (start + 1) % 100:
            return f"{start}–{end_short}"
    y = YEAR_RE.search(text)
    return y.group(1) if y else ""


def cycle_start(cycle: str) -> int | None:
    """Start year of a normalised cycle or year. '2025–26' -> 2025, '2025' -> 2025."""
    m = re.match(r"(20\d{2})", cycle or "")
    return int(m.group(1)) if m else None


def is_older(claim_cycle: str, locked: str) -> bool:
    """True if claim_cycle belongs to an earlier cycle than the locked one.

    A bare year (e.g. a date '30 November 2025') is compared with the locked cycle's start year:
    for a 2026–27 lock, any year before 2026 is older.
    """
    c, l = cycle_start(normalise_cycle(claim_cycle)), cycle_start(normalise_cycle(locked))
    if c is None or l is None:
        return False
    return c < l


def detect_cycles(text: str, limit: int = 8) -> list[str]:
    found: list[str] = []
    for m in CYCLE_RE.finditer(text or ""):
        c = normalise_cycle(m.group(0))
        if c and c not in found:
            found.append(c)
        if len(found) >= limit:
            break
    return found


def detect_date(text: str) -> str:
    m = DATE_HINT_RE.search((text or "")[:6000])
    if m:
        label = m.group(0).split()[0].capitalize()
        return f"{label} {m.group(1)}"
    return ""


def classify(source: FetchedSource) -> FetchedSource:
    readable = source.readable
    # Pasted text never inherits the authority of the URL it claims to come from.
    source.type = "Pasted" if source.state == "Pasted" else credibility(source.host, source.name, readable)
    if source.live_text:
        source.live_type = credibility(source.claimed_host, "", True)
    if not readable:
        source.date = "Could not fetch page" if source.state == "Blocked" else ""
        return source
    source.cycles = detect_cycles(source.text)
    source.date = detect_date(source.text) or (f"Mentions {source.cycles[0]}" if source.cycles else "")
    return source
