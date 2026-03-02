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

function formatCurrency(value) {
    return `USD ${value.toLocaleString("es-AR")}`;
}

function buildWhatsappUrl(prop) {
    const propertyUrl = window.location.href;
    const text = encodeURIComponent(`Hola, quiero consultar por "${prop.title}" (ID ${prop.id}). Link: ${propertyUrl}`);
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
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
            </div>

            <div class="details-right">
                <span class="badge badge-${safeCategory}">${safeCategory.toUpperCase()}</span>
                <h1 class="details-title">${safeTitle}</h1>
                <p class="section-subtitle">${safeDescription}</p>
                <div class="details-price">${formatCurrency(prop.price)}</div>

                <div class="details-features">
                    <div class="detail-feature">
                        <span class="icon">Amb.</span>
                        <div>
                            <strong>${prop.rooms}</strong>
                            <p>Ambientes</p>
                        </div>
                    </div>
                    <div class="detail-feature">
                        <span class="icon">m2</span>
                        <div>
                            <strong>${prop.area}</strong>
                            <p>Superficie</p>
                        </div>
                    </div>
                </div>

                ${logged ? `
                <div class="agent-box admin-only">
                    <div class="agent-info">
                        <strong>Encargado:</strong>
                        <span>${escapeHtml(prop.agent || "N/D")}</span>
                    </div>
                    <div class="owner-info">
                        <strong>Propietario:</strong>
                        <span>${escapeHtml(prop.owner || "N/D")}</span>
                    </div>
                </div>
                ` : ""}

                ${prop.customFeatures && prop.customFeatures.length ? `
                    <div class="custom-features-list">
                        <h3>Características</h3>
                        <ul>
                            ${prop.customFeatures.map((feature) => `<li><span>+</span> ${escapeHtml(feature)}</li>`).join("")}
                        </ul>
                    </div>
                ` : ""}

                <div class="contact-card">
                    <h3>¿Te interesa esta propiedad?</h3>
                    <p>Contáctanos para coordinar una visita o recibir más información.</p>
                    <a class="btn btn-full btn-whatsapp" target="_blank" rel="noopener noreferrer" href="${buildWhatsappUrl(prop)}">Consultar por WhatsApp</a>
                    <a class="btn btn-full btn-outline" href="tel:${PHONE_NUMBER}">Llamar ahora</a>
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
    floatingCall.href = `tel:${PHONE_NUMBER}`;
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
        const response = await fetch(DATA_URL, { cache: "no-store" });
        let jsonList = [];
        if (response.ok) {
            const payload = await response.json();
            jsonList = Array.isArray(payload?.properties) ? payload.properties : [];
        }

        const localList = JSON.parse(localStorage.getItem("davalos_properties") || "[]");
        const all = [...localList, ...jsonList];
        const property = all.map(p => normalizeProperty(p)).find(p => p.id === propId);

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
        console.error(e);
        showNotFound();
    }
})();
