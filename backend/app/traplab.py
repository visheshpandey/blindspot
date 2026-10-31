"""Trap Lab: five small test pages with planted traps, hosted inside Blindspot.

They live under the reserved `.example` domain (RFC 2606), so they can never be confused with a real site.
The pipeline reads them through the normal fetcher (robots check, text extraction, size cap), the AI reads
them, and code checks every quote, exactly as for a real page. Only the network hop is in-process, which makes
the live demo independent of slow or blocked government sites.
"""
from __future__ import annotations

from urllib.parse import urlsplit

import httpx

DOMAIN = "traplab.example"
# Trap hosts "resolve" to this public address only to pass the SSRF check. It is never contacted, because
# TrapTransport answers trap hosts in-process.
PINNED_IP = "93.184.216.34"
TIERS = {"official": "Primary", "college": "Institutional", "blog": "Secondary", "news": "Secondary", "forum": "Secondary"}

QUESTION = ("Before applying for the post-matric scholarship, what should I verify about eligibility, domicile, "
            "income documents, the deadline, the scholarship amount and renewal?")

_STYLE = "<style>body{font-family:system-ui;max-width:720px;margin:32px auto;padding:0 16px;line-height:1.6;color:#222}" \
         ".lab{background:#fff3cc;border:2px dashed #b58a00;padding:8px 12px;border-radius:8px;font-size:14px}</style>"
_BANNER = "<p class='lab'>Blindspot Trap Lab test page. Invented for a demo; not real scholarship guidance.</p>"


def _page(title: str, body: str) -> str:
    return f"<!doctype html><html lang='en'><head><meta charset='utf-8'><title>{title}</title>{_STYLE}</head><body>{_BANNER}<h1>{title}</h1>{body}</body></html>"


PAGES: dict[tuple[str, str], str] = {
    ("official", "/notice-2026-27"): _page("Post-Matric Scholarship Notice 2026-27 (Trap Lab Department of Welfare)", """
<p>Applications are invited for the Post-Matric Scholarship for the academic session 2026-27.</p>
<h2>Eligibility</h2>
<p>Students whose parents' or guardians' annual income from all sources does not exceed Rs 2,50,000 are eligible for the 2026-27 session.
Students must be enrolled in a recognised post-matriculation course such as Class 11, an undergraduate degree or a diploma.</p>
<h2>Documents required</h2>
<p>An income certificate issued by the Tehsildar for the 2026-27 session is mandatory. Self-declaration of income is not accepted.
Applicants must also upload a caste certificate, the previous year's mark sheet and Aadhaar-seeded bank account details.</p>
<h2>Last date</h2>
<p>The last date to submit the online application for the 2026-27 session is 30 November 2026. Incomplete applications will be rejected.</p>
<p>For help, write to the scholarship helpdesk at help@traplab.example.</p>
"""),
    ("official", "/notice-2025-26"): _page("Post-Matric Scholarship Notice 2025-26 (Trap Lab Department of Welfare)", """
<p>Applications are invited for the Post-Matric Scholarship for the academic session 2025-26.</p>
<h2>Amount of scholarship</h2>
<p>For the 2025-26 session, day scholars receive a maintenance allowance of Rs 1,200 per month and hostellers receive Rs 2,500 per month,
in addition to reimbursement of compulsory non-refundable fees.</p>
<h2>Last date</h2>
<p>The last date to submit the online application for the 2025-26 session is 31 October 2025.</p>
<p>Students whose parents' annual income does not exceed Rs 2,50,000 are eligible for the 2025-26 session.</p>
"""),
    ("blog", "/scholarship-guide"): _page("Post Matric Scholarship 2026-27: Easy Guide (Trap Lab Study Blog)", """
<p>Good news for students applying in 2026-27! The post matric scholarship process has become very simple this year and many students
are applying from their phones. Here is everything you need to know before you apply, in simple words.</p>
<p>For the 2026-27 session you do not need to visit the tehsil office at all, because a self-declaration of income is enough and no income certificate is needed.
Just fill the online form and upload your mark sheet and caste certificate along with the self-declaration.</p>
"""),
    ("news", "/scholarship-news"): _page("Scholarship update for 2026-27 students (Trap Lab Daily News)", """
<p>The post matric scholarship process has become very simple this year and many students are applying from their phones.
Here is everything you need to know before you apply, in simple words.</p>
<p>For the 2026-27 session you do not need to visit the tehsil office at all, because a self-declaration of income is enough and no income certificate is needed.
Just fill the online form and upload your mark sheet and caste certificate along with the self-declaration.</p>
"""),
    ("forum", "/thread-domicile"): _page("Do I need a domicile certificate? (Trap Lab Student Forum)", """
<p>Question from a student: do I need a domicile certificate for the post-matric scholarship in 2026-27?</p>
<p>Reply: In Rajasthan, applicants for the 2026-27 post-matric scholarship must upload a Rajasthan domicile certificate, otherwise the application is rejected.
I applied from Jaipur last week and the portal asked for it at the final step.</p>
<p>Another reply: Thanks, this saved me a trip. The rules seem different in every state so check your own state's notice before applying.</p>
"""),
}

ROBOTS = "User-agent: *\nAllow: /\n"

#: "The authority updates the notice": flips the official 2026-27 deadline, so a re-check shows a real change.
STATE = {"updated": False}
_OLD_DEADLINE = "30 November 2026"
_NEW_DEADLINE = "15 December 2026"

#: The five URLs a Trap Lab case uses, in the order they appear in the form.
URLS = [
    f"https://official.{DOMAIN}/notice-2026-27",
    f"https://official.{DOMAIN}/notice-2025-26",
    f"https://blog.{DOMAIN}/scholarship-guide",
    f"https://news.{DOMAIN}/scholarship-news",
    f"https://forum.{DOMAIN}/thread-domicile",
]

#: What each trap should produce, so the report can show a scorecard computed from the real result.
TRAPS = [
    {"id": "conflict", "label": "Blog says self-declaration is enough; the official notice says an income certificate is mandatory", "expect": "conflict"},
    {"id": "outdated", "label": "The scholarship amount appears only in last year's (2025-26) notice", "expect": "outdated"},
    {"id": "gap", "label": "No page says how the scholarship is renewed", "expect": "missing"},
    {"id": "copied", "label": "The news page copies the blog word for word", "expect": "copied"},
    {"id": "state", "label": "The domicile rule found is for Rajasthan, not Madhya Pradesh", "expect": "unverified"},
]


def is_trap_host(host: str) -> bool:
    host = (host or "").lower().rstrip(".")
    return host == DOMAIN or host.endswith(f".{DOMAIN}")


def uses_traplab(urls: list[str]) -> bool:
    return any(is_trap_host(urlsplit(u).hostname or "") for u in urls)


def tier_for(host: str) -> str | None:
    if not is_trap_host(host):
        return None
    return TIERS.get(host.split(".")[0], "Secondary")


def page_html(host: str, path: str) -> str | None:
    html = PAGES.get((host.split(".")[0], path.rstrip("/") or "/"))
    if html and STATE["updated"] and host.startswith("official.") and "notice-2026-27" in path:
        html = html.replace(_OLD_DEADLINE, _NEW_DEADLINE)
    return html


def resolver(fallback):
    """Trap hosts resolve to a fixed public address (never contacted); everything else uses the real resolver."""
    def resolve(host: str, port: int) -> list[str]:
        return [PINNED_IP] if is_trap_host(host) else fallback(host, port)
    return resolve


class TrapTransport(httpx.AsyncBaseTransport):
    """Answers trap hosts in-process (by Host header); passes every other request to the real network."""

    def __init__(self) -> None:
        self._real = httpx.AsyncHTTPTransport()

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        host = request.headers.get("host", "").split(":")[0]
        if not is_trap_host(host):
            return await self._real.handle_async_request(request)
        if request.url.path == "/robots.txt":
            return httpx.Response(200, headers={"content-type": "text/plain"}, text=ROBOTS)
        html = page_html(host, request.url.path)
        if html is None:
            return httpx.Response(404, headers={"content-type": "text/html"}, text="<h1>Not found</h1>")
        return httpx.Response(200, headers={"content-type": "text/html; charset=utf-8"}, text=html)

    async def aclose(self) -> None:
        await self._real.aclose()
