const AuthManager = {
    Roles: {
        ADMIN: "ADMIN",
        EDITOR: "EDITOR",
        AGENT: "AGENT"
    },

    Permissions: {
        UPLOAD_PROPERTY: "UPLOAD_PROPERTY",
        EDIT_PROPERTY: "EDIT_PROPERTY",
        DELETE_PROPERTY: "DELETE_PROPERTY",
        ACCESS_SETTINGS: "ACCESS_SETTINGS",
        VIEW_PRIVATE_DATA: "VIEW_PRIVATE_DATA"
    },

    _rolePermissions: {
        ADMIN: ["UPLOAD_PROPERTY", "EDIT_PROPERTY", "DELETE_PROPERTY", "ACCESS_SETTINGS", "VIEW_PRIVATE_DATA"],
        EDITOR: ["UPLOAD_PROPERTY", "EDIT_PROPERTY", "VIEW_PRIVATE_DATA"],
        AGENT: ["UPLOAD_PROPERTY", "VIEW_PRIVATE_DATA"]
    },

    _users: [
        { username: "admin", password: "admin1234", displayName: "Admin", role: "ADMIN" },
        { username: "belidavalos", password: "beli2026", displayName: "Beli", role: "ADMIN" },
        { username: "irenegarcia", password: "ire2026", displayName: "Ire", role: "EDITOR" },
        { username: "flopypfister", password: "flopy2026", displayName: "Flopy", role: "EDITOR" },
    ],

    _sessionHours: 12,

    _init() {
        this._overrides = JSON.parse(localStorage.getItem("davalos_user_overrides")) || {};
        this._ensureSessionValidity();
    },

    _normalizeUsername(value) {
        return String(value || "").trim().toLowerCase();
    },

    _sessionKey() {
        return "davalos_auth";
    },

    _ensureSessionValidity() {
        const auth = JSON.parse(localStorage.getItem(this._sessionKey()) || "null");
        if (!auth || auth.logged !== true) {
            localStorage.removeItem(this._sessionKey());
            return;
        }

        const maxAge = this._sessionHours * 60 * 60 * 1000;
        if (!auth.timestamp || (Date.now() - auth.timestamp) > maxAge) {
            this.logout();
        }
    },

    isLoggedIn() {
        this._ensureSessionValidity();
        const auth = JSON.parse(localStorage.getItem(this._sessionKey()) || "null");
        return Boolean(auth && auth.logged === true);
    },

    getCurrentUser() {
        return localStorage.getItem("davalos_current_user");
    },

    getDisplayName() {
        const user = this.getUserData();
        return user ? user.displayName : this.getCurrentUser();
    },

    getUserData() {
        const username = this.getCurrentUser();
        if (!username) return null;
        return this._users.find(u => u.username === username);
    },

    getUserRole() {
        const user = this.getUserData();
        return user ? user.role : null;
    },

    hasPermission(permission) {
        if (!this.isLoggedIn()) return false;
        const role = this.getUserRole();
        if (!role) return false;
        const perms = this._rolePermissions[role] || [];
        return perms.includes(permission);
    },

    login(username, password) {
        const normalized = this._normalizeUsername(username);
        const user = this._users.find((u) => u.username === normalized);
        if (!user) return false;

        const storedPassword = this._overrides[normalized] || user.password;
        if (password !== storedPassword) return false;

        const authData = {
            logged: true,
            timestamp: Date.now()
        };

        localStorage.setItem(this._sessionKey(), JSON.stringify(authData));
        localStorage.setItem("davalos_current_user", normalized);
        return true;
    },

    logout() {
        localStorage.removeItem(this._sessionKey());
        localStorage.removeItem("davalos_current_user");
    },

    logoutAndClearSessionData() {
        this.logout();
        localStorage.removeItem("davalos_properties");
    },

    changePassword(newPassword) {
        if (!this.isLoggedIn()) return false;
        if (typeof newPassword !== "string" || newPassword.trim().length < 6) return false;

        const username = this.getCurrentUser();
        if (!username) return false;

        this._overrides[username] = newPassword.trim();
        localStorage.setItem("davalos_user_overrides", JSON.stringify(this._overrides));
        return true;
    },

    resetToDefaults() {
        localStorage.removeItem("davalos_user_overrides");
        localStorage.removeItem("davalos_properties");
        this._overrides = {};
        this.logout();
        console.log("Sistema reseteado a los valores por defecto.");
    }
};

AuthManager._init();
window.AuthManager = AuthManager;
