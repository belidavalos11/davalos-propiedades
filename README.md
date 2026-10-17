# DAVALOS Propiedades

Sitio estatico con catalogo publico y panel admin visual.

## Estructura
- `public/index.html`: home publica
- `public/details.html`: detalle de propiedad
- `public/data/properties.json`: fuente de datos del catalogo
- `public/admin/index.html`: panel admin (Decap CMS)
- `public/admin/config.yml`: configuracion del panel
- `vercel.json`: rewrites para rutas limpias en Vercel

## Correr local
```powershell
python -m http.server 5500
```
- Publico: `http://localhost:5500/public/index.html`
- Admin: `http://localhost:5500/public/admin/`

## Deploy en Vercel
Con `vercel.json`, rutas esperadas en produccion:
- `/` -> home
- `/details.html?id=...` -> detalle
- `/admin` -> panel admin

## Configurar acceso admin (GitHub OAuth)
Para que solo una persona cargue propiedades sin tocar codigo:
1. Crear app OAuth en GitHub.
2. Configurar callback URL segun proveedor OAuth que uses.
3. Completar `public/admin/config.yml`:
   - `repo`
   - `base_url`
   - `site_url`
   - `auth_endpoint`
4. Dar acceso al repo solo al usuario admin.

Nota: Decap CMS con backend `github` requiere endpoint OAuth. Puede resolverse en el mismo proyecto con funciones serverless en Vercel o con un proveedor OAuth compatible.

## Datos de propiedades
El archivo `public/data/properties.json` usa este formato:
```json
{
  "properties": [
    {
      "id": 1,
      "title": "...",
      "description": "...",
      "price": 1000,
      "category": "venta",
      "rooms": 3,
      "area": 100,
      "owner": "...",
      "agent": "...",
      "createdAt": "2026-01-01T10:00:00.000Z",
      "images": ["https://..."],
      "customFeatures": ["..."]
    }
  ]
}
```
## Actualizar la Web

Gracias a la integración con Vercel, cada vez que subes cambios a GitHub, la página se actualiza sola en unos segundos.

### Pasos para subir cambios:
1. Realiza los cambios en el código.
2. Abre la terminal en la carpeta del proyecto.
3. Ejecuta estos comandos:
   ```powershell
   git add .
   git commit -m "Descripción de lo que cambiaste"
   git push origin main
   ```
4. ¡Listo! Vercel detectará el "Push" y pondrá los cambios en vivo automáticamente.
## Variables de Entorno en Vercel
Para habilitar las funciones serverless (`api/improve-description` y `api/notify-pending-request`), configura las siguientes variables en **Vercel > Project Settings > Environment Variables**:

| Variable | Requerida | Descripción |
|---|---|---|
| `RESEND_API_KEY` | Para emails | API Key de [Resend](https://resend.com) para enviar notificaciones automáticas cuando un nuevo usuario solicita acceso. |
| `RESEND_FROM_EMAIL` | No | Correo remitente (ej. `Dávalos Propiedades <notificaciones@tudominio.com.ar>`). Por defecto usa `onboarding@resend.dev`. |
| `SITE_URL` | No | Dominio de producción (ej. `https://davalospropiedades.com.ar`). Se usa para el botón "Ingresar a Gestionar" en el email. |
| `NOTIFY_EMAILS` | No | Correos adicionales separados por coma que recibirán alertas de solicitudes pendientes. |
| `GEMINI_API_KEY` | Para IA | API Key gratuita de [Google AI Studio](https://aistudio.google.com/apikey) para el botón "✨ Mejorar con IA". |
| `FIREBASE_SERVICE_ACCOUNT` | Opcional | JSON de cuenta de servicio de Firebase para consultas directas en el backend. |

Consulta el archivo `.env.example` para más detalles.

