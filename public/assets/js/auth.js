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
        AGENT: ["UPLOAD_PROPERTY", "EDIT_PROPERTY", "DELETE_PROPERTY", "VIEW_PRIVATE_DATA", "ACCESS_SETTINGS"]
    },

    _users: [
        { username: "admin", password: "admin1234", displayName: "Admin", role: "SUPER_ADMIN", phone: "5493875053884" },
        { username: "beli", password: "beli2026", displayName: "Beli", role: "SUPER_ADMIN", phone: "5493875053884" },
        { username: "belidavalos", password: "beli2026", displayName: "Beli", role: "SUPER_ADMIN", phone: "5493875053884" },
        { username: "irenegarcia", password: "ire2026", displayName: "Ire", role: "SUPER_ADMIN", phone: "5493871234567" },
        { username: "flopypfister", password: "flopy2026", displayName: "Flopy", role: "SUPER_ADMIN", phone: "5493874155902" },
    ],

    _sessionHours: 12,
    // Perfil del usuario logueado (users/{uid}): unica fuente de rol y estado. { uid, email, displayName, photoURL, role, status }
    currentUserProfile: null,
    _profileUnsub: null,
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
        // Legado: los usuarios usuario/contrasena fueron reemplazados por perfiles de Google (ver watchTeam).
        return;
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
        if (!window.auth) return;

        // Esperar a que Firebase restaure la sesion persistida (ej. Google).
        const restored = await new Promise(resolve => {
            const unsubscribe = window.auth.onAuthStateChanged(u => { unsubscribe(); resolve(u); });
        });

        if (restored && !restored.isAnonymous) {
            // Revalidar contra Firestore: la cuenta debe seguir activa y con su rol vigente.
            let profile;
            try {
                profile = await this._fetchUserProfile(restored);
            } catch (e) {
                console.warn("[Auth] No se pudo revalidar el perfil:", e);
                profile = undefined; // error de red/permisos: no se puede confirmar
            }
            if (profile === undefined && localStorage.getItem(this._sessionKey())) {
                return; // sin conexion: mantener la sesion local hasta poder revalidar
            }
            if (restored.emailVerified && profile && profile.status === "active") {
                this._saveGoogleSession(restored, profile, true);
                return;
            }
            await window.auth.signOut().catch(() => {});
            this._clearGoogleSession();
        }

        if (!window.auth.currentUser) {
            try {
                await window.auth.signInAnonymously();
                console.log("Firebase session synced (Anonymous)");
            } catch (e) {
                console.error("Firebase sync error:", e);
            }
        }
    },

    // ---- Google Sign-In + perfiles en Firestore (coleccion `users`, id = uid) ----
    // status: 'pending' | 'active' | 'inactive'  -  role: 'AGENT' | 'ADMIN' | 'SUPER_ADMIN'
    // No hay correos fijos: los permisos salen siempre del perfil en Firestore (ver firestore.rules).
    async _fetchUserProfile(user) {
        const snap = await window.db.collection("users").doc(user.uid).get();
        return snap.exists ? snap.data() : null;
    },

    // Crea el perfil si no existe.
    //  - Arranque: si nadie reclamo todavia SUPER_ADMIN (no existe meta/bootstrap), el primer usuario lo obtiene
    //    (lote atomico perfil + marcador) y el arranque queda sellado.
    //  - Resto: solicitud 'pending' con rol AGENT, a la espera de aprobacion del Super Admin.
    async _ensureUserProfile(user) {
        const db = window.db;
        const ref = db.collection("users").doc(user.uid);
        const markerRef = db.collection("meta").doc("bootstrap");
        const ts = firebase.firestore.FieldValue.serverTimestamp();
        const email = String(user.email || "").trim().toLowerCase();
        const base = { email, displayName: user.displayName || email, photoURL: user.photoURL || "" };
        const snap = await ref.get();

        if (snap.exists) {
            const data = snap.data();
            if (data.status === "active" && data.role === this.Roles.SUPER_ADMIN) {
                // Sellar el arranque si todavia no estaba (idempotente; solo un SUPER_ADMIN activo puede escribirlo).
                markerRef.get()
                    .then(m => (m.exists ? null : markerRef.set({ claimedBy: user.uid, createdAt: ts })))
                    .catch(() => {});
            }
            if (data.displayName !== base.displayName || data.photoURL !== base.photoURL) {
                ref.update({ displayName: base.displayName, photoURL: base.photoURL, updatedAt: ts }).catch(() => {});
            }
            return { profile: data, created: false };
        }

        let marker = null;
        try { marker = await markerRef.get(); } catch (e) { marker = null; }
        if (marker && !marker.exists) {
            const profile = { ...base, role: this.Roles.SUPER_ADMIN, status: "active", createdAt: ts, updatedAt: ts };
            try {
                const batch = db.batch();
                batch.set(ref, profile);
                batch.set(markerRef, { claimedBy: user.uid, createdAt: ts });
                await batch.commit();
                return { profile, created: true };
            } catch (e) {
                console.warn("[Auth] No se pudo reclamar el arranque; se registra como solicitud:", e);
            }
        }

        const profile = { ...base, role: this.Roles.AGENT, status: "pending", createdAt: ts, updatedAt: ts };
        await ref.set(profile);
        return { profile, created: true };
    },

    _applyProfile(uid, profile) {
        const email = String(profile.email || (this.currentUserProfile && this.currentUserProfile.email) || "").trim().toLowerCase();
        this.currentUserProfile = {
            uid,
            email,
            displayName: profile.displayName || email,
            photoURL: profile.photoURL || "",
            role: profile.role,
            status: profile.status
        };
        localStorage.setItem("davalos_current_user", email);
        localStorage.setItem("davalos_google_user", JSON.stringify(this.currentUserProfile));
    },

    _saveGoogleSession(user, profile, keepTimestamp) {
        let timestamp = Date.now();
        if (keepTimestamp) {
            try {
                const prev = JSON.parse(localStorage.getItem(this._sessionKey()) || "null");
                if (prev && prev.timestamp) timestamp = prev.timestamp;
            } catch (e) { /* noop */ }
        }
        localStorage.setItem(this._sessionKey(), JSON.stringify({ logged: true, timestamp, provider: "google" }));
        this._applyProfile(user.uid, { ...profile, email: profile.email || user.email });
        this._startProfileWatch(user.uid);
    },

    // Escucha en vivo el propio perfil: si cambia el rol se actualiza la UI; si se suspende, se cierra la sesion.
    _startProfileWatch(uid) {
        this._stopProfileWatch();
        if (!window.db) return;
        this._profileUnsub = window.db.collection("users").doc(uid).onSnapshot(
            snap => {
                const data = snap.exists ? snap.data() : null;
                if (!data || data.status !== "active") {
                    this.logout();
                    window.location.reload();
                    return;
                }
                const prev = this.currentUserProfile;
                this._applyProfile(uid, data);
                if (prev && prev.role !== data.role && typeof window.updateAuthUI === "function") {
                    window.updateAuthUI();
                }
            },
            err => console.warn("[Auth] No se pudo escuchar el perfil:", err)
        );
    },

    _stopProfileWatch() {
        if (this._profileUnsub) {
            this._profileUnsub();
            this._profileUnsub = null;
        }
    },

    _clearGoogleSession() {
        this._stopProfileWatch();
        this.currentUserProfile = null;
        localStorage.removeItem(this._sessionKey());
        localStorage.removeItem("davalos_current_user");
        localStorage.removeItem("davalos_google_user");
    },

    // Perfil persistido (para lecturas sincronas antes de que Firebase restaure la sesion).
    _getGoogleSession() {
        try {
            const g = JSON.parse(localStorage.getItem("davalos_google_user") || "null");
            const validRole = g && ["AGENT", "ADMIN", "SUPER_ADMIN"].includes(g.role);
            return g && g.email && validRole && g.status === "active" ? g : null;
        } catch (e) {
            return null;
        }
    },

    async loginWithGoogle() {
        if (!window.auth || !window.db || typeof firebase === "undefined") return { success: false, reason: "no_firebase" };
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({ prompt: "select_account" });
            const result = await window.auth.signInWithPopup(provider);
            const user = result.user;
            if (!user || !user.emailVerified) {
                const email = user && user.email;
                await window.auth.signOut().catch(() => {});
                this._clearGoogleSession();
                return { success: false, reason: "unauthorized", email };
            }

            const { profile, created } = await this._ensureUserProfile(user);
            if (profile.status === "active") {
                this._saveGoogleSession(user, profile);
                return { success: true, email: user.email, role: profile.role };
            }

            // pending / inactive: sin acceso. Se cierra la sesion de Firebase.
            if (created && profile.status === "pending") {
                this._sendPendingNotification({
                    email: user.email,
                    displayName: user.displayName || user.email,
                    photoURL: user.photoURL || "",
                    createdAt: new Date().toISOString()
                }, user);
            }

            await window.auth.signOut().catch(() => {});
            this._clearGoogleSession();
            return {
                success: false,
                reason: profile.status === "inactive" ? "inactive" : "pending",
                created,
                email: user.email
            };
        } catch (e) {
            if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") {
                return { success: false, reason: "cancelled" };
            }
            console.error("[Auth] Error en login con Google:", e);
            await window.auth.signOut().catch(() => {});
            this._clearGoogleSession();
            return { success: false, reason: e.code || "error", error: e.message };
        }
    },

    // Notifica en segundo plano a los Super Admins cuando un nuevo usuario solicita acceso.
    // Es completamente silencioso y tolerante a fallos para no interrumpir el flujo de login del usuario.
    async _sendPendingNotification(data, user) {
        try {
            let idToken = "";
            if (user && typeof user.getIdToken === "function") {
                idToken = await user.getIdToken().catch(() => "");
            }
            fetch("/api/notify-pending-request", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
                },
                body: JSON.stringify(data)
            }).then(async res => {
                if (!res.ok) {
                    const err = await res.text().catch(() => "");
                    console.warn("[Auth] /api/notify-pending-request respondió con error:", res.status, err);
                }
            }).catch(err => {
                console.warn("[Auth] No se pudo enviar notificación de solicitud pendiente:", err.message);
            });
        } catch (e) {
            console.warn("[Auth] Excepción al notificar solicitud pendiente:", e);
        }
    },

    // Mensaje para mostrar al usuario segun el resultado de loginWithGoogle (null = no mostrar nada).
    describeLoginFailure(res) {
        switch (res && res.reason) {
            case "cancelled":
                return null;
            case "pending":
                return res.created
                    ? "Tu solicitud de acceso fue enviada. El administrador revisará tu cuenta a la brevedad."
                    : "Tu solicitud de acceso sigue pendiente de aprobación. El administrador revisará tu cuenta a la brevedad.";
            case "inactive":
                return "Tu cuenta está suspendida. Contactá al administrador para reactivarla.";
            case "unauthorized":
                return "No se pudo verificar tu cuenta de Google. Usá una cuenta con el correo verificado.";
            case "permission-denied":
                return "No se pudo registrar tu solicitud por falta de permisos. Contactá al administrador.";
            default:
                return "No se pudo iniciar sesión con Google. Intentá nuevamente.";
        }
    },

    // ---- Gestion de equipo (solo SUPER_ADMIN) ----
    // Escucha en tiempo real la coleccion `users` (ignora documentos legados sin email).
    watchTeam(onData, onError) {
        if (!this.hasPermission(this.Permissions.MANAGE_USERS) || !window.db) return () => {};
        return window.db.collection("users").onSnapshot(
            snap => onData(snap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(u => u.email)),
            err => {
                console.error("[Auth] Error al escuchar usuarios:", err);
                if (onError) onError(err);
            }
        );
    },

    // Cambia rol y/o estado de un miembro. Rol: AGENT | ADMIN | SUPER_ADMIN. Estado: active | inactive.
    async setUserAccess(uid, { role, status }) {
        if (!this.hasPermission(this.Permissions.MANAGE_USERS)) return { success: false, reason: "permission" };
        if (window.auth && window.auth.currentUser && window.auth.currentUser.uid === uid) {
            return { success: false, reason: "self" };
        }
        const patch = { updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
        if (role !== undefined) {
            if (![this.Roles.AGENT, this.Roles.ADMIN, this.Roles.SUPER_ADMIN].includes(role)) return { success: false, reason: "invalid_role" };
            patch.role = role;
        }
        if (status !== undefined) {
            if (!["active", "inactive"].includes(status)) return { success: false, reason: "invalid_status" };
            patch.status = status;
        }
        try {
            await window.db.collection("users").doc(uid).update(patch);
            return { success: true };
        } catch (e) {
            console.error("[Auth] Error al actualizar usuario:", e);
            return { success: false, reason: "error", error: e.message || String(e) };
        }
    },

    // Elimina permanentemente un usuario de Firestore (solo SUPER_ADMIN)
    async deleteUser(uid) {
        if (!this.hasPermission(this.Permissions.MANAGE_USERS) || this.getUserRole() !== this.Roles.SUPER_ADMIN) {
            return { success: false, reason: "permission" };
        }
        if (window.auth && window.auth.currentUser && window.auth.currentUser.uid === uid) {
            return { success: false, reason: "self" };
        }
        if (!window.db) {
            return { success: false, reason: "error", error: "Firestore no está disponible." };
        }
        try {
            await window.db.collection("users").doc(uid).delete();
            return { success: true };
        } catch (e) {
            console.error("[Auth] Error al eliminar usuario:", e);
            return { success: false, reason: "error", error: e.message || String(e) };
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

        // Solo se aceptan sesiones iniciadas con Google (el login usuario/contrasena quedo deshabilitado).
        if (auth.provider !== "google") {
            this.logout();
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
        const live = this.currentUserProfile && this.currentUserProfile.status === "active" ? this.currentUserProfile : null;
        const google = live || this._getGoogleSession();
        if (google) {
            return { username: google.email, email: google.email, displayName: google.displayName, role: google.role, provider: "google" };
        }
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
        // Deshabilitado: el acceso admin es solo con Google (ver loginWithGoogle).
        console.warn("[Auth] El login con usuario/contrasena esta deshabilitado. Usar 'Continuar con Google'.");
        return false;
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
        this._stopProfileWatch();
        this.currentUserProfile = null;
        localStorage.removeItem(this._sessionKey());
        localStorage.removeItem("davalos_current_user");
        localStorage.removeItem("davalos_google_user");
        if (window.auth) {
            window.auth.signOut().catch(e => console.error("Firebase SignOut Error:", e));
        }
    },

    logoutAndClearSessionData() {
        this.logout();
        localStorage.removeItem("davalos_properties");
    },

    async changePassword(newPassword) {
        if (!this.isLoggedIn()) return { success: false, reason: "not_logged_in" };
        if (typeof newPassword !== "string" || newPassword.trim().length < 6) {
            return { success: false, reason: "invalid_password" };
        }

        const username = this.getCurrentUser();
        if (!username) return { success: false, reason: "no_user" };

        const normalized = this._normalizeUsername(username);
        const cleanPassword = newPassword.trim();

        // 1. Guardar en los overrides locales (para asegurar la sesión actual y compatibilidad)
        this._overrides[normalized] = cleanPassword;
        localStorage.setItem("davalos_user_overrides", JSON.stringify(this._overrides));

        // 2. Persistir en el almacenamiento real
        // ¿Es un usuario core (estático)?
        if (this._users.some(u => u.username === normalized)) {
            try {
                const coreEdits = JSON.parse(localStorage.getItem("davalos_core_user_edits") || "{}");
                coreEdits[normalized] = {
                    ...(coreEdits[normalized] || {}),
                    password: cleanPassword
                };
                localStorage.setItem("davalos_core_user_edits", JSON.stringify(coreEdits));

                // Guardar también en Firestore si está disponible para sincronización global
                if (window.db) {
                    const snapshot = await window.db.collection("users").where("username", "==", normalized).get();
                    const fullCoreUser = {
                        ...this._users.find(u => u.username === normalized),
                        ...coreEdits[normalized]
                    };
                    delete fullCoreUser.firebaseId;
                    if (!snapshot.empty) {
                        await snapshot.docs[0].ref.update({ password: cleanPassword });
                    } else {
                        await window.db.collection("users").add(fullCoreUser);
                    }
                    await this._loadUsersFromFirestore();
                    return { success: true, mode: "firestore" };
                }

                return { success: true, mode: "core" };
            } catch (err) {
                console.error("Error al guardar contraseña core localmente o en nube:", err);
                return { success: false, reason: "local_write_error", error: err.message };
            }
        }

        // ¿Es un usuario extra local (creado localmente cuando Firestore falla)?
        const extraUsers = JSON.parse(localStorage.getItem("davalos_extra_users") || "[]");
        const extraIndex = extraUsers.findIndex(u => this._normalizeUsername(u.username) === normalized);
        if (extraIndex !== -1) {
            try {
                extraUsers[extraIndex].password = cleanPassword;
                localStorage.setItem("davalos_extra_users", JSON.stringify(extraUsers));

                // Si Firestore ahora está disponible, guardarlo en la nube también
                if (window.db) {
                    const snapshot = await window.db.collection("users").where("username", "==", normalized).get();
                    if (!snapshot.empty) {
                        await snapshot.docs[0].ref.update({ password: cleanPassword });
                    } else {
                        await window.db.collection("users").add(extraUsers[extraIndex]);
                    }
                    // Y lo quitamos de extraUsers ya que ahora está en la nube
                    const filteredExtra = extraUsers.filter(u => this._normalizeUsername(u.username) !== normalized);
                    localStorage.setItem("davalos_extra_users", JSON.stringify(filteredExtra));
                    await this._loadUsersFromFirestore();
                    return { success: true, mode: "firestore" };
                }

                return { success: true, mode: "local" };
            } catch (err) {
                console.error("Error al actualizar contraseña en extraUsers:", err);
                return { success: false, reason: "local_write_error", error: err.message };
            }
        }

        // De lo contrario, es un usuario de Firestore (Nube)
        try {
            if (!window.db) {
                throw new Error("Firestore no está inicializado");
            }
            const snapshot = await window.db.collection("users").where("username", "==", normalized).get();
            if (!snapshot.empty) {
                const docRef = snapshot.docs[0].ref;
                await docRef.update({ password: cleanPassword });
                await this._loadUsersFromFirestore();
                return { success: true, mode: "firestore" };
            } else {
                throw new Error("El usuario no se encontró en Firestore");
            }
        } catch (e) {
            console.warn("Fallo al actualizar contraseña en Firestore, usando almacenamiento local como respaldo:", e);
            try {
                // Respaldar localmente en extraUsers
                const cachedUser = this._cachedUsers.find(u => this._normalizeUsername(u.username) === normalized);
                const baseUser = cachedUser || { username: normalized, createdAt: new Date().toISOString() };
                const mergedLocal = {
                    ...baseUser,
                    password: cleanPassword
                };
                const updatedExtra = extraUsers.filter(u => this._normalizeUsername(u.username) !== normalized);
                updatedExtra.push(mergedLocal);
                localStorage.setItem("davalos_extra_users", JSON.stringify(updatedExtra));
                return { success: true, mode: "local_fallback", error: e.message || String(e) };
            } catch (localErr) {
                console.error("Error crítico al actualizar localmente la contraseña:", localErr);
                return { success: false, reason: "fallback_error", error: localErr.message || String(localErr) };
            }
        }
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
        const allUsers = [...this._cachedUsers, ...filteredCore, ...extraUsers];
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

                // Guardar también en Firestore si está disponible para sincronización global
                if (window.db) {
                    const snapshot = await window.db.collection("users").where("username", "==", normalized).get();
                    const fullCoreUser = {
                        ...this._users.find(u => u.username === normalized),
                        ...coreEdits[normalized]
                    };
                    delete fullCoreUser.firebaseId;
                    if (!snapshot.empty) {
                        await snapshot.docs[0].ref.update(fullCoreUser);
                    } else {
                        await window.db.collection("users").add(fullCoreUser);
                    }
                    await this._loadUsersFromFirestore();
                    return { success: true, mode: "firestore" };
                }

                return { success: true, mode: "core" };
            } catch (err) {
                console.error("Error al actualizar usuario core localmente o en nube:", err);
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

                // Guardar también en Firestore si está disponible para sincronización global
                if (window.db) {
                    const snapshot = await window.db.collection("users").where("username", "==", normalized).get();
                    if (!snapshot.empty) {
                        await snapshot.docs[0].ref.update(extraUsers[extraIndex]);
                    } else {
                        await window.db.collection("users").add(extraUsers[extraIndex]);
                    }
                    const filteredExtra = extraUsers.filter(u => this._normalizeUsername(u.username) !== normalized);
                    localStorage.setItem("davalos_extra_users", JSON.stringify(filteredExtra));
                    await this._loadUsersFromFirestore();
                    return { success: true, mode: "firestore" };
                }

                return { success: true, mode: "local" };
            } catch (err) {
                console.error("Error al actualizar usuario local o en nube:", err);
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
