// Vercel Serverless Function: mejora la descripcion de una propiedad con Gemini.
// Variables de entorno (Vercel > Settings > Environment Variables):
//   GEMINI_API_KEY  (obligatoria)  -> https://aistudio.google.com/apikey
//   GEMINI_MODEL    (opcional)     -> por defecto "gemini-2.5-flash"
//   ADMIN_EMAILS    (opcional)     -> correos separados por coma; por defecto el admin principal
//   FIREBASE_API_KEY(opcional)     -> apiKey web de Firebase (ya publica en firebase-config.js)

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "belidavalos.bd@gmail.com")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || "AIzaSyDPGbevUGWbV37d88OcNjZpIhA2nOJggaA";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// Valida el ID token de Firebase y exige que sea un admin autorizado (evita uso abusivo de la API key).
async function verifyAdmin(idToken) {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken })
    });
    if (!res.ok) return false;
    const data = await res.json();
    const user = data.users && data.users[0];
    if (!user || !user.emailVerified) return false;
    return ADMIN_EMAILS.includes(String(user.email || "").toLowerCase());
}

const clip = (v, n) => String(v == null ? "" : v).trim().slice(0, n);

function buildPrompt(d) {
    const operacion = d.operation === "alquiler" ? "alquiler" : "venta";
    const datos = [
        `Título de la publicación: ${clip(d.title, 160) || "(sin título)"}`,
        `Operación: ${operacion}`,
        `Tipo de propiedad: ${clip(d.propertyType, 60) || "(no indicado)"}`,
        `Ciudad: ${clip(d.city, 60) || "Salta"}`,
        d.areaTotal ? `Superficie total: ${clip(d.areaTotal, 20)} m²` : "",
        d.areaBuilt ? `Superficie cubierta: ${clip(d.areaBuilt, 20)} m²` : "",
        Array.isArray(d.features) && d.features.length
            ? `Ambientes y características: ${d.features.slice(0, 40).map(f => clip(f, 60)).join(", ")}`
            : "",
        d.draft ? `Borrador del asesor (conservar la información que contenga):\n${clip(d.draft, 3000)}` : ""
    ].filter(Boolean).join("\n");

    return `Sos redactor/a inmobiliario/a de DÁVALOS PROPIEDADES, una inmobiliaria de Salta, Argentina, con más de 20 años de trayectoria.
Redactá la descripción de una propiedad en ${operacion}, lista para publicar en la web.

Reglas:
- Español rioplatense neutro, tono cálido, profesional y confiable. Sin exageraciones ni frases vacías.
- NO inventes datos: usá solo lo que figura abajo. Si el barrio o la zona aparecen en el título o el borrador, mencionalos; si no, no los inventes.
- No incluyas precio, teléfonos ni datos de contacto.
- Estructura: (1) apertura breve que atraiga, (2) párrafo con ambientes, superficies y características, (3) cierre invitando a coordinar una visita.
- Entre 110 y 180 palabras. Párrafos cortos separados por una línea en blanco. Sin títulos, sin listas con viñetas y como máximo un emoji.
- Devolvé únicamente el texto final de la descripción.

Datos de la propiedad:
${datos}`;
}

module.exports = async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: "Método no permitido" });
    }

    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "GEMINI_API_KEY no está configurada" });
    }

    const authHeader = String(req.headers.authorization || "");
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!idToken || !(await verifyAdmin(idToken).catch(() => false))) {
        return res.status(401).json({ error: "No autorizado" });
    }

    let body = req.body;
    if (typeof body === "string") {
        try { body = JSON.parse(body); } catch (e) { body = null; }
    }
    if (!body || (!body.title && !body.draft)) {
        return res.status(400).json({ error: "Faltan datos: se requiere título o borrador" });
    }

    try {
        const gemRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: buildPrompt(body) }] }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1200,
                        thinkingConfig: { thinkingBudget: 0 }
                    }
                })
            }
        );
        if (!gemRes.ok) {
            const detail = await gemRes.text();
            console.error("Gemini error:", gemRes.status, detail.slice(0, 500));
            return res.status(502).json({ error: "Error al consultar la IA" });
        }
        const data = await gemRes.json();
        const text = ((data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [])
            .map(p => p.text || "")
            .join("")
            .trim();
        if (!text) return res.status(502).json({ error: "La IA devolvió una respuesta vacía" });
        return res.status(200).json({ text });
    } catch (e) {
        console.error("improve-description error:", e);
        return res.status(500).json({ error: "Error interno" });
    }
};