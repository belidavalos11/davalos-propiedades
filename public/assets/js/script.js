const DATA_URL = window.SITE_CONFIG?.data?.catalogUrl || "data/properties.json";
const PLACEHOLDER_IMAGE = window.SITE_CONFIG?.assets?.placeholderImage || "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80";

// DOM Elements - Selection
const grid = document.getElementById("properties-grid");
const resultsCount = document.getElementById("results-count");
const filterPropType = document.getElementById("filter-prop-type");
const filterType = document.getElementById("filter-type");
const filterRooms = document.getElementById("filter-rooms");
const filterPriceMin = document.getElementById("filter-price-min");
const filterPriceMax = document.getElementById("filter-price-max");
const searchInput = document.getElementById("search-input");
const btnHeroSearch = document.getElementById("btn-hero-search");
const sortBy = document.getElementById("sort-by");
const clearFiltersBtn = document.getElementById("clear-filters");

// ==========================================================================
// Interactive Catalog Map & Location Picker (Leaflet + OpenStreetMap)
// ==========================================================================
const SALTA_DEFAULT_COORDS = [-24.7821, -65.4232];
let catalogMapInstance = null;
let catalogClusterGroup = null;
let lastFilteredProperties = [];
let pickerMapInstance = null;
let pickerMarkerInstance = null;

// Configuración y corrección de rutas de iconos estándar de Leaflet (CDN fix)
if (typeof window !== "undefined" && window.L && window.L.Icon && window.L.Icon.Default) {
    try {
        delete window.L.Icon.Default.prototype._getIconUrl;
        window.L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });
    } catch (_) {}
}

function createCustomPin(color = "#050e36") {
    return L.divIcon({
        className: "custom-map-marker-pin-wrap",
        html: `
            <div style="width:36px; height:36px; border-radius:50% 50% 50% 0; background:${color}; transform:rotate(-45deg); display:flex; align-items:center; justify-content:center; box-shadow:0 3px 10px rgba(0,0,0,0.35); border:2px solid #ffffff; cursor:pointer;">
                <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" style="transform:rotate(45deg); width:16px; height:16px;"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
            </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36]
    });
}

function formatCurrency(price, currency = "USD") {
    if (!price && price !== 0) return "Consultar";
    const label = (currency === "ARS" || String(currency).toUpperCase() === "ARS") ? "AR$" : "U$D";
    const num = Number(price);
    if (isNaN(num)) return `${label} ${price}`;
    return `${label} ${num.toLocaleString("es-AR")}`;
}

function createMapPopupHtml(prop) {
    if (!prop) return "";
    try {
        const mainImg = (prop.images && prop.images[0]) || PLACEHOLDER_IMAGE;
        const opBadge = prop.category === "alquiler" ? "Alquiler" : (prop.operation ? String(prop.operation).toUpperCase() : "Venta");
        const formattedPrice = formatCurrency(prop.price, prop.currency);
        const safeTitle = (typeof escapeHtml === "function") ? escapeHtml(prop.title || "Propiedad") : String(prop.title || "Propiedad");
        
        // Key features
        const area = prop.areaTotal || prop.area;
        const rooms = prop.rooms;
        
        let featuresHtml = "";
        if (area) {
            const areaStr = (typeof formatNumber === "function") ? formatNumber(area) : area;
            featuresHtml += `<span>📐 ${areaStr} m²</span>`;
        }
        if (rooms) {
            featuresHtml += `<span>🛏️ ${rooms} amb.</span>`;
        }

        return `
            <div class="map-popup-card">
                <div class="map-popup-img-wrap">
                    <img src="${mainImg}" alt="${safeTitle}" class="map-popup-img" loading="lazy">
                    <span class="map-popup-badge-op">${opBadge}</span>
                </div>
                <div class="map-popup-body">
                    <div class="map-popup-price">${formattedPrice}</div>
                    <h4 class="map-popup-title" title="${safeTitle}">${safeTitle}</h4>
                    ${featuresHtml ? `<div class="map-popup-features">${featuresHtml}</div>` : ""}
                    <a href="details.html?id=${prop.id}" class="map-popup-btn">Ver propiedad →</a>
                </div>
            </div>
        `;
    } catch (err) {
        console.warn("[createMapPopupHtml] Error al generar popup:", err);
        return `<b>${prop.title || 'Propiedad'}</b><br><a href="details.html?id=${prop.id}">Ver propiedad</a>`;
    }
}

// Diccionario de coordenadas de referencia por barrio/zona de Salta
const SALTA_ZONE_COORDS = [
    { keys: ["san lorenzo chico"], coords: [-24.7650, -65.4950] },
    { keys: ["praderas de san lorenzo", "las praderas"], coords: [-24.7530, -65.4880] },
    { keys: ["san lorenzo", "villa san lorenzo"], coords: [-24.7390, -65.4890] },
    { keys: ["el tipal"], coords: [-24.7520, -65.4680] },
    { keys: ["la almudena"], coords: [-24.7580, -65.4610] },
    { keys: ["los molles"], coords: [-24.7490, -65.4750] },
    { keys: ["valle escondido"], coords: [-24.7450, -65.4520] },
    { keys: ["grand bourg", "gran bourg"], coords: [-24.7680, -65.4450] },
    { keys: ["tres cerritos", "3 cerritos"], coords: [-24.7630, -65.3990] },
    { keys: ["la lucinda"], coords: [-24.7380, -65.3720] },
    { keys: ["chachapoyas"], coords: [-24.7680, -65.3880] },
    { keys: ["ciudad del milagro", "el milagro"], coords: [-24.7460, -65.4080] },
    { keys: ["mirasoles", "los mirasoles"], coords: [-24.7410, -65.4180] },
    { keys: ["vaqueros"], coords: [-24.7180, -65.4050] },
    { keys: ["la caldera"], coords: [-24.6010, -65.3810] },
    { keys: ["san luis", "villa san luis"], coords: [-24.8380, -65.4880] },
    { keys: ["intersindical"], coords: [-24.8350, -65.4420] },
    { keys: ["santa ana"], coords: [-24.8410, -65.4510] },
    { keys: ["limache", "barrio limache"], coords: [-24.8250, -65.4290] },
    { keys: ["cerrillos"], coords: [-24.9010, -65.4850] },
    { keys: ["la merced"], coords: [-24.9620, -65.4890] },
    { keys: ["el carril"], coords: [-25.0740, -65.5340] },
    { keys: ["chicoana"], coords: [-25.1050, -65.5350] },
    { keys: ["campo quijano", "quijano"], coords: [-24.9080, -65.6420] },
    { keys: ["rosario de lerma"], coords: [-24.9850, -65.5780] },
    { keys: ["portezuelo"], coords: [-24.7920, -65.3950] },
    { keys: ["monumento", "monumental"], coords: [-24.7890, -65.3980] },
    { keys: ["macrocentro"], coords: [-24.7850, -65.4170] },
    { keys: ["centro"], coords: [-24.7885, -65.4110] },
    { keys: ["zona norte", "norte"], coords: [-24.7550, -65.4120] },
    { keys: ["zona sur", "sur"], coords: [-24.8320, -65.4350] },
    { keys: ["zona oeste", "oeste"], coords: [-24.7780, -65.4580] },
    { keys: ["zona este", "este"], coords: [-24.7860, -65.3850] },
    { keys: ["salta"], coords: [-24.7821, -65.4232] }
];

function resolvePropertyCoordinates(prop) {
    if (!prop) return null;

    // 1. Coordenadas directas numéricas o en string
    const rawLat = prop.lat ?? prop.latitude;
    const rawLng = prop.lng ?? prop.longitude;
    if (rawLat !== undefined && rawLat !== null && rawLat !== "" &&
        rawLng !== undefined && rawLng !== null && rawLng !== "") {
        const parsedLat = parseFloat(rawLat);
        const parsedLng = parseFloat(rawLng);
        if (!isNaN(parsedLat) && !isNaN(parsedLng) && isFinite(parsedLat) && isFinite(parsedLng) && (parsedLat !== 0 || parsedLng !== 0)) {
            return { lat: parsedLat, lng: parsedLng, source: "direct" };
        }
    }

    // 2. Extraer de enlaces o texto de Google Maps
    const potentialMapUrls = [
        prop.mapLink,
        prop.googleMapsUrl,
        prop.map_url,
        prop.urlMapa,
        prop.ubicacionUrl
    ].filter(Boolean);

    for (const url of potentialMapUrls) {
        const coords = extractCoordsFromGoogleMaps(String(url));
        if (coords) {
            return { lat: coords.lat, lng: coords.lng, source: "mapLink" };
        }
    }

    // 3. Fallback inteligente por barrio / zona de Salta
    const haystack = [
        prop.location,
        prop.ubicacion,
        prop.barrio,
        prop.zone,
        prop.zona,
        prop.address,
        prop.direccion,
        prop.title
    ].filter(Boolean).join(" ").toLowerCase();

    for (const entry of SALTA_ZONE_COORDS) {
        if (entry.keys.some(k => haystack.includes(k))) {
            const numId = Number(String(prop.id).replace(/\D/g, "")) || 1;
            const offsetLat = ((numId % 7) - 3) * 0.0018;
            const offsetLng = (((numId * 3) % 7) - 3) * 0.0018;
            return {
                lat: entry.coords[0] + offsetLat,
                lng: entry.coords[1] + offsetLng,
                source: "zone_approx"
            };
        }
    }

    // 4. Fallback Salta Capital con dispersión según ID
    const numId = Number(String(prop.id).replace(/\D/g, "")) || 1;
    const offsetLat = ((numId % 9) - 4) * 0.0025;
    const offsetLng = (((numId * 4) % 9) - 4) * 0.0025;
    return {
        lat: SALTA_DEFAULT_COORDS[0] + offsetLat,
        lng: SALTA_DEFAULT_COORDS[1] + offsetLng,
        source: "salta_fallback"
    };
}

function initCatalogMap() {
    const mapContainer = document.getElementById("catalog-map") || document.getElementById("map-container");
    if (!mapContainer || !window.L) return;

    if (!catalogMapInstance) {
        if (mapContainer._leaflet_id) {
            mapContainer._leaflet_id = null;
        }

        catalogMapInstance = L.map(mapContainer, {
            center: SALTA_DEFAULT_COORDS,
            zoom: 13,
            scrollWheelZoom: true
        });

        L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(catalogMapInstance);
    }

    window.catalogMap = catalogMapInstance;
    window.catalogMapInstance = catalogMapInstance;
    try {
        catalogMapInstance.invalidateSize();
    } catch (_) {}
}

function renderCatalogMap(propsToDisplay) {
    try {
        initCatalogMap();
        if (!catalogMapInstance) return;

        // Invalidar tamaño inmediatamente
        catalogMapInstance.invalidateSize();

        // A) Corrige las rutas rotas de iconos de Leaflet (obligatorio al usar CDN, de lo contrario los pines quedan invisibles)
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        if (catalogClusterGroup) {
            try {
                catalogMapInstance.removeLayer(catalogClusterGroup);
            } catch (_) {}
        }

        const markersGroup = L.featureGroup();
        catalogClusterGroup = markersGroup;

        const list = (Array.isArray(propsToDisplay) && propsToDisplay.length > 0)
            ? propsToDisplay
            : (lastFilteredProperties && lastFilteredProperties.length > 0 ? lastFilteredProperties : properties.filter(isPropertyAvailable));

        console.log(`[renderCatalogMap] Dibujando ${list.length} propiedades en el mapa`);

        list.forEach((prop, idx) => {
            try {
                // B) Extracción real de coordenadas:
                let lat = prop.lat || prop.latitude || (prop.coords && prop.coords.lat);
                let lng = prop.lng || prop.longitude || (prop.coords && prop.lng);

                // Si viene de un link de Google Maps:
                if ((!lat || !lng) && (prop.mapLink || prop.googleMapsUrl || prop.ubicacion)) {
                    const rawUrl = prop.mapLink || prop.googleMapsUrl || prop.ubicacion;
                    const match = String(rawUrl).match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || 
                                  String(rawUrl).match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/) ||
                                  String(rawUrl).match(/\/search\/(-?\d+\.\d+),?\+*(-?\d+\.\d+)/);
                    if (match) {
                        lat = parseFloat(match[1]);
                        lng = parseFloat(match[2]);
                    }
                }

                // Fallback a Salta si no tiene coordenadas cargadas para que no desaparezca:
                if (!lat || !lng) {
                    lat = -24.7821 + (Math.random() - 0.5) * 0.04;
                    lng = -65.4232 + (Math.random() - 0.5) * 0.04;
                }

                // C) Marcador y popup:
                const marker = L.marker([parseFloat(lat), parseFloat(lng)]);
                const popupContent = (typeof createMapPopupHtml === "function")
                    ? createMapPopupHtml(prop)
                    : `<b>${escapeHtml(prop.title || 'Propiedad')}</b><br><a href="details.html?id=${prop.id}">Ver propiedad</a>`;
                marker.bindPopup(popupContent, {
                    maxWidth: 280,
                    className: "custom-leaflet-popup"
                });
                markersGroup.addLayer(marker);
            } catch (itemErr) {
                console.error(`[renderCatalogMap] Error procesando propiedad #${prop?.id}:`, itemErr);
            }
        });

        markersGroup.addTo(catalogMapInstance);

        if (markersGroup.getLayers().length > 0) {
            try {
                catalogMapInstance.fitBounds(markersGroup.getBounds().pad(0.1));
            } catch (e) {
                console.warn("[renderCatalogMap] fitBounds error:", e);
            }
        } else {
            catalogMapInstance.setView(SALTA_DEFAULT_COORDS, 13);
        }

        // Invalidar tamaño inmediatamente y tras 300ms para asegurar renderizado completo sin áreas en blanco
        catalogMapInstance.invalidateSize();
        setTimeout(() => {
            if (catalogMapInstance) {
                catalogMapInstance.invalidateSize();
                if (markersGroup.getLayers().length > 0) {
                    try {
                        catalogMapInstance.fitBounds(markersGroup.getBounds().pad(0.1));
                    } catch (_) {}
                }
            }
        }, 300);
    } catch (err) {
        console.error("[renderCatalogMap] Error general al renderizar mapa:", err);
    }
}

// Mini-map Location Picker for Property Modal (Create / Edit)
function initPropertyPickerMap() {
    const container = document.getElementById("property-picker-map");
    if (!container || !window.L) return;

    if (!pickerMapInstance) {
        pickerMapInstance = L.map("property-picker-map", {
            center: SALTA_DEFAULT_COORDS,
            zoom: 13,
            scrollWheelZoom: true
        });

        L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(pickerMapInstance);

        pickerMarkerInstance = L.marker(SALTA_DEFAULT_COORDS, {
            draggable: true,
            icon: createCustomPin("#c9a050")
        }).addTo(pickerMapInstance);

        pickerMarkerInstance.on("dragend", () => {
            const pos = pickerMarkerInstance.getLatLng();
            syncPickerInputs(pos.lat, pos.lng);
        });

        pickerMapInstance.on("click", (e) => {
            pickerMarkerInstance.setLatLng(e.latlng);
            syncPickerInputs(e.latlng.lat, e.latlng.lng);
        });

        const latInput = document.getElementById("prop-lat");
        const lngInput = document.getElementById("prop-lng");
        const onInputChange = () => {
            const lat = Number(latInput?.value);
            const lng = Number(lngInput?.value);
            if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
                pickerMarkerInstance.setLatLng([lat, lng]);
                pickerMapInstance.panTo([lat, lng]);
            }
        };
        latInput?.addEventListener("change", onInputChange);
        lngInput?.addEventListener("change", onInputChange);

        // 1. Buscador de dirección con Nominatim (OpenStreetMap)
        const btnPickerSearch = document.getElementById("btn-picker-search");
        const addressSearchInput = document.getElementById("picker-address-search");
        if (btnPickerSearch) {
            btnPickerSearch.onclick = () => searchAddressWithNominatim();
        }
        if (addressSearchInput) {
            addressSearchInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    searchAddressWithNominatim();
                }
            });
        }

        // 2. Extractor de coordenadas de Google Maps
        const btnExtractGmaps = document.getElementById("btn-extract-gmaps");
        const mapLinkInput = document.getElementById("prop-map-link");
        if (btnExtractGmaps) {
            btnExtractGmaps.onclick = () => handleGoogleMapsExtraction(true);
        }
        if (mapLinkInput) {
            mapLinkInput.addEventListener("input", () => handleGoogleMapsExtraction(false));
            mapLinkInput.addEventListener("paste", () => {
                setTimeout(() => handleGoogleMapsExtraction(true), 80);
            });
        }

        // Cerrar dropdown de resultados al hacer clic fuera
        document.addEventListener("click", (e) => {
            const dropdown = document.getElementById("picker-search-results");
            const searchContainer = document.querySelector(".picker-search-container");
            if (dropdown && searchContainer && !searchContainer.contains(e.target)) {
                dropdown.style.display = "none";
            }
        });
    }
}

function syncPickerInputs(lat, lng) {
    const latInput = document.getElementById("prop-lat");
    const lngInput = document.getElementById("prop-lng");
    if (latInput) latInput.value = Number(lat).toFixed(6);
    if (lngInput) lngInput.value = Number(lng).toFixed(6);
}

function extractCoordsFromGoogleMaps(input) {
    if (!input || typeof input !== "string") return null;
    const s = input.trim();

    // 1. Coordenadas con @lat,lng en URLs estándar de Google Maps
    const atMatch = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };

    // 2. Parámetros de lugar embebidos (!3dlat!4dlng)
    const dMatch = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (dMatch) return { lat: parseFloat(dMatch[1]), lng: parseFloat(dMatch[2]) };

    // 3. Query string q=lat,lng / query=lat,lng / ll=lat,lng
    const qMatch = s.match(/[?&](?:q|query|ll|center)=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/i);
    if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };

    // 4. Par de coordenadas decimales directas: "lat, lng" o "lat lng"
    const rawMatch = s.match(/(-?\d{1,2}\.\d+)[,\s]+(-?\d{1,3}\.\d+)/);
    if (rawMatch) return { lat: parseFloat(rawMatch[1]), lng: parseFloat(rawMatch[2]) };

    return null;
}

function handleGoogleMapsExtraction(manualTrigger = false) {
    const input = document.getElementById("prop-map-link");
    const feedback = document.getElementById("gmaps-extract-feedback");
    if (!input || !feedback) return;

    const val = input.value.trim();
    if (!val) {
        if (manualTrigger) {
            feedback.textContent = "Ingresá un enlace o coordenadas de Google Maps para extraer.";
            feedback.className = "error";
            feedback.style.display = "block";
        } else {
            feedback.style.display = "none";
        }
        return;
    }

    const coords = extractCoordsFromGoogleMaps(val);
    if (coords) {
        updatePickerMapPosition(coords.lat, coords.lng, true);
        feedback.textContent = `✅ Coordenadas detectadas: Lat ${coords.lat.toFixed(5)}, Lng ${coords.lng.toFixed(5)}`;
        feedback.className = "success";
        feedback.style.display = "block";
    } else if (manualTrigger) {
        if (val.includes("goo.gl") || val.includes("maps.app")) {
            feedback.textContent = "ℹ️ Enlace corto detectado. Si podés, abrí el enlace en el navegador y copiá la URL completa o las coordenadas que muestra Google Maps.";
            feedback.className = "info";
        } else {
            feedback.textContent = "No se pudieron extraer coordenadas. Verificá que contenga números decimales (ej: -24.7821, -65.4232).";
            feedback.className = "error";
        }
        feedback.style.display = "block";
    }
}

async function searchAddressWithNominatim() {
    const searchInput = document.getElementById("picker-address-search");
    const searchBtn = document.getElementById("btn-picker-search");
    const feedback = document.getElementById("picker-search-feedback");
    const dropdown = document.getElementById("picker-search-results");
    if (!searchInput) return;

    const queryRaw = searchInput.value.trim();
    if (!queryRaw) {
        if (feedback) {
            feedback.textContent = "Escribí una calle o dirección para buscar.";
            feedback.className = "error";
            feedback.style.display = "block";
        }
        return;
    }

    let query = queryRaw;
    if (!/salta/i.test(query)) {
        query += ", Salta, Argentina";
    } else if (!/argentina/i.test(query)) {
        query += ", Argentina";
    }

    if (searchBtn) {
        searchBtn.disabled = true;
        searchBtn.innerHTML = `<span>Buscando...</span>`;
    }
    if (feedback) feedback.style.display = "none";
    if (dropdown) dropdown.style.display = "none";

    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`, {
            headers: {
                "Accept-Language": "es"
            }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (!data || data.length === 0) {
            if (feedback) {
                feedback.textContent = "No se encontraron resultados para esa dirección. Probá con otra calle o hacé clic directamente en el mapa.";
                feedback.className = "error";
                feedback.style.display = "block";
            }
            return;
        }

        // Posicionar en el primer resultado
        const top = data[0];
        const lat = parseFloat(top.lat);
        const lng = parseFloat(top.lon);

        if (pickerMapInstance && pickerMarkerInstance) {
            pickerMapInstance.flyTo([lat, lng], 16, { duration: 1.2 });
            pickerMarkerInstance.setLatLng([lat, lng]);
            syncPickerInputs(lat, lng);
        }

        if (feedback) {
            feedback.textContent = `📍 Ubicado en: ${top.display_name.split(",").slice(0, 3).join(",")}`;
            feedback.className = "success";
            feedback.style.display = "block";
        }

        // Si hay varios resultados, desplegar sugerencias
        if (data.length > 1 && dropdown) {
            dropdown.innerHTML = data.map((item, idx) => `
                <div class="picker-search-item" data-idx="${idx}">
                    <strong>${escapeHtml(item.display_name.split(",")[0])}</strong><br>
                    <small style="color: #64748b;">${escapeHtml(item.display_name.split(",").slice(1, 4).join(","))}</small>
                </div>
            `).join("");
            dropdown.style.display = "block";

            dropdown.querySelectorAll(".picker-search-item").forEach(el => {
                el.onclick = () => {
                    const item = data[Number(el.dataset.idx)];
                    if (item) {
                        const iLat = parseFloat(item.lat);
                        const iLng = parseFloat(item.lon);
                        pickerMapInstance.flyTo([iLat, iLng], 16, { duration: 1.2 });
                        pickerMarkerInstance.setLatLng([iLat, iLng]);
                        syncPickerInputs(iLat, iLng);
                        if (feedback) {
                            feedback.textContent = `📍 Ubicado en: ${item.display_name.split(",").slice(0, 3).join(",")}`;
                            feedback.className = "success";
                            feedback.style.display = "block";
                        }
                    }
                    dropdown.style.display = "none";
                };
            });
        }
    } catch (err) {
        console.error("Error al buscar en Nominatim:", err);
        if (feedback) {
            feedback.textContent = "Hubo un inconveniente al consultar el servicio de búsqueda. Podés fijar el punto directamente en el mapa.";
            feedback.className = "error";
            feedback.style.display = "block";
        }
    } finally {
        if (searchBtn) {
            searchBtn.disabled = false;
            searchBtn.innerHTML = `<span>Buscar</span>`;
        }
    }
}

function resetPickerHelpers() {
    const searchInput = document.getElementById("picker-address-search");
    if (searchInput) searchInput.value = "";
    const searchFeedback = document.getElementById("picker-search-feedback");
    if (searchFeedback) { searchFeedback.textContent = ""; searchFeedback.style.display = "none"; }
    const dropdown = document.getElementById("picker-search-results");
    if (dropdown) { dropdown.innerHTML = ""; dropdown.style.display = "none"; }
    const gmapsFeedback = document.getElementById("gmaps-extract-feedback");
    if (gmapsFeedback) { gmapsFeedback.textContent = ""; gmapsFeedback.style.display = "none"; }
}

function updatePickerMapPosition(lat, lng, preserveFeedback = false) {
    initPropertyPickerMap();
    if (!preserveFeedback) resetPickerHelpers();
    if (!pickerMapInstance || !pickerMarkerInstance) return;

    const numLat = Number(lat);
    const numLng = Number(lng);
    const hasValidCoords = !isNaN(numLat) && !isNaN(numLng) && lat !== null && lng !== null && lat !== "" && lng !== "";

    const targetPos = hasValidCoords ? [numLat, numLng] : SALTA_DEFAULT_COORDS;
    const targetZoom = hasValidCoords ? 15 : 13;

    pickerMarkerInstance.setLatLng(targetPos);
    pickerMapInstance.setView(targetPos, targetZoom);

    if (hasValidCoords) {
        syncPickerInputs(numLat, numLng);
    }

    setTimeout(() => {
        pickerMapInstance?.invalidateSize();
    }, 200);
}

// Pill Search Elements
const searchPill = document.getElementById("search-pill");
const advancedFilters = document.getElementById("advanced-filters");
const btnToggleFilters = document.getElementById("btn-toggle-filters");

// Modal Elements
const loginModal = document.getElementById("login-modal");
const settingsModal = document.getElementById("settings-modal");
const propertyModal = document.getElementById("property-modal");
const btnLogin = document.getElementById("btn-login");
const btnSettings = document.getElementById("btn-settings");
const btnLogout = document.getElementById("btn-logout");
const btnAddProperty = document.getElementById("btn-add-property");
const loginForm = document.getElementById("login-form");
const propertyForm = document.getElementById("property-form");
const closeBtns = document.querySelectorAll(".close-modal");

// State
let properties = [];
let localProperties = [];
let currentEditingId = null;
let currentEditingUsername = null;
let selectedPropertyTypes = [];
// Gestion de equipo (solo SUPER_ADMIN)
const teamState = { users: [], tab: "active", unsub: null, error: false };

// Utility
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatPrice(price) {
    if (!price && price !== 0) return "0";
    return Number(price).toLocaleString("es-AR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}

function formatNumber(val) {
    if (!val && val !== 0) return "";
    const num = Number(String(val).replace(/\./g, "").replace(/,/g, ""));
    if (isNaN(num)) return val;
    return num.toLocaleString("es-AR");
}

function unformatNumber(val) {
    if (typeof val !== "string") return val;
    return Number(val.replace(/\./g, "")) || 0;
}

function safeImageUrl(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/") || trimmed.startsWith("data:image")) return trimmed;
    return null;
}

// Logic - Auth UI
function updateAuthUI() {
    const manager = window.AuthManager;
    const logged = manager && manager.isLoggedIn();

    if (btnLogin) btnLogin.style.display = logged ? "none" : "block";
    if (btnLogout) btnLogout.style.display = logged ? "block" : "none";

    if (btnSettings) {
        const hasAccess = logged && manager.hasPermission(manager.Permissions.ACCESS_SETTINGS);
        btnSettings.style.display = hasAccess ? "block" : "none";

        // Also handle the user mgmt toggle button inside settings
        const btnToggleUserMgmt = document.getElementById("btn-toggle-user-mgmt");
        if (btnToggleUserMgmt) {
            // Legado (usuarios usuario/contrasena): reemplazado por "Gestionar Equipo".
            btnToggleUserMgmt.style.display = "none";
        }
    }

    if (btnAddProperty) {
        btnAddProperty.style.display = (logged && manager.hasPermission(manager.Permissions.UPLOAD_PROPERTY)) ? "block" : "none";
    }

    const btnTeam = document.getElementById("btn-team");
    const isSuperAdmin = Boolean(logged && manager.hasPermission(manager.Permissions.MANAGE_USERS));
    if (btnTeam) btnTeam.style.display = isSuperAdmin ? "inline-flex" : "none";
    if (isSuperAdmin) startTeamWatch(); else stopTeamWatch();

    const greeting = document.getElementById("user-greeting");
    if (greeting) {
        if (logged) {
            const name = window.AuthManager.getDisplayName();
            greeting.className = "user-greeting";
            greeting.textContent = `¡Hola ${name}!`;
            greeting.style.display = "block";
            greeting.onclick = null;
        } else {
            greeting.className = "user-greeting";
            greeting.style.display = "none";
            greeting.onclick = null;
        }
    }

    // Botón de filtro de propiedades no disponibles en el catálogo (solo AGENT, ADMIN, SUPER_ADMIN)
    const canManage = canManageProperties();
    const unavailCount = (properties || []).filter(p => !isPropertyAvailable(p)).length;

    const btnToggleUnavailable = document.getElementById("btn-toggle-unavailable");
    if (btnToggleUnavailable) {
        btnToggleUnavailable.style.display = canManage ? "inline-flex" : "none";
        const countSpan = document.getElementById("unavailable-count");
        if (countSpan) countSpan.textContent = unavailCount;
    }
}

function openModal(modal) {
    if (modal) modal.style.display = "block";
    document.body.style.overflow = "hidden";
}

function closeModal() {
    [loginModal, settingsModal, propertyModal, document.getElementById("team-modal"), document.getElementById("member-phone-modal")].forEach(m => {
        if (m) m.style.display = "none";
    });
    const agentSelect = document.getElementById("prop-agent");
    if (agentSelect) {
        agentSelect.disabled = false;
        agentSelect.removeAttribute("title");
    }
    const ownerSection = document.getElementById("section-prop-owner");
    if (ownerSection) {
        ownerSection.style.display = "";
    }
    document.body.style.overflow = "auto";
}

// Skeleton de carga mientras se obtienen los documentos
function renderPropertySkeletons() {
    const skeletonCard = `
        <article class="property-card property-skeleton" aria-hidden="true">
            <div class="skeleton-block skeleton-image"></div>
            <div class="property-info">
                <div class="skeleton-block skeleton-line skeleton-price"></div>
                <div class="skeleton-block skeleton-line"></div>
                <div class="skeleton-block skeleton-line skeleton-short"></div>
            </div>
        </article>`;
    if (grid) grid.innerHTML = skeletonCard.repeat(6);
    const track = document.getElementById("featured-carousel-track");
    if (track) track.innerHTML = skeletonCard.repeat(3);
}

// Lee la colección de Firestore (Compat). Rechaza si no hay conexión, excede el tiempo o viene vacía.
async function fetchPropertiesFromFirestore(timeoutMs = 8000) {
    if (!window.db) throw new Error("Firestore no está inicializado");
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout al consultar Firestore")), timeoutMs)
    );
    const snapshot = await Promise.race([window.db.collection("properties").get(), timeout]);
    const list = snapshot.docs.map(doc => ({ ...doc.data(), firebaseId: doc.id }));
    if (list.length === 0) throw new Error("La colección 'properties' está vacía");
    return list;
}

// Respaldo local: data/properties.json (+ ocultamiento de propiedades base eliminadas, si Firestore responde)
async function fetchPropertiesFromJson() {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`No se pudo leer ${DATA_URL} (${response.status})`);
    const payload = await response.json();
    const jsonList = Array.isArray(payload?.properties) ? payload.properties : [];

    let deletedIds = [];
    try {
        if (window.db) {
            const delSnapshot = await window.db.collection("deleted_properties").get();
            deletedIds = delSnapshot.docs.map(doc => doc.id);
        }
    } catch (_) {
        // Sin conexión: se muestra el JSON completo
    }
    return jsonList.filter(p => !deletedIds.includes(String(p?.id)));
}

// Logic - Data Loading
async function loadProperties() {
    if (window.showLoader) window.showLoader();
    renderPropertySkeletons();

    let rawList = [];
    try {
        // 1. Fuente principal: Firestore
        rawList = await fetchPropertiesFromFirestore();
    } catch (firestoreError) {
        console.warn("Firestore no disponible, usando respaldo local:", firestoreError);
        try {
            // 2. Fallback: JSON local (nunca se mezcla con Firestore)
            rawList = await fetchPropertiesFromJson();
        } catch (jsonError) {
            console.error("Error loading properties:", jsonError);
            grid.innerHTML = `<div class="no-results"><h3>Error de carga</h3><p>No se pudieron sincronizar las propiedades.</p></div>`;
            const track = document.getElementById("featured-carousel-track");
            if (track) track.innerHTML = "";
            return;
        }
    }

    // 3. Cargar coordenadas precalculadas para enriquecer propiedades de Firestore
    let resolvedMap = {};
    try {
        const rRes = await fetch("data/resolved-locations.json");
        if (rRes.ok) {
            resolvedMap = await rRes.json();
        }
    } catch (_) {}

    properties = rawList
        .map(p => {
            const loc = resolvedMap[String(p.id)] || resolvedMap[p.id];
            if (loc && (!p.lat || !p.lng)) {
                p.lat = loc.lat;
                p.lng = loc.lng;
            }
            return normalizeProperty(p);
        })
        .filter(Boolean)
        .sort((a, b) => b.createdAtTs - a.createdAtTs);

    renderPropertyCategories();
    updateActiveTypeUI();
    applyFilters();
    renderOpportunities();

    // Inicialización y renderizado obligatorio del mapa al cargar propiedades
    initCatalogMap();
    renderCatalogMap(properties);

    setTimeout(() => {
        if (window.catalogMap || window.catalogMapInstance) {
            (window.catalogMap || window.catalogMapInstance).invalidateSize();
        }
    }, 200);
}

function normalizeProperty(prop) {
    if (!prop || typeof prop !== "object") return null;
    const id = prop.id || Date.now();
    const title = String(prop.title || "").trim();

    // En Firestore `type` puede ser la operación (venta/alquiler) y `propertyType` el tipo de inmueble.
    // En el JSON legado `type` es el tipo de inmueble y `operation`/`category` la operación.
    const OPERATIONS = ["venta", "alquiler", "alquiler temporal", "temporal"];
    const rawType = String(prop.type || "").trim().toLowerCase();
    const typeIsOperation = OPERATIONS.includes(rawType);
    const operation = String(prop.operation || prop.category || (typeIsOperation ? rawType : "") || "venta").trim().toLowerCase();
    const type = String(prop.propertyType || (typeIsOperation ? "" : rawType)).trim().toLowerCase();

    const price = Number(prop.price) || 0;
    const currency = String(prop.currency || "USD").trim().toUpperCase();
    const location = String(prop.location || window.SITE_CONFIG?.contact?.city || "Salta").trim();
    const description = String(prop.description || "").trim();
    const createdAt = prop.createdAt || new Date().toISOString();

    const featObj = (prop.features && typeof prop.features === "object" && !Array.isArray(prop.features)) ? prop.features : {};
    const rooms = Number(featObj.rooms ?? prop.rooms) || null;
    const baths = Number(featObj.baths ?? featObj.bathrooms ?? prop.baths ?? prop.bathrooms) || null;
    const areaTotal = Number(featObj.areaTotal ?? prop.areaTotal ?? prop.area) || null;
    const areaBuilt = Number(featObj.areaBuilt ?? featObj.areaCovered ?? prop.areaBuilt ?? prop.areaCovered) || null;
    const garage = Number(featObj.garage ?? prop.garage) || null;

    const images = (Array.isArray(prop.images) ? prop.images : [])
        .map(img => safeImageUrl(img))
        .filter(Boolean);

    // Contacto del asesor: agentWhatsapp/agentPhone del documento tienen prioridad;
    // si no vienen, getPropertyAgent (config.js) resuelve por agentId con fallback al número general.
    const agentWhatsapp = String(prop.agentWhatsapp || prop.agentPhone || "").replace(/\D/g, "");

    const featured = prop.featured === true || String(prop.featured).toLowerCase() === "true";

    return {
        ...prop,
        id,
        title,
        type,
        operation,
        category: operation,
        price,
        currency,
        location,
        description,
        featured,
        agentId: String(prop.agentId || "").trim(),
        agentWhatsapp,
        rooms,
        baths,
        areaTotal,
        areaBuilt,
        garage,
        features: {
            rooms,
            baths,
            areaTotal,
            areaBuilt,
            garage
        },
        createdAt,
        createdAtTs: Date.parse(createdAt) || (typeof id === 'number' ? id : Date.now()),
        images: images.length ? images : [PLACEHOLDER_IMAGE]
    };
}

// Render "Explorá por tipo de propiedad" grid from SITE_CONFIG
// Solo muestra categorías que tengan propiedades cargadas (> 0) y asigna más espacio a las que tienen más inmuebles
function renderPropertyCategories() {
    const categoriesSection = document.getElementById("categorias-propiedades");
    const categoriesGrid = document.getElementById("categories-grid");
    if (!categoriesGrid) return;

    const cfg = window.SITE_CONFIG;
    if (cfg?.categoriesSection) {
        const eyebrowEl = document.getElementById("categories-eyebrow");
        const titleEl = document.getElementById("categories-title");
        const subtitleEl = document.getElementById("categories-subtitle");
        if (eyebrowEl && cfg.categoriesSection.eyebrow) eyebrowEl.textContent = cfg.categoriesSection.eyebrow;
        if (titleEl && cfg.categoriesSection.title) titleEl.textContent = cfg.categoriesSection.title;
        if (subtitleEl && cfg.categoriesSection.subtitle) subtitleEl.textContent = cfg.categoriesSection.subtitle;
    }

    const categories = cfg?.propertyCategories || [];

    // Calcular cuántas propiedades tiene cada categoría y filtrar solo las que tengan > 0
    const activeCategories = categories
        .map(cat => {
            const matchingProps = properties.filter(p => matchesSelectedPropertyType(p, cat.id));
            return {
                ...cat,
                count: matchingProps.length
            };
        })
        .filter(cat => cat.count > 0);

    if (activeCategories.length === 0) {
        if (categoriesSection) categoriesSection.style.display = "none";
        categoriesGrid.innerHTML = "";
        return;
    }

    if (categoriesSection) categoriesSection.style.display = "block";

    // Ordenar o identificar qué categorías tienen más elementos para asignarles mayor ancho en la grilla Bento (base 12 columnas)
    const total = activeCategories.length;
    // Ranking de mayor a menor cantidad de propiedades (desempate por orden original)
    const rankedIds = [...activeCategories]
        .sort((a, b) => b.count - a.count)
        .map(c => c.id);

    const getBentoSpans = (items) => {
        const n = items.length;
        if (n === 1) return ["span-12"];
        if (n === 2) {
            // La que tiene más elementos ocupa 7 columnas y la otra 5 (si empatan, 6 y 6)
            if (items[0].count === items[1].count) return ["span-6", "span-6"];
            return items[0].count > items[1].count ? ["span-7", "span-5"] : ["span-5", "span-7"];
        }

        // Para 3 o más categorías: dividimos en filas de hasta 3 tarjetas (12 columnas por fila)
        // En cada fila de 3, la categoría con más propiedades de esa fila ocupa 6 columnas (50% del ancho, igual a la foto)
        // y las otras dos ocupan 3 columnas cada una (25% + 25%).
        // Si una fila tiene 2 elementos, el mayor ocupa 7 y el menor 5.
        // Si una fila tiene 1 elemento, ocupa 12.
        const spans = new Array(n).fill("span-4");
        let idx = 0;
        let rowNum = 0;
        while (idx < n) {
            const remaining = n - idx;
            const rowSize = remaining >= 3 ? 3 : remaining;
            const rowSlice = items.slice(idx, idx + rowSize);

            if (rowSize === 3) {
                // Encontrar el índice dentro de la fila con mayor cantidad de propiedades
                let maxIdxInRow = 0;
                for (let j = 1; j < 3; j++) {
                    if (rowSlice[j].count > rowSlice[maxIdxInRow].count) {
                        maxIdxInRow = j;
                    }
                }
                // Si todas tienen la misma cantidad en la fila, alternamos la posición ancha como en la foto (izq -> der -> izq)
                const allEqual = rowSlice.every(item => item.count === rowSlice[0].count);
                const widePos = allEqual ? (rowNum % 2 === 0 ? 0 : 2) : maxIdxInRow;

                for (let j = 0; j < 3; j++) {
                    spans[idx + j] = (j === widePos) ? "span-6" : "span-3";
                }
            } else if (rowSize === 2) {
                if (rowSlice[0].count >= rowSlice[1].count) {
                    spans[idx] = "span-7";
                    spans[idx + 1] = "span-5";
                } else {
                    spans[idx] = "span-5";
                    spans[idx + 1] = "span-7";
                }
            } else {
                spans[idx] = "span-12";
            }

            idx += rowSize;
            rowNum++;
        }
        return spans;
    };

    // Ordenamos para que en cada fila la tarjeta con más elementos destaque visualmente
    const spans = getBentoSpans(activeCategories);

    categoriesGrid.innerHTML = activeCategories.map((cat, idx) => {
        const isActive = selectedPropertyTypes.includes(cat.id);
        const spanClass = spans[idx] || "span-4";
        return `
            <a href="#propiedades"
               class="category-card ${spanClass} ${isActive ? 'active' : ''}"
               data-type="${escapeHtml(cat.id)}"
               title="${cat.count} ${cat.count === 1 ? 'propiedad disponible' : 'propiedades disponibles'}"
               onclick="event.preventDefault(); filterByPropertyType('${escapeHtml(cat.id)}', true);">
                <img src="${escapeHtml(cat.image || PLACEHOLDER_IMAGE)}" alt="${escapeHtml(cat.label)}" class="category-card-bg" loading="lazy">
                <div class="category-card-overlay"></div>
                <span class="category-card-title">${escapeHtml(cat.label)}</span>
            </a>
        `;
    }).join("");
}

function getAvailableCategoriesWithCount() {
    const categories = window.SITE_CONFIG?.propertyCategories || [];
    return categories
        .map(cat => ({
            ...cat,
            count: properties.filter(p => isPropertyAvailable(p) && matchesSelectedPropertyType(p, cat.id)).length
        }))
        .filter(cat => cat.count > 0);
}

function updateActiveTypeUI() {
    const cards = document.querySelectorAll(".category-card");
    cards.forEach(card => {
        const typeAttr = card.getAttribute("data-type");
        card.classList.toggle("active", selectedPropertyTypes.includes(typeAttr));
    });

    if (filterPropType) {
        filterPropType.value = selectedPropertyTypes.length === 1 ? selectedPropertyTypes[0] : "todos";
    }

    const banner = document.getElementById("active-type-filter-banner");
    if (!banner) return;

    if (selectedPropertyTypes.length === 0) {
        banner.style.display = "none";
        banner.innerHTML = "";
        return;
    }

    const availableCats = getAvailableCategoriesWithCount();
    const allCats = window.SITE_CONFIG?.propertyCategories || [];

    // 1. Chips de categorías ya seleccionadas (para poder quitarlas individualmente)
    const activeChipsHtml = selectedPropertyTypes.map(typeId => {
        const catObj = allCats.find(c => c.id === typeId);
        const label = catObj ? catObj.label : typeId;
        return `
            <button type="button" class="filter-chip active" title="Quitar ${escapeHtml(label)}" onclick="togglePropertyTypeFilter('${escapeHtml(typeId)}')">
                <span>${escapeHtml(label)}</span>
                <span class="chip-Action">&times;</span>
            </button>
        `;
    }).join("");

    // 2. Chips de otras categorías con propiedades disponibles (para poder sumarlas a la búsqueda)
    const unselectedCats = availableCats.filter(c => !selectedPropertyTypes.includes(c.id));
    const addChipsHtml = unselectedCats.map(cat => `
        <button type="button" class="filter-chip available" title="Sumar ${escapeHtml(cat.label)} a la búsqueda" onclick="togglePropertyTypeFilter('${escapeHtml(cat.id)}')">
            <span class="chip-Action">+</span>
            <span>${escapeHtml(cat.label)}</span>
        </button>
    `).join("");

    banner.style.display = "flex";
    banner.innerHTML = `
        <div class="filter-chips-row">
            <span class="filter-chip-label">Viendo:</span>
            ${activeChipsHtml}
            ${selectedPropertyTypes.length > 1 ? `<button type="button" class="filter-chip-clear" onclick="clearPropertyTypeFilters()">Limpiar todo</button>` : ""}
        </div>
        ${unselectedCats.length > 0 ? `
            <div class="filter-chips-row">
                <span class="filter-chip-label">Sumar categoría:</span>
                ${addChipsHtml}
            </div>
        ` : ""}
    `;
}

window.togglePropertyTypeFilter = function (typeId) {
    if (!typeId) return;
    const idx = selectedPropertyTypes.indexOf(typeId);
    if (idx !== -1) {
        selectedPropertyTypes.splice(idx, 1);
    } else {
        selectedPropertyTypes.push(typeId);
    }
    updateActiveTypeUI();
    applyFilters();
    renderOpportunities();
};

window.clearPropertyTypeFilters = function () {
    selectedPropertyTypes = [];
    updateActiveTypeUI();
    applyFilters();
    renderOpportunities();
};

window.filterByPropertyType = function (typeId, shouldScroll = true) {
    if (!typeId) {
        selectedPropertyTypes = [];
    } else {
        const idx = selectedPropertyTypes.indexOf(typeId);
        if (idx !== -1) {
            selectedPropertyTypes.splice(idx, 1);
        } else {
            selectedPropertyTypes.push(typeId);
        }
    }

    updateActiveTypeUI();
    applyFilters();

    if (shouldScroll && selectedPropertyTypes.length > 0) {
        const propSection = document.getElementById("propiedades");
        if (propSection) propSection.scrollIntoView({ behavior: "smooth" });
    }
};

function matchesSelectedPropertyType(prop, typeId) {
    if (!typeId) return true;
    const catObj = (window.SITE_CONFIG?.propertyCategories || []).find(c => c.id === typeId);
    const terms = catObj?.matchTypes ? catObj.matchTypes.map(t => t.toLowerCase()) : [typeId.toLowerCase()];

    const propType = String(prop.type || "").trim().toLowerCase();
    if (propType && terms.some(t => propType === t || propType.includes(t))) {
        return true;
    }

    // Fallback para propiedades del catálogo base que no tengan prop.type explícito
    if (!propType) {
        const text = `${prop.title || ""} ${prop.description || ""}`.toLowerCase();
        if (typeId === "casa" && (text.includes("casa") || text.includes("residencia"))) return true;
        if (typeId === "departamento" && (text.includes("departamento") || text.includes("penthouse"))) return true;
        return terms.some(t => text.includes(t));
    }

    return false;
}

// Featured Properties Carousel State (10 random available properties rotated every 6 hours)
const FEATURED_STORAGE_KEY = "davalos_featured_rotation_6h_10_v1";
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const FEATURED_MAX_COUNT = 10;
let featuredCarouselIndex = 0;
let featuredAutoTimer = null;
let showAllCatalogMode = false;
let showUnavailableMode = false;
let lastFeaturedSlot = Math.floor(Date.now() / SIX_HOURS_MS);

function isFalseFlag(value) {
    return value === false || String(value).trim().toLowerCase() === "false";
}

// Una propiedad se considera disponible salvo que available/disponible sea false
// o que su status sea uno de los estados "fuera de catalogo". Si el campo no existe, está disponible.
function isPropertyAvailable(prop) {
    if (!prop) return false;
    if (isFalseFlag(prop.available) || isFalseFlag(prop.disponible)) return false;
    const status = String(prop.status || "").trim().toLowerCase();
    if ([
        "vendida",
        "alquilada",
        "no_disponible",
        "no-disponible",
        "no disponible",
        "inactiva",
        "pausada",
        "unavailable",
        "baja"
    ].includes(status)) {
        return false;
    }
    return true;
}

function canManageProperties() {
    const manager = window.AuthManager;
    if (!manager || !manager.isLoggedIn()) return false;
    const userRole = manager?.currentUserProfile?.role || manager?.getCurrentUser()?.role;
    return Boolean(
        manager.hasPermission(manager.Permissions.EDIT_PROPERTY) ||
        ["AGENT", "ADMIN", "SUPER_ADMIN", "EDITOR"].includes(userRole)
    );
}

function canViewUnavailable() {
    return canManageProperties();
}

function getFeaturedProperties(allProps) {
    const available = (allProps || []).filter(isPropertyAvailable);
    if (available.length === 0) return [];

    lastFeaturedSlot = Math.floor(Date.now() / SIX_HOURS_MS);

    // Prioridad: propiedades marcadas con featured: true en Firestore.
    // Si no hay ninguna, se muestran las primeras del catálogo.
    const flagged = available.filter(p => p.featured === true);
    const source = flagged.length > 0 ? flagged : available;
    return source.slice(0, FEATURED_MAX_COUNT);
}

function isFlagTrue(value) {
    return value === true || String(value).trim().toLowerCase() === "true";
}

// Oportunidades: 1) documentos con opportunity/oferta = true;
// 2) fallback: featured = true; 3) completa con las de precio más competitivo
// (comparando solo dentro del grupo operación+moneda más numeroso para no mezclar USD/ARS ni venta/alquiler).
function getOpportunityProperties(allProps) {
    const available = (allProps || []).filter(isPropertyAvailable);

    const flagged = available.filter(p => isFlagTrue(p.opportunity) || isFlagTrue(p.oferta));
    if (flagged.length > 0) {
        return flagged.slice(0, 6).map(prop => ({ prop, label: "Oportunidad" }));
    }

    const max = 3;
    const picks = available.filter(p => p.featured === true).slice(0, max);
    if (picks.length < max) {
        const groups = {};
        available
            .filter(p => p.price > 0 && !picks.includes(p))
            .forEach(p => {
                const key = p.operation + "|" + p.currency;
                (groups[key] = groups[key] || []).push(p);
            });
        const best = Object.values(groups).sort((a, b) => b.length - a.length)[0] || [];
        best.sort((a, b) => a.price - b.price);
        picks.push(...best.slice(0, max - picks.length));
    }
    return picks.map(prop => ({ prop, label: "Oportunidad destacada" }));
}

function renderOpportunities() {
    const section = document.getElementById("oportunidades");
    const oppGrid = document.getElementById("opportunities-grid");
    if (!section || !oppGrid) return;

    const items = getOpportunityProperties(properties);
    oppGrid.innerHTML = "";
    if (items.length === 0) {
        section.style.display = "none";
        return;
    }

    items.forEach(({ prop, label }) => {
        const card = createPropertyCardElement(prop);
        const badge = document.createElement("span");
        badge.className = "opportunity-badge";
        badge.textContent = label;
        const info = card.querySelector(".property-info");
        (info || card).prepend(badge);
        oppGrid.appendChild(card);
    });
    section.style.display = "";
}

function hasActiveFilters() {
    const type = filterType ? filterType.value : "todos";
    const rooms = Number(filterRooms ? filterRooms.value : 0);
    const min = Number(filterPriceMin ? filterPriceMin.value : 0) || 0;
    const max = Number(filterPriceMax ? filterPriceMax.value : 0) || Infinity;
    const text = (searchInput ? searchInput.value : "").trim();
    return (
        type !== "todos" ||
        selectedPropertyTypes.length > 0 ||
        rooms > 0 ||
        min > 0 ||
        max !== Infinity ||
        text.length > 0
    );
}

// Filtering Logic
function applyFilters() {
    const type = filterType.value;
    const rooms = Number(filterRooms.value || 0);
    const min = Number(filterPriceMin.value) || 0;
    const max = Number(filterPriceMax.value) || Infinity;
    const text = (searchInput.value || "").trim().toLowerCase();
    const sort = sortBy.value;

    let filtered = properties.filter(prop => {
        // En catálogo y búsqueda principal, NUNCA incluir propiedades no disponibles
        if (!isPropertyAvailable(prop)) return false;

        const matchesOperation = type === "todos" || prop.category === type;
        const matchesPropType = selectedPropertyTypes.length === 0 || selectedPropertyTypes.some(tId => matchesSelectedPropertyType(prop, tId));
        const propRooms = Number(prop.rooms || 0);
        const matchesRooms = isNaN(propRooms) ? true : propRooms >= rooms;
        const matchesPrice = prop.price >= min && (max === Infinity || prop.price <= max);
        const haystack = `${prop.title} ${prop.description} ${prop.agent} ${prop.owner}`.toLowerCase();
        const matchesText = !text || haystack.includes(text);
        return matchesOperation && matchesPropType && matchesRooms && matchesPrice && matchesText;
    });

    // Sorting
    switch (sort) {
        case "price-asc": filtered.sort((a, b) => a.price - b.price); break;
        case "price-desc": filtered.sort((a, b) => b.price - a.price); break;
        case "area-desc": filtered.sort((a, b) => (b.areaTotal || b.area || 0) - (a.areaTotal || a.area || 0)); break;
        default: filtered.sort((a, b) => b.createdAtTs - a.createdAtTs); break;
    }

    const filteringActive = hasActiveFilters();
    const carouselWrapper = document.getElementById("featured-carousel-wrapper");
    const carouselControls = document.getElementById("featured-carousel-controls");
    const btnToggleAll = document.getElementById("btn-toggle-all-props");
    const btnToggleUnavailable = document.getElementById("btn-toggle-unavailable");
    const sectionTitle = document.getElementById("properties-section-title");
    const sectionSubtitle = document.getElementById("properties-section-subtitle");
    const featuredEyebrow = document.getElementById("featured-eyebrow");

    if (btnToggleUnavailable) btnToggleUnavailable.classList.remove("active");

    if (btnToggleAll) {
        const availableCount = properties.filter(isPropertyAvailable).length;
        btnToggleAll.style.display = availableCount > 0 ? "inline-flex" : "none";
        btnToggleAll.onclick = () => {
            if (showUnavailableMode) {
                exitUnavailableMode();
                return;
            }
            if (filteringActive) {
                if (clearFiltersBtn) clearFiltersBtn.click();
                showAllCatalogMode = false;
            } else {
                showAllCatalogMode = !showAllCatalogMode;
                applyFilters();
            }
        };
    }

    lastFilteredProperties = filtered;

    if (!filteringActive && !showAllCatalogMode) {
        // Modo por defecto: mostrar el carrusel de 10 propiedades destacadas al azar (cada 6h)
        if (featuredEyebrow) featuredEyebrow.textContent = "● DESTACADAS";
        if (sectionTitle) sectionTitle.textContent = "Propiedades destacadas.";
        if (sectionSubtitle) sectionSubtitle.textContent = "Selección de propiedades destacadas";
        if (resultsCount) resultsCount.textContent = "";
        if (grid) grid.style.display = "none";
        if (carouselWrapper) carouselWrapper.style.display = "block";
        if (carouselControls) carouselControls.style.display = "inline-flex";
        if (btnToggleAll) btnToggleAll.textContent = `Ver todas (${properties.filter(isPropertyAvailable).length})`;

        const featuredList = getFeaturedProperties(properties);
        renderFeaturedCarousel(featuredList);
    } else {
        // Modo filtrado o ver todas las propiedades
        stopFeaturedAutoSlide();
        if (featuredEyebrow) featuredEyebrow.textContent = filteringActive ? "● BÚSQUEDA" : "● CATÁLOGO";
        if (sectionTitle) sectionTitle.textContent = filteringActive ? "Resultados de búsqueda." : "Todas las propiedades.";
        if (sectionSubtitle) sectionSubtitle.textContent = filteringActive ? "Propiedades que coinciden con tus filtros seleccionados." : "Catálogo completo de propiedades disponibles.";
        if (carouselWrapper) carouselWrapper.style.display = "none";
        if (carouselControls) carouselControls.style.display = "none";
        if (grid) grid.style.display = "grid";
        if (btnToggleAll) btnToggleAll.textContent = "← Volver a destacadas";

        renderProperties(filtered);
    }

    // Actualizar pines del mapa interactivo dedicado
    if (document.getElementById("catalog-map")) {
        const propsForMap = filteringActive ? filtered : properties.filter(isPropertyAvailable);
        renderCatalogMap(propsForMap);
    }

    if (window.hideLoader) window.hideLoader();
}

// Global filter helper for header links
window.filterByOperation = function (type) {
    if (filterType) {
        filterType.value = type;
        applyFilters();

        // Update active class in nav
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            const href = link.getAttribute('href');
            if (href === '#propiedades' || (type === 'venta' && href?.includes('venta')) || (type === 'alquiler' && href?.includes('alquiler'))) {
                link.classList.add('active');
            }
        });

        // Scroll to properties
        const propSection = document.getElementById('propiedades');
        if (propSection) propSection.scrollIntoView({ behavior: 'smooth' });
    }
};

function createPropertyCardElement(prop) {
    const manager = window.AuthManager;
    const canManage = Boolean(manager && manager.isLoggedIn() && manager.canUserEditProperty(prop));
    const canDelete = Boolean(manager && manager.isLoggedIn() && manager.hasPermission(manager.Permissions.DELETE_PROPERTY));

    const getFeatureVal = (namePattern) => {
        const feat = prop.customFeatures?.find(f =>
            (typeof f === 'string' && f.toLowerCase().includes(namePattern)) ||
            (f.name && f.name.toLowerCase().includes(namePattern))
        );
        if (!feat) return null;
        if (typeof feat === 'string') {
            const match = feat.match(/\d+/);
            if (match && Number(match[0]) > 0) return match[0];
            const lower = feat.toLowerCase();
            if (lower.includes('doble')) return '2';
            if (lower.includes('triple')) return '3';
            return '1';
        }
        const qty = String(feat.qty || '').trim();
        if (!qty || qty === '0' || qty === '-') return '1';
        return qty;
    };

    const isValidVal = (v) => {
        if (v === null || v === undefined) return false;
        const s = String(v).trim();
        if (!s || s === '-' || s === '0') return false;
        const n = Number(s.replace(/\./g, '').replace(/,/g, '.'));
        return isNaN(n) ? true : n > 0;
    };

    const rawRooms = (prop.rooms && Number(prop.rooms) > 0) ? prop.rooms : (getFeatureVal('dormitorio') || getFeatureVal('habitacio'));
    const rooms = isValidVal(rawRooms) ? rawRooms : null;

    const rawBaths = (prop.baths && Number(prop.baths) > 0) ? prop.baths : (getFeatureVal('baño') || getFeatureVal('toilette'));
    const baths = isValidVal(rawBaths) ? rawBaths : null;

    const rawAreaTotal = prop.areaTotal || prop.area;
    const areaTotal = isValidVal(rawAreaTotal) ? formatNumber(rawAreaTotal) : null;

    const rawAreaBuilt = prop.areaBuilt;
    const areaBuilt = isValidVal(rawAreaBuilt) ? formatNumber(rawAreaBuilt) : null;

    const rawGarage = (prop.garage && Number(prop.garage) > 0) ? prop.garage : (getFeatureVal('cochera') || getFeatureVal('garage'));
    const garage = isValidVal(rawGarage) ? rawGarage : null;

    const featureItemsHtml = [
        rooms ? `
            <div class="feat-item" title="Habitaciones">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"></path><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"></path><path d="M12 4v6"></path><path d="M2 18h20"></path></svg>
                <span>${escapeHtml(rooms)}</span>
            </div>` : '',
        baths ? `
            <div class="feat-item" title="Baños">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14h18l-2 6H6a3 3 0 0 1-3-3V5c0-2 2-3 4-3s4 1 5 3"></path><path d="M11 5l3 3"></path></svg>
                <span>${escapeHtml(baths)}</span>
            </div>` : '',
        areaTotal ? `
            <div class="feat-item" title="m² Totales / Terreno">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h18v18H3z"></path><path d="M3 9h18"></path><path d="M9 21V9"></path></svg>
                <span>${areaTotal}m²</span>
            </div>` : '',
        areaBuilt ? `
            <div class="feat-item" title="m² Construidos">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18V3H3zm13 13H8v-2h8v2zm0-4H8v-2h8v2z"></path></svg>
                <span>${areaBuilt}m²</span>
            </div>` : '',
        garage ? `
            <div class="feat-item" title="Cochera / Garage">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"></path><circle cx="7" cy="17" r="2"></circle><path d="M9 17h6"></path><circle cx="17" cy="17" r="2"></circle></svg>
                <span>${escapeHtml(garage)}</span>
            </div>` : ''
    ].filter(Boolean).join('');

    const descText = String(prop.description || "").trim();
    const shortDesc = descText.length > 70 ? `${escapeHtml(descText.substring(0, 70))}...` : escapeHtml(descText);
    const currencyLabel = prop.currency === "ARS" ? "AR$" : "U$D";
    const whatsappUrl = window.buildPropertyWhatsappUrl
        ? window.buildPropertyWhatsappUrl(prop)
        : (() => {
            const rawPhone = (window.SITE_CONFIG?.contact?.whatsapp || "5493874155902").replace(/\D/g, "");
            const title = String(prop?.title || "la propiedad").trim();
            const directUrl = window.getPropertyDirectUrl
                ? window.getPropertyDirectUrl(prop)
                : `${window.location.origin}/details.html?id=${encodeURIComponent(prop.id ?? "")}`;
            const msg = `¡Hola, vi esta propiedad en la página '${title}' (${directUrl}) y me gustaría que me pasen más información. ¡Muchas gracias!`;
            return `https://wa.me/${rawPhone}?text=${encodeURIComponent(msg)}`;
        })();

    const card = document.createElement("article");
    card.className = "property-card";
    const isUnavailable = !isPropertyAvailable(prop);
    if (isUnavailable) card.classList.add("is-unavailable");
    card.innerHTML = `
        <div class="property-image-container">
            <div class="operation-badge badge-${(prop.operation || prop.category || 'venta').toLowerCase()}">${escapeHtml(prop.operation || prop.category || 'Venta')}</div>
            ${isUnavailable ? '<div class="unavailable-ribbon">🚫 No disponible</div>' : ''}
            <img src="${prop.images && prop.images.length > 0 ? prop.images[0] : PLACEHOLDER_IMAGE}" alt="${escapeHtml(prop.title)}" class="property-image">
            <img src="${window.SITE_CONFIG?.assets?.logoSeal || 'assets/images/logo-seal.svg'}" class="property-seal" alt="Dávalos Propiedades" aria-hidden="true">
        </div>
        <div class="property-info">
            <div class="property-info-header">
                <div class="property-price">${currencyLabel} ${formatPrice(prop.price)}</div>
                ${canManage ? `
                    <div class="property-actions-wrapper">
                        ${isUnavailable ? `
                            <button type="button" class="btn-quick-activate" title="Volver a activar publicación en el catálogo público" onclick="event.stopPropagation(); togglePropertyAvailability(${prop.id})">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                    <path d="M23 4v6h-6"></path>
                                    <path d="M1 20v-6h6"></path>
                                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                                </svg>
                                <span>Activar</span>
                            </button>
                        ` : ''}
                        <button type="button" class="property-settings-btn" title="Opciones de administración" aria-label="Opciones" onclick="event.stopPropagation(); const m = this.nextElementSibling; const wasOpen = m.classList.contains('show'); document.querySelectorAll('.property-settings-menu.show').forEach(el => el.classList.remove('show')); if (!wasOpen) m.classList.add('show');">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                                <circle cx="12" cy="5" r="2"></circle>
                                <circle cx="12" cy="12" r="2"></circle>
                                <circle cx="12" cy="19" r="2"></circle>
                            </svg>
                        </button>
                        <div class="property-settings-menu" onclick="event.stopPropagation()">
                            <button type="button" class="property-settings-item" onclick="togglePropertyAvailability(${prop.id})">
                                ${isUnavailable ? "✓ Marcar como disponible" : "🚫 Marcar como no disponible"}
                            </button>
                            <button type="button" class="property-settings-item" onclick="openEditModal(${prop.id})">
                                Editar publicación
                            </button>
                            ${canDelete ? `
                                <button type="button" class="property-settings-item danger" onclick="deleteProperty(${prop.id})">
                                    Eliminar publicación
                                </button>
                            ` : ""}
                        </div>
                    </div>
                ` : ""}
            </div>
            <h3 class="property-title">${escapeHtml(prop.title)}</h3>
            ${shortDesc ? `<p class="property-description">${shortDesc}</p>` : ""}
            <div class="property-card-footer">
                ${featureItemsHtml ? `<div class="property-features-new">${featureItemsHtml}</div>` : ""}
                <a href="${whatsappUrl}"
                   target="_blank"
                   rel="noopener noreferrer"
                   class="btn-card-whatsapp"
                   onclick="event.stopPropagation();"
                   title="Consultar por WhatsApp">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                        <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.1.824zm-3.423-14.416c-6.627 0-12 5.373-12 12 0 2.625.846 5.059 2.284 7.033l-1.494 5.462 5.602-1.469c1.908 1.132 4.132 1.787 6.516 1.787 6.627 0 12-5.373 12-12s-5.373-12-12.908-12.813z"/>
                    </svg>
                    <span>Consultar por WhatsApp</span>
                </a>
            </div>
        </div>
    `;
    card.onclick = () => {
        if (featuredSwipeJustHappened) return;
        if (window.triggerLoader) {
            window.triggerLoader(`details.html?id=${prop.id}`);
        } else {
            window.location.href = `details.html?id=${prop.id}`;
        }
    };
    return card;
}

let featuredSwipeBound = false;
let featuredSwipeJustHappened = false;
let currentFeaturedTotalItems = 0;

function getFeaturedVisibleCount() {
    if (window.innerWidth <= 640) return 1;
    if (window.innerWidth <= 992) return 2;
    return 3;
}

function getFeaturedCarouselStepPx() {
    const track = document.getElementById("featured-carousel-track");
    if (!track) return 0;
    const firstCard = track.querySelector(".property-card");
    if (!firstCard) return 0;
    const gap = 24;
    return firstCard.getBoundingClientRect().width + gap;
}

function updateFeaturedCarouselPosition() {
    const track = document.getElementById("featured-carousel-track");
    const dotsContainer = document.getElementById("featured-carousel-dots");
    if (!track) return;

    const cards = track.querySelectorAll(".property-card");
    const total = cards.length;
    if (total === 0) return;

    const visible = getFeaturedVisibleCount();
    const maxIndex = Math.max(0, total - visible);
    if (featuredCarouselIndex > maxIndex) featuredCarouselIndex = 0;
    if (featuredCarouselIndex < 0) featuredCarouselIndex = maxIndex;

    const stepPx = getFeaturedCarouselStepPx();
    track.style.transition = "";
    track.style.transform = `translate3d(-${featuredCarouselIndex * stepPx}px, 0, 0)`;

    if (dotsContainer) {
        const dots = dotsContainer.querySelectorAll(".featured-dot");
        dots.forEach((dot, idx) => {
            dot.classList.toggle("active", idx === featuredCarouselIndex);
        });
    }
}

function moveFeaturedCarouselBy(direction) {
    if (currentFeaturedTotalItems <= 0) return;
    const maxIdx = Math.max(0, currentFeaturedTotalItems - getFeaturedVisibleCount());
    if (direction > 0) {
        featuredCarouselIndex = featuredCarouselIndex >= maxIdx ? 0 : featuredCarouselIndex + 1;
    } else {
        featuredCarouselIndex = featuredCarouselIndex <= 0 ? maxIdx : featuredCarouselIndex - 1;
    }
    updateFeaturedCarouselPosition();
    startFeaturedAutoSlide(currentFeaturedTotalItems);
}

function setupFeaturedCarouselSwipe() {
    if (featuredSwipeBound) return;
    const viewport = document.getElementById("featured-carousel-viewport");
    const track = document.getElementById("featured-carousel-track");
    if (!viewport || !track) return;

    featuredSwipeBound = true;
    let touchStartX = 0;
    let touchStartY = 0;
    let deltaX = 0;
    let deltaY = 0;
    let isTracking = false;
    let isHorizontalGesture = null;

    viewport.addEventListener("touchstart", (e) => {
        if (!e.touches || e.touches.length !== 1) return;
        stopFeaturedAutoSlide();
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        deltaX = 0;
        deltaY = 0;
        isTracking = true;
        isHorizontalGesture = null;
        featuredSwipeJustHappened = false;
    }, { passive: true });

    viewport.addEventListener("touchmove", (e) => {
        if (!isTracking || !e.touches || e.touches.length !== 1) return;
        deltaX = e.touches[0].clientX - touchStartX;
        deltaY = e.touches[0].clientY - touchStartY;

        if (isHorizontalGesture === null) {
            if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
                isHorizontalGesture = Math.abs(deltaX) > Math.abs(deltaY);
            }
        }

        if (isHorizontalGesture) {
            if (e.cancelable) e.preventDefault();
            const stepPx = getFeaturedCarouselStepPx();
            const baseOffset = -featuredCarouselIndex * stepPx;
            track.style.transition = "none";
            track.style.transform = `translate3d(${baseOffset + deltaX * 0.65}px, 0, 0)`;
        }
    }, { passive: false });

    const finishTouch = () => {
        if (!isTracking) return;
        isTracking = false;
        track.style.transition = "";

        if (isHorizontalGesture && Math.abs(deltaX) > 45) {
            featuredSwipeJustHappened = true;
            setTimeout(() => {
                featuredSwipeJustHappened = false;
            }, 300);

            if (deltaX < -45) {
                moveFeaturedCarouselBy(1);
            } else if (deltaX > 45) {
                moveFeaturedCarouselBy(-1);
            }
        } else {
            updateFeaturedCarouselPosition();
            startFeaturedAutoSlide(currentFeaturedTotalItems);
        }

        deltaX = 0;
        deltaY = 0;
        isHorizontalGesture = null;
    };

    viewport.addEventListener("touchend", finishTouch, { passive: true });
    viewport.addEventListener("touchcancel", finishTouch, { passive: true });
}

function stopFeaturedAutoSlide() {
    if (featuredAutoTimer) {
        clearInterval(featuredAutoTimer);
        featuredAutoTimer = null;
    }
}

function startFeaturedAutoSlide(totalItems) {
    stopFeaturedAutoSlide();
    const visible = getFeaturedVisibleCount();
    if (totalItems <= visible) return;
    featuredAutoTimer = setInterval(() => {
        const maxIndex = Math.max(0, totalItems - getFeaturedVisibleCount());
        featuredCarouselIndex = featuredCarouselIndex >= maxIndex ? 0 : featuredCarouselIndex + 1;
        updateFeaturedCarouselPosition();
    }, 5000);
}

function renderFeaturedCarousel(featuredProps) {
    const track = document.getElementById("featured-carousel-track");
    const dotsContainer = document.getElementById("featured-carousel-dots");
    const prevBtn = document.getElementById("featured-prev");
    const nextBtn = document.getElementById("featured-next");
    const wrapper = document.getElementById("featured-carousel-wrapper");
    if (!track) return;

    track.innerHTML = "";
    if (dotsContainer) dotsContainer.innerHTML = "";

    if (!featuredProps || featuredProps.length === 0) {
        currentFeaturedTotalItems = 0;
        track.innerHTML = `<div class="no-results" style="width: 100%;"><h3>Sin propiedades disponibles</h3></div>`;
        return;
    }

    currentFeaturedTotalItems = featuredProps.length;

    featuredProps.forEach(prop => {
        track.appendChild(createPropertyCardElement(prop));
    });

    const visible = getFeaturedVisibleCount();
    const maxIndex = Math.max(0, featuredProps.length - visible);
    if (featuredCarouselIndex > maxIndex) featuredCarouselIndex = 0;

    // Renderizar dots de paginación
    const pagesCount = maxIndex + 1;
    if (dotsContainer && pagesCount > 1) {
        for (let i = 0; i < pagesCount; i++) {
            const dot = document.createElement("button");
            dot.type = "button";
            dot.className = `featured-dot ${i === featuredCarouselIndex ? "active" : ""}`;
            dot.setAttribute("aria-label", `Ir a slide ${i + 1}`);
            dot.onclick = () => {
                featuredCarouselIndex = i;
                updateFeaturedCarouselPosition();
                startFeaturedAutoSlide(featuredProps.length);
            };
            dotsContainer.appendChild(dot);
        }
    }

    if (prevBtn) {
        prevBtn.onclick = () => moveFeaturedCarouselBy(-1);
    }

    if (nextBtn) {
        nextBtn.onclick = () => moveFeaturedCarouselBy(1);
    }

    if (wrapper) {
        wrapper.onmouseenter = () => stopFeaturedAutoSlide();
        wrapper.onmouseleave = () => startFeaturedAutoSlide(featuredProps.length);
    }

    setupFeaturedCarouselSwipe();

    requestAnimationFrame(() => {
        updateFeaturedCarouselPosition();
    });
    startFeaturedAutoSlide(featuredProps.length);
}

window.addEventListener("resize", () => {
    if (!hasActiveFilters() && !showAllCatalogMode) {
        updateFeaturedCarouselPosition();
    }
});

// Verificar cada minuto si se cumplió el ciclo de 6 horas para renovar automáticamente las 5 propiedades destacadas
setInterval(() => {
    const nowSlot = Math.floor(Date.now() / SIX_HOURS_MS);
    if (nowSlot !== lastFeaturedSlot && properties.length > 0) {
        lastFeaturedSlot = nowSlot;
        if (!hasActiveFilters() && !showAllCatalogMode) {
            featuredCarouselIndex = 0;
            renderFeaturedCarousel(getFeaturedProperties(properties));
        }
    }
}, 60 * 1000);

function renderProperties(filtered) {
    grid.innerHTML = "";
    if (resultsCount) resultsCount.textContent = `${filtered.length} resultado${filtered.length === 1 ? "" : "s"}`;

    if (!filtered.length) {
        grid.innerHTML = `<div class="no-results"><h3>Sin resultados</h3><p>Intenta con otros filtros.</p></div>`;
        return;
    }

    filtered.forEach(prop => {
        grid.appendChild(createPropertyCardElement(prop));
    });
}

// Vista rápida de propiedades no disponibles (solo AGENT, ADMIN, SUPER_ADMIN)
function renderUnavailableProperties() {
    if (!canManageProperties()) return;
    stopFeaturedAutoSlide();
    showUnavailableMode = true;
    showAllCatalogMode = true;

    const carouselWrapper = document.getElementById("featured-carousel-wrapper");
    const carouselControls = document.getElementById("featured-carousel-controls");
    const btnToggleAll = document.getElementById("btn-toggle-all-props");
    const btnToggleUnavailable = document.getElementById("btn-toggle-unavailable");
    const featuredEyebrow = document.getElementById("featured-eyebrow");
    const sectionTitle = document.getElementById("properties-section-title");
    const sectionSubtitle = document.getElementById("properties-section-subtitle");

    if (carouselWrapper) carouselWrapper.style.display = "none";
    if (carouselControls) carouselControls.style.display = "none";
    if (grid) grid.style.display = "grid";

    if (featuredEyebrow) featuredEyebrow.textContent = "● GESTIÓN INTERNA";
    if (sectionTitle) sectionTitle.textContent = "Propiedades no disponibles.";
    if (sectionSubtitle) sectionSubtitle.textContent = "Inmuebles pausados, vendidos o dados de baja temporalmente. Solo visible para el equipo administrador.";

    if (btnToggleAll) {
        btnToggleAll.textContent = "← Volver al catálogo disponible";
        btnToggleAll.style.display = "inline-flex";
    }

    if (btnToggleUnavailable) {
        btnToggleUnavailable.classList.add("active");
    }

    const unavailProps = properties.filter(p => !isPropertyAvailable(p));
    if (resultsCount) {
        resultsCount.textContent = `${unavailProps.length} propiedad${unavailProps.length === 1 ? "" : "es"} no disponible${unavailProps.length === 1 ? "" : "s"}`;
    }

    grid.innerHTML = "";
    if (unavailProps.length === 0) {
        grid.innerHTML = `
            <div class="no-results" style="grid-column: 1 / -1; padding: 50px 20px; text-align: center;">
                <div style="font-size: 2.2rem; margin-bottom: 12px;">✅</div>
                <h3 style="margin-bottom: 8px;">No hay propiedades pausadas</h3>
                <p style="color: var(--text-light); margin-bottom: 20px;">Todas las propiedades publicadas se encuentran activas y disponibles en la web.</p>
                <button type="button" class="btn btn-primary btn-small" onclick="exitUnavailableMode()">Volver al catálogo disponible</button>
            </div>
        `;
        return;
    }

    unavailProps.forEach(prop => {
        grid.appendChild(createPropertyCardElement(prop));
    });
}

function exitUnavailableMode() {
    showUnavailableMode = false;
    const btnToggleUnavailable = document.getElementById("btn-toggle-unavailable");
    if (btnToggleUnavailable) btnToggleUnavailable.classList.remove("active");
    applyFilters();
}

window.renderUnavailableProperties = renderUnavailableProperties;
window.exitUnavailableMode = exitUnavailableMode;

// Alterna Disponible / No disponible con un solo clic y lo persiste en Firestore.
window.togglePropertyAvailability = async function (id) {
    const manager = window.AuthManager;
    if (!manager || !manager.isLoggedIn()) return;
    const prop = properties.find(p => String(p.id) === String(id));
    if (!prop) return;
    if (!manager.canUserEditProperty(prop)) {
        alert("No tienes permisos para modificar la disponibilidad de esta propiedad.");
        return;
    }
    if (!prop.firebaseId) {
        alert("Esta propiedad proviene del respaldo local y no se puede modificar desde acá.");
        return;
    }
    const makeAvailable = !isPropertyAvailable(prop);
    const patch = {
        available: makeAvailable,
        disponible: makeAvailable,
        status: makeAvailable ? "disponible" : "no_disponible"
    };
    try {
        await window.db.collection("properties").doc(prop.firebaseId).update(patch);
        Object.assign(prop, patch);
        updateAuthUI();
        renderPropertyCategories();
        renderOpportunities();
        if (showUnavailableMode) {
            renderUnavailableProperties();
        } else {
            applyFilters();
        }
    } catch (e) {
        console.error("Error al cambiar disponibilidad:", e);
        alert("No se pudo actualizar la disponibilidad. Verificá que hayas iniciado sesión con Google como administrador.");
    }
};

// ---- Gestion de Equipo (solo SUPER_ADMIN) ----
const TEAM_ROLE_LABELS = { AGENT: "Asesor", ADMIN: "Admin", SUPER_ADMIN: "Super Admin" };

function startTeamWatch() {
    if (teamState.unsub) return;
    const manager = window.AuthManager;
    if (!manager) return;
    teamState.error = false;
    teamState.unsub = manager.watchTeam(
        users => { teamState.users = users; teamState.error = false; renderTeam(); },
        () => { teamState.error = true; renderTeam(); }
    );
}

function stopTeamWatch() {
    if (!teamState.unsub && teamState.users.length === 0) return;
    if (teamState.unsub) teamState.unsub();
    teamState.unsub = null;
    teamState.users = [];
    renderTeam();
}

function formatTeamDate(ts) {
    const d = ts && typeof ts.toDate === "function" ? ts.toDate() : (ts ? new Date(ts) : null);
    return d && !isNaN(d) ? d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
}

function teamUserHtml(u) {
    const name = u.displayName || u.email;
    const initial = escapeHtml(String(name).trim().charAt(0).toUpperCase() || "?");
    const photo = safeImageUrl(u.photoURL || "");
    const img = photo
        ? `<img class="team-avatar-img" src="${escapeHtml(photo)}" alt="" referrerpolicy="no-referrer" onerror="this.style.display='none'">`
        : "";
    return `
        <div class="team-user">
            <span class="team-avatar"><span class="team-avatar-fallback">${initial}</span>${img}</span>
            <div class="team-user-text">
                <strong>${escapeHtml(name)}</strong>
                <span>${escapeHtml(u.email)}</span>
            </div>
        </div>`;
}

function teamSortByDate(a, b) {
    const t = x => (x.createdAt && typeof x.createdAt.toMillis === "function") ? x.createdAt.toMillis() : 0;
    return t(b) - t(a);
}

function renderTeam() {
    const modal = document.getElementById("team-modal");
    const btnTeam = document.getElementById("btn-team");
    const me = window.auth && window.auth.currentUser ? window.auth.currentUser.uid : null;

    const pending = teamState.users.filter(u => u.status === "pending").sort(teamSortByDate);
    const active = teamState.users.filter(u => u.status === "active").sort(teamSortByDate);
    const inactive = teamState.users.filter(u => u.status === "inactive").sort(teamSortByDate);

    if (btnTeam) {
        let badge = btnTeam.querySelector(".team-badge");
        if (!badge) {
            badge = document.createElement("span");
            badge.className = "team-badge";
            btnTeam.appendChild(badge);
        }
        badge.textContent = String(pending.length);
        badge.style.display = pending.length ? "inline-block" : "none";
    }

    if (!modal) return;
    const counts = { pending: pending.length, active: active.length, inactive: inactive.length };
    modal.querySelectorAll("[data-team-tab]").forEach(btn => {
        const key = btn.dataset.teamTab;
        btn.classList.toggle("active", key === teamState.tab);
        const c = btn.querySelector(".team-tab-count");
        if (c) c.textContent = String(counts[key] ?? 0);
    });
    ["pending", "active", "inactive"].forEach(key => {
        const panel = document.getElementById(`team-panel-${key}`);
        if (panel) panel.hidden = key !== teamState.tab;
    });

    const setPanel = (key, html) => {
        const panel = document.getElementById(`team-panel-${key}`);
        if (panel) panel.innerHTML = html;
    };
    const empty = text => `<p class="team-empty">${text}</p>`;

    if (teamState.error) {
        const msg = empty("No se pudo cargar el equipo. Verificá que las reglas de Firestore estén publicadas y que tu cuenta sea Super Admin.");
        setPanel("pending", msg); setPanel("active", msg); setPanel("inactive", msg);
        return;
    }

    setPanel("pending", pending.length ? `<div class="team-cards">${pending.map(u => `
        <div class="team-card">
            ${teamUserHtml(u)}
            <div class="team-meta">Solicitó acceso el ${formatTeamDate(u.createdAt)}</div>
            <div class="team-actions">
                <button type="button" class="btn btn-primary btn-small" data-team-action="approve-agent" data-uid="${escapeHtml(u.uid)}">Aprobar como Asesor</button>
                <button type="button" class="btn btn-outline btn-small" data-team-action="approve-admin" data-uid="${escapeHtml(u.uid)}">Aprobar como Admin</button>
                <button type="button" class="btn-team-danger" data-team-action="reject" data-uid="${escapeHtml(u.uid)}">Rechazar</button>
            </div>
        </div>`).join("")}</div>` : empty("No hay solicitudes pendientes."));

    setPanel("active", active.length ? `<div class="team-table-wrap"><table class="team-table">
        <thead>
            <tr>
                <th class="team-th-user">Miembro</th>
                <th class="team-th-role">Rol</th>
                <th class="team-th-date">Desde</th>
                <th class="team-th-actions"></th>
            </tr>
        </thead>
        <tbody>${active.map(u => {
            const locked = u.uid === me;
            const roleCell = locked
                ? `<span class="team-role-tag">${TEAM_ROLE_LABELS[u.role] || escapeHtml(u.role || "")}</span>`
                : `<select class="team-role-select" data-team-role data-uid="${escapeHtml(u.uid)}" aria-label="Rol">
                        <option value="AGENT"${u.role === "AGENT" ? " selected" : ""}>Asesor</option>
                        <option value="ADMIN"${u.role === "ADMIN" ? " selected" : ""}>Admin</option>
                        <option value="SUPER_ADMIN"${u.role === "SUPER_ADMIN" ? " selected" : ""}>Super Admin</option>
                   </select>`;
            const phoneVal = String(u.phone || u.whatsapp || "").trim();
            const phoneItem = `<button type="button" class="team-dropdown-item" data-team-action="edit-phone" data-uid="${escapeHtml(u.uid)}">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" style="color: #25D366; flex-shrink: 0;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                <span class="team-dropdown-text">${phoneVal ? `Editar teléfono: <strong class="team-dropdown-phone">${escapeHtml(phoneVal)}</strong>` : "Cargar teléfono"}</span>
            </button>`;
            const suspendItem = locked
                ? `<div class="team-dropdown-item disabled" title="No podés suspender tu propia cuenta">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" style="color: #94a3b8; flex-shrink: 0;"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                    <span class="team-dropdown-text">Tu cuenta</span>
                   </div>`
                : `<button type="button" class="team-dropdown-item team-dropdown-item-danger" data-team-action="suspend" data-uid="${escapeHtml(u.uid)}">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    <span class="team-dropdown-text">Suspender usuario</span>
                   </button>`;
            const moreAction = `
                <div class="team-more-wrap">
                    <button type="button" class="btn-team-more" data-team-more-trigger aria-label="Más opciones" title="Más opciones">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="12" cy="5" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="19" r="2"></circle></svg>
                    </button>
                    <div class="team-row-dropdown">
                        ${phoneItem}
                        ${suspendItem}
                    </div>
                </div>`;
            return `<tr>
                <td class="team-col-user">${teamUserHtml(u)}</td>
                <td class="team-col-role">${roleCell}</td>
                <td class="team-col-date"><span class="team-date-label">Desde: </span>${formatTeamDate(u.createdAt)}</td>
                <td class="team-col-actions team-actions-cell">${moreAction}</td>
            </tr>`;
        }).join("")}</tbody></table></div>` : empty("Todavía no hay miembros activos."));

    setPanel("inactive", inactive.length ? `<div class="team-table-wrap"><table class="team-table">
        <thead><tr><th class="team-th-user">Miembro</th><th class="team-th-role">Rol</th><th class="team-th-date">Desde</th><th class="team-th-actions"></th></tr></thead>
        <tbody>${inactive.map(u => `
            <tr>
                <td class="team-col-user">${teamUserHtml(u)}</td>
                <td class="team-col-role"><span class="team-role-tag">${TEAM_ROLE_LABELS[u.role] || escapeHtml(u.role || "")}</span></td>
                <td class="team-col-date"><span class="team-date-label">Desde: </span>${formatTeamDate(u.createdAt)}</td>
                <td class="team-col-actions team-actions-cell">
                    <div class="team-actions-inline">
                        <button type="button" class="btn btn-outline btn-small" data-team-action="reactivate" data-uid="${escapeHtml(u.uid)}">Reactivar</button>
                        <button type="button" class="btn-team-danger btn-small" data-team-action="delete" data-uid="${escapeHtml(u.uid)}" title="Eliminar definitivamente">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>Eliminar
                        </button>
                    </div>
                </td>
            </tr>`).join("")}
        </tbody></table></div>` : empty("No hay usuarios inactivos."));
}

function teamErrorMessage(res) {
    if (res.reason === "self") return "No podés modificar o eliminar tu propia cuenta.";
    if (res.reason === "permission") return "No tenés permisos para gestionar el equipo.";
    return res.error || "No se pudo guardar el cambio. Verificá tu conexión y las reglas de Firestore.";
}

async function handleTeamAction(action, uid, btn) {
    if (action === "edit-phone") {
        openPhoneModal(uid);
        return;
    }
    const user = teamState.users.find(u => u.uid === uid);
    if (!user) return;
    const name = user.displayName || user.email;

    if (action === "delete") {
        if (!window.AuthManager || window.AuthManager.getUserRole() !== "SUPER_ADMIN") {
            alert("Solo un usuario con rol Super Admin puede eliminar miembros del equipo.");
            return;
        }
        if (!confirm("¿Estás seguro de que deseas eliminar permanentemente a este usuario? Esta acción no se puede deshacer.")) {
            return;
        }
        btn.disabled = true;
        const res = await window.AuthManager.deleteUser(uid);
        if (res.success) {
            alert("Usuario eliminado correctamente");
            // Actualización inmediata del estado local para feedback instantáneo; watchTeam también sincronizará vía onSnapshot
            teamState.users = teamState.users.filter(u => u.uid !== uid);
            renderTeam();
        } else {
            btn.disabled = false;
            alert(teamErrorMessage(res));
        }
        return;
    }

    let patch;
    let confirmMsg = "";
    switch (action) {
        case "approve-agent": patch = { role: "AGENT", status: "active" }; break;
        case "approve-admin": patch = { role: "ADMIN", status: "active" }; break;
        case "reject": patch = { status: "inactive" }; confirmMsg = `¿Rechazar la solicitud de ${name}?`; break;
        case "suspend": patch = { status: "inactive" }; confirmMsg = `¿Suspender el acceso de ${name}?`; break;
        case "reactivate": patch = { role: ["AGENT", "ADMIN"].includes(user.role) ? user.role : "AGENT", status: "active" }; break;
        default: return;
    }
    if (confirmMsg && !confirm(confirmMsg)) return;
    btn.disabled = true;
    const res = await window.AuthManager.setUserAccess(uid, patch);
    if (!res.success) {
        btn.disabled = false;
        alert(teamErrorMessage(res));
    }
}

async function handleTeamRoleChange(uid, role, select) {
    if (role === "SUPER_ADMIN") {
        const target = teamState.users.find(u => u.uid === uid);
        const name = target ? (target.displayName || target.email) : "este usuario";
        if (!confirm(`¿Promover a ${name} a Super Admin? Podrá gestionar el equipo y todos los roles.`)) {
            renderTeam(); // revertir el desplegable
            return;
        }
    }
    select.disabled = true;
    const res = await window.AuthManager.setUserAccess(uid, { role });
    select.disabled = false;
    if (!res.success) {
        alert(teamErrorMessage(res));
        renderTeam(); // revertir el desplegable al valor real
    }
}


// ---- Toast Notifications ----
window.showToast = function (message, type = "success") {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        container.className = "toast-container";
        document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    const icon = type === "success" ? "✓" : (type === "error" ? "✕" : "ℹ");
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
    `;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }, 3500);
};

window.openPhoneModal = function (uid) {
    const modal = document.getElementById("member-phone-modal");
    if (!modal) return;
    const user = (teamState.users || []).find(u => u.uid === uid)
        || (window.AuthManager?.currentUserProfile?.uid === uid ? window.AuthManager.currentUserProfile : null)
        || (window.auth?.currentUser?.uid === uid ? { uid, displayName: window.auth.currentUser.displayName, email: window.auth.currentUser.email } : null);

    const uidInput = document.getElementById("phone-modal-uid");
    const phoneInput = document.getElementById("input-member-phone");
    const nameEl = document.getElementById("phone-modal-user-name");
    const emailEl = document.getElementById("phone-modal-user-email");
    const previewWrap = document.getElementById("phone-modal-user-preview");
    const titleEl = document.getElementById("phone-modal-title");

    const me = window.auth && window.auth.currentUser ? window.auth.currentUser.uid : null;
    const isSelf = me && me === uid;

    if (uidInput) uidInput.value = uid || "";
    if (phoneInput) {
        phoneInput.value = user?.phone || user?.whatsapp || "";
        setTimeout(() => phoneInput.focus(), 100);
    }

    if (titleEl) {
        titleEl.textContent = isSelf ? "Mi Teléfono / WhatsApp" : "Editar Teléfono de Miembro";
    }

    if (previewWrap && user) {
        previewWrap.style.display = "block";
        if (nameEl) nameEl.textContent = user.displayName || user.email || "Miembro";
        if (emailEl) emailEl.textContent = user.email ? `(${user.email})` : "";
    } else if (previewWrap) {
        previewWrap.style.display = "none";
    }

    modal.style.display = "block";
    document.body.style.overflow = "hidden";
};

window.closePhoneModal = function () {
    const modal = document.getElementById("member-phone-modal");
    if (modal) modal.style.display = "none";
    document.body.style.overflow = "auto";
};

function initPhoneModalModule() {
    const modal = document.getElementById("member-phone-modal");
    const form = document.getElementById("form-member-phone");
    const closeBtn = document.getElementById("btn-close-phone-modal");
    const cancelBtn = document.getElementById("btn-cancel-phone-modal");
    const btnEditMyPhone = document.getElementById("btn-edit-my-phone");

    if (btnEditMyPhone) {
        btnEditMyPhone.onclick = () => {
            closeModal();
            const myUid = window.auth && window.auth.currentUser ? window.auth.currentUser.uid : (window.AuthManager?.currentUserProfile?.uid || null);
            if (myUid) openPhoneModal(myUid);
        };
    }

    if (!modal || !form) return;

    if (closeBtn) closeBtn.onclick = closePhoneModal;
    if (cancelBtn) cancelBtn.onclick = closePhoneModal;
    modal.onclick = (e) => {
        if (e.target === modal) closePhoneModal();
    };

    form.onsubmit = async (e) => {
        e.preventDefault();
        const uid = document.getElementById("phone-modal-uid").value;
        const phoneInput = document.getElementById("input-member-phone");
        const rawVal = phoneInput ? phoneInput.value.trim() : "";
        const saveBtn = document.getElementById("btn-save-phone-modal");
        const btnText = saveBtn?.querySelector(".btn-text");
        const btnSpinner = saveBtn?.querySelector(".btn-spinner");

        if (saveBtn) saveBtn.disabled = true;
        if (btnText) btnText.style.display = "none";
        if (btnSpinner) btnSpinner.style.display = "inline-block";

        try {
            const res = await window.AuthManager.updateUserPhone(uid, rawVal);
            if (res.success) {
                const member = (teamState.users || []).find(u => u.uid === uid);
                if (member) {
                    member.phone = res.phone;
                    member.whatsapp = res.phone;
                    renderTeam();
                }
                closePhoneModal();
                showToast("Teléfono actualizado correctamente", "success");
            } else {
                alert(res.error || "No se pudo actualizar el teléfono.");
            }
        } catch (err) {
            console.error("Error al guardar teléfono:", err);
            alert("Ocurrió un error inesperado al actualizar el teléfono.");
        } finally {
            if (saveBtn) saveBtn.disabled = false;
            if (btnText) btnText.style.display = "inline-block";
            if (btnSpinner) btnSpinner.style.display = "none";
        }
    };
}

function closeAllTeamDropdowns() {
    document.querySelectorAll(".team-row-dropdown.is-open").forEach(d => {
        d.classList.remove("is-open");
        d.style.top = "";
        d.style.bottom = "";
    });
    document.querySelectorAll(".btn-team-more.active").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".team-table tr.dropdown-open").forEach(r => r.classList.remove("dropdown-open"));
}

function initTeamModule() {
    initPhoneModalModule();
    const btnTeam = document.getElementById("btn-team");
    const modal = document.getElementById("team-modal");
    if (!btnTeam || !modal) return;
    btnTeam.onclick = () => { closeAllTeamDropdowns(); teamState.tab = "active"; renderTeam(); openModal(modal); };

    modal.addEventListener("click", async e => {
        if (e.target === modal) {
            closeAllTeamDropdowns();
            closeModal();
            return;
        }

        const moreBtn = e.target.closest("[data-team-more-trigger]");
        if (moreBtn) {
            e.stopPropagation();
            const wrap = moreBtn.closest(".team-more-wrap");
            const dropdown = wrap ? wrap.querySelector(".team-row-dropdown") : null;
            const tr = moreBtn.closest("tr");
            const wasOpen = dropdown ? dropdown.classList.contains("is-open") : false;

            closeAllTeamDropdowns();

            if (!wasOpen && dropdown) {
                dropdown.classList.add("is-open");
                moreBtn.classList.add("active");
                if (tr) tr.classList.add("dropdown-open");

                // Check vertical room relative to modal content
                const modalContent = modal.querySelector(".modal-content") || modal;
                const dropRect = dropdown.getBoundingClientRect();
                const modalRect = modalContent.getBoundingClientRect();
                if (dropRect.bottom > modalRect.bottom - 12) {
                    dropdown.style.top = "auto";
                    dropdown.style.bottom = "calc(100% + 6px)";
                } else {
                    dropdown.style.top = "calc(100% + 6px)";
                    dropdown.style.bottom = "auto";
                }
            }
            return;
        }

        const actionBtn = e.target.closest("[data-team-action]");
        if (actionBtn) {
            closeAllTeamDropdowns();
            await handleTeamAction(actionBtn.dataset.teamAction, actionBtn.dataset.uid, actionBtn);
            return;
        }

        const insideDropdown = e.target.closest(".team-row-dropdown");
        if (!insideDropdown) {
            closeAllTeamDropdowns();
        }

        const tabBtn = e.target.closest("[data-team-tab]");
        if (tabBtn) {
            closeAllTeamDropdowns();
            teamState.tab = tabBtn.dataset.teamTab;
            renderTeam();
            return;
        }
    });

    modal.addEventListener("change", async e => {
        const select = e.target.closest("select[data-team-role]");
        if (select) await handleTeamRoleChange(select.dataset.uid, select.value, select);
    });

    document.addEventListener("click", e => {
        if (!e.target.closest(".team-more-wrap")) {
            closeAllTeamDropdowns();
        }
    });
}

function showLoginMessage(text, type) {
    const el = document.getElementById("login-message");
    if (!el) { if (text) alert(text); return; }
    el.textContent = text || "";
    el.className = `login-message ${type || "error"}`;
    el.hidden = !text;
}

// ---- Mejorar descripcion con IA ----
function collectDescriptionContext() {
    const val = id => (document.getElementById(id)?.value || "").trim();
    const typeSelect = document.getElementById("prop-type");
    const features = Array.from(document.querySelectorAll("#custom-features-container .feature-data"))
        .map(i => {
            try {
                const f = JSON.parse(i.value);
                const qty = String(f.qty || "").trim();
                return qty && qty !== "0" && qty !== "-" ? `${f.name}: ${qty}` : f.name;
            } catch (e) { return null; }
        })
        .filter(Boolean);
    return {
        title: val("prop-title"),
        operation: val("prop-category"),
        propertyType: typeSelect && typeSelect.selectedIndex >= 0 ? typeSelect.options[typeSelect.selectedIndex].text : "",
        areaTotal: val("prop-area-total"),
        areaBuilt: val("prop-area-built"),
        price: val("prop-price"),
        currency: val("prop-currency"),
        features,
        city: window.SITE_CONFIG?.contact?.city || "Salta",
        draft: val("prop-desc")
    };
}

async function requestImprovedDescription(ctx) {
    const user = window.auth && window.auth.currentUser;
    if (!user || user.isAnonymous) throw new Error("Se requiere sesión de Google");
    const idToken = await user.getIdToken();
    const res = await fetch("/api/improve-description", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify(ctx)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.text) throw new Error("Respuesta vacía");
    return json.text;
}

// Plantilla de respaldo (sin IA) cuando la API no esta disponible, p. ej. en desarrollo local.
function buildLocalDescription(ctx) {
    const ops = { venta: "en venta", alquiler: "en alquiler" };
    const tipo = ctx.propertyType || "Propiedad";
    const parts = [];
    parts.push(`${tipo} ${ops[ctx.operation] || ""} en ${ctx.city}${ctx.title ? ": " + ctx.title.replace(/[.\s]+$/, "") : ""}.`.replace(/\s+/g, " "));
    if (ctx.areaTotal) {
        parts.push(`Cuenta con ${ctx.areaTotal} m² de superficie total${ctx.areaBuilt ? ` y ${ctx.areaBuilt} m² cubiertos` : ""}.`);
    }
    if (ctx.features.length) {
        parts.push(`Entre sus ambientes y comodidades se destacan: ${ctx.features.join(", ")}.`);
    }
    if (ctx.draft) parts.push(ctx.draft);
    parts.push(`Una excelente oportunidad en ${ctx.city}. Consultanos y coordiná una visita con nuestro equipo de asesores.`);
    return parts.join("\n\n");
}

async function deleteProperty(id) {
    const manager = window.AuthManager;
    if (!manager || !manager.isLoggedIn() || !manager.hasPermission(manager.Permissions.DELETE_PROPERTY)) {
        alert("No tienes permisos para eliminar publicaciones. Esta acción está reservada para Administradores.");
        return;
    }
    if (!confirm("¿Estás seguro de que deseas eliminar esta publicación permanentemente?")) return;

    try {
        const prop = properties.find(p => p.id === id);
        
        if (prop && prop.firebaseId) {
            // Delete from Firestore
            await window.db.collection("properties").doc(prop.firebaseId).delete();
        } else {
            // It's a base property, we "soft-delete" it by adding its ID to Firestore
            await window.db.collection("deleted_properties").doc(String(id)).set({ deletedAt: new Date().toISOString() });
        }
        
        alert("Publicación eliminada con éxito.");
        loadProperties();
    } catch (err) {
        console.error("Error deleting property:", err);
        alert("Error al eliminar la propiedad.");
    }
}

// Global Image State
let uploadedImages = [];

// Helper - Render image previews with reordering
function renderThumbnails() {
    const previews = document.getElementById("image-previews");
    if (!previews) return;
    previews.innerHTML = "";

    uploadedImages.forEach((img, index) => {
        const thumb = document.createElement("div");
        thumb.className = "preview-thumbnail";
        thumb.draggable = true;
        thumb.dataset.index = index;

        const displaySrc = typeof img === 'string' ? img : img.preview;
        thumb.innerHTML = `
            <img src="${displaySrc}">
            <button type="button" class="btn-set-cover" onclick="setAsCover(${index})" title="Poner como portada">✨</button>
            <button type="button" class="btn-remove-preview" onclick="removeThumbnail(${index})">&times;</button>
        `;

        // Drag Events
        thumb.ondragstart = (e) => {
            e.dataTransfer.setData("text/plain", index);
            thumb.classList.add("dragging");
        };

        thumb.ondragend = () => {
            thumb.classList.remove("dragging");
        };

        thumb.ondragover = (e) => e.preventDefault();

        thumb.ondrop = (e) => {
            e.preventDefault();
            const fromIndex = parseInt(e.dataTransfer.getData("text/plain"));
            const toIndex = index;

            if (fromIndex !== toIndex) {
                const movedItem = uploadedImages.splice(fromIndex, 1)[0];
                uploadedImages.splice(toIndex, 0, movedItem);
                renderThumbnails();
            }
        };

        previews.appendChild(thumb);
    });
}

function removeThumbnail(index) {
    uploadedImages.splice(index, 1);
    renderThumbnails();
}

function setAsCover(index) {
    if (index === 0) return;
    const img = uploadedImages.splice(index, 1)[0];
    uploadedImages.unshift(img);
    renderThumbnails();
}

function renderStructuredFeature(feat) {
    const container = document.getElementById("custom-features-container");
    if (!container) return;

    const div = document.createElement("div");
    div.className = "structured-feature-tag";
    div.style = "display: inline-flex; align-items: center; gap: 8px; background: #f0f4ff; padding: 6px 12px; border-radius: 20px; margin: 0 8px 8px 0; font-size: 0.85rem; border: 1px solid #d0deff;";

    const displayLabel = feat.qty ? `${feat.qty} ${feat.name}` : feat.name;

    div.innerHTML = `
        <span>${feat.icon}</span>
        <strong>${displayLabel}</strong>
        <button type="button" class="btn-remove-feature" style="background:none; border:none; color:#999; cursor:pointer; font-size:1.1rem; padding:0 0 0 5px; line-height:1;">&times;</button>
        <input type="hidden" class="feature-data" value='${JSON.stringify(feat).replace(/'/g, "&apos;")}'>
    `;

    container.appendChild(div);
    div.querySelector(".btn-remove-feature").onclick = () => div.remove();
}

function populateAgentDropdown() {
    const agentSelect = document.getElementById("prop-agent");
    if (!agentSelect) return;

    // Save current selection to restore it if possible
    const currentVal = agentSelect.value;

    const configAgents = Array.isArray(window.SITE_CONFIG?.agents) ? window.SITE_CONFIG.agents : [];
    const users = (window.AuthManager && typeof window.AuthManager.getAllUsersSync === "function")
        ? (window.AuthManager.getAllUsersSync() || [])
        : [];

    agentSelect.innerHTML = '<option value="">Seleccionar agente...</option>';

    const addedIds = new Set();

    // 1. Listar agentes centralizados en config.js
    configAgents.forEach(agent => {
        if (!agent || !agent.id) return;
        const opt = document.createElement("option");
        opt.value = agent.id;
        opt.textContent = agent.name;
        agentSelect.appendChild(opt);
        addedIds.add(String(agent.id).toLowerCase());
        addedIds.add(String(agent.name || "").toLowerCase());
        if (Array.isArray(agent.aliases)) {
            agent.aliases.forEach(al => addedIds.add(String(al).toLowerCase()));
        }
    });

    // 2. Agregar usuarios adicionales de AuthManager que no estén en SITE_CONFIG.agents
    users.forEach(user => {
        const uKey = String(user.username || "").toLowerCase();
        const dKey = String(user.displayName || "").toLowerCase();
        if (addedIds.has(uKey) || addedIds.has(dKey)) return;
        const opt = document.createElement("option");
        opt.value = user.username || user.displayName;
        opt.textContent = user.displayName || user.username;
        agentSelect.appendChild(opt);
    });

    if (currentVal) agentSelect.value = currentVal;
}

function updateCreditVisibility() {
    const category = document.getElementById("prop-category").value;
    const creditWrapper = document.getElementById("credit-option-wrapper");
    if (creditWrapper) {
        creditWrapper.style.display = (category === "venta") ? "flex" : "none";
    }
}

function openEditModal(id) {
    const prop = properties.find(p => p.id === id);
    if (!prop) return;

    const manager = window.AuthManager;
    if (!manager || !manager.isLoggedIn()) {
        alert("Debes iniciar sesión para editar publicaciones.");
        return;
    }
    if (!manager.canUserEditProperty(prop)) {
        alert("No tienes permisos para editar esta propiedad.");
        return;
    }

    currentEditingId = id;

    // Repopulate agents just in case
    populateAgentDropdown();

    // Fill fields
    document.getElementById("prop-title").value = prop.title || "";
    document.getElementById("prop-category").value = prop.category || "venta";
    document.getElementById("prop-type").value = prop.type || "casa";
    document.getElementById("prop-desc").value = prop.description || "";
    document.getElementById("prop-price").value = formatNumber(prop.price);
    document.getElementById("prop-currency").value = prop.currency || "USD";

    // Owner data visibility according to permissions
    const canViewPrivate = manager.hasPermission(manager.Permissions.VIEW_PRIVATE_DATA);
    const ownerSection = document.getElementById("section-prop-owner");
    if (ownerSection) {
        ownerSection.style.display = canViewPrivate ? "block" : "none";
    }
    if (canViewPrivate) {
        document.getElementById("prop-owner-name").value = prop.ownerName || "";
        document.getElementById("prop-owner-phone").value = prop.ownerPhone || "";
        document.getElementById("prop-owner-address").value = prop.ownerAddress || "";
    } else {
        document.getElementById("prop-owner-name").value = "";
        document.getElementById("prop-owner-phone").value = "";
        document.getElementById("prop-owner-address").value = "";
    }

    const resolvedAgent = window.getPropertyAgent ? window.getPropertyAgent(prop) : null;
    const agentSelect = document.getElementById("prop-agent");
    const canReassignAgent = Boolean(manager.isSuperAdmin() || manager.isAdmin());
    if (agentSelect) {
        const candidateId = prop.agentId || (resolvedAgent && resolvedAgent.id !== "agente-default" ? resolvedAgent.id : "") || prop.agent || "";
        agentSelect.value = candidateId;
        agentSelect.disabled = !canReassignAgent;
        if (!canReassignAgent) {
            agentSelect.title = "Solo administradores pueden reasignar el asesor a cargo.";
        } else {
            agentSelect.removeAttribute("title");
        }
    }
    document.getElementById("prop-credit").checked = !!prop.creditEligible;
    document.getElementById("prop-map-link").value = prop.mapLink || "";

    // Memoria Descriptiva
    const hasMemory = !!prop.memoryDescription;
    document.getElementById("prop-has-memory").checked = hasMemory;
    const memoryWrapper = document.getElementById("memory-description-wrapper");
    memoryWrapper.style.display = hasMemory ? "block" : "none";
    document.getElementById("prop-memory-desc").value = prop.memoryDescription || "";

    // Expensas
    const hasExpensas = !!prop.expensasAmount;
    document.getElementById("prop-has-expensas").checked = hasExpensas;
    const expensasWrapper = document.getElementById("expensas-wrapper");
    expensasWrapper.style.display = hasExpensas ? "flex" : "none";
    document.getElementById("prop-expensas-amount").value = formatNumber(prop.expensasAmount);
    document.getElementById("prop-expensas-currency").value = prop.expensasCurrency || "ARS";

    // Sync visibility
    updateCreditVisibility();

    // Surfaces
    document.getElementById("prop-area-total").value = formatNumber(prop.areaTotal);
    document.getElementById("prop-area-built").value = formatNumber(prop.areaBuilt);

    // Images
    uploadedImages = [...prop.images];
    renderThumbnails();

    // Custom Features (Details)
    const container = document.getElementById("custom-features-container");
    container.innerHTML = "";
    if (prop.customFeatures) {
        prop.customFeatures.forEach(feat => {
            if (typeof feat === 'string') {
                renderStructuredFeature({ name: feat, icon: "✨", qty: "" });
            } else {
                renderStructuredFeature(feat);
            }
        });
    }

    // Coordinates and picker mini-map
    const latVal = (prop.lat !== undefined && prop.lat !== null) ? prop.lat : "";
    const lngVal = (prop.lng !== undefined && prop.lng !== null) ? prop.lng : "";
    const propLatInput = document.getElementById("prop-lat");
    const propLngInput = document.getElementById("prop-lng");
    if (propLatInput) propLatInput.value = latVal;
    if (propLngInput) propLngInput.value = lngVal;
    updatePickerMapPosition(latVal, lngVal);

    // Change modal title
    const modalHeader = propertyModal.querySelector(".modal-header h2");
    if (modalHeader) modalHeader.textContent = "Editar propiedad";

    openModal(propertyModal);
}

// Event Bindings
function bindEvents() {
    [filterType, filterRooms, sortBy].forEach(el => el && el.addEventListener("change", applyFilters));
    [filterPriceMin, filterPriceMax, searchInput].forEach(el => el && el.addEventListener("input", applyFilters));

    if (filterPropType) {
        filterPropType.addEventListener("change", () => {
            const val = filterPropType.value;
            selectedPropertyTypes = (val && val !== "todos") ? [val] : [];
            updateActiveTypeUI();
            applyFilters();
        });
    }

    if (btnHeroSearch) {
        btnHeroSearch.onclick = () => {
            applyFilters();
            const propSection = document.getElementById("propiedades");
            if (propSection) propSection.scrollIntoView({ behavior: "smooth" });
        };
    }

    if (clearFiltersBtn) clearFiltersBtn.onclick = () => {
        if (filterPropType) filterPropType.value = "todos";
        filterType.value = "todos"; filterRooms.value = "0";
        filterPriceMin.value = ""; filterPriceMax.value = "";
        searchInput.value = "";
        selectedPropertyTypes = [];
        updateActiveTypeUI();

        // Reset nav active state
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelector('.nav-link[href="index.html"]')?.classList.add('active');

        applyFilters();
    };

    if (btnLogin) btnLogin.onclick = () => openModal(loginModal);
    if (btnSettings) btnSettings.onclick = () => {
        // Reset modal state
        document.getElementById("change-password-form").style.display = "none";
        document.getElementById("user-management-section").style.display = "none";
        openModal(settingsModal);
    };

    const btnToggleUserMgmt = document.getElementById("btn-toggle-user-mgmt");
    if (btnToggleUserMgmt) {
        btnToggleUserMgmt.onclick = () => {
            const section = document.getElementById("user-management-section");
            const isVisible = section.style.display === "block";
            section.style.display = isVisible ? "none" : "block";
            if (!isVisible) renderUserList();
        };
    }

    const btnChangePassword = document.getElementById("btn-change-password");
    if (btnChangePassword) {
        btnChangePassword.onclick = () => {
            const form = document.getElementById("change-password-form");
            form.style.display = form.style.display === "block" ? "none" : "block";
        };
    }

    const pwForm = document.getElementById("pw-form");
    if (pwForm) {
        pwForm.onsubmit = async (e) => {
            e.preventDefault();
            const newPasswordInput = document.getElementById("new-password");
            const newPassword = newPasswordInput.value;
            
            const submitBtn = pwForm.querySelector('button[type="submit"]');
            const originalText = submitBtn ? submitBtn.textContent : "Guardar nueva contraseña";
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = "Guardando...";
            }

            try {
                const result = await window.AuthManager.changePassword(newPassword);
                if (result && result.success) {
                    if (result.mode === "firestore") {
                        alert("Contraseña actualizada con éxito en la base de datos (Nube).");
                    } else if (result.mode === "core" || result.mode === "local") {
                        alert("Contraseña actualizada con éxito en el almacenamiento local de este navegador.");
                    } else if (result.mode === "local_fallback") {
                        alert("La contraseña se guardó localmente porque no se pudo conectar con la base de datos en la nube.");
                    } else {
                        alert("Contraseña actualizada con éxito.");
                    }
                    newPasswordInput.value = "";
                    document.getElementById("change-password-form").style.display = "none";
                } else {
                    const reason = result ? result.reason : "";
                    if (reason === "invalid_password") {
                        alert("Error: La contraseña debe tener al menos 6 caracteres.");
                    } else {
                        alert("Error al cambiar la contraseña: " + (result?.error || "Inténtalo de nuevo."));
                    }
                }
            } catch (err) {
                console.error("Error al cambiar la contraseña:", err);
                alert("Ocurrió un error inesperado al intentar cambiar la contraseña.");
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                }
            }
        };
    }

    // Inicializar visualización de contraseña (ojito)
    document.querySelectorAll(".toggle-password").forEach(btn => {
        btn.onclick = function() {
            const input = this.previousElementSibling;
            const eyeOpen = this.querySelector(".eye-open");
            const eyeClosed = this.querySelector(".eye-closed");
            
            if (input.type === "password") {
                input.type = "text";
                if (eyeOpen) eyeOpen.style.display = "none";
                if (eyeClosed) eyeClosed.style.display = "block";
            } else {
                input.type = "password";
                if (eyeOpen) eyeOpen.style.display = "block";
                if (eyeClosed) eyeClosed.style.display = "none";
            }
        };
    });
    if (btnAddProperty) {
        btnAddProperty.onclick = () => {
            currentEditingId = null;
            propertyForm.reset();
            populateAgentDropdown();
            updateCreditVisibility();

            const manager = window.AuthManager;
            const canViewPrivate = Boolean(manager && manager.hasPermission(manager.Permissions.VIEW_PRIVATE_DATA));
            const ownerSection = document.getElementById("section-prop-owner");
            if (ownerSection) {
                ownerSection.style.display = canViewPrivate ? "block" : "none";
            }
            if (!canViewPrivate) {
                document.getElementById("prop-owner-name").value = "";
                document.getElementById("prop-owner-phone").value = "";
                document.getElementById("prop-owner-address").value = "";
            }

            const canReassignAgent = Boolean(manager && (manager.isSuperAdmin() || manager.isAdmin()));
            const agentSelect = document.getElementById("prop-agent");
            if (agentSelect) {
                if (!canReassignAgent) {
                    const currentUser = manager?.getUserData ? manager.getUserData() : null;
                    const myId = currentUser?.uid || manager?.getDisplayName() || "";
                    let found = false;
                    for (let i = 0; i < agentSelect.options.length; i++) {
                        if (agentSelect.options[i].value === myId || (manager?.getDisplayName() && agentSelect.options[i].textContent.includes(manager.getDisplayName()))) {
                            agentSelect.selectedIndex = i;
                            found = true;
                            break;
                        }
                    }
                    if (!found && myId) {
                        const opt = document.createElement("option");
                        opt.value = myId;
                        opt.textContent = manager?.getDisplayName() || "Mi perfil";
                        agentSelect.appendChild(opt);
                        agentSelect.value = myId;
                    }
                    agentSelect.disabled = true;
                    agentSelect.title = "Las nuevas publicaciones quedan automáticamente asignadas a tu nombre.";
                } else {
                    agentSelect.disabled = false;
                    agentSelect.removeAttribute("title");
                }
            }

            document.getElementById("prop-area-total").value = "";
            document.getElementById("prop-area-built").value = "";
            document.getElementById("prop-has-memory").checked = false;
            document.getElementById("memory-description-wrapper").style.display = "none";
            document.getElementById("prop-memory-desc").value = "";
            document.getElementById("prop-has-expensas").checked = false;
            document.getElementById("expensas-wrapper").style.display = "none";
            document.getElementById("prop-expensas-amount").value = "";
            document.getElementById("custom-features-container").innerHTML = "";
            document.getElementById("image-previews").innerHTML = "";
            uploadedImages = [];
            const propLatInput = document.getElementById("prop-lat");
            const propLngInput = document.getElementById("prop-lng");
            if (propLatInput) propLatInput.value = "";
            if (propLngInput) propLngInput.value = "";
            updatePickerMapPosition(null, null);

            const modalHeader = propertyModal.querySelector(".modal-header h2");
            if (modalHeader) modalHeader.textContent = "Cargar nueva propiedad";
            openModal(propertyModal);
        };
    }
    if (btnLogout) btnLogout.onclick = () => {
        window.AuthManager.logout();
        showUnavailableMode = false;
        updateAuthUI();
        applyFilters();
    };
    closeBtns.forEach(btn => btn.onclick = closeModal);

    const btnToggleUnavailable = document.getElementById("btn-toggle-unavailable");
    if (btnToggleUnavailable) {
        btnToggleUnavailable.onclick = () => {
            if (showUnavailableMode) {
                exitUnavailableMode();
            } else {
                renderUnavailableProperties();
            }
            const propSection = document.getElementById("propiedades");
            if (propSection) propSection.scrollIntoView({ behavior: "smooth" });
        };
    }

    // Cerrar menús de acciones de propiedades al hacer clic afuera
    document.addEventListener("click", () => {
        document.querySelectorAll(".property-settings-menu.show").forEach(m => m.classList.remove("show"));
    });


    if (btnToggleFilters) {
        btnToggleFilters.onclick = (e) => {
            e.stopPropagation();
            advancedFilters.classList.toggle("show");
        };
    }

    const btnGoogleLogin = document.getElementById("btn-google-login");
    if (btnGoogleLogin) {
        btnGoogleLogin.onclick = async () => {
            showLoginMessage("");
            btnGoogleLogin.disabled = true;
            const res = await window.AuthManager.loginWithGoogle();
            btnGoogleLogin.disabled = false;
            if (res.success) { closeModal(); updateAuthUI(); applyFilters(); return; }
            const msg = window.AuthManager.describeLoginFailure(res);
            if (msg) showLoginMessage(msg, res.reason === "pending" ? "info" : "error");
        };
    }

    initTeamModule();

    const btnImproveAi = document.getElementById("btn-improve-ai");
    if (btnImproveAi) {
        btnImproveAi.onclick = async () => {
            const descField = document.getElementById("prop-desc");
            const ctx = collectDescriptionContext();
            if (!ctx.title && !ctx.draft) {
                alert("Completá al menos el título o un borrador de la descripción.");
                return;
            }
            const label = btnImproveAi.textContent;
            btnImproveAi.disabled = true;
            btnImproveAi.textContent = "Generando...";
            try {
                descField.value = await requestImprovedDescription(ctx);
            } catch (err) {
                console.warn("IA no disponible, usando plantilla base:", err);
                descField.value = buildLocalDescription(ctx);
                alert("No se pudo contactar a la IA; se armó una redacción base con los datos cargados. Revisala antes de guardar.");
            } finally {
                btnImproveAi.disabled = false;
                btnImproveAi.textContent = label;
            }
        };
    }

    // Structured Features logic
    const btnAddFeature = document.getElementById("btn-add-feature");
    const container = document.getElementById("custom-features-container");
    const featurePreset = document.getElementById("feature-preset");
    const featureQty = document.getElementById("feature-qty");

    if (btnAddFeature) {
        btnAddFeature.onclick = () => {
            const name = featurePreset.value;
            if (!name) return;
            const selectedOption = featurePreset.options[featurePreset.selectedIndex];
            renderStructuredFeature({
                name: name,
                icon: selectedOption.getAttribute("data-icon"),
                qty: featureQty.value
            });
            featurePreset.value = "";
            featureQty.value = "";
        };
    }

    // Dynamic Numeric Input Mask (dots)
    document.querySelectorAll(".numeric-input").forEach(input => {
        input.addEventListener("input", (e) => {
            let value = e.target.value.replace(/\D/g, "");
            if (value === "") {
                e.target.value = "";
                return;
            }
            e.target.value = Number(value).toLocaleString("es-AR");
        });
    });

    // Memoria Descriptiva toggle
    const propHasMemory = document.getElementById("prop-has-memory");
    if (propHasMemory) {
        propHasMemory.onchange = (e) => {
            const wrapper = document.getElementById("memory-description-wrapper");
            wrapper.style.display = e.target.checked ? "block" : "none";
        };
    }

    // Expensas toggle
    const propHasExpensas = document.getElementById("prop-has-expensas");
    if (propHasExpensas) {
        propHasExpensas.onchange = (e) => {
            const wrapper = document.getElementById("expensas-wrapper");
            wrapper.style.display = e.target.checked ? "flex" : "none";
        };
    }

    // Category change logic for Apto Credito
    const propCategorySelect = document.getElementById("prop-category");
    if (propCategorySelect) {
        propCategorySelect.onchange = updateCreditVisibility;
    }

    // Image Upload Handling
    const fileInput = document.getElementById("prop-images-file");
    if (fileInput) {
        fileInput.onchange = async (e) => {
            const files = Array.from(e.target.files);
            const statusText = document.createElement("p");
            statusText.textContent = "Procesando imágenes...";
            statusText.style.fontSize = "0.8rem";
            fileInput.parentElement.appendChild(statusText);

            for (const file of files) {
                try {
                    // We compress or just convert for preview for now
                    // Real upload happens on form submit to avoid orphans in Storage
                    const base64 = await toBase64(file);
                    uploadedImages.push({ file, preview: base64 });
                    renderThumbnails();
                } catch (err) {
                    console.error("Error processing file:", err);
                }
            }
            statusText.remove();
            fileInput.value = "";
        };
    }

    // Form Submission (Create or Edit)
    if (propertyForm) {
        propertyForm.onsubmit = async (e) => {
            e.preventDefault();
            const submitBtn = propertyForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = "Publicando...";

            try {
                const manager = window.AuthManager;
                const existing = currentEditingId ? properties.find(p => p.id === currentEditingId) : null;

                if (currentEditingId && existing && manager && !manager.canUserEditProperty(existing)) {
                    alert("No tienes permisos para editar esta publicación.");
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                    return;
                }

                const currentUserData = manager?.getUserData ? manager.getUserData() : null;
                const currentUid = currentUserData?.uid || window.auth?.currentUser?.uid || "";
                const currentName = manager?.getDisplayName ? manager.getDisplayName() : "";
                const currentEmail = currentUserData?.email || window.auth?.currentUser?.email || "";
                const canViewPrivate = Boolean(manager && manager.hasPermission(manager.Permissions.VIEW_PRIVATE_DATA));
                const canReassignAgent = Boolean(manager && (manager.isSuperAdmin() || manager.isAdmin()));

                const featuresContainer = document.getElementById("custom-features-container");
                const customFeatures = featuresContainer ? Array.from(featuresContainer.querySelectorAll(".feature-data")).map(i => JSON.parse(i.value)) : [];
                const category = document.getElementById("prop-category").value;
                const type = document.getElementById("prop-type").value;
                const price = unformatNumber(document.getElementById("prop-price").value);
                const currency = document.getElementById("prop-currency").value;

                let agentId = "";
                let agentName = "";
                let agentEmail = "";

                if (!canReassignAgent && !currentEditingId) {
                    // Nuevo inmueble creado por un AGENT: queda asignado a él mismo
                    agentId = currentUid || "agente-default";
                    agentName = currentName || "Asesor Inmobiliario";
                    agentEmail = currentEmail || "";
                } else if (!canReassignAgent && currentEditingId && existing) {
                    // Inmueble editado por un AGENT: preserva el asesor asignado existente
                    agentId = existing.agentId || currentUid;
                    agentName = existing.agent || currentName;
                    agentEmail = existing.agentEmail || currentEmail;
                } else {
                    // ADMIN o SUPER_ADMIN: toma el selector
                    const selectedAgentVal = document.getElementById("prop-agent").value;
                    const resolvedAgent = window.getPropertyAgent
                        ? window.getPropertyAgent({ agentId: selectedAgentVal, agent: selectedAgentVal })
                        : null;
                    agentId = selectedAgentVal || (existing?.agentId || "");
                    agentName = (resolvedAgent && selectedAgentVal) ? resolvedAgent.name : (selectedAgentVal || existing?.agent || "");
                    agentEmail = (resolvedAgent && resolvedAgent.email) ? resolvedAgent.email : (existing?.agentEmail || "");
                }

                // Preservar datos privados del propietario si el usuario no tiene permisos de verlos
                const ownerName = canViewPrivate ? document.getElementById("prop-owner-name").value : (existing?.ownerName || "");
                const ownerPhone = canViewPrivate ? document.getElementById("prop-owner-phone").value : (existing?.ownerPhone || "");
                const ownerAddress = canViewPrivate ? document.getElementById("prop-owner-address").value : (existing?.ownerAddress || "");

                const areaTotal = unformatNumber(document.getElementById("prop-area-total").value);
                const areaBuilt = unformatNumber(document.getElementById("prop-area-built").value);

                // 1. Upload new images to Firebase Storage
                const finalImageUrls = [];
                for (const item of uploadedImages) {
                    if (typeof item === 'string') {
                        // Already a URL (editing existing)
                        finalImageUrls.push(item);
                    } else if (item.file) {
                        // New file to upload
                        const fileName = `${Date.now()}_${item.file.name}`;
                        const storageRef = window.storage.ref(`properties/${fileName}`);
                        const snapshot = await storageRef.put(item.file);
                        const url = await snapshot.ref.getDownloadURL();
                        finalImageUrls.push(url);
                    }
                }

                const propertyData = {
                    id: currentEditingId || Date.now(),
                    title: document.getElementById("prop-title").value,
                    description: document.getElementById("prop-desc").value,
                    price: price,
                    currency: currency,
                    category: category,
                    type: type,
                    ownerName: ownerName,
                    ownerPhone: ownerPhone,
                    ownerAddress: ownerAddress,
                    agentId: agentId,
                    agent: agentName,
                    agentEmail: agentEmail,
                    creditEligible: (category === "venta") ? document.getElementById("prop-credit").checked : false,
                    mapLink: document.getElementById("prop-map-link").value,
                    lat: (() => {
                        const v = document.getElementById("prop-lat")?.value;
                        return (v !== "" && v !== null && !isNaN(Number(v))) ? Number(v) : null;
                    })(),
                    lng: (() => {
                        const v = document.getElementById("prop-lng")?.value;
                        return (v !== "" && v !== null && !isNaN(Number(v))) ? Number(v) : null;
                    })(),
                    createdAt: currentEditingId ? (existing?.createdAt || new Date().toISOString()) : new Date().toISOString(),
                    createdBy: currentEditingId ? (existing?.createdBy || currentUid) : currentUid,
                    creatorEmail: currentEditingId ? (existing?.creatorEmail || currentEmail) : currentEmail,
                    images: finalImageUrls,
                    customFeatures,
                    areaTotal: areaTotal || null,
                    areaBuilt: areaBuilt || null,
                    memoryDescription: document.getElementById("prop-has-memory").checked ? document.getElementById("prop-memory-desc").value : "",
                    expensasAmount: document.getElementById("prop-has-expensas").checked ? unformatNumber(document.getElementById("prop-expensas-amount").value) : null,
                    expensasCurrency: document.getElementById("prop-expensas-currency").value
                };

                if (window.showLoader) window.showLoader();

                if (currentEditingId) {
                    const existing = properties.find(p => p.id === currentEditingId);
                    if (existing && existing.firebaseId) {
                        await window.db.collection("properties").doc(existing.firebaseId).update(propertyData);
                    } else {
                        // It was a base property or local, now moving to cloud
                        await window.db.collection("properties").add(propertyData);
                    }
                } else {
                    await window.db.collection("properties").add(propertyData);
                }

                closeModal();
                loadProperties();
                
                if (window.hideLoader) window.hideLoader();

                alert(currentEditingId ? "Propiedad actualizada con éxito" : "Propiedad publicada con éxito");
                currentEditingId = null;
            } catch (err) {
                if (window.hideLoader) window.hideLoader();
                console.error("CRITICAL ERROR publishing property:", err);
                alert(`Error al publicar la propiedad: ${err.message || 'Error desconocido'}. Verifica tu conexión y configuración de Firebase Storage.`);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        };
    }
}

function toBase64(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
    });
}

// User Management Helpers
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function renderUserList() {
    const container = document.getElementById("user-list");
    if (!container) return;

    const manager = window.AuthManager;
    const users = await manager.getAllUsers();
    const currentUser = manager.getCurrentUser();

    container.innerHTML = users.map(u => {
        const isProtected = u.username === "admin" || u.username === currentUser;
        
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee;">
                <div>
                    <strong>${escapeHtml(u.displayName)}</strong> (${u.username})<br>
                    <small style="color: #666;">${u.role}</small>
                </div>
                <div style="display: flex; gap: 8px;">
                    ${u.username !== "admin" ? `
                        <button class="btn btn-outline btn-small" style="color: #3498db; border-color: #3498db;" onclick="handleStartEditUser('${u.username}')">Editar</button>
                    ` : ""}
                    ${!isProtected ? `
                        <button class="btn btn-outline btn-small" style="color: #e74c3c; border-color: #e74c3c;" onclick="handleRemoveUser('${u.username}')">Eliminar</button>
                    ` : ""}
                </div>
            </div>
        `;
    }).join("");
}
window.renderUserList = renderUserList;

async function handleStartEditUser(username) {
    const manager = window.AuthManager;
    const users = await manager.getAllUsers();
    const user = users.find(u => u.username === username);
    if (!user) return;

    currentEditingUsername = username;

    // Poblar el formulario
    document.getElementById("new-username").value = user.username;
    document.getElementById("new-username").disabled = true; // No permitir cambiar el identificador
    document.getElementById("new-displayname").value = user.displayName || "";
    document.getElementById("new-firstname").value = user.firstName || "";
    document.getElementById("new-lastname").value = user.lastName || "";
    document.getElementById("new-phone").value = user.phone || "";
    
    // Configurar campo contraseña
    const passwordInput = document.getElementById("new-user-password");
    passwordInput.value = ""; 
    passwordInput.required = false; // Permitir guardar cambios sin modificar la contraseña
    passwordInput.placeholder = "Dejar en blanco para mantener la misma";

    const lblPassword = document.getElementById("lbl-new-user-password");
    if (lblPassword) {
        lblPassword.innerHTML = 'Nueva contraseña <span style="font-weight: 300; color: #777;">(opcional)</span>';
    }

    document.getElementById("new-role").value = user.role || "ADMIN";

    // Modificar título del formulario
    const formTitle = document.getElementById("user-form-title");
    if (formTitle) formTitle.textContent = `Modificar usuario: ${user.username}`;

    // Modificar interfaz del formulario
    const form = document.getElementById("add-user-form");
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.textContent = "Guardar Cambios";

    // Añadir botón de cancelar si no existe
    let cancelBtn = document.getElementById("btn-cancel-edit-user");
    if (!cancelBtn) {
        cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.id = "btn-cancel-edit-user";
        cancelBtn.className = "btn btn-outline btn-full";
        cancelBtn.style.marginTop = "8px";
        cancelBtn.textContent = "Cancelar Edición";
        cancelBtn.onclick = handleCancelEditUser;
        submitBtn.parentNode.insertBefore(cancelBtn, submitBtn.nextSibling);
    }
}

function handleCancelEditUser() {
    currentEditingUsername = null;
    
    // Resetear formulario
    const form = document.getElementById("add-user-form");
    form.reset();
    
    const passwordInput = document.getElementById("new-user-password");
    passwordInput.disabled = false;
    passwordInput.required = true; // Volver a requerir contraseña para nuevos registros
    passwordInput.placeholder = "Contraseña para iniciar sesión";

    const lblPassword = document.getElementById("lbl-new-user-password");
    if (lblPassword) lblPassword.textContent = "Contraseña de acceso";

    const formTitle = document.getElementById("user-form-title");
    if (formTitle) formTitle.textContent = "Crear nuevo usuario";

    document.getElementById("new-username").disabled = false;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.textContent = "Crear Usuario";

    // Eliminar botón cancelar
    const cancelBtn = document.getElementById("btn-cancel-edit-user");
    if (cancelBtn) cancelBtn.remove();
}

async function handleAddUser(e) {
    e.preventDefault();
    const manager = window.AuthManager;
    await manager._loadUsersFromFirestore(); // Ensure we have latest before adding
    const userData = {
        username: document.getElementById("new-username").value,
        displayName: document.getElementById("new-displayname").value,
        firstName: document.getElementById("new-firstname").value,
        lastName: document.getElementById("new-lastname").value,
        phone: document.getElementById("new-phone").value,
        password: document.getElementById("new-user-password").value,
        role: document.getElementById("new-role").value
    };

    if (currentEditingUsername !== null) {
        // Modo Edición
        const result = await manager.updateUser(currentEditingUsername, userData);
        if (result.success) {
            handleCancelEditUser();
            await renderUserList();
            if (result.mode === "firestore") {
                alert("Usuario actualizado con éxito en la base de datos en la nube.");
            } else if (result.mode === "local" || result.mode === "core") {
                alert("Usuario actualizado con éxito en el almacenamiento local del navegador.");
            }
        } else {
            if (result.reason === "permission") {
                alert("Error: No tienes permisos de administrador para modificar usuarios.");
            } else {
                alert(`Error al actualizar el usuario: ${result.error || 'Error desconocido'}`);
            }
        }
    } else {
        // Modo Creación
        const result = await manager.addUser(userData);
        if (result.success) {
            e.target.reset();
            await renderUserList();
            if (result.mode === "firestore") {
                alert("Usuario creado con éxito en la base de datos en la nube.");
            } else if (result.mode === "local") {
                alert(`Usuario creado y guardado localmente en este navegador.\n\n(Nota: La base de datos en la nube no aceptó la escritura directa debido a permisos o conexión, pero podrás iniciar sesión normalmente en este equipo).`);
            }
        } else {
            if (result.reason === "duplicate") {
                alert("Error: El nombre de usuario ya está registrado.");
            } else if (result.reason === "permission") {
                alert("Error: No tienes permisos de administrador para agregar usuarios.");
            } else {
                alert(`Error al crear el usuario: ${result.error || 'Error desconocido'}`);
            }
        }
    }
}

async function handleRemoveUser(username) {
    if (!confirm(`¿Estás seguro de que deseas eliminar al usuario "${username}"? Esta acción no se puede deshacer.`)) return;
    const result = await window.AuthManager.removeUser(username);
    if (result.success) {
        await renderUserList();
        if (result.mode === "firestore") {
            alert("Usuario eliminado correctamente de la base de datos en la nube.");
        } else if (result.mode === "local") {
            alert("Usuario local eliminado correctamente de este navegador.");
        } else {
            alert("Usuario eliminado correctamente.");
        }
    } else {
        if (result.reason === "protected") {
            alert("Error: No se puede eliminar la cuenta de administrador principal.");
        } else if (result.reason === "self") {
            alert("Error: No puedes eliminar tu propia cuenta de usuario activa.");
        } else if (result.reason === "permission") {
            alert("Error: No tienes permisos de administrador para eliminar usuarios.");
        } else {
            alert("Error: No se pudo eliminar al usuario.");
        }
    }
}
window.handleRemoveUser = handleRemoveUser;

async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const typeParam = urlParams.get('type');
    if (typeParam) {
        selectedPropertyTypes = typeParam
            .split(',')
            .map(t => t.trim().toLowerCase())
            .filter(Boolean);
        // Limpiar el parámetro de la URL para que al refrescar (F5) la página inicie limpia sin filtros pegados
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('type');
        window.history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.search);
    }

    renderPropertyCategories();
    updateActiveTypeUI();

    if (window.AuthManager && window.AuthManager._readyPromise) {
        await window.AuthManager._readyPromise;
    }
    // Initial load
    await loadProperties();
    updateAuthUI();
    bindEvents();
    initNavigation();

    // Asegurar que el mapa esté inicializado y redimensionado al cargar la página
    initCatalogMap();
    if (Array.isArray(properties) && properties.length > 0) {
        renderCatalogMap(properties);
    }
    setTimeout(() => {
        if (window.catalogMap || window.catalogMapInstance) {
            (window.catalogMap || window.catalogMapInstance).invalidateSize();
        }
    }, 200);

    document.getElementById("add-user-form")?.addEventListener("submit", handleAddUser);

    if (selectedPropertyTypes.length > 0) {
        const propSection = document.getElementById("propiedades");
        if (propSection) propSection.scrollIntoView({ behavior: "smooth" });
    }

    // Check for edit parameter to auto-open modal from details page
    const editId = urlParams.get('edit');
    if (editId) {
        const numId = Number(editId);
        const prop = properties.find(p => p.id === numId || String(p.id) === editId);
        if (prop && window.AuthManager && window.AuthManager.hasPermission(window.AuthManager.Permissions.EDIT_PROPERTY)) {
            openEditModal(prop.id);
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
}

/**
 * Navigation & Active State Management (ScrollSpy)
 */
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = [
        { id: 'inicio', element: document.querySelector('.header') }, 
        { id: 'propiedades', element: document.getElementById('propiedades') },
        { id: 'nosotros', element: document.getElementById('nosotros') },
        { id: 'contacto', element: document.getElementById('contacto') }
    ];

    const updateActive = (id) => {
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            // Avoid removing active from special buttons like login/logout/publish
            if (link.id && link.id.startsWith('btn-')) return;
            
            link.classList.remove('active');
            if (id === 'inicio' && (href === 'index.html' || href === 'index.html#')) {
                link.classList.add('active');
            } else if (href === '#' + id) {
                link.classList.add('active');
            }
        });
    };

    // Intersection Observer for ScrollSpy
    const observerOptions = {
        root: null,
        rootMargin: '-40% 0px -40% 0px',
        threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.id || (entry.target.classList.contains('header') ? 'inicio' : '');
                if (id) updateActive(id);
            }
        });
    }, observerOptions);

    sections.forEach(sec => {
        if (sec.element) {
            observer.observe(sec.element);
        }
    });

    // Manual click handling
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            if (this.id && this.id.startsWith('btn-')) return;
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

init();
