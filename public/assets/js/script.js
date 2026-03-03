const DATA_URL = "data/properties.json";
const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80";

// DOM Elements - Selection
const grid = document.getElementById("properties-grid");
const resultsCount = document.getElementById("results-count");
const filterType = document.getElementById("filter-type");
const filterRooms = document.getElementById("filter-rooms");
const filterPriceMin = document.getElementById("filter-price-min");
const filterPriceMax = document.getElementById("filter-price-max");
const searchInput = document.getElementById("search-input");
const sortBy = document.getElementById("sort-by");
const clearFiltersBtn = document.getElementById("clear-filters");

// Pill Search Elements
const searchPill = document.getElementById("search-pill");
const advancedFilters = document.getElementById("advanced-filters");
const btnToggleFilters = document.getElementById("btn-toggle-filters");

// Modal Elements
const loginModal = document.getElementById("login-modal");
const settingsModal = document.getElementById("settings-modal");
const propertyModal = document.getElementById("property-modal");
const btnLogin = document.getElementById("btn-login");
const btnSettings = document.getElementById("btn-settings");
const btnLogout = document.getElementById("btn-logout");
const btnAddProperty = document.getElementById("btn-add-property");
const loginForm = document.getElementById("login-form");
const propertyForm = document.getElementById("property-form");
const closeBtns = document.querySelectorAll(".close-modal");

// State
let properties = [];
let localProperties = [];

// Utility
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function safeImageUrl(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/") || trimmed.startsWith("data:image")) return trimmed;
    return null;
}

// Logic - Auth UI
function updateAuthUI() {
    const manager = window.AuthManager;
    const logged = manager && manager.isLoggedIn();

    if (btnLogin) btnLogin.style.display = logged ? "none" : "block";
    if (btnLogout) btnLogout.style.display = logged ? "block" : "none";

    if (btnSettings) {
        btnSettings.style.display = (logged && manager.hasPermission(manager.Permissions.ACCESS_SETTINGS)) ? "block" : "none";
    }

    if (btnAddProperty) {
        btnAddProperty.style.display = (logged && manager.hasPermission(manager.Permissions.UPLOAD_PROPERTY)) ? "block" : "none";
    }

    const greeting = document.getElementById("user-greeting");
    if (greeting) {
        if (logged) {
            const name = window.AuthManager.getDisplayName();
            greeting.textContent = `¡Hola ${name}!`;
            greeting.style.display = "block";
        } else {
            greeting.style.display = "none";
        }
    }
}

function openModal(modal) {
    if (modal) modal.style.display = "block";
    document.body.style.overflow = "hidden";
}

function closeModal() {
    [loginModal, settingsModal, propertyModal].forEach(m => {
        if (m) m.style.display = "none";
    });
    document.body.style.overflow = "auto";
}

// Logic - Data Loading
async function loadProperties() {
    try {
        // 1. Fetch from JSON (Base Catalog)
        const response = await fetch(DATA_URL, { cache: "no-store" });
        let jsonList = [];
        if (response.ok) {
            const payload = await response.json();
            jsonList = Array.isArray(payload?.properties) ? payload.properties : [];
        }

        // 2. Load from LocalStorage (User's additions)
        localProperties = JSON.parse(localStorage.getItem("davalos_properties") || "[]");

        // 3. Merge and Normalize
        const allRaw = [...localProperties, ...jsonList];
        properties = allRaw
            .map(p => normalizeProperty(p))
            .filter(Boolean)
            .sort((a, b) => b.createdAtTs - a.createdAtTs);

        applyFilters();
    } catch (error) {
        console.error("Error loading properties:", error);
        grid.innerHTML = `<div class="no-results"><h3>Error de carga</h3><p>No se pudieron sincronizar las propiedades.</p></div>`;
    }
}

function normalizeProperty(prop) {
    if (!prop || typeof prop !== "object") return null;
    const id = Number(prop.id) || Date.now();
    const title = String(prop.title || "").trim();
    const price = Number(prop.price) || 0;
    const createdAt = prop.createdAt || new Error().stack; // fallback to unique
    const images = (Array.isArray(prop.images) ? prop.images : [])
        .map(img => safeImageUrl(img))
        .filter(Boolean);

    return {
        ...prop,
        id,
        title,
        price,
        createdAtTs: Date.parse(prop.createdAt) || id,
        images: images.length ? images : [PLACEHOLDER_IMAGE]
    };
}

// Filtering Logic
function applyFilters() {
    const type = filterType.value;
    const rooms = Number(filterRooms.value || 0);
    const min = Number(filterPriceMin.value) || 0;
    const max = Number(filterPriceMax.value) || Infinity;
    const text = (searchInput.value || "").trim().toLowerCase();
    const sort = sortBy.value;

    let filtered = properties.filter(prop => {
        const matchesType = type === "todos" || prop.category === type;
        const matchesRooms = Number(prop.rooms) >= rooms;
        const matchesPrice = prop.price >= min && (max === Infinity || prop.price <= max);
        const haystack = `${prop.title} ${prop.description} ${prop.agent} ${prop.owner}`.toLowerCase();
        const matchesText = !text || haystack.includes(text);
        return matchesType && matchesRooms && matchesPrice && matchesText;
    });

    // Sorting
    switch (sort) {
        case "price-asc": filtered.sort((a, b) => a.price - b.price); break;
        case "price-desc": filtered.sort((a, b) => b.price - a.price); break;
        case "area-desc": filtered.sort((a, b) => b.area - a.area); break;
        default: filtered.sort((a, b) => b.createdAtTs - a.createdAtTs); break;
    }

    renderProperties(filtered);
}

function renderProperties(filtered) {
    grid.innerHTML = "";
    if (resultsCount) resultsCount.textContent = `${filtered.length} resultado${filtered.length === 1 ? "" : "s"}`;

    if (!filtered.length) {
        grid.innerHTML = `<div class="no-results"><h3>Sin resultados</h3><p>Intenta con otros filtros.</p></div>`;
        return;
    }

    filtered.forEach(prop => {
        const manager = window.AuthManager;
        const canManage = manager && manager.hasPermission(manager.Permissions.DELETE_PUBLICATION);

        const card = document.createElement("article");
        card.className = "property-card";
        card.innerHTML = `
            <div class="property-image">
                <img loading="lazy" src="${prop.images[0]}" alt="${escapeHtml(prop.title)}">
                <span class="badge badge-${prop.category}">${prop.category}</span>
                ${canManage ? `
                <button class="property-settings-btn" title="Opciones" onclick="event.stopPropagation(); this.nextElementSibling.classList.toggle('show')">
                    ⚙️
                </button>
                <div class="property-settings-menu" onclick="event.stopPropagation()">
                    <button class="property-settings-item danger" onclick="deleteProperty(${prop.id})">
                        Eliminar publicación
                    </button>
                </div>
                ` : ""}
            </div>
            <div class="property-info">
                <div class="property-price">USD ${prop.price.toLocaleString("es-AR")}</div>
                <h3 class="property-title">${escapeHtml(prop.title)}</h3>
                <p class="property-description">${escapeHtml(prop.description || "").substring(0, 80)}...</p>
                <div class="property-features">
                    <div class="feature"><span>Amb.</span> ${prop.rooms}</div>
                    <div class="feature"><span>m2</span> ${prop.area}</div>
                </div>
            </div>
        `;
        card.onclick = () => window.location.href = `details.html?id=${prop.id}`;
        grid.appendChild(card);
    });
}

function deleteProperty(id) {
    if (!confirm("¿Estás seguro de que deseas eliminar esta publicación permanentemente?")) return;

    // Check if it's a local property
    localProperties = JSON.parse(localStorage.getItem("davalos_properties") || "[]");
    const initialCount = localProperties.length;
    localProperties = localProperties.filter(p => p.id !== id);

    if (localProperties.length < initialCount) {
        localStorage.setItem("davalos_properties", JSON.stringify(localProperties));
        alert("Publicación descargada localmente eliminada con éxito.");
    } else {
        alert("Nota: Las publicaciones del catálogo base no se pueden borrar físicamente desde el navegador, pero se simulará su remoción en esta sesión.");
    }

    loadProperties();
}

// Event Bindings
function bindEvents() {
    [filterType, filterRooms, sortBy].forEach(el => el.addEventListener("change", applyFilters));
    [filterPriceMin, filterPriceMax, searchInput].forEach(el => el.addEventListener("input", applyFilters));
    if (clearFiltersBtn) clearFiltersBtn.onclick = () => {
        filterType.value = "todos"; filterRooms.value = "0";
        filterPriceMin.value = ""; filterPriceMax.value = "";
        searchInput.value = ""; applyFilters();
    };

    // Auth events
    if (btnLogin) btnLogin.onclick = () => openModal(loginModal);
    if (btnSettings) btnSettings.onclick = () => openModal(settingsModal);
    if (btnAddProperty) btnAddProperty.onclick = () => openModal(propertyModal);
    if (btnLogout) btnLogout.onclick = () => { window.AuthManager.logout(); updateAuthUI(); };
    closeBtns.forEach(btn => btn.onclick = closeModal);

    // Pill Search Interactivity
    if (searchPill) {
        searchPill.onclick = (e) => {
            if (e.target.closest("#btn-toggle-filters")) return;
            advancedFilters.classList.toggle("show");
        };
    }

    if (btnToggleFilters) {
        btnToggleFilters.onclick = (e) => {
            e.stopPropagation();
            advancedFilters.classList.toggle("show");
        };
    }

    if (loginForm) {
        loginForm.onsubmit = (e) => {
            e.preventDefault();
            const success = window.AuthManager.login(document.getElementById("username").value, document.getElementById("password").value);
            if (success) { closeModal(); updateAuthUI(); }
            else { alert("Credenciales incorrectas"); }
        };
    }

    // Property Upload Logic
    const btnAddFeature = document.getElementById("btn-add-feature");
    const featuresContainer = document.getElementById("custom-features-container");

    if (btnAddFeature) {
        btnAddFeature.onclick = () => {
            const div = document.createElement("div");
            div.className = "feature-input-group";
            div.innerHTML = `<input type="text" placeholder="Ej: Piscina climatizada"><button type="button" class="btn-remove-feature">&times;</button>`;
            featuresContainer.appendChild(div);
            div.querySelector(".btn-remove-feature").onclick = () => div.remove();
        };
    }

    // Local Image Support
    const fileInput = document.getElementById("prop-images-file");
    const previews = document.getElementById("image-previews");
    let uploadedImages = [];

    if (fileInput) {
        fileInput.onchange = async (e) => {
            const files = Array.from(e.target.files);
            for (const file of files) {
                try {
                    const base64 = await toBase64(file);
                    uploadedImages.push(base64);
                    const thumb = document.createElement("div");
                    thumb.className = "preview-thumbnail";
                    thumb.innerHTML = `<img src="${base64}"><button type="button" class="btn-remove-preview">&times;</button>`;
                    previews.appendChild(thumb);
                    thumb.querySelector(".btn-remove-preview").onclick = () => {
                        const index = uploadedImages.indexOf(base64);
                        if (index > -1) uploadedImages.splice(index, 1);
                        thumb.remove();
                    };
                } catch (err) {
                    console.error("Error processing file:", err);
                }
            }
            fileInput.value = ""; // Clear so same file can be selected again if removed
        };
    }

    if (propertyForm) {
        propertyForm.onsubmit = (e) => {
            e.preventDefault();
            const customFeatures = Array.from(featuresContainer.querySelectorAll("input")).map(i => i.value).filter(Boolean);
            const urlImages = document.getElementById("prop-images").value.split(",").map(i => i.trim()).filter(Boolean);

            const newProp = {
                id: Date.now(),
                title: document.getElementById("prop-title").value,
                description: document.getElementById("prop-desc").value,
                price: Number(document.getElementById("prop-price").value),
                category: document.getElementById("prop-category").value,
                rooms: document.getElementById("prop-rooms").value,
                area: document.getElementById("prop-area").value,
                owner: document.getElementById("prop-owner").value,
                agent: document.getElementById("prop-agent").value,
                createdAt: new Date().toISOString(),
                images: [...uploadedImages, ...urlImages],
                customFeatures
            };

            localProperties.unshift(newProp);
            localStorage.setItem("davalos_properties", JSON.stringify(localProperties));
            closeModal();
            loadProperties();
            propertyForm.reset();
            previews.innerHTML = "";
            uploadedImages = [];
        };
    }
}

function toBase64(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
    });
}

// User Management Helpers
function renderUserList() {
    const container = document.getElementById("user-list");
    if (!container) return;

    const manager = window.AuthManager;
    const users = manager.getAllUsers();

    container.innerHTML = users.map(u => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee;">
            <div>
                <strong>${escapeHtml(u.displayName)}</strong> (${u.username})<br>
                <small style="color: #666;">${u.role}</small>
            </div>
            ${!manager._users.some(core => core.username === u.username) ? `
                <button class="btn btn-outline btn-small" style="color: #e74c3c; border-color: #e74c3c;" onclick="handleRemoveUser('${u.username}')">Eliminar</button>
            ` : ""}
        </div>
    `).join("");
}

function handleAddUser(e) {
    e.preventDefault();
    const manager = window.AuthManager;
    const userData = {
        username: document.getElementById("new-username").value,
        displayName: document.getElementById("new-displayname").value,
        password: document.getElementById("new-password").value,
        role: document.getElementById("new-role").value
    };

    if (manager.addUser(userData)) {
        e.target.reset();
        renderUserList();
        alert("Usuario creado con éxito.");
    } else {
        alert("Error: El usuario ya existe o no tienes permisos.");
    }
}

function handleRemoveUser(username) {
    if (!confirm(`¿Estás seguro de que deseas eliminar al usuario ${username}?`)) return;
    if (window.AuthManager.removeUser(username)) {
        renderUserList();
    } else {
        alert("No se pudo eliminar al usuario.");
    }
}

function init() {
    loadProperties();
    updateAuthUI();
    bindEvents();

    document.getElementById("add-user-form")?.addEventListener("submit", handleAddUser);
}

init();
