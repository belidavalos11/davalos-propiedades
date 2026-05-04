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
const lightboxPrev = document.getElementById("lightbox-prev");
const lightboxNext = document.getElementById("lightbox-next");

let currentSlide = 0;
let currentLightboxImages = [];
let currentLightboxIndex = 0;

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
    const category = String(prop.category || "venta").toLowerCase();
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
        category,
        price,
        rooms,
        area,
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
    if (!prop || !prop.agent) return WHATSAPP_NUMBER;
    if (window.AuthManager) {
        const users = window.AuthManager.getAllUsersSync();
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
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                    <h1 style="margin: 0;">${safeTitle}</h1>
                    ${prop.mapLink ? `<a href="${prop.mapLink}" target="_blank" style="color: var(--primary); font-weight: 600; font-size: 0.9rem; text-decoration: none; display: flex; align-items: center; gap: 4px;"><span style="font-size: 1.1rem;">🗺️</span> Ver mapa</a>` : ""}
                </div>
                <div class="details-location-breadcrumb">
                    ${escapeHtml(prop.type || "N/D")} en ${safeCategory.charAt(0).toUpperCase() + safeCategory.slice(1)}, ${escapeHtml(prop.location || "Salta")}
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
                    <div class="feat-icon-svg">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h18v18H3z"></path><path d="M3 9h18"></path><path d="M9 21V9"></path></svg>
                    </div>
                    <div class="feat-content">
                        <span class="feat-bar-label">Sup. total:</span>
                        <span class="feat-bar-value">${formatNumber(prop.areaTotal)} m²</span>
                    </div>
                </div>
            ` : ""}
            ${prop.areaBuilt ? `
                <div class="feat-bar-item">
                    <div class="feat-icon-svg">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18V3H3zm13 13H8v-2h8v2zm0-4H8v-2h8v2z"></path></svg>
                    </div>
                    <div class="feat-content">
                        <span class="feat-bar-label">Sup. cubierta:</span>
                        <span class="feat-bar-value">${formatNumber(prop.areaBuilt)} m²</span>
                    </div>
                </div>
            ` : ""}
            <div class="feat-bar-item">
                <div class="feat-icon-svg">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"></path><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"></path><path d="M12 4v6"></path><path d="M2 18h20"></path></svg>
                </div>
                <div class="feat-content">
                    <span class="feat-bar-label">Dormitorio/s:</span>
                    <span class="feat-bar-value">${prop.rooms || getFeatureVal('dormitorio', prop) || getFeatureVal('habitacio', prop) || "-"}</span>
                </div>
            </div>
            <div class="feat-bar-item">
                <div class="feat-icon-svg">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14h18l-2 6H6a3 3 0 0 1-3-3V5c0-2 2-3 4-3s4 1 5 3"></path><path d="M11 5l3 3"></path></svg>
                </div>
                <div class="feat-content">
                    <span class="feat-bar-label">Baño/s:</span>
                    <span class="feat-bar-value">${getFeatureVal('baño', prop) || "-"}</span>
                </div>
            </div>
            ${prop.creditEligible ? `
                <div class="feat-bar-item">
                    <div class="feat-icon-svg">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 7h7l-5 5 2 7-7-4-7 4 2-7-5-5h7z"></path></svg>
                    </div>
                    <div class="feat-content">
                        <span class="feat-bar-label">Crédito:</span>
                        <span class="feat-bar-value" style="color: #2e7d32;">Apto ✅</span>
                    </div>
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
                <div class="sidebar-actions-row">
                    <button class="btn btn-sidebar-action" onclick="shareProperty()"><span class="icon">🔗</span> Compartir</button>
                    <button class="btn btn-sidebar-action" onclick="window.print()"><span class="icon">🖨️</span> Imprimir</button>
                </div>

                <div class="contact-card-v3">
                    <div class="contact-card-header">
                        <h3>Contáctanos</h3>
                        <span class="required-note">* Campos obligatorios</span>
                    </div>
                    
                    <form id="contact-form-sidebar" class="sidebar-form">
                        <div class="form-group-sidebar">
                            <input type="text" id="contact-name" placeholder="Nombre *" required>
                        </div>
                        <div class="form-group-sidebar">
                            <input type="tel" id="contact-phone" placeholder="Teléfono *" required>
                        </div>
                        <div class="form-group-sidebar">
                            <input type="email" id="contact-email" placeholder="Email *" required>
                        </div>
                        <div class="form-group-sidebar">
                            <textarea id="contact-msg" rows="4">Hola, vi esta propiedad en el sitio web de la inmobiliaria y me gustaría que me contacten. Cód. aviso: ${prop.id}. Gracias.</textarea>
                        </div>
                        <button type="submit" class="btn btn-full btn-dark-sidebar">Contactar</button>
                        <a class="btn btn-full btn-whatsapp-v2" target="_blank" rel="noopener noreferrer" href="${buildWhatsappUrl(prop)}">
                            <span>Contactar por WhatsApp</span>
                        </a>
                    </form>

                    <div class="agent-compact-info">
                        <span class="agent-label">Agente a cargo</span>
                        <div class="agent-row">
                            <div class="agent-avatar">${escapeHtml(prop.agent || "D").charAt(0)}</div>
                            <span class="agent-name">${escapeHtml(prop.agent || "Dávalos Propiedades")}</span>
                        </div>
                    </div>

                    ${(logged && window.AuthManager.hasPermission(window.AuthManager.Permissions.VIEW_PRIVATE_DATA)) ? `
                        <div class="admin-data-box">
                            <span class="admin-label">🔒 Datos Privados (Admin)</span>
                            <p><strong>Owner:</strong> ${escapeHtml(prop.ownerName || "N/D")}</p>
                            <p><strong>Tel:</strong> ${escapeHtml(prop.ownerPhone || "N/D")}</p>
                        </div>
                    ` : ""}
                </div>
            </div>
        </div>

        <section class="location-section" style="margin-top: 40px; border-top: 1px solid #eee; padding-top: 30px;">
            <h2>Ubicación</h2>
            <div style="display: flex; align-items: center; gap: 10px; margin-top: 10px; color: #444;">
                <span>📍 ${escapeHtml(prop.title)}</span>
            </div>
            ${prop.mapLink ? `
                <div class="map-iframe-container" style="margin-top: 20px; border-radius: 12px; overflow: hidden; height: 400px; background: #eee;">
                    <iframe width="100%" height="100%" frameborder="0" style="border:0" src="${prop.mapLink.includes('google.com/maps/embed') ? prop.mapLink : `https://www.google.com/maps/embed/v1/place?key=YOUR_API_KEY&q=${encodeURIComponent(prop.title)}`}" allowfullscreen></iframe>
                </div>
            ` : ""}
        </section>
    `;

    bindLightbox(prop.images);
    setupFloating(prop);
}

function shareProperty() {
    const shareData = {
        title: document.title,
        text: 'Mira esta propiedad en Dávalos Propiedades',
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
