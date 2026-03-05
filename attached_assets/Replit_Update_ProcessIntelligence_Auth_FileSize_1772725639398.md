# Context Brain — Major Update: Process Intelligence Redesign + Auth Fix + File Size

## Fix 1: Authentication — Replace OTP-on-screen with proper authentication

The current OTP implementation shows the OTP on screen, which is not secure. We need a proper authentication system.

### Option A: Google OAuth (recommended)
Replace the current email/OTP system with Google OAuth 2.0:
- Use Google OAuth for login (passport-google-oauth20 or equivalent Python library like `authlib` or `flask-dance`)
- After Google login, check if the user's email is in an allowed list (or allow any Google account — as per our spec, anyone with a Google account can log in)
- Store user info: Google ID, email, display name, profile picture URL
- Admin check: compare logged-in email against ADMIN_EMAILS environment variable
- Add environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

### Option B: If Google OAuth is too complex for now
Use a simple PIN-based system:
- Admin sets a 4-6 digit PIN for each allowed email in the database
- User enters email + PIN to log in
- No OTP sending needed — PINs are pre-set
- Add an admin endpoint to create/update user PINs

Pick whichever is faster to implement, but the current "OTP displayed on screen" must be replaced before we share this with external users.

---

## Fix 2: Increase file upload limit from 10MB to 50MB

Change the maximum file upload size from 10MB to 50MB across:
- Frontend validation (the drag-and-drop area + browse button)
- Backend validation (the upload endpoint)
- Update the UI text from "max 10MB" to "max 50MB"
- If storing files as base64 in the database, ensure the database column can handle larger values (TEXT type in PostgreSQL can handle this)

---

## Fix 3: Complete Redesign of the Process Intelligence Tab

This is a major enhancement. The current Process Intelligence tab has just a "Generate Process Map" button and empty space. We need to transform it into a **living intelligence dashboard** that shows everything the AI understands about this business unit, updates progressively as more context is captured, and actively guides users on what to provide next.

### New Layout: 6 Sections

The Process Intelligence tab should display these 6 sections vertically, each as a distinct card/panel. Sections should show content as soon as ANY relevant context exists (even from just 2-3 chat messages). Don't wait for a manual "generate" action — auto-generate on page load using whatever context is available.

---

### Section A: Business Profile

**What it shows:** A structured overview of what the AI currently understands about this business unit.

**Layout:** A card with these fields displayed:
- **What they do** — 2-3 sentence description of the business
- **Business model** — How they make money
- **Geography** — Where they operate
- **Scale** — Worker network size, client count, monthly volume
- **Key clients** — Named clients if known
- **Team size** — Headcount and key roles
- **Primary languages** — Languages used with workers
- **Communication channels** — How they reach workers (WhatsApp, calls, app, etc.)

Each field should show the AI's current understanding OR show "Not yet captured — mention this in chat or upload relevant documents" in a muted/grey style.

**Feedback mechanism:** Next to each field, show a small edit icon. When clicked, the user can correct the value inline. Corrections are saved to the database and used when regenerating.

**How it's generated:** When the Process Intelligence tab loads, the backend checks if there's ANY context for this vertical (messages, documents, notes). If yes, it calls Claude with a focused prompt:

```
Based on the following context about [VERTICAL_NAME], extract a business profile.

[ALL AVAILABLE CONTEXT: chat messages, document extractions, notes]

Return ONLY valid JSON:
{
  "whatTheyDo": "Description or null if not enough info",
  "businessModel": "How they make money or null",
  "geography": "Where they operate or null",
  "scale": {
    "workerNetwork": "Size or null",
    "clientCount": "Number or null",
    "monthlyVolume": "Tasks/hires/shifts per month or null"
  },
  "keyClients": ["Client names"] or null,
  "teamSize": "Headcount and structure or null",
  "primaryLanguages": ["Languages"] or null,
  "communicationChannels": ["Channels"] or null
}

For any field where the context doesn't provide enough information, set it to null. Do NOT guess.
```

**Caching:** Store the generated business profile in the database. Only regenerate when new context has been added since the last generation. Show a "Last updated: [timestamp]" and a "Refresh" button.

---

### Section B: Process Map (Enhanced)

**What it shows:** The step-by-step operational flow. This is the existing process map feature but significantly improved.

**Before enough context exists (fewer than 5 chat messages and no documents):**
Show a progress indicator instead of just an empty generate button:

```
Process Map Status: Building context...

What we can map so far:
☑ Business overview — captured
☐ Client request intake — need more detail
☐ Worker sourcing — mentioned but not detailed
☐ Screening & qualification — not yet discussed
☐ Assignment & deployment — not yet discussed
☐ Quality review — not yet discussed
☐ Payment & payroll — not yet discussed

💡 Keep chatting with the AI Analyst or upload process documents to fill in the gaps.
```

The checklist items should be dynamic — based on what the AI has actually found in the context so far. Use the vertical's process areas (from the seed context) as the checklist template.

**After enough context exists (5+ messages or documents uploaded):**
Show the "Generate Process Map" button AND the progress checklist above it.

**Process map display (after generation):**
Keep the current vertical flow of step cards, but enhance each card:
- Step number in a colored circle
- Step name (bold, larger)
- Description (2-3 sentences)
- **Metadata row as badges:** Owner/Team, Tools Used, Estimated Time, Volume
- **Pain level:** Color-coded left border (green = low, amber = medium, red = high) AND a text label
- **Automation potential:** Badge with color (grey = low, indigo = medium, green = high)
- **Confidence indicator:** If the AI is inferring rather than being told directly, show a subtle "⚠ Inferred — please verify" tag
- **Feedback buttons on each step:** Three buttons — "✓ Correct" (green), "~ Partially Right" (amber), "✗ Wrong" (red). When Partially Right or Wrong is clicked, expand an inline text field for the user to write their correction. Also an "Add Comment" link for additional context.

**After feedback is provided:**
Show a banner: "You've provided feedback on X steps. Click 'Regenerate' to update the process map with your corrections."
The regenerate call sends the previous map + all feedback to Claude.

---

### Section C: Team & Org Structure

**What it shows:** Visual representation of the team — roles, headcount, who does what.

**Layout:** A structured list/table showing:
- Role name
- Headcount (if known)
- Key responsibilities
- Which process steps they own

If team info hasn't been captured yet, show:
"We haven't captured your team structure yet. Tell us about your team in the chat — roles, headcount, who does what — or upload an org chart."

**Generated from:** Same context as the process map. Claude extracts team information and structures it.

---

### Section D: Tools & Systems Inventory

**What it shows:** Every tool, app, system, spreadsheet mentioned across all context sources.

**Layout:** A clean list/table:
| Tool/System | Type | Used In (Process Steps) | Used By (Role) |
|-------------|------|------------------------|-----------------|
| WhatsApp | Communication | Worker sourcing, Shift filling | Ops team |
| OkayGo App | Mobile app | Task assignment, Check-in/out | Workers |
| Google Sheets | Spreadsheet | Payroll tracking | Finance |

If no tools captured yet: "No tools or systems identified yet. Mention the tools your team uses in the chat."

---

### Section E: Pain Points & Automation Opportunities

**What it shows:** Ranked list of identified pain points with AI-suggested automation approaches.

**Layout:** Cards ranked by severity/impact:

```
🔴 HIGH IMPACT
━━━━━━━━━━━━━
Manual worker sourcing via phone calls
- Current effort: 3 people, 6 hours/day
- Affected process: Worker Recruitment (Step 2)
- AI automation idea: Voice AI agent for outbound sourcing calls
- Expected impact: 60-70% reduction in manual calling time

🟡 MEDIUM IMPACT
━━━━━━━━━━━━━━━
Quality checking task submissions
- Current effort: 2 reviewers, 4 hours/day
- Affected process: Quality Review (Step 5)
- AI automation idea: Computer vision for photo/form verification
- Expected impact: 80% of reviews automated, humans handle exceptions
```

Each pain point card should have a "Is this accurate?" feedback toggle.

If no pain points captured: "No pain points identified yet. Tell us what frustrates your team or where time is wasted."

---

### Section F: Knowledge Gaps

**What it shows:** Explicit list of what the AI still doesn't understand about this BU.

**Layout:** A checklist of questions/topics:
```
📋 We still need to understand:

☐ How do you handle worker no-shows or last-minute cancellations?
☐ What is your payment cycle — how and when are workers paid?
☐ What compliance or regulatory requirements apply to your operations?
☐ What is the average time from client request to worker deployment?
☐ How do you handle disputes between clients and workers?
```

Each gap should be clickable — when clicked, it opens a text field where the user can answer directly (saved as a note with category "process"). Or they can click "Discuss in Chat" which takes them to the Chat tab with this question pre-filled.

**Generated by Claude:** When generating the process map, also ask Claude to identify what information is missing. The knowledge gaps prompt is already in the process map generation prompt.

---

### Implementation: Auto-generation vs Manual

**Auto-generate on page load:** When a user clicks the Process Intelligence tab:
1. Check if there's cached intelligence data that's still fresh (no new context since last generation)
2. If fresh cache exists, display it immediately
3. If new context has been added since last generation, show the cached version with a "New context available — Refresh" banner
4. If no cache exists but context is available, auto-generate all sections in one Claude API call

**Single API call for all sections:** Instead of 6 separate Claude calls, make ONE call that returns all 6 sections. This is more cost-efficient:

```
Analyze all available context for [VERTICAL_NAME] and produce a comprehensive intelligence report.

[ALL CONTEXT]

Return ONLY valid JSON:
{
  "businessProfile": { ... },
  "processMap": { "steps": [...], "processName": "..." },
  "teamStructure": [ { "role": "...", "headcount": "...", "responsibilities": "...", "processSteps": ["..."] } ],
  "toolsInventory": [ { "name": "...", "type": "...", "usedIn": ["..."], "usedBy": "..." } ],
  "painPoints": [ { "severity": "high|medium|low", "title": "...", "currentEffort": "...", "affectedProcess": "...", "automationIdea": "...", "expectedImpact": "..." } ],
  "knowledgeGaps": [ "Question or topic we still need to understand" ],
  "contextCoverage": {
    "businessOverview": true/false,
    "clientIntake": true/false,
    "workerSourcing": true/false,
    "screening": true/false,
    "deployment": true/false,
    "qualityReview": true/false,
    "payment": true/false,
    "compliance": true/false
  }
}

Rules:
- For any section where context is insufficient, return null for that section (don't generate empty/generic content)
- Set contextCoverage booleans based on whether you have REAL information (not just the seed context) for each area
- Be specific — use actual names, numbers, and tools mentioned in the context
- For knowledgeGaps, generate specific questions based on what's MISSING from the context
- painPoints should only include things actually mentioned or strongly implied by the context
```

Use `max_tokens: 8192` for this call.

**Store the result** in a new database table or update the existing process_maps table to include all sections. Add a `generated_at` timestamp and a `context_hash` (hash of all context) to know when to regenerate.

---

### Section Ordering on the Page

Display in this order (top to bottom):
1. **Business Profile** — always first, gives immediate context
2. **Knowledge Gaps** — second, so the user immediately sees what else to provide
3. **Process Map** — the core deliverable
4. **Pain Points & Automation Opportunities** — the actionable insights
5. **Team & Org Structure** — supporting detail
6. **Tools & Systems Inventory** — supporting detail

If a section has no data (null from the API), show it in a collapsed/muted state with a message like "Not enough context yet — keep chatting or upload documents."

---

### Feedback Storage

Create a new table or extend existing:

```sql
CREATE TABLE intelligence_feedback (
    id SERIAL PRIMARY KEY,
    vertical_id TEXT REFERENCES verticals(id),
    user_id TEXT REFERENCES users(id),
    section TEXT NOT NULL,          -- 'business_profile', 'process_map', 'team', 'tools', 'pain_points'
    field_path TEXT,                -- e.g., 'businessProfile.teamSize' or 'processMap.steps.3'
    feedback_type TEXT NOT NULL,    -- 'correct', 'partially_correct', 'wrong', 'edit', 'comment'
    original_value TEXT,            -- what the AI generated
    corrected_value TEXT,           -- what the user says it should be
    comment TEXT,                   -- additional context
    created_at TIMESTAMP DEFAULT NOW()
);
```

When regenerating intelligence, ALL feedback is included in the prompt so corrections persist across regenerations.

---

## Summary of Changes

1. **Auth:** Replace OTP-on-screen with Google OAuth or PIN-based login
2. **File size:** Increase from 10MB to 50MB
3. **Process Intelligence tab:** Complete redesign from single button to 6-section living intelligence dashboard with auto-generation, progressive disclosure, inline feedback, and knowledge gap guidance
4. **New database needs:** Intelligence cache table, intelligence feedback table
5. **API changes:** New endpoint `GET /api/intelligence/:verticalId` that returns cached or freshly generated intelligence. New endpoint `POST /api/intelligence/:verticalId/feedback` for saving corrections.
