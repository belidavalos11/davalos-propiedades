const DATA_URL = window.SITE_CONFIG?.data?.catalogUrl || "data/properties.json";
const PLACEHOLDER_IMAGE = window.SITE_CONFIG?.assets?.placeholderImage || "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80";
const WHATSAPP_NUMBER = window.SITE_CONFIG?.contact?.whatsapp || "5493874155902";
const PHONE_NUMBER = window.SITE_CONFIG?.contact?.phone || "+543874155902";

// DOM Elements
const container = document.getElementById("details-container");
const floatingContact = document.getElementById("floating-contact");
const floatingWhatsapp = document.getElementById("floating-whatsapp");
const floatingCall = document.getElementById("floating-call");
const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightbox-image");
const lightboxClose = document.getElementById("lightbox-close");
const lightboxPrev = document.getElementById("lightbox-prev");
const lightboxNext = document.getElementById("lightbox-next");

let currentSlide = 0;
let currentLightboxImages = [];
let currentLightboxIndex = 0;
let currentProperty = null;

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

function normalizeProperty(prop) {
    if (!prop || typeof prop !== "object") return null;
    const id = prop.id;
    const title = String(prop.title || "").trim();
    const operation = String(prop.operation || prop.category || "venta").trim().toLowerCase();
    const type = String(prop.type || "").trim().toLowerCase();
    const price = Number(prop.price) || 0;
    const currency = String(prop.currency || "USD").trim().toUpperCase();
    const location = String(prop.location || window.SITE_CONFIG?.contact?.city || "Salta").trim();

    const featObj = (prop.features && typeof prop.features === "object" && !Array.isArray(prop.features)) ? prop.features : {};
    const rooms = Number(featObj.rooms ?? prop.rooms) || null;
    const baths = Number(featObj.baths ?? prop.baths) || null;
    const areaTotal = Number(featObj.areaTotal ?? prop.areaTotal ?? prop.area) || null;
    const areaBuilt = Number(featObj.areaBuilt ?? prop.areaBuilt) || null;
    const garage = Number(featObj.garage ?? prop.garage) || null;

    const images = (Array.isArray(prop.images) ? prop.images : [])
        .map((img) => safeImageUrl(img))
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
        images: images.length ? images : [PLACEHOLDER_IMAGE]
    };
}

function getSafePropertyId() {
    const raw = new URLSearchParams(window.location.search).get("id");
    if (!raw) return null;
    // Try to return as number if it looks like one, otherwise return as string
    const num = Number(raw);
    return isNaN(num) ? raw : num;
}

function formatCurrency(value, currency = "USD") {
    const symbol = currency === "ARS" ? "AR$" : "U$D";
    return `${symbol} ${formatNumber(value)}`;
}

function formatNumber(val) {
    if (!val && val !== 0) return "-";
    return Number(val).toLocaleString("es-AR");
}

function getAgentPhone(prop) {
    const agent = window.getPropertyAgent ? window.getPropertyAgent(prop) : null;
    if (window.normalizeWhatsappPhone) {
        return window.normalizeWhatsappPhone(agent?.whatsapp || agent?.phone || WHATSAPP_NUMBER);
    }
    const configuredWhatsapp = String(agent?.whatsapp || agent?.phone || window.SITE_CONFIG?.contact?.whatsapp || WHATSAPP_NUMBER).replace(/\D/g, "");
    return configuredWhatsapp || WHATSAPP_NUMBER;
}

function buildWhatsappUrl(prop, consultantName = "") {
    if (window.buildPropertyWhatsappUrl) {
        return window.buildPropertyWhatsappUrl(prop, consultantName);
    }
    const phone = getAgentPhone(prop);
    const rawName = String(consultantName || "").trim();
    const title = String(prop?.title || "la propiedad").trim();
    const directUrl = window.getPropertyDirectUrl ? window.getPropertyDirectUrl(prop) : window.location.href;
    const message = rawName
        ? `¡Hola me llamo ${rawName}, vi esta propiedad en la página '${title}' (${directUrl}) y me gustaría que me pasen más información. ¡Muchas gracias!`
        : `¡Hola, vi esta propiedad en la página '${title}' (${directUrl}) y me gustaría que me pasen más información. ¡Muchas gracias!`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function showNotFound() {
    container.innerHTML = `
        <div class="no-results">
            <h2>Propiedad no encontrada</h2>
            <p>Revisa el enlace o vuelve al listado principal.</p>
            <a href="index.html" class="btn btn-primary" style="margin-top: 20px; display: inline-block;">Volver al inicio</a>
        </div>
    `;
    if (floatingContact) floatingContact.style.display = "none";
}

function getFeatureVal(namePattern, prop) {
    if (!prop || !prop.customFeatures) return null;
    const feat = prop.customFeatures.find(f =>
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
}

function isValidVal(v) {
    if (v === null || v === undefined) return false;
    const s = String(v).trim();
    if (!s || s === '-' || s === '0') return false;
    const n = Number(s.replace(/\./g, '').replace(/,/g, '.'));
    return isNaN(n) ? true : n > 0;
}

function extractCoordsFromGoogleMaps(input) {
    if (!input || typeof input !== "string") return null;
    const s = input.trim();

    // 1. Coordenadas con @lat,lng en URLs estándar de Google Maps
    const atMatch = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };

    // 2. Parámetros de lugar embebidos (!3dlat!4dlng)
    const dMatch = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (dMatch) return { lat: parseFloat(dMatch[1]), lng: parseFloat(dMatch[2]) };

    // 3. Query string q=lat,lng / query=lat,lng / ll=lat,lng
    const qMatch = s.match(/[?&](?:q|query|ll|center)=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/i);
    if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };

    // 4. Par de coordenadas decimales directas: "lat, lng" o "lat lng"
    const rawMatch = s.match(/(-?\d{1,2}\.\d+)[,\s]+(-?\d{1,3}\.\d+)/);
    if (rawMatch) return { lat: parseFloat(rawMatch[1]), lng: parseFloat(rawMatch[2]) };

    return null;
}

function renderDetails(prop) {
    // 4. Manejo de Coordenadas: convertir a Float numéricos con parseFloat
    let rawLat = prop.lat;
    let rawLng = prop.lng;

    if ((rawLat === undefined || rawLat === null || rawLat === "") && prop.mapLink) {
        const extracted = extractCoordsFromGoogleMaps(prop.mapLink);
        if (extracted) {
            rawLat = extracted.lat;
            rawLng = extracted.lng;
            prop.lat = rawLat;
            prop.lng = rawLng;
        }
    }

    const lat = parseFloat(rawLat);
    const lng = parseFloat(rawLng);
    const hasCoords = !isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng) && (lat !== 0 || lng !== 0);

    const logged = window.AuthManager && window.AuthManager.isLoggedIn();
    const userRole = (window.AuthManager?.currentUserProfile?.role || window.AuthManager?.getUserRole() || "").toUpperCase();
    const isSuperAdmin = Boolean(logged && userRole === "SUPER_ADMIN");
    const safeTitle = escapeHtml(prop.title);
    const safeCategory = escapeHtml(prop.category);
    const safeDescription = escapeHtml(prop.description || "");
    const assignedAgent = window.getPropertyAgent ? window.getPropertyAgent(prop) : {
        name: prop.agent || window.SITE_CONFIG?.brand?.name || "Dávalos Propiedades",
        role: "Asesor Inmobiliario",
        email: window.SITE_CONFIG?.contact?.email || "",
        photoUrl: ""
    };
    const sellerName = window.getPropertySellerName ? window.getPropertySellerName(prop, assignedAgent) : null;
    const defaultGreeting = sellerName ? `Hola ${escapeHtml(sellerName)}` : "Hola, ¿cómo estás?";
    const safeAgentName = escapeHtml(assignedAgent.name || "Dávalos Propiedades");
    const safeAgentRole = escapeHtml(assignedAgent.role || "Asesor a cargo");
    const safeAgentEmail = escapeHtml(assignedAgent.email || "");
    const safeAgentPhoto = safeImageUrl(assignedAgent.photoUrl) || (assignedAgent.photoUrl && !assignedAgent.photoUrl.startsWith("http") ? escapeHtml(assignedAgent.photoUrl) : "");
    const agentInitials = safeAgentName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join("") || "D";

    const isVenta = String(prop.category || prop.operation || 'venta').toLowerCase().includes('venta');
    const typeLabel = prop.type ? `${escapeHtml(prop.type.charAt(0).toUpperCase() + prop.type.slice(1))} en ` : "";
    const categoryLabel = safeCategory.charAt(0).toUpperCase() + safeCategory.slice(1);
    const locationLabel = escapeHtml(prop.location || window.SITE_CONFIG?.contact?.city || "Salta");

    const rawEnvironments = (prop.environments && Number(prop.environments) > 0) ? prop.environments : (getFeatureVal('ambiente', prop) || getFeatureVal('amb.', prop));
    const environments = isValidVal(rawEnvironments) ? rawEnvironments : null;

    const rawAreaTotal = prop.areaTotal || prop.area;
    const areaTotal = isValidVal(rawAreaTotal) ? formatNumber(rawAreaTotal) : null;

    const rawAreaBuilt = prop.areaBuilt;
    const areaBuilt = isValidVal(rawAreaBuilt) ? formatNumber(rawAreaBuilt) : null;

    const rawRooms = (prop.rooms && Number(prop.rooms) > 0) ? prop.rooms : (getFeatureVal('dormitorio', prop) || getFeatureVal('habitacio', prop));
    const rooms = isValidVal(rawRooms) ? rawRooms : null;

    const rawBaths = (prop.baths && Number(prop.baths) > 0) ? prop.baths : (getFeatureVal('baño', prop) || getFeatureVal('toilette', prop));
    const baths = isValidVal(rawBaths) ? rawBaths : null;

    const rawGarage = (prop.garage && Number(prop.garage) > 0) ? prop.garage : (getFeatureVal('cochera', prop) || getFeatureVal('garage', prop));
    const garage = isValidVal(rawGarage) ? rawGarage : null;

    const horizontalFeaturesHtml = [
        environments ? `
            <div class="feat-chip">
                <div class="feat-chip-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                </div>
                <div class="feat-chip-data">
                    <span class="feat-chip-label">Ambientes</span>
                    <span class="feat-chip-val">${escapeHtml(environments)}</span>
                </div>
            </div>` : "",
        rooms ? `
            <div class="feat-chip">
                <div class="feat-chip-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/></svg>
                </div>
                <div class="feat-chip-data">
                    <span class="feat-chip-label">Dormitorios</span>
                    <span class="feat-chip-val">${escapeHtml(rooms)}</span>
                </div>
            </div>` : "",
        baths ? `
            <div class="feat-chip">
                <div class="feat-chip-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14h18l-2 6H6a3 3 0 0 1-3-3V5c0-2 2-3 4-3s4 1 5 3"/><path d="M11 5l3 3"/></svg>
                </div>
                <div class="feat-chip-data">
                    <span class="feat-chip-label">Baños</span>
                    <span class="feat-chip-val">${escapeHtml(baths)}</span>
                </div>
            </div>` : "",
        areaTotal ? `
            <div class="feat-chip">
                <div class="feat-chip-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M9 21V9"/><circle cx="12" cy="15" r="1"/></svg>
                </div>
                <div class="feat-chip-data">
                    <span class="feat-chip-label">Sup. Total</span>
                    <span class="feat-chip-val">${areaTotal} m²</span>
                </div>
            </div>` : "",
        areaBuilt ? `
            <div class="feat-chip">
                <div class="feat-chip-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18V3H3zm13 13H8v-2h8v2zm0-4H8v-2h8v2z"/></svg>
                </div>
                <div class="feat-chip-data">
                    <span class="feat-chip-label">Sup. Cubierta</span>
                    <span class="feat-chip-val">${areaBuilt} m²</span>
                </div>
            </div>` : "",
        garage ? `
            <div class="feat-chip">
                <div class="feat-chip-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
                </div>
                <div class="feat-chip-data">
                    <span class="feat-chip-label">Cocheras</span>
                    <span class="feat-chip-val">${escapeHtml(garage)}</span>
                </div>
            </div>` : "",
        prop.creditEligible ? `
            <div class="feat-chip">
                <div class="feat-chip-icon" style="color: #059669; background: #ecfdf5;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2l3 7h7l-5 5 2 7-7-4-7 4 2-7-5-5h7z"/></svg>
                </div>
                <div class="feat-chip-data">
                    <span class="feat-chip-label">Crédito</span>
                    <span class="feat-chip-val" style="color: #059669;">Apto ✅</span>
                </div>
            </div>` : ""
    ].filter(Boolean).join("");

    container.innerHTML = `
        <div class="details-layout-v4">
            <!-- COLUMNA PRINCIPAL (Izquierda / ~65-70%) -->
            <div class="details-main-column">
                <!-- 1. Cabecera del Inmueble -->
                <header class="property-header-card">
                    <div class="property-header-badges">
                        <span class="operation-badge-tag ${isVenta ? 'badge-venta' : 'badge-alquiler'}">
                            ${isVenta ? 'Venta' : 'Alquiler'}
                        </span>
                        <span class="property-type-tag">
                            ${escapeHtml(prop.type || 'Inmueble')}
                        </span>
                        ${prop.creditEligible ? `
                            <span class="credit-eligible-tag">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2l3 7h7l-5 5 2 7-7-4-7 4 2-7-5-5h7z"/></svg>
                                Apto Crédito
                            </span>
                        ` : ''}
                        <span class="property-code-tag">ID: #${prop.id}</span>
                    </div>

                    <h1 class="property-page-title">${safeTitle}</h1>

                    <div class="property-location-line">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                        <span>${escapeHtml(prop.location || window.SITE_CONFIG?.contact?.city || "Salta, Argentina")}</span>
                        ${prop.mapLink ? `
                            <a href="${escapeHtml(prop.mapLink)}" target="_blank" rel="noopener noreferrer" class="link-open-map">
                                <span>Ver en mapa ↗</span>
                            </a>
                        ` : ''}
                    </div>

                    <!-- Fila de precio para dispositivos móviles -->
                    <div class="property-price-mobile-row">
                        <div class="price-val-mobile">${formatCurrency(prop.price, prop.currency)}</div>
                        ${prop.expensasAmount ? `<span class="expensas-sub-mobile">+ ${formatCurrency(prop.expensasAmount, prop.expensasCurrency || "ARS")} expensas</span>` : ''}
                    </div>
                </header>

                <!-- 2. Galería de Fotos Moderna -->
                <section class="property-gallery-card">
                    <div class="gallery-viewport" id="property-carousel">
                        <div class="carousel-inner" id="carousel-inner">
                            ${prop.images.map((img, index) => `
                                <div class="carousel-item ${index === 0 ? "active" : ""}">
                                    <img loading="${index === 0 ? 'eager' : 'lazy'}" src="${img}" alt="${safeTitle}" class="carousel-img">
                                </div>
                            `).join("")}
                        </div>

                        ${prop.images.length > 1 ? `
                            <button class="gallery-nav-btn prev" type="button" onclick="moveCarousel(-1)" aria-label="Foto anterior">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                            </button>
                            <button class="gallery-nav-btn next" type="button" onclick="moveCarousel(1)" aria-label="Siguiente foto">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
                            </button>
                        ` : ""}

                        <div class="gallery-counter-pill" id="gallery-photo-counter">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                            <span>1 / ${prop.images.length}</span>
                        </div>

                        <button class="gallery-expand-btn" type="button" onclick="document.querySelector('.carousel-item.active .carousel-img').click()" title="Ampliar imagen">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                            <span>Pantalla completa</span>
                        </button>
                    </div>

                    ${prop.images.length > 1 ? `
                        <div class="gallery-thumbnails-row" id="carousel-thumbnails">
                            ${prop.images.map((img, index) => `
                                <div class="thumb-item ${index === 0 ? "active" : ""}" onclick="setCarousel(${index})">
                                    <img src="${img}" alt="Foto ${index + 1}" loading="lazy">
                                </div>
                            `).join("")}
                        </div>
                    ` : ""}

                    ${logged ? `
                        <div class="gallery-bottom-actions">
                            <button type="button" class="btn-util-action btn-gallery-download" id="btn-download-images" onclick="downloadAllImages()" title="Descargar fotos">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                <span>Descargar</span>
                            </button>
                        </div>
                    ` : ""}
                </section>

                <!-- 3. Fila de Características Clave -->
                ${horizontalFeaturesHtml ? `
                    <section class="property-features-bar">
                        ${horizontalFeaturesHtml}
                    </section>
                ` : ""}

                <!-- 4. Descripción de la Propiedad -->
                <section class="property-card-section description-card">
                    <h2 class="section-title">Descripción</h2>
                    <div class="description-body">
                        ${safeDescription}
                    </div>

                    ${prop.customFeatures && prop.customFeatures.length ? `
                        <div class="amenities-subsection">
                            <h3 class="subsection-title">Comodidades y detalles</h3>
                            <div class="amenities-grid">
                                ${prop.customFeatures.map((feat) => {
                                    const isObj = typeof feat === 'object';
                                    const icon = isObj ? feat.icon : "✨";
                                    const name = isObj ? feat.name : feat;
                                    const qty = (isObj && feat.qty) ? `${feat.qty} ` : "";
                                    return `
                                        <div class="amenity-chip">
                                            <span class="amenity-icon">${icon}</span>
                                            <span class="amenity-text">${qty ? '<strong>' + formatNumber(qty) + '</strong> ' : ''}${escapeHtml(name)}</span>
                                        </div>
                                    `;
                                }).join("")}
                            </div>
                        </div>
                    ` : ""}

                    ${prop.memoryDescription ? `
                        <div class="memory-subsection">
                            <h3 class="subsection-title">Memoria Descriptiva</h3>
                            <div class="memory-box">
                                ${escapeHtml(prop.memoryDescription)}
                            </div>
                        </div>
                    ` : ""}
                </section>

                <!-- 5. Ubicación y Mapa Leaflet -->
                ${hasCoords ? `
                    <section class="property-card-section location-card">
                        <div class="location-header-row">
                            <div>
                                <h2 class="section-title" style="margin-bottom: 4px;">Ubicación</h2>
                                <div class="location-text-line">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                                    <span>${escapeHtml(prop.location || "Salta, Argentina")}</span>
                                </div>
                            </div>
                            <a href="${prop.mapLink || `https://www.google.com/maps?q=${lat},${lng}`}" target="_blank" rel="noopener noreferrer" class="btn-external-gmaps">
                                <span>Abrir en Google Maps ↗</span>
                            </a>
                        </div>
                        <div id="property-map"></div>
                    </section>
                ` : ""}
            </div>

            <!-- COLUMNA LATERAL STICKY (Derecha / ~30-35%) -->
            <aside class="details-sidebar-column">
                <div class="sticky-contact-card">
                    <!-- 1. Precio -->
                    <div class="sidebar-price-container">
                        <span class="sidebar-price-label">Precio de la propiedad</span>
                        <div class="sidebar-price-number">${formatCurrency(prop.price, prop.currency)}</div>
                        ${prop.expensasAmount ? `
                            <div class="sidebar-expensas-tag">+ ${formatCurrency(prop.expensasAmount, prop.expensasCurrency || "ARS")} expensas</div>
                        ` : ""}
                    </div>

                    <!-- 2. Datos del Asesor / Inmobiliaria -->
                    <div class="sidebar-agent-card">
                        <div class="agent-card-header">
                            <span class="agent-card-badge">Asesor a cargo</span>
                        </div>
                        <div class="agent-profile-row">
                            <div class="agent-avatar-wrap" id="sidebar-agent-avatar-wrap">
                                ${safeAgentPhoto ? `
                                    <img id="sidebar-agent-photo" src="${safeAgentPhoto}" alt="${safeAgentName}" class="agent-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                    <div id="sidebar-agent-fallback" class="agent-avatar-fallback" style="display:none;">${agentInitials}</div>
                                ` : `
                                    <div id="sidebar-agent-fallback" class="agent-avatar-fallback">${agentInitials}</div>
                                `}
                            </div>
                            <div class="agent-info-meta">
                                <span id="sidebar-agent-name" class="agent-name-title">${safeAgentName}</span>
                                <span id="sidebar-agent-role" class="agent-license-subtitle">${safeAgentRole} · MP N° 96</span>
                                <span id="sidebar-agent-email-wrap">${safeAgentEmail ? `<a id="sidebar-agent-email" href="mailto:${safeAgentEmail}" class="agent-contact-link">${safeAgentEmail}</a>` : ""}</span>
                            </div>
                        </div>

                        ${isSuperAdmin ? `
                            <div class="super-admin-agent-selector-wrap">
                                <label for="select-assign-agent" class="agent-selector-label">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                                    <span>Asignar / Cambiar Asesor</span>
                                </label>
                                <div class="agent-select-wrapper">
                                    <select id="select-assign-agent" class="agent-select-control" aria-label="Asignar o cambiar asesor responsable">
                                        <option value="">Cargando asesores...</option>
                                    </select>
                                </div>
                                <div id="agent-change-status" class="agent-change-status" style="display:none;"></div>
                            </div>
                        ` : ""}
                    </div>

                    <!-- 3. Botón Principal: Consultar por WhatsApp -->
                    <div class="sidebar-whatsapp-block">
                        <input type="text" id="consultant-name" placeholder="Tu nombre y apellido (opcional)" class="consultant-name-input" autocomplete="name" />
                        <a id="btn-sidebar-whatsapp" href="${buildWhatsappUrl(prop)}" target="_blank" rel="noopener noreferrer" class="btn-sidebar-whatsapp">
                            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.1.824zm-3.423-14.416c-6.627 0-12 5.373-12 12 0 2.625.846 5.059 2.284 7.033l-1.494 5.462 5.602-1.469c1.908 1.132 4.132 1.787 6.516 1.787 6.627 0 12-5.373 12-12s-5.373-12-12.908-12.813z"/>
                            </svg>
                            <span>Consultar por WhatsApp</span>
                        </a>
                    </div>

                    <!-- 4. Acciones Utilitarias -->
                    <div class="sidebar-utility-actions">
                        <button type="button" class="btn-util-action" onclick="shareProperty()" title="Compartir">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                            <span>Compartir</span>
                        </button>
                        <button type="button" class="btn-util-action" onclick="window.print()" title="Imprimir ficha">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                            <span>Imprimir</span>
                        </button>
                        ${(logged && window.AuthManager.hasPermission(window.AuthManager.Permissions.EDIT_PROPERTY)) ? `
                            <button type="button" class="btn-util-action btn-util-edit" onclick="window.location.href='index.html?edit=${prop.id}'" title="Editar propiedad">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                <span>Editar</span>
                            </button>
                        ` : ""}
                    </div>

                    <!-- 5. Datos Privados (Admin) -->
                    ${(logged && window.AuthManager.hasPermission(window.AuthManager.Permissions.VIEW_PRIVATE_DATA)) ? `
                        <div class="admin-private-data-card">
                            <div class="admin-data-title">🔒 Datos Privados (Admin)</div>
                            <p><strong>Propietario:</strong> ${escapeHtml(prop.ownerName || "No registrado")}</p>
                            <p><strong>Teléfono:</strong> ${escapeHtml(prop.ownerPhone || "No registrado")}</p>
                        </div>
                    ` : ""}
                </div>
            </aside>
        </div>
    `;

    // Actualizar título en breadcrumbs superior
    const breadcrumbTitle = document.getElementById("breadcrumb-prop-title");
    if (breadcrumbTitle) {
        breadcrumbTitle.textContent = prop.title;
    }

    // Vincular interacción dinámica del input de nombre y botón WhatsApp
    const consultantNameInput = document.getElementById("consultant-name");
    const sidebarWaBtn = document.getElementById("btn-sidebar-whatsapp");

    function getDynamicWhatsappUrl() {
        const nameVal = consultantNameInput ? consultantNameInput.value.trim() : "";
        return buildWhatsappUrl(prop, nameVal);
    }

    if (sidebarWaBtn) {
        sidebarWaBtn.onclick = (e) => {
            e.preventDefault();
            const targetUrl = getDynamicWhatsappUrl();
            window.open(targetUrl, "_blank");
        };
    }

    if (consultantNameInput) {
        consultantNameInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                const targetUrl = getDynamicWhatsappUrl();
                window.open(targetUrl, "_blank");
            }
        });
        consultantNameInput.addEventListener("input", () => {
            const nextUrl = getDynamicWhatsappUrl();
            if (sidebarWaBtn) sidebarWaBtn.href = nextUrl;
            if (floatingWhatsapp) floatingWhatsapp.href = nextUrl;
        });
    }

    // Actualizar dinámicamente metadatos SEO, Open Graph y Twitter Cards para esta propiedad
    const brandName = window.SITE_CONFIG?.brand?.name || "Dávalos Propiedades";
    const formattedPrice = formatCurrency(prop.price, prop.currency);
    const rawTypeText = prop.type ? `${prop.type.charAt(0).toUpperCase() + prop.type.slice(1)} en ` : "";
    const rawCategoryText = prop.category ? (prop.category.charAt(0).toUpperCase() + prop.category.slice(1)) : "Propiedad";
    const rawLocationText = prop.location || window.SITE_CONFIG?.contact?.city || "Salta";
    const seoTitle = `${prop.title} · ${formattedPrice} | ${brandName}`;
    const rawSummary = `${rawTypeText}${rawCategoryText} en ${rawLocationText} · Precio: ${formattedPrice}. ${prop.description || ""}`.replace(/\s+/g, " ").trim();
    const seoDescription = rawSummary.length > 160 ? `${rawSummary.slice(0, 157)}...` : rawSummary;
    const seoImage = (Array.isArray(prop.images) && prop.images.length > 0 && prop.images[0])
        ? prop.images[0]
        : (window.SITE_CONFIG?.seo?.defaultImage || "assets/img/logo-seal.svg");
    const seoKeywords = [
        prop.title,
        prop.type,
        prop.category,
        rawLocationText,
        brandName,
        "inmobiliaria en Salta"
    ].filter(Boolean).join(", ");

    if (typeof window.updatePageSeoMeta === "function") {
        window.updatePageSeoMeta({
            title: seoTitle,
            description: seoDescription,
            keywords: seoKeywords,
            image: seoImage,
            url: window.location.href,
            type: "website"
        });
    } else {
        document.title = seoTitle;
    }

    // Inyectar datos estructurados JSON-LD para motores de búsqueda
    let jsonLdScript = document.getElementById("property-jsonld");
    if (!jsonLdScript) {
        jsonLdScript = document.createElement("script");
        jsonLdScript.id = "property-jsonld";
        jsonLdScript.type = "application/ld+json";
        document.head.appendChild(jsonLdScript);
    }
    jsonLdScript.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "RealEstateListing",
        "name": prop.title,
        "description": seoDescription,
        "url": window.location.href,
        "image": Array.isArray(prop.images) ? prop.images : [seoImage],
        "offers": {
            "@type": "Offer",
            "price": prop.price || 0,
            "priceCurrency": prop.currency || "USD",
            "availability": "https://schema.org/InStock"
        }
    });

    bindLightbox(prop.images);
    setupFloating(prop);

    if (isSuperAdmin) {
        populateAssignAgentSelect(prop);
    }

    if (hasCoords) {
        initDetailsMap(lat, lng, prop);
    }
}

function refreshAdvisorAndWhatsappLive(prop) {
    const assignedAgent = window.getPropertyAgent ? window.getPropertyAgent(prop) : {
        name: prop.agent || "Dávalos Propiedades",
        role: prop.agentRole || "Asesor Inmobiliario",
        email: prop.agentEmail || "",
        photoUrl: prop.agentPhotoUrl || ""
    };

    const safeAgentName = escapeHtml(assignedAgent.name || "Dávalos Propiedades");
    const safeAgentRole = escapeHtml(assignedAgent.role || "Asesor Inmobiliario");
    const safeAgentEmail = escapeHtml(assignedAgent.email || "");
    const safeAgentPhoto = safeImageUrl(assignedAgent.photoUrl) || (assignedAgent.photoUrl && !assignedAgent.photoUrl.startsWith("http") ? escapeHtml(assignedAgent.photoUrl) : "");
    const agentInitials = safeAgentName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join("") || "D";

    const nameEl = document.getElementById("sidebar-agent-name");
    const roleEl = document.getElementById("sidebar-agent-role");
    const emailWrap = document.getElementById("sidebar-agent-email-wrap");
    const avatarWrap = document.getElementById("sidebar-agent-avatar-wrap");
    const sidebarWaBtn = document.getElementById("btn-sidebar-whatsapp");
    const consultantNameInput = document.getElementById("consultant-name");

    if (nameEl) nameEl.textContent = assignedAgent.name || "Dávalos Propiedades";
    if (roleEl) roleEl.textContent = `${assignedAgent.role || "Asesor Inmobiliario"} · MP N° 96`;
    if (emailWrap) {
        emailWrap.innerHTML = safeAgentEmail ? `<a id="sidebar-agent-email" href="mailto:${safeAgentEmail}" class="agent-contact-link">${safeAgentEmail}</a>` : "";
    }
    if (avatarWrap) {
        if (safeAgentPhoto) {
            avatarWrap.innerHTML = `
                <img id="sidebar-agent-photo" src="${safeAgentPhoto}" alt="${safeAgentName}" class="agent-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div id="sidebar-agent-fallback" class="agent-avatar-fallback" style="display:none;">${agentInitials}</div>
            `;
        } else {
            avatarWrap.innerHTML = `<div id="sidebar-agent-fallback" class="agent-avatar-fallback">${agentInitials}</div>`;
        }
    }

    const nameVal = consultantNameInput ? consultantNameInput.value.trim() : "";
    const nextUrl = buildWhatsappUrl(prop, nameVal);
    if (sidebarWaBtn) sidebarWaBtn.href = nextUrl;
    if (floatingWhatsapp) floatingWhatsapp.href = nextUrl;
    if (floatingCall) floatingCall.href = `tel:+${getAgentPhone(prop)}`;
}

async function populateAssignAgentSelect(prop) {
    const select = document.getElementById("select-assign-agent");
    if (!select) return;

    select.innerHTML = '<option value="">Dávalos Propiedades (Por defecto)</option>';

    let activeUsers = [];
    if (window.db) {
        try {
            const snap = await window.db.collection("users").where("status", "==", "active").get();
            snap.forEach(doc => {
                const u = doc.data();
                activeUsers.push({
                    uid: doc.id,
                    displayName: u.displayName || u.email || "Asesor",
                    email: u.email || "",
                    phone: u.phone || u.whatsapp || "",
                    whatsapp: u.whatsapp || u.phone || "",
                    photoURL: u.photoURL || "",
                    role: u.role || "AGENT"
                });
            });
        } catch (err) {
            console.warn("[details] Error al consultar usuarios activos de Firestore:", err);
        }
    }

    // Complementar con agentes preconfigurados de SITE_CONFIG si no estuvieran en Firestore
    const configAgents = Array.isArray(window.SITE_CONFIG?.agents) ? window.SITE_CONFIG.agents : [];
    configAgents.forEach(cfgAg => {
        if (!cfgAg || !cfgAg.name) return;
        const exists = activeUsers.some(u =>
            (cfgAg.id && u.uid === cfgAg.id) ||
            (u.displayName && u.displayName.toLowerCase() === cfgAg.name.toLowerCase())
        );
        if (!exists) {
            activeUsers.push({
                uid: cfgAg.id || cfgAg.name,
                displayName: cfgAg.name,
                email: cfgAg.email || "",
                phone: cfgAg.phone || cfgAg.whatsapp || "",
                whatsapp: cfgAg.whatsapp || cfgAg.phone || "",
                photoURL: cfgAg.photoUrl || cfgAg.avatar || "",
                role: cfgAg.role || "Asesor Inmobiliario"
            });
        }
    });

    activeUsers.sort((a, b) => a.displayName.localeCompare(b.displayName));

    activeUsers.forEach(u => {
        const opt = document.createElement("option");
        opt.value = u.uid;
        const displayRole = u.role === "SUPER_ADMIN" ? "Super Administrador" : (u.role === "ADMIN" ? "Administrador" : "Asesor Inmobiliario");
        opt.textContent = `${u.displayName} (${displayRole})`;
        opt.dataset.agentName = u.displayName;
        opt.dataset.agentEmail = u.email;
        opt.dataset.agentPhone = u.phone;
        opt.dataset.agentWhatsapp = u.whatsapp;
        opt.dataset.agentPhoto = u.photoURL;
        opt.dataset.agentRole = displayRole;
        select.appendChild(opt);
    });

    // Seleccionar el asesor asignado actualmente
    const currentAgentId = String(prop.agentId || "").trim();
    const currentAgentName = String(prop.agent || "").trim().toLowerCase();
    let matchedOption = false;

    if (currentAgentId) {
        for (let i = 0; i < select.options.length; i++) {
            if (select.options[i].value === currentAgentId) {
                select.selectedIndex = i;
                matchedOption = true;
                break;
            }
        }
    }

    if (!matchedOption && currentAgentName) {
        for (let i = 0; i < select.options.length; i++) {
            const optName = String(select.options[i].dataset.agentName || select.options[i].textContent || "").toLowerCase();
            if (optName && (optName === currentAgentName || optName.includes(currentAgentName))) {
                select.selectedIndex = i;
                matchedOption = true;
                break;
            }
        }
    }

    select.onchange = async () => {
        const selectedOpt = select.options[select.selectedIndex];
        const newAgentId = select.value;
        const statusEl = document.getElementById("agent-change-status");
        if (statusEl) {
            statusEl.style.display = "block";
            statusEl.className = "agent-change-status loading";
            statusEl.textContent = "Guardando cambio...";
        }
        select.disabled = true;

        let newAgentData = {};
        if (!newAgentId) {
            newAgentData = {
                agentId: "",
                agent: window.SITE_CONFIG?.brand?.name || "Dávalos Propiedades",
                agentPhone: window.SITE_CONFIG?.contact?.phone || "",
                agentWhatsapp: window.SITE_CONFIG?.contact?.whatsapp || "",
                agentEmail: window.SITE_CONFIG?.contact?.email || "",
                agentPhotoUrl: "",
                agentRole: "Asesor Inmobiliario"
            };
        } else {
            newAgentData = {
                agentId: newAgentId,
                agent: selectedOpt.dataset.agentName || selectedOpt.textContent,
                agentPhone: selectedOpt.dataset.agentPhone || "",
                agentWhatsapp: selectedOpt.dataset.agentWhatsapp || "",
                agentEmail: selectedOpt.dataset.agentEmail || "",
                agentPhotoUrl: selectedOpt.dataset.agentPhoto || "",
                agentRole: selectedOpt.dataset.agentRole || "Asesor Inmobiliario"
            };
        }

        try {
            if (window.db) {
                if (prop.firebaseId) {
                    await window.db.collection("properties").doc(prop.firebaseId).update(newAgentData);
                } else {
                    const searchIds = [...new Set([prop.id, String(prop.id), Number(prop.id)])].filter(val => val !== null && val !== undefined && !Number.isNaN(val));
                    const snap = await window.db.collection("properties").where("id", "in", searchIds).get();
                    if (!snap.empty) {
                        const targetDoc = snap.docs[0];
                        prop.firebaseId = targetDoc.id;
                        await window.db.collection("properties").doc(targetDoc.id).update(newAgentData);
                    } else {
                        const newDoc = await window.db.collection("properties").add({
                            ...prop,
                            ...newAgentData
                        });
                        prop.firebaseId = newDoc.id;
                    }
                }
            }

            Object.assign(prop, newAgentData);
            if (currentProperty) {
                Object.assign(currentProperty, newAgentData);
            }

            refreshAdvisorAndWhatsappLive(prop);

            if (statusEl) {
                statusEl.className = "agent-change-status success";
                statusEl.textContent = "✓ Asesor actualizado correctamente";
                setTimeout(() => {
                    if (statusEl) statusEl.style.display = "none";
                }, 3000);
            }
        } catch (error) {
            console.error("[details] Error al actualizar asesor:", error);
            if (statusEl) {
                statusEl.className = "agent-change-status error";
                statusEl.textContent = "✕ Error al guardar cambio";
            }
        } finally {
            select.disabled = false;
        }
    };
}

let propertyDetailsMapInstance = null;
function initDetailsMap(rawLat, rawLng, prop) {
    if (!window.L) return;
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const mapContainer = document.getElementById('property-map');
    if (!mapContainer) return;

    // 4. Manejo de Coordenadas: asegurar conversión a Float numéricos
    const lat = parseFloat(rawLat);
    const lng = parseFloat(rawLng);

    // Si no hay coordenadas válidas, ocultar la sección completa para no dejar hueco
    if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng) || (lat === 0 && lng === 0)) {
        const section = mapContainer.closest('.location-section');
        if (section) section.style.display = 'none';
        else mapContainer.style.display = 'none';
        return;
    }

    try {
        if (propertyDetailsMapInstance) {
            propertyDetailsMapInstance.remove();
            propertyDetailsMapInstance = null;
        }

        const map = L.map('property-map', {
            center: [lat, lng],
            zoom: 15,
            scrollWheelZoom: false
        });
        propertyDetailsMapInstance = map;

        // 2. Inicialización del Mapa con estilo OSM HOT (libre de API Key y marcas de agua)
        L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        const customPin = L.divIcon({
            className: 'custom-map-marker',
            html: `
                <div class="map-marker-pin" style="background:#0b1b4f; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; box-shadow:0 3px 10px rgba(0,0,0,0.35); border:2px solid #fff;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                </div>
            `,
            iconSize: [36, 36],
            iconAnchor: [18, 36],
            popupAnchor: [0, -36]
        });

        const marker = L.marker([lat, lng], { icon: customPin }).addTo(map);
        if (prop && prop.title) {
            marker.bindPopup(`<strong>${escapeHtml(prop.title)}</strong><br><span style="color:#666;">${escapeHtml(prop.location || '')}</span>`);
        }

        // 3. Invalidate Size (ajuste de cálculo de pantalla)
        setTimeout(() => {
            if (map) {
                map.invalidateSize();
            }
        }, 200);

        setTimeout(() => {
            if (map) {
                map.invalidateSize();
            }
        }, 500);
    } catch (err) {
        console.error('Error al inicializar mapa en detalles:', err);
    }
}

function shareProperty() {
    const brandName = window.SITE_CONFIG?.brand?.name || 'Dávalos Propiedades';
    const propTitle = currentProperty?.title || document.title;
    const propPrice = currentProperty ? formatCurrency(currentProperty.price, currentProperty.currency) : '';
    const shareText = propPrice
        ? `${propTitle} (${propPrice}) - ${brandName}`
        : `Mira esta propiedad en ${brandName}`;
    const shareData = {
        title: document.title,
        text: shareText,
        url: window.location.href
    };
    if (navigator.share) {
        navigator.share(shareData).catch(err => console.log('Error sharing:', err));
    } else {
        navigator.clipboard.writeText(window.location.href);
        alert('Enlace copiado al portapapeles');
    }
}

function bindLightbox(images) {
    currentLightboxImages = images || [];
    const imgs = document.querySelectorAll(".carousel-img");
    
    imgs.forEach((img, index) => {
        img.onclick = () => {
            currentLightboxIndex = index;
            updateLightboxView();
            lightbox.style.display = "flex";
            document.body.style.overflow = "hidden";
        };
    });

    // Navigation buttons
    if (lightboxPrev) lightboxPrev.onclick = (e) => { e.stopPropagation(); changeLightbox(-1); };
    if (lightboxNext) lightboxNext.onclick = (e) => { e.stopPropagation(); changeLightbox(1); };

    // Close on background click
    lightbox.onclick = (e) => {
        if (e.target === lightbox) closeLightbox();
    };

    // Keyboard support
    document.addEventListener('keydown', handleLightboxKeys);

    // Swipe support
    setupSwipeSupport();
}

function updateLightboxView() {
    if (currentLightboxImages.length > 0) {
        lightboxImage.src = currentLightboxImages[currentLightboxIndex];
    }
    
    // Hide buttons if only one image
    if (currentLightboxImages.length <= 1) {
        if (lightboxPrev) lightboxPrev.style.display = "none";
        if (lightboxNext) lightboxNext.style.display = "none";
    } else {
        if (lightboxPrev) lightboxPrev.style.display = "flex";
        if (lightboxNext) lightboxNext.style.display = "flex";
    }
}

function changeLightbox(dir) {
    if (currentLightboxImages.length <= 1) return;
    currentLightboxIndex = (currentLightboxIndex + dir + currentLightboxImages.length) % currentLightboxImages.length;
    updateLightboxView();
}

function closeLightbox() {
    lightbox.style.display = "none";
    document.body.style.overflow = "auto";
}

function handleLightboxKeys(e) {
    if (lightbox.style.display !== "flex") return;
    if (e.key === "ArrowLeft") changeLightbox(-1);
    if (e.key === "ArrowRight") changeLightbox(1);
    if (e.key === "Escape") closeLightbox();
}

function setupSwipeSupport() {
    let touchstartX = 0;
    let touchendX = 0;

    lightbox.addEventListener('touchstart', e => {
        touchstartX = e.changedTouches[0].screenX;
    }, { passive: true });

    lightbox.addEventListener('touchend', e => {
        touchendX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });

    function handleSwipe() {
        if (touchendX < touchstartX - 50) changeLightbox(1); // Swipe left -> next
        if (touchendX > touchstartX + 50) changeLightbox(-1); // Swipe right -> prev
    }
}

function setupFloating(prop) {
    if (!floatingContact) return;
    floatingWhatsapp.href = buildWhatsappUrl(prop);
    floatingCall.href = `tel:+${getAgentPhone(prop)}`;
    floatingContact.style.display = "flex";

    floatingWhatsapp.onclick = (e) => {
        e.preventDefault();
        const consultantNameInput = document.getElementById("consultant-name");
        const nameVal = consultantNameInput ? consultantNameInput.value.trim() : "";
        window.open(buildWhatsappUrl(prop, nameVal), "_blank");
    };
}

// Carousel global handlers
window.moveCarousel = (dir) => {
    const items = document.querySelectorAll(".carousel-item");
    const thumbs = document.querySelectorAll(".thumb-item");
    if (items.length <= 1) return;
    items[currentSlide].classList.remove("active");
    if (thumbs[currentSlide]) thumbs[currentSlide].classList.remove("active");
    currentSlide = (currentSlide + dir + items.length) % items.length;
    items[currentSlide].classList.add("active");
    if (thumbs[currentSlide]) {
        thumbs[currentSlide].classList.add("active");
        thumbs[currentSlide].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
    const counter = document.getElementById("gallery-photo-counter");
    if (counter) {
        counter.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> <span>${currentSlide + 1} / ${items.length}</span>`;
    }
};

window.setCarousel = (idx) => {
    const items = document.querySelectorAll(".carousel-item");
    const thumbs = document.querySelectorAll(".thumb-item");
    if (items.length <= 1 || idx < 0 || idx >= items.length) return;
    items[currentSlide].classList.remove("active");
    if (thumbs[currentSlide]) thumbs[currentSlide].classList.remove("active");
    currentSlide = idx;
    items[currentSlide].classList.add("active");
    if (thumbs[currentSlide]) {
        thumbs[currentSlide].classList.add("active");
        thumbs[currentSlide].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
    const counter = document.getElementById("gallery-photo-counter");
    if (counter) {
        counter.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> <span>${currentSlide + 1} / ${items.length}</span>`;
    }
};

if (lightboxClose) lightboxClose.onclick = closeLightbox;

// Initialization
(async function init() {
    const propId = getSafePropertyId();
    if (!propId) return showNotFound();

    try {
        // 1. Check if it's a deleted base property
        if (window.db) {
            try {
                const delDoc = await window.db.collection("deleted_properties").doc(String(propId)).get();
                if (delDoc.exists) return showNotFound();
            } catch (err) {
                console.warn("Could not check deleted_properties, continuing...", err);
            }
        }

        // 2. Try to fetch from Firestore first (New/Edited properties)
        let property = null;
        if (window.db) {
            try {
                // Try searching by numeric ID or string ID to be robust. Remove duplicates and NaN to avoid Firestore errors.
                const searchIds = [...new Set([propId, String(propId), Number(propId)])].filter(val => val !== null && val !== undefined && !Number.isNaN(val));
                const snapshot = await window.db.collection("properties").where("id", "in", searchIds).get();
                if (!snapshot.empty) {
                    const doc = snapshot.docs[0];
                    property = normalizeProperty({ ...doc.data(), firebaseId: doc.id });
                }
            } catch (err) {
                console.warn("Firestore fetch failed, will try JSON fallback...", err);
            }
        }

        // 3. Fallback to JSON if not in Firestore or Firestore failed
        if (!property) {
            const response = await fetch(DATA_URL, { cache: "no-store" });
            if (response.ok) {
                const payload = await response.json();
                const jsonList = Array.isArray(payload?.properties) ? payload.properties : [];
                // Comparison: use String() to avoid type mismatch issues (1 === "1")
                property = jsonList.map(p => normalizeProperty(p)).find(p => String(p.id) === String(propId));
            }
        }

        if (!property) return showNotFound();

        // Ocultar al público general propiedades marcadas como no disponibles
        const isFalseFlag = (v) => v === false || String(v).trim().toLowerCase() === "false";
        const isPropUnavailable = (p) => {
            if (!p) return true;
            if (isFalseFlag(p.available) || isFalseFlag(p.disponible)) return true;
            const st = String(p.status || "").toLowerCase().trim();
            return ["vendida", "alquilada", "no_disponible", "no-disponible", "no disponible", "inactiva", "pausada", "unavailable", "baja"].includes(st);
        };

        const manager = window.AuthManager;
        const userRole = manager?.currentUserProfile?.role || manager?.getCurrentUser()?.role;
        const canManage = Boolean(
            manager && manager.isLoggedIn() && (
                manager.hasPermission(manager.Permissions.EDIT_PROPERTY) ||
                ["AGENT", "ADMIN", "SUPER_ADMIN", "EDITOR"].includes(userRole)
            )
        );

        if (isPropUnavailable(property)) {
            if (!canManage) {
                return showNotFound();
            }
        }

        currentProperty = property;
        renderDetails(property);

        if (isPropUnavailable(property) && canManage) {
            const warningBanner = document.createElement("div");
            warningBanner.className = "details-unavailable-banner";
            warningBanner.innerHTML = "🚫 <strong>Propiedad no disponible:</strong> Esta publicación está pausada y oculta para el público general. Solo es visible para el equipo administrador.";
            if (container) container.prepend(warningBanner);
        }

        // Show greeting if logged in
        const logged = window.AuthManager && window.AuthManager.isLoggedIn();
        const greeting = document.getElementById("user-greeting");
        if (greeting && logged) {
            const name = window.AuthManager.getDisplayName();
            greeting.textContent = `¡Hola ${name}!`;
            greeting.style.display = "block";
        }
    } catch (e) {
        console.error("Error loading property details:", e);
        showNotFound();
    }
})();

// Auth UI for details page
const btnLogin = document.getElementById("btn-login");
const btnLogout = document.getElementById("btn-logout");
const loginModal = document.getElementById("login-modal");
const loginClose = document.getElementById("login-close");
const loginForm = document.getElementById("login-form");

function updateDetailsAuthUI() {
    const logged = window.AuthManager && window.AuthManager.isLoggedIn();
    if (btnLogin) btnLogin.style.display = logged ? "none" : "block";
    if (btnLogout) btnLogout.style.display = logged ? "block" : "none";
}

if (btnLogin && loginModal) {
    btnLogin.onclick = () => {
        loginModal.style.display = "block";
        document.body.style.overflow = "hidden";
    };
}
if (loginClose && loginModal) {
    loginClose.onclick = () => {
        loginModal.style.display = "none";
        document.body.style.overflow = "auto";
    };
}
const btnGoogleLogin = document.getElementById("btn-google-login");
if (btnGoogleLogin) {
    btnGoogleLogin.onclick = async () => {
        btnGoogleLogin.disabled = true;
        const res = await window.AuthManager.loginWithGoogle();
        btnGoogleLogin.disabled = false;
        if (res.success) {
            loginModal.style.display = "none";
            document.body.style.overflow = "auto";
            window.location.reload(); // Reload to show admin features
        } else {
            const msg = window.AuthManager.describeLoginFailure(res);
            if (msg) alert(msg);
        }
    };
}
if (btnLogout) {
    btnLogout.onclick = () => {
        window.AuthManager.logout();
        window.location.reload();
    };
}
window.addEventListener("click", (e) => {
    if (loginModal && e.target === loginModal) {
        loginModal.style.display = "none";
        document.body.style.overflow = "auto";
    }
});

// Update auth UI on load
updateDetailsAuthUI();

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

window.downloadAllImages = async function () {
    if (!currentProperty || !currentProperty.images || currentProperty.images.length === 0) {
        alert("No hay im�genes para descargar.");
        return;
    }

    const btn = document.getElementById("btn-download-images");
    const originalContent = btn ? btn.innerHTML : "";
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span class="icon">?</span> Descargando (0/${currentProperty.images.length})`;
    }

    try {
        const zip = new JSZip();
        let downloadedCount = 0;

        const promises = currentProperty.images.map(async (url, index) => {
            try {
                const response = await fetch(url, { mode: "cors" });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const blob = await response.blob();

                let ext = "jpg";
                const contentType = response.headers.get("content-type");
                if (contentType) {
                    if (contentType.includes("png")) ext = "png";
                    else if (contentType.includes("webp")) ext = "webp";
                    else if (contentType.includes("gif")) ext = "gif";
                } else {
                    const match = url.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i);
                    if (match) ext = match[1].toLowerCase();
                }

                zip.file(`imagen_${index + 1}.${ext}`, blob);
                downloadedCount++;
                if (btn) btn.innerHTML = `<span class="icon">?</span> Descargando (${downloadedCount}/${currentProperty.images.length})`;
            } catch (err) {
                console.error("Error descargando imagen " + (index + 1) + ":", url, err);
            }
        });

        await Promise.all(promises);

        if (downloadedCount === 0) {
            alert("No se pudo descargar ninguna imagen. Esto suele ocurrir por bloqueos de seguridad (CORS) del servidor donde est�n alojadas las fotos (ej: Firebase).");
            return;
        }

        if (btn) btn.innerHTML = "<span class=\"icon\">?</span> Finalizando...";
        
        const zipBlob = await zip.generateAsync({ 
            type: "blob",
            compression: "STORE" 
        });
        
        const downloadUrl = URL.createObjectURL(zipBlob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        const sanitizeFilename = (name) => name.toLowerCase().replace(/[^a-z0-9]/gi, "_").replace(/_{2,}/g, "_");
        const filename = (sanitizeFilename(currentProperty.title) || "propiedad") + "_imagenes.zip";
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);

    } catch (err) {
        console.error("Error general en downloadAllImages:", err);
        alert("Ocurri� un error al generar el archivo: " + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    }
};
