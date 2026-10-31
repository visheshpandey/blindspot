# Blindspot: Product Requirements

> **Don't just collect information. Investigate it.**

| | |
|---|---|
| Event | Shinchan Online Hackathon 2026 (Devengers × Unstop, sponsored by .XYZ) |
| Theme | Open innovation · problem statement **"Digital Dark Spot"** |
| Coding window | 31 Oct 10:00 → 1 Nov 10:00 IST |
| Submission closes | 1 Nov 17:00 IST |
| Status | Draft v1 · 30 Oct 2026 |

## 1. Judging weights (and what they mean for us)

| Criterion | Weight | What earns it |
|---|---|---|
| Working prototype | 25% | One polished end-to-end flow: question → sources → report. Live run on real pages. |
| Innovation | 20% | Checklist-first gap detection, quote verification, context lock, the 3D detective town. |
| Problem understanding | 15% | Every PS expected outcome is visible in the UI (§6). |
| Technical implementation | 15% | Typed pipeline, deterministic rules, tests, SSE. |
| Evidence and transparency | 15% | Quotes matched in code, AI lines labelled, honest uncertainty. |
| Presentation | 10% | README, demo script, screenshots, video. |

**PS disqualifier:** a plain summarizer or a generic chatbot does not qualify. The prototype must find **gaps, conflicts, outdated information and unanswered questions across multiple sources**, show evidence, and separate sourced facts from AI suggestions.

## 2. Problem

People make high-stakes decisions (scholarships, admissions, jobs, government schemes) from information scattered across many websites. Some pages are old, some disagree, and key details are never mentioned anywhere. Search finds information and summarizers condense it, but no tool shows **what's missing or unreliable** for *your* decision.

## 3. Target users

- **Primary:** students and families in India applying for scholarships, admissions or schemes, often first-generation applicants with no one to double-check for them.
- **Secondary:** job seekers checking eligibility rules; counsellors and NGO volunteers who help many applicants.

## 4. Product

**One-liner:** You give Blindspot a decision question and the sources you found. It tells you what is supported, conflicting, outdated, missing or unverified, backs each finding with a quote from the source, and tells you what to verify before you decide.

**Primary demo:** *"What should I verify before applying for the post-matric scholarship?"*
Context: 2026–27 · Madhya Pradesh · Undergraduate student.
Five sources: an official portal, a university notice, two secondary blogs, and one blocked site.

## 5. USPs (each one must be visible in the product)

1. **Checklist-first gap detection.** First generate what a complete answer must cover (6–10 items). Then test every source against that list. This is how Blindspot finds *missing* information, not only conflicts.
2. **Quote-verified evidence.** The LLM must return the exact quote behind each claim. Code fuzzy-matches the quote against the fetched page text, and drops a claim whose quote isn't found. UI label: **"QUOTE FOUND IN SOURCE"**. Never "verified true".
3. **Context lock.** The user's year, location and applicant category. A different cycle or state is reported as *outdated* or *different context*, not as a conflict.
4. **Authority over agreement.** Sources are tiered Primary › Institutional › Secondary › Unverified. One official source outranks several copied blogs.
5. **Honest uncertainty.** An unreadable source makes an item *Unverified*, never *Missing*. Every AI-written line is labelled **"AI suggestion · may be wrong"**.
6. **Coverage + decision blockers, not one score.** Coverage %, the critical items that are conflicting, outdated or missing, and a verdict: *Not ready to decide* / *Proceed with caution* / *Ready to decide*.

**Positioning:** existing tools audit one company's own website for contradictions. Blindspot investigates *different* websites for *your* decision, and finds missing information as well as conflicts.

## 6. Problem-statement compliance

| PS expected outcome | Where it appears |
|---|---|
| Enter a topic, question or research goal | New investigation page: question box + context lock |
| Add or collect sources | Up to 5 URL inputs, each with "Paste text instead". Stretch: "Suggest sources" via a permitted search API, clearly labelled |
| Structured summary across sources | **Key facts found** card: one line per checklist item with value and source chips |
| Gaps and unanswered questions | **Potential gaps and unanswered questions** card (items written as questions) |
| Contradictions with references | Conflict findings + side-by-side quotes in the evidence drawer |
| Outdated / undated warnings | `outdated` status + **Undated** badge on any claim or source with no visible date/cycle |
| Prioritised verify-next checklist | **Verify next** section (critical first) |
| Dashboard separating sourced info vs AI vs uncertainty | Source quotes vs purple dashed **"AI suggestion · may be wrong"** boxes + a legend |

**Wording rule:** findings read as *signals*, not facts. Use "Potential gap: not found in the sources reviewed", "Possible conflict", "Possibly outdated", "Could not verify". Never "Missing" or "Wrong" as a bare verdict.

## 7. Statuses and credibility

| `status` | Meaning | UI label | Colour |
|---|---|---|---|
| `supported` | Evidence found; authority shown | Supported | green / warm glow |
| `conflict` | Sources in the same context disagree | Possible conflict | orange-yellow |
| `outdated` | Claim belongs to an older cycle/year | Possibly outdated | grey |
| `missing` | No successfully analysed source mentions it | Potential gap | dark navy / red accent |
| `unverified` | Source unreadable or evidence too weak | Could not verify | pale blue-grey |

| Credibility type | Rule |
|---|---|
| Primary | `.gov.in`, `.nic.in`, official scheme portal |
| Institutional | `.ac.in`, `.edu`, a university |
| Secondary | blog, news |
| Unverified | unknown or unreadable |

## 8. Pages and features

**Overview.** Hero "Welcome to Detective Town", live 3D town preview, *Start an investigation*, *Explore sample case*, recent investigations from localStorage (+ the sample, marked "Sample"). Stats are computed from stored investigations; no invented numbers.

**New investigation.** Question box; context lock (year, state, category); up to 5 URL inputs, each with "Paste text instead"; inline validation; *Investigate sources* and *Try sample*.

**Analyzing (new).** Full-screen 3D town; Jasoos Jr. walks house to house as SSE events arrive; a speech bubble shows the current step; a step checklist with crayon ticks. 2D step-list fallback without WebGL.

**Report: Town view (default).** One house per finding, with status effects:
supported: glowing windows + spinning star · conflict: flickering lightning + mascot gasps · outdated: grey house + cobweb · missing: dark house + fog + bobbing "???" · unverified: pale fog + locked door.
HUD: coverage, blockers, verdict chip, *Verify next*. Clicking a house flies the camera to it and opens the evidence drawer. Houses are also reachable as a keyboard list.

**Report: Table view.** Stats, findings table with filters, critical blockers, source register, key facts, unanswered questions, verify-next checklist, legend.

**Evidence drawer.** Status + CRITICAL tags; extracted value; quotes side by side (source name, credibility, date/cycle, highlighted quote, **QUOTE FOUND IN SOURCE** stamp with match %, *Open source ↗*); AI note in a dashed purple box "AI suggestion · may be wrong"; *Copy evidence*, *Ask authority*.

**Actions.** Draft query email (modal, editable, copy; never sends); Export report (print stylesheet); Hindi toggle via `/translate` with AI labels.

**Case history.** Past investigations from localStorage.

**Mascot: Jasoos Jr.** Original character: brown bob hair, orange cap with a yellow button, round glasses, big eyes with highlights, blush, teal detective coat with brown belt, yellow magnifying glass. Built from three.js primitives only.

**Visual identity.** Cream `#fff8ea`, ink `#1f2340`, coral `#ff6b5b`, sun `#ffd23f`, teal `#2ec4b6`, sky `#bfe6ff`. 3px ink outlines, hard shadow `4px 4px 0 #1f2340`, 16–22px radii. Baloo 2 (headings), Nunito (body), monospace (labels). Navy sidebar stays.

## 9. Demo safety

- `backend/app/samples/scholarship.json` is the exact sample from `frontend/src/data.js`: 6 findings, 5 sources, 4 checklist items, **67% coverage, 3 critical blockers**.
- Demo mode (no API key, or *Try sample*) shows a visible **"Sample data"** badge.
- Every illustrative quote, URL and date is labelled **"Sample data, illustrative"**.
- At least one live run on real public pages, saved for the README.

## 10. Non-goals

- Sending email (drafts only).
- Claiming any claim is true ("verified true").
- Using or imitating any existing cartoon character, model or image.
- Paid services, accounts, or multi-user sharing.
- PDFs/photos, auto-discovery, Source DNA, browser extension (all future work).

## 11. Quality bar

Responsive at 375/768/1440 px · `prefers-reduced-motion` gives a static town · keyboard accessible (house list, focus-trapped drawer, Esc closes) · AA contrast · status never shown by colour alone · steady FPS (one shadow light, pixel ratio ≤ 2, town code-split) · loading, empty and error states for every API call, friendly copy only.

## 12. Success criteria

- [ ] A judge can run the sample in under 10 seconds with no API key.
- [ ] A live run on 2–3 real public pages produces at least one gap and is saved in the README.
- [ ] Every row in §6 maps to a visible feature.
- [ ] All pytest suites pass; `npm run build` passes; Playwright screenshots captured with a clean console.
- [ ] README, SUBMISSION.md and the 2-minute demo script are done before 1 Nov 17:00 IST.
