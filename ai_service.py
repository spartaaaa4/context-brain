import os
import io
import json
import base64
import threading
from anthropic import Anthropic
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception
import hashlib
from models import db, Message, Document, Vertical, Note, ProcessMap, ProcessMapFeedback, VerticalIntelligence, IntelligenceFeedback

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")

client = Anthropic(
    api_key=ANTHROPIC_API_KEY,
)


def is_rate_limit_error(exception):
    error_msg = str(exception)
    return (
        "429" in error_msg
        or "RATELIMIT_EXCEEDED" in error_msg
        or "quota" in error_msg.lower()
        or "rate limit" in error_msg.lower()
        or (hasattr(exception, "status_code") and exception.status_code == 429)
    )


def get_chat_system_prompt(vertical):
    return f"""You are an AI process analyst working for BetterPlace Group's Central AI Labs team. You are conducting a structured intake to understand the operations of {vertical.name} ({vertical.geography} — {vertical.type}).

{vertical.seed_context}

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

CRITICAL: You are gathering intelligence to help build AI automation. Pay extra attention to manual, repetitive, time-consuming activities — those are the highest-value automation targets. When you hear something manual, always ask: how long does it take, how often, and how many people are involved."""


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    retry=retry_if_exception(is_rate_limit_error),
    reraise=True
)
def send_chat_message(vertical, messages_history, user_message):
    system_prompt = get_chat_system_prompt(vertical)

    api_messages = []
    for msg in messages_history:
        api_messages.append({
            "role": msg.role,
            "content": msg.content
        })

    if len(api_messages) > 50:
        summary_msgs = api_messages[:-30]
        recent_msgs = api_messages[-30:]
        summary_text = "\n".join([f"{m['role']}: {m['content'][:200]}" for m in summary_msgs])
        api_messages = [{"role": "user", "content": f"[Summary of earlier conversation:\n{summary_text}\n]"},
                        {"role": "assistant", "content": "Thank you for the context. Let me continue our conversation."}] + recent_msgs

    api_messages.append({"role": "user", "content": user_message})

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=system_prompt,
        messages=api_messages
    )

    return response.content[0].text


def get_document_extraction_prompt(vertical, doc_type, user_description):
    return f"""You are analyzing a document uploaded by a team member from {vertical.name} ({vertical.geography} — {vertical.type}).

The user described this document as: "{user_description}"
Document type: {doc_type}

Extract and structure the following information from this document. Return ONLY valid JSON (no markdown, no backticks):

{{
  "summary": "2-3 sentence summary of what this document covers",
  "processSteps": [
    {{
      "name": "Step name",
      "description": "What happens in this step",
      "owner": "Who is responsible (if mentioned)",
      "tools": "Tools/systems referenced (if any)"
    }}
  ],
  "rolesFound": ["List of job roles or team names mentioned"],
  "toolsFound": ["List of software, apps, or systems mentioned"],
  "metricsFound": {{}},
  "painPointsFound": ["Any complaints, bottlenecks, or issues mentioned"],
  "keyFacts": ["Other important facts or context extracted"],
  "relevanceScore": "high|medium|low — how relevant is this to understanding operational processes"
}}

If this is a meeting transcript, also extract:
- "decisions": ["Decisions made during the meeting"]
- "actionItems": ["Action items assigned"]
- "discussionTopics": ["Key topics discussed"]

Be thorough. Extract everything that could help understand this organization's operations."""


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    retry=retry_if_exception(is_rate_limit_error),
    reraise=True
)
def process_document_content(doc, vertical, text_content=None, base64_content=None, media_type=None):
    system_prompt = get_document_extraction_prompt(vertical, doc.doc_type, doc.user_description or "")

    messages_content = []
    if base64_content and media_type:
        if media_type.startswith("image/"):
            messages_content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": base64_content,
                }
            })
        else:
            messages_content.append({
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": base64_content,
                }
            })
        messages_content.append({
            "type": "text",
            "text": "Please analyze this document and extract structured information."
        })
    elif text_content:
        messages_content.append({
            "type": "text",
            "text": f"Document content:\n\n{text_content}\n\nPlease analyze this document and extract structured information."
        })
    else:
        return None

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2048,
        system=system_prompt,
        messages=[{"role": "user", "content": messages_content}]
    )

    return response.content[0].text


def process_document_background(app, doc_id):
    with app.app_context():
        doc = Document.query.get(doc_id)
        if not doc:
            return

        doc.processing_status = 'processing'
        db.session.commit()

        try:
            vertical = Vertical.query.get(doc.vertical_id)
            file_path = doc.file_path

            text_content = None
            base64_content = None
            media_type = None

            if doc.file_type in ('txt', 'csv'):
                if doc.file_data:
                    text_content = base64.b64decode(doc.file_data).decode('utf-8', errors='ignore')[:50000]
                else:
                    with open(file_path, 'r', errors='ignore') as f:
                        text_content = f.read()[:50000]
            elif doc.file_type == 'xlsx':
                import openpyxl
                if doc.file_data:
                    wb = openpyxl.load_workbook(io.BytesIO(base64.b64decode(doc.file_data)))
                else:
                    wb = openpyxl.load_workbook(file_path)
                text_parts = []
                for sheet in wb.worksheets:
                    text_parts.append(f"=== Sheet: {sheet.title} ===")
                    rows = list(sheet.iter_rows(values_only=True))
                    if rows:
                        headers = [str(c) if c is not None else "" for c in rows[0]]
                        text_parts.append("Headers: " + " | ".join(headers))
                        for row in rows[1:]:
                            row_data = []
                            for i, cell in enumerate(row):
                                header = headers[i] if i < len(headers) else f"Col{i}"
                                val = str(cell) if cell is not None else ""
                                if val:
                                    row_data.append(f"{header}: {val}")
                            if row_data:
                                text_parts.append(", ".join(row_data))
                text_content = "\n".join(text_parts)[:50000]
            elif doc.file_type == 'docx':
                import docx
                if doc.file_data:
                    document = docx.Document(io.BytesIO(base64.b64decode(doc.file_data)))
                else:
                    document = docx.Document(file_path)
                text_parts = []
                for p in document.paragraphs:
                    if p.text.strip():
                        text_parts.append(p.text)
                for table in document.tables:
                    text_parts.append("\n[Table]")
                    for row in table.rows:
                        row_text = " | ".join([cell.text.strip() for cell in row.cells])
                        text_parts.append(row_text)
                text_content = "\n".join(text_parts)[:50000]
            elif doc.file_type == 'pdf':
                if doc.file_data:
                    base64_content = doc.file_data
                else:
                    with open(file_path, 'rb') as f:
                        base64_content = base64.b64encode(f.read()).decode('utf-8')
                media_type = "application/pdf"
            elif doc.file_type in ('image', 'png', 'jpg', 'jpeg'):
                ext_map = {'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'image': 'image/jpeg'}
                media_type = ext_map.get(doc.file_type, 'image/jpeg')
                if doc.file_data:
                    base64_content = doc.file_data
                else:
                    with open(file_path, 'rb') as f:
                        base64_content = base64.b64encode(f.read()).decode('utf-8')

            result = process_document_content(doc, vertical, text_content, base64_content, media_type)
            if result:
                doc.extracted_content = result
                doc.processing_status = 'done'
            else:
                doc.processing_status = 'failed'
        except Exception as e:
            print(f"Document processing error: {e}")
            doc.processing_status = 'failed'

        db.session.commit()


def start_document_processing(app, doc_id):
    thread = threading.Thread(target=process_document_background, args=(app, doc_id))
    thread.daemon = True
    thread.start()


def get_process_map_prompt(vertical):
    # Single Claude API call returns all 6 sections: businessOverview, processMap, keyInsights, topAutomationTargets, knowledgeGaps, communicationChannels/complianceNotes
    return f"""You are a senior process analyst at BetterPlace Group's AI Labs. You have been given all available context about {vertical.name} ({vertical.geography} — {vertical.type}).

Your job is to produce a comprehensive, structured analysis of this business unit.

Produce a complete analysis. Return ONLY valid JSON (no markdown, no backticks):

{{
  "businessOverview": {{
    "summary": "2-3 paragraph description of what this business does and how it operates",
    "businessModel": "How they make money",
    "scale": {{
      "workers": "Size of worker network",
      "clients": "Number and type of clients",
      "geography": "Where they operate",
      "volume": "Transactions/tasks/hires per period"
    }},
    "teamStructure": "Description of the team — roles, headcount, reporting structure",
    "toolsAndSystems": ["List of all tools, software, apps, systems they use"],
    "keyClients": ["Notable client names if mentioned"]
  }},
  "processMap": {{
    "processName": "Name of the core process",
    "steps": [
      {{
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
        "confidence": "high|medium|low",
        "notes": "Additional context"
      }}
    ]
  }},
  "keyInsights": ["Important patterns, observations, or strategic insights"],
  "topAutomationTargets": [
    {{
      "target": "What to automate",
      "currentCost": "Time/money/people currently spent",
      "automationApproach": "How AI could handle this",
      "expectedImpact": "What improvement to expect",
      "priority": "high|medium|low"
    }}
  ],
  "knowledgeGaps": ["Specific questions or topics where information is still missing"],
  "communicationChannels": ["How this BU communicates with workers"],
  "complianceNotes": "Any regulatory, legal, or compliance requirements mentioned"
}}

IMPORTANT RULES:
- If the previous process map exists and feedback was provided, incorporate ALL feedback
- Set confidence to 'low' for any step where you are inferring rather than directly told
- Be specific — avoid generic descriptions
- If information was NOT provided for a field, set it to null rather than guessing
- The knowledgeGaps section is critical — be thorough about what we still need to learn"""


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=60),
    retry=retry_if_exception(is_rate_limit_error),
    reraise=True
)
def generate_process_map(vertical_id, user_id):
    vertical = Vertical.query.get(vertical_id)
    if not vertical:
        return None

    messages = Message.query.filter_by(vertical_id=vertical_id).order_by(Message.created_at).all()
    documents = Document.query.filter_by(vertical_id=vertical_id, processing_status='done').all()
    notes = Note.query.filter_by(vertical_id=vertical_id).all()
    prev_map = ProcessMap.query.filter_by(vertical_id=vertical_id).order_by(ProcessMap.version.desc()).first()

    context_parts = []

    if messages:
        context_parts.append("--- CONVERSATION TRANSCRIPT ---")
        for msg in messages:
            user = msg.user
            name = user.display_name if user and msg.role == 'user' else 'AI Analyst'
            context_parts.append(f"{name} ({msg.role}): {msg.content}")

    if documents:
        context_parts.append("\n--- UPLOADED DOCUMENTS (AI-extracted content) ---")
        for doc in documents:
            context_parts.append(f"Document: {doc.filename} (Type: {doc.doc_type})")
            if doc.extracted_content:
                context_parts.append(doc.extracted_content)

    if notes:
        context_parts.append("\n--- NOTES ---")
        for note in notes:
            context_parts.append(f"[{note.category}] {note.content}")

    if prev_map:
        context_parts.append("\n--- PREVIOUS PROCESS MAP ---")
        context_parts.append(prev_map.map_data)

        feedback_entries = ProcessMapFeedback.query.filter_by(process_map_id=prev_map.id).all()
        if feedback_entries:
            context_parts.append("\n--- USER FEEDBACK ON PREVIOUS MAP ---")
            for fb in feedback_entries:
                step_info = f"Step {fb.step_number}" if fb.step_number else "General"
                context_parts.append(f"{step_info} [{fb.feedback_type}]: {fb.content}")

    full_context = "\n".join(context_parts)

    system_prompt = get_process_map_prompt(vertical)

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=8192,
        system=system_prompt,
        messages=[{
            "role": "user",
            "content": f"CONTEXT PROVIDED:\n\n{full_context}\n\nPlease produce the comprehensive analysis."
        }]
    )

    result_text = response.content[0].text

    new_version = (prev_map.version + 1) if prev_map else 1
    source_summary = f"Generated from {len(messages)} messages, {len(documents)} documents, {len(notes)} notes"
    if prev_map:
        feedback_count = ProcessMapFeedback.query.filter_by(process_map_id=prev_map.id).count()
        source_summary += f", incorporating {feedback_count} feedback items from v{prev_map.version}"

    process_map = ProcessMap(
        vertical_id=vertical_id,
        generated_by=user_id,
        version=new_version,
        map_data=result_text,
        source_summary=source_summary
    )
    db.session.add(process_map)
    db.session.commit()

    return process_map


def compute_context_hash(vertical_id):
    messages = Message.query.filter_by(vertical_id=vertical_id).count()
    documents = Document.query.filter_by(vertical_id=vertical_id, processing_status='done').count()
    notes = Note.query.filter_by(vertical_id=vertical_id).count()
    feedback = IntelligenceFeedback.query.filter_by(vertical_id=vertical_id).count()
    latest_msg = Message.query.filter_by(vertical_id=vertical_id).order_by(Message.created_at.desc()).first()
    latest_ts = latest_msg.created_at.isoformat() if latest_msg else ""
    raw = f"{messages}:{documents}:{notes}:{feedback}:{latest_ts}"
    return hashlib.md5(raw.encode()).hexdigest()


def gather_all_context(vertical_id):
    messages = Message.query.filter_by(vertical_id=vertical_id).order_by(Message.created_at).all()
    documents = Document.query.filter_by(vertical_id=vertical_id, processing_status='done').all()
    notes = Note.query.filter_by(vertical_id=vertical_id).all()

    context_parts = []

    if messages:
        context_parts.append("--- CONVERSATION TRANSCRIPT ---")
        for msg in messages:
            user = msg.user
            name = user.display_name if user and msg.role == 'user' else 'AI Analyst'
            context_parts.append(f"{name} ({msg.role}): {msg.content}")

    if documents:
        context_parts.append("\n--- UPLOADED DOCUMENTS (AI-extracted content) ---")
        for doc in documents:
            context_parts.append(f"Document: {doc.filename} (Type: {doc.doc_type})")
            if doc.extracted_content:
                context_parts.append(doc.extracted_content)

    if notes:
        context_parts.append("\n--- NOTES ---")
        for note in notes:
            context_parts.append(f"[{note.category}] {note.content}")

    return "\n".join(context_parts), len(messages), len(documents), len(notes)


def get_intelligence_prompt(vertical):
    return f"""You are a senior process analyst at BetterPlace Group's AI Labs. Analyze all available context for {vertical.name} ({vertical.geography} -- {vertical.type}) and produce a comprehensive intelligence report.

{vertical.seed_context}

Return ONLY valid JSON (no markdown, no backticks):

{{
  "businessProfile": {{
    "whatTheyDo": "2-3 sentence description or null",
    "businessModel": "How they make money or null",
    "geography": "Where they operate or null",
    "scale": {{
      "workerNetwork": "Size or null",
      "clientCount": "Number or null",
      "monthlyVolume": "Tasks/hires/shifts per month or null"
    }},
    "keyClients": ["Client names"] or null,
    "teamSize": "Headcount and structure or null",
    "primaryLanguages": ["Languages"] or null,
    "communicationChannels": ["Channels"] or null
  }},
  "processMap": {{
    "processName": "Name of the core process",
    "steps": [
      {{
        "stepNumber": 1,
        "name": "Step name",
        "description": "Detailed description",
        "owner": "Who does this",
        "teamSize": "How many people involved or null",
        "toolsUsed": ["Tools used"],
        "estimatedTime": "How long or null",
        "volume": "How often or null",
        "painLevel": "low|medium|high",
        "painDescription": "What makes this painful or null",
        "automationPotential": "low|medium|high",
        "automationIdea": "How AI could help or null",
        "confidence": "high|medium|low",
        "notes": "Additional context or null"
      }}
    ]
  }},
  "teamStructure": [
    {{
      "role": "Role name",
      "headcount": "Number or null",
      "responsibilities": "Key responsibilities",
      "processSteps": ["Which process steps they own"]
    }}
  ],
  "toolsInventory": [
    {{
      "name": "Tool name",
      "type": "Tool type (CRM, spreadsheet, mobile app, etc.)",
      "usedIn": ["Process steps"],
      "usedBy": "Role/team"
    }}
  ],
  "painPoints": [
    {{
      "severity": "high|medium|low",
      "title": "Pain point title",
      "currentEffort": "Time/money/people spent or null",
      "affectedProcess": "Which process step or null",
      "automationIdea": "How AI could help",
      "expectedImpact": "What improvement to expect"
    }}
  ],
  "knowledgeGaps": ["Specific questions about what is still missing"],
  "contextCoverage": {{
    "businessOverview": true/false,
    "clientIntake": true/false,
    "workerSourcing": true/false,
    "screening": true/false,
    "deployment": true/false,
    "qualityReview": true/false,
    "payment": true/false,
    "compliance": true/false
  }}
}}

Rules:
- For any section where context is insufficient, return null for that section
- Set contextCoverage booleans based on whether you have REAL information (not just the seed context)
- Be specific -- use actual names, numbers, and tools mentioned in the context
- For knowledgeGaps, generate specific questions based on what is MISSING
- painPoints should only include things actually mentioned or strongly implied
- Set confidence to 'low' for any step where you are inferring rather than directly told
- If information was NOT provided for a field, set it to null rather than guessing"""


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=60),
    retry=retry_if_exception(is_rate_limit_error),
    reraise=True
)
def generate_intelligence(vertical_id, user_id, force=False):
    vertical = Vertical.query.get(vertical_id)
    if not vertical:
        return None

    current_hash = compute_context_hash(vertical_id)

    if not force:
        cached = VerticalIntelligence.query.filter_by(
            vertical_id=vertical_id
        ).order_by(VerticalIntelligence.generated_at.desc()).first()
        if cached and cached.context_hash == current_hash:
            return cached

    full_context, msg_count, doc_count, note_count = gather_all_context(vertical_id)

    if not full_context.strip():
        return None

    feedback_entries = IntelligenceFeedback.query.filter_by(vertical_id=vertical_id).all()
    if feedback_entries:
        full_context += "\n\n--- USER CORRECTIONS/FEEDBACK ---"
        for fb in feedback_entries:
            full_context += f"\n[{fb.section}] [{fb.feedback_type}] {fb.field_path or 'general'}: "
            if fb.corrected_value:
                full_context += f"Corrected to: {fb.corrected_value}"
            if fb.comment:
                full_context += f" Comment: {fb.comment}"

    system_prompt = get_intelligence_prompt(vertical)

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=8192,
        system=system_prompt,
        messages=[{
            "role": "user",
            "content": f"CONTEXT PROVIDED:\n\n{full_context}\n\nProduce the comprehensive intelligence report."
        }]
    )

    result_text = response.content[0].text

    intelligence = VerticalIntelligence(
        vertical_id=vertical_id,
        intelligence_data=result_text,
        context_hash=current_hash,
        generated_by=user_id,
    )
    db.session.add(intelligence)
    db.session.commit()

    return intelligence
