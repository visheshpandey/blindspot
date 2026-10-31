# Blindspot: Build Plan

Coding window: **Sat 31 Oct 10:00 → Sun 1 Nov 10:00 IST (24h)**. Submission closes **1 Nov 17:00 IST**.
Principle: **a polished core workflow beats many unfinished features.** Pipeline and report first; 3D extras after.

## Timeline at a glance

| # | Step | Budget | Target finish (IST) |
|---|---|---|---|
| 0 | Setup + docs (this phase) | done before the window | 30 Oct |
| 1 | Backend skeleton, models, `/sample`, frontend wired | 1.5h | Sat 11:30 |
| 2 | fetch + classify, pasted text, blocked handling | 2h | Sat 13:30 |
| 3 | checklist + extract + verify (+ tests) | 3h | Sat 16:30 |
| 4 | compare + score + actions (+ tests), `/analyze` + SSE | 3h | Sat 19:30 |
| ★ | **Demo-safe checkpoint:** live run works, table report renders real results | (none) | Sat 20:00 |
| 5 | Analyzing page (SSE + mascot walk) | 2h | Sat 22:00 |
| 6 | TownScene port + drawer + town/table toggle | 4h | Sun 02:00 |
| 7 | Table restyle, email modal, Hindi, export, bug fixes | 3h | Sun 05:00 |
| 8 | Accessibility, reduced motion, mobile, performance | 2h | Sun 07:00 |
| 9 | Tests green, Playwright screenshots, README, `.env.example` | 2h | Sun 09:00 |
| (none) | Buffer | 1h | Sun 10:00 |
| S | Submission: SUBMISSION.md, demo script, deploy, video, PPT | after coding | Sun 16:00 |

If behind schedule at ★, cut in this order: Hindi toggle → AnalyzingScene 3D (keep the 2D step list) → town status effects beyond colour + label → "Suggest sources".

---

## Step 1: Backend skeleton + `/sample`
**Goal:** the frontend renders the sample from the backend.
**Files:** `backend/requirements.txt`, `app/main.py`, `app/models.py`, `app/config.py`, `app/samples/scholarship.json`, `tests/test_contract.py`; `frontend/src/lib/api.js`, `frontend/src/data.js` (fix 75→67), `frontend/.env`.
**Done when:** `uvicorn app.main:app` serves `/health` and `/sample`; `/sample` validates against `InvestigationResult`; the frontend "Try sample" loads it with the Sample data badge.
**Commit:** `Add FastAPI skeleton, result models and /sample endpoint`

## Step 2: fetch + classify
**Goal:** turn URLs/pasted text into classified sources.
**Files:** `pipeline/fetch.py`, `pipeline/classify.py`, `app/cache.py`, `tests/test_classify.py`, `tests/test_fetch.py` (mocked httpx).
**Done when:** a blocked URL gives `Blocked/Unverified`; pasted text gives `Pasted`; gov.in gives Primary; cycles detected and normalised; one real fetch of a public page works (manual check).
**Commit:** `Add source fetching and credibility classification`

## Step 3: checklist + extract + verify
**Goal:** verified claims per checklist item.
**Files:** `app/llm.py`, `app/prompts/{checklist,extract}.md`, `pipeline/{checklist,extract,verify}.py`, `tests/test_verify.py`.
**Done when:** one Gemini test request succeeds (logged); invalid JSON retry tested with a stub; fabricated quote is rejected; whitespace variants accepted.
**Commit:** `Add checklist, extraction and quote verification`

## Step 4: compare + score + actions, full `/analyze`
**Goal:** end-to-end live analysis via SSE.
**Files:** `pipeline/{compare,score,actions,__init__}.py`, `app/jobs.py`, `app/prompts/{judge,actions,email,translate}.md`, `main.py` routes, `tests/test_score.py`, `tests/test_compare.py`, `tests/test_api.py`.
**Done when:** sample findings → 67% / 3 blockers / Not ready; context-lock and Primary-over-Secondary tests pass; `/analyze` + events end with `done`; `/email` and `/translate` work with fallbacks; a live run on 2–3 real pages is saved to `docs/live-run.json`.
**Commit:** `Add comparison rules, scoring, actions and streaming /analyze`

## ★ Demo-safe checkpoint
Push to GitHub (public). From here on, the project is submittable even if later steps slip.

## Step 5: Analyzing page
**Files:** `pages/Analyzing.jsx`, `three/townKit.js` (extracted from `World3D.jsx`), `three/JasoosJr.js`, `three/AnalyzingScene.jsx`, `lib/api.js` (`streamEvents`).
**Done when:** steps tick as SSE events arrive; Jasoos Jr. walks between houses; the speech bubble shows the message; WebGL off → 2D list; then auto-navigates to the report.
**Commit:** `Add Analyzing page with live pipeline steps and Jasoos Jr.`

## Step 6: TownScene + drawer
**Files:** `three/TownScene.jsx`, `components/EvidenceDrawer.jsx`, `components/ConflictCompare.jsx`, `components/QuoteStamp.jsx`, `components/AiNote.jsx`, `pages/Report.jsx`.
**Done when:** one house per finding with its status effect; click → camera flies → drawer opens; HUD shows coverage/blockers/verdict; town/table toggle; house list for keyboard; old mascot removed from `World3D.jsx`.
**Commit:** `Add findings-driven TownScene and evidence drawer`

## Step 7: Table restyle + actions + bug fixes
**Files:** `components/{FindingsTable,KeyFacts,UnansweredQuestions,VerifyNext,Legend,BlockersPanel,SourceRegister,EmailModal,SampleBadge}.jsx`, `styles/{tokens,print}.css`, `lib/history.js`, `pages/{Overview,History}.jsx`, `components/Sidebar.jsx`.
**Done when:** Key facts, Unanswered questions, Legend, Undated badge visible; email modal calls `/email`; Hindi toggle calls `/translate` with AI labels; Export prints cleanly; all 8 known bugs fixed (see CHECKLIST).
**Commit:** `Restyle report, add key facts, gaps, legend, email, Hindi and export`

## Step 8: Quality pass
**Done when:** 375/768/1440 layouts clean; reduced motion gives a static town; focus trap + Esc; AA contrast checked; three.js in its own chunk; DPR ≤ 2; one shadow light.
**Commit:** `Accessibility, reduced motion, mobile and performance pass`

## Step 9: Verify + document
**Done when:** `pytest` green; `npm run build` green; Playwright screenshots in `docs/screenshots/` (overview, new, analyzing, town, table, drawer, mobile) with a clean console; README complete; `.env.example` final.
**Commit:** `Add README, screenshots and final env example`

## Submission block
- `SUBMISSION.md`: problem, solution, how it works, features, uniqueness, tech stack, future scope.
- Optional: deploy (frontend on Vercel/Netlify, backend on Render/Railway free tier; confirm free tier with the user), demo video, PPT.
- Repo public; README links work; the judge can run `Try sample` without keys.
