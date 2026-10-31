"""One tiny request per Gemini model: shows which work, and for failures the exact quota that was hit.
Usage: .venv/Scripts/python -m scripts.model_probe   (reads GEMINI_API_KEY from backend/.env; never prints it)
"""
import re
import time

from google import genai

from app.config import get_settings

MODELS = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-2.5-flash", "gemini-2.5-flash-lite"]


def main() -> None:
    client = genai.Client(api_key=get_settings().gemini_api_key)
    for model in MODELS:
        started = time.time()
        try:
            out = client.models.generate_content(model=model, contents="Reply with the single word: ok")
            print(f"OK    {model:<26} {time.time() - started:.1f}s  -> {(out.text or '').strip()[:20]!r}")
        except Exception as err:  # noqa: BLE001 - diagnostic script
            text = str(err)
            code = re.search(r"\b(4\d\d|5\d\d)\b", text)
            quota = re.findall(r"quota(?:Metric|Id|Value)?['\"]?:?\s*['\"]?([^'\",\n]{5,120})", text)
            retry = re.search(r"retry in ([\d.]+)s", text)
            per_day = "PerDay" in text
            per_min = "PerMinute" in text
            print(f"FAIL  {model:<26} HTTP {code.group(1) if code else '?'}  per-day={per_day} per-minute={per_min}  retry-in={retry.group(1) + 's' if retry else 'n/a'}")
            for q in quota[:3]:
                print("        ", q.strip())


if __name__ == "__main__":
    main()
