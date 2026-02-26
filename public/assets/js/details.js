const LS_KEY = "davalos_properties";
const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80";
const WHATSAPP_NUMBER = "5491123456789";
const PHONE_NUMBER = "+5491123456789";

const DEFAULT_PROPERTIES = [
    {
        id: 1,
        title: "Residencia Colonial en Zona Norte",
        price: 450000,
        category: "venta",
        rooms: 5,
        area: 320,
        images: ["https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=800&q=80"],
        owner: "Juan Perez",
        agent: "Admin"
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
        agent: "Admin"
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
        agent: "Belid"
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
        agent: "Belid"
    }
];

const rawProperties = JSON.parse(localStorage.getItem(LS_KEY));
const properties = sanitizeProperties(Array.isArray(rawProperties) && rawProperties.length ? rawProperties : DEFAULT_PROPERTIES);
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
    if (trimmed.startsWith("data:image/")) return trimmed;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return null;
}

function sanitizeProperties(list) {
    if (!Array.isArray(list)) return [];

    return list
        .map((prop) => {
            const id = Number(prop.id);
            const title = String(prop.title || "").trim();
            const price = Number(prop.price);
            const rooms = Number(prop.rooms);
            const area = Number(prop.area);
            const category = prop.category === "alquiler" ? "alquiler" : "venta";
            const owner = String(prop.owner || "").trim();
            const agent = String(prop.agent || "").trim();
            const customFeatures = Array.isArray(prop.customFeatures)
                ? prop.customFeatures.map((f) => String(f).trim()).filter(Boolean)
                : [];

            const rawImages = Array.isArray(prop.images)
                ? prop.images
                : (prop.image ? [prop.image] : []);

            const images = rawImages.map((img) => safeImageUrl(img)).filter(Boolean);

            if (!Number.isFinite(id) || !title || !Number.isFinite(price) || !Number.isFinite(rooms) || !Number.isFinite(area)) {
                return null;
            }

            return {
                id,
                title,
                price,
                rooms,
                area,
                category,
                owner,
                agent,
                customFeatures,
                images: images.length ? images : [PLACEHOLDER_IMAGE]
            };
        })
        .filter(Boolean);
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
    const text = encodeURIComponent(`Hola, quiero consultar por \"${prop.title}\" (ID ${prop.id}).`);
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

                ${AuthManager.isLoggedIn() ? `
                    <div class="agent-box">
                        <div class="agent-info">
                            <strong>Encargado:</strong>
                            <span>${escapeHtml(prop.agent || "Admin")}</span>
                        </div>
                        <div class="owner-info">
                            <strong>Propietario:</strong>
                            <span>${escapeHtml(prop.owner || "N/D")}</span>
                        </div>
                    </div>
                ` : ""}

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

(function init() {
    const propId = getSafePropertyId();
    if (!propId) {
        showNotFound();
        return;
    }

    const property = properties.find((p) => p.id === propId);
    if (!property) {
        showNotFound();
        return;
    }

    renderDetails(property);
})();
