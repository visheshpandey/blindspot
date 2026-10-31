"""Internal pipeline models: what flows between pipeline steps. Never sent to clients as-is."""
from __future__ import annotations

from pydantic import BaseModel, Field
from .schemas import ChecklistItem, CredType, SourceState, UnansweredQuestion


# ---------- Internal pipeline models ----------

class CheckItem(BaseModel):
    id: str
    title: str
    category: str
    critical: bool
    why: str = ""


class Checklist(BaseModel):
    items: list[CheckItem] = Field(min_length=3, max_length=12)


class FetchedSource(BaseModel):
    id: str
    url: str
    host: str
    name: str
    text: str = ""
    state: SourceState
    error: str = ""
    type: CredType = "Unverified"
    date: str = ""
    cycles: list[str] = Field(default_factory=list)
    claimed_host: str = ""   # pasted text: the site the user says it came from (not trusted)
    live_text: str = ""      # pasted text: the live page at that URL, if it could be fetched
    live_type: CredType = "Unverified"  # authority of that live page

    @property
    def readable(self) -> bool:
        return self.state in ("Readable", "Pasted") and bool(self.text)


class ExtractedItem(BaseModel):
    item_id: str
    found: bool
    value: str | None = None
    exact_quote: str | None = None
    date_or_cycle: str | None = None


class Extraction(BaseModel):
    items: list[ExtractedItem]


class Claim(BaseModel):
    item_id: str
    source_id: str
    value: str
    quote: str
    quote_match: int = 0
    cycle: str = ""
    url: str = ""
    confirmed_live: bool = False
    tier: str = ""  # overrides the source's tier (a pasted quote confirmed on the live page earns that page's tier)


class ActionsOut(BaseModel):
    checklist: list[ChecklistItem]
    unanswered_questions: list[UnansweredQuestion] = Field(default_factory=list)
    notes: dict[str, str] = Field(default_factory=dict)
    summaries: dict[str, str] = Field(default_factory=dict)


class SameMeaning(BaseModel):
    same: bool
    reason: str = ""
