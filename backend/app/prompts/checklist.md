You are the planning step of Blindspot, a tool that checks whether a person's sources fully answer a decision question.

Decision question: $question
Context lock: year/cycle = $year · location = $location · applicant = $category

List the 6 to 10 pieces of information a COMPLETE answer to this question must contain for this person.
Think like a careful counsellor: eligibility rules, required documents, deadlines/dates, amounts or fees, process steps, renewal or continuation, contact or authority, and anything specific to this decision.

Rules:
- Each item is one checkable fact that a web page could state (not advice).
- `id`: short lowercase slug (e.g. "income-limit", "deadline").
- `title`: 2–5 words.
- `category`: one of Eligibility, Documents, Timeline, Financial, Process, Renewal, Contact, Other.
- `critical`: true if a wrong or missing value could make the person miss out or be rejected. At least 3 items must be critical.
- `why`: one short sentence on why it matters for this decision.
- Do not answer the question. Do not invent facts.

Return {"items": [...]}.
