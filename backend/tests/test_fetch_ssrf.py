import httpx
import pytest

from app.pipeline.fetch import NOT_ALLOWED, UnsafeURL, check_url, fetch_all, ip_is_public, safe_get


def public(host, port):
    return ["93.184.216.34"]


def resolves_to(ip):
    return lambda host, port: [ip]


@pytest.mark.parametrize("url", [
    "https://169.254.169.254/latest/meta-data/",   # cloud metadata (link-local)
    "https://127.0.0.1:443/",                       # loopback
    "https://127.0.0.1:5173/",                      # loopback + non-web port
    "https://10.0.0.5/", "https://192.168.1.1/", "https://172.16.0.1/",  # private
    "https://[::1]/", "https://[fe80::1]/", "https://[fc00::1]/",       # IPv6 loopback, link-local, unique-local
    "https://[::ffff:127.0.0.1]/",                  # IPv4-mapped IPv6
    "https://224.0.0.1/", "https://[ff02::1]/",     # multicast
    "https://0.0.0.0/", "https://[::]/",            # unspecified
    "https://240.0.0.1/",                           # reserved
    "https://localhost/", "https://app.localhost/", "https://metadata.google.internal/",
    "https://2130706433/", "https://0177.0.0.1/", "https://0x7f000001/", "https://0x7f.0.0.1/", "https://127.1/",  # obfuscated IPs
    "https://example.com:8080/", "https://example.com:22/",                     # non-web ports
    "ftp://example.com/", "file:///etc/passwd", "javascript:alert(1)",          # non-web schemes
    "https://user:pass@example.com/",                                           # credentials
])
def test_blocked_urls(url):
    with pytest.raises(UnsafeURL):
        check_url(url, public)


def test_hostname_resolving_to_private_ip_is_blocked():
    with pytest.raises(UnsafeURL):
        check_url("https://evil.example/", resolves_to("10.1.2.3"))


def test_any_private_answer_blocks_even_with_a_public_one():
    with pytest.raises(UnsafeURL):
        check_url("https://evil.example/", lambda h, p: ["93.184.216.34", "127.0.0.1"])


def test_public_address_is_allowed_and_pinned():
    target = check_url("https://scholarships.gov.in/", public)
    assert target.ip == "93.184.216.34" and target.port == 443 and target.host == "scholarships.gov.in"
    assert ip_is_public("8.8.8.8") and not ip_is_public("169.254.169.254")


async def test_redirect_to_internal_address_is_blocked():
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(str(request.url))
        return httpx.Response(302, headers={"location": "https://127.0.0.1/admin"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(UnsafeURL):
            await safe_get(client, "https://good.example/", public)
    assert len(seen) == 1  # the internal hop was never requested


async def test_connection_goes_to_the_validated_ip_with_original_host():
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["host"] = request.headers["host"]
        captured["sni"] = request.extensions.get("sni_hostname")
        return httpx.Response(200, headers={"content-type": "text/html"}, content=b"<p>ok</p>")

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        resp, body, final = await safe_get(client, "https://good.example/page", public)
    assert captured["url"] == "https://93.184.216.34/page"
    assert captured["host"] == "good.example" and captured["sni"] == "good.example"
    assert body == b"<p>ok</p>" and final == "https://good.example/page"


async def test_too_many_redirects_are_refused():
    def handler(request):
        return httpx.Response(302, headers={"location": "https://good.example/again"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(UnsafeURL):
            await safe_get(client, "https://good.example/", public)


async def test_response_size_is_capped(monkeypatch):
    import app.pipeline.fetch as fetch
    monkeypatch.setattr(fetch, "MAX_BYTES", 1000)

    def handler(request):
        return httpx.Response(200, headers={"content-type": "text/html"}, content=b"x" * 5000)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        _, body, _ = await safe_get(client, "https://good.example/", public)
    assert len(body) == 1000


async def test_blocked_source_does_not_fail_the_run():
    requested = []

    def handler(request):
        requested.append(str(request.url))
        if request.url.path == "/robots.txt":
            return httpx.Response(404)
        page = "<html><body>" + "<p>Public scholarship information for students in Madhya Pradesh.</p>" * 10 + "</body></html>"
        return httpx.Response(200, headers={"content-type": "text/html"}, content=page.encode())

    def resolver(host, port):
        return ["93.184.216.34"] if host == "good.example" else ["169.254.169.254"]

    sources = await fetch_all(["https://169.254.169.254/latest/meta-data/", "https://127.0.0.1:5173/", "https://good.example/"], {},
                              resolve=resolver, transport=httpx.MockTransport(handler))
    assert [s.state for s in sources] == ["Blocked", "Blocked", "Readable"]
    assert sources[0].error == NOT_ALLOWED and sources[1].error == NOT_ALLOWED
    assert all("169.254" not in u and "127.0.0.1" not in u for u in requested)
