# Blindspot: Submission

**Project name:** Blindspot
**Tagline:** Don't just collect information. Investigate it.
**Problem statement:** Digital Dark Spot

---

## Problem

People make important decisions (scholarships, admissions, jobs, government schemes) from information scattered across many websites. Some pages belong to last year's cycle, some disagree with each other, and key details are never mentioned at all. Search engines find pages and summarizers condense them, but neither tells you **what is missing, outdated or unreliable for your specific decision**. First-generation applicants feel this most, because they have no one to double-check for them.

## Solution

Blindspot is an evidence-first investigation tool. You enter a decision question (for example *"What should I verify before applying for the post-matric scholarship?"*), lock your context (2026–27, Madhya Pradesh, undergraduate) and add up to five sources. Blindspot reports, item by item, what is **supported, conflicting, outdated, missing or unverified**, proves each finding with an exact quote found in the source, and gives you a prioritised **verify-next** checklist and a draft email to the authority.

It is not a summarizer or a chatbot. It audits your sources against what a complete answer needs.

## How it works

1. **Checklist first (AI):** decide the 6–10 things a complete answer must contain, before reading any source.
2. **Fetch and classify (code):** read each page (or the pasted text), rank it Primary / Institutional / Secondary / Unverified, and detect its year or cycle.
3. **Extract (AI):** for each source and checklist item, return a value, the exact quote and its cycle, or `not_found`.
4. **Verify (code):** fuzzy-match every quote against the fetched text; drop claims whose quote isn't there.
5. **Compare (code):** apply the context lock (an old cycle is outdated, not a conflict), authority (one official page outranks copied blogs), and missing vs unverified.
6. **Score (code):** coverage %, critical decision blockers and a verdict.
7. **Act (AI, labelled):** verify-next list, unanswered questions, notes, an email draft, and an optional Hindi explanation.

Progress streams live to the UI, where the mascot Jasoos Jr. walks from house to house as each step finishes.

## Major features

- Question + **context lock** (year, state, applicant category)
- Up to 5 sources: URLs, or **paste text instead** for blocked or JavaScript-heavy pages
- **Live Analyzing page:** 3D town, pipeline steps streamed over SSE
- **Report as a 3D town:** one house per finding, with status effects (glowing star = supported, lightning = possible conflict, cobweb = possibly outdated, fog and "???" = potential gap, padlock = could not verify), plus camera fly-to and a keyboard-accessible house list
- **Table view:** filters, critical blockers, source register
- **Key facts found**, **Potential gaps and unanswered questions**, **Verify next** checklist
- **Evidence drawer:** side-by-side quotes, credibility tier, cycle, highlighted quote, **QUOTE FOUND IN SOURCE** stamp with match %, links to the source
- **AI suggestions in purple dashed boxes**, with a legend separating sourced / AI / uncertain
- **Undated** badges, **Sample data** badges, honest "Could not verify" for blocked sites
- Draft query email (never sent), Hindi toggle, print/PDF export, local case history
- Works without an API key in clearly labelled demo mode

## Uniqueness and innovation

- **Finds what's missing, not just what conflicts:** the checklist-first design turns "nobody mentioned renewal" into a visible potential gap.
- **Hallucination guard in code:** a claim survives only if its quote is actually on the page.
- **Context lock:** last year's deadline is flagged as outdated instead of being mixed in or called a contradiction.
- **Authority over agreement:** majority vote is not truth; an official page outranks copied blogs.
- **Signals, not verdicts:** "Potential gap", "Possible conflict", "Could not verify"; never "verified true".
- **A playful but honest interface:** the 3D detective town makes an audit approachable without hiding the evidence.

Existing tools audit one organisation's own website for contradictions. Blindspot investigates *different* websites for *your* decision.

## Tech stack

- **Frontend:** React 18, Vite 6, three.js (code-split), lucide-react, plain CSS design tokens
- **Backend:** Python 3.11, FastAPI, Pydantic v2, httpx, trafilatura, BeautifulSoup, rapidfuzz, Server-Sent Events
- **AI:** Google Gemini (JSON mode, schema-validated, 1 retry), optional Groq fallback, 10-minute caching
- **Quality:** 51 pytest tests (rules, quote matching, API contract), Playwright walkthrough with a console-error check

## Future scope

PDF and photo sources; **Source DNA** to detect copied pages so agreement isn't double-counted; permitted automatic source discovery; a browser extension that investigates the page you're reading; shareable report links; more Indian languages; counsellor dashboards for NGOs and schools.
