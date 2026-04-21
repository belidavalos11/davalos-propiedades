const AuthManager = {
    Roles: {
        SUPER_ADMIN: "SUPER_ADMIN",
        ADMIN: "ADMIN",
        EDITOR: "EDITOR",
        AGENT: "AGENT"
    },

    Permissions: {
        UPLOAD_PROPERTY: "UPLOAD_PROPERTY",
        EDIT_PROPERTY: "EDIT_PROPERTY",
        DELETE_PROPERTY: "DELETE_PROPERTY",
        DELETE_PUBLICATION: "DELETE_PUBLICATION",
        ACCESS_SETTINGS: "ACCESS_SETTINGS",
        VIEW_PRIVATE_DATA: "VIEW_PRIVATE_DATA",
        MANAGE_USERS: "MANAGE_USERS"
    },

    _rolePermissions: {
        SUPER_ADMIN: ["UPLOAD_PROPERTY", "EDIT_PROPERTY", "DELETE_PROPERTY", "DELETE_PUBLICATION", "ACCESS_SETTINGS", "VIEW_PRIVATE_DATA", "MANAGE_USERS"],
        ADMIN: ["UPLOAD_PROPERTY", "EDIT_PROPERTY", "DELETE_PROPERTY", "ACCESS_SETTINGS", "VIEW_PRIVATE_DATA"],
        EDITOR: ["UPLOAD_PROPERTY", "EDIT_PROPERTY", "VIEW_PRIVATE_DATA"],
        AGENT: ["UPLOAD_PROPERTY", "VIEW_PRIVATE_DATA"]
    },

    _users: [
        { username: "admin", password: "admin1234", displayName: "Admin", role: "SUPER_ADMIN", phone: "5493875053884" },
        { username: "beli", password: "beli2026", displayName: "Beli", role: "SUPER_ADMIN", phone: "5493875053884" },
        { username: "belidavalos", password: "beli2026", displayName: "Beli", role: "SUPER_ADMIN", phone: "5493875053884" },
        { username: "irenegarcia", password: "ire2026", displayName: "Ire", role: "SUPER_ADMIN", phone: "5493871234567" },
        { username: "flopypfister", password: "flopy2026", displayName: "Flopy", role: "SUPER_ADMIN", phone: "5493871234567" },
    ],

    _sessionHours: 12,

    _init() {
        this._overrides = JSON.parse(localStorage.getItem("davalos_user_overrides")) || {};
        this._ensureSessionValidity();
        this._syncWithFirebase();
        this._cachedUsers = [];
        this._loadUsersFromFirestore();
    },

    async _loadUsersFromFirestore() {
        if (!window.db) return;
        try {
            const snapshot = await window.db.collection("users").get();
            this._cachedUsers = snapshot.docs.map(doc => ({ ...doc.data(), firebaseId: doc.id }));
            console.log("Usuarios cargados desde Firestore:", this._cachedUsers.length);
        } catch (e) {
            console.error("Error al cargar usuarios de Firestore:", e);
        }
    },

    async _syncWithFirebase() {
        if (window.auth) {
            const user = window.auth.currentUser;
            if (!user) {
                try {
                    await window.auth.signInAnonymously();
                    console.log("Firebase session synced (Anonymous)");
                } catch (e) {
                    console.error("Firebase sync error:", e);
                }
            }
        }
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
        const users = this.getAllUsersSync();
        return users.find(u => u.username === username);
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

    async login(username, password) {
        const normalized = this._normalizeUsername(username);
        const cleanPassword = String(password || "").trim();
        
        // Sync with Firebase to ensure we can read Firestore users
        if (window.auth) {
            try {
                await window.auth.signInAnonymously();
            } catch(e) {
                console.error("Firebase Auth Error:", e);
            }
        }
        
        // Refresh users from Firestore before login to ensure we have the latest
        await this._loadUsersFromFirestore();
        
        const users = this.getAllUsersSync();
        const user = users.find((u) => u.username === normalized);
        if (!user) return false;

        const storedPassword = (this._overrides[normalized] || user.password || "").trim();
        if (cleanPassword !== storedPassword) return false;

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
        if (window.auth) {
            window.auth.signOut().catch(e => console.error("Firebase SignOut Error:", e));
        }
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
        localStorage.removeItem("davalos_extra_users");
        localStorage.removeItem("davalos_deleted_core_users");
        this._overrides = {};
        this._cachedUsers = [];
        this.logout();
        console.log("Sistema reseteado a los valores por defecto.");
    },

    getAllUsersSync() {
        const deletedCore = JSON.parse(localStorage.getItem("davalos_deleted_core_users") || "[]");
        const filteredCore = this._users.filter(u => !deletedCore.includes(u.username));
        return [...filteredCore, ...this._cachedUsers];
    },

    async getAllUsers() {
        await this._loadUsersFromFirestore();
        return this.getAllUsersSync();
    },

    async addUser(userData) {
        if (!this.hasPermission(this.Permissions.MANAGE_USERS)) return false;
        
        const normalized = this._normalizeUsername(userData.username);
        const all = await this.getAllUsers();
        
        // Prevent duplicates
        if (all.some(u => u.username === normalized)) return false;

        try {
            const cleanUserData = {
                ...userData,
                username: normalized,
                password: String(userData.password || "").trim(),
                createdAt: new Date().toISOString()
            };
            await window.db.collection("users").add(cleanUserData);
            await this._loadUsersFromFirestore();
            return true;
        } catch (e) {
            console.error("Error al agregar usuario a Firestore:", e);
            return false;
        }
    },

    async removeUser(username) {
        if (!this.hasPermission(this.Permissions.MANAGE_USERS)) return false;
        const normalized = this._normalizeUsername(username);
        const currentUser = this.getCurrentUser();

        // 1. Safety: Cannot remove the main "admin" or yourself
        if (normalized === "admin") return false;
        if (normalized === currentUser) return false;

        // 2. Check if it's a core user
        if (this._users.some(u => u.username === normalized)) {
            const deletedCore = JSON.parse(localStorage.getItem("davalos_deleted_core_users") || "[]");
            if (!deletedCore.includes(normalized)) {
                deletedCore.push(normalized);
                localStorage.setItem("davalos_deleted_core_users", JSON.stringify(deletedCore));
            }
            return true;
        }

        // 3. Otherwise, it's a Firestore user
        try {
            const snapshot = await window.db.collection("users").where("username", "==", normalized).get();
            if (!snapshot.empty) {
                const batch = window.db.batch();
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                await this._loadUsersFromFirestore();
                return true;
            }
        } catch (e) {
            console.error("Error al eliminar usuario de Firestore:", e);
        }

        return false;
    }
};

AuthManager._init();
window.AuthManager = AuthManager;
