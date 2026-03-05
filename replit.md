# Context Brain

## Overview
Context Brain is an AI-powered intelligence-gathering platform for BetterPlace Group's AI Labs team. It captures operational context from 6 business verticals through AI-guided conversations, document uploads, notes, and AI-generated process intelligence.

## Architecture
- **Backend:** Python/Flask with PostgreSQL database
- **Frontend:** Jinja2 templates + vanilla JavaScript
- **AI:** Anthropic Claude (claude-sonnet-4-20250514) via user's own ANTHROPIC_API_KEY for chat, document processing, and process intelligence generation
- **Auth:** PIN-based login (email + 4-digit PIN) restricted to allowlist of authorized emails

## File Structure
- `app.py` - Main Flask application, configuration, blueprint registration, DB init with user seeding
- `models.py` - SQLAlchemy models (User, Vertical, Message, Document, Note, ProcessMap, ProcessMapFeedback, VerticalIntelligence, IntelligenceFeedback)
- `pin_auth.py` - PIN-based authentication blueprint (login with email + 4-digit PIN, logout)
- `ai_service.py` - Anthropic Claude API integration (chat, document extraction, process intelligence generation with 6-section analysis)
- `routes.py` - All API and page routes (main_routes, api_routes, admin_routes)
- `templates/` - Jinja2 HTML templates (base, login, dashboard, vertical, admin)
- `static/css/style.css` - Dark theme CSS with per-vertical accent colors
- `static/js/dashboard.js` - Dashboard page JavaScript
- `static/js/vertical.js` - Vertical workspace JavaScript (chat, documents, notes, process intelligence)
- `static/js/admin.js` - Admin dashboard JavaScript with user management

## Database Tables
- `users` - User accounts (id=email, email, display_name, is_admin, pin, last_active_at)
- `verticals` - 6 pre-populated business verticals with seed context
- `messages` - Chat messages (user + AI assistant)
- `documents` - Uploaded documents with AI extraction status and file_data (base64 storage in DB)
- `notes` - User notes with category tags
- `process_maps` - AI-generated process maps (versioned, legacy)
- `process_map_feedback` - User feedback on process map steps (legacy)
- `vertical_intelligence` - AI-generated 6-section intelligence data with context hashing for cache invalidation
- `intelligence_feedback` - User feedback/edits on intelligence sections

## 6 Business Verticals
1. **OkayGo** (OG) - Gig Task Fulfillment (India) - #E85D26
2. **Troopers** (TR) - Part-time/Gig Staffing (Malaysia + Singapore) - #2563EB
3. **MyRobin** (MR) - Outsourcing/BPO (Indonesia) - #059669
4. **AasaanJobs** (AJ) - Blue-collar Recruitment (India) - #7C3AED
5. **Background Verification** (BV) - Verification & Compliance (India) - #DC2626
6. **goBetter** (gB) - Enterprise Software HRMS+LMS (India) - #0891B2

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-set)
- `SESSION_SECRET` - Flask session secret
- `ANTHROPIC_API_KEY` - Anthropic API key for Claude AI
- `ALLOWED_EMAILS` - Comma-separated list of authorized user emails (24 emails)
- `ADMIN_EMAILS` - Comma-separated admin email addresses

## Key Features
- PIN-based authentication (email + 4-digit PIN) for 24 authorized BetterPlace team members
- Admin user management (view/add/remove users, regenerate PINs)
- AI-guided conversational intake per vertical using Claude
- Document upload with AI content extraction (PDF, DOCX, TXT, CSV, XLSX, images) stored as base64 in DB (50MB limit)
- Notes with category tagging
- 6-section Process Intelligence dashboard:
  - Business Profile (editable fields)
  - Knowledge Gaps (interactive checklist)
  - Process Map (with pain level borders, automation badges, feedback)
  - Pain Points (severity-ranked cards)
  - Team & Org Structure (role table)
  - Tools & Systems (inventory table)
- Context hashing for intelligent cache invalidation
- Admin dashboard with cross-vertical analytics and data export (JSON, Markdown, ZIP)
- Voice input via Web Speech API
- Dark UI theme with per-vertical accent colors

## Auth Flow
1. User enters work email and 4-digit PIN on login page
2. If email is in ALLOWED_EMAILS and PIN matches, user is logged in
3. Admin can view all users' PINs and regenerate them at /admin
4. 24 users auto-seeded with random PINs on first startup

## Process Intelligence Flow
1. User captures context via chat, documents, and notes in a vertical
2. User clicks "Generate Intelligence" in Process Intelligence tab
3. System gathers all context (messages, docs, notes, previous feedback)
4. Claude generates structured JSON with 6 sections + context coverage
5. Result cached in vertical_intelligence table with context hash
6. Users can provide inline feedback (correct/edit/flag) on any section
7. Feedback incorporated into next intelligence refresh

## Deployment
- Autoscale target with gunicorn (--preload --timeout 120)
- Health check endpoint: /healthz
- Files stored as base64 in PostgreSQL (survive container restarts)

## Important Notes
- Icons use 2-letter text codes (OG, TR, MR, AJ, BV, gB) - no emoji to avoid UTF-8 encoding errors
- otp_auth.py is legacy/unused - pin_auth.py is the active auth module
- DB pool configured with pool_pre_ping and pool_recycle to handle connection issues
- init_db() uses lock_timeout on ALTER TABLE to prevent deadlocks with Flask reloader
