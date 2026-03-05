from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime

db = SQLAlchemy()


class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Text, primary_key=True)
    email = db.Column(db.Text, unique=True, nullable=False)
    display_name = db.Column(db.Text)
    profile_pic = db.Column(db.Text)
    is_admin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_active_at = db.Column(db.DateTime)


class Vertical(db.Model):
    __tablename__ = 'verticals'
    id = db.Column(db.Text, primary_key=True)
    name = db.Column(db.Text, nullable=False)
    geography = db.Column(db.Text)
    type = db.Column(db.Text)
    color = db.Column(db.Text)
    icon = db.Column(db.Text)
    seed_context = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Message(db.Model):
    __tablename__ = 'messages'
    id = db.Column(db.Integer, primary_key=True)
    vertical_id = db.Column(db.Text, db.ForeignKey('verticals.id'))
    user_id = db.Column(db.Text, db.ForeignKey('users.id'))
    role = db.Column(db.Text, nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='messages')
    vertical = db.relationship('Vertical', backref='messages')


class Document(db.Model):
    __tablename__ = 'documents'
    id = db.Column(db.Integer, primary_key=True)
    vertical_id = db.Column(db.Text, db.ForeignKey('verticals.id'))
    user_id = db.Column(db.Text, db.ForeignKey('users.id'))
    filename = db.Column(db.Text, nullable=False)
    file_type = db.Column(db.Text)
    file_path = db.Column(db.Text)
    file_size = db.Column(db.Integer)
    doc_type = db.Column(db.Text)
    user_description = db.Column(db.Text)
    extracted_content = db.Column(db.Text)
    processing_status = db.Column(db.Text, default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='documents')
    vertical = db.relationship('Vertical', backref='documents')


class Note(db.Model):
    __tablename__ = 'notes'
    id = db.Column(db.Integer, primary_key=True)
    vertical_id = db.Column(db.Text, db.ForeignKey('verticals.id'))
    user_id = db.Column(db.Text, db.ForeignKey('users.id'))
    content = db.Column(db.Text, nullable=False)
    category = db.Column(db.Text, default='other')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='notes')
    vertical = db.relationship('Vertical', backref='notes')


class ProcessMap(db.Model):
    __tablename__ = 'process_maps'
    id = db.Column(db.Integer, primary_key=True)
    vertical_id = db.Column(db.Text, db.ForeignKey('verticals.id'))
    generated_by = db.Column(db.Text, db.ForeignKey('users.id'))
    version = db.Column(db.Integer, default=1)
    map_data = db.Column(db.Text, nullable=False)
    source_summary = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='process_maps')
    vertical = db.relationship('Vertical', backref='process_maps')


class ProcessMapFeedback(db.Model):
    __tablename__ = 'process_map_feedback'
    id = db.Column(db.Integer, primary_key=True)
    process_map_id = db.Column(db.Integer, db.ForeignKey('process_maps.id'))
    user_id = db.Column(db.Text, db.ForeignKey('users.id'))
    step_number = db.Column(db.Integer)
    feedback_type = db.Column(db.Text)
    content = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='feedback')
    process_map = db.relationship('ProcessMap', backref='feedback')
