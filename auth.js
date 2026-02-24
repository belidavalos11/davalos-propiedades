// Auth Management System for DÁVALOS PROPIEDADES

const AuthManager = {
    // Initial configuration
    _defaultUser: { username: 'admin', password: 'admin123' },

    // Getters and helper methods
    _getUserData: function () {
        return JSON.parse(localStorage.getItem('davalos_user_data')) || this._defaultUser;
    },

    _setUserData: function (data) {
        localStorage.setItem('davalos_user_data', JSON.stringify(data));
    },

    // Public API
    isLoggedIn: function () {
        return JSON.parse(localStorage.getItem('davalos_auth')) || false;
    },

    login: function (username, password) {
        const userData = this._getUserData();
        if (username === userData.username && password === userData.password) {
            localStorage.setItem('davalos_auth', JSON.stringify(true));
            return true;
        }
        return false;
    },

    logout: function () {
        localStorage.removeItem('davalos_auth');
    },

    changePassword: function (newPassword) {
        if (!this.isLoggedIn()) return false;

        const userData = this._getUserData();
        userData.password = newPassword;
        this._setUserData(userData);
        return true;
    }
};

// Expose AuthManager globally
window.AuthManager = AuthManager;
