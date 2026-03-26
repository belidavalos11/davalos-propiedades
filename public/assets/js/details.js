const DATA_URL = "data/properties.json";
const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80";
const WHATSAPP_NUMBER = "5493875053884";
const PHONE_NUMBER = "+5491123456789";

// DOM Elements
const container = document.getElementById("details-container");
const floatingContact = document.getElementById("floating-contact");
const floatingWhatsapp = document.getElementById("floating-whatsapp");
const floatingCall = document.getElementById("floating-call");
const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightbox-image");
const lightboxClose = document.getElementById("lightbox-close");

let currentSlide = 0;

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
    const id = Number(prop.id) || 0;
    const title = String(prop.title || "").trim();
    const price = Number(prop.price) || 0;
    const rooms = Number(prop.rooms) || 0;
    const area = Number(prop.area) || 0;
    const images = (Array.isArray(prop.images) ? prop.images : [])
        .map((img) => safeImageUrl(img))
        .filter(Boolean);

    return {
        ...prop,
        id,
        title,
        price,
        rooms,
        area,
        images: images.length ? images : [PLACEHOLDER_IMAGE]
    };
}

function getSafePropertyId() {
    const raw = new URLSearchParams(window.location.search).get("id");
    return raw ? Number(raw) : null;
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
    if (!prop || !prop.agent) return WHATSAPP_NUMBER;
    if (window.AuthManager) {
        const users = window.AuthManager.getAllUsers();
        const agentUser = users.find(u => u.displayName === prop.agent || u.username === prop.agent);
        if (agentUser && agentUser.phone) {
            const numericPhone = agentUser.phone.replace(/\D/g, '');
            if (numericPhone) return numericPhone;
        }
    }
    return WHATSAPP_NUMBER;
}

function buildWhatsappUrl(prop) {
    const propertyUrl = window.location.href;
    const text = encodeURIComponent(`Hola, quiero consultar por "${prop.title}" (ID ${prop.id}). Link: ${propertyUrl}`);
    const phone = getAgentPhone(prop);
    return `https://wa.me/${phone}?text=${text}`;
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
    return typeof feat === 'string' ? feat.match(/\d+/) : feat.qty;
}

function renderDetails(prop) {
    const logged = window.AuthManager && window.AuthManager.isLoggedIn();
    const safeTitle = escapeHtml(prop.title);
    const safeCategory = escapeHtml(prop.category);
    const safeDescription = escapeHtml(prop.description || "");

    container.innerHTML = `
        <!-- Section 1: Gallery -->
        <div class="details-gallery-section" style="margin-bottom: 20px;">
            <div class="carousel" id="property-carousel">
                <div class="carousel-inner" id="carousel-inner">
                    ${prop.images.map((img, index) => `
                        <div class="carousel-item ${index === 0 ? "active" : ""}">
                            <img loading="lazy" src="${img}" alt="${safeTitle}" class="carousel-img">
                        </div>
                    `).join("")}
                </div>
                ${prop.images.length > 1 ? `
                    <button class="carousel-control prev" type="button" onclick="moveCarousel(-1)">&#10094;</button>
                    <button class="carousel-control next" type="button" onclick="moveCarousel(1)">&#10095;</button>
                    <div class="carousel-indicators">
                        ${prop.images.map((_, index) => `<span class="dot ${index === 0 ? "active" : ""}" onclick="setCarousel(${index})"></span>`).join("")}
                    </div>
                ` : ""}
            </div>
            ${prop.images.length > 1 ? `
                <div class="carousel-thumbnails" id="carousel-thumbnails">
                    ${prop.images.map((img, index) => `
                        <div class="thumb-item ${index === 0 ? "active" : ""}" onclick="setCarousel(${index})">
                            <img src="${img}" alt="Thumbnail ${index + 1}">
                        </div>
                    `).join("")}
                </div>
            ` : ""}
        </div>

        <!-- Section 2: Header Row (Title & Price) -->
        <div class="details-header-row">
            <div class="details-title-block">
                <span class="badge badge-${safeCategory}" style="margin-bottom: 8px; display: inline-block;">${safeCategory.toUpperCase()}</span>
                <h1>${safeTitle}</h1>
                <div class="details-location-breadcrumb">
                    🏠 ${escapeHtml(prop.type || "N/D")} en ${safeCategory} | 📍 Ubicación disponible
                    ${prop.mapLink ? `<a href="${prop.mapLink}" target="_blank" style="margin-left: 10px; color: var(--primary); font-weight: 600;">Ver mapa</a>` : ""}
                </div>
            </div>
            <div class="details-price-block">
                <div class="price-main">${formatCurrency(prop.price, prop.currency)}</div>
                ${prop.expensasAmount ? `
                    <div class="expensas-sub">+ ${formatCurrency(prop.expensasAmount, prop.expensasCurrency || "ARS")} expensas</div>
                ` : ""}
            </div>
        </div>

        <!-- Section 3: Horizontal Features Bar -->
        <div class="features-horizontal-bar">
            ${prop.areaTotal ? `
                <div class="feat-bar-item">
                    <span class="feat-bar-label">Sup. total</span>
                    <span class="feat-bar-value">${formatNumber(prop.areaTotal)} m²</span>
                </div>
            ` : ""}
            ${prop.areaBuilt ? `
                <div class="feat-bar-item">
                    <span class="feat-bar-label">Sup. cubierta</span>
                    <span class="feat-bar-value">${formatNumber(prop.areaBuilt)} m²</span>
                </div>
            ` : ""}
            <div class="feat-bar-item">
                <span class="feat-bar-label">Dormitorios</span>
                <span class="feat-bar-value">${prop.rooms || "-"}</span>
            </div>
            <div class="feat-bar-item">
                <span class="feat-bar-label">Baños</span>
                <span class="feat-bar-value">${getFeatureVal('baño', prop) || "-"}</span>
            </div>
            ${prop.creditEligible ? `
                <div class="feat-bar-item">
                    <span class="feat-bar-label">Crédito</span>
                    <span class="feat-bar-value" style="color: #2e7d32;">Apto ✅</span>
                </div>
            ` : ""}
        </div>

        <!-- Section 4: Main Content Grid -->
        <div class="details-content-columns">
            <div class="column-left-main">
                <section class="description-section">
                    <h2>Descripción</h2>
                    <div style="white-space: pre-line; line-height: 1.8; color: #444; font-size: 1.05rem;">
                        ${safeDescription}
                    </div>
                </section>

                ${prop.customFeatures && prop.customFeatures.length ? `
                    <section class="comodidades-section">
                        <h2>Más detalles y comodidades</h2>
                        <div class="features-grid">
                            ${prop.customFeatures.map((feat) => {
                                const isObj = typeof feat === 'object';
                                const icon = isObj ? feat.icon : "✨";
                                const name = isObj ? feat.name : feat;
                                const qty = (isObj && feat.qty) ? `${feat.qty} ` : "";
                                return `
                                            <div class="feature-item">
                                                <span class="feature-icon">${icon}</span>
                                                <span class="feature-text"><strong>${qty ? formatNumber(qty) + ' ' : ''}${name}</strong></span>
                                            </div>
                                        `;
                            }).join("")}
                        </div>
                    </section>
                ` : ""}

                ${prop.memoryDescription ? `
                    <section class="memory-section">
                        <h2>Memoria Descriptiva</h2>
                        <div style="white-space: pre-line; line-height: 1.8; color: #555; background: #fdfdfd; padding: 20px; border-left: 4px solid var(--primary); border-radius: 4px;">
                            ${escapeHtml(prop.memoryDescription)}
                        </div>
                    </section>
                ` : ""}
            </div>

            <div class="column-right-sidebar">
                <div class="contact-card-v2">
                    <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                        <button class="btn btn-outline" style="flex: 1; font-size: 0.8rem; padding: 8px;" onclick="window.print()">🖨️ Imprimir</button>
                        <button class="btn btn-outline" style="flex: 1; font-size: 0.8rem; padding: 8px;" onclick="navigator.share({title: '${safeTitle}', url: window.location.href})">🔗 Compartir</button>
                    </div>

                    <h3>Contáctanos</h3>
                    <p style="font-size: 0.9rem; color: #666; margin-bottom: 20px;">Envíanos tu consulta y un asesor te contactará a la brevedad.</p>
                    
                    <div class="btn-group-v2">
                        <a class="btn btn-full btn-whatsapp" target="_blank" rel="noopener noreferrer" href="${buildWhatsappUrl(prop)}">
                            <span>📱 Contactar por WhatsApp</span>
                        </a>
                        <a class="btn btn-full btn-outline" href="tel:+${getAgentPhone(prop)}" style="background: var(--primary); color: #fff;">
                            <span>📞 Llamar ahora</span>
                        </a>
                    </div>

                    <div style="margin-top: 25px; pt: 15px; border-top: 1px solid #eee;">
                        <span style="display: block; font-size: 0.75rem; color: #999; text-transform: uppercase; font-weight: 700; margin-bottom: 8px;">Agente a cargo</span>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 40px; height: 40px; background: #eee; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; color: var(--primary);">
                                ${escapeHtml(prop.agent || "D").charAt(0)}
                            </div>
                            <span style="font-weight: 600; color: var(--text-dark);">${escapeHtml(prop.agent || "Dávalos Propiedades")}</span>
                        </div>
                    </div>

                    ${(logged && window.AuthManager.hasPermission(window.AuthManager.Permissions.VIEW_PRIVATE_DATA)) ? `
                        <div style="margin-top: 15px; padding: 12px; background: #fff5f5; border-radius: 8px; border: 1px solid #fed7d7;">
                            <span style="display: block; font-size: 0.7rem; color: #c53030; font-weight: 600; text-transform: uppercase;">🔒 Datos Privados (Admin)</span>
                            <p style="font-size: 0.85rem; margin-top: 5px;"><strong>Owner:</strong> ${escapeHtml(prop.ownerName || "N/D")}</p>
                            <p style="font-size: 0.85rem;"><strong>Tel:</strong> ${escapeHtml(prop.ownerPhone || "N/D")}</p>
                        </div>
                    ` : ""}
                </div>
            </div>
        </div>
    `;

    bindLightbox();
    setupFloating(prop);
}

function bindLightbox() {
    const imgs = document.querySelectorAll(".carousel-img");
    imgs.forEach(img => {
        img.onclick = () => {
            lightboxImage.src = img.src;
            lightbox.style.display = "flex";
            document.body.style.overflow = "hidden";
        };
    });
}

function setupFloating(prop) {
    if (!floatingContact) return;
    floatingWhatsapp.href = buildWhatsappUrl(prop);
    floatingCall.href = `tel:+${getAgentPhone(prop)}`;
    floatingContact.style.display = "flex";
}

// Carousel global handlers
window.moveCarousel = (dir) => {
    const items = document.querySelectorAll(".carousel-item");
    const dots = document.querySelectorAll(".dot");
    if (items.length <= 1) return;
    items[currentSlide].classList.remove("active");
    if (dots[currentSlide]) dots[currentSlide].classList.remove("active");
    currentSlide = (currentSlide + dir + items.length) % items.length;
    items[currentSlide].classList.add("active");
    if (dots[currentSlide]) dots[currentSlide].classList.add("active");
};

window.setCarousel = (idx) => {
    const items = document.querySelectorAll(".carousel-item");
    const dots = document.querySelectorAll(".dot");
    items[currentSlide].classList.remove("active");
    if (dots[currentSlide]) dots[currentSlide].classList.remove("active");
    currentSlide = idx;
    items[currentSlide].classList.add("active");
    if (dots[currentSlide]) dots[currentSlide].classList.add("active");
};

if (lightboxClose) lightboxClose.onclick = () => {
    lightbox.style.display = "none";
    document.body.style.overflow = "auto";
};

// Initialization
(async function init() {
    const propId = getSafePropertyId();
    if (!propId) return showNotFound();

    try {
        // 1. Check if it's a deleted base property
        if (window.db) {
            const delDoc = await window.db.collection("deleted_properties").doc(String(propId)).get();
            if (delDoc.exists) return showNotFound();
        }

        // 2. Try to fetch from Firestore first (New/Edited properties)
        let property = null;
        if (window.db) {
            const snapshot = await window.db.collection("properties").where("id", "==", propId).get();
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                property = normalizeProperty({ ...doc.data(), firebaseId: doc.id });
            }
        }

        // 3. Fallback to JSON if not in Firestore
        if (!property) {
            const response = await fetch(DATA_URL, { cache: "no-store" });
            if (response.ok) {
                const payload = await response.json();
                const jsonList = Array.isArray(payload?.properties) ? payload.properties : [];
                property = jsonList.map(p => normalizeProperty(p)).find(p => p.id === propId);
            }
        }

        if (!property) return showNotFound();
        renderDetails(property);

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
