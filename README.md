# DAVALOS Propiedades (estatico)

## Estructura
- `public/index.html`: listado principal
- `public/details.html`: detalle
- `public/assets/css/`: estilos
- `public/assets/js/`: logica cliente
- `public/assets/images/`: marca/imagenes locales
- `public/_headers`: cabeceras de seguridad para hosts estaticos compatibles

## Correr local
```powershell
python -m http.server 5500
```
Abrir `http://localhost:5500/public/index.html`.

## Login / Logout
- Login desde el boton `Iniciar sesion`
- Logout desde el boton `Cerrar sesion`
- Forzar logout manual (consola del navegador):
```js
AuthManager.logout()
```

## Datos
Las propiedades se guardan en `localStorage` bajo la clave `davalos_properties`.
