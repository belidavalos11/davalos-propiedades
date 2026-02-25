// Initial mock data
const initialProperties = [
    {
        id: 1,
        title: "Residencia Colonial en Zona Norte",
        price: 450000,
        category: "venta",
        rooms: 5,
        area: 320,
        images: ["https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=800&q=80"],
        owner: "Juan Pérez",
        agent: "Admin"
    },
    {
        id: 2,
        title: "Penthouse de Lujo con Vista al Río",
        price: 1200,
        category: "alquiler",
        rooms: 3,
        area: 110,
        images: ["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80"],
        owner: "María García",
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
        owner: "Roberto Sánchez",
        agent: "Belid"
    },
    {
        id: 4,
        title: " Loft Industrial Soho",
        price: 850,
        category: "alquiler",
        rooms: 1,
        area: 55,
        images: ["https://images.unsplash.com/photo-1505691938895-1758d7eaa511?auto=format&fit=crop&w=800&q=80"],
        owner: "Carlos López",
        agent: "Belid"
    }
];

// State Management
let properties = JSON.parse(localStorage.getItem('davalos_properties')) || initialProperties;

// Support for old data (migration)
properties = properties.map(p => {
    if (p.image && !p.images) {
        p.images = [p.image];
        delete p.image;
    }
    return p;
});

// DOM Elements
const grid = document.getElementById('properties-grid');
const filterType = document.getElementById('filter-type');
const propertyForm = document.getElementById('property-form');
const btnAddProperty = document.getElementById('btn-add-property');
const modal = document.getElementById('property-modal');
const closeModal = document.getElementById('close-modal');

// Auth Elements
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const btnSettings = document.getElementById('btn-settings');
const loginModal = document.getElementById('login-modal');
const closeLoginModal = document.getElementById('close-login-modal');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

// Settings Elements
const settingsModal = document.getElementById('settings-modal');
const closeSettingsModal = document.getElementById('close-settings-modal');
const settingsForm = document.getElementById('settings-form');
const settingsError = document.getElementById('settings-error');
const settingsSuccess = document.getElementById('settings-success');

// Functions
function updateAuthUI() {
    const logged = AuthManager.isLoggedIn();
    if (logged) {
        btnLogin.style.display = 'none';
        btnLogout.style.display = 'block';
        btnSettings.style.display = 'block';
        btnAddProperty.style.display = 'block';
    } else {
        btnLogin.style.display = 'block';
        btnLogout.style.display = 'none';
        btnSettings.style.display = 'none';
        btnAddProperty.style.display = 'none';
    }
}

function renderProperties(filter = 'todos') {
    grid.innerHTML = '';

    const filtered = filter === 'todos'
        ? properties
        : properties.filter(p => p.category === filter);

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="no-results">No se encontraron propiedades.</div>';
        return;
    }

    filtered.forEach(prop => {
        const coverImage = (prop.images && prop.images.length > 0)
            ? prop.images[0]
            : 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80';

        const card = document.createElement('div');
        card.className = 'property-card';
        card.innerHTML = `
            <div class="property-image">
                <img src="${coverImage}" alt="${prop.title}">
                <span class="badge badge-${prop.category}">${prop.category}</span>
                ${prop.images && prop.images.length > 1 ? `<span class="gallery-badge">📸 ${prop.images.length} Fotos</span>` : ''}
            </div>
            <div class="property-info">
                <div class="property-price">USD ${prop.price.toLocaleString()}</div>
                <h3 class="property-title">${prop.title}</h3>
                <div class="property-features">
                    <div class="feature">
                        <span>🛏️</span> ${prop.rooms} Amb.
                    </div>
                    <div class="feature">
                        <span>📐</span> ${prop.area} m²
                    </div>
                </div>
                <div class="property-agent">
                    <span>👤 Encargado:</span> ${prop.agent || 'Sin asignar'}
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function saveToLocalStorage() {
    localStorage.setItem('davalos_properties', JSON.stringify(properties));
}

// Events
filterType.addEventListener('change', (e) => {
    renderProperties(e.target.value);
});

// Property Modal Events
btnAddProperty.addEventListener('click', () => {
    modal.style.display = 'block';
});

closeModal.addEventListener('click', () => {
    modal.style.display = 'none';
});

// Auth Events
btnLogin.addEventListener('click', () => {
    loginModal.style.display = 'block';
});

btnLogout.addEventListener('click', () => {
    AuthManager.logout();
    updateAuthUI();
});

closeLoginModal.addEventListener('click', () => {
    loginModal.style.display = 'none';
});

// Settings Events
btnSettings.addEventListener('click', () => {
    settingsModal.style.display = 'block';
});

closeSettingsModal.addEventListener('click', () => {
    settingsModal.style.display = 'none';
    settingsError.style.display = 'none';
    settingsSuccess.style.display = 'none';
    settingsForm.reset();
});

window.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
    if (e.target === loginModal) loginModal.style.display = 'none';
    if (e.target === settingsModal) settingsModal.style.display = 'none';
});

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;

    if (AuthManager.login(user, pass)) {
        updateAuthUI();
        loginForm.reset();
        loginModal.style.display = 'none';
        loginError.style.display = 'none';
    } else {
        loginError.style.display = 'block';
    }
});

settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newPass = document.getElementById('new-password').value;
    const confirmPass = document.getElementById('confirm-password').value;

    if (newPass === confirmPass) {
        if (AuthManager.changePassword(newPass)) {
            settingsError.style.display = 'none';
            settingsSuccess.style.display = 'block';
            setTimeout(() => {
                settingsModal.style.display = 'none';
                settingsSuccess.style.display = 'none';
                settingsForm.reset();
            }, 1500);
        }
    } else {
        settingsError.style.display = 'block';
        settingsSuccess.style.display = 'none';
    }
});

propertyForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const imageUrls = document.getElementById('image').value
        .split(',')
        .map(url => url.trim())
        .filter(url => url !== '');

    const newProp = {
        id: Date.now(),
        title: document.getElementById('title').value,
        price: parseFloat(document.getElementById('price').value),
        category: document.getElementById('category').value,
        rooms: parseInt(document.getElementById('rooms').value),
        area: parseInt(document.getElementById('area').value),
        images: imageUrls,
        owner: document.getElementById('owner').value,
        agent: document.getElementById('agent').value
    };

    properties.unshift(newProp);
    saveToLocalStorage();
    renderProperties(filterType.value);

    propertyForm.reset();
    modal.style.display = 'none';
});

// Initial Render
updateAuthUI();
renderProperties();
