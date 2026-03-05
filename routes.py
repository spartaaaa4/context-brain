import os
import json
import time
import zipfile
import io
import random
import base64
from datetime import datetime
from flask import Blueprint, render_template, request, jsonify, redirect, url_for, send_file, send_from_directory, current_app
from flask_login import login_required, current_user
from models import db, User, Vertical, Message, Document, Note, ProcessMap, ProcessMapFeedback, VerticalIntelligence, IntelligenceFeedback
from functools import wraps

main_routes = Blueprint("main", __name__)
api_routes = Blueprint("api", __name__)
admin_routes = Blueprint("admin", __name__)


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({"error": "Not authenticated"}), 401
        from app import is_admin
        if not is_admin(current_user.email):
            return jsonify({"error": "Admin access required"}), 403
        return f(*args, **kwargs)
    return decorated


@main_routes.route("/")
def index():
    try:
        if current_user.is_authenticated:
            return render_template("dashboard.html")
    except Exception:
        pass
    return render_template("login.html")


@main_routes.route("/login_page")
def login_page():
    return redirect(url_for("pin_auth.login"))


@main_routes.route("/vertical/<vertical_id>")
@login_required
def vertical_workspace(vertical_id):
    vertical = Vertical.query.get(vertical_id)
    if not vertical:
        return redirect(url_for("main.index"))
    return render_template("vertical.html", vertical=vertical)


@main_routes.route("/admin")
@login_required
def admin_dashboard():
    from app import is_admin
    if not is_admin(current_user.email):
        return redirect(url_for("main.index"))
    return render_template("admin.html")


@main_routes.route("/uploads/<path:filename>")
@login_required
def uploaded_file(filename):
    return send_from_directory("uploads", filename)


@api_routes.route("/me")
def get_me():
    if not current_user.is_authenticated:
        return jsonify({"authenticated": False}), 401
    from app import is_admin
    return jsonify({
        "authenticated": True,
        "id": current_user.id,
        "email": current_user.email,
        "display_name": current_user.display_name,
        "profile_pic": current_user.profile_pic,
        "is_admin": is_admin(current_user.email)
    })


@api_routes.route("/verticals")
@login_required
def get_verticals():
    verticals = Vertical.query.all()
    result = []
    for v in verticals:
        msg_count = Message.query.filter_by(vertical_id=v.id).count()
        doc_count = Document.query.filter_by(vertical_id=v.id).count()
        note_count = Note.query.filter_by(vertical_id=v.id).count()

        latest_map = ProcessMap.query.filter_by(vertical_id=v.id).order_by(ProcessMap.version.desc()).first()
        map_status = "Not generated"
        if latest_map:
            feedback_count = ProcessMapFeedback.query.filter_by(process_map_id=latest_map.id).count()
            if feedback_count > 0:
                map_status = f"Generated (v{latest_map.version}) - Has feedback"
            else:
                map_status = f"Generated (v{latest_map.version})"

        contributors = db.session.query(User).join(Message, User.id == Message.user_id).filter(
            Message.vertical_id == v.id, Message.role == 'user'
        ).distinct().all()

        last_activity = db.session.query(db.func.max(Message.created_at)).filter_by(vertical_id=v.id).scalar()

        result.append({
            "id": v.id,
            "name": v.name,
            "geography": v.geography,
            "type": v.type,
            "color": v.color,
            "icon": v.icon,
            "stats": {
                "messages": msg_count,
                "documents": doc_count,
                "notes": note_count
            },
            "map_status": map_status,
            "contributors": [{"id": c.id, "name": c.display_name, "pic": c.profile_pic} for c in contributors],
            "last_activity": last_activity.isoformat() if last_activity else None
        })
    return jsonify(result)


@api_routes.route("/chat", methods=["POST"])
@login_required
def send_chat():
    data = request.json
    vertical_id = data.get("verticalId")
    message_text = data.get("message", "").strip()

    if not vertical_id or not message_text:
        return jsonify({"error": "Missing verticalId or message"}), 400

    vertical = Vertical.query.get(vertical_id)
    if not vertical:
        return jsonify({"error": "Vertical not found"}), 404

    user_msg = Message(
        vertical_id=vertical_id,
        user_id=current_user.id,
        role="user",
        content=message_text
    )
    db.session.add(user_msg)
    db.session.commit()

    current_user.last_active_at = datetime.utcnow()
    db.session.commit()

    messages_history = Message.query.filter_by(vertical_id=vertical_id).order_by(Message.created_at).all()

    try:
        from ai_service import send_chat_message
        ai_response = send_chat_message(vertical, messages_history[:-1], message_text)

        ai_msg = Message(
            vertical_id=vertical_id,
            user_id=current_user.id,
            role="assistant",
            content=ai_response
        )
        db.session.add(ai_msg)
        db.session.commit()

        return jsonify({
            "response": ai_response,
            "user_message": {
                "id": user_msg.id,
                "content": user_msg.content,
                "role": "user",
                "user_name": current_user.display_name,
                "user_pic": current_user.profile_pic,
                "created_at": user_msg.created_at.isoformat()
            },
            "ai_message": {
                "id": ai_msg.id,
                "content": ai_response,
                "role": "assistant",
                "created_at": ai_msg.created_at.isoformat()
            }
        })
    except Exception as e:
        print(f"Chat AI error: {e}")
        return jsonify({"error": "Our AI is taking a break. Please try again in a moment."}), 500


@api_routes.route("/chat/<vertical_id>")
@login_required
def get_chat_history(vertical_id):
    messages = Message.query.filter_by(vertical_id=vertical_id).order_by(Message.created_at).all()
    result = []
    for msg in messages:
        user = User.query.get(msg.user_id) if msg.user_id else None
        result.append({
            "id": msg.id,
            "role": msg.role,
            "content": msg.content,
            "user_name": user.display_name if user and msg.role == "user" else "AI Analyst",
            "user_pic": user.profile_pic if user and msg.role == "user" else None,
            "created_at": msg.created_at.isoformat()
        })
    return jsonify(result)


@api_routes.route("/documents/upload", methods=["POST"])
@login_required
def upload_document():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    vertical_id = request.form.get("verticalId")
    doc_type = request.form.get("docType", "other")
    description = request.form.get("description", "")

    if not vertical_id:
        return jsonify({"error": "Missing verticalId"}), 400

    if not file.filename:
        return jsonify({"error": "No file selected"}), 400

    allowed_extensions = {'pdf', 'docx', 'txt', 'png', 'jpg', 'jpeg', 'csv', 'xlsx'}
    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if ext not in allowed_extensions:
        return jsonify({"error": f"File type .{ext} not supported"}), 400

    file_type_map = {
        'pdf': 'pdf', 'docx': 'docx', 'txt': 'txt',
        'png': 'image', 'jpg': 'image', 'jpeg': 'image',
        'csv': 'csv', 'xlsx': 'xlsx'
    }
    file_type = file_type_map.get(ext, 'other')

    upload_dir = os.path.join("uploads", vertical_id)
    os.makedirs(upload_dir, exist_ok=True)

    file_content = file.read()
    file_data_b64 = base64.b64encode(file_content).decode('utf-8')

    safe_filename = f"{int(time.time())}_{file.filename}"
    file_path = os.path.join(upload_dir, safe_filename)
    with open(file_path, 'wb') as f:
        f.write(file_content)
    file_size = len(file_content)

    doc = Document(
        vertical_id=vertical_id,
        user_id=current_user.id,
        filename=file.filename,
        file_type=file_type,
        file_path=file_path,
        file_size=file_size,
        file_data=file_data_b64,
        doc_type=doc_type,
        user_description=description,
        processing_status='pending'
    )
    db.session.add(doc)
    db.session.commit()

    from ai_service import start_document_processing
    start_document_processing(current_app._get_current_object(), doc.id)

    return jsonify({
        "id": doc.id,
        "filename": doc.filename,
        "file_type": doc.file_type,
        "file_size": doc.file_size,
        "doc_type": doc.doc_type,
        "processing_status": doc.processing_status,
        "created_at": doc.created_at.isoformat()
    })


@api_routes.route("/documents/<vertical_id>")
@login_required
def get_documents(vertical_id):
    docs = Document.query.filter_by(vertical_id=vertical_id).order_by(Document.created_at.desc()).all()
    result = []
    for doc in docs:
        user = User.query.get(doc.user_id) if doc.user_id else None
        extracted = None
        if doc.extracted_content:
            try:
                extracted = json.loads(doc.extracted_content)
            except json.JSONDecodeError:
                extracted = {"raw": doc.extracted_content}

        result.append({
            "id": doc.id,
            "filename": doc.filename,
            "file_type": doc.file_type,
            "file_size": doc.file_size,
            "doc_type": doc.doc_type,
            "user_description": doc.user_description,
            "extracted_content": extracted,
            "processing_status": doc.processing_status,
            "uploader": {"name": user.display_name, "pic": user.profile_pic} if user else None,
            "created_at": doc.created_at.isoformat()
        })
    return jsonify(result)


@api_routes.route("/documents/<int:doc_id>/download")
@login_required
def download_document(doc_id):
    doc = Document.query.get(doc_id)
    if not doc:
        return jsonify({"error": "Document not found"}), 404

    content_type_map = {
        'pdf': 'application/pdf',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'txt': 'text/plain',
        'csv': 'text/csv',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image': 'image/jpeg',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
    }
    content_type = content_type_map.get(doc.file_type, 'application/octet-stream')

    if doc.file_data:
        file_bytes = base64.b64decode(doc.file_data)
        return send_file(
            io.BytesIO(file_bytes),
            mimetype=content_type,
            as_attachment=True,
            download_name=doc.filename
        )
    elif doc.file_path and os.path.exists(doc.file_path):
        return send_file(doc.file_path, mimetype=content_type, as_attachment=True, download_name=doc.filename)
    else:
        return jsonify({"error": "File not available"}), 404


@api_routes.route("/documents/<int:doc_id>/status")
@login_required
def get_document_status(doc_id):
    doc = Document.query.get(doc_id)
    if not doc:
        return jsonify({"error": "Document not found"}), 404
    extracted = None
    if doc.extracted_content:
        try:
            extracted = json.loads(doc.extracted_content)
        except json.JSONDecodeError:
            extracted = {"raw": doc.extracted_content}
    return jsonify({
        "id": doc.id,
        "processing_status": doc.processing_status,
        "extracted_content": extracted
    })


@api_routes.route("/notes", methods=["POST"])
@login_required
def create_note():
    data = request.json
    vertical_id = data.get("verticalId")
    content = data.get("content", "").strip()
    category = data.get("category", "other")

    if not vertical_id or not content:
        return jsonify({"error": "Missing verticalId or content"}), 400

    note = Note(
        vertical_id=vertical_id,
        user_id=current_user.id,
        content=content,
        category=category
    )
    db.session.add(note)
    db.session.commit()

    return jsonify({
        "id": note.id,
        "content": note.content,
        "category": note.category,
        "user_name": current_user.display_name,
        "user_pic": current_user.profile_pic,
        "created_at": note.created_at.isoformat()
    })


@api_routes.route("/notes/<vertical_id>")
@login_required
def get_notes(vertical_id):
    notes = Note.query.filter_by(vertical_id=vertical_id).order_by(Note.created_at.desc()).all()
    result = []
    for note in notes:
        user = User.query.get(note.user_id) if note.user_id else None
        result.append({
            "id": note.id,
            "content": note.content,
            "category": note.category,
            "user_name": user.display_name if user else "Unknown",
            "user_pic": user.profile_pic if user else None,
            "created_at": note.created_at.isoformat()
        })
    return jsonify(result)


@api_routes.route("/process-map/generate", methods=["POST"])
@login_required
def gen_process_map():
    data = request.json
    vertical_id = data.get("verticalId")
    if not vertical_id:
        return jsonify({"error": "Missing verticalId"}), 400

    try:
        from ai_service import generate_process_map
        process_map = generate_process_map(vertical_id, current_user.id)
        if not process_map:
            return jsonify({"error": "Could not generate process map"}), 500

        map_data = None
        try:
            map_data = json.loads(process_map.map_data)
        except json.JSONDecodeError:
            map_data = {"raw": process_map.map_data}

        return jsonify({
            "id": process_map.id,
            "version": process_map.version,
            "map_data": map_data,
            "source_summary": process_map.source_summary,
            "created_at": process_map.created_at.isoformat()
        })
    except Exception as e:
        print(f"Process map generation error: {e}")
        return jsonify({"error": "Couldn't generate the process map. There may not be enough context yet."}), 500


@api_routes.route("/process-map/<vertical_id>")
@login_required
def get_process_map(vertical_id):
    pm = ProcessMap.query.filter_by(vertical_id=vertical_id).order_by(ProcessMap.version.desc()).first()
    if not pm:
        return jsonify(None)

    map_data = None
    try:
        map_data = json.loads(pm.map_data)
    except json.JSONDecodeError:
        map_data = {"raw": pm.map_data}

    feedback = ProcessMapFeedback.query.filter_by(process_map_id=pm.id).all()
    feedback_list = [{
        "id": fb.id,
        "step_number": fb.step_number,
        "feedback_type": fb.feedback_type,
        "content": fb.content,
        "user_name": User.query.get(fb.user_id).display_name if fb.user_id else "Unknown",
        "created_at": fb.created_at.isoformat()
    } for fb in feedback]

    return jsonify({
        "id": pm.id,
        "version": pm.version,
        "map_data": map_data,
        "source_summary": pm.source_summary,
        "feedback": feedback_list,
        "created_at": pm.created_at.isoformat()
    })


@api_routes.route("/process-map/<int:map_id>/feedback", methods=["POST"])
@login_required
def submit_feedback(map_id):
    data = request.json
    step_number = data.get("stepNumber")
    feedback_type = data.get("feedbackType")
    content = data.get("content", "")

    if not feedback_type:
        return jsonify({"error": "Missing feedbackType"}), 400

    fb = ProcessMapFeedback(
        process_map_id=map_id,
        user_id=current_user.id,
        step_number=step_number,
        feedback_type=feedback_type,
        content=content
    )
    db.session.add(fb)
    db.session.commit()

    return jsonify({
        "id": fb.id,
        "step_number": fb.step_number,
        "feedback_type": fb.feedback_type,
        "content": fb.content,
        "created_at": fb.created_at.isoformat()
    })


@api_routes.route("/intelligence/<vertical_id>")
@login_required
def get_intelligence(vertical_id):
    from ai_service import compute_context_hash
    vertical = Vertical.query.get(vertical_id)
    if not vertical:
        return jsonify({"error": "Vertical not found"}), 404

    cached = VerticalIntelligence.query.filter_by(
        vertical_id=vertical_id
    ).order_by(VerticalIntelligence.generated_at.desc()).first()

    current_hash = compute_context_hash(vertical_id)
    stale = not cached or cached.context_hash != current_hash

    msg_count = Message.query.filter_by(vertical_id=vertical_id).count()
    doc_count = Document.query.filter_by(vertical_id=vertical_id, processing_status='done').count()
    note_count = Note.query.filter_by(vertical_id=vertical_id).count()

    result = {
        "has_context": msg_count > 0 or doc_count > 0 or note_count > 0,
        "context_stats": {"messages": msg_count, "documents": doc_count, "notes": note_count},
        "stale": stale,
        "intelligence": None,
        "generated_at": None,
    }

    if cached:
        try:
            result["intelligence"] = json.loads(cached.intelligence_data)
        except (json.JSONDecodeError, TypeError):
            result["intelligence"] = cached.intelligence_data
        result["generated_at"] = cached.generated_at.isoformat()

    return jsonify(result)


@api_routes.route("/intelligence/<vertical_id>/refresh", methods=["POST"])
@login_required
def refresh_intelligence(vertical_id):
    from ai_service import generate_intelligence
    vertical = Vertical.query.get(vertical_id)
    if not vertical:
        return jsonify({"error": "Vertical not found"}), 404

    try:
        intel = generate_intelligence(vertical_id, current_user.id, force=True)
        if not intel:
            return jsonify({"error": "No context available to analyze"}), 400

        try:
            data = json.loads(intel.intelligence_data)
        except (json.JSONDecodeError, TypeError):
            data = intel.intelligence_data

        return jsonify({
            "intelligence": data,
            "generated_at": intel.generated_at.isoformat(),
            "stale": False,
        })
    except Exception as e:
        return jsonify({"error": f"Intelligence generation failed: {str(e)}"}), 500


@api_routes.route("/intelligence/<vertical_id>/feedback", methods=["POST"])
@login_required
def submit_intelligence_feedback(vertical_id):
    data = request.json
    fb = IntelligenceFeedback(
        vertical_id=vertical_id,
        user_id=current_user.id,
        section=data.get("section", "general"),
        field_path=data.get("field_path"),
        feedback_type=data.get("feedback_type", "comment"),
        original_value=data.get("original_value"),
        corrected_value=data.get("corrected_value"),
        comment=data.get("comment"),
    )
    db.session.add(fb)
    db.session.commit()
    return jsonify({"id": fb.id, "status": "saved"})


@api_routes.route("/intelligence/<vertical_id>/business-profile", methods=["PUT"])
@login_required
def update_business_profile_field(vertical_id):
    data = request.json
    field = data.get("field")
    value = data.get("value")
    if not field or value is None:
        return jsonify({"error": "field and value required"}), 400

    fb = IntelligenceFeedback(
        vertical_id=vertical_id,
        user_id=current_user.id,
        section="business_profile",
        field_path=f"businessProfile.{field}",
        feedback_type="edit",
        corrected_value=value,
    )
    db.session.add(fb)
    db.session.commit()
    return jsonify({"status": "saved"})


@admin_routes.route("/api/overview")
@admin_required
def admin_overview():
    verticals = Vertical.query.all()
    result = []
    total_contributors = set()
    total_messages = 0
    total_documents = 0
    total_notes = 0

    for v in verticals:
        msg_count = Message.query.filter_by(vertical_id=v.id).count()
        doc_count = Document.query.filter_by(vertical_id=v.id).count()
        note_count = Note.query.filter_by(vertical_id=v.id).count()
        total_messages += msg_count
        total_documents += doc_count
        total_notes += note_count

        contributors = db.session.query(User.id).join(Message, User.id == Message.user_id).filter(
            Message.vertical_id == v.id, Message.role == 'user'
        ).distinct().all()
        for c in contributors:
            total_contributors.add(c[0])

        latest_map = ProcessMap.query.filter_by(vertical_id=v.id).order_by(ProcessMap.version.desc()).first()
        map_info = None
        if latest_map:
            map_info = {"version": latest_map.version, "created_at": latest_map.created_at.isoformat()}

        last_activity = db.session.query(db.func.max(Message.created_at)).filter_by(vertical_id=v.id).scalar()

        result.append({
            "id": v.id,
            "name": v.name,
            "geography": v.geography,
            "type": v.type,
            "color": v.color,
            "icon": v.icon,
            "contributors": len(contributors),
            "messages": msg_count,
            "documents": doc_count,
            "notes": note_count,
            "process_map": map_info,
            "last_activity": last_activity.isoformat() if last_activity else None
        })

    return jsonify({
        "verticals": result,
        "totals": {
            "contributors": len(total_contributors),
            "messages": total_messages,
            "documents": total_documents,
            "notes": total_notes
        }
    })


@admin_routes.route("/api/users")
@admin_required
def admin_get_users():
    users = User.query.order_by(User.created_at.desc()).all()
    from app import is_admin
    result = []
    for u in users:
        result.append({
            "email": u.email,
            "display_name": u.display_name,
            "pin": u.pin,
            "is_admin": is_admin(u.email),
            "last_active_at": u.last_active_at.isoformat() if u.last_active_at else None,
            "created_at": u.created_at.isoformat() if u.created_at else None
        })
    return jsonify(result)


@admin_routes.route("/api/users", methods=["POST"])
@admin_required
def admin_add_user():
    data = request.json
    email = data.get("email", "").strip().lower()
    if not email:
        return jsonify({"error": "Email is required"}), 400
    existing = User.query.filter_by(email=email).first()
    if existing:
        return jsonify({"error": "User already exists"}), 409
    pin = str(random.randint(1000, 9999))
    name = email.split("@")[0].replace(".", " ").replace("_", " ").title()
    import uuid
    user = User(
        id=str(uuid.uuid4()),
        email=email,
        display_name=name,
        pin=pin
    )
    db.session.add(user)
    db.session.commit()
    return jsonify({"email": user.email, "display_name": user.display_name, "pin": user.pin}), 201


@admin_routes.route("/api/users/<path:email>/pin", methods=["PUT"])
@admin_required
def admin_regen_pin(email):
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "User not found"}), 404
    user.pin = str(random.randint(1000, 9999))
    db.session.commit()
    return jsonify({"email": user.email, "pin": user.pin})


@admin_routes.route("/api/users/<path:email>", methods=["DELETE"])
@admin_required
def admin_delete_user(email):
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "User not found"}), 404
    db.session.delete(user)
    db.session.commit()
    return jsonify({"deleted": True})


@admin_routes.route("/api/vertical/<vertical_id>")
@admin_required
def admin_vertical_detail(vertical_id):
    vertical = Vertical.query.get(vertical_id)
    if not vertical:
        return jsonify({"error": "Vertical not found"}), 404

    contributors_query = db.session.query(User).join(Message, User.id == Message.user_id).filter(
        Message.vertical_id == vertical_id, Message.role == 'user'
    ).distinct().all()

    contributors = []
    for user in contributors_query:
        msg_count = Message.query.filter_by(vertical_id=vertical_id, user_id=user.id, role='user').count()
        doc_count = Document.query.filter_by(vertical_id=vertical_id, user_id=user.id).count()
        note_count = Note.query.filter_by(vertical_id=vertical_id, user_id=user.id).count()
        contributors.append({
            "id": user.id,
            "name": user.display_name,
            "email": user.email,
            "pic": user.profile_pic,
            "messages": msg_count,
            "documents": doc_count,
            "notes": note_count
        })

    messages = Message.query.filter_by(vertical_id=vertical_id).order_by(Message.created_at).all()
    messages_list = [{
        "id": m.id,
        "role": m.role,
        "content": m.content,
        "user_name": User.query.get(m.user_id).display_name if m.user_id and m.role == 'user' else "AI Analyst",
        "created_at": m.created_at.isoformat()
    } for m in messages]

    docs = Document.query.filter_by(vertical_id=vertical_id).order_by(Document.created_at.desc()).all()
    docs_list = []
    for doc in docs:
        extracted = None
        if doc.extracted_content:
            try:
                extracted = json.loads(doc.extracted_content)
            except json.JSONDecodeError:
                extracted = {"raw": doc.extracted_content}
        user = User.query.get(doc.user_id) if doc.user_id else None
        docs_list.append({
            "id": doc.id,
            "filename": doc.filename,
            "file_type": doc.file_type,
            "doc_type": doc.doc_type,
            "user_description": doc.user_description,
            "extracted_content": extracted,
            "processing_status": doc.processing_status,
            "uploader": user.display_name if user else "Unknown",
            "created_at": doc.created_at.isoformat()
        })

    notes = Note.query.filter_by(vertical_id=vertical_id).order_by(Note.created_at.desc()).all()
    notes_list = [{
        "id": n.id,
        "content": n.content,
        "category": n.category,
        "user_name": User.query.get(n.user_id).display_name if n.user_id else "Unknown",
        "created_at": n.created_at.isoformat()
    } for n in notes]

    return jsonify({
        "vertical": {
            "id": vertical.id,
            "name": vertical.name,
            "geography": vertical.geography,
            "type": vertical.type,
            "color": vertical.color,
            "icon": vertical.icon
        },
        "contributors": contributors,
        "messages": messages_list,
        "documents": docs_list,
        "notes": notes_list
    })


def build_export_data(vertical_id):
    vertical = Vertical.query.get(vertical_id)
    if not vertical:
        return None

    messages = Message.query.filter_by(vertical_id=vertical_id).order_by(Message.created_at).all()
    documents = Document.query.filter_by(vertical_id=vertical_id).all()
    notes = Note.query.filter_by(vertical_id=vertical_id).all()
    process_map = ProcessMap.query.filter_by(vertical_id=vertical_id).order_by(ProcessMap.version.desc()).first()

    contributors = db.session.query(User).join(Message, User.id == Message.user_id).filter(
        Message.vertical_id == vertical_id, Message.role == 'user'
    ).distinct().all()

    map_data = None
    feedback_data = []
    if process_map:
        try:
            map_data = json.loads(process_map.map_data)
        except json.JSONDecodeError:
            map_data = {"raw": process_map.map_data}
        feedback_entries = ProcessMapFeedback.query.filter_by(process_map_id=process_map.id).all()
        feedback_data = [{
            "step_number": fb.step_number,
            "feedback_type": fb.feedback_type,
            "content": fb.content,
            "user": User.query.get(fb.user_id).display_name if fb.user_id else "Unknown"
        } for fb in feedback_entries]

    return {
        "vertical": {
            "id": vertical.id,
            "name": vertical.name,
            "geography": vertical.geography,
            "type": vertical.type
        },
        "conversation": [{
            "role": m.role,
            "content": m.content,
            "user": User.query.get(m.user_id).display_name if m.user_id and m.role == 'user' else "AI Analyst",
            "timestamp": m.created_at.isoformat()
        } for m in messages],
        "documents": [{
            "filename": d.filename,
            "doc_type": d.doc_type,
            "description": d.user_description,
            "extracted_content": json.loads(d.extracted_content) if d.extracted_content else None
        } for d in documents if d.processing_status == 'done'],
        "notes": [{
            "content": n.content,
            "category": n.category,
            "author": User.query.get(n.user_id).display_name if n.user_id else "Unknown"
        } for n in notes],
        "process_map": map_data,
        "process_map_feedback": feedback_data,
        "contributors": [{"name": c.display_name, "email": c.email} for c in contributors],
        "exported_at": datetime.utcnow().isoformat()
    }


def build_markdown_export(export_data):
    if not export_data:
        return ""

    v = export_data["vertical"]
    lines = [
        f"# {v['name']} - Context Brain Export",
        f"**Geography:** {v['geography']}",
        f"**Type:** {v['type']}",
        f"**Exported:** {export_data['exported_at']}",
        "",
    ]

    pm = export_data.get("process_map")
    if pm and isinstance(pm, dict):
        bo = pm.get("businessOverview", {})
        if bo:
            lines.append("## Business Overview")
            lines.append(bo.get("summary", "No summary available"))
            lines.append("")
            if bo.get("businessModel"):
                lines.append(f"**Business Model:** {bo['businessModel']}")
            if bo.get("teamStructure"):
                lines.append(f"**Team Structure:** {bo['teamStructure']}")
            lines.append("")

        proc = pm.get("processMap", {})
        if proc:
            lines.append(f"## Process Map: {proc.get('processName', 'Core Process')}")
            lines.append("")
            for step in proc.get("steps", []):
                pain_icon = {"low": "🟢", "medium": "🟡", "high": "🔴"}.get(step.get("painLevel", "low"), "⚪")
                lines.append(f"### Step {step.get('stepNumber', '?')}: {step.get('name', 'Unknown')}")
                lines.append(f"{step.get('description', '')}")
                lines.append(f"- **Owner:** {step.get('owner', 'Unknown')}")
                lines.append(f"- **Tools:** {', '.join(step.get('toolsUsed', [])) or 'None specified'}")
                lines.append(f"- **Time:** {step.get('estimatedTime', 'Unknown')}")
                lines.append(f"- **Pain Level:** {pain_icon} {step.get('painLevel', 'Unknown')}")
                lines.append(f"- **Automation Potential:** {step.get('automationPotential', 'Unknown')}")
                if step.get("automationIdea"):
                    lines.append(f"- **Automation Idea:** {step['automationIdea']}")
                lines.append("")

        insights = pm.get("keyInsights", [])
        if insights:
            lines.append("## Key Insights")
            for i in insights:
                lines.append(f"- {i}")
            lines.append("")

        targets = pm.get("topAutomationTargets", [])
        if targets:
            lines.append("## Top Automation Targets")
            for t in targets:
                lines.append(f"### {t.get('target', 'Unknown')}")
                lines.append(f"- **Current Cost:** {t.get('currentCost', 'Unknown')}")
                lines.append(f"- **Approach:** {t.get('automationApproach', 'Unknown')}")
                lines.append(f"- **Expected Impact:** {t.get('expectedImpact', 'Unknown')}")
                lines.append(f"- **Priority:** {t.get('priority', 'Unknown')}")
            lines.append("")

        gaps = pm.get("knowledgeGaps", [])
        if gaps:
            lines.append("## Knowledge Gaps")
            for g in gaps:
                lines.append(f"- [ ] {g}")
            lines.append("")

    lines.append("## Contributors")
    for c in export_data.get("contributors", []):
        lines.append(f"- {c['name']} ({c['email']})")
    lines.append("")

    lines.append("## Conversation Transcript")
    for m in export_data.get("conversation", []):
        lines.append(f"**{m['user']}** ({m['timestamp']})")
        lines.append(m['content'])
        lines.append("")

    return "\n".join(lines)


@admin_routes.route("/api/export/<vertical_id>")
@admin_required
def export_vertical(vertical_id):
    fmt = request.args.get("format", "json")
    export_data = build_export_data(vertical_id)
    if not export_data:
        return jsonify({"error": "Vertical not found"}), 404

    if fmt == "markdown":
        md = build_markdown_export(export_data)
        return send_file(
            io.BytesIO(md.encode('utf-8')),
            mimetype='text/markdown',
            as_attachment=True,
            download_name=f"{vertical_id}_export.md"
        )

    return send_file(
        io.BytesIO(json.dumps(export_data, indent=2).encode('utf-8')),
        mimetype='application/json',
        as_attachment=True,
        download_name=f"{vertical_id}_export.json"
    )


@admin_routes.route("/api/export-all")
@admin_required
def export_all():
    verticals = Vertical.query.all()
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        for v in verticals:
            export_data = build_export_data(v.id)
            if export_data:
                zf.writestr(f"{v.id}_export.json", json.dumps(export_data, indent=2))
                md = build_markdown_export(export_data)
                zf.writestr(f"{v.id}_export.md", md)

    zip_buffer.seek(0)
    return send_file(
        zip_buffer,
        mimetype='application/zip',
        as_attachment=True,
        download_name='context_brain_export_all.zip'
    )
