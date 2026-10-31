# Codebase guide

How Blindspot is organised, the rules each layer follows, and recipes for the common changes. For *what* the product does see [PRD.md](PRD.md); for the pipeline and API contract see [ARCHITECTURE.md](ARCHITECTURE.md).

## Layout

```
backend/app/
  main.py            create_app(): CORS, error handlers, mounts the routers
  config.py          Settings from backend/.env (the only place env vars are read)
  errors.py          one error shape {"error": {"code", "message"}} + handlers
  ratelimit.py       10 investigations/min per IP
  api/               routes, one router per concern (paths are unprefixed and stable)
    health.py          /health, /sample
    investigations.py  /analyze, /analyze/{id}, /events (SSE), /cancel
    language.py        /email, /translate, /translate/report
    traplab.py         /traplab, /traplab/update, /traplab/page/...
  services/          logic that is not a route or a pipeline step (email drafting, sample/demo job)
  pipeline/          the investigation: checklist -> fetch -> classify -> extract -> verify -> compare -> score -> actions
  models/            schemas.py = public API contract; pipeline.py = internal models between steps
  llm.py cache.py jobs.py traplab.py   AI client with model fallback, 10-minute cache, job store, Trap Lab test pages
  prompts/           one .md per AI call
backend/tests/       pytest (130 tests)      backend/scripts/   one-off tools (demo runs, model probe)

frontend/src/
  main.jsx           entry: root error boundary, global error logging, providers, styles
  app/               App.jsx (shell: routing + the open report + overlays), router.js (hash routes)
  pages/             one file per screen; presentational, they receive data and callbacks as props
  components/        reusable UI, grouped: common/ layout/ report/ tour/ traplab/ input/
  state/             hooks that own state and behaviour (see below)
  domain/            pure functions: statuses, diff, DNA, strength, explanations, counsellor grouping. No React, no I/O
  api/               the only code that talks to the backend (http.js, analysis.js, language.js, traplab.js, index.js)
  storage/           the only code that touches localStorage (safeStorage.js, keys.js + one module per kind of data)
  config/env.js      the only place import.meta.env is read
  hooks/             shared React hooks (accessibility, report translation)
  i18n/              en.json, hi.json, LangProvider (static UI strings; AI translates only dynamic report text)
  data/              bundled JSON: sample case, recorded demo runs, official-source suggestions
  three/             three.js scenes (lazy-loaded)      styles/   base, theme, print, polish (global CSS)
  utils/logger.js    debug() for expected failures, reportError() for real ones
frontend/scripts/    Playwright checks (see Testing)
```

## Layering rules

Frontend, from the outside in: `pages` -> `state` -> (`api`, `storage`, `domain`). Never the other way.

| Layer | May import | Must not |
|---|---|---|
| `domain/` | other `domain/`, `config/` (flags only) | React, `fetch`, `localStorage` |
| `storage/` | `domain/`, `utils/` | React, `fetch` |
| `api/` | `config/`, `domain/` (constants), `data/`, `utils/` | React, `localStorage` |
| `state/` | everything below it, React hooks | JSX |
| `components/`, `pages/` | `state` results via props, `domain/`, `hooks/`, `i18n/` | call `fetch` or `localStorage` directly |

Backend: `api/` (routes: parse, call, shape the response) -> `services/` and `pipeline/` (logic) -> `llm`, `cache`, `fetch`. Routes stay thin; business rules live in `pipeline/` (statuses, verdicts are plain code, never AI).

### State management

No state library is needed at this size. State is split by concern into hooks in `src/state/`, and `App.jsx` composes them:

| Hook | Owns |
|---|---|
| `useToast` | the single toast message |
| `useHealth` | backend and AI status |
| `useLibrary` | case history, saved findings, student tags, Demo mode |
| `useInvestigationRunner` | running, streaming, cancelling, re-checking, the form draft |
| `useRouteLoader` | loading whatever the URL points at (refresh, back/forward) |
| `useTourController` | the guided tour and its first-visit invitation |

The open report (`result`, `selected`, `email`, `savedOpen`) stays in `App.jsx` because every overlay needs it.

## Naming conventions

- **Components and pages:** `PascalCase.jsx`, one main component per file, default export. Other files: `camelCase.js`.
- **Hooks:** `useThing`. Context objects: `ThingContext`.
- **Constants:** `UPPER_SNAKE` for fixed tables (`DEMO_CASES`), `camelCase` for everything else.
- **Storage keys:** only in `storage/keys.js`, named `blindspot.<what>[.vN]`; bump `vN` when a stored shape changes.
- **API:** `getX` read, `startX` / `draftX` / `translateX` actions. Backend routes are nouns (`/analyze`), snake_case JSON fields.
- **i18n keys:** `area.name` (`status.conflict`, `report.export`), identical in `en.json` and `hi.json`.
- **CSS classes:** `kebab-case`, named for the thing (`verdict-card`), not the look.
- **Python:** `snake_case` modules and functions, `PascalCase` models, type hints on public functions.

## Error handling policy

**Frontend**
- Every `fetch` goes through `api/http.js`; failures become an `ApiError` with a user-safe message (`offline` flag for unreachable server).
- Read endpoints with a bundled fallback (`getHealth`, `getSample`) never throw. Best-effort ones (cancel, translate, email) return an `available: false` result or a local template. Only `startAnalysis` and `getResult` throw, and their caller shows the message inline.
- Expected failures (blocked storage, offline backend) are logged with `debug()`; anything else with `reportError()`.
- Render crashes: a root `ErrorBoundary` (`scope="app"`) and one per page (`scope="page:<name>"`, reset on route change). A failed lazy 3D chunk offers Reload.
- Unhandled promise rejections and window errors are logged centrally in `main.jsx`.
- localStorage is never touched directly: `storage/safeStorage.js` guards every read and write.

**Backend**
- All errors use `{"error": {"code", "message"}}` (`errors.py`). Validation errors become 422 with the first readable message; crashes become a generic 500 and the stack goes to the log, never to the client.
- AI failures never fail a request: `LLMUnavailable` leads to a labelled template or `available: false`. Fetch failures become a "Could not verify" source, never "missing".

## Configuration

| Where | Variable | Purpose |
|---|---|---|
| `backend/.env` | `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODELS` | AI; the fallback chain is tried in order on quota or overload |
| `backend/.env` | `GROQ_API_KEY`, `GROQ_MODEL` | optional second provider |
| `backend/.env` | `ALLOWED_ORIGINS` | CORS, comma-separated |
| `frontend/.env` | `VITE_API_BASE_URL` | backend URL; empty = frontend-only sample demo |

Secrets live only in `.env` files (git-ignored); `.env.example` documents every variable. Code reads them in exactly two places: `backend/app/config.py` and `frontend/src/config/env.js`.

## Recipes

**Add a page:** create `pages/Thing.jsx` (props in, callbacks out) -> add the route to `app/router.js` (`SEGMENT_TO_PAGE`, `PAGE_TO_PATH`) -> add a `TITLES` entry and the JSX line in `app/App.jsx` -> add a nav item in `components/layout/Shell.jsx` and `nav.thing` to both i18n files.

**Add an API route:** add a function to the right file in `backend/app/api/` (or a new router, then add it to `api/__init__.py`) -> add it to `EXPECTED` in `tests/test_routes_contract.py` -> add a client function in `frontend/src/api/` and export it from `api/index.js`. Keep paths stable; changing an existing path or field is a contract change, so check with the team first.

**Add a pipeline step:** new module in `backend/app/pipeline/`, call it from `pipeline/__init__.py`, emit a `PipelineEvent`, add the step to `STEPS` in `frontend/src/domain/status.js`.

**Add a UI string:** add the key to both `i18n/en.json` and `i18n/hi.json`, use `t('area.name')`. Dynamic report text is translated by the AI automatically via `hooks/useReportTranslation.js` (add its key in `reportItems`).

**Persist something in the browser:** add the key to `storage/keys.js`, read and write only through `storage/safeStorage.js`, in a module under `storage/`.

## Testing

```bash
cd backend && .venv/Scripts/python -m pytest              # 130 tests incl. the route-table guard
cd frontend && npm run build                              # must build with no errors
node scripts/polish-check.mjs                             # every page at 1440 and 390 px, tabs, export, Hindi timing, WebGL
OFFLINE=1 node scripts/polish-check.mjs                   # Demo mode with the backend unreachable
node scripts/qa-check.mjs  &&  node scripts/tour.mjs      # badge/form/routing/focus, and the guided tour
node scripts/traplab-check.mjs  recheck-check.mjs  counsellor-check.mjs  cancel-check.mjs  pasted-case.mjs
python scripts/audit-exports.py                           # dead-code finder: unused exports and files
python -m scripts.trap_variance 5   (backend/)            # how many of the 5 traps the live AI catches, over 5 runs
```

## Known limitations

- CSS is global (`theme.css` then `polish.css` override earlier rules). Moving to CSS modules per component would be the next structural step; it was left out to avoid restyling a finished design.
- Jobs and case results are held in memory on the backend; they are lost on restart (the browser keeps each user's history).
- The AI is nondeterministic: a live run can occasionally miss a Trap Lab trap. The scorecard reports what was actually found.
