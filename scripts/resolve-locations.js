// scripts/resolve-locations.js
// Script de resolución automática de coordenadas para Dávalos Propiedades.
// 1. Carga propiedades desde Firestore REST API o public/data/properties.json
// 2. Sigue redirecciones de enlaces acortados de Google Maps (maps.app.goo.gl / goo.gl/maps)
// 3. Extrae lat y lng con regex
// 4. Si no tiene enlace, asigna coordenadas precisas por barrio/zona de Salta
// 5. Guarda los resultados en public/data/properties.json y public/data/resolved-locations.json

const fs = require('fs');
const path = require('path');

const FIRESTORE_URL = 'https://firestore.googleapis.com/v1/projects/davalos-propiedades/databases/(default)/documents/properties?pageSize=100';
const JSON_PATH = path.join(__dirname, '..', 'public', 'data', 'properties.json');
const RESOLVED_MAP_PATH = path.join(__dirname, '..', 'public', 'data', 'resolved-locations.json');

const SALTA_DEFAULT = [-24.7821, -65.4232];

// Coordenadas de referencia por zona / barrio de Salta
const SALTA_ZONE_COORDS = [
    { keys: ["san lorenzo chico", "la reserva"], coords: [-24.7650, -65.4950] },
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
    { keys: ["vaqueros", "las vertientes"], coords: [-24.7180, -65.4050] },
    { keys: ["la calderilla", "calderilla", "la caldera", "caldera"], coords: [-24.6010, -65.3810] },
    { keys: ["san luis", "villa san luis"], coords: [-24.8380, -65.4880] },
    { keys: ["intersindical"], coords: [-24.8350, -65.4420] },
    { keys: ["santa ana"], coords: [-24.8410, -65.4510] },
    { keys: ["limache", "barrio limache"], coords: [-24.8250, -65.4290] },
    { keys: ["cerrillos", "la pedrera"], coords: [-24.9010, -65.4850] },
    { keys: ["la merced", "merced chica"], coords: [-24.9620, -65.4890] },
    { keys: ["el carril"], coords: [-25.0740, -65.5340] },
    { keys: ["chicoana"], coords: [-25.1050, -65.5350] },
    { keys: ["campo quijano", "quijano", "la silleta"], coords: [-24.9080, -65.6420] },
    { keys: ["rosario de lerma"], coords: [-24.9850, -65.5780] },
    { keys: ["cafayate"], coords: [-26.0645, -65.9476] },
    { keys: ["tartagal"], coords: [-22.5211, -63.8071] },
    { keys: ["gral guemes", "general guemes", "güemes"], coords: [-24.6667, -65.0500] },
    { keys: ["alto la loma"], coords: [-24.7710, -65.4380] },
    { keys: ["paraguay", "av paraguay"], coords: [-24.8010, -65.4250] },
    { keys: ["leguizamon", "leguizamón"], coords: [-24.7820, -65.4150] },
    { keys: ["mendoza"], coords: [-24.7930, -65.4140] },
    { keys: ["pueyrredon", "pueyrredón"], coords: [-24.7732, -65.4052] },
    { keys: ["12 de octubre"], coords: [-24.7753, -65.4124] },
    { keys: ["via aurelia", "vía aurelia"], coords: [-24.8050, -65.4600] },
    { keys: ["portezuelo"], coords: [-24.7920, -65.3950] },
    { keys: ["monumento"], coords: [-24.7890, -65.3980] },
    { keys: ["macrocentro", "macro centro"], coords: [-24.7850, -65.4170] },
    { keys: ["centro"], coords: [-24.7885, -65.4110] },
    { keys: ["zona norte", "norte"], coords: [-24.7550, -65.4120] },
    { keys: ["zona sur", "sur"], coords: [-24.8320, -65.4350] },
    { keys: ["zona oeste", "oeste"], coords: [-24.7780, -65.4580] },
    { keys: ["zona este", "este"], coords: [-24.7860, -65.3850] }
];

function extractCoordsFromText(text) {
    if (!text || typeof text !== 'string') return null;
    const str = text.trim();

    // 1. @lat,lng
    const mAt = str.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (mAt) return { lat: parseFloat(mAt[1]), lng: parseFloat(mAt[2]) };

    // 2. !3dlat!4dlng
    const m3d = str.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (m3d) return { lat: parseFloat(m3d[1]), lng: parseFloat(m3d[2]) };

    // 3. q=lat,lng o query=lat,lng
    const mQ = str.match(/[?&](?:q|query|ll|center)=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/i);
    if (mQ) return { lat: parseFloat(mQ[1]), lng: parseFloat(mQ[2]) };

    // 4. /search/lat,+lng
    const mSearch = str.match(/\/search\/(-?\d+\.\d+),?\+*(-?\d+\.\d+)/);
    if (mSearch) return { lat: parseFloat(mSearch[1]), lng: parseFloat(mSearch[2]) };

    // 5. Coordenadas decimales directas
    const mRaw = str.match(/(-?\d{1,2}\.\d+)[,\s+]+(-?\d{1,3}\.\d+)/);
    if (mRaw) {
        const lat = parseFloat(mRaw[1]);
        const lng = parseFloat(mRaw[2]);
        if (lat < -20 && lat > -30 && lng < -60 && lng > -70) {
            return { lat, lng };
        }
    }

    return null;
}

async function followRedirectAndExtractCoords(shortUrl) {
    try {
        const res = await fetch(shortUrl, {
            redirect: 'follow',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const finalUrl = res.url || '';
        let coords = extractCoordsFromText(finalUrl);
        if (coords) return coords;

        const body = await res.text();
        coords = extractCoordsFromText(body);
        return coords;
    } catch (err) {
        console.warn(`[followRedirect] Error al resolver ${shortUrl}:`, err.message);
        return null;
    }
}

function parseFirestoreValue(val) {
    if (!val || typeof val !== 'object') return val;
    if ('stringValue' in val) return val.stringValue;
    if ('integerValue' in val) return Number(val.integerValue);
    if ('doubleValue' in val) return Number(val.doubleValue);
    if ('booleanValue' in val) return val.booleanValue;
    if ('arrayValue' in val) {
        return (val.arrayValue.values || []).map(parseFirestoreValue);
    }
    if ('mapValue' in val) {
        const out = {};
        for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
            out[k] = parseFirestoreValue(v);
        }
        return out;
    }
    return null;
}

function parseFirestoreDoc(doc) {
    const out = { firebaseId: path.basename(doc.name) };
    for (const [k, v] of Object.entries(doc.fields || {})) {
        out[k] = parseFirestoreValue(v);
    }
    return out;
}

function resolveCoordsByZone(prop) {
    const haystack = [
        prop.title,
        prop.location,
        prop.ubicacion,
        prop.address,
        prop.direccion,
        prop.description
    ].filter(Boolean).join(" ").toLowerCase();

    for (const entry of SALTA_ZONE_COORDS) {
        if (entry.keys.some(k => haystack.includes(k))) {
            const numId = Number(String(prop.id).replace(/\D/g, "")) || 1;
            const offsetLat = ((numId % 7) - 3) * 0.002;
            const offsetLng = (((numId * 3) % 7) - 3) * 0.002;
            return {
                lat: Number((entry.coords[0] + offsetLat).toFixed(6)),
                lng: Number((entry.coords[1] + offsetLng).toFixed(6)),
                source: "zone_match"
            };
        }
    }

    const numId = Number(String(prop.id).replace(/\D/g, "")) || 1;
    const offsetLat = ((numId % 9) - 4) * 0.0025;
    const offsetLng = (((numId * 4) % 9) - 4) * 0.0025;
    return {
        lat: Number((SALTA_DEFAULT[0] + offsetLat).toFixed(6)),
        lng: Number((SALTA_DEFAULT[1] + offsetLng).toFixed(6)),
        source: "salta_fallback"
    };
}

async function main() {
    console.log("=================================================");
    console.log("🔍 Dávalos Propiedades - Resolución de Coordenadas");
    console.log("=================================================");

    let rawProperties = [];

    // 1. Cargar desde Firestore REST API
    try {
        console.log("📡 Conectando a Firestore REST API...");
        const res = await fetch(FIRESTORE_URL);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.documents)) {
                rawProperties = data.documents.map(parseFirestoreDoc);
                console.log(`✅ ${rawProperties.length} propiedades obtenidas desde Firestore.`);
            }
        } else {
            console.warn(`⚠️ Firestore respondió con status ${res.status}`);
        }
    } catch (e) {
        console.warn("⚠️ No se pudo conectar a Firestore:", e.message);
    }

    // Si Firestore no devolvió datos, cargar JSON local
    if (rawProperties.length === 0 && fs.existsSync(JSON_PATH)) {
        console.log("📂 Cargando propiedades desde properties.json local...");
        try {
            const local = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
            rawProperties = local.properties || local;
            console.log(`✅ ${rawProperties.length} propiedades leídas del JSON local.`);
        } catch (e) {
            console.error("❌ Error leyendo JSON local:", e.message);
        }
    }

    if (rawProperties.length === 0) {
        console.error("❌ No se encontraron propiedades para procesar.");
        process.exit(1);
    }

    const resolvedMap = {};
    let countFromDirect = 0;
    let countFromGoogleMaps = 0;
    let countFromZone = 0;

    for (let i = 0; i < rawProperties.length; i++) {
        const prop = rawProperties[i];
        const title = prop.title || `Propiedad #${prop.id}`;
        let lat = prop.lat !== undefined ? Number(prop.lat) : undefined;
        let lng = prop.lng !== undefined ? Number(prop.lng) : undefined;

        // 1. ¿Ya tiene coordenadas válidas?
        if (lat && lng && !isNaN(lat) && !isNaN(lng) && lat !== 0) {
            countFromDirect++;
            prop.lat = lat;
            prop.lng = lng;
            resolvedMap[prop.id] = { lat, lng, title, source: "direct" };
            continue;
        }

        // 2. Revisar si tiene enlace de Google Maps
        const mapUrl = prop.mapLink || prop.googleMapsUrl || prop.ubicacion;
        let resolvedCoords = null;

        if (mapUrl && typeof mapUrl === 'string') {
            // Si el link contiene coordenadas directas
            resolvedCoords = extractCoordsFromText(mapUrl);

            // Si es un enlace acortado, seguir redirección
            if (!resolvedCoords && (mapUrl.includes('goo.gl') || mapUrl.includes('maps.app') || mapUrl.includes('google.com/maps'))) {
                console.log(`[${i + 1}/${rawProperties.length}] Siguiendo link acortado: ${mapUrl}`);
                resolvedCoords = await followRedirectAndExtractCoords(mapUrl);
            }
        }

        if (resolvedCoords) {
            countFromGoogleMaps++;
            prop.lat = Number(resolvedCoords.lat.toFixed(6));
            prop.lng = Number(resolvedCoords.lng.toFixed(6));
            resolvedMap[prop.id] = { lat: prop.lat, lng: prop.lng, title, source: "google_maps" };
            console.log(`  📍 Coordenadas resueltas: [${prop.lat}, ${prop.lng}] - ${title}`);
        } else {
            // 3. Fallback inteligente por zona / barrio
            countFromZone++;
            const zoneCoords = resolveCoordsByZone(prop);
            prop.lat = zoneCoords.lat;
            prop.lng = zoneCoords.lng;
            resolvedMap[prop.id] = { lat: prop.lat, lng: prop.lng, title, source: zoneCoords.source };
            console.log(`  🗺️ Zona aproximada: [${prop.lat}, ${prop.lng}] (${zoneCoords.source}) - ${title}`);
        }
    }

    console.log("\n-------------------------------------------------");
    console.log(`📊 Resumen de resolución:`);
    console.log(`   - Coordenadas previas directas: ${countFromDirect}`);
    console.log(`   - Extraídas de Google Maps:     ${countFromGoogleMaps}`);
    console.log(`   - Aproximadas por Zona/Barrio:   ${countFromZone}`);
    console.log(`   - Total procesadas:              ${rawProperties.length}`);
    console.log("-------------------------------------------------");

    // Guardar en public/data/properties.json
    const outputJson = {
        updatedAt: new Date().toISOString(),
        properties: rawProperties
    };
    fs.writeFileSync(JSON_PATH, JSON.stringify(outputJson, null, 2), 'utf8');
    console.log(`💾 Guardado catálogo completo en: ${JSON_PATH}`);

    // Guardar mapa de resolución rápida en public/data/resolved-locations.json
    fs.writeFileSync(RESOLVED_MAP_PATH, JSON.stringify(resolvedMap, null, 2), 'utf8');
    console.log(`💾 Guardado mapa de coordenadas en: ${RESOLVED_MAP_PATH}`);

    console.log("\n🎉 ¡Proceso finalizado con éxito! Todas las propiedades tienen lat y lng asignados.");
}

main().catch(err => {
    console.error("❌ Error en script de resolución:", err);
    process.exit(1);
});
