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
        EDITOR: ["UPLOAD_PROPERTY", "EDIT_PROPERTY", "VIEW_PRIVATE_DATA", "ACCESS_SETTINGS"],
        AGENT: ["UPLOAD_PROPERTY", "VIEW_PRIVATE_DATA", "ACCESS_SETTINGS"]
    },

    _users: [
        { username: "admin", password: "admin1234", displayName: "Admin", role: "SUPER_ADMIN", phone: "5493875053884" },
        { username: "beli", password: "beli2026", displayName: "Beli", role: "SUPER_ADMIN", phone: "5493875053884" },
        { username: "belidavalos", password: "beli2026", displayName: "Beli", role: "SUPER_ADMIN", phone: "5493875053884" },
        { username: "irenegarcia", password: "ire2026", displayName: "Ire", role: "SUPER_ADMIN", phone: "5493871234567" },
        { username: "flopypfister", password: "flopy2026", displayName: "Flopy", role: "SUPER_ADMIN", phone: "5493874155902" },
    ],

    _sessionHours: 12,
    _readyPromise: null,

    _init() {
        this._readyPromise = (async () => {
            this._overrides = JSON.parse(localStorage.getItem("davalos_user_overrides")) || {};
            this._ensureSessionValidity();
            
            // Ensure Firebase is synced before loading users
            await this._syncWithFirebase();
            
            this._cachedUsers = [];
            await this._loadUsersFromFirestore();
        })();
    },

    async _loadUsersFromFirestore() {
        if (!window.db) {
            console.warn("Firestore (window.db) no está inicializado. No se pueden cargar usuarios externos.");
            return;
        }
        try {
            const snapshot = await window.db.collection("users").get();
            this._cachedUsers = snapshot.docs.map(doc => ({ ...doc.data(), firebaseId: doc.id }));
            console.log(`[Auth] Sincronización exitosa: ${this._cachedUsers.length} usuarios externos cargados.`);
        } catch (e) {
            console.error("[Auth] ERROR al cargar usuarios de Firestore:", e);
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
        
        console.log(`[Auth] Intento de login: "${normalized}"`);

        // Wait for ready promise if it exists to ensure initial sync
        if (this._readyPromise) {
            await this._readyPromise;
        }

        // Final check for Firebase/Firestore
        if (window.auth && !window.auth.currentUser) {
            try {
                await window.auth.signInAnonymously();
            } catch(e) {
                console.error("[Auth] Error de sesión anónima:", e);
            }
        }
        
        // Refresh to ensure latest data
        await this._loadUsersFromFirestore();
        
        const users = this.getAllUsersSync();
        const user = users.find((u) => u.username === normalized);
        
        if (!user) {
            console.warn(`[Auth] Login fallido: El usuario "${normalized}" no fue encontrado en la base de datos (${users.length} usuarios totales).`);
            return false;
        }

        // Password matching
        const storedPassword = (this._overrides[normalized] || user.password || "").trim();
        
        if (cleanPassword === storedPassword) {
            const authData = {
                logged: true,
                timestamp: Date.now()
            };

            localStorage.setItem(this._sessionKey(), JSON.stringify(authData));
            localStorage.setItem("davalos_current_user", normalized);

            console.log(`[Auth] Login exitoso: "${normalized}" con rol ${user.role}`);
            return true;
        } else {
            console.warn(`[Auth] Login fallido para "${normalized}": Contraseña incorrecta.`);
            // Diagnostic for the developer (don't show full passwords in prod usually, but here it helps)
            console.log(`[Auth Diagnostic] Longitudes - Ingresada: ${cleanPassword.length}, Guardada: ${storedPassword.length}`);
            return false;
        }
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
        localStorage.removeItem("davalos_core_user_edits");
        this._overrides = {};
        this._cachedUsers = [];
        this.logout();
        console.log("Sistema reseteado a los valores por defecto.");
    },

    getAllUsersSync() {
        const deletedCore = JSON.parse(localStorage.getItem("davalos_deleted_core_users") || "[]");
        const coreEdits = JSON.parse(localStorage.getItem("davalos_core_user_edits") || "{}");

        const filteredCore = this._users
            .filter(u => !deletedCore.includes(u.username))
            .map(u => {
                const norm = this._normalizeUsername(u.username);
                if (coreEdits[norm]) {
                    // Combinar propiedades estáticas con los cambios guardados
                    return { ...u, ...coreEdits[norm] };
                }
                return u;
            });

        const extraUsers = JSON.parse(localStorage.getItem("davalos_extra_users") || "[]");
        
        // Evitar duplicados si por algún motivo un usuario local ya está en cached o core
        const allUsers = [...filteredCore, ...this._cachedUsers, ...extraUsers];
        const uniqueUsers = [];
        const seen = new Set();
        for (const u of allUsers) {
            const normalized = this._normalizeUsername(u.username);
            if (!seen.has(normalized)) {
                seen.add(normalized);
                uniqueUsers.push(u);
            }
        }
        return uniqueUsers;
    },

    async getAllUsers() {
        await this._loadUsersFromFirestore();
        return this.getAllUsersSync();
    },

    async addUser(userData) {
        if (!this.hasPermission(this.Permissions.MANAGE_USERS)) {
            return { success: false, reason: "permission" };
        }
        
        const normalized = this._normalizeUsername(userData.username);
        const all = await this.getAllUsers();
        
        // Prevent duplicates
        if (all.some(u => u.username === normalized)) {
            return { success: false, reason: "duplicate" };
        }

        // Clear any old local overrides for this username to avoid credential mismatch
        if (this._overrides[normalized]) {
            delete this._overrides[normalized];
            localStorage.setItem("davalos_user_overrides", JSON.stringify(this._overrides));
        }

        const cleanUserData = {
            ...userData,
            username: normalized,
            password: String(userData.password || "").trim(),
            createdAt: new Date().toISOString()
        };

        try {
            if (!window.db) {
                throw new Error("Firestore no está inicializado");
            }
            await window.db.collection("users").add(cleanUserData);
            await this._loadUsersFromFirestore();
            return { success: true, mode: "firestore" };
        } catch (e) {
            console.warn("Fallo al escribir usuario en Firestore, usando respaldo local:", e);
            try {
                const extraUsers = JSON.parse(localStorage.getItem("davalos_extra_users") || "[]");
                extraUsers.push(cleanUserData);
                localStorage.setItem("davalos_extra_users", JSON.stringify(extraUsers));
                return { success: true, mode: "local", error: e.message || String(e) };
            } catch (localErr) {
                console.error("Error crítico al guardar usuario localmente:", localErr);
                return { success: false, reason: "error", error: localErr.message || String(localErr) };
            }
        }
    },

    async removeUser(username) {
        if (!this.hasPermission(this.Permissions.MANAGE_USERS)) {
            return { success: false, reason: "permission" };
        }
        const normalized = this._normalizeUsername(username);
        const currentUser = this.getCurrentUser();

        // 1. Safety: Cannot remove the main "admin" or yourself
        if (normalized === "admin") return { success: false, reason: "protected" };
        if (normalized === currentUser) return { success: false, reason: "self" };

        // 2. Check if it's a core user
        if (this._users.some(u => u.username === normalized)) {
            const deletedCore = JSON.parse(localStorage.getItem("davalos_deleted_core_users") || "[]");
            if (!deletedCore.includes(normalized)) {
                deletedCore.push(normalized);
                localStorage.setItem("davalos_deleted_core_users", JSON.stringify(deletedCore));
            }
            return { success: true, mode: "core" };
        }

        // 3. Check and delete from local extra users
        const extraUsers = JSON.parse(localStorage.getItem("davalos_extra_users") || "[]");
        const initialLen = extraUsers.length;
        const filteredExtra = extraUsers.filter(u => this._normalizeUsername(u.username) !== normalized);
        if (filteredExtra.length !== initialLen) {
            localStorage.setItem("davalos_extra_users", JSON.stringify(filteredExtra));
            return { success: true, mode: "local" };
        }

        // 4. Otherwise, it's a Firestore user
        try {
            if (window.db) {
                const snapshot = await window.db.collection("users").where("username", "==", normalized).get();
                if (!snapshot.empty) {
                    const batch = window.db.batch();
                    snapshot.docs.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                    await this._loadUsersFromFirestore();
                    return { success: true, mode: "firestore" };
                }
            }
        } catch (e) {
            console.error("Error al eliminar usuario de Firestore:", e);
        }

        return { success: false, reason: "not_found" };
    },

    async updateUser(username, userData) {
        if (!this.hasPermission(this.Permissions.MANAGE_USERS)) {
            return { success: false, reason: "permission" };
        }

        const normalized = this._normalizeUsername(username);
        const currentUser = this.getCurrentUser();

        // 1. Safety checks
        if (normalized === "admin") return { success: false, reason: "protected" };
        
        // Prepare clean user data
        const cleanUserData = {
            displayName: String(userData.displayName || "").trim(),
            firstName: String(userData.firstName || "").trim(),
            lastName: String(userData.lastName || "").trim(),
            phone: String(userData.phone || "").trim(),
            role: userData.role
        };

        if (userData.password && String(userData.password).trim().length >= 6) {
            cleanUserData.password = String(userData.password).trim();
            // Also store as override if the user changes password so logic in login() matches
            this._overrides[normalized] = cleanUserData.password;
            localStorage.setItem("davalos_user_overrides", JSON.stringify(this._overrides));
        }

        // 2. Check if it's a core user
        if (this._users.some(u => u.username === normalized)) {
            try {
                const coreEdits = JSON.parse(localStorage.getItem("davalos_core_user_edits") || "{}");
                coreEdits[normalized] = {
                    ...(coreEdits[normalized] || {}),
                    ...cleanUserData
                };
                localStorage.setItem("davalos_core_user_edits", JSON.stringify(coreEdits));
                return { success: true, mode: "core" };
            } catch (err) {
                console.error("Error al actualizar usuario core localmente:", err);
                return { success: false, reason: "error", error: err.message };
            }
        }

        // 3. Check if it's a local extra user
        const extraUsers = JSON.parse(localStorage.getItem("davalos_extra_users") || "[]");
        const extraIndex = extraUsers.findIndex(u => this._normalizeUsername(u.username) === normalized);
        if (extraIndex !== -1) {
            try {
                extraUsers[extraIndex] = {
                    ...extraUsers[extraIndex],
                    ...cleanUserData
                };
                localStorage.setItem("davalos_extra_users", JSON.stringify(extraUsers));
                return { success: true, mode: "local" };
            } catch (err) {
                console.error("Error al actualizar usuario local:", err);
                return { success: false, reason: "error", error: err.message };
            }
        }

        // 4. Otherwise, it's a Firestore user (or falls back to local extra users if Firestore fails)
        try {
            if (!window.db) {
                throw new Error("Firestore no está inicializado");
            }
            const snapshot = await window.db.collection("users").where("username", "==", normalized).get();
            if (!snapshot.empty) {
                const docRef = snapshot.docs[0].ref;
                // Merge cleanUserData in Firestore
                await docRef.update(cleanUserData);
                await this._loadUsersFromFirestore();
                return { success: true, mode: "firestore" };
            } else {
                throw new Error("El usuario no se encontró en la nube ni localmente");
            }
        } catch (e) {
            console.warn("Fallo al actualizar usuario en Firestore, usando almacenamiento local como respaldo:", e);
            try {
                // If it wasn't in local extra, but we have cached doc, add it to local extra with new updates
                const cachedUser = this._cachedUsers.find(u => this._normalizeUsername(u.username) === normalized);
                const baseUser = cachedUser || { username: normalized, createdAt: new Date().toISOString() };
                
                const mergedLocal = {
                    ...baseUser,
                    ...cleanUserData
                };

                const updatedExtra = extraUsers.filter(u => this._normalizeUsername(u.username) !== normalized);
                updatedExtra.push(mergedLocal);
                localStorage.setItem("davalos_extra_users", JSON.stringify(updatedExtra));
                return { success: true, mode: "local", error: e.message || String(e) };
            } catch (localErr) {
                console.error("Error crítico al actualizar localmente:", localErr);
                return { success: false, reason: "error", error: localErr.message || String(localErr) };
            }
        }
    }
};

AuthManager._init();
window.AuthManager = AuthManager;
