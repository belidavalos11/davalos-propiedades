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
let currentEditingId = null;

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
        const hasAccess = logged && manager.hasPermission(manager.Permissions.ACCESS_SETTINGS);
        btnSettings.style.display = hasAccess ? "block" : "none";

        // Also handle the user mgmt toggle button inside settings
        const btnToggleUserMgmt = document.getElementById("btn-toggle-user-mgmt");
        if (btnToggleUserMgmt) {
            btnToggleUserMgmt.style.display = (logged && manager.hasPermission(manager.Permissions.MANAGE_USERS)) ? "block" : "none";
        }
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
                    <button class="property-settings-item" onclick="openEditModal(${prop.id})">
                        Editar publicación
                    </button>
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

    localProperties = JSON.parse(localStorage.getItem("davalos_properties") || "[]");
    const initialCount = localProperties.length;
    localProperties = localProperties.filter(p => p.id !== id);

    if (localProperties.length < initialCount) {
        localStorage.setItem("davalos_properties", JSON.stringify(localProperties));
        alert("Publicación eliminada con éxito.");
    } else {
        alert("Nota: Las publicaciones del catálogo base no se pueden borrar físicamente, pero se simulará su remoción.");
    }

    loadProperties();
}

// Global Image State
let uploadedImages = [];

// Helper - Render image previews with reordering
function renderThumbnails() {
    const previews = document.getElementById("image-previews");
    if (!previews) return;
    previews.innerHTML = "";

    uploadedImages.forEach((img, index) => {
        const thumb = document.createElement("div");
        thumb.className = "preview-thumbnail";
        thumb.draggable = true;
        thumb.dataset.index = index;

        thumb.innerHTML = `
            <img src="${img}">
            <button type="button" class="btn-set-cover" onclick="setAsCover(${index})" title="Poner como portada">✨</button>
            <button type="button" class="btn-remove-preview" onclick="removeThumbnail(${index})">&times;</button>
        `;

        // Drag Events
        thumb.ondragstart = (e) => {
            e.dataTransfer.setData("text/plain", index);
            thumb.classList.add("dragging");
        };

        thumb.ondragend = () => {
            thumb.classList.remove("dragging");
        };

        thumb.ondragover = (e) => e.preventDefault();

        thumb.ondrop = (e) => {
            e.preventDefault();
            const fromIndex = parseInt(e.dataTransfer.getData("text/plain"));
            const toIndex = index;

            if (fromIndex !== toIndex) {
                const movedItem = uploadedImages.splice(fromIndex, 1)[0];
                uploadedImages.splice(toIndex, 0, movedItem);
                renderThumbnails();
            }
        };

        previews.appendChild(thumb);
    });
}

function removeThumbnail(index) {
    uploadedImages.splice(index, 1);
    renderThumbnails();
}

function setAsCover(index) {
    if (index === 0) return;
    const img = uploadedImages.splice(index, 1)[0];
    uploadedImages.unshift(img);
    renderThumbnails();
}

function openEditModal(id) {
    const prop = properties.find(p => p.id === id);
    if (!prop) return;

    currentEditingId = id;

    // Fill fields
    document.getElementById("prop-title").value = prop.title;
    document.getElementById("prop-desc").value = prop.description || "";
    document.getElementById("prop-price").value = prop.price;
    document.getElementById("prop-category").value = prop.category;
    document.getElementById("prop-rooms").value = prop.rooms;
    document.getElementById("prop-area").value = prop.area;
    document.getElementById("prop-owner").value = prop.owner || "";
    document.getElementById("prop-agent").value = prop.agent || "";

    // Images
    uploadedImages = [...prop.images];
    renderThumbnails();

    // Custom Features
    const container = document.getElementById("custom-features-container");
    container.innerHTML = "";
    if (prop.customFeatures) {
        prop.customFeatures.forEach(feat => {
            const div = document.createElement("div");
            div.className = "feature-input-group";
            div.innerHTML = `<input type="text" value="${escapeHtml(feat)}"><button type="button" class="btn-remove-feature">&times;</button>`;
            container.appendChild(div);
            div.querySelector(".btn-remove-feature").onclick = () => div.remove();
        });
    }

    // Change modal title
    const modalHeader = propertyModal.querySelector(".modal-header h2");
    if (modalHeader) modalHeader.textContent = "Editar propiedad";

    openModal(propertyModal);
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

    if (btnLogin) btnLogin.onclick = () => openModal(loginModal);
    if (btnSettings) btnSettings.onclick = () => {
        // Reset modal state
        document.getElementById("change-password-form").style.display = "none";
        document.getElementById("user-management-section").style.display = "none";
        openModal(settingsModal);
    };

    const btnToggleUserMgmt = document.getElementById("btn-toggle-user-mgmt");
    if (btnToggleUserMgmt) {
        btnToggleUserMgmt.onclick = () => {
            const section = document.getElementById("user-management-section");
            const isVisible = section.style.display === "block";
            section.style.display = isVisible ? "none" : "block";
            if (!isVisible) renderUserList();
        };
    }

    const btnChangePassword = document.getElementById("btn-change-password");
    if (btnChangePassword) {
        btnChangePassword.onclick = () => {
            const form = document.getElementById("change-password-form");
            form.style.display = form.style.display === "block" ? "none" : "block";
        };
    }
    if (btnAddProperty) {
        btnAddProperty.onclick = () => {
            currentEditingId = null;
            propertyForm.reset();
            document.getElementById("custom-features-container").innerHTML = "";
            document.getElementById("image-previews").innerHTML = "";
            uploadedImages = [];
            const modalHeader = propertyModal.querySelector(".modal-header h2");
            if (modalHeader) modalHeader.textContent = "Cargar nueva propiedad";
            openModal(propertyModal);
        };
    }
    if (btnLogout) btnLogout.onclick = () => { window.AuthManager.logout(); updateAuthUI(); };
    closeBtns.forEach(btn => btn.onclick = closeModal);

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

    // Dynamic Features logic
    const btnAddFeature = document.getElementById("btn-add-feature");
    const container = document.getElementById("custom-features-container");
    if (btnAddFeature) {
        btnAddFeature.onclick = () => {
            const div = document.createElement("div");
            div.className = "feature-input-group";
            div.innerHTML = `<input type="text" placeholder="Ej: Piscina climatizada"><button type="button" class="btn-remove-feature">&times;</button>`;
            container.appendChild(div);
            div.querySelector(".btn-remove-feature").onclick = () => div.remove();
        };
    }

    // Image Upload Handling
    const fileInput = document.getElementById("prop-images-file");
    if (fileInput) {
        fileInput.onchange = async (e) => {
            const files = Array.from(e.target.files);
            for (const file of files) {
                try {
                    const base64 = await toBase64(file);
                    uploadedImages.push(base64);
                    renderThumbnails();
                } catch (err) {
                    console.error("Error processing file:", err);
                }
            }
            fileInput.value = "";
        };
    }

    // Form Submission (Create or Edit)
    if (propertyForm) {
        propertyForm.onsubmit = (e) => {
            e.preventDefault();
            const customFeatures = Array.from(container.querySelectorAll("input")).map(i => i.value).filter(Boolean);
            const urlImagesInput = document.getElementById("prop-images");
            const urlImages = urlImagesInput ? urlImagesInput.value.split(",").map(i => i.trim()).filter(Boolean) : [];

            const propertyData = {
                id: currentEditingId || Date.now(),
                title: document.getElementById("prop-title").value,
                description: document.getElementById("prop-desc").value,
                price: Number(document.getElementById("prop-price").value),
                category: document.getElementById("prop-category").value,
                rooms: document.getElementById("prop-rooms").value,
                area: document.getElementById("prop-area").value,
                owner: document.getElementById("prop-owner").value,
                agent: document.getElementById("prop-agent").value,
                createdAt: currentEditingId ? (properties.find(p => p.id === currentEditingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
                images: [...uploadedImages, ...urlImages],
                customFeatures
            };

            localProperties = JSON.parse(localStorage.getItem("davalos_properties") || "[]");

            if (currentEditingId) {
                const index = localProperties.findIndex(p => p.id === currentEditingId);
                if (index > -1) {
                    localProperties[index] = propertyData;
                } else {
                    // It was a base property, we "save" it locally as an override
                    localProperties.unshift(propertyData);
                }
            } else {
                localProperties.unshift(propertyData);
            }

            localStorage.setItem("davalos_properties", JSON.stringify(localProperties));
            closeModal();
            loadProperties();
            alert(currentEditingId ? "Propiedad actualizada con éxito" : "Propiedad publicada con éxito");
            currentEditingId = null;
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
