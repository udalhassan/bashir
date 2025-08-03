const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'voting_system.db');
const db = new sqlite3.Database(dbPath);

async function initializeDatabase() {
    console.log('Initializing Student Voting System Database...');
    
    try {
        // Create admin user
        const adminPassword = await bcrypt.hash('admin123', 12);
        
        db.serialize(() => {
            // Insert admin user
            db.run(`INSERT OR REPLACE INTO admins (username, password_hash) VALUES (?, ?)`, 
                ['admin', adminPassword], 
                function(err) {
                    if (err) {
                        console.error('Error creating admin user:', err.message);
                    } else {
                        console.log('✓ Admin user created (username: admin, password: admin123)');
                    }
                }
            );

            // Insert sample elections
            const elections = [
                {
                    title: 'Student Council President 2024',
                    description: 'Choose the next Student Council President who will represent all students and lead initiatives for the upcoming academic year.',
                    start_date: new Date().toISOString(),
                    end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
                },
                {
                    title: 'Best Student Organization 2024',
                    description: 'Vote for the student organization that has made the most positive impact on campus life this year.',
                    start_date: new Date().toISOString(),
                    end_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString() // 5 days from now
                }
            ];

            elections.forEach((election, index) => {
                db.run(`INSERT OR REPLACE INTO elections (id, title, description, start_date, end_date, is_active) 
                        VALUES (?, ?, ?, ?, ?, 1)`, 
                    [index + 1, election.title, election.description, election.start_date, election.end_date],
                    function(err) {
                        if (err) {
                            console.error(`Error creating election "${election.title}":`, err.message);
                        } else {
                            console.log(`✓ Election created: "${election.title}"`);
                        }
                    }
                );
            });

            // Insert sample candidates for Student Council President election
            const presidentialCandidates = [
                {
                    election_id: 1,
                    name: 'Sarah Johnson',
                    description: 'Computer Science senior with 3 years of student government experience. Focused on improving campus technology and student services.'
                },
                {
                    election_id: 1,
                    name: 'Michael Chen',
                    description: 'Business Administration senior and current Student Council Vice President. Committed to enhancing student life and academic support.'
                },
                {
                    election_id: 1,
                    name: 'Emily Rodriguez',
                    description: 'Psychology senior and founder of the Mental Health Awareness Club. Passionate about student wellness and inclusive campus culture.'
                }
            ];

            // Insert sample candidates for Best Student Organization election
            const organizationCandidates = [
                {
                    election_id: 2,
                    name: 'Environmental Action Club',
                    description: 'Leading campus sustainability initiatives and organizing clean-up drives. Made campus 50% more eco-friendly this year.'
                },
                {
                    election_id: 2,
                    name: 'Coding Bootcamp Society',
                    description: 'Provided free programming workshops to over 200 students and helped 50+ students land internships in tech companies.'
                },
                {
                    election_id: 2,
                    name: 'Community Service Alliance',
                    description: 'Organized 25+ volunteer events this year, contributing over 1000 hours of community service and helping local charities.'
                },
                {
                    election_id: 2,
                    name: 'International Students Association',
                    description: 'Supported international students with cultural events, academic assistance, and integration programs. Helped 100+ students feel at home.'
                }
            ];

            const allCandidates = [...presidentialCandidates, ...organizationCandidates];

            allCandidates.forEach((candidate, index) => {
                db.run(`INSERT OR REPLACE INTO candidates (id, election_id, name, description, vote_count) 
                        VALUES (?, ?, ?, ?, 0)`, 
                    [index + 1, candidate.election_id, candidate.name, candidate.description],
                    function(err) {
                        if (err) {
                            console.error(`Error creating candidate "${candidate.name}":`, err.message);
                        } else {
                            console.log(`✓ Candidate created: "${candidate.name}"`);
                        }
                    }
                );
            });

            // Create a sample student for testing
            const sampleStudentData = {
                student_id: 'STU001',
                email: 'student@university.edu',
                full_name: 'John Doe',
                password: 'password123'
            };

            bcrypt.hash(sampleStudentData.password, 12).then(hashedPassword => {
                const voterCardId = `VC-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 8)}`.toUpperCase();
                
                db.run(`INSERT OR REPLACE INTO students (student_id, email, full_name, password_hash, voter_card_id, is_verified) 
                        VALUES (?, ?, ?, ?, ?, 1)`, 
                    [sampleStudentData.student_id, sampleStudentData.email, sampleStudentData.full_name, 
                     hashedPassword, voterCardId],
                    function(err) {
                        if (err) {
                            console.error('Error creating sample student:', err.message);
                        } else {
                            console.log(`✓ Sample student created (ID: ${sampleStudentData.student_id}, Password: ${sampleStudentData.password})`);
                            console.log(`  Voter Card ID: ${voterCardId}`);
                        }
                    }
                );
            });
        });

        // Wait a bit for all operations to complete
        setTimeout(() => {
            console.log('\n🎉 Database initialization completed successfully!');
            console.log('\n📋 Summary:');
            console.log('- Admin Panel: username "admin", password "admin123"');
            console.log('- Sample Student: ID "STU001", password "password123"');
            console.log('- 2 Sample Elections with candidates created');
            console.log('- Database ready for use!');
            console.log('\n🚀 Start the server with: npm start');
            
            db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err.message);
                } else {
                    console.log('Database connection closed.');
                }
                process.exit(0);
            });
        }, 2000);

    } catch (error) {
        console.error('Error initializing database:', error);
        process.exit(1);
    }
}

// Run initialization
initializeDatabase();