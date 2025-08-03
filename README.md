# Student Voting System

A secure, modern web-based voting system designed for educational institutions. Features unique digital voter cards, real-time results, and comprehensive security measures to ensure fair and transparent elections.

## 🚀 Features

### Core Functionality
- **Digital Voter Cards**: Each student receives a unique, secure voter card ID upon registration
- **Secure Authentication**: JWT-based authentication with bcrypt password hashing
- **Real-time Voting**: Cast votes securely with immediate confirmation
- **Vote Tracking**: Complete voting history with cryptographic verification hashes
- **Live Results**: Real-time election results with visual progress bars
- **Mobile Responsive**: Works seamlessly on desktop, tablet, and mobile devices

### Security Features
- **Unique Voter IDs**: Cryptographically secure voter card generation
- **Vote Encryption**: Each vote is hashed with unique identifiers
- **Rate Limiting**: Protection against spam and abuse
- **Input Validation**: Comprehensive server-side validation
- **SQL Injection Protection**: Parameterized queries throughout
- **CORS & Helmet**: Security headers and cross-origin protection
- **One Vote Per Election**: Database constraints prevent duplicate voting

### User Experience
- **Modern UI**: Beautiful gradient design with smooth animations
- **Intuitive Navigation**: Tab-based interface for easy access
- **Real-time Feedback**: Instant alerts and confirmations
- **Vote Verification**: Cryptographic proof of vote integrity
- **Responsive Design**: Optimized for all screen sizes

## 🛠 Technology Stack

- **Backend**: Node.js with Express.js
- **Database**: SQLite with sqlite3
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Authentication**: JSON Web Tokens (JWT)
- **Security**: bcryptjs, helmet, cors, express-rate-limit
- **Styling**: Modern CSS with gradients and animations

## 📦 Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm (v6 or higher)

### Quick Start

1. **Clone or download the project files**
   ```bash
   # If you have the files, navigate to the project directory
   cd student-voting-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Initialize the database with sample data**
   ```bash
   npm run init-db
   ```

4. **Start the server**
   ```bash
   npm start
   ```

5. **Access the application**
   - Open your browser and go to `http://localhost:3000`
   - The system is ready to use!

### Development Mode
```bash
npm run dev
```
This starts the server with nodemon for automatic restarts during development.

## 🔐 Default Credentials

After running `npm run init-db`, you can use these test accounts:

### Sample Student Account
- **Student ID**: `STU001`
- **Password**: `password123`

### Admin Account (for future admin features)
- **Username**: `admin`
- **Password**: `admin123`

## 🗃 Database Schema

### Students Table
```sql
- id: Primary key
- student_id: Unique student identifier
- email: Student email address
- full_name: Student's full name
- password_hash: Encrypted password
- voter_card_id: Unique digital voter card ID
- is_verified: Account verification status
- created_at: Registration timestamp
```

### Elections Table
```sql
- id: Primary key
- title: Election title
- description: Election description
- start_date: Election start time
- end_date: Election end time
- is_active: Election status
- created_at: Creation timestamp
```

### Candidates Table
```sql
- id: Primary key
- election_id: Reference to election
- name: Candidate name
- description: Candidate description
- image_url: Candidate photo (optional)
- vote_count: Total votes received
```

### Votes Table
```sql
- id: Primary key
- voter_card_id: Voter's digital card ID
- election_id: Reference to election
- candidate_id: Reference to candidate
- vote_hash: Cryptographic vote verification
- timestamp: Vote cast time
```

## 🔌 API Endpoints

### Authentication
- `POST /api/register` - Register new student and get voter card
- `POST /api/login` - Student login
- `GET /api/health` - System health check

### Elections & Voting
- `GET /api/elections` - Get active elections
- `GET /api/elections/:id/candidates` - Get candidates for election
- `POST /api/vote` - Cast a vote
- `GET /api/elections/:id/results` - Get election results

### User Data
- `GET /api/my-votes` - Get user's voting history

### Request/Response Examples

#### Registration
```javascript
POST /api/register
{
  "studentId": "STU123",
  "email": "student@university.edu",
  "fullName": "John Doe",
  "password": "securepassword123"
}

Response:
{
  "message": "Registration successful",
  "voterCardId": "VC-K8L9M2N3-A1B2C3D4",
  "studentId": "STU123"
}
```

#### Casting a Vote
```javascript
POST /api/vote
Headers: { "Authorization": "Bearer jwt_token_here" }
{
  "electionId": 1,
  "candidateId": 2
}

Response:
{
  "message": "Vote cast successfully",
  "voteId": 15,
  "voteHash": "a1b2c3d4e5f6..."
}
```

## 🔒 Security Measures

### Voter Card Generation
Each voter card ID is generated using:
- Current timestamp (base36 encoded)
- Cryptographically secure random bytes
- Format: `VC-TIMESTAMP-RANDOM` (e.g., `VC-K8L9M2N3-A1B2C3D4`)

### Vote Hashing
Each vote generates a unique hash combining:
- Voter card ID
- Election ID
- Candidate ID
- Current timestamp
- SHA-256 encryption

### Rate Limiting
- General API: 100 requests per 15 minutes per IP
- Voting API: 5 voting attempts per hour per IP
- Prevents spam and abuse

### Data Protection
- Passwords hashed with bcrypt (12 rounds)
- JWT tokens with 24-hour expiration
- SQL injection prevention with parameterized queries
- Input validation on all endpoints

## 📱 User Interface

### Authentication Flow
1. **Registration**: Students create accounts and receive unique voter cards
2. **Login**: Secure authentication with JWT tokens
3. **Dashboard**: Access to elections, voting history, and results

### Voting Process
1. **View Elections**: Browse active elections
2. **Select Candidates**: Review candidate information
3. **Cast Vote**: Secure voting with confirmation
4. **Verification**: Receive cryptographic proof of vote

### Results & History
- **Live Results**: Real-time vote tallies with percentages
- **Vote History**: Personal voting record with verification hashes
- **Visual Analytics**: Progress bars and statistics

## 🎨 UI Features

- **Modern Design**: Gradient backgrounds and glass-morphism effects
- **Responsive Layout**: Mobile-first design approach
- **Interactive Elements**: Hover effects and smooth transitions
- **Accessibility**: High contrast and readable fonts
- **Visual Feedback**: Loading states and success/error messages

## 🚀 Production Deployment

### Environment Variables
Update `.env` file for production:
```env
NODE_ENV=production
JWT_SECRET=your-production-jwt-secret-very-long-and-random
PORT=3000
```

### Security Checklist
- [ ] Change default JWT secret
- [ ] Use HTTPS in production
- [ ] Set up proper CORS origins
- [ ] Configure reverse proxy (nginx)
- [ ] Set up database backups
- [ ] Monitor rate limiting logs
- [ ] Regular security updates

## 🔧 Development

### Project Structure
```
student-voting-system/
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── .env                   # Environment configuration
├── public/                # Frontend files
│   ├── index.html        # Main HTML file
│   └── app.js            # Frontend JavaScript
├── scripts/              # Utility scripts
│   └── initDatabase.js   # Database initialization
└── voting_system.db      # SQLite database (created after init)
```

### Adding New Features
1. Update database schema in `server.js`
2. Add API endpoints for new functionality
3. Update frontend UI and JavaScript
4. Test with sample data
5. Update documentation

## 🐛 Troubleshooting

### Common Issues

**Database not found**
```bash
npm run init-db
```

**Port already in use**
```bash
# Change PORT in .env file or kill process
lsof -ti:3000 | xargs kill -9
```

**Dependencies missing**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Debug Mode
Set `NODE_ENV=development` in `.env` for detailed error messages.

## 📈 Future Enhancements

- [ ] Admin panel for election management
- [ ] Email verification system
- [ ] Multi-language support
- [ ] Advanced analytics dashboard
- [ ] Blockchain vote verification
- [ ] Mobile app development
- [ ] Integration with student information systems

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For support or questions:
- Check the troubleshooting section
- Review the API documentation
- Create an issue for bugs or feature requests

---

**Built with ❤️ for secure, transparent student elections**