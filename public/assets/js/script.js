const DATA_URL = "data/properties.json";
const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80";

const grid = document.getElementById("properties-grid");
const resultsCount = document.getElementById("results-count");
const filterType = document.getElementById("filter-type");
const filterRooms = document.getElementById("filter-rooms");
const filterPriceMin = document.getElementById("filter-price-min");
const filterPriceMax = document.getElementById("filter-price-max");
const searchInput = document.getElementById("search-input");
const sortBy = document.getElementById("sort-by");
const clearFiltersBtn = document.getElementById("clear-filters");

let properties = [];

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
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith("/")) return trimmed;
    return null;
}

function normalizeProperty(prop) {
    if (!prop || typeof prop !== "object") return null;

    const id = Number(prop.id);
    const title = String(prop.title || "").trim();
    const description = String(prop.description || "").trim();
    const category = prop.category === "alquiler" ? "alquiler" : "venta";
    const price = Number(prop.price);
    const rooms = Number(prop.rooms);
    const area = Number(prop.area);
    const owner = String(prop.owner || "").trim();
    const agent = String(prop.agent || "").trim();
    const createdAt = String(prop.createdAt || "").trim();

    const customFeatures = Array.isArray(prop.customFeatures)
        ? prop.customFeatures.map((item) => String(item).trim()).filter(Boolean)
        : [];

    const images = (Array.isArray(prop.images) ? prop.images : [])
        .map((img) => safeImageUrl(img))
        .filter(Boolean);

    if (!Number.isFinite(id) || !title || !Number.isFinite(price) || !Number.isFinite(rooms) || !Number.isFinite(area)) {
        return null;
    }

    return {
        id,
        title,
        description,
        category,
        price,
        rooms,
        area,
        owner,
        agent,
        createdAt,
        createdAtTs: Date.parse(createdAt) || id,
        customFeatures,
        images: images.length ? images : [PLACEHOLDER_IMAGE]
    };
}

async function loadProperties() {
    try {
        const response = await fetch(DATA_URL, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const payload = await response.json();
        const list = Array.isArray(payload?.properties) ? payload.properties : [];

        properties = list
            .map((item) => normalizeProperty(item))
            .filter(Boolean)
            .sort((a, b) => b.createdAtTs - a.createdAtTs);

        applyFilters();
    } catch (error) {
        grid.innerHTML = `
            <div class="no-results">
                <h3>Error de carga</h3>
                <p>No se pudieron cargar las propiedades.</p>
            </div>
        `;
        if (resultsCount) resultsCount.textContent = "0 resultados";
        console.error("Error loading properties:", error);
    }
}

function getFilters() {
    const min = Number(filterPriceMin.value);
    const max = Number(filterPriceMax.value);

    return {
        type: filterType.value,
        rooms: Number(filterRooms.value || 0),
        minPrice: Number.isFinite(min) ? min : 0,
        maxPrice: Number.isFinite(max) && max > 0 ? max : Infinity,
        text: (searchInput.value || "").trim().toLowerCase(),
        sort: sortBy.value
    };
}

function formatCurrency(value) {
    return `USD ${value.toLocaleString("es-AR")}`;
}

function applyFilters() {
    const filters = getFilters();

    let filtered = properties.filter((prop) => {
        const matchesType = filters.type === "todos" || prop.category === filters.type;
        const matchesRooms = prop.rooms >= filters.rooms;
        const matchesMin = prop.price >= filters.minPrice;
        const matchesMax = prop.price <= filters.maxPrice;

        const haystack = `${prop.title} ${prop.description} ${prop.agent} ${prop.owner}`.toLowerCase();
        const matchesText = !filters.text || haystack.includes(filters.text);

        return matchesType && matchesRooms && matchesMin && matchesMax && matchesText;
    });

    switch (filters.sort) {
        case "price-asc":
            filtered.sort((a, b) => a.price - b.price);
            break;
        case "price-desc":
            filtered.sort((a, b) => b.price - a.price);
            break;
        case "area-desc":
            filtered.sort((a, b) => b.area - a.area);
            break;
        default:
            filtered.sort((a, b) => b.createdAtTs - a.createdAtTs);
            break;
    }

    renderProperties(filtered);
}

function renderProperties(filtered) {
    grid.innerHTML = "";

    if (resultsCount) {
        resultsCount.textContent = `${filtered.length} resultado${filtered.length === 1 ? "" : "s"}`;
    }

    if (!filtered.length) {
        grid.innerHTML = `
            <div class="no-results">
                <h3>Sin resultados</h3>
                <p>No encontramos propiedades con esos filtros.</p>
                <button id="retry-filters" class="btn btn-outline" type="button">Limpiar filtros</button>
            </div>
        `;
        const retryBtn = document.getElementById("retry-filters");
        if (retryBtn) retryBtn.addEventListener("click", resetFilters);
        return;
    }

    filtered.forEach((prop) => {
        const card = document.createElement("article");
        card.className = "property-card";
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.setAttribute("aria-label", `Ver detalles de ${prop.title}`);

        const coverImage = prop.images[0] || PLACEHOLDER_IMAGE;
        const title = escapeHtml(prop.title);
        const description = escapeHtml(prop.description || "");
        const badge = escapeHtml(prop.category);

        card.innerHTML = `
            <div class="property-image">
                <img loading="lazy" src="${coverImage}" alt="${title}">
                <span class="badge badge-${badge}">${badge}</span>
                ${prop.images.length > 1 ? `<span class="gallery-badge">${prop.images.length} fotos</span>` : ""}
            </div>
            <div class="property-info">
                <div class="property-price">${formatCurrency(prop.price)}</div>
                <h3 class="property-title">${title}</h3>
                <p class="property-description">${description}</p>
                <div class="property-features">
                    <div class="feature"><span>Amb.</span> ${prop.rooms}</div>
                    <div class="feature"><span>m2</span> ${prop.area}</div>
                </div>
            </div>
        `;

        const openDetails = () => {
            window.location.href = `details.html?id=${encodeURIComponent(prop.id)}`;
        };

        card.addEventListener("click", openDetails);
        card.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openDetails();
            }
        });

        grid.appendChild(card);
    });
}

function resetFilters() {
    filterType.value = "todos";
    filterRooms.value = "0";
    filterPriceMin.value = "";
    filterPriceMax.value = "";
    searchInput.value = "";
    sortBy.value = "recent";
    applyFilters();
}

function debounce(fn, wait = 250) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), wait);
    };
}

function bindEvents() {
    filterType.addEventListener("change", applyFilters);
    filterRooms.addEventListener("change", applyFilters);
    filterPriceMin.addEventListener("input", debounce(applyFilters));
    filterPriceMax.addEventListener("input", debounce(applyFilters));
    sortBy.addEventListener("change", applyFilters);
    searchInput.addEventListener("input", debounce(applyFilters, 180));
    clearFiltersBtn.addEventListener("click", resetFilters);
}

function renderSkeletons() {
    grid.innerHTML = "";
    for (let i = 0; i < 6; i += 1) {
        const card = document.createElement("article");
        card.className = "property-card skeleton-card";
        card.innerHTML = `
            <div class="skeleton skeleton-image"></div>
            <div class="property-info">
                <div class="skeleton skeleton-line"></div>
                <div class="skeleton skeleton-line short"></div>
                <div class="skeleton skeleton-line"></div>
            </div>
        `;
        grid.appendChild(card);
    }
}

function init() {
    renderSkeletons();
    bindEvents();
    loadProperties();
}

init();
