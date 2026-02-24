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

// DOM Elements
const grid = document.getElementById('properties-grid');
const filterType = document.getElementById('filter-type');
const propertyForm = document.getElementById('property-form');
const btnAddProperty = document.getElementById('btn-add-property');
const modal = document.getElementById('property-modal');
const closeModal = document.getElementById('close-modal');

// Functions
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
        const card = document.createElement('div');
        card.className = 'property-card';
        card.innerHTML = `
            <div class="property-image">
                <img src="${prop.image || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80'}" alt="${prop.title}">
                <span class="badge badge-${prop.category}">${prop.category}</span>
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

btnAddProperty.addEventListener('click', () => {
    modal.style.display = 'block';
});

closeModal.addEventListener('click', () => {
    modal.style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
});

propertyForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const newProp = {
        id: Date.now(),
        title: document.getElementById('title').value,
        price: parseFloat(document.getElementById('price').value),
        category: document.getElementById('category').value,
        rooms: parseInt(document.getElementById('rooms').value),
        area: parseInt(document.getElementById('area').value),
        image: document.getElementById('image').value
    };

    properties.unshift(newProp);
    saveToLocalStorage();
    renderProperties(filterType.value);
    
    propertyForm.reset();
    modal.style.display = 'none';
});

// Initial Render
renderProperties();
