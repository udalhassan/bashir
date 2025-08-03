-- Student Voting System Database Schema

-- Students table - stores basic student information
CREATE TABLE students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_number VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    department VARCHAR(100) NOT NULL,
    year_of_study INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Voter IDs table - stores unique digital voter cards
CREATE TABLE voter_ids (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    voter_id VARCHAR(64) UNIQUE NOT NULL, -- SHA-256 hash-based unique ID
    qr_code_data TEXT, -- QR code data for digital voter card
    is_active BOOLEAN DEFAULT TRUE,
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE
);

-- Elections table - stores election information
CREATE TABLE elections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    created_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Candidates table - stores candidate information for elections
CREATE TABLE candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    election_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    position VARCHAR(100) NOT NULL,
    manifesto TEXT,
    photo_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (election_id) REFERENCES elections (id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
    UNIQUE(election_id, student_id, position)
);

-- Votes table - stores voting records (anonymized)
CREATE TABLE votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    election_id INTEGER NOT NULL,
    candidate_id INTEGER NOT NULL,
    voter_id_hash VARCHAR(64) NOT NULL, -- Hashed voter ID for anonymity
    position VARCHAR(100) NOT NULL,
    cast_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45), -- For audit purposes
    FOREIGN KEY (election_id) REFERENCES elections (id) ON DELETE CASCADE,
    FOREIGN KEY (candidate_id) REFERENCES candidates (id) ON DELETE CASCADE,
    UNIQUE(election_id, voter_id_hash, position) -- One vote per position per voter
);

-- Voting sessions table - tracks voting sessions for security
CREATE TABLE voting_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voter_id VARCHAR(64) NOT NULL,
    election_id INTEGER NOT NULL,
    session_token VARCHAR(128) UNIQUE NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    is_completed BOOLEAN DEFAULT FALSE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    FOREIGN KEY (election_id) REFERENCES elections (id) ON DELETE CASCADE
);

-- Admin users table - for system administration
CREATE TABLE admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'admin',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Audit log table - for tracking system activities
CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(50),
    record_id INTEGER,
    old_values TEXT, -- JSON string of old values
    new_values TEXT, -- JSON string of new values
    user_type VARCHAR(20), -- 'student', 'admin'
    user_id VARCHAR(64), -- voter_id for students, username for admins
    ip_address VARCHAR(45),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_students_student_number ON students(student_number);
CREATE INDEX idx_students_email ON students(email);
CREATE INDEX idx_voter_ids_voter_id ON voter_ids(voter_id);
CREATE INDEX idx_voter_ids_student_id ON voter_ids(student_id);
CREATE INDEX idx_elections_active ON elections(is_active);
CREATE INDEX idx_elections_dates ON elections(start_date, end_date);
CREATE INDEX idx_candidates_election ON candidates(election_id);
CREATE INDEX idx_votes_election ON votes(election_id);
CREATE INDEX idx_votes_candidate ON votes(candidate_id);
CREATE INDEX idx_votes_voter_hash ON votes(voter_id_hash);
CREATE INDEX idx_voting_sessions_voter ON voting_sessions(voter_id);
CREATE INDEX idx_voting_sessions_election ON voting_sessions(election_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp);

-- Views for common queries
CREATE VIEW active_elections AS
SELECT * FROM elections 
WHERE is_active = TRUE 
AND start_date <= CURRENT_TIMESTAMP 
AND end_date >= CURRENT_TIMESTAMP;

CREATE VIEW election_results AS
SELECT 
    e.id as election_id,
    e.title as election_title,
    c.position,
    c.id as candidate_id,
    s.first_name || ' ' || s.last_name as candidate_name,
    s.department,
    COUNT(v.id) as vote_count
FROM elections e
JOIN candidates c ON e.id = c.election_id
JOIN students s ON c.student_id = s.id
LEFT JOIN votes v ON c.id = v.candidate_id
GROUP BY e.id, c.id, c.position
ORDER BY e.id, c.position, vote_count DESC;

CREATE VIEW voter_participation AS
SELECT 
    e.id as election_id,
    e.title as election_title,
    COUNT(DISTINCT v.voter_id_hash) as total_voters,
    COUNT(v.id) as total_votes
FROM elections e
LEFT JOIN votes v ON e.id = v.election_id
GROUP BY e.id, e.title;