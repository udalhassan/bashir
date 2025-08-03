// Global state
let currentUser = null;
let currentElection = null;
let authToken = null;

// API Base URL
const API_BASE = '/api';

// Utility Functions
function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        ${message}
    `;
    
    alertContainer.appendChild(alertDiv);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
        }
    }, 5000);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleString();
}

function formatVoterCardId(voterCardId) {
    return voterCardId.replace(/(.{2})/g, '$1 ').trim();
}

// API Functions
async function apiCall(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };

    if (authToken) {
        config.headers['Authorization'] = `Bearer ${authToken}`;
    }

    try {
        const response = await fetch(url, config);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `HTTP error! status: ${response.status}`);
        }

        return data;
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}

// Authentication Functions
async function register(event) {
    event.preventDefault();
    
    const studentId = document.getElementById('regStudentId').value;
    const email = document.getElementById('regEmail').value;
    const fullName = document.getElementById('regFullName').value;
    const password = document.getElementById('regPassword').value;

    try {
        const response = await apiCall('/register', {
            method: 'POST',
            body: JSON.stringify({
                studentId,
                email,
                fullName,
                password
            })
        });

        showAlert(`Registration successful! Your Voter Card ID is: ${response.voterCardId}`, 'success');
        
        // Clear form
        document.getElementById('regStudentId').value = '';
        document.getElementById('regEmail').value = '';
        document.getElementById('regFullName').value = '';
        document.getElementById('regPassword').value = '';
        
        // Switch to login tab
        showTab('login');
        
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

async function login(event) {
    event.preventDefault();
    
    const studentId = document.getElementById('loginStudentId').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await apiCall('/login', {
            method: 'POST',
            body: JSON.stringify({
                studentId,
                password
            })
        });

        authToken = response.token;
        currentUser = response.student;
        
        // Store token in localStorage
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        showAlert(`Welcome back, ${currentUser.fullName}!`, 'success');
        showMainApplication();
        
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    currentElection = null;
    
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    
    document.getElementById('authSection').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('userInfo').style.display = 'none';
    
    showAlert('Logged out successfully', 'info');
}

// UI Functions
function showTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('#authSection .tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Show/hide forms
    document.getElementById('loginForm').classList.toggle('hidden', tabName !== 'login');
    document.getElementById('registerForm').classList.toggle('hidden', tabName !== 'register');
}

function showMainTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('#mainApp .tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(`${tabName}Tab`).classList.add('active');
    
    // Show/hide sections
    document.getElementById('electionsSection').classList.toggle('hidden', tabName !== 'elections');
    document.getElementById('historySection').classList.toggle('hidden', tabName !== 'history');
    document.getElementById('resultsSection').classList.toggle('hidden', tabName !== 'results');
    document.getElementById('votingSection').classList.add('hidden');
    
    // Load content based on tab
    switch(tabName) {
        case 'elections':
            loadElections();
            break;
        case 'history':
            loadVotingHistory();
            break;
        case 'results':
            loadElectionResults();
            break;
    }
}

function showMainApplication() {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    document.getElementById('userInfo').style.display = 'flex';
    
    // Update user info
    document.getElementById('userName').textContent = currentUser.fullName;
    document.getElementById('voterCard').textContent = `ID: ${formatVoterCardId(currentUser.voterCardId)}`;
    
    // Load elections by default
    loadElections();
}

// Election Functions
async function loadElections() {
    try {
        const elections = await apiCall('/elections');
        const electionsList = document.getElementById('electionsList');
        
        if (elections.length === 0) {
            electionsList.innerHTML = `
                <div class="card" style="text-align: center; color: #666;">
                    <i class="fas fa-vote-yea" style="font-size: 3rem; margin-bottom: 20px; opacity: 0.5;"></i>
                    <h3>No Active Elections</h3>
                    <p>There are currently no active elections. Check back later!</p>
                </div>
            `;
            return;
        }

        electionsList.innerHTML = elections.map(election => `
            <div class="election-card" onclick="viewElection(${election.id})">
                <h3>${election.title}</h3>
                <p style="color: #666; margin: 10px 0;">${election.description || 'No description available'}</p>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px;">
                    <div>
                        <small style="color: #888;">
                            <i class="fas fa-calendar"></i> ${formatDate(election.start_date)} - ${formatDate(election.end_date)}
                        </small>
                    </div>
                    <button class="btn" onclick="event.stopPropagation(); viewElection(${election.id})">
                        <i class="fas fa-vote-yea"></i> Vote Now
                    </button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        showAlert('Failed to load elections: ' + error.message, 'error');
    }
}

async function viewElection(electionId) {
    try {
        const [elections, candidates] = await Promise.all([
            apiCall('/elections'),
            apiCall(`/elections/${electionId}/candidates`)
        ]);
        
        currentElection = elections.find(e => e.id === electionId);
        
        if (!currentElection) {
            showAlert('Election not found', 'error');
            return;
        }
        
        document.getElementById('electionTitle').textContent = currentElection.title;
        document.getElementById('electionDescription').textContent = currentElection.description || 'No description available';
        
        const candidatesList = document.getElementById('candidatesList');
        
        if (candidates.length === 0) {
            candidatesList.innerHTML = `
                <div style="text-align: center; color: #666; padding: 40px;">
                    <i class="fas fa-users" style="font-size: 3rem; margin-bottom: 20px; opacity: 0.5;"></i>
                    <h3>No Candidates</h3>
                    <p>No candidates have been registered for this election yet.</p>
                </div>
            `;
        } else {
            candidatesList.innerHTML = candidates.map(candidate => `
                <div class="candidate-card">
                    <div class="candidate-info">
                        <h4>${candidate.name}</h4>
                        <p style="color: #666;">${candidate.description || 'No description available'}</p>
                    </div>
                    <button class="btn" onclick="castVote(${currentElection.id}, ${candidate.id}, '${candidate.name}')">
                        <i class="fas fa-check"></i> Vote
                    </button>
                </div>
            `).join('');
        }
        
        document.getElementById('electionsSection').classList.add('hidden');
        document.getElementById('votingSection').classList.remove('hidden');
        
    } catch (error) {
        showAlert('Failed to load election details: ' + error.message, 'error');
    }
}

async function castVote(electionId, candidateId, candidateName) {
    if (!confirm(`Are you sure you want to vote for ${candidateName}? This action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await apiCall('/vote', {
            method: 'POST',
            body: JSON.stringify({
                electionId,
                candidateId
            })
        });
        
        showAlert(`Vote cast successfully for ${candidateName}! Vote Hash: ${response.voteHash.substring(0, 16)}...`, 'success');
        backToElections();
        
    } catch (error) {
        showAlert('Failed to cast vote: ' + error.message, 'error');
    }
}

function backToElections() {
    document.getElementById('votingSection').classList.add('hidden');
    document.getElementById('electionsSection').classList.remove('hidden');
    currentElection = null;
}

// Voting History Functions
async function loadVotingHistory() {
    try {
        const votes = await apiCall('/my-votes');
        const voteHistory = document.getElementById('voteHistory');
        
        if (votes.length === 0) {
            voteHistory.innerHTML = `
                <div style="text-align: center; color: #666; padding: 40px;">
                    <i class="fas fa-history" style="font-size: 3rem; margin-bottom: 20px; opacity: 0.5;"></i>
                    <h3>No Voting History</h3>
                    <p>You haven't cast any votes yet. Participate in active elections to see your history here.</p>
                </div>
            `;
            return;
        }

        voteHistory.innerHTML = `
            <div class="vote-history">
                ${votes.map(vote => `
                    <div class="vote-item">
                        <div>
                            <h4 style="color: #667eea; margin-bottom: 5px;">${vote.election_title}</h4>
                            <p style="margin-bottom: 5px;"><strong>Voted for:</strong> ${vote.candidate_name}</p>
                            <small style="color: #888;">
                                <i class="fas fa-clock"></i> ${formatDate(vote.timestamp)}
                            </small>
                        </div>
                        <div style="text-align: right;">
                            <small style="color: #888; font-family: monospace;">
                                Hash: ${vote.vote_hash.substring(0, 16)}...
                            </small>
                            <br>
                            <span style="background: #e8f5e8; color: #2d5a2d; padding: 4px 8px; border-radius: 12px; font-size: 0.8rem;">
                                <i class="fas fa-check-circle"></i> Verified
                            </span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
    } catch (error) {
        showAlert('Failed to load voting history: ' + error.message, 'error');
    }
}

// Results Functions
async function loadElectionResults() {
    try {
        const elections = await apiCall('/elections');
        const resultsList = document.getElementById('resultsList');
        
        if (elections.length === 0) {
            resultsList.innerHTML = `
                <div style="text-align: center; color: #666; padding: 40px;">
                    <i class="fas fa-chart-bar" style="font-size: 3rem; margin-bottom: 20px; opacity: 0.5;"></i>
                    <h3>No Election Results</h3>
                    <p>No elections available to show results.</p>
                </div>
            `;
            return;
        }

        // Load results for all elections
        const resultsPromises = elections.map(election => 
            apiCall(`/elections/${election.id}/results`).then(results => ({
                election,
                results
            }))
        );
        
        const allResults = await Promise.all(resultsPromises);
        
        resultsList.innerHTML = allResults.map(({ election, results }) => `
            <div class="card" style="margin-bottom: 30px;">
                <h3 style="color: #667eea; margin-bottom: 15px;">
                    <i class="fas fa-poll"></i> ${election.title}
                </h3>
                <div class="stats-grid">
                    <div class="stat-card">
                        <span class="stat-number">${results.totalVotes}</span>
                        <span class="stat-label">Total Votes</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-number">${results.candidates.length}</span>
                        <span class="stat-label">Candidates</span>
                    </div>
                </div>
                
                <h4 style="margin: 20px 0 15px 0;">Results:</h4>
                ${results.candidates.map((candidate, index) => {
                    const percentage = results.totalVotes > 0 ? 
                        ((candidate.actual_votes / results.totalVotes) * 100).toFixed(1) : 0;
                    return `
                        <div style="margin-bottom: 20px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <div>
                                    <strong>${candidate.name}</strong>
                                    ${index === 0 && candidate.actual_votes > 0 ? '<i class="fas fa-crown" style="color: #ffd700; margin-left: 10px;"></i>' : ''}
                                </div>
                                <div style="text-align: right;">
                                    <strong>${candidate.actual_votes} votes</strong>
                                    <br>
                                    <small style="color: #666;">${percentage}%</small>
                                </div>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${percentage}%"></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `).join('');
        
    } catch (error) {
        showAlert('Failed to load election results: ' + error.message, 'error');
    }
}

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
    // Check for stored authentication
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('currentUser');
    
    if (storedToken && storedUser) {
        try {
            authToken = storedToken;
            currentUser = JSON.parse(storedUser);
            showMainApplication();
        } catch (error) {
            console.error('Failed to restore session:', error);
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
        }
    }
    
    // Show welcome message
    if (!authToken) {
        setTimeout(() => {
            showAlert('Welcome to the Student Voting System! Register to get your digital voter card or login if you already have an account.', 'info');
        }, 1000);
    }
});

// Global functions for onclick handlers
window.showTab = showTab;
window.showMainTab = showMainTab;
window.login = login;
window.register = register;
window.logout = logout;
window.viewElection = viewElection;
window.castVote = castVote;
window.backToElections = backToElections;