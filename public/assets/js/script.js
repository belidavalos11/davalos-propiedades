const initialProperties = [
    {
        id: 1,
        title: "Residencia Colonial en Zona Norte",
        price: 450000,
        category: "venta",
        rooms: 5,
        area: 320,
        images: ["https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=800&q=80"],
        owner: "Juan Perez",
        agent: "Admin",
        createdAt: "2026-01-10T10:00:00.000Z"
    },
    {
        id: 2,
        title: "Penthouse de Lujo con Vista al Rio",
        price: 1200,
        category: "alquiler",
        rooms: 3,
        area: 110,
        images: ["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80"],
        owner: "Maria Garcia",
        agent: "Admin",
        createdAt: "2026-01-15T10:00:00.000Z"
    },
    {
        id: 3,
        title: "Casa Moderna con Piscina",
        price: 280000,
        category: "venta",
        rooms: 4,
        area: 180,
        images: ["https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80"],
        owner: "Roberto Sanchez",
        agent: "Belid",
        createdAt: "2026-01-20T10:00:00.000Z"
    },
    {
        id: 4,
        title: "Loft Industrial Soho",
        price: 850,
        category: "alquiler",
        rooms: 1,
        area: 55,
        images: ["https://images.unsplash.com/photo-1505691938895-1758d7eaa511?auto=format&fit=crop&w=800&q=80"],
        owner: "Carlos Lopez",
        agent: "Belid",
        createdAt: "2026-01-25T10:00:00.000Z"
    }
];

const LS_KEY = "davalos_properties";
const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80";

let properties = loadProperties();
let currentLocalImages = [];

const grid = document.getElementById("properties-grid");
const resultsCount = document.getElementById("results-count");
const filterType = document.getElementById("filter-type");
const filterRooms = document.getElementById("filter-rooms");
const filterPriceMin = document.getElementById("filter-price-min");
const filterPriceMax = document.getElementById("filter-price-max");
const searchInput = document.getElementById("search-input");
const sortBy = document.getElementById("sort-by");
const clearFiltersBtn = document.getElementById("clear-filters");

const propertyForm = document.getElementById("property-form");
const btnAddProperty = document.getElementById("btn-add-property");
const modal = document.getElementById("property-modal");
const closeModal = document.getElementById("close-modal");
const customFeaturesContainer = document.getElementById("custom-features-container");
const btnAddFeature = document.getElementById("btn-add-feature");
const localImagesInput = document.getElementById("local-images");
const imagePreviews = document.getElementById("image-previews");

const btnLogin = document.getElementById("btn-login");
const btnLogout = document.getElementById("btn-logout");
const btnSettings = document.getElementById("btn-settings");
const loginModal = document.getElementById("login-modal");
const closeLoginModal = document.getElementById("close-login-modal");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");

const settingsModal = document.getElementById("settings-modal");
const closeSettingsModal = document.getElementById("close-settings-modal");
const settingsForm = document.getElementById("settings-form");
const settingsError = document.getElementById("settings-error");
const settingsSuccess = document.getElementById("settings-success");

function loadProperties() {
    const stored = JSON.parse(localStorage.getItem(LS_KEY));
    const source = Array.isArray(stored) && stored.length ? stored : initialProperties;

    return source
        .map((prop) => normalizeProperty(prop))
        .filter(Boolean)
        .sort((a, b) => b.createdAtTs - a.createdAtTs);
}

function normalizeProperty(prop) {
    if (!prop || typeof prop !== "object") return null;

    const id = Number(prop.id);
    if (!Number.isFinite(id)) return null;

    const title = String(prop.title || "").trim();
    const category = prop.category === "alquiler" ? "alquiler" : "venta";
    const price = Number(prop.price);
    const rooms = Number(prop.rooms);
    const area = Number(prop.area);
    const owner = String(prop.owner || "").trim();
    const agent = String(prop.agent || "").trim();
    const customFeatures = Array.isArray(prop.customFeatures) ? prop.customFeatures.map((f) => String(f).trim()).filter(Boolean) : [];

    const rawImages = Array.isArray(prop.images)
        ? prop.images
        : (prop.image ? [prop.image] : []);

    const images = rawImages
        .map((img) => safeImageUrl(img))
        .filter(Boolean);

    const createdAt = prop.createdAt || new Date(id).toISOString();
    const createdAtTs = Date.parse(createdAt) || id;

    if (!title || !Number.isFinite(price) || !Number.isFinite(rooms) || !Number.isFinite(area)) return null;

    return {
        id,
        title,
        category,
        price,
        rooms,
        area,
        owner,
        agent,
        images: images.length ? images : [PLACEHOLDER_IMAGE],
        customFeatures,
        createdAt,
        createdAtTs
    };
}

function safeImageUrl(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("data:image/")) return trimmed;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return null;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatCurrency(value) {
    return `USD ${value.toLocaleString("es-AR")}`;
}

function saveToLocalStorage() {
    localStorage.setItem(LS_KEY, JSON.stringify(properties));
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

function applyFilters() {
    const filters = getFilters();

    let filtered = properties.filter((prop) => {
        const matchesType = filters.type === "todos" || prop.category === filters.type;
        const matchesRooms = prop.rooms >= filters.rooms;
        const matchesMin = prop.price >= filters.minPrice;
        const matchesMax = prop.price <= filters.maxPrice;

        const haystack = `${prop.title} ${prop.owner} ${prop.agent}`.toLowerCase();
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
        const badge = escapeHtml(prop.category);
        const agent = escapeHtml(prop.agent || "Sin asignar");

        card.innerHTML = `
            <div class="property-image">
                <img loading="lazy" src="${coverImage}" alt="${title}">
                <span class="badge badge-${badge}">${badge}</span>
                ${prop.images.length > 1 ? `<span class="gallery-badge">${prop.images.length} fotos</span>` : ""}
            </div>
            <div class="property-info">
                <div class="property-price">${formatCurrency(prop.price)}</div>
                <h3 class="property-title">${title}</h3>
                <div class="property-features">
                    <div class="feature"><span>Amb.</span> ${prop.rooms}</div>
                    <div class="feature"><span>m2</span> ${prop.area}</div>
                </div>
                ${AuthManager.isLoggedIn() ? `<div class="property-agent"><span>Encargado:</span> ${agent}</div>` : ""}
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

function updateAuthUI() {
    const logged = AuthManager.isLoggedIn();
    btnLogin.style.display = logged ? "none" : "block";
    btnLogout.style.display = logged ? "block" : "none";
    btnSettings.style.display = logged ? "block" : "none";
    btnAddProperty.style.display = logged ? "block" : "none";
    applyFilters();
}

async function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const MAX_WIDTH = 1200;
                const MAX_HEIGHT = 900;
                let width = img.width;
                let height = img.height;

                if (width > height && width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
                if (height >= width && height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }

                canvas.width = width;
                canvas.height = height;
                canvas.getContext("2d").drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL("image/jpeg", 0.72));
            };
        };
    });
}

function updatePreviews() {
    imagePreviews.innerHTML = "";
    currentLocalImages.forEach((base64, index) => {
        const thumb = document.createElement("div");
        thumb.className = "preview-thumbnail";
        thumb.innerHTML = `
            <img loading="lazy" src="${base64}" alt="Vista previa ${index + 1}">
            <button type="button" class="btn-remove-preview" data-index="${index}">&times;</button>
        `;

        const removeBtn = thumb.querySelector(".btn-remove-preview");
        removeBtn.addEventListener("click", () => {
            currentLocalImages.splice(index, 1);
            updatePreviews();
        });

        imagePreviews.appendChild(thumb);
    });
}

function addFeatureInput(value = "") {
    const group = document.createElement("div");
    group.className = "feature-input-group";
    group.innerHTML = `
        <input type="text" placeholder="Ej: Piscina, quincho..." class="custom-feature-input" value="${escapeHtml(value)}">
        <button type="button" class="btn-remove-feature">&times;</button>
    `;

    group.querySelector(".btn-remove-feature").addEventListener("click", () => group.remove());
    customFeaturesContainer.appendChild(group);
}

function readCustomFeatures() {
    return Array.from(document.querySelectorAll(".custom-feature-input"))
        .map((input) => input.value.trim())
        .filter(Boolean);
}

function bindEvents() {
    filterType.addEventListener("change", applyFilters);
    filterRooms.addEventListener("change", applyFilters);
    filterPriceMin.addEventListener("input", debounce(applyFilters));
    filterPriceMax.addEventListener("input", debounce(applyFilters));
    sortBy.addEventListener("change", applyFilters);
    searchInput.addEventListener("input", debounce(applyFilters, 180));
    clearFiltersBtn.addEventListener("click", resetFilters);

    btnAddProperty.addEventListener("click", () => {
        modal.style.display = "block";
    });

    closeModal.addEventListener("click", () => {
        modal.style.display = "none";
    });

    btnLogin.addEventListener("click", () => {
        loginModal.style.display = "block";
    });

    btnLogout.addEventListener("click", () => {
        AuthManager.logout();
        updateAuthUI();
    });

    closeLoginModal.addEventListener("click", () => {
        loginModal.style.display = "none";
    });

    btnSettings.addEventListener("click", () => {
        settingsModal.style.display = "block";
    });

    closeSettingsModal.addEventListener("click", () => {
        settingsModal.style.display = "none";
        settingsError.style.display = "none";
        settingsSuccess.style.display = "none";
        settingsForm.reset();
    });

    window.addEventListener("click", (event) => {
        if (event.target === modal) modal.style.display = "none";
        if (event.target === loginModal) loginModal.style.display = "none";
        if (event.target === settingsModal) settingsModal.style.display = "none";
    });

    loginForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const user = document.getElementById("username").value.trim();
        const pass = document.getElementById("password").value;

        if (AuthManager.login(user, pass)) {
            loginForm.reset();
            loginModal.style.display = "none";
            loginError.style.display = "none";
            updateAuthUI();
            return;
        }
        loginError.style.display = "block";
    });

    settingsForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const newPass = document.getElementById("new-password").value;
        const confirmPass = document.getElementById("confirm-password").value;

        if (!newPass || newPass.length < 6) {
            settingsError.textContent = "La contrasena debe tener al menos 6 caracteres.";
            settingsError.style.display = "block";
            settingsSuccess.style.display = "none";
            return;
        }

        if (newPass !== confirmPass) {
            settingsError.textContent = "Las contrasenas no coinciden.";
            settingsError.style.display = "block";
            settingsSuccess.style.display = "none";
            return;
        }

        if (AuthManager.changePassword(newPass)) {
            settingsError.style.display = "none";
            settingsSuccess.style.display = "block";
            setTimeout(() => {
                settingsModal.style.display = "none";
                settingsSuccess.style.display = "none";
                settingsForm.reset();
            }, 1200);
        }
    });

    localImagesInput.addEventListener("change", async (event) => {
        const files = Array.from(event.target.files || []);
        for (const file of files) {
            if (file.type.startsWith("image/")) {
                const compressed = await compressImage(file);
                currentLocalImages.push(compressed);
            }
        }
        updatePreviews();
        localImagesInput.value = "";
    });

    btnAddFeature.addEventListener("click", () => addFeatureInput());

    propertyForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const urlInput = document.getElementById("image").value;
        const imageUrls = urlInput
            ? urlInput.split(",").map((url) => safeImageUrl(url)).filter(Boolean)
            : [];

        const finalImages = [...imageUrls, ...currentLocalImages].filter(Boolean);
        if (!finalImages.length) {
            alert("Agrega al menos una imagen valida (URL o archivo local).");
            return;
        }

        const newProp = normalizeProperty({
            id: Date.now(),
            title: document.getElementById("title").value,
            price: Number(document.getElementById("price").value),
            category: document.getElementById("category").value,
            rooms: Number(document.getElementById("rooms").value),
            area: Number(document.getElementById("area").value),
            owner: document.getElementById("owner").value,
            agent: document.getElementById("agent").value,
            images: finalImages,
            customFeatures: readCustomFeatures(),
            createdAt: new Date().toISOString()
        });

        if (!newProp) {
            alert("No se pudo guardar la propiedad. Revisa los campos requeridos.");
            return;
        }

        properties.unshift(newProp);
        saveToLocalStorage();
        applyFilters();

        propertyForm.reset();
        currentLocalImages = [];
        customFeaturesContainer.innerHTML = "";
        updatePreviews();
        modal.style.display = "none";
    });
}

function init() {
    renderSkeletons();
    bindEvents();
    updateAuthUI();
    setTimeout(applyFilters, 300);
}

init();
