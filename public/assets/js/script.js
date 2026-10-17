const DATA_URL = window.SITE_CONFIG?.data?.catalogUrl || "data/properties.json";
const PLACEHOLDER_IMAGE = window.SITE_CONFIG?.assets?.placeholderImage || "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80";

// DOM Elements - Selection
const grid = document.getElementById("properties-grid");
const resultsCount = document.getElementById("results-count");
const filterPropType = document.getElementById("filter-prop-type");
const filterType = document.getElementById("filter-type");
const filterRooms = document.getElementById("filter-rooms");
const filterPriceMin = document.getElementById("filter-price-min");
const filterPriceMax = document.getElementById("filter-price-max");
const searchInput = document.getElementById("search-input");
const btnHeroSearch = document.getElementById("btn-hero-search");
const sortBy = document.getElementById("sort-by");
const clearFiltersBtn = document.getElementById("clear-filters");

// Initialize Map
let mapInstance = null;
function initMap(propsToDisplay) {
    const mapContainer = document.getElementById('map-view');
    if (!mapContainer) return;

    if (!mapInstance) {
        // Default map center from SITE_CONFIG (Salta, Argentina)
        const saltaPos = window.SITE_CONFIG?.contact?.mapCenter || [-24.7859, -65.4117];
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
                    <div style="font-family: var(--font-main);">
                        <h4 style="margin: 0 0 5px 0; color: var(--primary);">${p.title}</h4>
                        <p style="margin: 0; font-size: 0.85rem;">${p.currency} ${formatPrice(p.price)}</p>
                        <a href="details?id=${p.id}" style="display: block; margin-top: 8px; font-size: 0.8rem; color: var(--secondary); font-weight: 600; text-decoration: none;">Ver detalles →</a>
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
let currentEditingUsername = null;
let selectedPropertyTypes = [];

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
    if (window.showLoader) window.showLoader();
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

        renderPropertyCategories();
        updateActiveTypeUI();
        applyFilters();
    } catch (error) {
        console.error("Error loading properties:", error);
        grid.innerHTML = `<div class="no-results"><h3>Error de carga</h3><p>No se pudieron sincronizar las propiedades.</p></div>`;
    }
}

function normalizeProperty(prop) {
    if (!prop || typeof prop !== "object") return null;
    const id = prop.id || Date.now();
    const title = String(prop.title || "").trim();
    const operation = String(prop.operation || prop.category || "venta").trim().toLowerCase();
    const type = String(prop.type || "").trim().toLowerCase();
    const price = Number(prop.price) || 0;
    const currency = String(prop.currency || "USD").trim().toUpperCase();
    const location = String(prop.location || window.SITE_CONFIG?.contact?.city || "Salta").trim();
    const description = String(prop.description || "").trim();
    const createdAt = prop.createdAt || new Date().toISOString();

    const featObj = (prop.features && typeof prop.features === "object" && !Array.isArray(prop.features)) ? prop.features : {};
    const rooms = Number(featObj.rooms ?? prop.rooms) || null;
    const baths = Number(featObj.baths ?? prop.baths) || null;
    const areaTotal = Number(featObj.areaTotal ?? prop.areaTotal ?? prop.area) || null;
    const areaBuilt = Number(featObj.areaBuilt ?? prop.areaBuilt) || null;
    const garage = Number(featObj.garage ?? prop.garage) || null;

    const images = (Array.isArray(prop.images) ? prop.images : [])
        .map(img => safeImageUrl(img))
        .filter(Boolean);

    return {
        ...prop,
        id,
        title,
        type,
        operation,
        category: operation,
        price,
        currency,
        location,
        description,
        agentId: String(prop.agentId || "").trim(),
        rooms,
        baths,
        areaTotal,
        areaBuilt,
        garage,
        features: {
            rooms,
            baths,
            areaTotal,
            areaBuilt,
            garage
        },
        createdAt,
        createdAtTs: Date.parse(createdAt) || (typeof id === 'number' ? id : Date.now()),
        images: images.length ? images : [PLACEHOLDER_IMAGE]
    };
}

// Render "Explorá por tipo de propiedad" grid from SITE_CONFIG
// Solo muestra categorías que tengan propiedades cargadas (> 0) y asigna más espacio a las que tienen más inmuebles
function renderPropertyCategories() {
    const categoriesSection = document.getElementById("categorias-propiedades");
    const categoriesGrid = document.getElementById("categories-grid");
    if (!categoriesGrid) return;

    const cfg = window.SITE_CONFIG;
    if (cfg?.categoriesSection) {
        const eyebrowEl = document.getElementById("categories-eyebrow");
        const titleEl = document.getElementById("categories-title");
        const subtitleEl = document.getElementById("categories-subtitle");
        if (eyebrowEl && cfg.categoriesSection.eyebrow) eyebrowEl.textContent = cfg.categoriesSection.eyebrow;
        if (titleEl && cfg.categoriesSection.title) titleEl.textContent = cfg.categoriesSection.title;
        if (subtitleEl && cfg.categoriesSection.subtitle) subtitleEl.textContent = cfg.categoriesSection.subtitle;
    }

    const categories = cfg?.propertyCategories || [];

    // Calcular cuántas propiedades tiene cada categoría y filtrar solo las que tengan > 0
    const activeCategories = categories
        .map(cat => {
            const matchingProps = properties.filter(p => matchesSelectedPropertyType(p, cat.id));
            return {
                ...cat,
                count: matchingProps.length
            };
        })
        .filter(cat => cat.count > 0);

    if (activeCategories.length === 0) {
        if (categoriesSection) categoriesSection.style.display = "none";
        categoriesGrid.innerHTML = "";
        return;
    }

    if (categoriesSection) categoriesSection.style.display = "block";

    // Ordenar o identificar qué categorías tienen más elementos para asignarles mayor ancho en la grilla Bento (base 12 columnas)
    const total = activeCategories.length;
    // Ranking de mayor a menor cantidad de propiedades (desempate por orden original)
    const rankedIds = [...activeCategories]
        .sort((a, b) => b.count - a.count)
        .map(c => c.id);

    const getBentoSpans = (items) => {
        const n = items.length;
        if (n === 1) return ["span-12"];
        if (n === 2) {
            // La que tiene más elementos ocupa 7 columnas y la otra 5 (si empatan, 6 y 6)
            if (items[0].count === items[1].count) return ["span-6", "span-6"];
            return items[0].count > items[1].count ? ["span-7", "span-5"] : ["span-5", "span-7"];
        }

        // Para 3 o más categorías: dividimos en filas de hasta 3 tarjetas (12 columnas por fila)
        // En cada fila de 3, la categoría con más propiedades de esa fila ocupa 6 columnas (50% del ancho, igual a la foto)
        // y las otras dos ocupan 3 columnas cada una (25% + 25%).
        // Si una fila tiene 2 elementos, el mayor ocupa 7 y el menor 5.
        // Si una fila tiene 1 elemento, ocupa 12.
        const spans = new Array(n).fill("span-4");
        let idx = 0;
        let rowNum = 0;
        while (idx < n) {
            const remaining = n - idx;
            const rowSize = remaining >= 3 ? 3 : remaining;
            const rowSlice = items.slice(idx, idx + rowSize);

            if (rowSize === 3) {
                // Encontrar el índice dentro de la fila con mayor cantidad de propiedades
                let maxIdxInRow = 0;
                for (let j = 1; j < 3; j++) {
                    if (rowSlice[j].count > rowSlice[maxIdxInRow].count) {
                        maxIdxInRow = j;
                    }
                }
                // Si todas tienen la misma cantidad en la fila, alternamos la posición ancha como en la foto (izq -> der -> izq)
                const allEqual = rowSlice.every(item => item.count === rowSlice[0].count);
                const widePos = allEqual ? (rowNum % 2 === 0 ? 0 : 2) : maxIdxInRow;

                for (let j = 0; j < 3; j++) {
                    spans[idx + j] = (j === widePos) ? "span-6" : "span-3";
                }
            } else if (rowSize === 2) {
                if (rowSlice[0].count >= rowSlice[1].count) {
                    spans[idx] = "span-7";
                    spans[idx + 1] = "span-5";
                } else {
                    spans[idx] = "span-5";
                    spans[idx + 1] = "span-7";
                }
            } else {
                spans[idx] = "span-12";
            }

            idx += rowSize;
            rowNum++;
        }
        return spans;
    };

    // Ordenamos para que en cada fila la tarjeta con más elementos destaque visualmente
    const spans = getBentoSpans(activeCategories);

    categoriesGrid.innerHTML = activeCategories.map((cat, idx) => {
        const isActive = selectedPropertyTypes.includes(cat.id);
        const spanClass = spans[idx] || "span-4";
        return `
            <a href="#propiedades"
               class="category-card ${spanClass} ${isActive ? 'active' : ''}"
               data-type="${escapeHtml(cat.id)}"
               title="${cat.count} ${cat.count === 1 ? 'propiedad disponible' : 'propiedades disponibles'}"
               onclick="event.preventDefault(); filterByPropertyType('${escapeHtml(cat.id)}', true);">
                <img src="${escapeHtml(cat.image || PLACEHOLDER_IMAGE)}" alt="${escapeHtml(cat.label)}" class="category-card-bg" loading="lazy">
                <div class="category-card-overlay"></div>
                <span class="category-card-title">${escapeHtml(cat.label)}</span>
            </a>
        `;
    }).join("");
}

function getAvailableCategoriesWithCount() {
    const categories = window.SITE_CONFIG?.propertyCategories || [];
    return categories
        .map(cat => ({
            ...cat,
            count: properties.filter(p => matchesSelectedPropertyType(p, cat.id)).length
        }))
        .filter(cat => cat.count > 0);
}

function updateActiveTypeUI() {
    const cards = document.querySelectorAll(".category-card");
    cards.forEach(card => {
        const typeAttr = card.getAttribute("data-type");
        card.classList.toggle("active", selectedPropertyTypes.includes(typeAttr));
    });

    if (filterPropType) {
        filterPropType.value = selectedPropertyTypes.length === 1 ? selectedPropertyTypes[0] : "todos";
    }

    const banner = document.getElementById("active-type-filter-banner");
    if (!banner) return;

    if (selectedPropertyTypes.length === 0) {
        banner.style.display = "none";
        banner.innerHTML = "";
        return;
    }

    const availableCats = getAvailableCategoriesWithCount();
    const allCats = window.SITE_CONFIG?.propertyCategories || [];

    // 1. Chips de categorías ya seleccionadas (para poder quitarlas individualmente)
    const activeChipsHtml = selectedPropertyTypes.map(typeId => {
        const catObj = allCats.find(c => c.id === typeId);
        const label = catObj ? catObj.label : typeId;
        return `
            <button type="button" class="filter-chip active" title="Quitar ${escapeHtml(label)}" onclick="togglePropertyTypeFilter('${escapeHtml(typeId)}')">
                <span>${escapeHtml(label)}</span>
                <span class="chip-Action">&times;</span>
            </button>
        `;
    }).join("");

    // 2. Chips de otras categorías con propiedades disponibles (para poder sumarlas a la búsqueda)
    const unselectedCats = availableCats.filter(c => !selectedPropertyTypes.includes(c.id));
    const addChipsHtml = unselectedCats.map(cat => `
        <button type="button" class="filter-chip available" title="Sumar ${escapeHtml(cat.label)} a la búsqueda" onclick="togglePropertyTypeFilter('${escapeHtml(cat.id)}')">
            <span class="chip-Action">+</span>
            <span>${escapeHtml(cat.label)}</span>
        </button>
    `).join("");

    banner.style.display = "flex";
    banner.innerHTML = `
        <div class="filter-chips-row">
            <span class="filter-chip-label">Viendo:</span>
            ${activeChipsHtml}
            ${selectedPropertyTypes.length > 1 ? `<button type="button" class="filter-chip-clear" onclick="clearPropertyTypeFilters()">Limpiar todo</button>` : ""}
        </div>
        ${unselectedCats.length > 0 ? `
            <div class="filter-chips-row">
                <span class="filter-chip-label">Sumar categoría:</span>
                ${addChipsHtml}
            </div>
        ` : ""}
    `;
}

window.togglePropertyTypeFilter = function (typeId) {
    if (!typeId) return;
    const idx = selectedPropertyTypes.indexOf(typeId);
    if (idx !== -1) {
        selectedPropertyTypes.splice(idx, 1);
    } else {
        selectedPropertyTypes.push(typeId);
    }
    updateActiveTypeUI();
    applyFilters();
};

window.clearPropertyTypeFilters = function () {
    selectedPropertyTypes = [];
    updateActiveTypeUI();
    applyFilters();
};

window.filterByPropertyType = function (typeId, shouldScroll = true) {
    if (!typeId) {
        selectedPropertyTypes = [];
    } else {
        const idx = selectedPropertyTypes.indexOf(typeId);
        if (idx !== -1) {
            selectedPropertyTypes.splice(idx, 1);
        } else {
            selectedPropertyTypes.push(typeId);
        }
    }

    updateActiveTypeUI();
    applyFilters();

    if (shouldScroll && selectedPropertyTypes.length > 0) {
        const propSection = document.getElementById("propiedades");
        if (propSection) propSection.scrollIntoView({ behavior: "smooth" });
    }
};

function matchesSelectedPropertyType(prop, typeId) {
    if (!typeId) return true;
    const catObj = (window.SITE_CONFIG?.propertyCategories || []).find(c => c.id === typeId);
    const terms = catObj?.matchTypes ? catObj.matchTypes.map(t => t.toLowerCase()) : [typeId.toLowerCase()];

    const propType = String(prop.type || "").trim().toLowerCase();
    if (propType && terms.some(t => propType === t || propType.includes(t))) {
        return true;
    }

    // Fallback para propiedades del catálogo base que no tengan prop.type explícito
    if (!propType) {
        const text = `${prop.title || ""} ${prop.description || ""}`.toLowerCase();
        if (typeId === "casa" && (text.includes("casa") || text.includes("residencia"))) return true;
        if (typeId === "departamento" && (text.includes("departamento") || text.includes("penthouse"))) return true;
        return terms.some(t => text.includes(t));
    }

    return false;
}

// Featured Properties Carousel State (10 random available properties rotated every 6 hours)
const FEATURED_STORAGE_KEY = "davalos_featured_rotation_6h_10_v1";
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const FEATURED_MAX_COUNT = 10;
let featuredCarouselIndex = 0;
let featuredAutoTimer = null;
let showAllCatalogMode = false;
let lastFeaturedSlot = Math.floor(Date.now() / SIX_HOURS_MS);

function isPropertyAvailable(prop) {
    if (!prop) return false;
    if (prop.available === false) return false;
    const status = String(prop.status || "").trim().toLowerCase();
    if (status === "vendida" || status === "alquilada" || status === "no_disponible" || status === "inactiva") {
        return false;
    }
    return true;
}

function getFeaturedProperties(allProps) {
    const available = (allProps || []).filter(isPropertyAvailable);
    if (available.length === 0) return [];

    const targetCount = Math.min(FEATURED_MAX_COUNT, available.length);
    const currentSlot = Math.floor(Date.now() / SIX_HOURS_MS);
    lastFeaturedSlot = currentSlot;

    let selectedIds = [];
    try {
        const raw = localStorage.getItem(FEATURED_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.slot === currentSlot && Array.isArray(parsed.ids)) {
                selectedIds = parsed.ids.map(String);
            }
        }
    } catch (_) {
        selectedIds = [];
    }

    // Mapear los IDs guardados que sigan disponibles actualmente
    const selectedProps = [];
    const usedIds = new Set();
    selectedIds.forEach(savedId => {
        const found = available.find(p => String(p.id) === savedId);
        if (found && !usedIds.has(String(found.id))) {
            selectedProps.push(found);
            usedIds.add(String(found.id));
        }
    });

    // Si el bloque de 6 horas cambió o faltan propiedades para llegar a 5, completar al azar (Fisher-Yates)
    if (selectedProps.length < targetCount) {
        const remaining = available.filter(p => !usedIds.has(String(p.id)));
        for (let i = remaining.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = remaining[i];
            remaining[i] = remaining[j];
            remaining[j] = tmp;
        }
        while (selectedProps.length < targetCount && remaining.length > 0) {
            const nextProp = remaining.shift();
            selectedProps.push(nextProp);
            usedIds.add(String(nextProp.id));
        }

        try {
            localStorage.setItem(FEATURED_STORAGE_KEY, JSON.stringify({
                slot: currentSlot,
                updatedAt: new Date().toISOString(),
                ids: selectedProps.map(p => String(p.id))
            }));
        } catch (_) {
            // Ignorar si localStorage está bloqueado
        }
    }

    return selectedProps.slice(0, targetCount);
}

function hasActiveFilters() {
    const type = filterType ? filterType.value : "todos";
    const rooms = Number(filterRooms ? filterRooms.value : 0);
    const min = Number(filterPriceMin ? filterPriceMin.value : 0) || 0;
    const max = Number(filterPriceMax ? filterPriceMax.value : 0) || Infinity;
    const text = (searchInput ? searchInput.value : "").trim();
    return (
        type !== "todos" ||
        selectedPropertyTypes.length > 0 ||
        rooms > 0 ||
        min > 0 ||
        max !== Infinity ||
        text.length > 0
    );
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
        const matchesOperation = type === "todos" || prop.category === type;
        const matchesPropType = selectedPropertyTypes.length === 0 || selectedPropertyTypes.some(tId => matchesSelectedPropertyType(prop, tId));
        const propRooms = Number(prop.rooms || 0);
        const matchesRooms = isNaN(propRooms) ? true : propRooms >= rooms;
        const matchesPrice = prop.price >= min && (max === Infinity || prop.price <= max);
        const haystack = `${prop.title} ${prop.description} ${prop.agent} ${prop.owner}`.toLowerCase();
        const matchesText = !text || haystack.includes(text);
        return matchesOperation && matchesPropType && matchesRooms && matchesPrice && matchesText;
    });

    // Sorting
    switch (sort) {
        case "price-asc": filtered.sort((a, b) => a.price - b.price); break;
        case "price-desc": filtered.sort((a, b) => b.price - a.price); break;
        case "area-desc": filtered.sort((a, b) => (b.areaTotal || b.area || 0) - (a.areaTotal || a.area || 0)); break;
        default: filtered.sort((a, b) => b.createdAtTs - a.createdAtTs); break;
    }

    const filteringActive = hasActiveFilters();
    const carouselWrapper = document.getElementById("featured-carousel-wrapper");
    const carouselControls = document.getElementById("featured-carousel-controls");
    const btnToggleAll = document.getElementById("btn-toggle-all-props");
    const sectionTitle = document.getElementById("properties-section-title");
    const sectionSubtitle = document.getElementById("properties-section-subtitle");

    if (btnToggleAll) {
        btnToggleAll.style.display = properties.length > 0 ? "inline-flex" : "none";
        btnToggleAll.onclick = () => {
            if (filteringActive) {
                if (clearFiltersBtn) clearFiltersBtn.click();
                showAllCatalogMode = false;
            } else {
                showAllCatalogMode = !showAllCatalogMode;
                applyFilters();
            }
        };
    }

    const featuredEyebrow = document.getElementById("featured-eyebrow");

    if (!filteringActive && !showAllCatalogMode) {
        // Modo por defecto: mostrar el carrusel de 10 propiedades destacadas al azar (cada 6h)
        if (featuredEyebrow) featuredEyebrow.textContent = "● DESTACADAS";
        if (sectionTitle) sectionTitle.textContent = "Propiedades destacadas.";
        if (sectionSubtitle) sectionSubtitle.textContent = "Selección de propiedades destacadas";
        if (resultsCount) resultsCount.textContent = "";
        if (grid) grid.style.display = "none";
        if (carouselWrapper) carouselWrapper.style.display = "block";
        if (carouselControls) carouselControls.style.display = "inline-flex";
        if (btnToggleAll) btnToggleAll.textContent = `Ver todas (${properties.length})`;

        const featuredList = getFeaturedProperties(properties);
        renderFeaturedCarousel(featuredList);
    } else {
        // Modo filtrado o ver todas las propiedades
        stopFeaturedAutoSlide();
        if (featuredEyebrow) featuredEyebrow.textContent = filteringActive ? "● BÚSQUEDA" : "● CATÁLOGO";
        if (sectionTitle) sectionTitle.textContent = filteringActive ? "Resultados de búsqueda." : "Todas las propiedades.";
        if (sectionSubtitle) sectionSubtitle.textContent = filteringActive ? "Propiedades que coinciden con tus filtros seleccionados." : "Catálogo completo de propiedades disponibles.";
        if (carouselWrapper) carouselWrapper.style.display = "none";
        if (carouselControls) carouselControls.style.display = "none";
        if (grid) grid.style.display = "grid";
        if (btnToggleAll) btnToggleAll.textContent = "← Volver a destacadas";

        renderProperties(filtered);
    }

    if (window.hideLoader) window.hideLoader();
}

// Global filter helper for header links
window.filterByOperation = function (type) {
    if (filterType) {
        filterType.value = type;
        applyFilters();

        // Update active class in nav
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            const href = link.getAttribute('href');
            if (href === '#propiedades' || (type === 'venta' && href?.includes('venta')) || (type === 'alquiler' && href?.includes('alquiler'))) {
                link.classList.add('active');
            }
        });

        // Scroll to properties
        const propSection = document.getElementById('propiedades');
        if (propSection) propSection.scrollIntoView({ behavior: 'smooth' });
    }
};

function createPropertyCardElement(prop) {
    const manager = window.AuthManager;
    const canManage = manager && manager.hasPermission(manager.Permissions.EDIT_PROPERTY);

    const getFeatureVal = (namePattern) => {
        const feat = prop.customFeatures?.find(f =>
            (typeof f === 'string' && f.toLowerCase().includes(namePattern)) ||
            (f.name && f.name.toLowerCase().includes(namePattern))
        );
        if (!feat) return null;
        if (typeof feat === 'string') {
            const match = feat.match(/\d+/);
            if (match && Number(match[0]) > 0) return match[0];
            const lower = feat.toLowerCase();
            if (lower.includes('doble')) return '2';
            if (lower.includes('triple')) return '3';
            return '1';
        }
        const qty = String(feat.qty || '').trim();
        if (!qty || qty === '0' || qty === '-') return '1';
        return qty;
    };

    const isValidVal = (v) => {
        if (v === null || v === undefined) return false;
        const s = String(v).trim();
        if (!s || s === '-' || s === '0') return false;
        const n = Number(s.replace(/\./g, '').replace(/,/g, '.'));
        return isNaN(n) ? true : n > 0;
    };

    const rawRooms = (prop.rooms && Number(prop.rooms) > 0) ? prop.rooms : (getFeatureVal('dormitorio') || getFeatureVal('habitacio'));
    const rooms = isValidVal(rawRooms) ? rawRooms : null;

    const rawBaths = (prop.baths && Number(prop.baths) > 0) ? prop.baths : (getFeatureVal('baño') || getFeatureVal('toilette'));
    const baths = isValidVal(rawBaths) ? rawBaths : null;

    const rawAreaTotal = prop.areaTotal || prop.area;
    const areaTotal = isValidVal(rawAreaTotal) ? formatNumber(rawAreaTotal) : null;

    const rawAreaBuilt = prop.areaBuilt;
    const areaBuilt = isValidVal(rawAreaBuilt) ? formatNumber(rawAreaBuilt) : null;

    const rawGarage = (prop.garage && Number(prop.garage) > 0) ? prop.garage : (getFeatureVal('cochera') || getFeatureVal('garage'));
    const garage = isValidVal(rawGarage) ? rawGarage : null;

    const featureItemsHtml = [
        rooms ? `
            <div class="feat-item" title="Habitaciones">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"></path><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"></path><path d="M12 4v6"></path><path d="M2 18h20"></path></svg>
                <span>${escapeHtml(rooms)}</span>
            </div>` : '',
        baths ? `
            <div class="feat-item" title="Baños">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14h18l-2 6H6a3 3 0 0 1-3-3V5c0-2 2-3 4-3s4 1 5 3"></path><path d="M11 5l3 3"></path></svg>
                <span>${escapeHtml(baths)}</span>
            </div>` : '',
        areaTotal ? `
            <div class="feat-item" title="m² Totales / Terreno">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h18v18H3z"></path><path d="M3 9h18"></path><path d="M9 21V9"></path></svg>
                <span>${areaTotal}m²</span>
            </div>` : '',
        areaBuilt ? `
            <div class="feat-item" title="m² Construidos">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18V3H3zm13 13H8v-2h8v2zm0-4H8v-2h8v2z"></path></svg>
                <span>${areaBuilt}m²</span>
            </div>` : '',
        garage ? `
            <div class="feat-item" title="Cochera / Garage">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"></path><circle cx="7" cy="17" r="2"></circle><path d="M9 17h6"></path><circle cx="17" cy="17" r="2"></circle></svg>
                <span>${escapeHtml(garage)}</span>
            </div>` : ''
    ].filter(Boolean).join('');

    const descText = String(prop.description || "").trim();
    const shortDesc = descText.length > 70 ? `${escapeHtml(descText.substring(0, 70))}...` : escapeHtml(descText);
    const currencyLabel = prop.currency === "ARS" ? "AR$" : "U$D";
    const whatsappUrl = window.buildPropertyWhatsappUrl
        ? window.buildPropertyWhatsappUrl(prop)
        : `https://wa.me/${(window.SITE_CONFIG?.contact?.whatsapp || "5493874155902").replace(/\D/g, "")}?text=${encodeURIComponent(`Hola, quiero consultar por la propiedad: ${prop.title} (ID: ${prop.id})`)}`;

    const card = document.createElement("article");
    card.className = "property-card";
    card.innerHTML = `
        <div class="property-image-container">
            <div class="operation-badge badge-${(prop.operation || prop.category || 'venta').toLowerCase()}">${escapeHtml(prop.operation || prop.category || 'Venta')}</div>
            <img src="${prop.images && prop.images.length > 0 ? prop.images[0] : PLACEHOLDER_IMAGE}" alt="${escapeHtml(prop.title)}" class="property-image">
            <img src="${window.SITE_CONFIG?.assets?.logoSeal || 'assets/images/logo-seal.svg'}" class="property-seal" alt="Seal">
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
            <div class="property-price">${currencyLabel} ${formatPrice(prop.price)}</div>
            <h3 class="property-title">${escapeHtml(prop.title)}</h3>
            ${shortDesc ? `<p class="property-description">${shortDesc}</p>` : ""}
            <div class="property-card-footer">
                ${featureItemsHtml ? `<div class="property-features-new">${featureItemsHtml}</div>` : ""}
                <a href="${whatsappUrl}"
                   target="_blank"
                   rel="noopener noreferrer"
                   class="btn-card-whatsapp"
                   onclick="event.stopPropagation();"
                   title="Consultar por WhatsApp">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                        <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.1.824zm-3.423-14.416c-6.627 0-12 5.373-12 12 0 2.625.846 5.059 2.284 7.033l-1.494 5.462 5.602-1.469c1.908 1.132 4.132 1.787 6.516 1.787 6.627 0 12-5.373 12-12s-5.373-12-12.908-12.813z"/>
                    </svg>
                    <span>Consultar por WhatsApp</span>
                </a>
            </div>
        </div>
    `;
    card.onclick = () => {
        if (featuredSwipeJustHappened) return;
        if (window.triggerLoader) {
            window.triggerLoader(`details?id=${prop.id}`);
        } else {
            window.location.href = `details?id=${prop.id}`;
        }
    };
    return card;
}

let featuredSwipeBound = false;
let featuredSwipeJustHappened = false;
let currentFeaturedTotalItems = 0;

function getFeaturedVisibleCount() {
    if (window.innerWidth <= 640) return 1;
    if (window.innerWidth <= 992) return 2;
    return 3;
}

function getFeaturedCarouselStepPx() {
    const track = document.getElementById("featured-carousel-track");
    if (!track) return 0;
    const firstCard = track.querySelector(".property-card");
    if (!firstCard) return 0;
    const gap = 24;
    return firstCard.getBoundingClientRect().width + gap;
}

function updateFeaturedCarouselPosition() {
    const track = document.getElementById("featured-carousel-track");
    const dotsContainer = document.getElementById("featured-carousel-dots");
    if (!track) return;

    const cards = track.querySelectorAll(".property-card");
    const total = cards.length;
    if (total === 0) return;

    const visible = getFeaturedVisibleCount();
    const maxIndex = Math.max(0, total - visible);
    if (featuredCarouselIndex > maxIndex) featuredCarouselIndex = 0;
    if (featuredCarouselIndex < 0) featuredCarouselIndex = maxIndex;

    const stepPx = getFeaturedCarouselStepPx();
    track.style.transition = "";
    track.style.transform = `translate3d(-${featuredCarouselIndex * stepPx}px, 0, 0)`;

    if (dotsContainer) {
        const dots = dotsContainer.querySelectorAll(".featured-dot");
        dots.forEach((dot, idx) => {
            dot.classList.toggle("active", idx === featuredCarouselIndex);
        });
    }
}

function moveFeaturedCarouselBy(direction) {
    if (currentFeaturedTotalItems <= 0) return;
    const maxIdx = Math.max(0, currentFeaturedTotalItems - getFeaturedVisibleCount());
    if (direction > 0) {
        featuredCarouselIndex = featuredCarouselIndex >= maxIdx ? 0 : featuredCarouselIndex + 1;
    } else {
        featuredCarouselIndex = featuredCarouselIndex <= 0 ? maxIdx : featuredCarouselIndex - 1;
    }
    updateFeaturedCarouselPosition();
    startFeaturedAutoSlide(currentFeaturedTotalItems);
}

function setupFeaturedCarouselSwipe() {
    if (featuredSwipeBound) return;
    const viewport = document.getElementById("featured-carousel-viewport");
    const track = document.getElementById("featured-carousel-track");
    if (!viewport || !track) return;

    featuredSwipeBound = true;
    let touchStartX = 0;
    let touchStartY = 0;
    let deltaX = 0;
    let deltaY = 0;
    let isTracking = false;
    let isHorizontalGesture = null;

    viewport.addEventListener("touchstart", (e) => {
        if (!e.touches || e.touches.length !== 1) return;
        stopFeaturedAutoSlide();
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        deltaX = 0;
        deltaY = 0;
        isTracking = true;
        isHorizontalGesture = null;
        featuredSwipeJustHappened = false;
    }, { passive: true });

    viewport.addEventListener("touchmove", (e) => {
        if (!isTracking || !e.touches || e.touches.length !== 1) return;
        deltaX = e.touches[0].clientX - touchStartX;
        deltaY = e.touches[0].clientY - touchStartY;

        if (isHorizontalGesture === null) {
            if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
                isHorizontalGesture = Math.abs(deltaX) > Math.abs(deltaY);
            }
        }

        if (isHorizontalGesture) {
            if (e.cancelable) e.preventDefault();
            const stepPx = getFeaturedCarouselStepPx();
            const baseOffset = -featuredCarouselIndex * stepPx;
            track.style.transition = "none";
            track.style.transform = `translate3d(${baseOffset + deltaX * 0.65}px, 0, 0)`;
        }
    }, { passive: false });

    const finishTouch = () => {
        if (!isTracking) return;
        isTracking = false;
        track.style.transition = "";

        if (isHorizontalGesture && Math.abs(deltaX) > 45) {
            featuredSwipeJustHappened = true;
            setTimeout(() => {
                featuredSwipeJustHappened = false;
            }, 300);

            if (deltaX < -45) {
                moveFeaturedCarouselBy(1);
            } else if (deltaX > 45) {
                moveFeaturedCarouselBy(-1);
            }
        } else {
            updateFeaturedCarouselPosition();
            startFeaturedAutoSlide(currentFeaturedTotalItems);
        }

        deltaX = 0;
        deltaY = 0;
        isHorizontalGesture = null;
    };

    viewport.addEventListener("touchend", finishTouch, { passive: true });
    viewport.addEventListener("touchcancel", finishTouch, { passive: true });
}

function stopFeaturedAutoSlide() {
    if (featuredAutoTimer) {
        clearInterval(featuredAutoTimer);
        featuredAutoTimer = null;
    }
}

function startFeaturedAutoSlide(totalItems) {
    stopFeaturedAutoSlide();
    const visible = getFeaturedVisibleCount();
    if (totalItems <= visible) return;
    featuredAutoTimer = setInterval(() => {
        const maxIndex = Math.max(0, totalItems - getFeaturedVisibleCount());
        featuredCarouselIndex = featuredCarouselIndex >= maxIndex ? 0 : featuredCarouselIndex + 1;
        updateFeaturedCarouselPosition();
    }, 5000);
}

function renderFeaturedCarousel(featuredProps) {
    const track = document.getElementById("featured-carousel-track");
    const dotsContainer = document.getElementById("featured-carousel-dots");
    const prevBtn = document.getElementById("featured-prev");
    const nextBtn = document.getElementById("featured-next");
    const wrapper = document.getElementById("featured-carousel-wrapper");
    if (!track) return;

    track.innerHTML = "";
    if (dotsContainer) dotsContainer.innerHTML = "";

    if (!featuredProps || featuredProps.length === 0) {
        currentFeaturedTotalItems = 0;
        track.innerHTML = `<div class="no-results" style="width: 100%;"><h3>Sin propiedades disponibles</h3></div>`;
        return;
    }

    currentFeaturedTotalItems = featuredProps.length;

    featuredProps.forEach(prop => {
        track.appendChild(createPropertyCardElement(prop));
    });

    const visible = getFeaturedVisibleCount();
    const maxIndex = Math.max(0, featuredProps.length - visible);
    if (featuredCarouselIndex > maxIndex) featuredCarouselIndex = 0;

    // Renderizar dots de paginación
    const pagesCount = maxIndex + 1;
    if (dotsContainer && pagesCount > 1) {
        for (let i = 0; i < pagesCount; i++) {
            const dot = document.createElement("button");
            dot.type = "button";
            dot.className = `featured-dot ${i === featuredCarouselIndex ? "active" : ""}`;
            dot.setAttribute("aria-label", `Ir a slide ${i + 1}`);
            dot.onclick = () => {
                featuredCarouselIndex = i;
                updateFeaturedCarouselPosition();
                startFeaturedAutoSlide(featuredProps.length);
            };
            dotsContainer.appendChild(dot);
        }
    }

    if (prevBtn) {
        prevBtn.onclick = () => moveFeaturedCarouselBy(-1);
    }

    if (nextBtn) {
        nextBtn.onclick = () => moveFeaturedCarouselBy(1);
    }

    if (wrapper) {
        wrapper.onmouseenter = () => stopFeaturedAutoSlide();
        wrapper.onmouseleave = () => startFeaturedAutoSlide(featuredProps.length);
    }

    setupFeaturedCarouselSwipe();

    requestAnimationFrame(() => {
        updateFeaturedCarouselPosition();
    });
    startFeaturedAutoSlide(featuredProps.length);
}

window.addEventListener("resize", () => {
    if (!hasActiveFilters() && !showAllCatalogMode) {
        updateFeaturedCarouselPosition();
    }
});

// Verificar cada minuto si se cumplió el ciclo de 6 horas para renovar automáticamente las 5 propiedades destacadas
setInterval(() => {
    const nowSlot = Math.floor(Date.now() / SIX_HOURS_MS);
    if (nowSlot !== lastFeaturedSlot && properties.length > 0) {
        lastFeaturedSlot = nowSlot;
        if (!hasActiveFilters() && !showAllCatalogMode) {
            featuredCarouselIndex = 0;
            renderFeaturedCarousel(getFeaturedProperties(properties));
        }
    }
}, 60 * 1000);

function renderProperties(filtered) {
    grid.innerHTML = "";
    if (resultsCount) resultsCount.textContent = `${filtered.length} resultado${filtered.length === 1 ? "" : "s"}`;

    if (!filtered.length) {
        grid.innerHTML = `<div class="no-results"><h3>Sin resultados</h3><p>Intenta con otros filtros.</p></div>`;
        return;
    }

    filtered.forEach(prop => {
        grid.appendChild(createPropertyCardElement(prop));
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

    const configAgents = Array.isArray(window.SITE_CONFIG?.agents) ? window.SITE_CONFIG.agents : [];
    const users = (window.AuthManager && typeof window.AuthManager.getAllUsersSync === "function")
        ? (window.AuthManager.getAllUsersSync() || [])
        : [];

    agentSelect.innerHTML = '<option value="">Seleccionar agente...</option>';

    const addedIds = new Set();

    // 1. Listar agentes centralizados en config.js
    configAgents.forEach(agent => {
        if (!agent || !agent.id) return;
        const opt = document.createElement("option");
        opt.value = agent.id;
        opt.textContent = agent.name;
        agentSelect.appendChild(opt);
        addedIds.add(String(agent.id).toLowerCase());
        addedIds.add(String(agent.name || "").toLowerCase());
        if (Array.isArray(agent.aliases)) {
            agent.aliases.forEach(al => addedIds.add(String(al).toLowerCase()));
        }
    });

    // 2. Agregar usuarios adicionales de AuthManager que no estén en SITE_CONFIG.agents
    users.forEach(user => {
        const uKey = String(user.username || "").toLowerCase();
        const dKey = String(user.displayName || "").toLowerCase();
        if (addedIds.has(uKey) || addedIds.has(dKey)) return;
        const opt = document.createElement("option");
        opt.value = user.username || user.displayName;
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

    const resolvedAgent = window.getPropertyAgent ? window.getPropertyAgent(prop) : null;
    const agentSelect = document.getElementById("prop-agent");
    if (agentSelect) {
        const candidateId = prop.agentId || (resolvedAgent && resolvedAgent.id !== "agente-default" ? resolvedAgent.id : "") || prop.agent || "";
        agentSelect.value = candidateId;
    }
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
    [filterType, filterRooms, sortBy].forEach(el => el && el.addEventListener("change", applyFilters));
    [filterPriceMin, filterPriceMax, searchInput].forEach(el => el && el.addEventListener("input", applyFilters));

    if (filterPropType) {
        filterPropType.addEventListener("change", () => {
            const val = filterPropType.value;
            selectedPropertyTypes = (val && val !== "todos") ? [val] : [];
            updateActiveTypeUI();
            applyFilters();
        });
    }

    if (btnHeroSearch) {
        btnHeroSearch.onclick = () => {
            applyFilters();
            const propSection = document.getElementById("propiedades");
            if (propSection) propSection.scrollIntoView({ behavior: "smooth" });
        };
    }

    if (clearFiltersBtn) clearFiltersBtn.onclick = () => {
        if (filterPropType) filterPropType.value = "todos";
        filterType.value = "todos"; filterRooms.value = "0";
        filterPriceMin.value = ""; filterPriceMax.value = "";
        searchInput.value = "";
        selectedPropertyTypes = [];
        updateActiveTypeUI();

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

    const pwForm = document.getElementById("pw-form");
    if (pwForm) {
        pwForm.onsubmit = async (e) => {
            e.preventDefault();
            const newPasswordInput = document.getElementById("new-password");
            const newPassword = newPasswordInput.value;
            
            const submitBtn = pwForm.querySelector('button[type="submit"]');
            const originalText = submitBtn ? submitBtn.textContent : "Guardar nueva contraseña";
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = "Guardando...";
            }

            try {
                const result = await window.AuthManager.changePassword(newPassword);
                if (result && result.success) {
                    if (result.mode === "firestore") {
                        alert("Contraseña actualizada con éxito en la base de datos (Nube).");
                    } else if (result.mode === "core" || result.mode === "local") {
                        alert("Contraseña actualizada con éxito en el almacenamiento local de este navegador.");
                    } else if (result.mode === "local_fallback") {
                        alert("La contraseña se guardó localmente porque no se pudo conectar con la base de datos en la nube.");
                    } else {
                        alert("Contraseña actualizada con éxito.");
                    }
                    newPasswordInput.value = "";
                    document.getElementById("change-password-form").style.display = "none";
                } else {
                    const reason = result ? result.reason : "";
                    if (reason === "invalid_password") {
                        alert("Error: La contraseña debe tener al menos 6 caracteres.");
                    } else {
                        alert("Error al cambiar la contraseña: " + (result?.error || "Inténtalo de nuevo."));
                    }
                }
            } catch (err) {
                console.error("Error al cambiar la contraseña:", err);
                alert("Ocurrió un error inesperado al intentar cambiar la contraseña.");
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                }
            }
        };
    }

    // Inicializar visualización de contraseña (ojito)
    document.querySelectorAll(".toggle-password").forEach(btn => {
        btn.onclick = function() {
            const input = this.previousElementSibling;
            const eyeOpen = this.querySelector(".eye-open");
            const eyeClosed = this.querySelector(".eye-closed");
            
            if (input.type === "password") {
                input.type = "text";
                if (eyeOpen) eyeOpen.style.display = "none";
                if (eyeClosed) eyeClosed.style.display = "block";
            } else {
                input.type = "password";
                if (eyeOpen) eyeOpen.style.display = "block";
                if (eyeClosed) eyeClosed.style.display = "none";
            }
        };
    });
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
    if (btnLogout) btnLogout.onclick = () => { window.AuthManager.logout(); updateAuthUI(); applyFilters(); };
    closeBtns.forEach(btn => btn.onclick = closeModal);

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
            if (success) { closeModal(); updateAuthUI(); applyFilters(); }
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
                const selectedAgentVal = document.getElementById("prop-agent").value;
                const resolvedAgent = window.getPropertyAgent
                    ? window.getPropertyAgent({ agentId: selectedAgentVal, agent: selectedAgentVal })
                    : null;
                const agentId = selectedAgentVal || "";
                const agentName = (resolvedAgent && selectedAgentVal) ? resolvedAgent.name : selectedAgentVal;

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
                    agentId: agentId,
                    agent: agentName,
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

                if (window.showLoader) window.showLoader();

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
                
                if (window.hideLoader) window.hideLoader();

                alert(currentEditingId ? "Propiedad actualizada con éxito" : "Propiedad publicada con éxito");
                currentEditingId = null;
            } catch (err) {
                if (window.hideLoader) window.hideLoader();
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
                <div style="display: flex; gap: 8px;">
                    ${u.username !== "admin" ? `
                        <button class="btn btn-outline btn-small" style="color: #3498db; border-color: #3498db;" onclick="handleStartEditUser('${u.username}')">Editar</button>
                    ` : ""}
                    ${!isProtected ? `
                        <button class="btn btn-outline btn-small" style="color: #e74c3c; border-color: #e74c3c;" onclick="handleRemoveUser('${u.username}')">Eliminar</button>
                    ` : ""}
                </div>
            </div>
        `;
    }).join("");
}
window.renderUserList = renderUserList;

async function handleStartEditUser(username) {
    const manager = window.AuthManager;
    const users = await manager.getAllUsers();
    const user = users.find(u => u.username === username);
    if (!user) return;

    currentEditingUsername = username;

    // Poblar el formulario
    document.getElementById("new-username").value = user.username;
    document.getElementById("new-username").disabled = true; // No permitir cambiar el identificador
    document.getElementById("new-displayname").value = user.displayName || "";
    document.getElementById("new-firstname").value = user.firstName || "";
    document.getElementById("new-lastname").value = user.lastName || "";
    document.getElementById("new-phone").value = user.phone || "";
    
    // Configurar campo contraseña
    const passwordInput = document.getElementById("new-user-password");
    passwordInput.value = ""; 
    passwordInput.required = false; // Permitir guardar cambios sin modificar la contraseña
    passwordInput.placeholder = "Dejar en blanco para mantener la misma";

    const lblPassword = document.getElementById("lbl-new-user-password");
    if (lblPassword) {
        lblPassword.innerHTML = 'Nueva contraseña <span style="font-weight: 300; color: #777;">(opcional)</span>';
    }

    document.getElementById("new-role").value = user.role || "ADMIN";

    // Modificar título del formulario
    const formTitle = document.getElementById("user-form-title");
    if (formTitle) formTitle.textContent = `Modificar usuario: ${user.username}`;

    // Modificar interfaz del formulario
    const form = document.getElementById("add-user-form");
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.textContent = "Guardar Cambios";

    // Añadir botón de cancelar si no existe
    let cancelBtn = document.getElementById("btn-cancel-edit-user");
    if (!cancelBtn) {
        cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.id = "btn-cancel-edit-user";
        cancelBtn.className = "btn btn-outline btn-full";
        cancelBtn.style.marginTop = "8px";
        cancelBtn.textContent = "Cancelar Edición";
        cancelBtn.onclick = handleCancelEditUser;
        submitBtn.parentNode.insertBefore(cancelBtn, submitBtn.nextSibling);
    }
}

function handleCancelEditUser() {
    currentEditingUsername = null;
    
    // Resetear formulario
    const form = document.getElementById("add-user-form");
    form.reset();
    
    const passwordInput = document.getElementById("new-user-password");
    passwordInput.disabled = false;
    passwordInput.required = true; // Volver a requerir contraseña para nuevos registros
    passwordInput.placeholder = "Contraseña para iniciar sesión";

    const lblPassword = document.getElementById("lbl-new-user-password");
    if (lblPassword) lblPassword.textContent = "Contraseña de acceso";

    const formTitle = document.getElementById("user-form-title");
    if (formTitle) formTitle.textContent = "Crear nuevo usuario";

    document.getElementById("new-username").disabled = false;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.textContent = "Crear Usuario";

    // Eliminar botón cancelar
    const cancelBtn = document.getElementById("btn-cancel-edit-user");
    if (cancelBtn) cancelBtn.remove();
}

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

    if (currentEditingUsername !== null) {
        // Modo Edición
        const result = await manager.updateUser(currentEditingUsername, userData);
        if (result.success) {
            handleCancelEditUser();
            await renderUserList();
            if (result.mode === "firestore") {
                alert("Usuario actualizado con éxito en la base de datos en la nube.");
            } else if (result.mode === "local" || result.mode === "core") {
                alert("Usuario actualizado con éxito en el almacenamiento local del navegador.");
            }
        } else {
            if (result.reason === "permission") {
                alert("Error: No tienes permisos de administrador para modificar usuarios.");
            } else {
                alert(`Error al actualizar el usuario: ${result.error || 'Error desconocido'}`);
            }
        }
    } else {
        // Modo Creación
        const result = await manager.addUser(userData);
        if (result.success) {
            e.target.reset();
            await renderUserList();
            if (result.mode === "firestore") {
                alert("Usuario creado con éxito en la base de datos en la nube.");
            } else if (result.mode === "local") {
                alert(`Usuario creado y guardado localmente en este navegador.\n\n(Nota: La base de datos en la nube no aceptó la escritura directa debido a permisos o conexión, pero podrás iniciar sesión normalmente en este equipo).`);
            }
        } else {
            if (result.reason === "duplicate") {
                alert("Error: El nombre de usuario ya está registrado.");
            } else if (result.reason === "permission") {
                alert("Error: No tienes permisos de administrador para agregar usuarios.");
            } else {
                alert(`Error al crear el usuario: ${result.error || 'Error desconocido'}`);
            }
        }
    }
}

async function handleRemoveUser(username) {
    if (!confirm(`¿Estás seguro de que deseas eliminar al usuario "${username}"? Esta acción no se puede deshacer.`)) return;
    const result = await window.AuthManager.removeUser(username);
    if (result.success) {
        await renderUserList();
        if (result.mode === "firestore") {
            alert("Usuario eliminado correctamente de la base de datos en la nube.");
        } else if (result.mode === "local") {
            alert("Usuario local eliminado correctamente de este navegador.");
        } else {
            alert("Usuario eliminado correctamente.");
        }
    } else {
        if (result.reason === "protected") {
            alert("Error: No se puede eliminar la cuenta de administrador principal.");
        } else if (result.reason === "self") {
            alert("Error: No puedes eliminar tu propia cuenta de usuario activa.");
        } else if (result.reason === "permission") {
            alert("Error: No tienes permisos de administrador para eliminar usuarios.");
        } else {
            alert("Error: No se pudo eliminar al usuario.");
        }
    }
}
window.handleRemoveUser = handleRemoveUser;

async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const typeParam = urlParams.get('type');
    if (typeParam) {
        selectedPropertyTypes = typeParam
            .split(',')
            .map(t => t.trim().toLowerCase())
            .filter(Boolean);
        // Limpiar el parámetro de la URL para que al refrescar (F5) la página inicie limpia sin filtros pegados
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('type');
        window.history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.search);
    }

    renderPropertyCategories();
    updateActiveTypeUI();

    if (window.AuthManager && window.AuthManager._readyPromise) {
        await window.AuthManager._readyPromise;
    }
    // Initial load
    await loadProperties();
    updateAuthUI();
    bindEvents();
    initNavigation();

    document.getElementById("add-user-form")?.addEventListener("submit", handleAddUser);

    if (selectedPropertyTypes.length > 0) {
        const propSection = document.getElementById("propiedades");
        if (propSection) propSection.scrollIntoView({ behavior: "smooth" });
    }

    // Check for edit parameter to auto-open modal from details page
    const editId = urlParams.get('edit');
    if (editId) {
        const numId = Number(editId);
        const prop = properties.find(p => p.id === numId || String(p.id) === editId);
        if (prop && window.AuthManager && window.AuthManager.hasPermission(window.AuthManager.Permissions.EDIT_PROPERTY)) {
            openEditModal(prop.id);
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
}

/**
 * Navigation & Active State Management (ScrollSpy)
 */
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = [
        { id: 'inicio', element: document.querySelector('.header') }, 
        { id: 'propiedades', element: document.getElementById('propiedades') },
        { id: 'nosotros', element: document.getElementById('nosotros') },
        { id: 'contacto', element: document.getElementById('contacto') }
    ];

    const updateActive = (id) => {
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            // Avoid removing active from special buttons like login/logout/publish
            if (link.id && link.id.startsWith('btn-')) return;
            
            link.classList.remove('active');
            if (id === 'inicio' && (href === 'index.html' || href === 'index.html#')) {
                link.classList.add('active');
            } else if (href === '#' + id) {
                link.classList.add('active');
            }
        });
    };

    // Intersection Observer for ScrollSpy
    const observerOptions = {
        root: null,
        rootMargin: '-40% 0px -40% 0px',
        threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.id || (entry.target.classList.contains('header') ? 'inicio' : '');
                if (id) updateActive(id);
            }
        });
    }, observerOptions);

    sections.forEach(sec => {
        if (sec.element) {
            observer.observe(sec.element);
        }
    });

    // Manual click handling
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            if (this.id && this.id.startsWith('btn-')) return;
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

init();
