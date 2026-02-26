// State Management
const properties = JSON.parse(localStorage.getItem('davalos_properties')) || [];

const container = document.getElementById('details-container');

// Get Prop ID from URL
const urlParams = new URLSearchParams(window.location.search);
const propId = parseInt(urlParams.get('id'));

const property = properties.find(p => p.id === propId);

if (!property) {
    container.innerHTML = `
        <div class="no-results">
            <h2>Propiedad no encontrada</h2>
            <p>Lo sentimos, no pudimos encontrar la propiedad que buscas.</p>
            <a href="index.html" class="btn btn-primary" style="margin-top: 20px; display: inline-block;">Volver al Inicio</a>
        </div>
    `;
} else {
    renderDetails(property);
}

function renderDetails(prop) {
    const images = prop.images && prop.images.length > 0
        ? prop.images
        : ['https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80'];

    container.innerHTML = `
        <div class="details-grid">
            <div class="details-left">
                <!-- Carousel -->
                <div class="carousel">
                    <div class="carousel-inner" id="carousel-inner">
                        ${images.map((img, index) => `
                            <div class="carousel-item ${index === 0 ? 'active' : ''}">
                                <img src="${img}" alt="${prop.title}">
                            </div>
                        `).join('')}
                    </div>
                    ${images.length > 1 ? `
                        <button class="carousel-control prev" onclick="moveCarousel(-1)">&#10094;</button>
                        <button class="carousel-control next" onclick="moveCarousel(1)">&#10095;</button>
                        <div class="carousel-indicators">
                            ${images.map((_, index) => `
                                <span class="dot ${index === 0 ? 'active' : ''}" onclick="setCarousel(${index})"></span>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>

            <div class="details-right">
                <span class="badge badge-${prop.category}">${prop.category.toUpperCase()}</span>
                <h1 class="details-title">${prop.title}</h1>
                <div class="details-price">USD ${prop.price.toLocaleString()}</div>
                
                <div class="details-features">
                    <div class="detail-feature">
                        <span class="icon">🛏️</span>
                        <div>
                            <strong>${prop.rooms}</strong>
                            <p>Ambientes</p>
                        </div>
                    </div>
                    <div class="detail-feature">
                        <span class="icon">📐</span>
                        <div>
                            <strong>${prop.area} m²</strong>
                            <p>Superficie</p>
                        </div>
                    </div>
                </div>

                <div class="agent-box">
                    <div class="agent-info">
                        <strong>👤 Encargado:</strong>
                        <span>${prop.agent || 'Admin'}</span>
                    </div>
                    ${AuthManager.isLoggedIn() ? `
                        <div class="owner-info">
                            <strong>🏠 Propietario:</strong>
                            <span>${prop.owner || 'N/A'}</span>
                        </div>
                    ` : ''}
                </div>

                ${prop.customFeatures && prop.customFeatures.length > 0 ? `
                    <div class="custom-features-list">
                        <h3>Características Exclusivas</h3>
                        <ul>
                            ${prop.customFeatures.map(f => `<li><span>✓</span> ${f}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}

                <div class="contact-card">
                    <h3>¿Te interesa esta propiedad?</h3>
                    <p>Contacta con nosotros para coordinar una visita.</p>
                    <button class="btn btn-full btn-whatsapp">Consultar por WhatsApp</button>
                    <button class="btn btn-full btn-outline">Llamar Ahora</button>
                </div>
            </div>
        </div>
    `;
}

// Carousel logic
let currentSlide = 0;

window.moveCarousel = (direction) => {
    const items = document.querySelectorAll('.carousel-item');
    const dots = document.querySelectorAll('.dot');
    if (items.length <= 1) return;

    items[currentSlide].classList.remove('active');
    dots[currentSlide].classList.remove('active');

    currentSlide = (currentSlide + direction + items.length) % items.length;

    items[currentSlide].classList.add('active');
    dots[currentSlide].classList.add('active');
};

window.setCarousel = (index) => {
    const items = document.querySelectorAll('.carousel-item');
    const dots = document.querySelectorAll('.dot');

    items[currentSlide].classList.remove('active');
    dots[currentSlide].classList.remove('active');

    currentSlide = index;

    items[currentSlide].classList.add('active');
    dots[currentSlide].classList.add('active');
};
