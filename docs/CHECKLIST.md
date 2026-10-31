# Blindspot: Checklist

Tick items as they are done. A feature is done only when it meets the Definition of Done in `RULES.md` §11.

## 0. Setup
- [x] Frontend copied to `frontend/` (no node_modules), `npm run build` passes
- [x] `backend/` skeleton folders, `docs/`, `.gitignore`, `.env.example`, `git init`
- [x] PRD, ARCHITECTURE, PLAN, RULES, CHECKLIST written
- [x] Gemini key obtained; current Flash model name checked; one test request succeeds
- [ ] (Optional) Groq key; one test request succeeds
- [ ] Public GitHub repo created and pushed

## 1. Backend endpoints
- [x] `GET /health`
- [x] `GET /sample`: cached scholarship result, `mode: "demo"`
- [x] `POST /analyze` → `{investigation_id}` with input validation
- [x] `GET /analyze/{id}/events`: SSE with replay, all 9 steps + `done`/`error`
- [x] `GET /analyze/{id}`: full result / running / 404
- [x] `POST /email`: draft only, never sends; accepts `{question, year, blockers, topic}`
- [x] `POST /translate`: simple Hindi, `is_ai: true`
- [x] CORS from `ALLOWED_ORIGINS`; friendly error body everywhere

## 2. Pipeline modules
- [x] `fetch.py`: httpx + trafilatura, 12s timeout, honest UA, robots.txt, pasted override, Blocked handling, 10-min cache
- [x] `classify.py`: Primary/Institutional/Secondary/Unverified + cycle/date detection + `normalise_cycle`
- [x] `checklist.py`: 6–10 items, ≥ 3 critical, static fallback
- [x] `extract.py`: per source, exact-quote prompt, ~12k token keyword-prioritised truncation
- [x] `verify.py`: normalise + `partial_ratio ≥ 85`, min length, drop unmatched
- [x] `compare.py`: context lock, authority, missing vs unverified, LLM judge only for ambiguous pairs
- [x] `score.py`: coverage, blockers, verdict (pure)
- [x] `actions.py`: verify-next, unanswered questions, notes; template fallback
- [x] `llm.py`: Gemini JSON mode, Pydantic validation, 1 retry, Groq fallback, cache
- [x] Result cache by (question, context, source hash)

## 3. Tests (pytest)
- [x] verify: exact quote accepted
- [x] verify: minor whitespace / curly quotes / ₹ variants accepted
- [x] verify: fabricated quote rejected
- [x] score: sample → 67% coverage, 3 blockers, "Not ready to decide"
- [x] score: all supported → "Ready to decide"; unverified only → "Proceed with caution"
- [x] classify: domain tiers; blocked → Unverified; cycle regex + normalisation
- [x] compare: context lock (old cycle → outdated, not conflict)
- [x] compare: Primary over Secondary (value = Primary, status conflict, Secondary kept)
- [x] compare: unreadable-only → unverified; readable but absent → missing
- [x] API contract: `/sample` validates against `InvestigationResult`
- [x] API: `/analyze` events end in `done` (LLM mocked)

## 4. Frontend pages
- [x] Overview: hero, 3D preview, Start, Explore sample, recent from localStorage + Sample-marked sample, computed stats only
- [x] New investigation: question, context lock, ≤ 5 URLs, per-URL "Paste text instead", inline validation, Investigate + Try sample
- [x] Analyzing: SSE-driven 3D town, Jasoos Jr. walk, speech bubble, crayon-tick step list, 2D fallback
- [x] Report (Town view): house per finding, 5 status effects, HUD (coverage, blockers, verdict, Verify next), click → fly + drawer
- [x] Report (Table view): stats, filters, blockers, source register, verify next, restyled
- [x] Evidence drawer: status + CRITICAL, value, side-by-side quotes, credibility, date, highlighted quote, QUOTE FOUND IN SOURCE + %, Open source ↗, AI note box, Copy evidence, Ask authority
- [x] Case history from localStorage
- [x] Jasoos Jr. built from primitives; old mascot removed

## 5. PS compliance (each visible in the UI)
- [x] Enter question / research goal
- [x] Add sources (URLs + pasted text) · stretch "Suggest sources" not built
- [x] Key facts found card
- [x] Potential gaps and unanswered questions card
- [x] Contradictions with side-by-side references
- [x] Outdated status + Undated badge
- [x] Prioritised verify-next checklist
- [x] Sourced vs AI vs uncertainty legend; purple "AI suggestion · may be wrong" boxes
- [x] Copy uses "Potential gap", "Possible conflict", "Possibly outdated", "Could not verify"

## 6. Actions
- [x] Draft query email modal (editable, copy, never sends)
- [x] Export report (print stylesheet)
- [x] Hindi toggle via `/translate`, AI-labelled
- [x] Sample data badge + "Sample data, illustrative" labels in demo mode

## 7. Known bug fixes
- [x] `data.js` `initialHistory` 75% → 67%
- [x] `api.js` demo fallback 75 → 67
- [x] `ReportPage` default coverage 75 → from result
- [x] Verdict/blockers computed by backend rules (unverified ≠ blocker)
- [x] "Saved findings" and "Source DNA" disabled with a "Soon" tooltip
- [x] Mobile hero mascot overlapping chips
- [x] Fake "University admission… 88%" history entry removed/marked sample
- [x] Invented stats (03 / 12 / 09) computed or removed
- [x] "MATCHED" → "QUOTE FOUND IN SOURCE"; "ANALYST NOTE" → "AI suggestion · may be wrong"
- [x] "SHINCHAN WORLD" copy → "Blindspot Detective Club"

## 8. Quality bar
- [x] 375 / 768 / 1440 px, no horizontal scroll
- [x] `prefers-reduced-motion`: static town, no swoops
- [x] Keyboard: house list, focus-trapped drawer, Esc closes
- [x] Status never by colour alone · [ ] formal AA contrast audit still to run
- [x] three.js code-split; one shadow light; DPR ≤ 2; RAF paused when hidden
- [x] Loading / empty / error states for every API call; friendly copy

## 9. Verification
- [x] `pytest` all green
- [x] Live run on 2–3 real public pages saved (`docs/live-run.json`) and quoted in the README
- [x] `npm run build` passes
- [x] Playwright screenshots: overview, new, analyzing, town, table, drawer, mobile; console clean

## 10. Submission
- [x] README: problem/users, USP paragraphs, Mermaid diagram, AI-vs-code steps, statuses + scoring rules, setup, demo mode, screenshots, limitations, future work, Decisions, AI-usage disclosure, credits
- [x] `SUBMISSION.md` (problem, solution, how it works, features, uniqueness, stack, future scope)
- [ ] Repo public and accessible
- [ ] Optional: live demo link · demo video · PPT
- [ ] Submitted on Unstop before 1 Nov 17:00 IST
