const DATA_URL = "data/properties.json";
const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80";
const WHATSAPP_NUMBER = "5493875053884";
const PHONE_NUMBER = "+5491123456789";

const container = document.getElementById("details-container");
const floatingContact = document.getElementById("floating-contact");
const floatingWhatsapp = document.getElementById("floating-whatsapp");
const floatingCall = document.getElementById("floating-call");
const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightbox-image");
const lightboxClose = document.getElementById("lightbox-close");

let currentSlide = 0;

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
    const price = Number(prop.price);
    const rooms = Number(prop.rooms);
    const area = Number(prop.area);
    const category = prop.category === "alquiler" ? "alquiler" : "venta";
    const owner = String(prop.owner || "").trim();
    const agent = String(prop.agent || "").trim();
    const customFeatures = Array.isArray(prop.customFeatures)
        ? prop.customFeatures.map((f) => String(f).trim()).filter(Boolean)
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
        price,
        rooms,
        area,
        category,
        owner,
        agent,
        customFeatures,
        images: images.length ? images : [PLACEHOLDER_IMAGE]
    };
}

function getSafePropertyId() {
    const raw = new URLSearchParams(window.location.search).get("id");
    if (!raw || !/^\d{1,16}$/.test(raw)) return null;
    const id = Number(raw);
    return Number.isSafeInteger(id) ? id : null;
}

function formatCurrency(value) {
    return `USD ${value.toLocaleString("es-AR")}`;
}

function buildWhatsappUrl(prop) {
    const propertyUrl = new URL(`details.html?id=${encodeURIComponent(prop.id)}`, window.location.origin).toString();
    const text = encodeURIComponent(`Hola, quiero consultar por \"${prop.title}\" (ID ${prop.id}). Link: ${propertyUrl}`);
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
                                <img loading="lazy" src="${img}" alt="${safeTitle}" data-lightbox-src="${img}">
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

                <div class="agent-box">
                    <div class="agent-info">
                        <strong>Encargado:</strong>
                        <span>${escapeHtml(prop.agent || "N/D")}</span>
                    </div>
                    <div class="owner-info">
                        <strong>Propietario:</strong>
                        <span>${escapeHtml(prop.owner || "N/D")}</span>
                    </div>
                </div>

                ${prop.customFeatures.length ? `
                    <div class="custom-features-list">
                        <h3>Caracteristicas</h3>
                        <ul>
                            ${prop.customFeatures.map((feature) => `<li><span>+</span> ${escapeHtml(feature)}</li>`).join("")}
                        </ul>
                    </div>
                ` : ""}

                <div class="contact-card">
                    <h3>Te interesa esta propiedad?</h3>
                    <p>Contactanos para coordinar una visita o recibir mas informacion.</p>
                    <a class="btn btn-full btn-whatsapp" target="_blank" rel="noopener noreferrer" href="${buildWhatsappUrl(prop)}">Consultar por WhatsApp</a>
                    <a class="btn btn-full btn-outline" href="tel:${PHONE_NUMBER}">Llamar ahora</a>
                </div>
            </div>
        </div>
    `;

    bindCarouselLightbox();
    setupFloatingContact(prop);
}

function bindCarouselLightbox() {
    const images = container.querySelectorAll("[data-lightbox-src]");
    images.forEach((img) => {
        img.addEventListener("click", () => {
            const src = img.getAttribute("data-lightbox-src");
            if (!src) return;
            lightboxImage.src = src;
            lightbox.style.display = "flex";
            document.body.style.overflow = "hidden";
        });
    });
}

function closeLightbox() {
    lightbox.style.display = "none";
    lightboxImage.src = "";
    document.body.style.overflow = "";
}

function setupFloatingContact(prop) {
    if (!floatingContact || !floatingWhatsapp || !floatingCall) return;
    floatingWhatsapp.href = buildWhatsappUrl(prop);
    floatingCall.href = `tel:${PHONE_NUMBER}`;
    floatingContact.style.display = "flex";
}

window.moveCarousel = (direction) => {
    const items = document.querySelectorAll(".carousel-item");
    const dots = document.querySelectorAll(".dot");
    if (items.length <= 1) return;

    items[currentSlide].classList.remove("active");
    if (dots[currentSlide]) dots[currentSlide].classList.remove("active");

    currentSlide = (currentSlide + direction + items.length) % items.length;

    items[currentSlide].classList.add("active");
    if (dots[currentSlide]) dots[currentSlide].classList.add("active");
};

window.setCarousel = (index) => {
    const items = document.querySelectorAll(".carousel-item");
    const dots = document.querySelectorAll(".dot");
    if (!items[index]) return;

    items[currentSlide].classList.remove("active");
    if (dots[currentSlide]) dots[currentSlide].classList.remove("active");

    currentSlide = index;

    items[currentSlide].classList.add("active");
    if (dots[currentSlide]) dots[currentSlide].classList.add("active");
};

lightboxClose.addEventListener("click", closeLightbox);
lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
});
window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeLightbox();
});

(async function init() {
    const propId = getSafePropertyId();
    if (!propId) {
        showNotFound();
        return;
    }

    try {
        const response = await fetch(DATA_URL, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();

        const list = Array.isArray(payload?.properties) ? payload.properties : [];
        const properties = list.map((item) => normalizeProperty(item)).filter(Boolean);
        const property = properties.find((p) => p.id === propId);

        if (!property) {
            showNotFound();
            return;
        }

        renderDetails(property);
    } catch (error) {
        console.error("Error loading detail:", error);
        showNotFound();
    }
})();
