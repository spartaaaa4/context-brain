# Context Brain

## Overview
Context Brain is an AI-powered intelligence-gathering platform for BetterPlace Group's AI Labs team. It captures operational context from 6 business verticals through AI-guided conversations, document uploads, notes, and AI-generated process maps.

## Architecture
- **Backend:** Python/Flask with PostgreSQL database
- **Frontend:** Jinja2 templates + vanilla JavaScript
- **AI:** Anthropic Claude (via Replit AI Integrations) for chat, document processing, and process map generation
- **Auth:** Email OTP login restricted to an allowlist of authorized emails (stored in ALLOWED_EMAILS env var)

## File Structure
- `app.py` - Main Flask application, configuration, blueprint registration
- `models.py` - SQLAlchemy database models (User, Vertical, Message, Document, Note, ProcessMap, ProcessMapFeedback)
- `otp_auth.py` - Email OTP authentication blueprint (login, verify, resend, logout)
- `ai_service.py` - Anthropic Claude API integration (chat, document extraction, process map generation)
- `routes.py` - All API and page routes (main_routes, api_routes, admin_routes)
- `templates/` - Jinja2 HTML templates (base, login, verify_otp, dashboard, vertical, admin)
- `static/css/style.css` - Dark theme CSS with per-vertical accent colors
- `static/js/dashboard.js` - Dashboard page JavaScript
- `static/js/vertical.js` - Vertical workspace JavaScript (chat, documents, notes, process maps)
- `static/js/admin.js` - Admin dashboard JavaScript
- `uploads/` - Uploaded document storage (organized by vertical ID)

## Database Tables
- `users` - User accounts (id=email, email, display_name, is_admin)
- `verticals` - 6 pre-populated business verticals
- `messages` - Chat messages (user + AI assistant)
- `documents` - Uploaded documents with AI extraction status
- `notes` - User notes with category tags
- `process_maps` - AI-generated process maps (versioned)
- `process_map_feedback` - User feedback on process map steps
- `otp_codes` - OTP codes for email login (with expiry)

## 6 Business Verticals
1. **OkayGo** - Gig Task Fulfillment (India) - #E85D26
2. **Troopers** - Part-time/Gig Staffing (Malaysia + Singapore) - #2563EB
3. **MyRobin** - Outsourcing/BPO (Indonesia) - #059669
4. **AasaanJobs** - Blue-collar Recruitment (India) - #7C3AED
5. **Background Verification** - Verification & Compliance (India) - #DC2626
6. **goBetter** - Enterprise Software HRMS+LMS (India) - #0891B2

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-set)
- `SESSION_SECRET` - Flask session secret
- `ALLOWED_EMAILS` - Comma-separated list of authorized user emails (24 emails)
- `ADMIN_EMAILS` - Comma-separated admin email addresses
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY` - Auto-set by Replit AI Integrations
- `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` - Auto-set by Replit AI Integrations
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` - Optional SMTP config for email delivery

## Key Features
- Email OTP authentication restricted to 24 authorized BetterPlace team members
- AI-guided conversational intake per vertical using Claude
- Document upload with AI content extraction (PDF, DOCX, TXT, CSV, XLSX, images)
- Notes with category tagging
- AI-generated process maps with step-by-step feedback
- Admin dashboard with cross-vertical analytics and data export (JSON, Markdown, ZIP)
- Voice input via Web Speech API
- Dark UI theme with per-vertical accent colors

## Auth Flow
1. User enters work email on login page
2. If email is in ALLOWED_EMAILS, a 6-digit OTP is generated (valid 10 minutes)
3. OTP is sent via SMTP email (if configured) or logged to server console
4. User enters OTP on verification page
5. On valid OTP, user is logged in and redirected to dashboard
