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
    pin = db.Column(db.Text)
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
    file_data = db.Column(db.Text)
    doc_type = db.Column(db.Text)
    user_description = db.Column(db.Text)
    extracted_content = db.Column(db.Text)
    full_text = db.Column(db.Text)
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


class VerticalIntelligence(db.Model):
    __tablename__ = 'vertical_intelligence'
    id = db.Column(db.Integer, primary_key=True)
    vertical_id = db.Column(db.Text, db.ForeignKey('verticals.id'))
    intelligence_data = db.Column(db.Text)
    context_hash = db.Column(db.Text)
    generated_by = db.Column(db.Text, db.ForeignKey('users.id'))
    generated_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='intelligence')
    vertical = db.relationship('Vertical', backref='intelligence')


class UserVerticalRole(db.Model):
    __tablename__ = 'user_vertical_roles'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Text, db.ForeignKey('users.id'), nullable=False)
    vertical_id = db.Column(db.Text, db.ForeignKey('verticals.id'), nullable=False)
    role = db.Column(db.Text, nullable=False)
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow)
    assigned_by = db.Column(db.Text, db.ForeignKey('users.id'))

    user = db.relationship('User', foreign_keys=[user_id], backref='vertical_roles')
    vertical = db.relationship('Vertical', backref='user_roles')
    assigner = db.relationship('User', foreign_keys=[assigned_by])

    __table_args__ = (
        db.UniqueConstraint('user_id', 'vertical_id', name='uq_user_vertical'),
    )


class IntelligenceSection(db.Model):
    __tablename__ = 'intelligence_sections'
    id = db.Column(db.Integer, primary_key=True)
    vertical_id = db.Column(db.Text, db.ForeignKey('verticals.id'), nullable=False)
    section_key = db.Column(db.Text, nullable=False)
    section_data = db.Column(db.Text)
    context_hash = db.Column(db.Text)
    version = db.Column(db.Integer, default=1)
    generated_at = db.Column(db.DateTime, default=datetime.utcnow)
    generated_by = db.Column(db.Text, db.ForeignKey('users.id'))

    vertical = db.relationship('Vertical', backref='intelligence_sections')
    user = db.relationship('User', backref='intelligence_sections')

    __table_args__ = (
        db.UniqueConstraint('vertical_id', 'section_key', name='uq_vertical_section'),
    )


class IntelligenceFeedback(db.Model):
    __tablename__ = 'intelligence_feedback'
    id = db.Column(db.Integer, primary_key=True)
    vertical_id = db.Column(db.Text, db.ForeignKey('verticals.id'))
    user_id = db.Column(db.Text, db.ForeignKey('users.id'))
    section = db.Column(db.Text, nullable=False)
    field_path = db.Column(db.Text)
    feedback_type = db.Column(db.Text, nullable=False)
    original_value = db.Column(db.Text)
    corrected_value = db.Column(db.Text)
    comment = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='intel_feedback')
    vertical = db.relationship('Vertical', backref='intel_feedback')
