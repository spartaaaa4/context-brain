import os
import time
from datetime import datetime
from flask import Blueprint, render_template, request, redirect, url_for, session
from flask_login import login_user, logout_user, login_required
from models import db, User

pin_auth = Blueprint("pin_auth", __name__)

ALLOWED_EMAILS = [e.strip().lower() for e in os.environ.get("ALLOWED_EMAILS", "").split(",") if e.strip()]
ADMIN_EMAILS = [e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()]

MAX_ATTEMPTS = 5
LOCKOUT_SECONDS = 300
_login_attempts = {}


def _check_rate_limit(email):
    now = time.time()
    if email in _login_attempts:
        attempts, first_attempt = _login_attempts[email]
        if now - first_attempt > LOCKOUT_SECONDS:
            _login_attempts[email] = (0, now)
            return True
        if attempts >= MAX_ATTEMPTS:
            remaining = int(LOCKOUT_SECONDS - (now - first_attempt))
            return remaining
    return True


def _record_failed_attempt(email):
    now = time.time()
    if email in _login_attempts:
        attempts, first_attempt = _login_attempts[email]
        if now - first_attempt > LOCKOUT_SECONDS:
            _login_attempts[email] = (1, now)
        else:
            _login_attempts[email] = (attempts + 1, first_attempt)
    else:
        _login_attempts[email] = (1, now)


def _clear_attempts(email):
    _login_attempts.pop(email, None)


@pin_auth.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        pin = request.form.get("pin", "").strip()

        if email not in ALLOWED_EMAILS:
            return render_template("login.html", error="This email is not authorized to access Context Brain.", email=email)

        rate_check = _check_rate_limit(email)
        if rate_check is not True:
            return render_template("login.html", error=f"Too many failed attempts. Try again in {rate_check} seconds.", email=email)

        user = User.query.filter_by(email=email).first()
        if not user:
            return render_template("login.html", error="User not found. Please contact admin.", email=email)

        if not user.pin or user.pin != pin:
            _record_failed_attempt(email)
            return render_template("login.html", error="Incorrect PIN. Please try again.", email=email)

        _clear_attempts(email)
        user.last_active_at = datetime.utcnow()
        db.session.commit()
        login_user(user)

        return redirect(url_for("main.index"), code=303)

    return render_template("login.html")


@pin_auth.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("pin_auth.login"))
