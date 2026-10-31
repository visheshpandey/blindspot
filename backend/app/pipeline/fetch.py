"""Fetch source pages (or use pasted text) safely and extract readable text.

SSRF protection: every URL (and every redirect hop) is checked before any request is made.
- only http/https on ports 80/443;
- no localhost / *.localhost / metadata hosts, and no numeric or obfuscated IP forms (decimal, octal, hex);
- the hostname is resolved once and every resolved IP must be public (not private, loopback, link-local,
  multicast, reserved or unspecified, for IPv4 and IPv6);
- the connection goes to that validated IP (with the original Host header and TLS SNI), so a DNS answer
  that changes between check and connect (DNS rebinding) has no effect;
- redirects are followed by hand, at most 5 hops, re-checking each one;
- responses are capped at 5 MB.
"""
from __future__ import annotations

import asyncio
import ipaddress
import re
import socket
from dataclasses import dataclass
from typing import Callable
from urllib import robotparser
from urllib.parse import urljoin, urlsplit, urlunsplit

import httpx
import trafilatura
from bs4 import BeautifulSoup

from .. import cache
from ..traplab import is_trap_host
from ..config import get_settings
from ..models import FetchedSource
from .classify import host_of

MIN_TEXT_CHARS = 200
MAX_BYTES = 5 * 1024 * 1024
MAX_REDIRECTS = 5
ALLOWED_PORTS = {80, 443}
BLOCKED_HOSTS = {"localhost", "metadata.google.internal", "metadata", "instance-data"}
NOT_ALLOWED = "Could not read — this address isn't allowed."

Resolver = Callable[[str, int], list[str]]


class UnsafeURL(ValueError):
    """The URL points somewhere Blindspot must never fetch."""


def _system_resolve(host: str, port: int) -> list[str]:
    infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    return list(dict.fromkeys(info[4][0] for info in infos))


def _looks_numeric(host: str) -> bool:
    """True for IP literals written in unusual forms: 2130706433, 0177.0.0.1, 0x7f.1, 127.1 and the like."""
    labels = host.split(".")
    return all(re.fullmatch(r"0x[0-9a-f]*|[0-9]+", label) for label in labels if label) and not _is_canonical_ipv4(host)


def _is_canonical_ipv4(host: str) -> bool:
    parts = host.split(".")
    return len(parts) == 4 and all(p.isdigit() and (p == "0" or not p.startswith("0")) and int(p) <= 255 for p in parts)


def ip_is_public(ip_text: str) -> bool:
    ip = ipaddress.ip_address(ip_text.split("%")[0])
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    return not (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved or ip.is_unspecified)


@dataclass
class SafeTarget:
    url: str
    host: str
    port: int
    ip: str


def check_url(url: str, resolve: Resolver = _system_resolve) -> SafeTarget:
    """Validate a URL and resolve it to one public IP. Raises UnsafeURL with a short reason."""
    parts = urlsplit(url)
    if parts.scheme not in {"http", "https"}:
        raise UnsafeURL("Only web addresses (http/https) can be read.")
    if parts.username or parts.password:
        raise UnsafeURL("Addresses with a username or password aren't allowed.")
    host = (parts.hostname or "").strip().lower().rstrip(".")
    if not host:
        raise UnsafeURL("The address has no host name.")
    try:
        port = parts.port or (443 if parts.scheme == "https" else 80)
    except ValueError as err:
        raise UnsafeURL("The port is not valid.") from err
    if port not in ALLOWED_PORTS:
        raise UnsafeURL("Only the standard web ports (80 and 443) are allowed.")
    if host in BLOCKED_HOSTS or host.endswith(".localhost") or host.endswith(".internal"):
        raise UnsafeURL("Local and internal addresses aren't allowed.")
    if _looks_numeric(host):
        raise UnsafeURL("Numeric or disguised IP addresses aren't allowed.")
    try:
        literal = ipaddress.ip_address(host.strip("[]"))
    except ValueError:
        literal = None
    if literal is not None:
        ips = [str(literal)]
    else:
        try:
            ips = resolve(host, port)
        except (OSError, UnicodeError) as err:
            raise UnsafeURL("The site's address could not be found.") from err
    if not ips:
        raise UnsafeURL("The site's address could not be found.")
    if not all(ip_is_public(ip) for ip in ips):
        raise UnsafeURL("Private, local or reserved network addresses aren't allowed.")
    return SafeTarget(url=url, host=host, port=port, ip=ips[0])


async def safe_get(client: httpx.AsyncClient, url: str, resolve: Resolver = _system_resolve) -> tuple[httpx.Response, bytes, str]:
    """GET with SSRF checks on every hop. Returns (response, body capped at MAX_BYTES, final URL)."""
    current = url
    for _ in range(MAX_REDIRECTS + 1):
        target = await asyncio.to_thread(check_url, current, resolve)
        parts = urlsplit(current)
        ip_host = f"[{target.ip}]" if ":" in target.ip else target.ip
        default = (parts.scheme == "https" and target.port == 443) or (parts.scheme == "http" and target.port == 80)
        netloc = ip_host if default else f"{ip_host}:{target.port}"
        pinned = urlunsplit((parts.scheme, netloc, parts.path or "/", parts.query, ""))
        host_header = target.host if default else f"{target.host}:{target.port}"
        request = client.build_request("GET", pinned, headers={"Host": host_header}, extensions={"sni_hostname": target.host})
        response = await client.send(request, stream=True)
        try:
            if response.status_code in (301, 302, 303, 307, 308) and response.headers.get("location"):
                current = urljoin(current, response.headers["location"])
                continue
            body = bytearray()
            async for chunk in response.aiter_bytes():
                body.extend(chunk)
                if len(body) >= MAX_BYTES:
                    del body[MAX_BYTES:]
                    break
            return response, bytes(body), current
        finally:
            await response.aclose()
    raise UnsafeURL("The page redirected too many times.")


def _title(html: str) -> str:
    try:
        soup = BeautifulSoup(html, "html.parser")
        if soup.title and soup.title.string:
            return " ".join(soup.title.string.split())[:90]
    except Exception:  # noqa: BLE001 - malformed HTML should never break a fetch
        pass
    return ""


def html_to_text(html: str) -> str:
    text = trafilatura.extract(html, include_tables=True, include_comments=False, favor_recall=True) or ""
    if len(text) < MIN_TEXT_CHARS:
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "noscript", "nav", "footer", "header"]):
            tag.decompose()
        text = "\n".join(line.strip() for line in soup.get_text("\n").splitlines() if line.strip())
    return text


_robots: dict[str, robotparser.RobotFileParser | None] = {}


async def _allowed(client: httpx.AsyncClient, url: str, agent: str, resolve: Resolver) -> bool:
    base = urljoin(url, "/")
    if base not in _robots:
        parser: robotparser.RobotFileParser | None = robotparser.RobotFileParser()
        try:
            resp, body, _ = await safe_get(client, urljoin(base, "robots.txt"), resolve)
            if resp.status_code == 200:
                parser.parse(body.decode("utf-8", "replace").splitlines())
            else:
                parser = None
        except (httpx.HTTPError, UnsafeURL):
            parser = None
        _robots[base] = parser
    parser = _robots[base]
    return True if parser is None else parser.can_fetch(agent, url)


def _blocked(sid: str, url: str, reason: str) -> FetchedSource:
    host = host_of(url)
    return FetchedSource(id=sid, url=url, host=host, name=host or "Source", state="Blocked", error=reason)


async def fetch_one(client: httpx.AsyncClient, sid: str, url: str, pasted: str | None, resolve: Resolver = _system_resolve) -> FetchedSource:
    host = host_of(url) if url.startswith("http") else "pasted text"
    if pasted and pasted.strip():
        # Pasted text is the user's claim, not the site's. Try the live page too, so quotes can be confirmed there.
        live_text = ""
        if url.startswith("http"):
            live = await fetch_one(client, sid, url, None, resolve)
            live_text = live.text if live.state == "Readable" else ""
        name = f"Pasted text · claimed from {host}" if url.startswith("http") else "Pasted text"
        return FetchedSource(id=sid, url=url if url.startswith("http") else "", host=host if url.startswith("http") else "pasted text",
                             name=name, text=pasted.strip(), state="Pasted", claimed_host=host if url.startswith("http") else "", live_text=live_text)

    try:
        check_url(url, resolve)
    except UnsafeURL:
        return _blocked(sid, url, NOT_ALLOWED)

    lab = is_trap_host(host)  # Trap Lab pages can change on demand, so they are never served from the cache
    cached = None if lab else cache.get("fetch", cache.make_key(url))
    if cached:
        return FetchedSource(**{**cached, "id": sid})

    settings = get_settings()
    try:
        if not await _allowed(client, url, settings.user_agent, resolve):
            return _blocked(sid, url, "The site's robots.txt does not allow automated reading.")
        resp, body, final_url = await safe_get(client, url, resolve)
        if resp.status_code >= 400:
            return _blocked(sid, url, f"The site answered with an error ({resp.status_code}).")
        ctype = resp.headers.get("content-type", "")
        if "html" not in ctype and "text" not in ctype:
            return _blocked(sid, url, "This page is not a web page Blindspot can read (for example a PDF). Paste its text instead.")
        html = body.decode(resp.encoding or "utf-8", "replace")
        text = html_to_text(html)
        if len(text) < MIN_TEXT_CHARS:
            return _blocked(sid, url, "The page had almost no readable text. It may need JavaScript or a login. Paste its text instead.")
        source = FetchedSource(id=sid, url=final_url, host=host, name=_title(html) or host, text=text, state="Readable")
        if not lab:
            cache.put("fetch", cache.make_key(url), source.model_dump())
        return source
    except UnsafeURL:
        return _blocked(sid, url, NOT_ALLOWED)
    except httpx.TimeoutException:
        return _blocked(sid, url, "The site took too long to respond.")
    except httpx.HTTPError:
        return _blocked(sid, url, "The site could not be reached.")


async def fetch_all(urls: list[str], pasted: dict[str, str], resolve: Resolver = _system_resolve,
                    transport: httpx.AsyncBaseTransport | None = None, on_done=None) -> list[FetchedSource]:
    """Fetch every source in parallel. `on_done(source)` (async) is called as each one finishes, for live progress."""
    settings = get_settings()
    entries: list[tuple[str, str | None]] = [(u, pasted.get(u)) for u in urls]
    for key, text in pasted.items():
        if key not in urls and text.strip():
            entries.append((key, text))
    entries = entries[:5]
    headers = {"User-Agent": settings.user_agent, "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5"}
    timeout = httpx.Timeout(settings.fetch_timeout)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False, headers=headers, transport=transport) as client:
        async def one(i: int, url: str, text: str | None) -> FetchedSource:
            source = await fetch_one(client, f"S{i + 1}", url, text, resolve)
            if on_done:
                await on_done(source)
            return source
        return list(await asyncio.gather(*(one(i, url, text) for i, (url, text) in enumerate(entries))))
