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

function renderDetails(prop) {
    const logged = window.AuthManager && window.AuthManager.isLoggedIn();
    const safeTitle = escapeHtml(prop.title);
    const safeCategory = escapeHtml(prop.category);
    const safeDescription = escapeHtml(prop.description || "");

    container.innerHTML = `
        <div class="details-grid">
            <div class="details-left">
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

                <div class="details-description-desktop" style="margin-top: 30px; padding: 25px; background: #fff; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                    <h3 style="margin-bottom: 15px; color: var(--primary); font-size: 1.1rem; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">Descripción</h3>
                    <p class="section-subtitle" style="color: #444; line-height: 1.7; font-size: 0.95rem;">${safeDescription}</p>
                </div>
            </div>

            <div class="details-right">
                <span class="badge badge-${safeCategory}">${safeCategory.toUpperCase()}</span>
                <h1 class="details-title" style="margin-bottom: 25px;">${safeTitle}</h1>

                ${prop.customFeatures && prop.customFeatures.length ? `
                    <div class="custom-features-section" style="margin-top: 0; margin-bottom: 25px;">
                        <h3 class="section-title">Detalles y Comodidades</h3>
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
                    </div>
                ` : ""}

                <div class="details-price" style="margin-bottom: 20px;">
                    <span style="display: block; font-size: 0.9rem; color: #666; margin-bottom: 5px; font-weight: 500;">Precio</span>
                    ${formatCurrency(prop.price, prop.currency)}
                    ${prop.expensasAmount ? `
                        <div class="expensas-info" style="font-size: 1rem; color: #666; font-weight: 400; margin-top: 5px;">
                            + ${formatCurrency(prop.expensasAmount, prop.expensasCurrency || "ARS")} de expensas
                        </div>
                    ` : ""}
                </div>

                <div class="property-info-pills" style="display: flex; gap: 10px; margin-bottom: 25px; flex-wrap: wrap; border-top: 1px solid #eee; padding-top: 20px;">
                    ${prop.creditEligible ? '<span class="pill highlight-pill" style="background: #e6fffa; color: #234e52; border: 1px solid #b2f5ea; padding: 8px 15px; font-weight: 600;">✅ Apto Crédito</span>' : ""}
                    <span class="pill"><strong>Tipo:</strong> ${escapeHtml(prop.type || "N/D")}</span>
                    ${prop.areaTotal ? `<span class="pill"><strong>Terreno:</strong> ${formatNumber(prop.areaTotal)} m²</span>` : ""}
                    ${prop.areaBuilt ? `<span class="pill"><strong>Cubiertos:</strong> ${formatNumber(prop.areaBuilt)} m²</span>` : ""}
                </div>

                ${(logged && window.AuthManager.hasPermission(window.AuthManager.Permissions.VIEW_PRIVATE_DATA)) ? `
                <div class="agent-box admin-only" style="margin-bottom: 25px;">
                    <div class="agent-info">
                        <strong>Agente:</strong>
                        <span>${escapeHtml(prop.agent || "N/D")}</span>
                    </div>
                    <div class="owner-info" style="margin-top: 10px; padding-top: 10px; border-top: 1px dotted #ccc;">
                        <h4 style="margin-bottom: 5px; font-size: 0.9rem;">Datos del Propietario:</h4>
                        <p><strong>Nombre:</strong> ${escapeHtml(prop.ownerName || "N/D")}</p>
                        <p><strong>Tel:</strong> ${escapeHtml(prop.ownerPhone || "N/D")}</p>
                        <p><strong>Dirección:</strong> ${escapeHtml(prop.ownerAddress || "N/D")}</p>
                    </div>
                </div>
                ` : `
                <div class="agent-box" style="margin-bottom: 25px;">
                    <div class="agent-info">
                        <strong>Agente Asignado:</strong>
                        <span>${escapeHtml(prop.agent || "Dávalos Propiedades")}</span>
                    </div>
                </div>
                `}

                <div class="details-features" style="margin-bottom: 25px;">
                    <div class="detail-feature">
                        <span class="icon">📍</span>
                        <div>
                            <strong>Ubicación</strong>
                            <p>${prop.mapLink ? `<a href="${prop.mapLink}" target="_blank" style="color: var(--primary); text-decoration: underline;">Ver en mapa</a>` : "No disponible"}</p>
                        </div>
                    </div>
                </div>

                ${prop.memoryDescription ? `
                    <div class="memory-description-section" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; margin-bottom: 25px;">
                        <h3 class="section-title">Memoria Descriptiva</h3>
                        <div class="memory-content" style="white-space: pre-line; line-height: 1.6; color: #555;">
                            ${escapeHtml(prop.memoryDescription)}
                        </div>
                    </div>
                ` : ""}

                <div class="contact-card">
                    <h3>¿Te interesa esta propiedad?</h3>
                    <p>Contáctanos para coordinar una visita o recibir más información.</p>
                    <a class="btn btn-full btn-whatsapp" target="_blank" rel="noopener noreferrer" href="${buildWhatsappUrl(prop)}">Consultar por WhatsApp</a>
                    <a class="btn btn-full btn-outline" href="tel:+${getAgentPhone(prop)}">Llamar ahora</a>
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
