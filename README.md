# UniPensión Sincelejo

Aplicación web para centralizar, verificar y hacer transparente la oferta de pensiones universitarias de Sincelejo, Sucre — conectando propietarios con estudiantes.

**Proyecto final — Ingeniería de Software (CECAR)**
Equipo: Edwin Díaz · José Paternina · Jesús Villalba
Docente: Laudyth Lambraño

## Tecnologías (todas gratuitas)

| Capa | Tecnología |
|---|---|
| Framework frontend | **React 18 + Vite** (SPA con React Router) |
| Diseño | CSS propio responsivo, tipografías Google Fonts (Cormorant Garamond + Jost) |
| Mapas | Leaflet + OpenStreetMap |
| Lógica de negocio | Node.js + Express (API REST) |
| Persistencia | SQLite (better-sqlite3) → migrable a MySQL/PostgreSQL |
| Seguridad | bcryptjs (hash de contraseñas), sesiones HTTP, control por rol |
| Comprobantes | PDFKit (PDF de pagos) |
| Despliegue | Render.com plan gratuito (`render.yaml` incluido) |

## Ejecución local

```bash
npm install
npm run build     # compila la aplicación React (client/dist)
npm start         # Express sirve la SPA + API en http://localhost:3000
```

Para desarrollo con recarga en vivo: `npm run dev` (backend) y `npm run dev:client` (React en el puerto 5173, con proxy /api al backend).

La base de datos se crea sola con datos semilla la primera vez.

**Usuarios de demostración**

| Rol | Correo | Clave |
|---|---|---|
| Estudiante | estudiante@unipension.co | est123 |
| Propietario | propietaria@unipension.co | prop123 |
| Administrador | admin@unipension.co | admin123 |

## Publicación en la web (Render, gratis)

1. Subir el repositorio a GitHub.
2. En [render.com](https://render.com) → *New → Web Service* → conectar el repositorio.
3. Render detecta `render.yaml` y configura build (`npm install && npm run build`) y arranque (`npm start`) automáticamente.
4. En 2–3 minutos la app queda en `https://unipension-sincelejo.onrender.com`, con HTTPS y accesible desde cualquier dispositivo.

Nota del plan gratuito: el servicio se "duerme" tras 15 min sin tráfico (la primera visita tarda ~30 s en despertar) y el archivo SQLite se regenera con datos semilla en cada despliegue. Para datos persistentes: PostgreSQL gratuito de Render o [Turso](https://turso.tech) (SQLite en la nube).

## Estructura

```
unipension/
├── client/                  # Aplicación React (Vite)
│   ├── src/paginas/         # Inicio, Detalle, Acceso, Propietario, MisReservas, Admin
│   ├── src/componentes/     # Cabecera, Pie, Aviso
│   └── src/estilos.css      # Diseño responsivo estilo boutique
├── backend/
│   ├── server.js            # Servidor Express (punto de entrada)
│   ├── db.js                # Esquema SQLite + datos semilla
│   ├── middleware/auth.js   # Control de acceso por rol (RNF-06)
│   ├── routes/
│   │   ├── auth.js          # RF-01: registro, login, sesión
│   │   ├── pensiones.js     # HU-01..HU-05: publicar, editar, verificar, catálogo
│   │   ├── reservas.js      # HU-06..HU-09, HU-11: reservas, pagos, bandeja
│   │   ├── resenas.js       # HU-10: calificaciones y moderación
│   │   └── admin.js         # HU-12: indicadores, trazabilidad, CSV
│   └── utils/pdf.js         # HU-08: comprobante PDF
├── public/                  # Frontend estático responsivo
│   ├── index.html           # Catálogo con filtros (HU-04)
│   ├── pension.html         # Ficha detallada + reserva (HU-05, HU-06)
│   ├── login.html / registro.html
│   ├── propietario.html     # Publicar, editar, bandeja (HU-01, HU-02, HU-09)
│   ├── reservas.html        # Pago, historial, comprobantes (HU-07, HU-08, HU-11)
│   ├── admin.html           # Verificación e indicadores (HU-03, HU-12)
│   ├── css/estilos.css
│   └── js/
└── docs/GUIA_DESARROLLO.md  # Guía de desarrollo colaborativo (GitHub, sprints)
```

## Flujo de ramas (GitHub Flow)

`main` (protegida) ← Pull Request ← `feature/HU-XX-descripcion`

Ver la guía completa en `docs/GUIA_DESARROLLO.md`.

## Nota del prototipo

- La pasarela de pagos está **simulada** (se elige aprobado/rechazado). En producción se integra Wompi, Mercado Pago o PayU en `backend/routes/reservas.js`.
- Los correos se registran como **notificaciones en plataforma**. En producción se integra Nodemailer.
- Las fotografías usan marcadores de posición; la carga real se implementa con `multer`.
