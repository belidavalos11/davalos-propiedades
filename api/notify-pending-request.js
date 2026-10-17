// Vercel Serverless Function: Notifica por email a los SUPER_ADMIN activos
// cuando un nuevo usuario solicita acceso (status == 'pending').
//
// Variables de entorno en Vercel:
//   RESEND_API_KEY           (Recomendada) -> Clave de https://resend.com
//   RESEND_FROM_EMAIL        (Opcional)    -> Remitente, ej: "Dávalos Propiedades <notificaciones@tudominio.com>"
//   SITE_URL                 (Opcional)    -> URL del sitio (ej: https://davalospropiedades.com.ar)
//   FIREBASE_SERVICE_ACCOUNT (Opcional)    -> JSON de Service Account para consultar Firestore desde el servidor
//   NOTIFY_EMAILS            (Opcional)    -> Lista de emails de respaldo separados por coma

const crypto = require("crypto");

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "davalos-propiedades";

// Carga Service Account si fue provisto en Vercel (JSON string o base64)
function loadServiceAccount() {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_SERVICE_ACCOUNT;
    if (!raw) return null;
    try {
        const trimmed = raw.trim();
        if (trimmed.startsWith("{")) return JSON.parse(trimmed);
        const decoded = Buffer.from(trimmed, "base64").toString("utf8");
        return JSON.parse(decoded);
    } catch (e) {
        console.warn("[notify-pending] Error al parsear FIREBASE_SERVICE_ACCOUNT:", e.message);
        return null;
    }
}

// Genera un token OAuth2 para Google Cloud a partir del Service Account sin dependencias externas
async function getServiceAccountAccessToken(sa) {
    if (!sa || !sa.client_email || !sa.private_key) return null;
    try {
        const now = Math.floor(Date.now() / 1000);
        const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
        const claim = Buffer.from(JSON.stringify({
            iss: sa.client_email,
            scope: "https://www.googleapis.com/auth/datastore",
            aud: "https://oauth2.googleapis.com/token",
            exp: now + 3600,
            iat: now
        })).toString("base64url");

        const sign = crypto.createSign("RSA-SHA256");
        sign.update(`${header}.${claim}`);
        const signature = sign.sign(sa.private_key, "base64url");
        const jwt = `${header}.${claim}.${signature}`;

        const res = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
                assertion: jwt
            })
        });
        if (!res.ok) {
            const errTxt = await res.text().catch(() => "");
            console.warn(`[notify-pending] Intercambio de token Google falló (${res.status}):`, errTxt.slice(0, 200));
            return null;
        }
        const data = await res.json();
        return data.access_token || null;
    } catch (e) {
        console.warn("[notify-pending] Excepción al generar token de Service Account:", e.message);
        return null;
    }
}

// Consulta Firestore para obtener los correos de usuarios donde role == 'SUPER_ADMIN' y status == 'active'
async function fetchSuperAdminEmails(token) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;
    const query = {
        structuredQuery: {
            from: [{ collectionId: "users" }],
            where: {
                compositeFilter: {
                    op: "AND",
                    filters: [
                        { fieldFilter: { field: { fieldPath: "role" }, op: "EQUAL", value: { stringValue: "SUPER_ADMIN" } } },
                        { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "active" } } }
                    ]
                }
            }
        }
    };

    const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(query)
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.warn(`[notify-pending] Firestore runQuery (${res.status}):`, text.slice(0, 300));
        return [];
    }

    const rows = await res.json();
    const emails = [];
    if (Array.isArray(rows)) {
        for (const row of rows) {
            const doc = row.document;
            if (doc && doc.fields && doc.fields.email && doc.fields.email.stringValue) {
                const em = String(doc.fields.email.stringValue).trim().toLowerCase();
                if (em) emails.push(em);
            }
        }
    }
    return emails;
}

// Plantilla HTML profesional del correo
function buildNotificationHtml({ displayName, email, photoURL, createdAt, siteUrl }) {
    const safeName = displayName || email;
    const safeEmail = email;
    const safeDate = createdAt ? new Date(createdAt).toLocaleString("es-AR", { timeZone: "America/Argentina/Salta", dateStyle: "long", timeStyle: "short" }) : "Recién";
    const initial = (safeName.trim().charAt(0) || "?").toUpperCase();

    const avatarHtml = photoURL && /^https?:\/\//i.test(photoURL)
        ? `<img src="${photoURL}" alt="${safeName}" width="56" height="56" style="border-radius: 50%; object-fit: cover; border: 2px solid #050e36;" />`
        : `<div style="width: 56px; height: 56px; border-radius: 50%; background-color: #050e36; color: #ffffff; font-weight: bold; font-size: 24px; line-height: 56px; text-align: center; font-family: sans-serif;">${initial}</div>`;

    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Nueva Solicitud de Acceso</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f3ef; font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2d3436;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f3ef; padding: 40px 10px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" max-width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid rgba(0,0,0,0.06);">
                    <!-- Header -->
                    <tr>
                        <td style="background-color: #050e36; padding: 32px 30px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;">DÁVALOS PROPIEDADES</h1>
                            <p style="margin: 6px 0 0; color: #cbd5e1; font-size: 13px;">Panel de Administración y Gestión de Equipo</p>
                        </td>
                    </tr>
                    <!-- Main Body -->
                    <tr>
                        <td style="padding: 36px 30px;">
                            <div style="display: inline-block; background-color: #eaf1ff; color: #1e3a8a; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 5px 12px; border-radius: 20px; margin-bottom: 16px;">
                                ● Nueva Solicitud Pendiente
                            </div>
                            <h2 style="margin: 0 0 14px; font-size: 20px; color: #111827; font-weight: 700;">Un nuevo usuario solicitó acceso al panel</h2>
                            <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #636e72;">
                                Un usuario ha iniciado sesión por primera vez con Google y su cuenta ha quedado registrada como <strong>pendiente de aprobación</strong>.
                            </p>

                            <!-- User Card -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; padding: 20px; margin-bottom: 28px;">
                                <tr>
                                    <td width="70" valign="middle">
                                        ${avatarHtml}
                                    </td>
                                    <td valign="middle" style="padding-left: 12px;">
                                        <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">${safeName}</div>
                                        <div style="font-size: 13px; color: #64748b; margin-bottom: 4px;">${safeEmail}</div>
                                        <div style="font-size: 11px; color: #94a3b8;">Fecha: ${safeDate}</div>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 0 0 26px; font-size: 14px; line-height: 1.6; color: #636e72;">
                                Como <strong>Super Admin</strong>, podés ingresar al sitio web para aprobarlo como <em>Asesor</em> o <em>Admin</em>, o rechazar su solicitud.
                            </p>

                            <!-- Button -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                                <tr>
                                    <td align="center" style="border-radius: 10px; background-color: #050e36;">
                                        <a href="${siteUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 14px; color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 10px;">
                                            👥 Ingresar a Gestionar Equipo
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                                Notificación automática para Super Administradores de <strong>Dávalos Propiedades</strong>.<br>
                                Salta, Argentina.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}

module.exports = async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: "Método no permitido" });
    }

    let body = req.body;
    if (typeof body === "string") {
        try { body = JSON.parse(body); } catch (e) { body = null; }
    }

    const { email, displayName, photoURL, createdAt } = body || {};

    if (!email) {
        return res.status(400).json({ error: "Falta el campo email del solicitante" });
    }

    const authHeader = String(req.headers.authorization || "");
    const callerIdToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    // 1. Obtener lista de Super Admins activos desde Firestore
    let recipients = [];
    try {
        const sa = loadServiceAccount();
        const saToken = await getServiceAccountAccessToken(sa);
        recipients = await fetchSuperAdminEmails(saToken || callerIdToken);
    } catch (err) {
        console.warn("[notify-pending] Error al consultar Firestore para Super Admins:", err.message);
    }

    // 2. Agregar correos configurados como fallback en variables de entorno (si existen)
    const fallbackEnvEmails = (process.env.NOTIFY_EMAILS || process.env.SUPER_ADMIN_EMAILS || "")
        .split(",")
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);

    recipients = [...new Set([...recipients, ...fallbackEnvEmails])];

    // Excluir al solicitante de la lista de destinatarios por seguridad/lógica
    recipients = recipients.filter(em => em !== String(email).trim().toLowerCase());

    if (recipients.length === 0) {
        console.warn("[notify-pending] No se encontraron correos de Super Admin activos para notificar.");
        return res.status(200).json({
            ok: true,
            sent: false,
            reason: "no_super_admin_recipients",
            message: "No se encontraron destinatarios activos para la notificación."
        });
    }

    // 3. Enviar correo vía Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
        console.warn("[notify-pending] RESEND_API_KEY no está configurada en las variables de entorno. Omitiendo envío.");
        return res.status(200).json({
            ok: true,
            sent: false,
            reason: "missing_resend_api_key",
            message: "Solicitud registrada. Configure RESEND_API_KEY en Vercel para habilitar correos automáticos."
        });
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.MAIL_FROM || "Dávalos Propiedades <onboarding@resend.dev>";
    const siteUrl = process.env.SITE_URL || (req.headers["x-forwarded-host"] ? `https://${req.headers["x-forwarded-host"]}` : "https://davalospropiedades.com.ar");

    const html = buildNotificationHtml({
        displayName,
        email,
        photoURL,
        createdAt,
        siteUrl
    });

    try {
        const resendResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${resendApiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                from: fromEmail,
                to: recipients,
                subject: `Nueva solicitud de acceso: ${displayName || email}`,
                html: html
            })
        });

        if (!resendResponse.ok) {
            const errDetail = await resendResponse.text().catch(() => "");
            console.error(`[notify-pending] Error de Resend (${resendResponse.status}):`, errDetail);
            return res.status(200).json({
                ok: true,
                sent: false,
                reason: "resend_error",
                error: errDetail
            });
        }

        const resendData = await resendResponse.json().catch(() => ({}));
        console.log(`[notify-pending] Notificación enviada con éxito a ${recipients.length} Super Admin(s):`, recipients);

        return res.status(200).json({
            ok: true,
            sent: true,
            recipientsCount: recipients.length,
            id: resendData.id || null
        });
    } catch (sendError) {
        console.error("[notify-pending] Excepción al enviar correo:", sendError);
        return res.status(200).json({
            ok: true,
            sent: false,
            reason: "send_exception",
            error: sendError.message
        });
    }
};
