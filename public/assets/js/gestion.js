(() => {
    "use strict";

    // ==================== CONSTANTS ====================
    const COLLECTIONS = {
        clients: "crm_clients",
        properties: "crm_properties",
        contracts: "crm_contracts"
    };

    const FREQUENCY_MONTHS = {
        mensual: 1,
        bimestral: 2,
        trimestral: 3,
        cuatrimestral: 4,
        semestral: 6,
        anual: 12,
        sin_ajuste: 0
    };

    const FREQUENCY_LABELS = {
        mensual: "Mensual",
        bimestral: "Bimestral",
        trimestral: "Trimestral",
        cuatrimestral: "Cuatrimestral",
        semestral: "Semestral",
        anual: "Anual",
        sin_ajuste: "Sin ajuste"
    };

    const CLIENT_TYPE_LABELS = {
        propietario: "Propietario",
        inquilino: "Inquilino",
        ambos: "Prop. e Inq.",
        garante: "Garante"
    };

    const CLIENT_TYPE_BADGE = {
        propietario: "badge-primary",
        inquilino: "badge-info",
        ambos: "badge-success",
        garante: "badge-neutral"
    };

    const VIEW_META = {
        resumen: {
            title: "Resumen",
            subtitle: "Estado general de contratos, próximas actualizaciones y clientes"
        },
        contratos: {
            title: "Contratos",
            subtitle: "Administración de alquileres vigentes, ajustes y vencimientos"
        },
        propiedades: {
            title: "Propiedades",
            subtitle: "Ficha interna, propietarios, servicios e impuestos"
        },
        clientes: {
            title: "Clientes",
            subtitle: "Directorio interno de propietarios, inquilinos y garantes"
        }
    };

    // ==================== STATE ====================
    const state = {
        currentView: "resumen",
        clients: [],
        properties: [],
        contracts: [],
        isAuthorized: false,
        confirmCallback: null,
        nextUpdateManualOverride: false
    };

    // ==================== UTILITIES ====================
    function escapeHtml(value) {
        if (value === null || value === undefined) return "";
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function formatCurrency(amount, currency = "ARS") {
        const num = Number(amount);
        const formatted = Number.isFinite(num)
            ? num.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
            : "0";
        const symbol = currency === "USD" ? "U$D" : "AR$";
        return `${symbol} ${formatted}`;
    }

    function getTodayMidnight() {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    function parseIsoDate(isoStr) {
        if (!isoStr || typeof isoStr !== "string") return null;
        const parts = isoStr.trim().split("-");
        if (parts.length !== 3) return null;
        const y = Number(parts[0]);
        const m = Number(parts[1]);
        const d = Number(parts[2]);
        if (!y || !m || !d) return null;
        const dt = new Date(y, m - 1, d);
        if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
        return dt;
    }

    function toIsoDate(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    }

    function formatDateAR(isoStr) {
        const dt = parseIsoDate(isoStr);
        if (!dt) return "—";
        const d = String(dt.getDate()).padStart(2, "0");
        const m = String(dt.getMonth() + 1).padStart(2, "0");
        const y = dt.getFullYear();
        return `${d}/${m}/${y}`;
    }

    function diffDaysFromToday(isoStr) {
        const target = parseIsoDate(isoStr);
        if (!target) return null;
        const today = getTodayMidnight();
        const msPerDay = 24 * 60 * 60 * 1000;
        return Math.round((target.getTime() - today.getTime()) / msPerDay);
    }

    function addMonths(isoStr, months) {
        const dt = parseIsoDate(isoStr);
        if (!dt || !months) return "";
        const targetMonthIndex = dt.getMonth() + months;
        const targetYear = dt.getFullYear() + Math.floor(targetMonthIndex / 12);
        const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
        const lastDayOfTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
        const clampedDay = Math.min(dt.getDate(), lastDayOfTargetMonth);
        return toIsoDate(new Date(targetYear, normalizedMonth, clampedDay));
    }

    function computeSuggestedNextUpdate(startDateStr, frequency) {
        const step = FREQUENCY_MONTHS[frequency] || 0;
        if (!startDateStr || step <= 0) return "";
        let candidate = addMonths(startDateStr, step);
        if (!candidate) return "";

        const todayIso = toIsoDate(getTodayMidnight());
        let safety = 0;
        while (candidate < todayIso && safety < 240) {
            candidate = addMonths(candidate, step);
            safety += 1;
        }
        return candidate;
    }

    function normalizeArgPhone(rawPhone) {
        if (!rawPhone) return "";
        let phone = String(rawPhone).replace(/\D/g, "");
        if (!phone) return "";

        if (phone.startsWith("0")) {
            phone = phone.substring(1);
        }

        if (phone.startsWith("38715") && phone.length === 12) {
            phone = "387" + phone.substring(5);
        } else if (phone.length === 12 && phone.substring(2, 4) === "15") {
            phone = phone.substring(0, 2) + phone.substring(4);
        } else if (phone.length === 11 && phone.startsWith("15")) {
            phone = phone.substring(2);
        }

        if (phone.startsWith("549")) {
            return phone;
        }
        if (phone.startsWith("54")) {
            return "549" + phone.substring(2);
        }
        return "549" + phone;
    }

    function getClientById(id) {
        if (!id) return null;
        return state.clients.find((c) => c.id === id) || null;
    }

    function getPropertyById(id) {
        if (!id) return null;
        return state.properties.find((p) => p.id === id) || null;
    }

    function isContractActive(contract) {
        return contract && contract.status !== "finalizado";
    }

    function getContractEffectiveStatus(contract) {
        if (!contract) return "finalizado";
        if (contract.status === "finalizado") return "finalizado";
        const daysToEnd = diffDaysFromToday(contract.endDate);
        if (daysToEnd !== null && daysToEnd <= 60) {
            return "por_vencer";
        }
        return "activo";
    }

    function getPropertyEffectiveStatus(property) {
        const hasActiveContract = state.contracts.some(
            (c) => c.propertyId === property.id && isContractActive(c)
        );
        if (hasActiveContract) {
            return { status: "alquilada", viaContract: true };
        }
        return {
            status: property.status === "alquilada" ? "alquilada" : "disponible",
            viaContract: false
        };
    }

    function getInitials(name) {
        const clean = String(name || "SA").trim();
        if (!clean) return "SA";
        const parts = clean.split(/\s+/).filter(Boolean);
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    // ==================== TOASTS & BANNER ====================
    function showToast(message, type = "default") {
        const container = document.getElementById("toast-container");
        if (!container) return;

        const toast = document.createElement("div");
        toast.className = `toast ${type !== "default" ? `toast-${type}` : ""}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateY(8px)";
            toast.style.transition = "all 0.2s ease";
            setTimeout(() => toast.remove(), 220);
        }, 3200);
    }

    function showGlobalBanner(message) {
        const banner = document.getElementById("global-alert-banner");
        if (!banner) return;
        if (!message) {
            banner.classList.add("hidden");
            banner.textContent = "";
            return;
        }
        banner.textContent = message;
        banner.classList.remove("hidden");
    }

    async function copyText(text, triggerButton = null) {
        const value = String(text || "").trim();
        if (!value) {
            showToast("El campo está vacío para copiar.", "warning");
            return;
        }

        let ok = false;
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(value);
                ok = true;
            } catch (_err) {
                ok = false;
            }
        }

        if (!ok) {
            try {
                const temp = document.createElement("textarea");
                temp.value = value;
                temp.setAttribute("readonly", "");
                temp.style.position = "fixed";
                temp.style.opacity = "0";
                document.body.appendChild(temp);
                temp.select();
                ok = document.execCommand("copy");
                document.body.removeChild(temp);
            } catch (_err) {
                ok = false;
            }
        }

        if (ok) {
            showToast("Copiado al portapapeles.", "success");
            if (triggerButton) {
                const prevText = triggerButton.textContent;
                triggerButton.textContent = "¡Copiado!";
                triggerButton.classList.add("copied");
                setTimeout(() => {
                    triggerButton.textContent = prevText;
                    triggerButton.classList.remove("copied");
                }, 1400);
            }
        } else {
            showToast("No se pudo copiar automáticamente.", "error");
        }
    }

    // ==================== MODALS & CONFIRMATION ====================
    function focusAndHighlightField(fieldId) {
        if (!fieldId) return;
        setTimeout(() => {
            const el = document.getElementById(fieldId);
            if (!el) return;
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.focus();
            el.classList.add("field-highlight");
            setTimeout(() => el.classList.remove("field-highlight"), 1600);
        }, 60);
    }

    function openModal(modalId) {
        closeAllDropdowns();
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.add("open");
        document.body.style.overflow = "hidden";
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.remove("open");
        const anyOpen = document.querySelector(".modal.open");
        if (!anyOpen) {
            document.body.style.overflow = "";
        }
    }

    function openConfirmModal({ title, message, confirmText = "Confirmar", danger = true, onConfirm }) {
        const titleEl = document.getElementById("confirm-title");
        const msgEl = document.getElementById("confirm-message");
        const okBtn = document.getElementById("btn-confirm-ok");

        titleEl.textContent = title || "Confirmar acción";
        msgEl.textContent = message || "¿Deseás continuar?";
        okBtn.textContent = confirmText;
        okBtn.className = `btn ${danger ? "btn-danger" : "btn-primary"}`;
        state.confirmCallback = onConfirm;
        openModal("modal-confirm");
    }

    function setFormError(elementId, message) {
        const el = document.getElementById(elementId);
        if (!el) return;
        if (!message) {
            el.textContent = "";
            el.classList.add("hidden");
            return;
        }
        el.textContent = message;
        el.classList.remove("hidden");
    }

    // ==================== SECURITY / SUPER_ADMIN GATE ====================
    async function checkSuperAdminStatus() {
        if (window.AuthManager && window.AuthManager._readyPromise) {
            try {
                await window.AuthManager._readyPromise;
            } catch (err) {
                console.warn("[Gestion] AuthManager init warning:", err);
            }
        }

        const fbUser = window.auth ? window.auth.currentUser : null;
        const hasRealFirebaseUser = Boolean(fbUser && !fbUser.isAnonymous);

        if (window.AuthManager && window.AuthManager.isLoggedIn() && hasRealFirebaseUser) {
            const isSuper = typeof window.AuthManager.isSuperAdmin === "function"
                ? window.AuthManager.isSuperAdmin()
                : window.AuthManager.getUserRole() === window.AuthManager.Roles.SUPER_ADMIN;
            const role = window.AuthManager.getUserRole() || "SIN_ROL";
            const displayName = window.AuthManager.getDisplayName() || fbUser.displayName || fbUser.email || "Usuario";
            return {
                loggedIn: true,
                isSuperAdmin: Boolean(isSuper),
                role,
                displayName
            };
        }

        return {
            loggedIn: false,
            isSuperAdmin: false,
            role: null,
            displayName: null
        };
    }

    function renderRestrictedScreen(authStatus) {
        state.isAuthorized = false;
        state.clients = [];
        state.properties = [];
        state.contracts = [];

        document.getElementById("auth-checking-screen").classList.add("hidden");
        document.getElementById("app-shell").classList.add("hidden");
        document.getElementById("restricted-screen").classList.remove("hidden");

        const msgEl = document.getElementById("restricted-message");
        const userInfoEl = document.getElementById("restricted-user-info");
        const loginBox = document.getElementById("gestion-login-box");
        const logoutBtn = document.getElementById("btn-restricted-logout");

        setFormError("login-error-msg", "");

        if (authStatus.loggedIn) {
            msgEl.innerHTML =
                "Tu cuenta actual no cuenta con permisos de <strong>SUPER_ADMIN</strong> para acceder a la Gestión Inmobiliaria.";
            userInfoEl.innerHTML = `Sesión actual: <strong>${escapeHtml(authStatus.displayName)}</strong> · Rol: <strong>${escapeHtml(authStatus.role)}</strong>`;
            userInfoEl.classList.remove("hidden");
            loginBox.classList.add("hidden");
            logoutBtn.classList.remove("hidden");
        } else {
            msgEl.innerHTML =
                "Esta sección es exclusiva para usuarios autenticados con rol <strong>SUPER_ADMIN</strong>. Iniciá sesión con Google para continuar.";
            userInfoEl.classList.add("hidden");
            loginBox.classList.remove("hidden");
            logoutBtn.classList.add("hidden");
        }
    }

    async function unlockDashboard(authStatus) {
        const alreadyUnlocked = state.isAuthorized;
        state.isAuthorized = true;

        document.getElementById("current-user-name").textContent = authStatus.displayName || "Admin";
        document.getElementById("user-avatar-initials").textContent = getInitials(authStatus.displayName);
        const drawerNameEl = document.getElementById("drawer-user-name");
        if (drawerNameEl) drawerNameEl.textContent = authStatus.displayName || "Admin";

        document.getElementById("auth-checking-screen").classList.add("hidden");
        document.getElementById("restricted-screen").classList.add("hidden");
        document.getElementById("app-shell").classList.remove("hidden");

        if (!alreadyUnlocked) {
            await loadAllData();
        }
    }

    async function verifyAndBoot() {
        const authStatus = await checkSuperAdminStatus();
        if (!authStatus.isSuperAdmin) {
            renderRestrictedScreen(authStatus);
            return;
        }
        await unlockDashboard(authStatus);
    }

    // Reacciona en vivo si AuthManager detecta cambio de rol o expiración de sesión
    window.updateAuthUI = () => {
        verifyAndBoot();
    };

    // ==================== FIRESTORE DATA LAYER ====================
    function assertAuthorizedAndDb() {
        if (!state.isAuthorized) {
            throw new Error("Acceso no autorizado.");
        }
        if (!window.db) {
            throw new Error("Firestore no está inicializado.");
        }
    }

    function handleFirestoreError(err, actionLabel) {
        console.error(`[Gestion] Error al ${actionLabel}:`, err);
        const code = err && err.code ? err.code : "";
        if (code === "permission-denied") {
            const msg =
                "Permiso denegado por Firestore. Verificá que tu usuario de Firebase Auth tenga rol SUPER_ADMIN y las reglas publicadas.";
            showGlobalBanner(msg);
            showToast(msg, "error");
            return;
        }
        showToast(`Error al ${actionLabel}: ${err && err.message ? err.message : "intentá nuevamente."}`, "error");
    }

    async function loadAllData() {
        if (!state.isAuthorized) return;
        showGlobalBanner("");

        try {
            assertAuthorizedAndDb();
            const [clientsSnap, propertiesSnap, contractsSnap] = await Promise.all([
                window.db.collection(COLLECTIONS.clients).get(),
                window.db.collection(COLLECTIONS.properties).get(),
                window.db.collection(COLLECTIONS.contracts).get()
            ]);

            state.clients = clientsSnap.docs
                .map((doc) => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => String(a.fullName || "").localeCompare(String(b.fullName || ""), "es"));

            state.properties = propertiesSnap.docs
                .map((doc) => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => String(a.alias || a.address || "").localeCompare(String(b.alias || b.address || ""), "es"));

            state.contracts = contractsSnap.docs
                .map((doc) => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

            renderAll();
        } catch (err) {
            handleFirestoreError(err, "cargar los datos");
            renderAll();
        }
    }

    // ==================== NAVIGATION ====================
    function switchView(viewName) {
        if (!VIEW_META[viewName]) return;
        state.currentView = viewName;

        document.querySelectorAll(".view-section").forEach((sec) => {
            sec.classList.toggle("active", sec.id === `view-${viewName}`);
        });

        document.querySelectorAll(".nav-item, .mobile-tab").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.view === viewName);
        });

        document.getElementById("topbar-title").textContent = VIEW_META[viewName].title;
        document.getElementById("topbar-subtitle").textContent = VIEW_META[viewName].subtitle;
        closeAllDropdowns();
    }

    // ==================== RENDERING ====================
    function renderAll() {
        document.getElementById("nav-count-contratos").textContent = String(state.contracts.length);
        document.getElementById("nav-count-propiedades").textContent = String(state.properties.length);
        document.getElementById("nav-count-clientes").textContent = String(state.clients.length);

        renderResumen();
        renderContractsTable();
        renderPropertiesTable();
        renderClientsTable();
    }

    function buildDateUrgencyBadge(isoDate, mode = "update") {
        const diff = diffDaysFromToday(isoDate);
        if (diff === null) return "";
        if (diff < 0) {
            const absDays = Math.abs(diff);
            const label = mode === "update"
                ? `Atrasada ${absDays} ${absDays === 1 ? "día" : "días"}`
                : `Vencido hace ${absDays} d.`;
            return `<span class="badge badge-danger">${escapeHtml(label)}</span>`;
        }
        if (diff === 0) {
            return `<span class="badge badge-danger">${mode === "update" ? "Ajuste hoy" : "Vence hoy"}</span>`;
        }
        if (diff <= 30) {
            return `<span class="badge badge-warning">En ${diff} ${diff === 1 ? "día" : "días"}</span>`;
        }
        if (mode === "end" && diff <= 60) {
            return `<span class="badge badge-warning">En ${diff} días</span>`;
        }
        return `<span class="badge badge-neutral">En ${diff} días</span>`;
    }

    function renderResumen() {
        const activeContracts = state.contracts.filter(isContractActive);

        const updatesWithin30 = activeContracts.filter((c) => {
            if (c.updateFrequency === "sin_ajuste" || !c.nextUpdateDate) return false;
            const days = diffDaysFromToday(c.nextUpdateDate);
            return days !== null && days <= 30;
        });

        const overdueUpdates = updatesWithin30.filter((c) => {
            const days = diffDaysFromToday(c.nextUpdateDate);
            return days !== null && days < 0;
        });

        const expiringWithin60 = activeContracts.filter((c) => {
            const days = diffDaysFromToday(c.endDate);
            return days !== null && days <= 60;
        });

        const ownersCount = state.clients.filter((c) => c.type === "propietario" || c.type === "ambos").length;
        const tenantsCount = state.clients.filter((c) => c.type === "inquilino" || c.type === "ambos").length;

        document.getElementById("kpi-active-contracts").textContent = String(activeContracts.length);
        document.getElementById("kpi-active-contracts-sub").textContent =
            state.contracts.length > 0
                ? `De ${state.contracts.length} contratos registrados`
                : "Sin contratos cargados todavía";

        document.getElementById("kpi-updates-30").textContent = String(updatesWithin30.length);
        document.getElementById("kpi-updates-30-sub").textContent =
            overdueUpdates.length > 0
                ? `Incluye ${overdueUpdates.length} pendiente(s) de ajuste`
                : "Ajustes en los próximos 30 días";

        document.getElementById("kpi-expiring-60").textContent = String(expiringWithin60.length);
        document.getElementById("kpi-expiring-60-sub").textContent =
            expiringWithin60.length > 0
                ? "Revisar renovaciones o finalizaciones"
                : "Ningún vencimiento próximo";

        document.getElementById("kpi-total-clients").textContent = String(state.clients.length);
        document.getElementById("kpi-total-clients-sub").textContent =
            `${ownersCount} propietarios · ${tenantsCount} inquilinos`;

        // Upcoming updates list (active contracts with nextUpdateDate sorted ascending)
        const listEl = document.getElementById("upcoming-updates-list");
        const upcoming = activeContracts
            .filter((c) => c.updateFrequency !== "sin_ajuste" && c.nextUpdateDate)
            .sort((a, b) => String(a.nextUpdateDate).localeCompare(String(b.nextUpdateDate)));

        if (upcoming.length === 0) {
            listEl.innerHTML = `
                <div class="empty-state">
                    <h3>Sin actualizaciones programadas</h3>
                    <p>Cuando cargues contratos con frecuencia de ajuste, las próximas fechas aparecerán ordenadas aquí.</p>
                </div>
            `;
            return;
        }

        listEl.innerHTML = upcoming
            .slice(0, 12)
            .map((contract) => {
                const prop = getPropertyById(contract.propertyId);
                const tenant = getClientById(contract.tenantId);
                const propLabel = prop ? prop.alias || prop.address : "Propiedad eliminada";
                const propAddress = prop && prop.alias && prop.address ? prop.address : "";
                const tenantLabel = tenant ? tenant.fullName : "Inquilino sin asignar";
                const freqLabel = FREQUENCY_LABELS[contract.updateFrequency] || contract.updateFrequency || "—";
                const indexLabel = contract.updateIndex || "—";

                return `
                    <div class="update-item">
                        <div>
                            <div class="update-main-title">${escapeHtml(propLabel)}</div>
                            <div class="update-sub">
                                Inquilino: <strong>${escapeHtml(tenantLabel)}</strong>
                                ${propAddress ? ` · ${escapeHtml(propAddress)}` : ""}
                            </div>
                        </div>
                        <div>
                            <div class="update-amount">${escapeHtml(formatCurrency(contract.currentAmount, contract.currency))}</div>
                            <div class="update-sub">${escapeHtml(freqLabel)} · ${escapeHtml(indexLabel)}</div>
                        </div>
                        <div class="update-date-col">
                            <span class="cell-primary">${escapeHtml(formatDateAR(contract.nextUpdateDate))}</span>
                            ${buildDateUrgencyBadge(contract.nextUpdateDate, "update")}
                        </div>
                        <div>
                            <button type="button" class="btn btn-outline btn-sm" data-action="adjust-contract" data-id="${escapeHtml(contract.id)}">
                                Registrar ajuste
                            </button>
                        </div>
                    </div>
                `;
            })
            .join("");
    }

    function renderContractsTable() {
        const tbody = document.getElementById("contracts-tbody");
        const query = (document.getElementById("contracts-search").value || "").trim().toLowerCase();
        const statusFilter = document.getElementById("contracts-filter-status").value;
        const currencyFilter = document.getElementById("contracts-filter-currency").value;

        const filtered = state.contracts.filter((c) => {
            const effStatus = getContractEffectiveStatus(c);
            if (statusFilter !== "todos" && effStatus !== statusFilter) return false;
            if (currencyFilter !== "todas" && (c.currency || "ARS") !== currencyFilter) return false;

            if (query) {
                const prop = getPropertyById(c.propertyId);
                const tenant = getClientById(c.tenantId);
                const haystack = [
                    prop ? prop.alias : "",
                    prop ? prop.address : "",
                    tenant ? tenant.fullName : "",
                    c.updateIndex || "",
                    FREQUENCY_LABELS[c.updateFrequency] || "",
                    c.notes || ""
                ]
                    .join(" ")
                    .toLowerCase();
                if (!haystack.includes(query)) return false;
            }
            return true;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="cell-empty-row">
                        <div class="empty-state">
                            <h3>No hay contratos para mostrar</h3>
                            <p>${state.contracts.length === 0
                                ? "Creá el primer contrato para comenzar a controlar vencimientos y ajustes."
                                : "Probá limpiar los filtros o cambiar el texto de búsqueda."}</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered
            .map((c) => {
                const prop = getPropertyById(c.propertyId);
                const tenant = getClientById(c.tenantId);
                const effStatus = getContractEffectiveStatus(c);
                const statusBadge =
                    effStatus === "finalizado"
                        ? '<span class="badge badge-neutral">Finalizado</span>'
                        : effStatus === "por_vencer"
                            ? '<span class="badge badge-warning">Por vencer</span>'
                            : '<span class="badge badge-success">Activo</span>';

                const freqLabel = FREQUENCY_LABELS[c.updateFrequency] || c.updateFrequency || "—";
                const adjustmentHtml =
                    c.updateFrequency === "sin_ajuste"
                        ? `<span class="cell-primary">Sin ajuste</span>`
                        : `<span class="cell-primary">${escapeHtml(freqLabel)}</span>
                           <span class="cell-secondary">${escapeHtml(c.updateIndex || "—")}</span>`;

                const nextUpdateHtml =
                    effStatus === "finalizado"
                        ? `<span class="cell-secondary">Finalizado</span>`
                        : c.updateFrequency === "sin_ajuste" || !c.nextUpdateDate
                            ? `<span class="cell-secondary">No aplica</span>`
                            : `<span class="cell-primary">${escapeHtml(formatDateAR(c.nextUpdateDate))}</span>
                               <div class="cell-badges">${buildDateUrgencyBadge(c.nextUpdateDate, "update")}</div>`;

                const propTitle = prop ? prop.alias || prop.address : "Propiedad eliminada";
                const propSub = prop && prop.alias && prop.address ? prop.address : `Vence: ${formatDateAR(c.endDate)}`;
                const endLine = prop && prop.alias && prop.address ? ` · Vence ${formatDateAR(c.endDate)}` : "";

                return `
                    <tr>
                        <td data-label="Propiedad">
                            <div class="cell-stack">
                                <span class="cell-primary">${escapeHtml(propTitle)}</span>
                                <span class="cell-secondary">${escapeHtml(propSub)}${escapeHtml(endLine)}</span>
                            </div>
                        </td>
                        <td data-label="Inquilino">
                            <div class="cell-stack">
                                ${tenant
                                    ? `<span class="cell-primary">${escapeHtml(tenant.fullName)}</span>
                                       ${tenant.phone ? `<span class="cell-secondary">${escapeHtml(tenant.phone)}</span>` : ""}`
                                    : `<button type="button" class="btn-assign-mini" data-quick-edit="contract" data-id="${escapeHtml(c.id)}" data-focus="contract-tenant">+ Asignar</button>`}
                            </div>
                        </td>
                        <td data-label="Monto y Moneda">
                            <div class="cell-stack">
                                <span class="cell-primary">${escapeHtml(formatCurrency(c.currentAmount, c.currency))}</span>
                                <div class="cell-badges">
                                    ${statusBadge}
                                    <span class="badge badge-neutral">${escapeHtml(c.currency || "ARS")}</span>
                                </div>
                            </div>
                        </td>
                        <td data-label="Ajuste">
                            <div class="cell-stack">${adjustmentHtml}</div>
                        </td>
                        <td data-label="Próx. actualización">
                            <div class="cell-stack">${nextUpdateHtml}</div>
                        </td>
                        <td data-label="Acciones" class="col-actions">
                            <div class="action-menu-wrap">
                                <button type="button" class="btn-kebab" aria-label="Acciones del contrato" aria-expanded="false">⋮</button>
                                <div class="action-dropdown">
                                    <button type="button" data-action="edit-contract" data-id="${escapeHtml(c.id)}">Editar contrato</button>
                                    ${effStatus !== "finalizado"
                                        ? `<button type="button" data-action="adjust-contract" data-id="${escapeHtml(c.id)}">Registrar ajuste de monto</button>
                                           <button type="button" data-action="finalize-contract" data-id="${escapeHtml(c.id)}">Finalizar contrato</button>`
                                        : `<button type="button" data-action="reactivate-contract" data-id="${escapeHtml(c.id)}">Reactivar contrato</button>`}
                                    <button type="button" class="danger" data-action="delete-contract" data-id="${escapeHtml(c.id)}">Eliminar</button>
                                </div>
                            </div>
                        </td>
                    </tr>
                `;
            })
            .join("");
    }

    function renderPropertiesTable() {
        const tbody = document.getElementById("properties-tbody");
        const query = (document.getElementById("properties-search").value || "").trim().toLowerCase();
        const statusFilter = document.getElementById("properties-filter-status").value;

        const filtered = state.properties.filter((p) => {
            const eff = getPropertyEffectiveStatus(p);
            if (statusFilter !== "todos" && eff.status !== statusFilter) return false;

            if (query) {
                const owner = getClientById(p.ownerId);
                const haystack = [
                    p.alias || "",
                    p.address || "",
                    p.neighborhood || "",
                    p.catastro || "",
                    p.nis || "",
                    owner ? owner.fullName : ""
                ]
                    .join(" ")
                    .toLowerCase();
                if (!haystack.includes(query)) return false;
            }
            return true;
        });

        if (filtered.length === 0) {
            const emptyAction = state.properties.length === 0
                ? `<button type="button" class="btn btn-outline btn-sm" data-action="import-catalog">Importar propiedades del catálogo</button>`
                : "";
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="cell-empty-row">
                        <div class="empty-state">
                            <h3>No hay propiedades para mostrar</h3>
                            <p>${state.properties.length === 0
                                ? "Agregá propiedades manualmente o traé una copia de las que ya existen en tu catálogo."
                                : "No se encontraron propiedades con los filtros aplicados."}</p>
                            ${emptyAction}
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered
            .map((p) => {
                const owner = getClientById(p.ownerId);
                const eff = getPropertyEffectiveStatus(p);
                const statusBadge =
                    eff.status === "alquilada"
                        ? '<span class="badge badge-primary">Alquilada</span>'
                        : '<span class="badge badge-success">Disponible</span>';

                const ownerHtml = owner
                    ? `<span class="cell-primary">${escapeHtml(owner.fullName)}</span>`
                    : `<button type="button" class="btn-assign-mini" data-quick-edit="property" data-id="${escapeHtml(p.id)}" data-focus="property-owner">+ Asignar</button>`;

                const nisHtml = p.nis
                    ? `<div class="nis-inline">
                           <span class="cell-mono">${escapeHtml(p.nis)}</span>
                           <button type="button" class="btn-copy-mini" data-copy-value="${escapeHtml(p.nis)}" title="Copiar NIS">Copiar</button>
                       </div>`
                    : `<button type="button" class="btn-assign-mini" data-quick-edit="property" data-id="${escapeHtml(p.id)}" data-focus="property-nis">+ Cargar</button>`;

                return `
                    <tr class="row-clickable" data-open-property="${escapeHtml(p.id)}">
                        <td data-label="Dirección / Alias">
                            <div class="cell-stack">
                                <span class="cell-primary">${escapeHtml(p.alias || p.address || "Sin nombre")}</span>
                                <span class="cell-secondary">
                                    ${escapeHtml(p.address || "")}${p.neighborhood ? ` · ${escapeHtml(p.neighborhood)}` : ""}
                                </span>
                            </div>
                        </td>
                        <td data-label="Propietario">
                            <div class="cell-stack">
                                ${ownerHtml}
                                ${p.catastro ? `<span class="cell-secondary">Catastro: ${escapeHtml(p.catastro)}</span>` : ""}
                            </div>
                        </td>
                        <td data-label="NIS Luz">${nisHtml}</td>
                        <td data-label="Estado">
                            <div class="cell-stack">
                                ${statusBadge}
                                ${eff.viaContract ? '<span class="cell-secondary">Contrato activo</span>' : ""}
                            </div>
                        </td>
                        <td data-label="Acciones" class="col-actions">
                            <div class="action-menu-wrap">
                                <button type="button" class="btn-kebab" aria-label="Acciones de propiedad" aria-expanded="false">⋮</button>
                                <div class="action-dropdown">
                                    <button type="button" data-action="edit-property" data-id="${escapeHtml(p.id)}">Ver / Editar ficha</button>
                                    <button type="button" class="danger" data-action="delete-property" data-id="${escapeHtml(p.id)}">Eliminar</button>
                                </div>
                            </div>
                        </td>
                    </tr>
                `;
            })
            .join("");
    }

    function renderClientsTable() {
        const tbody = document.getElementById("clients-tbody");
        const query = (document.getElementById("clients-search").value || "").trim().toLowerCase();
        const typeFilter = document.getElementById("clients-filter-type").value;

        const filtered = state.clients.filter((c) => {
            if (typeFilter !== "todos") {
                if (typeFilter === "propietario" && c.type !== "propietario" && c.type !== "ambos") return false;
                if (typeFilter === "inquilino" && c.type !== "inquilino" && c.type !== "ambos") return false;
                if (typeFilter === "garante" && c.type !== "garante") return false;
            }

            if (query) {
                const haystack = [
                    c.fullName || "",
                    c.dni || "",
                    c.phone || "",
                    c.email || "",
                    c.address || "",
                    c.notes || ""
                ]
                    .join(" ")
                    .toLowerCase();
                if (!haystack.includes(query)) return false;
            }
            return true;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="cell-empty-row">
                        <div class="empty-state">
                            <h3>No hay clientes para mostrar</h3>
                            <p>${state.clients.length === 0
                                ? "Cargá propietarios, inquilinos y garantes para vincularlos a propiedades y contratos."
                                : "No se encontraron clientes con los filtros actuales."}</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered
            .map((c) => {
                const typeLabel = CLIENT_TYPE_LABELS[c.type] || c.type || "Cliente";
                const badgeCls = CLIENT_TYPE_BADGE[c.type] || "badge-neutral";
                const normalizedWa = normalizeArgPhone(c.phone);
                const dniHtml = c.dni
                    ? `<span class="cell-mono">${escapeHtml(c.dni)}</span>`
                    : `<button type="button" class="btn-assign-mini" data-quick-edit="client" data-id="${escapeHtml(c.id)}" data-focus="client-dni">+ Cargar</button>`;

                const whatsappHtml = normalizedWa
                    ? `<a href="https://wa.me/${escapeHtml(normalizedWa)}" target="_blank" rel="noopener noreferrer" class="wa-link" title="Abrir WhatsApp">
                           <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
                               <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.1.824zm-3.423-14.416c-6.627 0-12 5.373-12 12 0 2.625.846 5.059 2.284 7.033l-1.494 5.462 5.602-1.469c1.908 1.132 4.132 1.787 6.516 1.787 6.627 0 12-5.373 12-12s-5.373-12-12.908-12.813z"/>
                           </svg>
                           <span>${escapeHtml(c.phone)}</span>
                       </a>`
                    : `<button type="button" class="btn-assign-mini" data-quick-edit="client" data-id="${escapeHtml(c.id)}" data-focus="client-phone">+ Cargar</button>`;

                return `
                    <tr>
                        <td data-label="Nombre completo">
                            <div class="cell-stack">
                                <span class="cell-primary">${escapeHtml(c.fullName || "Sin nombre")}</span>
                                ${c.email ? `<span class="cell-secondary">${escapeHtml(c.email)}</span>` : ""}
                            </div>
                        </td>
                        <td data-label="Tipo">
                            <span class="badge ${escapeHtml(badgeCls)}">${escapeHtml(typeLabel)}</span>
                        </td>
                        <td data-label="DNI / CUIT">${dniHtml}</td>
                        <td data-label="WhatsApp">${whatsappHtml}</td>
                        <td data-label="Acciones" class="col-actions">
                            <div class="action-menu-wrap">
                                <button type="button" class="btn-kebab" aria-label="Acciones del cliente" aria-expanded="false">⋮</button>
                                <div class="action-dropdown">
                                    <button type="button" data-action="edit-client" data-id="${escapeHtml(c.id)}">Editar</button>
                                    <button type="button" class="danger" data-action="delete-client" data-id="${escapeHtml(c.id)}">Eliminar</button>
                                </div>
                            </div>
                        </td>
                    </tr>
                `;
            })
            .join("");
    }

    // ==================== SELECT POPULATION HELPERS ====================
    function populateClientSelect(selectEl, selectedId, preferredTypes, emptyLabel) {
        const preferred = state.clients.filter((c) => preferredTypes.includes(c.type));
        const others = state.clients.filter((c) => !preferredTypes.includes(c.type));

        let html = `<option value="">${escapeHtml(emptyLabel)}</option>`;

        if (preferred.length > 0) {
            html += `<optgroup label="Recomendados">`;
            preferred.forEach((c) => {
                const label = `${c.fullName}${c.dni ? ` (${c.dni})` : ""}`;
                const sel = c.id === selectedId ? "selected" : "";
                html += `<option value="${escapeHtml(c.id)}" ${sel}>${escapeHtml(label)}</option>`;
            });
            html += `</optgroup>`;
        }

        if (others.length > 0) {
            html += `<optgroup label="Otros clientes">`;
            others.forEach((c) => {
                const typeTag = CLIENT_TYPE_LABELS[c.type] || c.type || "";
                const label = `${c.fullName}${typeTag ? ` · ${typeTag}` : ""}`;
                const sel = c.id === selectedId ? "selected" : "";
                html += `<option value="${escapeHtml(c.id)}" ${sel}>${escapeHtml(label)}</option>`;
            });
            html += `</optgroup>`;
        }

        selectEl.innerHTML = html;
    }

    function populatePropertySelect(selectEl, selectedId) {
        let html = `<option value="">Seleccionar propiedad...</option>`;
        state.properties.forEach((p) => {
            const label = p.alias && p.address ? `${p.alias} — ${p.address}` : p.alias || p.address || "Propiedad";
            const sel = p.id === selectedId ? "selected" : "";
            html += `<option value="${escapeHtml(p.id)}" ${sel}>${escapeHtml(label)}</option>`;
        });
        selectEl.innerHTML = html;
    }

    // ==================== CLIENT MODAL & CRUD ====================
    function openClientModal(clientId = null) {
        const form = document.getElementById("form-client");
        form.reset();
        setFormError("client-form-error", "");
        document.getElementById("client-id").value = "";

        if (clientId) {
            const client = getClientById(clientId);
            if (!client) return;
            document.getElementById("modal-client-title").textContent = "Editar Cliente";
            document.getElementById("client-id").value = client.id;
            document.getElementById("client-name").value = client.fullName || "";
            document.getElementById("client-type").value = client.type || "propietario";
            document.getElementById("client-dni").value = client.dni || "";
            document.getElementById("client-phone").value = client.phone || "";
            document.getElementById("client-email").value = client.email || "";
            document.getElementById("client-address").value = client.address || "";
            document.getElementById("client-notes").value = client.notes || "";
        } else {
            document.getElementById("modal-client-title").textContent = "Nuevo Cliente";
        }

        openModal("modal-client");
        document.getElementById("client-name").focus();
    }

    async function handleSaveClient(event) {
        event.preventDefault();
        setFormError("client-form-error", "");

        const id = document.getElementById("client-id").value.trim();
        const fullName = document.getElementById("client-name").value.trim();
        const type = document.getElementById("client-type").value;
        const dni = document.getElementById("client-dni").value.trim();
        const phone = document.getElementById("client-phone").value.trim();
        const email = document.getElementById("client-email").value.trim();
        const address = document.getElementById("client-address").value.trim();
        const notes = document.getElementById("client-notes").value.trim();

        if (!fullName) {
            setFormError("client-form-error", "Ingresá el nombre y apellido del cliente.");
            return;
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setFormError("client-form-error", "El formato de email no es válido.");
            return;
        }

        const btn = document.getElementById("btn-save-client");
        btn.disabled = true;

        try {
            assertAuthorizedAndDb();
            const nowIso = new Date().toISOString();
            const payload = {
                fullName,
                type,
                dni,
                phone,
                email,
                address,
                notes,
                updatedAt: nowIso
            };

            if (id) {
                await window.db.collection(COLLECTIONS.clients).doc(id).update(payload);
                showToast("Cliente actualizado correctamente.", "success");
            } else {
                payload.createdAt = nowIso;
                payload.createdBy = window.AuthManager ? window.AuthManager.getCurrentUser() : "SUPER_ADMIN";
                await window.db.collection(COLLECTIONS.clients).add(payload);
                showToast("Cliente registrado correctamente.", "success");
            }

            closeModal("modal-client");
            await loadAllData();
        } catch (err) {
            handleFirestoreError(err, "guardar el cliente");
        } finally {
            btn.disabled = false;
        }
    }

    function requestDeleteClient(clientId) {
        const client = getClientById(clientId);
        if (!client) return;

        const linkedContracts = state.contracts.filter((c) => c.tenantId === clientId).length;
        const linkedProps = state.properties.filter((p) => p.ownerId === clientId).length;
        let extraWarning = "";
        if (linkedContracts > 0 || linkedProps > 0) {
            extraWarning = ` Atención: está vinculado a ${linkedProps} propiedad(es) y ${linkedContracts} contrato(s).`;
        }

        openConfirmModal({
            title: "Eliminar cliente",
            message: `¿Seguro que querés eliminar a "${client.fullName}"? Esta acción no se puede deshacer.${extraWarning}`,
            confirmText: "Sí, eliminar",
            danger: true,
            onConfirm: async () => {
                try {
                    assertAuthorizedAndDb();
                    await window.db.collection(COLLECTIONS.clients).doc(clientId).delete();
                    showToast("Cliente eliminado correctamente.", "success");
                    await loadAllData();
                } catch (err) {
                    handleFirestoreError(err, "eliminar el cliente");
                }
            }
        });
    }

    // ==================== PROPERTY MODAL & CRUD ====================
    function openPropertyModal(propertyId = null) {
        const form = document.getElementById("form-property");
        form.reset();
        setFormError("property-form-error", "");
        document.getElementById("property-id").value = "";

        const ownerSelect = document.getElementById("property-owner");
        const statusHint = document.getElementById("property-status-hint");

        if (propertyId) {
            const prop = getPropertyById(propertyId);
            if (!prop) return;
            document.getElementById("modal-property-title").textContent = "Ficha de Propiedad";
            document.getElementById("property-id").value = prop.id;
            document.getElementById("property-alias").value = prop.alias || "";
            document.getElementById("property-address").value = prop.address || "";
            document.getElementById("property-neighborhood").value = prop.neighborhood || "";
            populateClientSelect(ownerSelect, prop.ownerId || "", ["propietario", "ambos"], "Sin asignar");
            document.getElementById("property-catastro").value = prop.catastro || "";
            document.getElementById("property-status").value = prop.status || "disponible";
            document.getElementById("property-nis").value = prop.nis || "";
            document.getElementById("property-water").value = prop.waterAccount || "";
            document.getElementById("property-gas").value = prop.gasAccount || "";
            document.getElementById("property-municipal").value = prop.municipalAccount || "";
            document.getElementById("property-consorcio-name").value = prop.consorcioName || "";
            document.getElementById("property-consorcio-contact").value = prop.consorcioContact || "";
            document.getElementById("property-notes").value = prop.notes || "";

            const eff = getPropertyEffectiveStatus(prop);
            statusHint.textContent = eff.viaContract
                ? "Esta propiedad tiene un contrato activo asociado, por lo que figura como Alquilada."
                : "Si posee un contrato activo, se mostrará automáticamente como Alquilada.";
        } else {
            document.getElementById("modal-property-title").textContent = "Nueva Propiedad";
            populateClientSelect(ownerSelect, "", ["propietario", "ambos"], "Sin asignar");
            statusHint.textContent = "Si posee un contrato activo, se mostrará automáticamente como Alquilada.";
        }

        openModal("modal-property");
        document.getElementById("property-alias").focus();
    }

    async function handleSaveProperty(event) {
        event.preventDefault();
        setFormError("property-form-error", "");

        const id = document.getElementById("property-id").value.trim();
        const alias = document.getElementById("property-alias").value.trim();
        const address = document.getElementById("property-address").value.trim();
        const neighborhood = document.getElementById("property-neighborhood").value.trim();
        const ownerId = document.getElementById("property-owner").value;
        const catastro = document.getElementById("property-catastro").value.trim();
        const status = document.getElementById("property-status").value;
        const nis = document.getElementById("property-nis").value.trim();
        const waterAccount = document.getElementById("property-water").value.trim();
        const gasAccount = document.getElementById("property-gas").value.trim();
        const municipalAccount = document.getElementById("property-municipal").value.trim();
        const consorcioName = document.getElementById("property-consorcio-name").value.trim();
        const consorcioContact = document.getElementById("property-consorcio-contact").value.trim();
        const notes = document.getElementById("property-notes").value.trim();

        if (!alias) {
            setFormError("property-form-error", "Ingresá un alias o nombre interno para la propiedad.");
            return;
        }
        if (!address) {
            setFormError("property-form-error", "Ingresá la dirección real de la propiedad.");
            return;
        }

        const btn = document.getElementById("btn-save-property");
        btn.disabled = true;

        try {
            assertAuthorizedAndDb();
            const nowIso = new Date().toISOString();
            const payload = {
                alias,
                address,
                neighborhood,
                ownerId,
                catastro,
                status,
                nis,
                waterAccount,
                gasAccount,
                municipalAccount,
                consorcioName,
                consorcioContact,
                notes,
                updatedAt: nowIso
            };

            if (id) {
                await window.db.collection(COLLECTIONS.properties).doc(id).update(payload);
                showToast("Propiedad actualizada correctamente.", "success");
            } else {
                payload.createdAt = nowIso;
                payload.createdBy = window.AuthManager ? window.AuthManager.getCurrentUser() : "SUPER_ADMIN";
                await window.db.collection(COLLECTIONS.properties).add(payload);
                showToast("Propiedad registrada correctamente.", "success");
            }

            closeModal("modal-property");
            await loadAllData();
        } catch (err) {
            handleFirestoreError(err, "guardar la propiedad");
        } finally {
            btn.disabled = false;
        }
    }

    function requestDeleteProperty(propertyId) {
        const prop = getPropertyById(propertyId);
        if (!prop) return;

        const linkedContracts = state.contracts.filter((c) => c.propertyId === propertyId).length;
        const extraWarning =
            linkedContracts > 0
                ? ` Atención: tiene ${linkedContracts} contrato(s) asociado(s).`
                : "";

        openConfirmModal({
            title: "Eliminar propiedad",
            message: `¿Seguro que querés eliminar la ficha de "${prop.alias || prop.address}"? Esta acción no se puede deshacer.${extraWarning}`,
            confirmText: "Sí, eliminar",
            danger: true,
            onConfirm: async () => {
                try {
                    assertAuthorizedAndDb();
                    await window.db.collection(COLLECTIONS.properties).doc(propertyId).delete();
                    showToast("Propiedad eliminada correctamente.", "success");
                    await loadAllData();
                } catch (err) {
                    handleFirestoreError(err, "eliminar la propiedad");
                }
            }
        });
    }

    // ==================== IMPORT FROM CATALOG (READ-ONLY SOURCE) ====================
    async function requestImportFromCatalog() {
        const btn = document.getElementById("btn-import-catalog");
        if (btn) {
            btn.disabled = true;
            btn.textContent = "Buscando...";
        }

        try {
            assertAuthorizedAndDb();

            const [catalogSnap, deletedSnap] = await Promise.all([
                window.db.collection("properties").get(),
                window.db.collection("deleted_properties").get().catch(() => ({ docs: [] }))
            ]);

            const deletedIds = new Set(deletedSnap.docs.map((d) => String(d.id)));
            const alreadyImportedIds = new Set(
                state.properties.map((p) => String(p.catalogPropertyId || "")).filter(Boolean)
            );

            const candidates = catalogSnap.docs
                .filter((doc) => {
                    const data = doc.data() || {};
                    const numericId = data.id !== undefined && data.id !== null ? String(data.id) : "";
                    if (deletedIds.has(doc.id) || (numericId && deletedIds.has(numericId))) return false;
                    return !alreadyImportedIds.has(doc.id);
                })
                .map((doc) => ({ docId: doc.id, ...(doc.data() || {}) }));

            if (candidates.length === 0) {
                showToast("Todas las propiedades del catálogo ya están importadas en Gestión.", "default");
                return;
            }

            // Enriquecer con datos privados del propietario (solo lectura en properties/{id}/private/owner_info)
            const enriched = await Promise.all(
                candidates.map(async (item) => {
                    let ownerName = String(item.ownerName || "").trim();
                    let ownerPhone = String(item.ownerPhone || "").trim();
                    let ownerAddress = String(item.ownerAddress || "").trim();
                    try {
                        const privSnap = await window.db
                            .collection("properties")
                            .doc(item.docId)
                            .collection("private")
                            .doc("owner_info")
                            .get();
                        if (privSnap.exists) {
                            const priv = privSnap.data() || {};
                            if (priv.ownerName) ownerName = String(priv.ownerName).trim();
                            if (priv.ownerPhone) ownerPhone = String(priv.ownerPhone).trim();
                            if (priv.ownerAddress) ownerAddress = String(priv.ownerAddress).trim();
                        }
                    } catch (_) {
                        // Sin datos privados o sin acceso a esa subcolección
                    }
                    return {
                        ...item,
                        _ownerName: ownerName,
                        _ownerPhone: ownerPhone,
                        _ownerAddress: ownerAddress
                    };
                })
            );

            const uniqueOwnerNames = new Set(
                enriched.map((x) => x._ownerName.toLowerCase()).filter(Boolean)
            );
            const ownerMsg = uniqueOwnerNames.size > 0
                ? ` y ${uniqueOwnerNames.size} propietario(s) con datos cargados`
                : "";

            openConfirmModal({
                title: "Importar propiedades del catálogo",
                message: `Se encontraron ${enriched.length} propiedad(es) en tu base de datos${ownerMsg} que todavía no están en Gestión. ¿Querés traer una copia para trabajar acá? Esto NO modifica ni borra nada del catálogo público.`,
                confirmText: `Sí, importar (${enriched.length})`,
                danger: false,
                onConfirm: async () => {
                    await executeCatalogImport(enriched);
                }
            });
        } catch (err) {
            handleFirestoreError(err, "leer las propiedades del catálogo");
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = "Importar del catálogo";
            }
        }
    }

    async function executeCatalogImport(items) {
        try {
            assertAuthorizedAndDb();
            const nowIso = new Date().toISOString();
            const currentUser = window.AuthManager ? window.AuthManager.getCurrentUser() : "SUPER_ADMIN";

            // Mapa de clientes existentes por nombre normalizado para evitar duplicados
            const ownerIdByName = new Map();
            state.clients.forEach((c) => {
                const key = String(c.fullName || "").trim().toLowerCase();
                if (key) ownerIdByName.set(key, c.id);
            });

            let createdOwnersCount = 0;
            const pendingOps = [];

            for (const item of items) {
                let ownerId = "";
                const ownerName = String(item._ownerName || "").trim();
                if (ownerName) {
                    const key = ownerName.toLowerCase();
                    if (ownerIdByName.has(key)) {
                        ownerId = ownerIdByName.get(key);
                    } else {
                        const newClientRef = window.db.collection(COLLECTIONS.clients).doc();
                        ownerId = newClientRef.id;
                        ownerIdByName.set(key, ownerId);
                        createdOwnersCount += 1;
                        pendingOps.push({
                            ref: newClientRef,
                            data: {
                                fullName: ownerName,
                                type: "propietario",
                                dni: "",
                                phone: String(item._ownerPhone || "").trim(),
                                email: "",
                                address: String(item._ownerAddress || "").trim(),
                                notes: "Importado automáticamente desde el catálogo.",
                                createdAt: nowIso,
                                updatedAt: nowIso,
                                createdBy: currentUser
                            }
                        });
                    }
                }

                const title = String(item.title || "").trim() || "Propiedad sin título";
                const address = String(item._ownerAddress || item.address || "").trim() || title;
                const neighborhood = String(item.barrio || item.zone || item.neighborhood || "").trim();
                const isUnavailableRental =
                    String(item.category || "").toLowerCase() === "alquiler" &&
                    (item.status === "no_disponible" || item.available === false || item.disponible === false);

                const notesParts = ["Importada del catálogo"];
                if (item.category) notesParts.push(String(item.category).toUpperCase());
                if (item.price) notesParts.push(formatCurrency(item.price, item.currency || "USD"));
                if (item.agent) notesParts.push(`Asesor: ${item.agent}`);

                const expensasNote = item.expensasAmount
                    ? `Expensas aprox.: ${formatCurrency(item.expensasAmount, item.expensasCurrency || "ARS")}`
                    : "";

                const newPropRef = window.db.collection(COLLECTIONS.properties).doc();
                pendingOps.push({
                    ref: newPropRef,
                    data: {
                        catalogPropertyId: item.docId,
                        alias: title,
                        address,
                        neighborhood,
                        ownerId,
                        catastro: "",
                        status: isUnavailableRental ? "alquilada" : "disponible",
                        nis: "",
                        waterAccount: "",
                        gasAccount: "",
                        municipalAccount: "",
                        consorcioName: "",
                        consorcioContact: expensasNote,
                        notes: notesParts.join(" · "),
                        createdAt: nowIso,
                        updatedAt: nowIso,
                        createdBy: currentUser
                    }
                });
            }

            // Ejecutar en lotes de hasta 400 escrituras (límite Firestore: 500)
            const chunkSize = 400;
            for (let i = 0; i < pendingOps.length; i += chunkSize) {
                const batch = window.db.batch();
                pendingOps.slice(i, i + chunkSize).forEach((op) => batch.set(op.ref, op.data));
                await batch.commit();
            }

            const ownersText = createdOwnersCount > 0 ? ` y ${createdOwnersCount} propietario(s)` : "";
            showToast(`¡Listo! Se importaron ${items.length} propiedad(es)${ownersText}.`, "success");
            await loadAllData();
        } catch (err) {
            handleFirestoreError(err, "importar las propiedades del catálogo");
        }
    }

    // ==================== CONTRACT MODAL & CRUD ====================
    function syncNextUpdateInputState(forceRecalculate = false) {
        const startDate = document.getElementById("contract-start-date").value;
        const frequency = document.getElementById("contract-frequency").value;
        const nextUpdateInput = document.getElementById("contract-next-update");
        const indexSelect = document.getElementById("contract-index");
        const hintEl = document.getElementById("contract-next-update-hint");

        if (frequency === "sin_ajuste") {
            nextUpdateInput.value = "";
            nextUpdateInput.disabled = true;
            indexSelect.disabled = true;
            hintEl.textContent = "Este contrato no tiene ajustes periódicos.";
            return;
        }

        nextUpdateInput.disabled = false;
        indexSelect.disabled = false;
        hintEl.textContent = "Sugerida automáticamente según inicio y frecuencia (editable manualmente).";

        if (forceRecalculate || !state.nextUpdateManualOverride) {
            const suggested = computeSuggestedNextUpdate(startDate, frequency);
            if (suggested) {
                nextUpdateInput.value = suggested;
            }
        }
    }

    function openContractModal(contractId = null) {
        const form = document.getElementById("form-contract");
        form.reset();
        setFormError("contract-form-error", "");
        document.getElementById("contract-id").value = "";

        const propertySelect = document.getElementById("contract-property");
        const tenantSelect = document.getElementById("contract-tenant");

        if (contractId) {
            const c = state.contracts.find((item) => item.id === contractId);
            if (!c) return;
            state.nextUpdateManualOverride = true;

            document.getElementById("modal-contract-title").textContent = "Editar Contrato";
            document.getElementById("contract-id").value = c.id;
            populatePropertySelect(propertySelect, c.propertyId || "");
            populateClientSelect(tenantSelect, c.tenantId || "", ["inquilino", "ambos"], "Seleccionar inquilino...");

            document.getElementById("contract-start-date").value = c.startDate || "";
            document.getElementById("contract-end-date").value = c.endDate || "";
            document.getElementById("contract-amount").value = c.currentAmount ?? "";
            document.getElementById("contract-currency").value = c.currency || "ARS";
            document.getElementById("contract-frequency").value = c.updateFrequency || "trimestral";
            document.getElementById("contract-index").value = c.updateIndex || "ICL";
            document.getElementById("contract-next-update").value = c.nextUpdateDate || "";
            document.getElementById("contract-status").value = c.status || "activo";
            document.getElementById("contract-notes").value = c.notes || "";

            syncNextUpdateInputState(false);
        } else {
            state.nextUpdateManualOverride = false;
            document.getElementById("modal-contract-title").textContent = "Nuevo Contrato";
            populatePropertySelect(propertySelect, "");
            populateClientSelect(tenantSelect, "", ["inquilino", "ambos"], "Seleccionar inquilino...");

            const todayIso = toIsoDate(getTodayMidnight());
            document.getElementById("contract-start-date").value = todayIso;
            document.getElementById("contract-end-date").value = addMonths(todayIso, 24);
            document.getElementById("contract-currency").value = "ARS";
            document.getElementById("contract-frequency").value = "trimestral";
            document.getElementById("contract-index").value = "ICL";
            document.getElementById("contract-status").value = "activo";

            syncNextUpdateInputState(true);
        }

        openModal("modal-contract");
    }

    async function handleSaveContract(event) {
        event.preventDefault();
        setFormError("contract-form-error", "");

        const id = document.getElementById("contract-id").value.trim();
        const propertyId = document.getElementById("contract-property").value;
        const tenantId = document.getElementById("contract-tenant").value;
        const startDate = document.getElementById("contract-start-date").value;
        const endDate = document.getElementById("contract-end-date").value;
        const currentAmount = Number(document.getElementById("contract-amount").value);
        const currency = document.getElementById("contract-currency").value;
        const updateFrequency = document.getElementById("contract-frequency").value;
        const updateIndex = updateFrequency === "sin_ajuste" ? "Sin ajuste" : document.getElementById("contract-index").value;
        const nextUpdateDate = updateFrequency === "sin_ajuste" ? "" : document.getElementById("contract-next-update").value;
        const status = document.getElementById("contract-status").value;
        const notes = document.getElementById("contract-notes").value.trim();

        if (!propertyId) {
            setFormError("contract-form-error", "Seleccioná una propiedad (cargala primero en la pestaña Propiedades si aún no existe).");
            return;
        }
        if (!tenantId) {
            setFormError("contract-form-error", "Seleccioná un inquilino (cargalo primero en la pestaña Clientes si aún no existe).");
            return;
        }
        if (!startDate || !endDate) {
            setFormError("contract-form-error", "Completá la fecha de inicio y la fecha de vencimiento.");
            return;
        }
        if (endDate < startDate) {
            setFormError("contract-form-error", "La fecha de vencimiento no puede ser anterior a la fecha de inicio.");
            return;
        }
        if (!Number.isFinite(currentAmount) || currentAmount <= 0) {
            setFormError("contract-form-error", "Ingresá un monto de alquiler válido mayor a 0.");
            return;
        }
        if (updateFrequency !== "sin_ajuste" && !nextUpdateDate) {
            setFormError("contract-form-error", "Indicá la próxima fecha de actualización o elegí 'Sin ajuste'.");
            return;
        }

        const btn = document.getElementById("btn-save-contract");
        btn.disabled = true;

        try {
            assertAuthorizedAndDb();
            const nowIso = new Date().toISOString();
            const payload = {
                propertyId,
                tenantId,
                startDate,
                endDate,
                currentAmount,
                currency,
                updateFrequency,
                updateIndex,
                nextUpdateDate,
                status,
                notes,
                updatedAt: nowIso
            };

            if (id) {
                await window.db.collection(COLLECTIONS.contracts).doc(id).update(payload);
                showToast("Contrato actualizado correctamente.", "success");
            } else {
                payload.createdAt = nowIso;
                payload.createdBy = window.AuthManager ? window.AuthManager.getCurrentUser() : "SUPER_ADMIN";
                payload.adjustmentsHistory = [];
                await window.db.collection(COLLECTIONS.contracts).add(payload);
                showToast("Contrato creado correctamente.", "success");
            }

            closeModal("modal-contract");
            await loadAllData();
        } catch (err) {
            handleFirestoreError(err, "guardar el contrato");
        } finally {
            btn.disabled = false;
        }
    }

    // ==================== ADJUSTMENT MODAL ====================
    function openAdjustmentModal(contractId) {
        const contract = state.contracts.find((c) => c.id === contractId);
        if (!contract) return;

        const prop = getPropertyById(contract.propertyId);
        const tenant = getClientById(contract.tenantId);

        document.getElementById("form-adjustment").reset();
        setFormError("adjustment-form-error", "");
        document.getElementById("adjustment-contract-id").value = contract.id;
        document.getElementById("adjustment-new-amount").value = contract.currentAmount || "";

        const stepMonths = FREQUENCY_MONTHS[contract.updateFrequency] || 0;
        const baseDate = contract.nextUpdateDate || toIsoDate(getTodayMidnight());
        const suggestedNext = stepMonths > 0 ? addMonths(baseDate, stepMonths) : "";
        document.getElementById("adjustment-next-date").value = suggestedNext;

        const summaryEl = document.getElementById("adjustment-contract-summary");
        summaryEl.innerHTML = `
            <div><strong>${escapeHtml(prop ? prop.alias || prop.address : "Propiedad")}</strong></div>
            <div>Inquilino: ${escapeHtml(tenant ? tenant.fullName : "Sin asignar")}</div>
            <div>Monto actual: <strong>${escapeHtml(formatCurrency(contract.currentAmount, contract.currency))}</strong> · ${escapeHtml(FREQUENCY_LABELS[contract.updateFrequency] || "—")} (${escapeHtml(contract.updateIndex || "—")})</div>
        `;

        openModal("modal-adjustment");
        document.getElementById("adjustment-new-amount").focus();
    }

    async function handleSaveAdjustment(event) {
        event.preventDefault();
        setFormError("adjustment-form-error", "");

        const contractId = document.getElementById("adjustment-contract-id").value;
        const contract = state.contracts.find((c) => c.id === contractId);
        if (!contract) return;

        const newAmount = Number(document.getElementById("adjustment-new-amount").value);
        const newNextDate = document.getElementById("adjustment-next-date").value;
        const note = document.getElementById("adjustment-note").value.trim();

        if (!Number.isFinite(newAmount) || newAmount <= 0) {
            setFormError("adjustment-form-error", "Ingresá un nuevo monto válido mayor a 0.");
            return;
        }

        const btn = document.getElementById("btn-save-adjustment");
        btn.disabled = true;

        try {
            assertAuthorizedAndDb();
            const nowIso = new Date().toISOString();
            const prevHistory = Array.isArray(contract.adjustmentsHistory) ? contract.adjustmentsHistory : [];
            const updatedHistory = [
                ...prevHistory,
                {
                    date: toIsoDate(getTodayMidnight()),
                    previousAmount: Number(contract.currentAmount) || 0,
                    newAmount,
                    currency: contract.currency || "ARS",
                    index: contract.updateIndex || "",
                    note,
                    recordedAt: nowIso,
                    recordedBy: window.AuthManager ? window.AuthManager.getCurrentUser() : "SUPER_ADMIN"
                }
            ];

            await window.db.collection(COLLECTIONS.contracts).doc(contractId).update({
                currentAmount: newAmount,
                nextUpdateDate: contract.updateFrequency === "sin_ajuste" ? "" : newNextDate,
                adjustmentsHistory: updatedHistory,
                updatedAt: nowIso
            });

            showToast("Ajuste de monto registrado correctamente.", "success");
            closeModal("modal-adjustment");
            await loadAllData();
        } catch (err) {
            handleFirestoreError(err, "registrar el ajuste");
        } finally {
            btn.disabled = false;
        }
    }

    function requestFinalizeContract(contractId) {
        const contract = state.contracts.find((c) => c.id === contractId);
        if (!contract) return;
        const prop = getPropertyById(contract.propertyId);

        openConfirmModal({
            title: "Finalizar contrato",
            message: `¿Confirmás marcar como FINALIZADO el contrato de "${prop ? prop.alias || prop.address : "esta propiedad"}"? Dejará de contar como activo y ya no aparecerá en próximas actualizaciones.`,
            confirmText: "Sí, finalizar",
            danger: false,
            onConfirm: async () => {
                try {
                    assertAuthorizedAndDb();
                    await window.db.collection(COLLECTIONS.contracts).doc(contractId).update({
                        status: "finalizado",
                        updatedAt: new Date().toISOString()
                    });
                    showToast("Contrato marcado como finalizado.", "success");
                    await loadAllData();
                } catch (err) {
                    handleFirestoreError(err, "finalizar el contrato");
                }
            }
        });
    }

    function requestReactivateContract(contractId) {
        openConfirmModal({
            title: "Reactivar contrato",
            message: "¿Querés volver a marcar este contrato como ACTIVO?",
            confirmText: "Sí, reactivar",
            danger: false,
            onConfirm: async () => {
                try {
                    assertAuthorizedAndDb();
                    await window.db.collection(COLLECTIONS.contracts).doc(contractId).update({
                        status: "activo",
                        updatedAt: new Date().toISOString()
                    });
                    showToast("Contrato reactivado.", "success");
                    await loadAllData();
                } catch (err) {
                    handleFirestoreError(err, "reactivar el contrato");
                }
            }
        });
    }

    function requestDeleteContract(contractId) {
        const contract = state.contracts.find((c) => c.id === contractId);
        if (!contract) return;
        const prop = getPropertyById(contract.propertyId);

        openConfirmModal({
            title: "Eliminar contrato",
            message: `¿Seguro que querés eliminar definitivamente el contrato de "${prop ? prop.alias || prop.address : "esta propiedad"}"? Esta acción no se puede deshacer.`,
            confirmText: "Sí, eliminar",
            danger: true,
            onConfirm: async () => {
                try {
                    assertAuthorizedAndDb();
                    await window.db.collection(COLLECTIONS.contracts).doc(contractId).delete();
                    showToast("Contrato eliminado correctamente.", "success");
                    await loadAllData();
                } catch (err) {
                    handleFirestoreError(err, "eliminar el contrato");
                }
            }
        });
    }

    // ==================== DROPDOWN HANDLING ====================
    function closeAllDropdowns() {
        document.querySelectorAll(".action-dropdown.show").forEach((dd) => {
            dd.classList.remove("show", "open-up");
        });
        document.querySelectorAll(".btn-kebab.active").forEach((btn) => {
            btn.classList.remove("active");
            btn.setAttribute("aria-expanded", "false");
        });
    }

    function toggleDropdown(kebabBtn) {
        const wrap = kebabBtn.closest(".action-menu-wrap");
        if (!wrap) return;
        const dropdown = wrap.querySelector(".action-dropdown");
        if (!dropdown) return;

        const alreadyOpen = dropdown.classList.contains("show");
        closeAllDropdowns();
        if (alreadyOpen) return;

        dropdown.classList.add("show");
        kebabBtn.classList.add("active");
        kebabBtn.setAttribute("aria-expanded", "true");

        // Flip upwards if close to viewport bottom
        const rect = dropdown.getBoundingClientRect();
        if (rect.bottom > window.innerHeight - 16) {
            dropdown.classList.add("open-up");
        }
    }

    // ==================== EVENT WIRING ====================
    function bindEvents() {
        // Navigation tabs (sidebar + mobile)
        document.querySelectorAll(".nav-item, .mobile-tab").forEach((btn) => {
            btn.addEventListener("click", () => switchView(btn.dataset.view));
        });

        // Admin drawer (matching home page top-right menu)
        const adminDrawer = document.getElementById("admin-drawer");
        const adminDrawerOverlay = document.getElementById("admin-drawer-overlay");
        const openAdminDrawer = () => {
            if (adminDrawer) adminDrawer.classList.add("active");
            if (adminDrawerOverlay) adminDrawerOverlay.classList.add("active");
            document.body.style.overflow = "hidden";
        };
        const closeAdminDrawer = () => {
            if (adminDrawer) adminDrawer.classList.remove("active");
            if (adminDrawerOverlay) adminDrawerOverlay.classList.remove("active");
            if (!document.querySelector(".modal.open")) {
                document.body.style.overflow = "";
            }
        };

        const btnOpenDrawer = document.getElementById("btn-open-admin-drawer");
        if (btnOpenDrawer) btnOpenDrawer.addEventListener("click", openAdminDrawer);
        const btnCloseDrawer = document.getElementById("btn-close-admin-drawer");
        if (btnCloseDrawer) btnCloseDrawer.addEventListener("click", closeAdminDrawer);
        if (adminDrawerOverlay) adminDrawerOverlay.addEventListener("click", closeAdminDrawer);
        const btnStayGestion = document.getElementById("btn-drawer-stay-gestion");
        if (btnStayGestion) btnStayGestion.addEventListener("click", closeAdminDrawer);

        // KPI clickable shortcuts
        document.querySelectorAll(".kpi-clickable").forEach((card) => {
            card.addEventListener("click", () => {
                const targetView = card.dataset.jumpView;
                const jumpFilter = card.dataset.jumpFilter;
                if (targetView) {
                    if (jumpFilter && targetView === "contratos") {
                        document.getElementById("contracts-filter-status").value = jumpFilter;
                        renderContractsTable();
                    }
                    switchView(targetView);
                }
            });
        });

        // Google login button on restricted screen
        const googleLoginBtn = document.getElementById("btn-google-login");
        if (googleLoginBtn) {
            googleLoginBtn.addEventListener("click", async () => {
                setFormError("login-error-msg", "");
                if (!window.AuthManager || typeof window.AuthManager.loginWithGoogle !== "function") {
                    setFormError("login-error-msg", "No se pudo inicializar el acceso con Google.");
                    return;
                }

                googleLoginBtn.disabled = true;
                try {
                    const res = await window.AuthManager.loginWithGoogle();
                    if (!res || !res.success) {
                        const msg = typeof window.AuthManager.describeLoginFailure === "function"
                            ? window.AuthManager.describeLoginFailure(res)
                            : "No se pudo iniciar sesión con Google.";
                        if (msg) {
                            setFormError("login-error-msg", msg);
                        }
                        return;
                    }
                    await verifyAndBoot();
                } catch (err) {
                    console.error("[Gestion] Google login error:", err);
                    setFormError("login-error-msg", "Ocurrió un error al iniciar sesión con Google.");
                } finally {
                    googleLoginBtn.disabled = false;
                }
            });
        }

        // Logout buttons
        const doLogout = async () => {
            if (window.AuthManager) {
                window.AuthManager.logout();
            }
            state.isAuthorized = false;
            await verifyAndBoot();
            showToast("Sesión cerrada.", "default");
        };

        document.getElementById("btn-logout").addEventListener("click", doLogout);
        const btnDrawerLogout = document.getElementById("btn-drawer-logout");
        if (btnDrawerLogout) {
            btnDrawerLogout.addEventListener("click", async () => {
                closeAdminDrawer();
                await doLogout();
            });
        }
        document.getElementById("btn-restricted-logout").addEventListener("click", doLogout);

        // Refresh button
        document.getElementById("btn-refresh-data").addEventListener("click", async () => {
            await loadAllData();
            showToast("Datos actualizados.", "success");
        });

        // Create & import buttons
        document.getElementById("btn-new-contract").addEventListener("click", () => openContractModal());
        document.getElementById("btn-quick-new-contract").addEventListener("click", () => openContractModal());
        document.getElementById("btn-new-property").addEventListener("click", () => openPropertyModal());
        document.getElementById("btn-import-catalog").addEventListener("click", requestImportFromCatalog);
        document.getElementById("btn-new-client").addEventListener("click", () => openClientModal());

        // Search & Filter listeners
        document.getElementById("contracts-search").addEventListener("input", renderContractsTable);
        document.getElementById("contracts-filter-status").addEventListener("change", renderContractsTable);
        document.getElementById("contracts-filter-currency").addEventListener("change", renderContractsTable);

        document.getElementById("properties-search").addEventListener("input", renderPropertiesTable);
        document.getElementById("properties-filter-status").addEventListener("change", renderPropertiesTable);

        document.getElementById("clients-search").addEventListener("input", renderClientsTable);
        document.getElementById("clients-filter-type").addEventListener("change", renderClientsTable);

        // Contract auto-calculation listeners
        document.getElementById("contract-start-date").addEventListener("change", () => syncNextUpdateInputState(false));
        document.getElementById("contract-frequency").addEventListener("change", () => syncNextUpdateInputState(false));
        document.getElementById("contract-next-update").addEventListener("input", () => {
            state.nextUpdateManualOverride = true;
        });
        document.getElementById("btn-recalc-next-update").addEventListener("click", () => {
            state.nextUpdateManualOverride = false;
            syncNextUpdateInputState(true);
            showToast("Próxima fecha recalculada.", "default");
        });

        // Form submissions
        document.getElementById("form-client").addEventListener("submit", handleSaveClient);
        document.getElementById("form-property").addEventListener("submit", handleSaveProperty);
        document.getElementById("form-contract").addEventListener("submit", handleSaveContract);
        document.getElementById("form-adjustment").addEventListener("submit", handleSaveAdjustment);

        // Confirm modal action
        document.getElementById("btn-confirm-ok").addEventListener("click", async () => {
            const cb = state.confirmCallback;
            state.confirmCallback = null;
            closeModal("modal-confirm");
            if (typeof cb === "function") {
                await cb();
            }
        });

        // Close modal buttons & backdrop click
        document.querySelectorAll("[data-close-modal]").forEach((btn) => {
            btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
        });

        document.querySelectorAll(".modal").forEach((modal) => {
            modal.addEventListener("click", (e) => {
                if (e.target === modal) {
                    closeModal(modal.id);
                }
            });
        });

        // Copy buttons inside Property modal
        document.querySelectorAll(".btn-copy[data-copy-target]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const input = document.getElementById(btn.dataset.copyTarget);
                copyText(input ? input.value : "", btn);
            });
        });

        // Escape key closes drawer, modals and dropdowns
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                closeAdminDrawer();
                closeAllDropdowns();
                const openModals = document.querySelectorAll(".modal.open");
                if (openModals.length > 0) {
                    closeModal(openModals[openModals.length - 1].id);
                }
            }
        });

        // Global delegated click handling (dropdowns, table actions, quick copy, row click)
        document.addEventListener("click", (e) => {
            const kebabBtn = e.target.closest(".btn-kebab");
            if (kebabBtn) {
                e.stopPropagation();
                toggleDropdown(kebabBtn);
                return;
            }

            const miniCopyBtn = e.target.closest(".btn-copy-mini");
            if (miniCopyBtn) {
                e.stopPropagation();
                copyText(miniCopyBtn.dataset.copyValue || "", miniCopyBtn);
                return;
            }

            const quickEditBtn = e.target.closest("[data-quick-edit]");
            if (quickEditBtn) {
                e.stopPropagation();
                const targetType = quickEditBtn.dataset.quickEdit;
                const id = quickEditBtn.dataset.id;
                const focusField = quickEditBtn.dataset.focus;
                closeAllDropdowns();

                if (targetType === "property") openPropertyModal(id);
                else if (targetType === "client") openClientModal(id);
                else if (targetType === "contract") openContractModal(id);

                focusAndHighlightField(focusField);
                return;
            }

            const actionBtn = e.target.closest("[data-action]");
            if (actionBtn) {
                e.stopPropagation();
                const action = actionBtn.dataset.action;
                const id = actionBtn.dataset.id;
                closeAllDropdowns();

                if (action === "edit-contract") openContractModal(id);
                else if (action === "adjust-contract") openAdjustmentModal(id);
                else if (action === "finalize-contract") requestFinalizeContract(id);
                else if (action === "reactivate-contract") requestReactivateContract(id);
                else if (action === "delete-contract") requestDeleteContract(id);
                else if (action === "edit-property") openPropertyModal(id);
                else if (action === "delete-property") requestDeleteProperty(id);
                else if (action === "import-catalog") requestImportFromCatalog();
                else if (action === "edit-client") openClientModal(id);
                else if (action === "delete-client") requestDeleteClient(id);
                return;
            }

            // Close open dropdowns when clicking outside
            if (!e.target.closest(".action-menu-wrap")) {
                closeAllDropdowns();
            }

            // Clickable property row opens property modal
            const propRow = e.target.closest("tr[data-open-property]");
            if (propRow && !e.target.closest("button, a, .action-menu-wrap")) {
                openPropertyModal(propRow.dataset.openProperty);
            }
        });
    }

    // ==================== BOOT ====================
    document.addEventListener("DOMContentLoaded", () => {
        bindEvents();
        verifyAndBoot();
    });
})();
