import json
import os
from datetime import datetime

import requests
from flask import Blueprint, redirect, request, url_for
from flask_login import login_required, login_user, logout_user
from models import db, User
from oauthlib.oauth2 import WebApplicationClient

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_OAUTH_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET", "")
GOOGLE_DISCOVERY_URL = "https://accounts.google.com/.well-known/openid-configuration"

client = WebApplicationClient(GOOGLE_CLIENT_ID) if GOOGLE_CLIENT_ID else None

google_auth = Blueprint("google_auth", __name__)


@google_auth.route("/google_login")
def login():
    if not client:
        return "Google OAuth not configured. Please set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.", 500

    google_provider_cfg = requests.get(GOOGLE_DISCOVERY_URL).json()
    authorization_endpoint = google_provider_cfg["authorization_endpoint"]

    request_uri = client.prepare_request_uri(
        authorization_endpoint,
        redirect_uri=request.base_url.replace("http://", "https://") + "/callback",
        scope=["openid", "email", "profile"],
    )
    return redirect(request_uri)


@google_auth.route("/google_login/callback")
def callback():
    if not client:
        return "Google OAuth not configured.", 500

    code = request.args.get("code")
    google_provider_cfg = requests.get(GOOGLE_DISCOVERY_URL).json()
    token_endpoint = google_provider_cfg["token_endpoint"]

    token_url, headers, body = client.prepare_token_request(
        token_endpoint,
        authorization_response=request.url.replace("http://", "https://"),
        redirect_url=request.base_url.replace("http://", "https://"),
        code=code,
    )
    token_response = requests.post(
        token_url,
        headers=headers,
        data=body,
        auth=(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET),
    )

    client.parse_request_body_response(json.dumps(token_response.json()))

    userinfo_endpoint = google_provider_cfg["userinfo_endpoint"]
    uri, headers, body = client.add_token(userinfo_endpoint)
    userinfo_response = requests.get(uri, headers=headers, data=body)

    userinfo = userinfo_response.json()
    if not userinfo.get("email_verified"):
        return "User email not available or not verified by Google.", 400

    google_id = userinfo["sub"]
    users_email = userinfo["email"]
    users_name = userinfo.get("name", userinfo.get("given_name", ""))
    picture = userinfo.get("picture", "")

    from app import is_admin
    admin_status = is_admin(users_email)

    user = User.query.get(google_id)
    if not user:
        user = User(
            id=google_id,
            email=users_email,
            display_name=users_name,
            profile_pic=picture,
            is_admin=admin_status,
            created_at=datetime.utcnow(),
            last_active_at=datetime.utcnow()
        )
        db.session.add(user)
    else:
        user.display_name = users_name
        user.profile_pic = picture
        user.is_admin = admin_status
        user.last_active_at = datetime.utcnow()

    db.session.commit()
    login_user(user)

    return redirect(url_for("main.index"))


@google_auth.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("main.login_page"))
