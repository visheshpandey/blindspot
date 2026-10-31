"""The public API contract: request, result and helper schemas (what the frontend sends and receives)."""
from __future__ import annotations

from typing import Literal
import re
from urllib.parse import urlsplit, urlunsplit

from pydantic import BaseModel, Field, field_validator, model_validator

Status = Literal["supported", "conflict", "outdated", "missing", "unverified"]
CredType = Literal["Primary", "Institutional", "Secondary", "Pasted", "Unverified"]
SourceState = Literal["Readable", "Blocked", "Pasted"]
Verdict = Literal["Insufficient evidence", "Not ready to decide", "Proceed with caution", "Ready to decide"]
Mode = Literal["live", "demo"]
Step = Literal["checklist", "fetch", "classify", "extract", "verify", "compare", "score", "actions", "done", "error"]

BLOCKER_STATUSES: frozenset[str] = frozenset({"conflict", "outdated", "missing", "unverified"})
TYPE_COLORS: dict[str, str] = {"Primary": "blue", "Institutional": "violet", "Secondary": "amber", "Pasted": "teal", "Unverified": "rose"}


# ---------- Request ----------

class Context(BaseModel):
    year: str = "2026–27"
    location: str = "Madhya Pradesh"
    category: str = "Undergraduate student"


# Exactly the options the New investigation dropdowns offer.
Year = Literal["2026–27", "2025–26", "2027–28"]
Location = Literal["Madhya Pradesh", "Uttar Pradesh", "Maharashtra", "Rajasthan", "Bihar", "Delhi", "Karnataka", "Tamil Nadu", "West Bengal", "India-wide"]
Category = Literal["Undergraduate student", "Postgraduate student", "School student (Class 11–12)", "Diploma / ITI student", "Job seeker", "Parent / guardian"]
MAX_PASTED_CHARS = 50_000
PASTED_KEY = re.compile(r"pasted://source-([1-5])")


def normalise_url(url: str) -> str:
    """For duplicate checks: lowercase host, no fragment, no trailing slash."""
    parts = urlsplit(url.strip())
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path.rstrip("/"), parts.query, ""))


class AnalyzeRequest(BaseModel):
    question: str
    year: Year = "2026–27"
    location: Location = "Madhya Pradesh"
    category: Category = "Undergraduate student"
    sources: list[str] = Field(default_factory=list, max_length=5)
    pasted_text: dict[str, str] = Field(default_factory=dict)

    @field_validator("question")
    @classmethod
    def _question(cls, q: str) -> str:
        q = " ".join(q.split())
        if not 10 <= len(q) <= 500:
            raise ValueError("Write your question in 10 to 500 characters.")
        return q

    @field_validator("sources")
    @classmethod
    def _valid_urls(cls, urls: list[str]) -> list[str]:
        cleaned, seen = [], set()
        for url in urls:
            url = url.strip()
            if not url:
                continue
            parts = urlsplit(url)
            if parts.scheme != "https" or not parts.hostname or "." not in parts.hostname:
                raise ValueError(f"Use a full web address starting with https:// ({url[:80]})")
            key = normalise_url(url)
            if key in seen:
                raise ValueError(f"The same page is listed twice: {url[:80]}")
            seen.add(key)
            cleaned.append(url)
        return cleaned

    @model_validator(mode="after")
    def _has_sources(self) -> "AnalyzeRequest":
        for key, text in self.pasted_text.items():
            if len(text) > MAX_PASTED_CHARS:
                raise ValueError(f"Pasted text is limited to {MAX_PASTED_CHARS:,} characters per source.")
            if key not in self.sources and not PASTED_KEY.fullmatch(key):
                raise ValueError("Pasted text must belong to one of the listed sources.")
        if not self.sources and not any(t.strip() for t in self.pasted_text.values()):
            raise ValueError("Add at least one source URL or pasted text.")
        if len(set(self.sources) | set(self.pasted_text)) > 5:
            raise ValueError("Use at most five sources.")
        return self

    @property
    def context(self) -> Context:
        return Context(year=self.year, location=self.location, category=self.category)


class AnalyzeAccepted(BaseModel):
    investigation_id: str


# ---------- Result ----------

class SourceOut(BaseModel):
    id: str
    name: str
    host: str
    type: CredType
    state: SourceState
    date: str = ""
    url: str = ""
    color: str = "blue"
    excerpt: str = ""
    undated: bool = False
    note: str = ""            # e.g. pasted text: "Blindspot can't confirm this text came from that page."
    live_checked: bool = False  # pasted text whose URL could also be read live


class Evidence(BaseModel):
    source: str
    value: str
    quote: str
    quote_match: int = Field(ge=0, le=100)
    date: str = ""
    url: str = ""
    confirmed_live: bool = False  # pasted quote also found on the live page at its URL


class Finding(BaseModel):
    id: str
    title: str
    category: str
    status: Status
    critical: bool
    summary: str
    value: str
    sources: list[Evidence] = Field(default_factory=list)
    note: str = ""
    note_is_ai: bool = True
    undated: bool = False


class Blocker(BaseModel):
    finding_id: str
    status: Status


class KeyFact(BaseModel):
    finding_id: str
    title: str
    value: str
    sources: list[str]


class UnansweredQuestion(BaseModel):
    finding_id: str
    question: str


class ChecklistItem(BaseModel):
    id: str
    text: str
    why: str
    where: str
    critical: bool


class DnaPair(BaseModel):
    a: str
    b: str
    overlap: int = Field(ge=0, le=100)
    relation: Literal["copied", "overlap", "independent"]
    shared_sentences: list[str] = Field(default_factory=list)
    shared_count: int = 0


class SourceDNA(BaseModel):
    pairs: list[DnaPair] = Field(default_factory=list)
    clusters: list[list[str]] = Field(default_factory=list)
    note: str = ""
    illustrative: bool = False


class InvestigationResult(BaseModel):
    investigation_id: str
    title: str
    question: str = ""
    context: Context
    coverage: int = Field(ge=0, le=100)
    verdict: Verdict
    blockers: list[Blocker]
    sources: list[SourceOut]
    findings: list[Finding]
    key_facts: list[KeyFact]
    unanswered_questions: list[UnansweredQuestion]
    checklist: list[ChecklistItem]
    generated_at: str
    mode: Mode
    warnings: list[str] = Field(default_factory=list)
    source_dna: SourceDNA | None = None


class PipelineEvent(BaseModel):
    step: Step
    progress: int = Field(ge=0, le=100)
    message: str
    detail: dict = Field(default_factory=dict)


# ---------- Helpers ----------

class EmailRequest(BaseModel):
    points: list[str] = Field(default_factory=list, max_length=12)
    question: str = ""
    year: str = ""
    blockers: list[Blocker | dict] = Field(default_factory=list)
    topic: str = ""
    finding_title: str = ""
    finding_note: str = ""


class EmailResponse(BaseModel):
    subject: str
    body: str
    is_ai: bool = True


class TranslateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=8000)
    language: Literal["hi"] = "hi"


class ReportTranslateRequest(BaseModel):
    investigation_id: str = Field(min_length=1, max_length=40)
    lang: Literal["hi"] = "hi"
    items: dict[str, str] = Field(max_length=400)


class ReportTranslateResponse(BaseModel):
    translations: dict[str, str]
    cached: bool = False
    available: bool = True
    is_ai: bool = True
    reason: str = ""


class TranslationBatch(BaseModel):
    t: dict[str, str]


class TranslateResponse(BaseModel):
    translated_text: str
    is_ai: bool = True
    available: bool = True


class ErrorBody(BaseModel):
    code: str
    message: str
