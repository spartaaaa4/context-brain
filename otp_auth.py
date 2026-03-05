import os
import random
import string
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta

from flask import Blueprint, render_template, request, redirect, url_for, flash, session
from flask_login import login_user, logout_user, login_required
from models import db, User

otp_auth = Blueprint("otp_auth", __name__)

ALLOWED_EMAILS = [e.strip().lower() for e in os.environ.get("ALLOWED_EMAILS", "").split(",") if e.strip()]
ADMIN_EMAILS = [e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()]

SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
SMTP_FROM = os.environ.get("SMTP_FROM", "contextbrain@betterplace.co.in")


def generate_otp():
    return ''.join(random.choices(string.digits, k=6))


def send_otp_email(email, otp_code):
    if not SMTP_HOST or not SMTP_USER:
        print(f"[OTP] No SMTP configured. OTP for {email}: {otp_code}")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"Context Brain - Your login code: {otp_code}"
        msg["From"] = SMTP_FROM
        msg["To"] = email

        html = f"""
        <div style="font-family: 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <div style="text-align: center; margin-bottom: 24px;">
                <span style="font-size: 36px;">🧠</span>
                <h1 style="font-size: 22px; color: #1a1a2e; margin: 8px 0 4px;">Context Brain</h1>
                <p style="color: #64748b; font-size: 14px;">BetterPlace AI Labs</p>
            </div>
            <div style="background: #f8fafc; border-radius: 12px; padding: 24px; text-align: center;">
                <p style="color: #334155; font-size: 15px; margin-bottom: 16px;">Your login verification code is:</p>
                <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1a1a2e; font-family: monospace; margin: 16px 0;">{otp_code}</div>
                <p style="color: #94a3b8; font-size: 13px; margin-top: 16px;">This code expires in 10 minutes.</p>
            </div>
            <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 24px;">If you didn't request this code, you can safely ignore this email.</p>
        </div>
        """
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_FROM, email, msg.as_string())

        print(f"[OTP] Email sent to {email}")
        return True
    except Exception as e:
        print(f"[OTP] Email send failed for {email}: {e}")
        print(f"[OTP] Fallback - OTP for {email}: {otp_code}")
        return True


@otp_auth.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()

        if email not in ALLOWED_EMAILS:
            return render_template("login.html", error="This email is not authorized to access Context Brain.", email=email)

        otp_code = generate_otp()
        expires_at = datetime.utcnow() + timedelta(minutes=10)

        db.session.execute(
            db.text("INSERT INTO otp_codes (email, code, expires_at) VALUES (:email, :code, :expires_at)"),
            {"email": email, "code": otp_code, "expires_at": expires_at}
        )
        db.session.commit()

        email_sent = send_otp_email(email, otp_code)

        session["otp_email"] = email
        session["otp_display"] = otp_code if not SMTP_HOST else None
        return redirect(url_for("otp_auth.verify"))

    return render_template("login.html")


@otp_auth.route("/verify", methods=["GET", "POST"])
def verify():
    email = session.get("otp_email")
    if not email:
        return redirect(url_for("otp_auth.login"))

    if request.method == "POST":
        code = request.form.get("code", "").strip()

        result = db.session.execute(
            db.text("""
                SELECT id FROM otp_codes
                WHERE email = :email AND code = :code AND used = FALSE AND expires_at > :now
                ORDER BY created_at DESC LIMIT 1
            """),
            {"email": email, "code": code, "now": datetime.utcnow()}
        ).fetchone()

        if not result:
            return render_template("verify_otp.html", email=email, error="Invalid or expired code. Please try again.")

        db.session.execute(
            db.text("UPDATE otp_codes SET used = TRUE WHERE id = :id"),
            {"id": result[0]}
        )

        user = User.query.filter_by(email=email).first()
        if not user:
            name_part = email.split("@")[0].replace(".", " ").replace("_", " ").title()
            user = User(
                id=email,
                email=email,
                display_name=name_part,
                is_admin=email in ADMIN_EMAILS,
                created_at=datetime.utcnow(),
                last_active_at=datetime.utcnow()
            )
            db.session.add(user)
        else:
            user.last_active_at = datetime.utcnow()
            user.is_admin = email in ADMIN_EMAILS

        db.session.commit()
        login_user(user)
        session.pop("otp_email", None)

        return redirect(url_for("main.index"))

    otp_display = session.pop("otp_display", None)
    return render_template("verify_otp.html", email=email, otp_display=otp_display)


@otp_auth.route("/resend", methods=["POST"])
def resend():
    email = session.get("otp_email")
    if not email or email not in ALLOWED_EMAILS:
        return redirect(url_for("otp_auth.login"))

    otp_code = generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    db.session.execute(
        db.text("INSERT INTO otp_codes (email, code, expires_at) VALUES (:email, :code, :expires_at)"),
        {"email": email, "code": otp_code, "expires_at": expires_at}
    )
    db.session.commit()

    send_otp_email(email, otp_code)

    session["otp_display"] = otp_code if not SMTP_HOST else None
    return redirect(url_for("otp_auth.verify"))


@otp_auth.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("otp_auth.login"))
