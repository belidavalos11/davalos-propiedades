// Multi-User Auth Management System for DÁVALOS PROPIEDADES

const AuthManager = {
    // STATIC DATABASE (Managed from this file)
    // Add or modify users here. 
    _users: [
        { username: 'admin', password: 'admin1234' },
        { username: 'belid', password: 'davalos2026' }
    ],

    // Private initialization and sync
    _init: function () {
        // Load stored overrides (passwords changed via UI)
        this._overrides = JSON.parse(localStorage.getItem('davalos_user_overrides')) || {};

        // Sync check: If the code-defined password for a user has changed, 
        // we might want to clear the local override.
        // For simplicity in this "frontend-only" setup, the code-defined list
        // is the primary source of truth for ALLOWED users.
    },

    // Public API
    isLoggedIn: function () {
        return JSON.parse(localStorage.getItem('davalos_auth')) || false;
    },

    getCurrentUser: function () {
        return localStorage.getItem('davalos_current_user');
    },

    login: function (username, password) {
        // Find user in our static list
        const user = this._users.find(u => u.username === username);

        if (!user) return false;

        // Check if there is an override for this user
        const storedPassword = this._overrides[username] || user.password;

        if (password === storedPassword) {
            localStorage.setItem('davalos_auth', JSON.stringify(true));
            localStorage.setItem('davalos_current_user', username);
            return true;
        }
        return false;
    },

    logout: function () {
        localStorage.removeItem('davalos_auth');
        localStorage.removeItem('davalos_current_user');
    },

    changePassword: function (newPassword) {
        if (!this.isLoggedIn()) return false;

        const username = this.getCurrentUser();
        if (!username) return false;

        // Save override locally
        this._overrides[username] = newPassword;
        localStorage.setItem('davalos_user_overrides', JSON.stringify(this._overrides));
        return true;
    },

    // Helper for debugging: reset everything to code defaults
    resetToDefaults: function () {
        localStorage.removeItem('davalos_user_overrides');
        this._overrides = {};
        console.log("Sistema reseteado a los valores del archivo auth.js");
    }
};

// Initialize the manager
AuthManager._init();

// Expose AuthManager globally
window.AuthManager = AuthManager;
