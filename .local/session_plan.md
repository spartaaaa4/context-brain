# Objective
Implement three major updates to Context Brain:
1. **Auth:** Replace OTP-on-screen with PIN-based login. Admin can manage users and their 4-digit PINs.
2. **File Storage:** Store uploaded files as base64 in PostgreSQL for persistence. Improve Excel/DOCX extraction. Increase upload limit to 50MB.
3. **Process Intelligence:** Complete redesign from single "Generate" button to a 6-section living intelligence dashboard (Business Profile, Knowledge Gaps, Process Map, Pain Points, Team Structure, Tools Inventory) with auto-generation, inline feedback, and progressive disclosure.

# Tasks

### T001: Auth — Replace OTP with PIN-based login + Admin user management
- **Blocked By**: []
- **Details**:
  - Add `pin` column (TEXT) to `users` table
  - Pre-generate a random 4-digit PIN for each of the 24 allowed emails
  - Update `otp_auth.py`: login now accepts email + PIN instead of OTP flow
    - Remove OTP generation/verification logic
    - Verify email is in ALLOWED_EMAILS, then check PIN matches DB
    - On first login attempt for a new user, auto-create user record with pre-generated PIN
  - Update `templates/login.html`: single form with email + PIN fields (no two-step flow)
  - Remove `templates/verify_otp.html` (no longer needed)
  - Remove `otp_codes` table creation from `init_db()`
  - Add admin API endpoints in `routes.py`:
    - `GET /admin/api/users` — list all users with their PINs
    - `POST /admin/api/users` — add a new user email + generate PIN
    - `PUT /admin/api/users/<email>/pin` — regenerate PIN for a user
    - `DELETE /admin/api/users/<email>` — remove a user
  - Add "User Management" section to admin dashboard (`templates/admin.html` + `static/js/admin.js`)
    - Table showing all allowed emails, their PINs, display names, last active timestamps
    - "Add User" button, "Regenerate PIN" button per user, "Remove" button
  - Seed all 24 users from ALLOWED_EMAILS with auto-generated PINs in `init_db()`
  - Files: `otp_auth.py`, `app.py`, `models.py`, `routes.py`, `templates/login.html`, `templates/admin.html`, `static/js/admin.js`, `static/css/style.css`
  - Acceptance: User can log in with email + PIN. Admin can view/manage users and PINs at /admin.

### T002: File Storage — Store files in DB as base64 + improve extraction
- **Blocked By**: []
- **Details**:
  - Add `file_data` TEXT column to `documents` table in `models.py`
  - Update upload route in `routes.py`: convert uploaded file to base64 and store in `file_data` column
  - Update `MAX_CONTENT_LENGTH` from 10MB to 50MB in `app.py`
  - Update frontend upload validation text from "max 10MB" to "max 50MB" in `templates/vertical.html`
  - Update `ai_service.py` `process_document_background()`:
    - Read file content from `doc.file_data` (base64) instead of filesystem
    - For XLSX: use openpyxl to convert to text (with sheet names, headers, row data)
    - For DOCX: use python-docx to extract text + tables
    - For CSV/TXT: decode base64 to text
    - For PDF/images: pass base64 directly to Claude API
  - Add download endpoint: `GET /api/documents/<id>/download` — serve file from base64 in DB
  - Add `pandas` to `requirements.txt` if needed for Excel handling
  - Files: `models.py`, `app.py`, `routes.py`, `ai_service.py`, `templates/vertical.html`, `requirements.txt`
  - Acceptance: Files survive production restarts. Excel/DOCX extraction produces readable text for Claude. Upload limit is 50MB.

### T003: Database — Add intelligence tables
- **Blocked By**: []
- **Details**:
  - Add `vertical_intelligence` table: `id`, `vertical_id` (FK), `intelligence_data` (TEXT/JSON), `context_hash` (TEXT), `generated_at` (TIMESTAMP), `generated_by` (TEXT FK)
  - Add `intelligence_feedback` table: `id`, `vertical_id` (FK), `user_id` (FK), `section` (TEXT), `field_path` (TEXT), `feedback_type` (TEXT), `original_value` (TEXT), `corrected_value` (TEXT), `comment` (TEXT), `created_at` (TIMESTAMP)
  - Add these as SQLAlchemy models in `models.py`
  - Add table creation in `init_db()` in `app.py`
  - Files: `models.py`, `app.py`
  - Acceptance: Tables exist and can be queried.

### T004: Process Intelligence — Backend API + AI prompt
- **Blocked By**: [T003]
- **Details**:
  - Add new function `generate_intelligence()` in `ai_service.py`:
    - Gathers ALL context (messages, documents, notes, previous intelligence, feedback)
    - Computes a context hash to detect changes
    - Makes ONE Claude API call with a comprehensive prompt returning JSON with 6 sections:
      - businessProfile, processMap, teamStructure, toolsInventory, painPoints, knowledgeGaps
      - Plus contextCoverage booleans
    - Uses max_tokens: 8192
    - Stores result in `vertical_intelligence` table with context_hash
  - Add API routes in `routes.py`:
    - `GET /api/intelligence/<vertical_id>` — returns cached intelligence or generates fresh if no cache/stale
    - `POST /api/intelligence/<vertical_id>/refresh` — force regeneration
    - `POST /api/intelligence/<vertical_id>/feedback` — save feedback to `intelligence_feedback` table
    - `PUT /api/intelligence/<vertical_id>/business-profile` — inline edit of business profile fields
  - Keep existing process map generate/feedback endpoints for backward compatibility
  - Files: `ai_service.py`, `routes.py`
  - Acceptance: API returns structured intelligence JSON. Caching works. Feedback is stored.

### T005: Process Intelligence — Frontend redesign
- **Blocked By**: [T004]
- **Details**:
  - Redesign the Process Intelligence tab in `templates/vertical.html` and `static/js/vertical.js`:
    - Replace single "Generate" button with 6-section layout
    - On tab open: call `GET /api/intelligence/<vertical_id>`, show loading state, render all sections
  - **Section A: Business Profile** — structured card with editable fields, edit icon per field, inline save
  - **Section B: Knowledge Gaps** — checklist of questions, click to answer inline (saves as note) or "Discuss in Chat" link
  - **Section C: Process Map** — enhanced step cards with colored pain-level borders, automation badges, confidence tags, feedback buttons (Correct/Partially Right/Wrong + text field)
  - **Section D: Pain Points & Automation** — ranked cards by severity (red/amber/green), with accuracy toggle
  - **Section E: Team & Org Structure** — role table with headcount, responsibilities, process steps
  - **Section F: Tools & Systems** — table with tool name, type, used in, used by
  - "Refresh Intelligence" button with "Last updated: timestamp" and "New context available" banner
  - Empty/null states for each section with guidance messages
  - Before enough context: show progress checklist of what's been captured vs what's needed
  - Files: `templates/vertical.html`, `static/js/vertical.js`, `static/css/style.css`
  - Acceptance: All 6 sections render correctly. Feedback works. Empty states show guidance. Refresh works.

### T006: Testing & Polish
- **Blocked By**: [T001, T002, T005]
- **Details**:
  - Test PIN login flow end-to-end
  - Test admin user management (add/remove users, view PINs)
  - Test file upload persistence (upload, restart, verify file still accessible)
  - Test Process Intelligence tab with various context states
  - Test on the deployed version
  - Verify no regressions in chat, documents, notes tabs
  - Update `replit.md` with all changes
  - Files: all
  - Acceptance: All features work in dev and production.
