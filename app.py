"""
Student Voting System - Flask Backend
A secure digital voting system for students with unique voter IDs
"""

from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
import hashlib
import secrets
import qrcode
import io
import base64
from datetime import datetime, timedelta
import json
import os
from functools import wraps
import logging

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database configuration
DATABASE = 'voting_system.db'

def get_db_connection():
    """Get database connection with row factory"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_database():
    """Initialize database with schema"""
    if not os.path.exists(DATABASE):
        conn = get_db_connection()
        with open('database_schema.sql', 'r') as f:
            conn.executescript(f.read())
        
        # Create default admin user
        admin_password = generate_password_hash('admin123')
        conn.execute(
            'INSERT INTO admin_users (username, email, password_hash) VALUES (?, ?, ?)',
            ('admin', 'admin@university.edu', admin_password)
        )
        conn.commit()
        conn.close()
        logger.info("Database initialized successfully")

def generate_voter_id(student_data):
    """Generate unique voter ID using student data and timestamp"""
    # Combine student data with current timestamp and random salt
    data_string = f"{student_data['student_number']}{student_data['email']}{datetime.now().isoformat()}{secrets.token_hex(16)}"
    return hashlib.sha256(data_string.encode()).hexdigest()

def generate_qr_code(voter_id):
    """Generate QR code for voter ID"""
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(voter_id)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    img_buffer = io.BytesIO()
    img.save(img_buffer, format='PNG')
    img_buffer.seek(0)
    
    return base64.b64encode(img_buffer.getvalue()).decode()

def log_audit(action, table_name=None, record_id=None, old_values=None, new_values=None, user_type='system', user_id='system'):
    """Log audit trail"""
    conn = get_db_connection()
    conn.execute(
        '''INSERT INTO audit_log (action, table_name, record_id, old_values, new_values, user_type, user_id, ip_address)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
        (action, table_name, record_id, json.dumps(old_values), json.dumps(new_values), user_type, user_id, request.remote_addr)
    )
    conn.commit()
    conn.close()

def require_admin(f):
    """Decorator to require admin authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'admin_id' not in session:
            return jsonify({'error': 'Admin authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

# Student Registration and Voter ID Generation
@app.route('/api/register', methods=['POST'])
def register_student():
    """Register a new student and generate voter ID"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['student_number', 'first_name', 'last_name', 'email', 'department', 'year_of_study']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        conn = get_db_connection()
        
        # Check if student already exists
        existing = conn.execute(
            'SELECT id FROM students WHERE student_number = ? OR email = ?',
            (data['student_number'], data['email'])
        ).fetchone()
        
        if existing:
            conn.close()
            return jsonify({'error': 'Student with this number or email already exists'}), 409
        
        # Insert student
        cursor = conn.execute(
            '''INSERT INTO students (student_number, first_name, last_name, email, department, year_of_study)
               VALUES (?, ?, ?, ?, ?, ?)''',
            (data['student_number'], data['first_name'], data['last_name'], 
             data['email'], data['department'], data['year_of_study'])
        )
        student_id = cursor.lastrowid
        
        # Generate voter ID
        voter_id = generate_voter_id(data)
        qr_code_data = generate_qr_code(voter_id)
        
        # Insert voter ID
        conn.execute(
            '''INSERT INTO voter_ids (student_id, voter_id, qr_code_data, expires_at)
               VALUES (?, ?, ?, ?)''',
            (student_id, voter_id, qr_code_data, datetime.now() + timedelta(days=365*4))  # 4 years
        )
        
        conn.commit()
        conn.close()
        
        # Log audit
        log_audit('STUDENT_REGISTERED', 'students', student_id, None, data, 'system', 'registration')
        
        return jsonify({
            'message': 'Student registered successfully',
            'voter_id': voter_id,
            'qr_code': qr_code_data,
            'student_id': student_id
        }), 201
        
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        return jsonify({'error': 'Registration failed'}), 500

@app.route('/api/voter-card/<voter_id>')
def get_voter_card(voter_id):
    """Get digital voter card information"""
    try:
        conn = get_db_connection()
        result = conn.execute(
            '''SELECT vi.voter_id, vi.qr_code_data, vi.issued_at, vi.expires_at, vi.is_active,
                      s.first_name, s.last_name, s.student_number, s.department, s.year_of_study
               FROM voter_ids vi
               JOIN students s ON vi.student_id = s.id
               WHERE vi.voter_id = ? AND vi.is_active = TRUE''',
            (voter_id,)
        ).fetchone()
        conn.close()
        
        if not result:
            return jsonify({'error': 'Invalid or inactive voter ID'}), 404
        
        return jsonify({
            'voter_id': result['voter_id'],
            'qr_code': result['qr_code_data'],
            'student_name': f"{result['first_name']} {result['last_name']}",
            'student_number': result['student_number'],
            'department': result['department'],
            'year_of_study': result['year_of_study'],
            'issued_at': result['issued_at'],
            'expires_at': result['expires_at']
        })
        
    except Exception as e:
        logger.error(f"Voter card error: {str(e)}")
        return jsonify({'error': 'Failed to retrieve voter card'}), 500

# Election Management
@app.route('/api/elections', methods=['GET'])
def get_elections():
    """Get all active elections"""
    try:
        conn = get_db_connection()
        elections = conn.execute('SELECT * FROM active_elections').fetchall()
        conn.close()
        
        return jsonify([dict(election) for election in elections])
        
    except Exception as e:
        logger.error(f"Elections fetch error: {str(e)}")
        return jsonify({'error': 'Failed to fetch elections'}), 500

@app.route('/api/elections/<int:election_id>/candidates')
def get_candidates(election_id):
    """Get candidates for a specific election"""
    try:
        conn = get_db_connection()
        candidates = conn.execute(
            '''SELECT c.id, c.position, c.manifesto, c.photo_url,
                      s.first_name, s.last_name, s.department, s.year_of_study
               FROM candidates c
               JOIN students s ON c.student_id = s.id
               WHERE c.election_id = ?
               ORDER BY c.position, s.last_name''',
            (election_id,)
        ).fetchall()
        conn.close()
        
        return jsonify([dict(candidate) for candidate in candidates])
        
    except Exception as e:
        logger.error(f"Candidates fetch error: {str(e)}")
        return jsonify({'error': 'Failed to fetch candidates'}), 500

# Voting Process
@app.route('/api/vote/start', methods=['POST'])
def start_voting_session():
    """Start a voting session"""
    try:
        data = request.get_json()
        voter_id = data.get('voter_id')
        election_id = data.get('election_id')
        
        if not voter_id or not election_id:
            return jsonify({'error': 'Voter ID and Election ID required'}), 400
        
        conn = get_db_connection()
        
        # Verify voter ID is valid and active
        voter = conn.execute(
            'SELECT id FROM voter_ids WHERE voter_id = ? AND is_active = TRUE AND expires_at > CURRENT_TIMESTAMP',
            (voter_id,)
        ).fetchone()
        
        if not voter:
            conn.close()
            return jsonify({'error': 'Invalid or expired voter ID'}), 401
        
        # Verify election is active
        election = conn.execute(
            'SELECT id FROM active_elections WHERE id = ?',
            (election_id,)
        ).fetchone()
        
        if not election:
            conn.close()
            return jsonify({'error': 'Election not active'}), 404
        
        # Check if already voted
        voted = conn.execute(
            'SELECT id FROM votes WHERE election_id = ? AND voter_id_hash = ?',
            (election_id, hashlib.sha256(voter_id.encode()).hexdigest())
        ).fetchone()
        
        if voted:
            conn.close()
            return jsonify({'error': 'Already voted in this election'}), 409
        
        # Create voting session
        session_token = secrets.token_urlsafe(64)
        conn.execute(
            '''INSERT INTO voting_sessions (voter_id, election_id, session_token, ip_address, user_agent)
               VALUES (?, ?, ?, ?, ?)''',
            (voter_id, election_id, session_token, request.remote_addr, request.headers.get('User-Agent'))
        )
        conn.commit()
        conn.close()
        
        return jsonify({
            'session_token': session_token,
            'message': 'Voting session started'
        })
        
    except Exception as e:
        logger.error(f"Voting session error: {str(e)}")
        return jsonify({'error': 'Failed to start voting session'}), 500

@app.route('/api/vote/cast', methods=['POST'])
def cast_vote():
    """Cast votes for candidates"""
    try:
        data = request.get_json()
        session_token = data.get('session_token')
        votes = data.get('votes')  # List of {candidate_id, position}
        
        if not session_token or not votes:
            return jsonify({'error': 'Session token and votes required'}), 400
        
        conn = get_db_connection()
        
        # Verify voting session
        session_data = conn.execute(
            'SELECT voter_id, election_id FROM voting_sessions WHERE session_token = ? AND is_completed = FALSE',
            (session_token,)
        ).fetchone()
        
        if not session_data:
            conn.close()
            return jsonify({'error': 'Invalid or expired session'}), 401
        
        voter_id = session_data['voter_id']
        election_id = session_data['election_id']
        voter_id_hash = hashlib.sha256(voter_id.encode()).hexdigest()
        
        # Cast votes
        for vote in votes:
            candidate_id = vote.get('candidate_id')
            position = vote.get('position')
            
            # Verify candidate belongs to this election
            candidate = conn.execute(
                'SELECT id FROM candidates WHERE id = ? AND election_id = ?',
                (candidate_id, election_id)
            ).fetchone()
            
            if not candidate:
                conn.close()
                return jsonify({'error': f'Invalid candidate for position {position}'}), 400
            
            # Cast vote
            conn.execute(
                '''INSERT INTO votes (election_id, candidate_id, voter_id_hash, position, ip_address)
                   VALUES (?, ?, ?, ?, ?)''',
                (election_id, candidate_id, voter_id_hash, position, request.remote_addr)
            )
        
        # Mark session as completed
        conn.execute(
            'UPDATE voting_sessions SET is_completed = TRUE, completed_at = CURRENT_TIMESTAMP WHERE session_token = ?',
            (session_token,)
        )
        
        conn.commit()
        conn.close()
        
        # Log audit
        log_audit('VOTES_CAST', 'votes', None, None, {'election_id': election_id, 'votes_count': len(votes)}, 'student', voter_id_hash)
        
        return jsonify({'message': 'Votes cast successfully'})
        
    except Exception as e:
        logger.error(f"Vote casting error: {str(e)}")
        return jsonify({'error': 'Failed to cast votes'}), 500

# Admin Authentication
@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    """Admin login"""
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'error': 'Username and password required'}), 400
        
        conn = get_db_connection()
        admin = conn.execute(
            'SELECT id, username, password_hash FROM admin_users WHERE username = ? AND is_active = TRUE',
            (username,)
        ).fetchone()
        conn.close()
        
        if not admin or not check_password_hash(admin['password_hash'], password):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        session['admin_id'] = admin['id']
        session['admin_username'] = admin['username']
        
        # Update last login
        conn = get_db_connection()
        conn.execute(
            'UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
            (admin['id'],)
        )
        conn.commit()
        conn.close()
        
        return jsonify({'message': 'Login successful', 'username': admin['username']})
        
    except Exception as e:
        logger.error(f"Admin login error: {str(e)}")
        return jsonify({'error': 'Login failed'}), 500

@app.route('/api/admin/logout', methods=['POST'])
@require_admin
def admin_logout():
    """Admin logout"""
    session.clear()
    return jsonify({'message': 'Logout successful'})

# Admin Election Management
@app.route('/api/admin/elections', methods=['POST'])
@require_admin
def create_election():
    """Create a new election"""
    try:
        data = request.get_json()
        
        required_fields = ['title', 'description', 'start_date', 'end_date']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        conn = get_db_connection()
        cursor = conn.execute(
            '''INSERT INTO elections (title, description, start_date, end_date, created_by)
               VALUES (?, ?, ?, ?, ?)''',
            (data['title'], data['description'], data['start_date'], data['end_date'], session['admin_username'])
        )
        election_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        log_audit('ELECTION_CREATED', 'elections', election_id, None, data, 'admin', session['admin_username'])
        
        return jsonify({'message': 'Election created successfully', 'election_id': election_id}), 201
        
    except Exception as e:
        logger.error(f"Election creation error: {str(e)}")
        return jsonify({'error': 'Failed to create election'}), 500

@app.route('/api/admin/elections/<int:election_id>/activate', methods=['PUT'])
@require_admin
def activate_election(election_id):
    """Activate/deactivate an election"""
    try:
        data = request.get_json()
        is_active = data.get('is_active', False)
        
        conn = get_db_connection()
        conn.execute(
            'UPDATE elections SET is_active = ? WHERE id = ?',
            (is_active, election_id)
        )
        conn.commit()
        conn.close()
        
        action = 'ELECTION_ACTIVATED' if is_active else 'ELECTION_DEACTIVATED'
        log_audit(action, 'elections', election_id, None, {'is_active': is_active}, 'admin', session['admin_username'])
        
        return jsonify({'message': f'Election {"activated" if is_active else "deactivated"} successfully'})
        
    except Exception as e:
        logger.error(f"Election activation error: {str(e)}")
        return jsonify({'error': 'Failed to update election status'}), 500

@app.route('/api/admin/results/<int:election_id>')
@require_admin
def get_election_results(election_id):
    """Get election results"""
    try:
        conn = get_db_connection()
        results = conn.execute(
            'SELECT * FROM election_results WHERE election_id = ?',
            (election_id,)
        ).fetchall()
        
        participation = conn.execute(
            'SELECT * FROM voter_participation WHERE election_id = ?',
            (election_id,)
        ).fetchone()
        
        conn.close()
        
        return jsonify({
            'results': [dict(result) for result in results],
            'participation': dict(participation) if participation else None
        })
        
    except Exception as e:
        logger.error(f"Results fetch error: {str(e)}")
        return jsonify({'error': 'Failed to fetch results'}), 500

# Frontend Routes
@app.route('/')
def index():
    """Main page"""
    return render_template('index.html')

@app.route('/register')
def register_page():
    """Student registration page"""
    return render_template('register.html')

@app.route('/vote')
def vote_page():
    """Voting page"""
    return render_template('vote.html')

@app.route('/admin')
def admin_page():
    """Admin panel"""
    return render_template('admin.html')

@app.route('/voter-card')
def voter_card_page():
    """Digital voter card page"""
    return render_template('voter_card.html')

if __name__ == '__main__':
    init_database()
    app.run(debug=True, host='0.0.0.0', port=5000)