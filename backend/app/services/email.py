"""Email drafting helpers. Blindspot only drafts; it never sends."""
from __future__ import annotations

from ..models import EmailRequest, EmailResponse

_BLOCKER_PHRASES = {
    "conflict": "sources disagree on",
    "outdated": "I could only find old-cycle information on",
    "missing": "I could not find information on",
    "unverified": "I could not check",
}


def short_subject(text: str, limit: int = 70) -> str:
    """Shorten on a word boundary, without a trailing ellipsis or dangling punctuation."""
    text = " ".join(text.split()).rstrip("?.! ")
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0].rstrip(",;:-– ")


def collect_points(req: EmailRequest) -> list[str]:
    """The questions to put to the authority, from whichever fields the client sent."""
    points = [p.strip() for p in req.points if p.strip()]
    if not points and req.finding_title:
        points.append(f"{req.finding_title}: {req.finding_note}".strip(": "))
    for blocker in ([] if req.points else req.blockers):
        data = blocker if isinstance(blocker, dict) else blocker.model_dump()
        label = _BLOCKER_PHRASES.get(data.get("status", ""), "please clarify")
        points.append(f"{label.capitalize()} {str(data.get('finding_id', '')).replace('-', ' ')}.")
    return points


def template_draft(req: EmailRequest, points: list[str]) -> EmailResponse:
    """The draft used when the AI is unavailable (labelled is_ai=False)."""
    topic = req.topic or req.question or "my application"
    numbered = "\n".join(f"{i}. {p}" for i, p in enumerate(points, 1)) or "1. Please confirm the current eligibility rules, documents and deadline."
    body = (f"Dear Sir/Madam,\n\nI am preparing my application regarding: {topic}"
            f"{f' for the {req.year} cycle' if req.year else ''}. I would be grateful if you could clarify the following:\n\n"
            f"{numbered}\n\nCould you also share a link to the latest official guidelines?\n\nThank you for your help.\n\n"
            "[Your name]\n[Application / enrolment number, if any]")
    return EmailResponse(subject=f"Request for clarification: {short_subject(topic)}", body=body, is_ai=False)
