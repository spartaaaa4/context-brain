import os
from flask import Flask
from flask_login import LoginManager
from models import db, User

app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key")
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024

db.init_app(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "google_auth.login"


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(user_id)


ADMIN_EMAILS = [e.strip() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()]


def is_admin(email):
    return email in ADMIN_EMAILS


from google_auth import google_auth
from routes import main_routes, api_routes, admin_routes

app.register_blueprint(google_auth)
app.register_blueprint(main_routes)
app.register_blueprint(api_routes, url_prefix="/api")
app.register_blueprint(admin_routes, url_prefix="/admin")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
