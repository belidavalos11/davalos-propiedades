// Initial mock data
const initialProperties = [
    {
        id: 1,
        title: "Residencia Colonial en Zona Norte",
        price: 450000,
        category: "venta",
        rooms: 5,
        area: 320,
        image: "https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=800&q=80"
    },
    {
        id: 2,
        title: "Penthouse de Lujo con Vista al Río",
        price: 1200,
        category: "alquiler",
        rooms: 3,
        area: 110,
        image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80"
    },
    {
        id: 3,
        title: "Casa Moderna con Piscina",
        price: 280000,
        category: "venta",
        rooms: 4,
        area: 180,
        image: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80"
    },
    {
        id: 4,
        title: " Loft Industrial Soho",
        price: 850,
        category: "alquiler",
        rooms: 1,
        area: 55,
        image: "https://images.unsplash.com/photo-1505691938895-1758d7eaa511?auto=format&fit=crop&w=800&q=80"
    }
];

// State Management
let properties = JSON.parse(localStorage.getItem('davalos_properties')) || initialProperties;
let isLoggedIn = JSON.parse(localStorage.getItem('davalos_auth')) || false;

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
const loginModal = document.getElementById('login-modal');
const closeLoginModal = document.getElementById('close-login-modal');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

// Functions
function updateAuthUI() {
    if (isLoggedIn) {
        btnLogin.style.display = 'none';
        btnLogout.style.display = 'block';
        btnAddProperty.style.display = 'block';
    } else {
        btnLogin.style.display = 'block';
        btnLogout.style.display = 'none';
        btnAddProperty.style.display = 'none';
    }
}

function renderProperties(filter = 'todos') {
    grid.innerHTML = '';
    // ... (rest of the render function remains the same)
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
    isLoggedIn = false;
    localStorage.removeItem('davalos_auth');
    updateAuthUI();
});

closeLoginModal.addEventListener('click', () => {
    loginModal.style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
    if (e.target === loginModal) loginModal.style.display = 'none';
});

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;

    // Simulated credentials
    if (user === 'admin' && pass === 'admin123') {
        isLoggedIn = true;
        localStorage.setItem('davalos_auth', JSON.stringify(true));
        updateAuthUI();
        loginForm.reset();
        loginModal.style.display = 'none';
        loginError.style.display = 'none';
    } else {
        loginError.style.display = 'block';
    }
});

propertyForm.addEventListener('submit', (e) => {
    // ... (rest of property form submit remains the same)
});

// Initial Render
updateAuthUI();
renderProperties();

