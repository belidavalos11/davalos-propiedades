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

// Initialize Map
let mapInstance = null;
function initMap(propsToDisplay) {
    const mapContainer = document.getElementById('map-view');
    if (!mapContainer) return;

    if (!mapInstance) {
        // Salta, Argentina center
        const saltaPos = [-24.7859, -65.4117];
        mapInstance = L.map('map-view', {
            scrollWheelZoom: false 
        }).setView(saltaPos, 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(mapInstance);

        // Fix for tiles not organizing correctly on load
        setTimeout(() => {
            mapInstance.invalidateSize();
        }, 500);

        // Allow zoom on click
        mapInstance.on('focus', () => { mapInstance.scrollWheelZoom.enable(); });
        mapInstance.on('blur', () => { mapInstance.scrollWheelZoom.disable(); });
    }

    // Clear existing markers (if any)
    mapInstance.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
            mapInstance.removeLayer(layer);
        }
    });

    // Add markers for properties with coords
    if (propsToDisplay && propsToDisplay.length > 0) {
        const markers = [];
        propsToDisplay.forEach(p => {
            if (p.coords && Array.isArray(p.coords) && p.coords.length === 2) {
                const marker = L.marker(p.coords).addTo(mapInstance);
                marker.bindPopup(`
                    <div style="font-family: 'Outfit', sans-serif;">
                        <h4 style="margin: 0 0 5px 0; color: #001556;">${p.title}</h4>
                        <p style="margin: 0; font-size: 0.85rem;">${p.currency} ${formatPrice(p.price)}</p>
                        <a href="details.html?id=${p.id}" style="display: block; margin-top: 8px; font-size: 0.8rem; color: #1a1a1a; font-weight: 600; text-decoration: none;">Ver detalles →</a>
                    </div>
                `);
                markers.push(marker);
            }
        });

        // Optionally fit map to markers if there are several
        if (markers.length > 0) {
            // mapInstance.fitBounds(L.featureGroup(markers).getBounds(), { padding: [20, 20] });
        }
    }
}

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

function formatPrice(price) {
    if (!price && price !== 0) return "0";
    return Number(price).toLocaleString("es-AR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}

function formatNumber(val) {
    if (!val && val !== 0) return "";
    const num = Number(String(val).replace(/\./g, "").replace(/,/g, ""));
    if (isNaN(num)) return val;
    return num.toLocaleString("es-AR");
}

function unformatNumber(val) {
    if (typeof val !== "string") return val;
    return Number(val.replace(/\./g, "")) || 0;
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

        // 2. Load from Firestore (User's additions)
        let firebaseList = [];
        if (window.db) {
            const snapshot = await window.db.collection("properties").get();
            firebaseList = snapshot.docs.map(doc => ({ ...doc.data(), firebaseId: doc.id }));
        }

        // 3. Load Deleted IDs from Firestore
        let deletedIds = [];
        if (window.db) {
            const delSnapshot = await window.db.collection("deleted_properties").get();
            deletedIds = delSnapshot.docs.map(doc => doc.id);
        }

        // 4. Merge and Normalize
        // We use firebaseId as the primary key if available, otherwise numeric id
        const allRaw = [...firebaseList, ...jsonList];

        properties = allRaw
            .map(p => normalizeProperty(p))
            .filter(p => p && !deletedIds.includes(String(p.id)))
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
        const propRooms = Number(prop.rooms || 0);
        const matchesRooms = isNaN(propRooms) ? true : propRooms >= rooms;
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

// Global filter helper for header links
window.filterByOperation = function (type) {
    if (filterType) {
        filterType.value = type;
        applyFilters();

        // Update active class in nav
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('onclick')?.includes(type)) {
                link.classList.add('active');
            }
        });

        // Scroll to properties
        const propSection = document.getElementById('propiedades');
        if (propSection) propSection.scrollIntoView({ behavior: 'smooth' });
    }
};

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

        // Helper to extract numeric values from customFeatures (Rooms/Baths)
        const getFeatureVal = (namePattern) => {
            const feat = prop.customFeatures?.find(f =>
                (typeof f === 'string' && f.toLowerCase().includes(namePattern)) ||
                (f.name && f.name.toLowerCase().includes(namePattern))
            );
            if (!feat) return null;
            return typeof feat === 'string' ? feat.match(/\d+/) : feat.qty;
        };

        const rooms = prop.rooms || getFeatureVal('dormitorio') || getFeatureVal('habitacio') || '-';
        const baths = getFeatureVal('baño') || '-';

        const card = document.createElement("article");
        card.className = "property-card";
        card.innerHTML = `
            <div class="property-image-container">
                <div class="operation-badge badge-${(prop.category || 'venta').toLowerCase()}">${prop.category || 'Venta'}</div>
                <img src="${prop.images && prop.images.length > 0 ? prop.images[0] : 'assets/images/placeholder.jpg'}" alt="${prop.title}" class="property-image">
                <img src="assets/images/logo-seal.svg" class="property-seal" alt="Seal">
                <div class="property-badge">${prop.type}</div>
                <div class="property-price-badge">${prop.currency} ${formatPrice(prop.price)}</div>
            </div>
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
            <div class="property-info">
                <div class="property-price">${(prop.currency === "ARS" ? "AR$" : "U$D")} ${formatPrice(prop.price)}</div>
                <h3 class="property-title">${escapeHtml(prop.title)}</h3>
                <p class="property-description">${escapeHtml(prop.description || "").substring(0, 70)}...</p>
                
                <div class="property-features-new">
                    <div class="feat-item" title="Habitaciones">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"></path><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"></path><path d="M12 4v6"></path><path d="M2 18h20"></path></svg>
                        <span>${rooms}</span>
                    </div>
                    <div class="feat-item" title="Baños">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 21v-2a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v2"></path><circle cx="12" cy="7" r="4"></circle><path d="M12 11v1"></path></svg>
                        <span>${baths}</span>
                    </div>
                    <div class="feat-item" title="m² Totales / Terreno">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h18v18H3z"></path><path d="M3 9h18"></path><path d="M9 21V9"></path></svg>
                        <span>${prop.areaTotal ? `${formatNumber(prop.areaTotal)}m²` : '-'}</span>
                    </div>
                    <div class="feat-item" title="m² Construidos">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18V3H3zm13 13H8v-2h8v2zm0-4H8v-2h8v2z"></path></svg>
                        <span>${prop.areaBuilt ? `${formatNumber(prop.areaBuilt)}m²` : '-'}</span>
                    </div>
                    <div class="feat-item" title="Garage">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"></path><circle cx="7" cy="17" r="2"></circle><path d="M9 17h6"></path><circle cx="17" cy="17" r="2"></circle></svg>
                        <span>${getFeatureVal('cochera') || getFeatureVal('garage') || '-'}</span>
                    </div>
                </div>
            </div>
        `;
        card.onclick = () => window.location.href = `details.html?id=${prop.id}`;
        grid.appendChild(card);
    });
}

async function deleteProperty(id) {
    if (!confirm("¿Estás seguro de que deseas eliminar esta publicación permanentemente?")) return;

    try {
        const prop = properties.find(p => p.id === id);
        
        if (prop && prop.firebaseId) {
            // Delete from Firestore
            await window.db.collection("properties").doc(prop.firebaseId).delete();
        } else {
            // It's a base property, we "soft-delete" it by adding its ID to Firestore
            await window.db.collection("deleted_properties").doc(String(id)).set({ deletedAt: new Date().toISOString() });
        }
        
        alert("Publicación eliminada con éxito.");
        loadProperties();
    } catch (err) {
        console.error("Error deleting property:", err);
        alert("Error al eliminar la propiedad.");
    }
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

        const displaySrc = typeof img === 'string' ? img : img.preview;
        thumb.innerHTML = `
            <img src="${displaySrc}">
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

function renderStructuredFeature(feat) {
    const container = document.getElementById("custom-features-container");
    if (!container) return;

    const div = document.createElement("div");
    div.className = "structured-feature-tag";
    div.style = "display: inline-flex; align-items: center; gap: 8px; background: #f0f4ff; padding: 6px 12px; border-radius: 20px; margin: 0 8px 8px 0; font-size: 0.85rem; border: 1px solid #d0deff;";

    const displayLabel = feat.qty ? `${feat.qty} ${feat.name}` : feat.name;

    div.innerHTML = `
        <span>${feat.icon}</span>
        <strong>${displayLabel}</strong>
        <button type="button" class="btn-remove-feature" style="background:none; border:none; color:#999; cursor:pointer; font-size:1.1rem; padding:0 0 0 5px; line-height:1;">&times;</button>
        <input type="hidden" class="feature-data" value='${JSON.stringify(feat).replace(/'/g, "&apos;")}'>
    `;

    container.appendChild(div);
    div.querySelector(".btn-remove-feature").onclick = () => div.remove();
}

function populateAgentDropdown() {
    const agentSelect = document.getElementById("prop-agent");
    if (!agentSelect) return;

    // Save current selection to restore it if possible
    const currentVal = agentSelect.value;

    const users = window.AuthManager.getAllUsersSync() || [];
    agentSelect.innerHTML = '<option value="">Seleccionar agente...</option>';

    users.forEach(user => {
        const opt = document.createElement("option");
        opt.value = user.displayName || user.username;
        opt.textContent = user.displayName || user.username;
        agentSelect.appendChild(opt);
    });

    if (currentVal) agentSelect.value = currentVal;
}

function updateCreditVisibility() {
    const category = document.getElementById("prop-category").value;
    const creditWrapper = document.getElementById("credit-option-wrapper");
    if (creditWrapper) {
        creditWrapper.style.display = (category === "venta") ? "flex" : "none";
    }
}

function openEditModal(id) {
    const prop = properties.find(p => p.id === id);
    if (!prop) return;

    currentEditingId = id;

    // Repopulate agents just in case
    populateAgentDropdown();

    // Fill fields
    document.getElementById("prop-title").value = prop.title || "";
    document.getElementById("prop-category").value = prop.category || "venta";
    document.getElementById("prop-type").value = prop.type || "casa";
    document.getElementById("prop-desc").value = prop.description || "";
    document.getElementById("prop-price").value = formatNumber(prop.price);
    document.getElementById("prop-currency").value = prop.currency || "USD";

    // Owner data
    document.getElementById("prop-owner-name").value = prop.ownerName || "";
    document.getElementById("prop-owner-phone").value = prop.ownerPhone || "";
    document.getElementById("prop-owner-address").value = prop.ownerAddress || "";

    document.getElementById("prop-agent").value = prop.agent || "";
    document.getElementById("prop-credit").checked = !!prop.creditEligible;
    document.getElementById("prop-map-link").value = prop.mapLink || "";

    // Memoria Descriptiva
    const hasMemory = !!prop.memoryDescription;
    document.getElementById("prop-has-memory").checked = hasMemory;
    const memoryWrapper = document.getElementById("memory-description-wrapper");
    memoryWrapper.style.display = hasMemory ? "block" : "none";
    document.getElementById("prop-memory-desc").value = prop.memoryDescription || "";

    // Expensas
    const hasExpensas = !!prop.expensasAmount;
    document.getElementById("prop-has-expensas").checked = hasExpensas;
    const expensasWrapper = document.getElementById("expensas-wrapper");
    expensasWrapper.style.display = hasExpensas ? "flex" : "none";
    document.getElementById("prop-expensas-amount").value = formatNumber(prop.expensasAmount);
    document.getElementById("prop-expensas-currency").value = prop.expensasCurrency || "ARS";

    // Sync visibility
    updateCreditVisibility();

    // Surfaces
    document.getElementById("prop-area-total").value = formatNumber(prop.areaTotal);
    document.getElementById("prop-area-built").value = formatNumber(prop.areaBuilt);

    // Images
    uploadedImages = [...prop.images];
    renderThumbnails();

    // Custom Features (Details)
    const container = document.getElementById("custom-features-container");
    container.innerHTML = "";
    if (prop.customFeatures) {
        prop.customFeatures.forEach(feat => {
            if (typeof feat === 'string') {
                renderStructuredFeature({ name: feat, icon: "✨", qty: "" });
            } else {
                renderStructuredFeature(feat);
            }
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
        searchInput.value = "";

        // Reset nav active state
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelector('.nav-link[href="index.html"]')?.classList.add('active');

        applyFilters();
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
            populateAgentDropdown();
            updateCreditVisibility();
            document.getElementById("prop-area-total").value = "";
            document.getElementById("prop-area-built").value = "";
            document.getElementById("prop-has-memory").checked = false;
            document.getElementById("memory-description-wrapper").style.display = "none";
            document.getElementById("prop-memory-desc").value = "";
            document.getElementById("prop-has-expensas").checked = false;
            document.getElementById("expensas-wrapper").style.display = "none";
            document.getElementById("prop-expensas-amount").value = "";
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
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const success = await window.AuthManager.login(document.getElementById("username").value, document.getElementById("password").value);
            if (success) { closeModal(); updateAuthUI(); }
            else { alert("Credenciales incorrectas"); }
        };
    }

    // Structured Features logic
    const btnAddFeature = document.getElementById("btn-add-feature");
    const container = document.getElementById("custom-features-container");
    const featurePreset = document.getElementById("feature-preset");
    const featureQty = document.getElementById("feature-qty");

    if (btnAddFeature) {
        btnAddFeature.onclick = () => {
            const name = featurePreset.value;
            if (!name) return;
            const selectedOption = featurePreset.options[featurePreset.selectedIndex];
            renderStructuredFeature({
                name: name,
                icon: selectedOption.getAttribute("data-icon"),
                qty: featureQty.value
            });
            featurePreset.value = "";
            featureQty.value = "";
        };
    }

    // Dynamic Numeric Input Mask (dots)
    document.querySelectorAll(".numeric-input").forEach(input => {
        input.addEventListener("input", (e) => {
            let value = e.target.value.replace(/\D/g, "");
            if (value === "") {
                e.target.value = "";
                return;
            }
            e.target.value = Number(value).toLocaleString("es-AR");
        });
    });

    // Memoria Descriptiva toggle
    const propHasMemory = document.getElementById("prop-has-memory");
    if (propHasMemory) {
        propHasMemory.onchange = (e) => {
            const wrapper = document.getElementById("memory-description-wrapper");
            wrapper.style.display = e.target.checked ? "block" : "none";
        };
    }

    // Expensas toggle
    const propHasExpensas = document.getElementById("prop-has-expensas");
    if (propHasExpensas) {
        propHasExpensas.onchange = (e) => {
            const wrapper = document.getElementById("expensas-wrapper");
            wrapper.style.display = e.target.checked ? "flex" : "none";
        };
    }

    // Category change logic for Apto Credito
    const propCategorySelect = document.getElementById("prop-category");
    if (propCategorySelect) {
        propCategorySelect.onchange = updateCreditVisibility;
    }

    // Image Upload Handling
    const fileInput = document.getElementById("prop-images-file");
    if (fileInput) {
        fileInput.onchange = async (e) => {
            const files = Array.from(e.target.files);
            const statusText = document.createElement("p");
            statusText.textContent = "Procesando imágenes...";
            statusText.style.fontSize = "0.8rem";
            fileInput.parentElement.appendChild(statusText);

            for (const file of files) {
                try {
                    // We compress or just convert for preview for now
                    // Real upload happens on form submit to avoid orphans in Storage
                    const base64 = await toBase64(file);
                    uploadedImages.push({ file, preview: base64 });
                    renderThumbnails();
                } catch (err) {
                    console.error("Error processing file:", err);
                }
            }
            statusText.remove();
            fileInput.value = "";
        };
    }

    // Form Submission (Create or Edit)
    if (propertyForm) {
        propertyForm.onsubmit = async (e) => {
            e.preventDefault();
            const submitBtn = propertyForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = "Publicando...";

            try {
                const featuresContainer = document.getElementById("custom-features-container");
                const customFeatures = featuresContainer ? Array.from(featuresContainer.querySelectorAll(".feature-data")).map(i => JSON.parse(i.value)) : [];
                const category = document.getElementById("prop-category").value;
                const type = document.getElementById("prop-type").value;
                const price = unformatNumber(document.getElementById("prop-price").value);
                const currency = document.getElementById("prop-currency").value;
                const agent = document.getElementById("prop-agent").value;

                const areaTotal = unformatNumber(document.getElementById("prop-area-total").value);
                const areaBuilt = unformatNumber(document.getElementById("prop-area-built").value);

                // 1. Upload new images to Firebase Storage
                const finalImageUrls = [];
                for (const item of uploadedImages) {
                    if (typeof item === 'string') {
                        // Already a URL (editing existing)
                        finalImageUrls.push(item);
                    } else if (item.file) {
                        // New file to upload
                        const fileName = `${Date.now()}_${item.file.name}`;
                        const storageRef = window.storage.ref(`properties/${fileName}`);
                        const snapshot = await storageRef.put(item.file);
                        const url = await snapshot.ref.getDownloadURL();
                        finalImageUrls.push(url);
                    }
                }

                const propertyData = {
                    id: currentEditingId || Date.now(),
                    title: document.getElementById("prop-title").value,
                    description: document.getElementById("prop-desc").value,
                    price: price,
                    currency: currency,
                    category: category,
                    type: type,
                    ownerName: document.getElementById("prop-owner-name").value,
                    ownerPhone: document.getElementById("prop-owner-phone").value,
                    ownerAddress: document.getElementById("prop-owner-address").value,
                    agent: agent,
                    creditEligible: (category === "venta") ? document.getElementById("prop-credit").checked : false,
                    mapLink: document.getElementById("prop-map-link").value,
                    createdAt: currentEditingId ? (properties.find(p => p.id === currentEditingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
                    images: finalImageUrls,
                    customFeatures,
                    areaTotal: areaTotal || null,
                    areaBuilt: areaBuilt || null,
                    memoryDescription: document.getElementById("prop-has-memory").checked ? document.getElementById("prop-memory-desc").value : "",
                    expensasAmount: document.getElementById("prop-has-expensas").checked ? unformatNumber(document.getElementById("prop-expensas-amount").value) : null,
                    expensasCurrency: document.getElementById("prop-expensas-currency").value
                };

                if (currentEditingId) {
                    const existing = properties.find(p => p.id === currentEditingId);
                    if (existing && existing.firebaseId) {
                        await window.db.collection("properties").doc(existing.firebaseId).update(propertyData);
                    } else {
                        // It was a base property or local, now moving to cloud
                        await window.db.collection("properties").add(propertyData);
                    }
                } else {
                    await window.db.collection("properties").add(propertyData);
                }

                closeModal();
                loadProperties();
                alert(currentEditingId ? "Propiedad actualizada con éxito" : "Propiedad publicada con éxito");
                currentEditingId = null;
            } catch (err) {
                console.error("CRITICAL ERROR publishing property:", err);
                alert(`Error al publicar la propiedad: ${err.message || 'Error desconocido'}. Verifica tu conexión y configuración de Firebase Storage.`);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
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
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function renderUserList() {
    const container = document.getElementById("user-list");
    if (!container) return;

    const manager = window.AuthManager;
    const users = await manager.getAllUsers();
    const currentUser = manager.getCurrentUser();

    container.innerHTML = users.map(u => {
        const isProtected = u.username === "admin" || u.username === currentUser;
        
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee;">
                <div>
                    <strong>${escapeHtml(u.displayName)}</strong> (${u.username})<br>
                    <small style="color: #666;">${u.role}</small>
                </div>
                ${!isProtected ? `
                    <button class="btn btn-outline btn-small" style="color: #e74c3c; border-color: #e74c3c;" onclick="handleRemoveUser('${u.username}')">Eliminar</button>
                ` : ""}
            </div>
        `;
    }).join("");
}
window.renderUserList = renderUserList;

async function handleAddUser(e) {
    e.preventDefault();
    const manager = window.AuthManager;
    await manager._loadUsersFromFirestore(); // Ensure we have latest before adding
    const userData = {
        username: document.getElementById("new-username").value,
        displayName: document.getElementById("new-displayname").value,
        firstName: document.getElementById("new-firstname").value,
        lastName: document.getElementById("new-lastname").value,
        phone: document.getElementById("new-phone").value,
        password: document.getElementById("new-user-password").value,
        role: document.getElementById("new-role").value
    };

    const success = await manager.addUser(userData);
    if (success) {
        e.target.reset();
        await renderUserList();
        alert("Usuario creado con éxito.");
    } else {
        alert("Error: El usuario ya existe o no tienes permisos.");
    }
}

async function handleRemoveUser(username) {
    if (!confirm(`¿Estás seguro de que deseas eliminar al usuario "${username}"? Esta acción no se puede deshacer.`)) return;
    const success = await window.AuthManager.removeUser(username);
    if (success) {
        await renderUserList();
        alert("Usuario eliminado correctamente.");
    } else {
        alert("Error: No se pudo eliminar al usuario. Es posible que sea una cuenta protegida o no tengas permisos.");
    }
}
window.handleRemoveUser = handleRemoveUser;

function init() {
    // Initial load
    loadProperties();
    updateAuthUI();
    bindEvents();

    document.getElementById("add-user-form")?.addEventListener("submit", handleAddUser);
}

init();
