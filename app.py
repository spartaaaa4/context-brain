import os
import logging
from flask import Flask, jsonify
from flask_login import LoginManager
from models import db, User, Vertical

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key")
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024

db.init_app(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "otp_auth.login"


@login_manager.user_loader
def load_user(user_id):
    try:
        return db.session.get(User, user_id)
    except Exception as e:
        logger.error(f"Error loading user: {e}")
        return None


ADMIN_EMAILS = [e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()]


def is_admin(email):
    return email.lower() in ADMIN_EMAILS


SEED_VERTICALS = [
    {
        "id": "okaygo",
        "name": "OkayGo",
        "geography": "India (PAN-India)",
        "type": "Gig Task Fulfillment Platform",
        "color": "#E85D26",
        "icon": "OG",
        "seed_context": "OkayGo is a gig task fulfillment platform operating across India. Companies come to OkayGo when they have tasks -- audits, delivery, telecalling, proctoring, due diligence -- that need to be executed by a distributed gig workforce. OkayGo manages end-to-end task completion, not just worker placement. They serve 100+ enterprise clients including Tata, Amazon, Flipkart, Swiggy, Zepto. Primary languages: Hindi and English. Workers use an Android app."
    },
    {
        "id": "troopers",
        "name": "Troopers",
        "geography": "Malaysia + Singapore",
        "type": "Part-time / Gig Staffing",
        "color": "#2563EB",
        "icon": "TR",
        "seed_context": "Troopers is a part-time and gig staffing platform in Malaysia and Singapore. They connect businesses with part-time workers for short-duration, flexible work -- events, F&B, retail, warehousing. They have 250,000+ registered part-timers and 200+ business clients including Coca-Cola, Chagee, Park Royal, KLCC. Workers use iOS and Android apps. Primary languages: English and Malay."
    },
    {
        "id": "myrobin",
        "name": "MyRobin",
        "geography": "Indonesia",
        "type": "Outsourcing / BPO Platform",
        "color": "#059669",
        "icon": "MR",
        "seed_context": "MyRobin is a blue-collar outsourcing platform in Indonesia. They place workers at client sites and manage those workers on behalf of the client -- handling screening, documents, attendance, payroll, and benefits. Worker categories include warehouse, logistics, sales, manufacturing, F&B, cleaning, hotel staff. They have a 2M+ worker network across Indonesia. Key clients include ShopeeXpress, Lalamove, Kopi Kenangan. Primary language: Bahasa Indonesia. WhatsApp is the dominant communication channel."
    },
    {
        "id": "aasaanjobs",
        "name": "AasaanJobs",
        "geography": "India",
        "type": "Blue-collar Recruitment Services",
        "color": "#7C3AED",
        "icon": "AJ",
        "seed_context": "AasaanJobs is a blue-collar job portal and active recruitment services company in India. They handle delivery, retail, BFSI field roles, manufacturing, security, and housekeeping recruitment. Current scale is approximately 2,000 hires per month. Primary languages: Hindi and English."
    },
    {
        "id": "bv",
        "name": "Background Verification",
        "geography": "India (primarily), with some cross-border",
        "type": "Verification & Compliance",
        "color": "#DC2626",
        "icon": "BV",
        "seed_context": "Background Verification (BV) is a cross-cutting function across BetterPlace Group. The goBetter software product includes verifyBetter, which handles integrated background checks -- identity verification, career history, financial checks, health records, legal history, and physical verification. BV processes touch multiple document types including Aadhaar, PAN, driving license, and bank statements. This vertical captures context about how BV is done across all business units -- the tools, processes, turnaround times, and pain points."
    },
    {
        "id": "gobetter",
        "name": "goBetter",
        "geography": "India",
        "type": "Enterprise Software (HRMS + LMS)",
        "color": "#0891B2",
        "icon": "gB",
        "seed_context": "goBetter is the software product arm of BetterPlace Group. It has two products: manageBetter (enterprise HRMS and CLMS for managing frontline workforce -- attendance, payroll, compliance, hiring, onboarding) and skillBetter (mobile-first LMS for frontline worker training in 35+ languages). goBetter sells to large enterprises -- logistics companies, retail chains, FMCG, BFSI, hospitals, factories. Key differentiators: mobile-first, vernacular support, configurable workflows, single platform for on-roll + off-roll workers. Competitors include Darwinbox, Keka, Springworks, SAP SuccessFactors."
    },
]


def init_db():
    try:
        db.create_all()
        db.session.execute(db.text("""
            CREATE TABLE IF NOT EXISTS otp_codes (
                id SERIAL PRIMARY KEY,
                email TEXT NOT NULL,
                code TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                used BOOLEAN DEFAULT FALSE
            )
        """))
        db.session.commit()
        if Vertical.query.count() == 0:
            for v_data in SEED_VERTICALS:
                v = Vertical(**v_data)
                db.session.add(v)
            db.session.commit()
            logger.info("[DB] Seeded 6 verticals")
        else:
            logger.info(f"[DB] {Vertical.query.count()} verticals already exist")
    except Exception as e:
        logger.error(f"[DB] Init error: {e}")
        db.session.rollback()
        raise


with app.app_context():
    init_db()


@app.route("/healthz")
def healthz():
    try:
        db.session.execute(db.text("SELECT 1"))
        return jsonify({"status": "ok"}), 200
    except Exception as e:
        logger.error(f"Healthcheck failed: {e}")
        return jsonify({"status": "error", "detail": str(e)}), 500


@app.errorhandler(500)
def handle_500(e):
    logger.error(f"Internal server error: {e}")
    return jsonify({"error": "Internal server error"}), 500


@app.errorhandler(404)
def handle_404(e):
    return jsonify({"error": "Not found"}), 404


from otp_auth import otp_auth
from routes import main_routes, api_routes, admin_routes

app.register_blueprint(otp_auth)
app.register_blueprint(main_routes)
app.register_blueprint(api_routes, url_prefix="/api")
app.register_blueprint(admin_routes, url_prefix="/admin")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
