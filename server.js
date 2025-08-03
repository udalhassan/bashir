const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Voting rate limit (more restrictive)
const votingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5 // limit each IP to 5 voting attempts per hour
});

// Database setup
const db = new sqlite3.Database('./voting_system.db');

// Initialize database tables
db.serialize(() => {
  // Students table
  db.run(`CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    voter_card_id TEXT UNIQUE NOT NULL,
    is_verified BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Elections table
  db.run(`CREATE TABLE IF NOT EXISTS elections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Candidates table
  db.run(`CREATE TABLE IF NOT EXISTS candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    election_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    vote_count INTEGER DEFAULT 0,
    FOREIGN KEY (election_id) REFERENCES elections (id)
  )`);

  // Votes table
  db.run(`CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voter_card_id TEXT NOT NULL,
    election_id INTEGER NOT NULL,
    candidate_id INTEGER NOT NULL,
    vote_hash TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (election_id) REFERENCES elections (id),
    FOREIGN KEY (candidate_id) REFERENCES candidates (id),
    UNIQUE(voter_card_id, election_id)
  )`);

  // Admin users table
  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Utility functions
function generateVoterCardId() {
  const timestamp = Date.now().toString(36);
  const randomStr = crypto.randomBytes(8).toString('hex');
  return `VC-${timestamp}-${randomStr}`.toUpperCase();
}

function hashVote(voterCardId, electionId, candidateId) {
  return crypto.createHash('sha256')
    .update(`${voterCardId}-${electionId}-${candidateId}-${Date.now()}`)
    .digest('hex');
}

// Middleware for JWT authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Validation middleware
const validateRegistration = [
  body('studentId').isLength({ min: 5 }).withMessage('Student ID must be at least 5 characters'),
  body('email').isEmail().withMessage('Valid email required'),
  body('fullName').isLength({ min: 2 }).withMessage('Full name must be at least 2 characters'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
];

const validateLogin = [
  body('studentId').notEmpty().withMessage('Student ID required'),
  body('password').notEmpty().withMessage('Password required')
];

// Routes

// Student registration
app.post('/api/register', validateRegistration, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { studentId, email, fullName, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    const voterCardId = generateVoterCardId();

    db.run(
      'INSERT INTO students (student_id, email, full_name, password_hash, voter_card_id) VALUES (?, ?, ?, ?, ?)',
      [studentId, email, fullName, hashedPassword, voterCardId],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Student ID or email already exists' });
          }
          return res.status(500).json({ error: 'Registration failed' });
        }

        res.status(201).json({
          message: 'Registration successful',
          voterCardId: voterCardId,
          studentId: studentId
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Student login
app.post('/api/login', validateLogin, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { studentId, password } = req.body;

  db.get(
    'SELECT * FROM students WHERE student_id = ?',
    [studentId],
    async (err, student) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!student) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      try {
        const validPassword = await bcrypt.compare(password, student.password_hash);
        if (!validPassword) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
          { 
            id: student.id, 
            studentId: student.student_id, 
            voterCardId: student.voter_card_id 
          },
          JWT_SECRET,
          { expiresIn: '24h' }
        );

        res.json({
          token,
          student: {
            id: student.id,
            studentId: student.student_id,
            fullName: student.full_name,
            email: student.email,
            voterCardId: student.voter_card_id,
            isVerified: student.is_verified
          }
        });
      } catch (error) {
        res.status(500).json({ error: 'Login failed' });
      }
    }
  );
});

// Get active elections
app.get('/api/elections', authenticateToken, (req, res) => {
  const currentTime = new Date().toISOString();
  
  db.all(
    'SELECT * FROM elections WHERE is_active = 1 AND start_date <= ? AND end_date >= ?',
    [currentTime, currentTime],
    (err, elections) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch elections' });
      }
      res.json(elections);
    }
  );
});

// Get candidates for an election
app.get('/api/elections/:electionId/candidates', authenticateToken, (req, res) => {
  const { electionId } = req.params;

  db.all(
    'SELECT * FROM candidates WHERE election_id = ? ORDER BY name',
    [electionId],
    (err, candidates) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch candidates' });
      }
      res.json(candidates);
    }
  );
});

// Cast vote
app.post('/api/vote', votingLimiter, authenticateToken, (req, res) => {
  const { electionId, candidateId } = req.body;
  const voterCardId = req.user.voterCardId;

  if (!electionId || !candidateId) {
    return res.status(400).json({ error: 'Election ID and Candidate ID required' });
  }

  // Check if election is active
  db.get(
    'SELECT * FROM elections WHERE id = ? AND is_active = 1 AND start_date <= datetime("now") AND end_date >= datetime("now")',
    [electionId],
    (err, election) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!election) {
        return res.status(400).json({ error: 'Election not found or not active' });
      }

      // Check if user has already voted in this election
      db.get(
        'SELECT * FROM votes WHERE voter_card_id = ? AND election_id = ?',
        [voterCardId, electionId],
        (err, existingVote) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          if (existingVote) {
            return res.status(400).json({ error: 'You have already voted in this election' });
          }

          // Verify candidate exists for this election
          db.get(
            'SELECT * FROM candidates WHERE id = ? AND election_id = ?',
            [candidateId, electionId],
            (err, candidate) => {
              if (err) {
                return res.status(500).json({ error: 'Database error' });
              }

              if (!candidate) {
                return res.status(400).json({ error: 'Invalid candidate' });
              }

              // Cast the vote
              const voteHash = hashVote(voterCardId, electionId, candidateId);

              db.run(
                'INSERT INTO votes (voter_card_id, election_id, candidate_id, vote_hash) VALUES (?, ?, ?, ?)',
                [voterCardId, electionId, candidateId, voteHash],
                function(err) {
                  if (err) {
                    return res.status(500).json({ error: 'Failed to cast vote' });
                  }

                  // Update candidate vote count
                  db.run(
                    'UPDATE candidates SET vote_count = vote_count + 1 WHERE id = ?',
                    [candidateId],
                    (err) => {
                      if (err) {
                        console.error('Failed to update vote count:', err);
                      }
                    }
                  );

                  res.json({
                    message: 'Vote cast successfully',
                    voteId: this.lastID,
                    voteHash: voteHash
                  });
                }
              );
            }
          );
        }
      );
    }
  );
});

// Get voting history for authenticated user
app.get('/api/my-votes', authenticateToken, (req, res) => {
  const voterCardId = req.user.voterCardId;

  db.all(`
    SELECT v.*, e.title as election_title, c.name as candidate_name
    FROM votes v
    JOIN elections e ON v.election_id = e.id
    JOIN candidates c ON v.candidate_id = c.id
    WHERE v.voter_card_id = ?
    ORDER BY v.timestamp DESC
  `, [voterCardId], (err, votes) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch voting history' });
    }
    res.json(votes);
  });
});

// Get election results
app.get('/api/elections/:electionId/results', authenticateToken, (req, res) => {
  const { electionId } = req.params;

  db.all(`
    SELECT c.*, COUNT(v.id) as actual_votes
    FROM candidates c
    LEFT JOIN votes v ON c.id = v.candidate_id
    WHERE c.election_id = ?
    GROUP BY c.id
    ORDER BY actual_votes DESC, c.name
  `, [electionId], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch results' });
    }

    // Get total votes for this election
    db.get(
      'SELECT COUNT(*) as total_votes FROM votes WHERE election_id = ?',
      [electionId],
      (err, totalResult) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to fetch total votes' });
        }

        res.json({
          candidates: results,
          totalVotes: totalResult.total_votes
        });
      }
    );
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Student Voting System server running on port ${PORT}`);
  console.log(`Access the application at http://localhost:${PORT}`);
});

module.exports = app;