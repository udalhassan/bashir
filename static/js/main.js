/**
 * Student Voting System - Main JavaScript
 * Utility functions and enhancements for the voting system
 */

// Global configuration
const VotingSystem = {
    apiBase: '/api',
    version: '1.0.0',
    debug: false
};

// Utility Functions
const Utils = {
    /**
     * Format date to readable string
     */
    formatDate: function(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    /**
     * Show toast notification
     */
    showToast: function(message, type = 'info') {
        // Create toast container if it doesn't exist
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'position-fixed top-0 end-0 p-3';
            toastContainer.style.zIndex = '9999';
            document.body.appendChild(toastContainer);
        }

        // Create toast element
        const toastId = 'toast-' + Date.now();
        const toastHtml = `
            <div id="${toastId}" class="toast align-items-center text-white bg-${type} border-0" role="alert">
                <div class="d-flex">
                    <div class="toast-body">
                        <i class="fas fa-${this.getToastIcon(type)} me-2"></i>
                        ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            </div>
        `;

        toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement, { delay: 5000 });
        toast.show();

        // Remove toast element after it's hidden
        toastElement.addEventListener('hidden.bs.toast', function() {
            toastElement.remove();
        });
    },

    /**
     * Get appropriate icon for toast type
     */
    getToastIcon: function(type) {
        const icons = {
            success: 'check-circle',
            danger: 'exclamation-triangle',
            warning: 'exclamation-circle',
            info: 'info-circle',
            primary: 'info-circle'
        };
        return icons[type] || 'info-circle';
    },

    /**
     * Copy text to clipboard
     */
    copyToClipboard: async function(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('Copied to clipboard!', 'success');
            return true;
        } catch (err) {
            console.error('Failed to copy: ', err);
            this.showToast('Failed to copy to clipboard', 'danger');
            return false;
        }
    },

    /**
     * Generate QR code download link
     */
    downloadQRCode: function(qrCodeData, filename = 'qr-code.png') {
        const link = document.createElement('a');
        link.href = 'data:image/png;base64,' + qrCodeData;
        link.download = filename;
        link.click();
    },

    /**
     * Validate email format
     */
    isValidEmail: function(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    /**
     * Validate student number format
     */
    isValidStudentNumber: function(studentNumber) {
        // Assuming format: YYYY + digits (e.g., 2024001234)
        const studentRegex = /^\d{4}\d{6}$/;
        return studentRegex.test(studentNumber);
    },

    /**
     * Show loading state on button
     */
    setButtonLoading: function(button, loading = true, originalText = null) {
        if (loading) {
            button.dataset.originalText = button.innerHTML;
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Loading...';
        } else {
            button.disabled = false;
            button.innerHTML = originalText || button.dataset.originalText || 'Submit';
        }
    },

    /**
     * Debounce function
     */
    debounce: function(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Local storage helper
     */
    storage: {
        set: function(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (e) {
                console.error('Failed to save to localStorage:', e);
                return false;
            }
        },

        get: function(key) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : null;
            } catch (e) {
                console.error('Failed to read from localStorage:', e);
                return null;
            }
        },

        remove: function(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (e) {
                console.error('Failed to remove from localStorage:', e);
                return false;
            }
        }
    }
};

// API Helper Functions
const API = {
    /**
     * Make API request with error handling
     */
    request: async function(endpoint, options = {}) {
        const url = VotingSystem.apiBase + endpoint;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const config = { ...defaultOptions, ...options };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    },

    /**
     * Register student
     */
    registerStudent: async function(studentData) {
        return await this.request('/register', {
            method: 'POST',
            body: JSON.stringify(studentData)
        });
    },

    /**
     * Get voter card
     */
    getVoterCard: async function(voterId) {
        return await this.request(`/voter-card/${voterId}`);
    },

    /**
     * Get active elections
     */
    getElections: async function() {
        return await this.request('/elections');
    },

    /**
     * Get candidates for election
     */
    getCandidates: async function(electionId) {
        return await this.request(`/elections/${electionId}/candidates`);
    },

    /**
     * Start voting session
     */
    startVotingSession: async function(voterId, electionId) {
        return await this.request('/vote/start', {
            method: 'POST',
            body: JSON.stringify({
                voter_id: voterId,
                election_id: electionId
            })
        });
    },

    /**
     * Cast votes
     */
    castVotes: async function(sessionToken, votes) {
        return await this.request('/vote/cast', {
            method: 'POST',
            body: JSON.stringify({
                session_token: sessionToken,
                votes: votes
            })
        });
    }
};

// Form Validation
const FormValidator = {
    /**
     * Validate registration form
     */
    validateRegistration: function(formData) {
        const errors = [];

        if (!formData.student_number || !Utils.isValidStudentNumber(formData.student_number)) {
            errors.push('Please enter a valid student number (10 digits)');
        }

        if (!formData.email || !Utils.isValidEmail(formData.email)) {
            errors.push('Please enter a valid email address');
        }

        if (!formData.first_name || formData.first_name.trim().length < 2) {
            errors.push('First name must be at least 2 characters');
        }

        if (!formData.last_name || formData.last_name.trim().length < 2) {
            errors.push('Last name must be at least 2 characters');
        }

        if (!formData.department) {
            errors.push('Please select a department');
        }

        if (!formData.year_of_study) {
            errors.push('Please select year of study');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
};

// Security helpers
const Security = {
    /**
     * Generate secure session ID
     */
    generateSessionId: function() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    /**
     * Sanitize HTML to prevent XSS
     */
    sanitizeHTML: function(str) {
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    },

    /**
     * Check if voter ID format is valid
     */
    isValidVoterId: function(voterId) {
        // SHA-256 hash should be 64 characters long and contain only hex characters
        const voterIdRegex = /^[a-f0-9]{64}$/i;
        return voterIdRegex.test(voterId);
    }
};

// Animation helpers
const Animations = {
    /**
     * Animate counter from 0 to target value
     */
    animateCounter: function(elementId, targetValue, duration = 2000) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const startValue = 0;
        const increment = targetValue / (duration / 16); // 60 FPS
        let currentValue = startValue;

        const timer = setInterval(() => {
            currentValue += increment;
            if (currentValue >= targetValue) {
                currentValue = targetValue;
                clearInterval(timer);
            }
            element.textContent = Math.floor(currentValue).toLocaleString();
        }, 16);
    },

    /**
     * Fade in element
     */
    fadeIn: function(element, duration = 300) {
        element.style.opacity = '0';
        element.style.display = 'block';

        let opacity = 0;
        const timer = setInterval(() => {
            opacity += 50 / duration;
            if (opacity >= 1) {
                clearInterval(timer);
                opacity = 1;
            }
            element.style.opacity = opacity;
        }, 50);
    },

    /**
     * Fade out element
     */
    fadeOut: function(element, duration = 300) {
        let opacity = 1;
        const timer = setInterval(() => {
            opacity -= 50 / duration;
            if (opacity <= 0) {
                clearInterval(timer);
                opacity = 0;
                element.style.display = 'none';
            }
            element.style.opacity = opacity;
        }, 50);
    }
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', function() {
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Initialize popovers
    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });

    // Add smooth scrolling to anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // Add loading animation to forms
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', function() {
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                Utils.setButtonLoading(submitBtn, true);
            }
        });
    });

    // Initialize dark mode toggle if present
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', function() {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            Utils.storage.set('darkMode', isDark);
        });

        // Load saved dark mode preference
        const savedDarkMode = Utils.storage.get('darkMode');
        if (savedDarkMode) {
            document.body.classList.add('dark-mode');
        }
    }

    // Add accessibility improvements
    document.querySelectorAll('button, a').forEach(element => {
        if (!element.hasAttribute('aria-label') && !element.textContent.trim()) {
            element.setAttribute('aria-label', 'Button');
        }
    });

    console.log('Student Voting System initialized successfully');
});

// Global error handler
window.addEventListener('error', function(e) {
    if (VotingSystem.debug) {
        console.error('Global error:', e.error);
    }
});

// Export utilities for global use
window.VotingSystem = VotingSystem;
window.Utils = Utils;
window.API = API;
window.FormValidator = FormValidator;
window.Security = Security;
window.Animations = Animations;