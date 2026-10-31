# Blindspot: 2:30 demo script (video and live pitch)

**The one sentence to say first and last:** *Blindspot tells you what your sources don't say, before you decide.*

**Story:** Priya is the first in her family to apply to college. She has three tabs open: two say different things about the income document, and nobody mentions renewal. Search found her pages. Nothing told her what was wrong with them.

## Before recording (5 minutes)

1. Backend running (`uvicorn app.main:app --port 8000`) and frontend running. Check the header: **LIVE ANALYSIS**.
2. Settings (⚙) → **Demo mode ON**. If the AI or network fails mid-take, Trap Lab and every run fall back to a recorded real run, so the take never breaks.
3. Press **Catch the traps** once to warm things up, then go back to Overview. Browser 1440×900, other tabs closed, tour dismissed.
4. Backup for everything: **Catch the traps** works offline, and **Try the sample case** is always labelled *Sample data*.

## Script

| Time | Screen | Action | Say |
|---|---|---|---|
| 0:00–0:15 | Overview | Hero, then scroll to the red **"A typical AI summary"** card | "Priya is applying for a scholarship. A normal AI summary sounds sure: it gives last year's amount, trusts a blog, never mentions renewal. It is confident and wrong. **Blindspot investigates instead.**" |
| 0:15–0:30 | Overview | Point at the right card, **"What Blindspot found"** | "Same five pages. Blindspot finds a conflict, an outdated figure, a wrong-state rule, a gap, and two pages that are really one voice. Let me prove it live." |
| 0:30–1:00 | Trap Lab | Click **Catch the traps**. Watch the per-source status list and Jasoos Jr. | "We hid five traps in five test pages. This is a real run: pages are fetched, the AI reads them, and **code checks every quote is on the page**. AI proposes, code verifies." |
| 1:00–1:20 | Report | Scorecard **5/5 traps caught**; verdict **Not ready to decide**; open **Why this verdict?** | "Five of five. The verdict names the exact items and what would change it. No black box." |
| 1:20–1:50 | Evidence drawer | Open **Required Income Documents** (conflict) | "The official notice says an income certificate is mandatory. The blog says self-declaration is enough. Both quotes were found on their pages. The official source outranks the blog, and the strength badge shows how much evidence stands behind it." |
| 1:50–2:05 | Source DNA | Sidebar → **Source DNA** | "The news page copied the blog word for word. Two pages, one voice. Agreement is not the same as truth." |
| 2:05–2:20 | Report | Click **Simulate: the authority updates the notice**, then **Re-check** | "Weeks later the authority moves the deadline. One click re-checks and shows exactly what changed: 30 November to 15 December." |
| 2:20–2:35 | Report | Toggle **हिंदी**, then **Share on WhatsApp** | "Priya's family reads it in Hindi and shares the to-do list on WhatsApp. She can even ask her question out loud in Hindi." |
| 2:35–2:45 | Close | Back to Overview | "Blindspot tells you what your sources don't say, before you decide. Don't just collect information. Investigate it." |

## Judge Q&A cheat sheet

- **"Isn't this just a summarizer?"** No. A summarizer condenses what pages say. Blindspot builds a checklist *before* reading, so it can find what is **missing**, and it flags **conflicts, outdated years and copied sources**. Every claim needs a quote that code finds on the page.
- **"Does the AI hallucinate?"** The AI only proposes. A claim whose quote is not found in the page text is dropped. AI-written lines are labelled *AI suggestion · may be wrong*, and the UI never says "verified true", only "quote found in source".
- **"What if a site blocks you?"** That source becomes *Could not verify*, never *missing*. The user can paste the text instead, and it is labelled *Pasted text* and ranked below official sources.
- **"Is it safe?"** The fetcher blocks private and local addresses (SSRF), pins the IP, caps size and redirects. External calls happen only in the backend, keys stay in `.env`, and everything is cached for 10 minutes with fallbacks.
- **"Who is it for?"** First-generation applicants, and the counsellors and volunteers who help many of them (see the **Counsellor board**).
- **"Is the impact real?"** 93,326 scholarship applications were awaiting verification in Maharashtra alone (MahaDBT, 27 Feb 2026). The minister said it is often because students omit or wrongly upload documents. (Source is linked on the Overview page.)

**If something fails live:** turn on Demo mode (⚙). **Catch the traps** then replays a recorded real run, labelled *Saved demo run*.
