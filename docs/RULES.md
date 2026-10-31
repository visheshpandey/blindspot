# Blindspot: Rules

These rules apply to anyone writing code or copy for Blindspot, human or AI. When a rule and a shortcut disagree, follow the rule.

## 1. Honesty (non-negotiable)

1. **Never fake a capability.** If something is sample data, a stub or a fallback, the UI says so.
2. **Never say "verified true".** A quote existing on a page doesn't prove the claim. Use **"QUOTE FOUND IN SOURCE"** + match %.
3. **Every AI-written line** (notes, verify-next items, unanswered questions, email drafts, translations) is shown with the label **"AI suggestion · may be wrong"** in a dashed purple box or with a purple AI chip.
4. **Sample content** (quotes, URLs, dates in `scholarship.json` / `data.js`) is labelled **"Sample data, illustrative"**, and the report shows a **Sample data** badge in demo mode.
5. **An unreadable source never produces `missing`.** It produces `unverified`.
6. The README states limitations plainly.

## 2. Wording

| Never write | Write instead |
|---|---|
| Missing | Potential gap: not found in the sources reviewed |
| Conflict / Wrong | Possible conflict |
| Outdated | Possibly outdated |
| Unverified / Failed | Could not verify |
| Verified / True / Confirmed | Quote found in source |
| Raw exception text | A friendly sentence + what the user can do next |

Status *values* in code and JSON stay exactly as in §3; only the *labels* change.

## 3. Exact strings (same everywhere: Python, JSON, JS, CSS classes)

- `status`: `supported` · `conflict` · `outdated` · `missing` · `unverified`
- credibility `type`: `Primary` · `Institutional` · `Secondary` · `Unverified`
- source `state`: `Readable` · `Blocked` · `Pasted`
- `verdict`: `Not ready to decide` · `Proceed with caution` · `Ready to decide`
- `mode`: `live` · `demo`
- SSE `step`: `checklist` · `fetch` · `classify` · `extract` · `verify` · `compare` · `score` · `actions` · `done` · `error`

Define them once (`backend/app/models/schemas.py` Literals; `frontend/src/domain/status.js`) and import them; never retype.

## 4. Deterministic rules (code, not LLM)

- **Coverage** = items with ≥ 1 verified claim ÷ total items, rounded to an int %.
- **Blocker** = a critical item whose status ∈ {conflict, outdated, missing}.
- **Verdict:** any blocker → *Not ready to decide*; else any `unverified` or any non-critical non-supported item → *Proceed with caution*; else *Ready to decide*.
- **Outdated** = a claim whose cycle/year is earlier than the locked year.
- **Conflict** = ≥ 2 verified claims, same context, different meaning. Primary vs Secondary → show the Primary value, keep the Secondary visible, flag conflict.
- **Missing** = no verified claim from any readable source. If every candidate source was unreadable → `unverified`.
- **Quote match** = rapidfuzz `partial_ratio` ≥ 85 on normalised text, and quote ≥ 12 normalised chars. Below that, the claim is dropped.

The LLM may *propose* values, quotes and "same meaning?" judgments. Only code assigns statuses and scores.

## 5. LLM rules

- Every call has a Pydantic schema; output is validated; **1 retry** with the validation error; then Groq; then degrade gracefully (never crash the job).
- Extraction and judge prompts include, verbatim: **"Quote text exactly as it appears; if not present, return not_found; never infer."**
- Truncate each source to ~12k tokens, keeping paragraphs that match checklist keywords first.
- Temperature 0 for extract/judge.
- Cache by (question, context, source hash) so the demo is repeatable.
- Prompts live in `backend/app/prompts/*.md`, not inline strings.

## 6. External API rules

- External calls (web pages, Gemini, Groq, any search API) happen **only in the backend**.
- Every external call has a **10-minute cache** and a **fallback response**.
- Keys only in `backend/.env` (git-ignored); `.env.example` lists names with empty values.
- **Test each API with one request** before integrating it.
- Prefer HTTPS APIs that are free or need only a free key. **Ask the user before adding any paid service.**
- Fetching: 12s timeout, honest User-Agent, respect `robots.txt`, no login-walled or paywalled scraping, no bypassing blocks.

## 7. IP and assets

- No existing cartoon character, model, image or likeness, and no third-party character assets. "Shinchan" may appear only as the event name.
- Jasoos Jr. is built from three.js primitives in our own code.
- Fonts from Google Fonts (Baloo 2, Nunito) and lucide-react icons are fine; credit them in the README.

## 8. Ask the user before

- Adding a paid service.
- Changing the result contract (adding optional fields is fine; log it under Decisions).
- Removing an existing feature.

For anything else, make the best decision, log it in `docs/ARCHITECTURE.md` §10 / README "Decisions", and keep going.

## 9. Code style

**Python:** 3.11+, full type hints, Pydantic v2, `async` for I/O, pure functions for `verify`/`score`/`compare` rules, `ruff`-clean, pytest for every rule. Module docstrings, few comments.

**Frontend:** React function components + hooks, plain CSS with tokens (`styles/tokens.css`), lucide-react icons, no UI kit, no router/state library. One component per file under `components/` once split. Dispose every three.js geometry, material and renderer on unmount.

**Commits:** one per build step, imperative subject (`Add verify step with quote-match tests`).

## 10. UI rules

- Palette tokens: cream `#fff8ea`, ink `#1f2340`, coral `#ff6b5b`, sun `#ffd23f`, teal `#2ec4b6`, sky `#bfe6ff`.
- 3px ink outline, hard shadow `4px 4px 0 #1f2340`, radius 16–22px. Baloo 2 headings, Nunito body, monospace labels.
- **Status is never shown by colour alone:** always a text label + icon.
- AA contrast (4.5:1 text, 3:1 large text/UI).
- `prefers-reduced-motion`: no camera swoops, no auto-rotate, static effects.
- Keyboard: everything clickable in 3D is also a focusable button in a list; drawer traps focus; Esc closes it.
- Every API call has loading, empty and error states.
- Responsive at 375 / 768 / 1440 px with no horizontal scroll.

## 11. Definition of done (per feature)

Works in live mode and demo mode · has loading/empty/error states · keyboard reachable · labelled honestly · `npm run build` passes · relevant pytest green · ticked in `docs/CHECKLIST.md`.
