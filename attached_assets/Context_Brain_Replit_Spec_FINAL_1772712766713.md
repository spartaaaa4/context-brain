# BetterPlace AI Labs — Context Brain
## Complete Build Specification for Replit

**Owner:** Anuj, Head of Product — goBetter & Central AI Labs, BetterPlace Group
**Date:** March 2026
**Purpose:** Build and deploy a web application that captures deep operational context from 6 business verticals so the central AI team can understand processes, generate process maps, and plan AI automation.

---

## 1. WHAT ARE WE BUILDING?

A web application called **Context Brain** — a central intelligence-gathering platform for BetterPlace Group's AI Labs team.

**The problem:** BetterPlace Group has multiple business units across 4 countries. The central AI team needs to deeply understand how each BU operates — their recruitment flows, staffing processes, tools, team structures, pain points, and business models — before building AI agents to automate their workflows. Today this knowledge is scattered across people's heads, SOPs, WhatsApp groups, and meeting notes.

**The solution:** A web app where each BU's representative can:
1. Have an AI-guided conversation that intelligently asks questions about their processes
2. Upload documents (SOPs, process docs, meeting transcripts, org charts)
3. Add written notes and context dumps
4. Review AI-generated process maps and correct them with feedback

The AI structures everything into actionable intelligence that the admin (AI Labs team lead) can view, analyze, and export.

---

## 2. THE 6 VERTICALS

The app has 6 workspaces (hardcoded, not configurable). Each represents a business vertical within BetterPlace Group.

### Vertical 1: OkayGo
- **Display name:** OkayGo
- **Geography:** India (PAN-India)
- **Type:** Gig Task Fulfillment Platform
- **Color accent:** #E85D26 (orange)
- **Icon:** ⚡
- **Seed context for AI:** "OkayGo is a gig task fulfillment platform operating across India. Companies come to OkayGo when they have tasks — audits, delivery, telecalling, proctoring, due diligence — that need to be executed by a distributed gig workforce. OkayGo manages end-to-end task completion, not just worker placement. They serve 100+ enterprise clients including Tata, Amazon, Flipkart, Swiggy, Zepto. Primary languages: Hindi and English. Workers use an Android app."

### Vertical 2: Troopers
- **Display name:** Troopers
- **Geography:** Malaysia + Singapore
- **Type:** Part-time / Gig Staffing
- **Color accent:** #2563EB (blue)
- **Icon:** 🛡️
- **Seed context for AI:** "Troopers is a part-time and gig staffing platform in Malaysia and Singapore. They connect businesses with part-time workers for short-duration, flexible work — events, F&B, retail, warehousing. They have 250,000+ registered part-timers and 200+ business clients including Coca-Cola, Chagee, Park Royal, KLCC. Workers use iOS and Android apps. Primary languages: English and Malay."

### Vertical 3: MyRobin
- **Display name:** MyRobin
- **Geography:** Indonesia
- **Type:** Outsourcing / BPO Platform
- **Color accent:** #059669 (green)
- **Icon:** 🌏
- **Seed context for AI:** "MyRobin is a blue-collar outsourcing platform in Indonesia. They place workers at client sites and manage those workers on behalf of the client — handling screening, documents, attendance, payroll, and benefits. Worker categories include warehouse, logistics, sales, manufacturing, F&B, cleaning, hotel staff. They have a 2M+ worker network across Indonesia. Key clients include ShopeeXpress, Lalamove, Kopi Kenangan. Primary language: Bahasa Indonesia. WhatsApp is the dominant communication channel."

### Vertical 4: AasaanJobs
- **Display name:** AasaanJobs
- **Geography:** India
- **Type:** Blue-collar Recruitment Services
- **Color accent:** #7C3AED (purple)
- **Icon:** 💼
- **Seed context for AI:** "AasaanJobs is a blue-collar job portal and active recruitment services company in India. They handle delivery, retail, BFSI field roles, manufacturing, security, and housekeeping recruitment. Current scale is approximately 2,000 hires per month. Primary languages: Hindi and English."

### Vertical 5: Background Verification (BV)
- **Display name:** Background Verification
- **Geography:** India (primarily), with some cross-border
- **Type:** Verification & Compliance
- **Color accent:** #DC2626 (red)
- **Icon:** 🔍
- **Seed context for AI:** "Background Verification (BV) is a cross-cutting function across BetterPlace Group. The goBetter software product includes verifyBetter, which handles integrated background checks — identity verification, career history, financial checks, health records, legal history, and physical verification. BV processes touch multiple document types including Aadhaar, PAN, driving license, and bank statements. This vertical captures context about how BV is done across all business units — the tools, processes, turnaround times, and pain points."

### Vertical 6: goBetter
- **Display name:** goBetter
- **Geography:** India
- **Type:** Enterprise Software (HRMS + LMS)
- **Color accent:** #0891B2 (teal)
- **Icon:** 🚀
- **Seed context for AI:** "goBetter is the software product arm of BetterPlace Group. It has two products: manageBetter (enterprise HRMS and CLMS for managing frontline workforce — attendance, payroll, compliance, hiring, onboarding) and skillBetter (mobile-first LMS for frontline worker training in 35+ languages). goBetter sells to large enterprises — logistics companies, retail chains, FMCG, BFSI, hospitals, factories. Key differentiators: mobile-first, vernacular support, configurable workflows, single platform for on-roll + off-roll workers. Competitors include Darwinbox, Keka, Springworks, SAP SuccessFactors."

---

## 3. AUTHENTICATION

### User Authentication
- **Method:** Google OAuth 2.0
- **Access policy:** Anyone with a Google account can log in. No invite or pre-approval required.
- **After login:** User sees the home dashboard with all 6 verticals. They can pick any vertical to contribute to.
- **A single user can contribute to multiple verticals.** They can switch freely between verticals.
- **Store per user:** Google email, display name, profile picture URL, first login timestamp, last active timestamp

### Admin Authentication
- **Method:** Same Google OAuth, but with an email allowlist check
- **Admin emails:** Store admin email addresses in an environment variable called `ADMIN_EMAILS` (comma-separated). Initially just one email (the app owner will set this).
- **Admin access:** If the logged-in user's email is in the `ADMIN_EMAILS` list, show an "Admin Dashboard" link in the navigation. Otherwise, don't show it.
- **No separate login flow** — admin is just a role check on the same Google auth.

### Environment Variables
```
ANTHROPIC_API_KEY=sk-ant-...          # Claude API key
ADMIN_EMAILS=anuj@example.com         # Comma-separated admin emails
GOOGLE_CLIENT_ID=...                  # Google OAuth client ID
GOOGLE_CLIENT_SECRET=...              # Google OAuth client secret
SESSION_SECRET=...                    # For session management
```

---

## 4. DATABASE SCHEMA

### Table: users
```sql
id              TEXT PRIMARY KEY      -- Google user ID
email           TEXT UNIQUE NOT NULL
display_name    TEXT
profile_pic     TEXT
is_admin        BOOLEAN DEFAULT FALSE -- Derived from ADMIN_EMAILS env var check
created_at      TIMESTAMP DEFAULT NOW()
last_active_at  TIMESTAMP
```

### Table: verticals
```sql
id              TEXT PRIMARY KEY      -- e.g., 'okaygo', 'troopers', etc.
name            TEXT NOT NULL         -- Display name
geography       TEXT
type            TEXT
color           TEXT                  -- Hex color code
icon            TEXT                  -- Emoji
seed_context    TEXT                  -- The seed context paragraph for AI
created_at      TIMESTAMP DEFAULT NOW()
```
Pre-populate this table with the 6 verticals from Section 2 on first run.

### Table: messages
```sql
id              SERIAL PRIMARY KEY
vertical_id     TEXT REFERENCES verticals(id)
user_id         TEXT REFERENCES users(id)
role            TEXT NOT NULL         -- 'user' or 'assistant'
content         TEXT NOT NULL
created_at      TIMESTAMP DEFAULT NOW()
```

### Table: documents
```sql
id              SERIAL PRIMARY KEY
vertical_id     TEXT REFERENCES verticals(id)
user_id         TEXT REFERENCES users(id)
filename        TEXT NOT NULL
file_type       TEXT                  -- 'pdf', 'docx', 'txt', 'image', 'csv', 'xlsx'
file_path       TEXT                  -- Path to stored file
file_size       INTEGER               -- In bytes
doc_type        TEXT                  -- 'sop', 'process_doc', 'meeting_transcript', 'training_material', 'org_chart', 'other'
user_description TEXT                 -- User's description of what this document is
extracted_content TEXT                -- AI-extracted structured summary (JSON string)
processing_status TEXT DEFAULT 'pending'  -- 'pending', 'processing', 'done', 'failed'
created_at      TIMESTAMP DEFAULT NOW()
```

### Table: notes
```sql
id              SERIAL PRIMARY KEY
vertical_id     TEXT REFERENCES verticals(id)
user_id         TEXT REFERENCES users(id)
content         TEXT NOT NULL
category        TEXT DEFAULT 'other'  -- 'process', 'team', 'tools', 'pain_points', 'metrics', 'business_model', 'other'
created_at      TIMESTAMP DEFAULT NOW()
```

### Table: process_maps
```sql
id              SERIAL PRIMARY KEY
vertical_id     TEXT REFERENCES verticals(id)
generated_by    TEXT REFERENCES users(id)
version         INTEGER DEFAULT 1
map_data        TEXT NOT NULL         -- JSON string (full process map structure)
source_summary  TEXT                  -- What inputs were used to generate this version
created_at      TIMESTAMP DEFAULT NOW()
```

### Table: process_map_feedback
```sql
id              SERIAL PRIMARY KEY
process_map_id  INTEGER REFERENCES process_maps(id)
user_id         TEXT REFERENCES users(id)
step_number     INTEGER               -- Which step the feedback is on (null = general feedback)
feedback_type   TEXT                  -- 'correct', 'partially_correct', 'wrong', 'missing_step', 'comment', 'edit'
content         TEXT                  -- The feedback text or edited content
created_at      TIMESTAMP DEFAULT NOW()
```

---

## 5. FEATURES — DETAILED SPECIFICATION

### 5.1 Home Dashboard

**URL:** `/` (after login)

**Layout:** Clean grid of 6 vertical cards. Each card shows:
- Vertical icon, name, geography, type
- Stats: total messages, total documents, total notes
- Process map status: "Not generated" / "Generated (v2)" / "Needs review"
- Contributors: small avatar circles of users who have contributed
- Last activity timestamp

Clicking a card navigates to `/vertical/:verticalId`

### 5.2 Vertical Workspace

**URL:** `/vertical/:verticalId`

**Layout:** Top bar with vertical name/icon/geo + navigation tabs. Three tabs:

#### Tab 1: Chat (AI Conversational Intake)

This is the primary context capture method. An AI process analyst has a conversation with the BU representative.

**How it works:**
- Shows the conversation history for this vertical (all messages from all users, chronologically)
- New users joining the chat see the existing conversation and can continue it
- Each message shows: user avatar + name (or "AI Analyst" for assistant messages), timestamp
- Text input at the bottom with a Send button and a Voice button (see 5.3)

**AI behavior (critical — this is the system prompt):**

```
You are an AI process analyst working for BetterPlace Group's Central AI Labs team. You are conducting a structured intake to understand the operations of [VERTICAL_NAME] ([GEOGRAPHY] — [TYPE]).

[INSERT SEED CONTEXT FOR THIS VERTICAL]

Your goal is to build a complete picture of this organization's operations. You need to understand:

1. BUSINESS MODEL — What exactly does this business do? How does it make money? Who are the customers? What is the scale?
2. TEAM & ORG STRUCTURE — Who works here? What are the key roles? How many people? Who reports to whom?
3. END-TO-END PROCESSES — Walk through every major workflow step by step. Especially recruitment/staffing flows.
4. TOOLS & SYSTEMS — What software, apps, spreadsheets, WhatsApp groups, manual processes do they use?
5. BOTTLENECKS & PAIN POINTS — Where is time wasted? Where do errors happen? What's frustrating?
6. VOLUME & SCALE — How many workers/tasks/shifts/hires per day/week/month? Seasonality?
7. COMMUNICATION CHANNELS — How do they reach workers? Calls, WhatsApp, app notifications, SMS?
8. QUALITY & COMPLIANCE — How is work quality verified? What compliance requirements exist?
9. COSTS — Where is money spent on operations? What's the team cost? Tool costs?

INTERVIEW STYLE:
- Be warm, professional, and conversational — never robotic or clinical
- Ask ONE focused question at a time
- After each answer, briefly acknowledge what you heard (1 sentence), then ask the natural next question
- When something interesting is mentioned, dig deeper with a follow-up before moving to a new topic
- Every 5-6 exchanges, provide a brief summary of what you have captured so far
- Keep your responses concise — 2-3 sentences before your question, never more
- If someone provides vague information, ask for a specific example or a walk-through of a real scenario
- Use their terminology — don't correct their language
- If someone provides irrelevant or off-topic information, gently redirect: acknowledge what they said, then steer back with "That's helpful context. Going back to [topic] — could you tell me about [specific question]?"
- If someone gives very short answers, encourage them: "Could you walk me through a real example of how that works day-to-day?"

START by greeting them warmly, acknowledging their organization, and asking them to describe what their business actually does in their own words — even if the seed context already describes it. Their perspective matters.

CRITICAL: You are gathering intelligence to help build AI automation. Pay extra attention to manual, repetitive, time-consuming activities — those are the highest-value automation targets. When you hear something manual, always ask: how long does it take, how often, and how many people are involved.
```

**Backend implementation:**
- `POST /api/chat` — accepts `{ verticalId, message }`. Returns AI response.
- Backend sends to Claude API: system prompt (above, with vertical-specific context inserted) + full conversation history for that vertical + new user message
- Both user message and AI response are stored in the `messages` table with the user's ID
- All API calls to Claude go through the backend. NEVER expose the API key to the frontend.
- Use model: `claude-sonnet-4-20250514`
- Set `max_tokens: 1024` for chat responses

#### Tab 2: Documents

**Layout:** Upload area at top + list of uploaded documents below.

**Upload flow:**
1. User clicks "Upload Document" button or drags a file
2. Supported file types: PDF, DOCX, TXT, PNG, JPG, JPEG, CSV, XLSX
3. Max file size: 10MB
4. After selecting a file, a modal appears with:
   - File name and size (auto-filled, read-only)
   - **Document type dropdown:** SOP, Process Document, Meeting Transcript, Training Material, Org Chart, Other
   - **Description text field (required):** "Briefly describe what this document contains and why it's relevant" — placeholder text: "e.g., This is our standard SOP for onboarding new warehouse workers in Jakarta"
   - Upload button
5. File is uploaded to the server and stored
6. Background job sends the file to Claude API for content extraction (see below)
7. Status shows: "Processing..." → "Done" (with extracted summary shown) or "Failed"

**Document processing with Claude API:**
- `POST /api/documents/process` — triggered after upload
- For PDFs and images: convert to base64, send to Claude as document/image content type
- For text/CSV/XLSX: extract text content and send as text
- System prompt for document extraction:

```
You are analyzing a document uploaded by a team member from [VERTICAL_NAME] ([GEOGRAPHY] — [TYPE]).

The user described this document as: "[USER_DESCRIPTION]"
Document type: [DOC_TYPE]

Extract and structure the following information from this document. Return ONLY valid JSON (no markdown, no backticks):

{
  "summary": "2-3 sentence summary of what this document covers",
  "processSteps": [
    {
      "name": "Step name",
      "description": "What happens in this step",
      "owner": "Who is responsible (if mentioned)",
      "tools": "Tools/systems referenced (if any)"
    }
  ],
  "rolesFound": ["List of job roles or team names mentioned"],
  "toolsFound": ["List of software, apps, or systems mentioned"],
  "metricsFound": { "metric_name": "value" },
  "painPointsFound": ["Any complaints, bottlenecks, or issues mentioned"],
  "keyFacts": ["Other important facts or context extracted"],
  "relevanceScore": "high|medium|low — how relevant is this to understanding operational processes"
}

If this is a meeting transcript, also extract:
- "decisions": ["Decisions made during the meeting"]
- "actionItems": ["Action items assigned"]
- "discussionTopics": ["Key topics discussed"]

Be thorough. Extract everything that could help understand this organization's operations.
```

- Store extracted JSON in the `extracted_content` column
- Update `processing_status` to 'done' or 'failed'

**Document list display:**
- Each document shows: filename, type badge, uploader name + avatar, upload date, processing status
- When status is "done", show an expandable summary section with the AI-extracted content
- Admin can see all documents. Regular users can see all documents for verticals they have access to.

#### Tab 3: Process Intelligence

This is the output section — where the AI's understanding of the vertical is displayed.

**Layout has 4 sub-sections:**

**A) Business Overview**
- Auto-generated summary of what this business is, what it does, key metrics, team structure
- Generated by the AI from all available context (chat + documents + notes)
- Shows as a clean card with structured sections: About, Scale & Metrics, Team, Tools & Systems

**B) Process Map**
- Visual display of the step-by-step operational flow
- Each step is a card showing:
  - Step number
  - Step name and description
  - Owner/team
  - Tools used
  - Estimated time
  - Pain level indicator (green/yellow/red left border)
  - Automation potential badge (low/medium/high)
  - Automation idea (if identified)
- Steps are displayed as a vertical flow (top to bottom)
- "Generate Process Map" button — triggers AI to analyze ALL context and produce the map
- "Refresh Process Map" button — regenerates incorporating new context and feedback

**C) Feedback Section (on the process map)**
- Visible once a process map has been generated
- For each step in the process map, user can:
  - Click a "✓ Correct" button
  - Click a "⚠ Partially Correct" button and add a correction note
  - Click a "✗ Wrong" button and add what's actually correct
  - Click "Add Comment" to add additional context about this step
- Below the steps, a button: "Add Missing Step" — opens a form to describe a step the AI missed
- A "General Feedback" text area for overall comments on the process map
- All feedback is stored in `process_map_feedback` table
- When user submits feedback, a banner appears: "Feedback saved. Click 'Refresh Process Map' to regenerate with your corrections."

**D) Knowledge Gaps**
- Shows what the AI still doesn't know about this vertical
- Generated as part of the process map output
- Displayed as a checklist: "We still need to understand: ☐ How payroll is calculated for piece-rate workers ☐ What happens when a client cancels a shift within 24 hours ☐ ..."
- Helps the BU representative know what else to provide

**Process map generation (backend):**

`POST /api/process-map/generate` — accepts `{ verticalId }`

Collects ALL context for the vertical:
- Full chat conversation history
- All document extracted_content JSONs
- All notes
- Previous process map (if exists) + all feedback on it

Sends to Claude API with this prompt:

```
You are a senior process analyst at BetterPlace Group's AI Labs. You have been given all available context about [VERTICAL_NAME] ([GEOGRAPHY] — [TYPE]).

Your job is to produce a comprehensive, structured analysis of this business unit.

CONTEXT PROVIDED:
--- CONVERSATION TRANSCRIPT ---
[All chat messages]

--- UPLOADED DOCUMENTS (AI-extracted content) ---
[All document extracted_content]

--- NOTES ---
[All notes with categories]

--- PREVIOUS PROCESS MAP (if exists) ---
[Previous map JSON]

--- USER FEEDBACK ON PREVIOUS MAP (if exists) ---
[All feedback entries]

Produce a complete analysis. Return ONLY valid JSON (no markdown, no backticks):

{
  "businessOverview": {
    "summary": "2-3 paragraph description of what this business does and how it operates",
    "businessModel": "How they make money",
    "scale": {
      "workers": "Size of worker network",
      "clients": "Number and type of clients",
      "geography": "Where they operate",
      "volume": "Transactions/tasks/hires per period"
    },
    "teamStructure": "Description of the team — roles, headcount, reporting structure",
    "toolsAndSystems": ["List of all tools, software, apps, systems they use"],
    "keyClients": ["Notable client names if mentioned"]
  },
  "processMap": {
    "processName": "Name of the core process (e.g., 'End-to-End Gig Worker Recruitment & Deployment')",
    "steps": [
      {
        "stepNumber": 1,
        "name": "Step name",
        "description": "Detailed description of what happens",
        "owner": "Who does this — role/team name",
        "teamSize": "How many people are involved (if known)",
        "toolsUsed": ["Tools used in this step"],
        "estimatedTime": "How long this step takes",
        "volume": "How often / how many (if known)",
        "painLevel": "low|medium|high",
        "painDescription": "What makes this painful (if applicable)",
        "automationPotential": "low|medium|high",
        "automationIdea": "How AI could automate or assist this step",
        "confidence": "high|medium|low — how confident you are in this step based on available data",
        "notes": "Additional context"
      }
    ]
  },
  "keyInsights": [
    "Important patterns, observations, or strategic insights about this BU"
  ],
  "topAutomationTargets": [
    {
      "target": "What to automate",
      "currentCost": "Time/money/people currently spent",
      "automationApproach": "How AI could handle this",
      "expectedImpact": "What improvement to expect",
      "priority": "high|medium|low"
    }
  ],
  "knowledgeGaps": [
    "Specific questions or topics where information is still missing or unclear"
  ],
  "communicationChannels": ["How this BU communicates with workers — WhatsApp, calls, app, SMS, etc."],
  "complianceNotes": "Any regulatory, legal, or compliance requirements mentioned"
}

IMPORTANT RULES:
- If the previous process map exists and feedback was provided, incorporate ALL feedback. Steps marked 'correct' should stay. Steps marked 'wrong' should be fixed per the correction. Steps marked 'partially_correct' should be adjusted. Missing steps should be added.
- Set confidence to 'low' for any step where you are inferring rather than directly told
- Be specific — avoid generic descriptions. Use the actual role names, tool names, and numbers mentioned.
- If information was NOT provided for a field, set it to null rather than guessing
- The knowledgeGaps section is critical — be thorough about what we still need to learn
```

Use `max_tokens: 4096` for this call since the output is large.

Store the result in `process_maps` table. Increment version number if a previous map exists.

### 5.3 Voice Input

Add a microphone button next to the chat text input.

**Implementation:**
- Use the browser's Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`)
- When the mic button is pressed:
  - Button changes to a pulsing red indicator showing "Listening..."
  - Speech is transcribed in real-time and appears in the text input field
  - User can see the transcription building as they speak
- When the user stops speaking (or clicks the mic button again to stop):
  - Transcribed text stays in the input field
  - User can edit the text before sending
  - User must click Send manually (no auto-send)
- Language: Set to 'en' by default. If we can detect from the vertical's geography, set appropriately (Hindi for India verticals, Malay for Troopers, Bahasa Indonesia for MyRobin). But English should work for everyone.
- If the browser doesn't support Web Speech API, hide the mic button entirely (don't show an error).

### 5.4 Notes / Context Dump

A simpler input method within each vertical workspace. Add as a section below the Documents tab or as a side panel accessible from any tab.

**Layout:**
- Text area for typing/pasting content
- Category dropdown: Process, Team Structure, Tools & Systems, Pain Points, Metrics, Business Model, Other
- "Add Note" button
- Below: list of all notes for this vertical, showing content, category badge, author name, timestamp
- Notes are displayed newest-first

### 5.5 Admin Dashboard

**URL:** `/admin` — only accessible if the logged-in user's email is in `ADMIN_EMAILS`

**Layout:**

**A) Overview Page**
- 6 vertical cards showing:
  - Vertical name, geography, type
  - Total unique contributors (user count)
  - Total messages, documents, notes
  - Process map status and version
  - Last activity timestamp
- Summary stats at top: total contributors across all verticals, total documents, total messages

**B) Per-Vertical Deep Dive** (click a vertical card)
- **Contributors tab:** List of all users who contributed, with their message count, document count, note count
- **Conversation tab:** Full read-only chat transcript with user names and timestamps
- **Documents tab:** All uploaded documents with extracted summaries. Ability to view the original uploaded file.
- **Notes tab:** All notes with categories and authors
- **Process Map tab:** Current process map with all feedback displayed inline. Each step shows any feedback users have left.
- **Quality tab:** AI-generated quality assessment — which inputs seem high-value vs low-value/irrelevant. Flag any concerning inputs.

**C) Export** (critical feature)
- Per-vertical export button that generates a downloadable JSON file containing:
  - Full conversation transcript (with user names and timestamps)
  - All document extracted content (not raw files, just the AI summaries)
  - All notes with categories
  - Current process map JSON (latest version, with feedback incorporated)
  - Business overview
  - Knowledge gaps
  - Automation targets
  - List of contributors

- Also offer a "Markdown Export" — a human-readable markdown file with:
  - Executive summary of the vertical
  - Business overview section
  - Process map in text form (numbered steps with details)
  - Key insights and automation targets
  - Knowledge gaps
  - Contributor list

- Export formats: JSON download button + Markdown download button, per vertical
- Also: "Export All" button that packages all 6 verticals into a single JSON/ZIP

---

## 6. UI/UX DESIGN SPECIFICATIONS

### Overall Aesthetic
- **Theme:** Dark — dark navy/charcoal background (`#0F0F14` to `#1A1A2E`)
- **Font:** DM Sans (Google Fonts) for all body text. JetBrains Mono for any code, data, or technical labels.
- **Cards/panels:** `rgba(255,255,255,0.04)` background with `rgba(255,255,255,0.08)` borders
- **Text colors:** Primary: `#F1F5F9`, Secondary: `#94A3B8`, Muted: `#64748B`
- **Animations:** Subtle fade-in on page load, smooth tab transitions
- **Mobile responsive:** Must work on phones — BU reps may use this on mobile

### Per-Vertical Accent Colors
- OkayGo: `#E85D26` (orange)
- Troopers: `#2563EB` (blue)
- MyRobin: `#059669` (green)
- AasaanJobs: `#7C3AED` (purple)
- Background Verification: `#DC2626` (red)
- goBetter: `#0891B2` (teal)

Use the accent color for: top border on cards, active tab indicators, send button, progress indicators, badges.

### Chat UI
- Messages alternate: user messages right-aligned with colored background (vertical accent color), AI messages left-aligned with dark card background
- Each message shows: small user avatar (from Google profile) + name above the message, timestamp below
- AI messages show a generic "AI Analyst" avatar (a brain icon or similar)
- Typing indicator: three pulsing dots when waiting for AI response
- Chat scrolls to bottom on new messages
- Input area: text field + mic button + send button. Text field should support multi-line (shift+enter for new line, enter to send)

### Process Map UI
- Vertical flow layout — steps stack top to bottom
- Each step card has:
  - Left border colored by pain level (green = low, yellow = medium, red = high)
  - Step number in a small circle
  - Step name (bold)
  - Description (regular text)
  - Metadata row: owner badge, tools badge, time badge, automation potential badge
  - If confidence is "low", show a subtle "⚠ Low confidence" indicator
- Feedback buttons appear on hover or always visible on mobile
- "Generate Process Map" is a prominent button, centered, with a gradient background
- While generating, show a loading state: "Analyzing all context... This may take 15-30 seconds"

---

## 7. API ENDPOINTS

### Authentication
- `GET /auth/google` — Initiates Google OAuth flow
- `GET /auth/google/callback` — OAuth callback, creates/updates user, sets session
- `GET /auth/logout` — Clears session
- `GET /api/me` — Returns current user info + admin status

### Verticals
- `GET /api/verticals` — Returns all 6 verticals with stats (message count, doc count, note count, process map status, contributor count)
- `GET /api/verticals/:id` — Returns single vertical with all stats

### Chat
- `POST /api/chat` — Body: `{ verticalId, message }`. Sends to Claude API, stores both messages, returns AI response.
- `GET /api/chat/:verticalId` — Returns full message history for a vertical (paginated if needed)

### Documents
- `POST /api/documents/upload` — Multipart form: file + verticalId + docType + description. Stores file and creates DB record.
- `POST /api/documents/:id/process` — Triggers AI extraction for a document. Called automatically after upload.
- `GET /api/documents/:verticalId` — Returns all documents for a vertical with extracted content.

### Notes
- `POST /api/notes` — Body: `{ verticalId, content, category }`. Creates note.
- `GET /api/notes/:verticalId` — Returns all notes for a vertical.

### Process Maps
- `POST /api/process-map/generate` — Body: `{ verticalId }`. Collects all context, calls Claude, stores result.
- `GET /api/process-map/:verticalId` — Returns latest process map for a vertical.
- `POST /api/process-map/:id/feedback` — Body: `{ stepNumber, feedbackType, content }`. Stores feedback.
- `GET /api/process-map/:id/feedback` — Returns all feedback for a process map.

### Admin
- `GET /api/admin/overview` — Returns stats for all verticals (admin only)
- `GET /api/admin/vertical/:id` — Returns full detail for a vertical including all contributors, messages, documents, notes, process map with feedback (admin only)
- `GET /api/admin/export/:verticalId?format=json|markdown` — Returns export file (admin only)
- `GET /api/admin/export-all` — Returns ZIP of all verticals (admin only)

---

## 8. IMPORTANT IMPLEMENTATION NOTES

### Claude API Integration
- ALL Claude API calls must go through the backend. Never expose the ANTHROPIC_API_KEY to the frontend.
- Model to use: `claude-sonnet-4-20250514`
- For chat: `max_tokens: 1024`
- For document extraction: `max_tokens: 2048`
- For process map generation: `max_tokens: 4096`
- Handle rate limits gracefully — if the API returns a rate limit error, retry after a delay with exponential backoff.
- For document processing (PDF/images), send as base64 using Claude's document/image content types.

### Conversation History Management
- When sending chat messages to Claude, include the FULL conversation history for that vertical
- If the conversation gets very long (>50 messages), truncate older messages but always include the last 30 + a summary of earlier context
- The system prompt is sent with every request and is not stored in the messages table

### File Storage
- Store uploaded files on Replit's filesystem under a `/uploads/:verticalId/` directory
- Filename format: `{timestamp}_{originalFilename}` to avoid conflicts

### Error Handling
- If Claude API call fails, show a user-friendly error: "Our AI is taking a break. Please try again in a moment."
- If document processing fails, mark status as 'failed' and show: "We couldn't process this document. Please try uploading again or use a different format."
- If process map generation fails, show: "Couldn't generate the process map. There may not be enough context yet — try adding more through chat or documents."

### Performance
- Chat should feel responsive — show a typing indicator immediately when the user sends a message
- Document processing happens in the background — user can continue chatting while a document is being processed
- Process map generation can take 15-30 seconds — show a clear loading state with a message like "Analyzing all conversations, documents, and notes..."

---

## 9. DEPLOYMENT CHECKLIST

1. Set up Google OAuth credentials in Google Cloud Console
2. Set environment variables: ANTHROPIC_API_KEY, ADMIN_EMAILS, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET
3. Pre-populate the verticals table with the 6 entries from Section 2
4. Deploy on Replit — ensure the URL is clean and shareable
5. Test: log in with admin email, verify admin dashboard access
6. Test: log in with a non-admin email, verify you can chat, upload docs, add notes
7. Test: generate a process map after adding some context
8. Share the URL with BU representatives

---

## 10. SUCCESS CRITERIA

After 1-2 weeks of usage:
- Each vertical has had meaningful chat sessions covering core operations
- Key documents have been uploaded and processed
- Process maps have been generated and received at least one round of feedback
- Admin can export structured data for any vertical and use it for AI agent planning
