# UniPensión Sincelejo

Aplicación web para centralizar, verificar y hacer transparente la oferta de pensiones universitarias de Sincelejo, Sucre — conectando propietarios con estudiantes.

**Proyecto final — Ingeniería de Software (CECAR)**
Equipo: Edwin Díaz · José Paternina · Jesús Villalba
Docente: Laudyth Lambraño

**Aplicación publicada:** https://unipension-sincelejo.vercel.app (cuentas de demostración en la tabla de abajo)

## Tecnologías (todas gratuitas)

| Capa | Tecnología |
|---|---|
| Framework frontend | **React 18 + Vite** (SPA con React Router) |
| Diseño | CSS propio responsivo, tipografías Google Fonts (Cormorant Garamond + Jost) |
| Mapas | Leaflet + OpenStreetMap |
| Lógica de negocio | Node.js + Express (API REST) |
| Persistencia | SQLite con libSQL: archivo local en desarrollo, [Turso](https://turso.tech) en producción |
| Seguridad | bcryptjs (hash de contraseñas), sesiones HTTP, control por rol |
| Comprobantes | PDFKit (PDF de pagos) |
| Despliegue | Vercel (frontend en CDN + API como función sin servidor) · Render como alternativa |

### Versión 0.3 — adaptada al prototipo inicial (Figma)

La interfaz reproduce las pantallas y flujos del prototipo inicial, conservando la tipografía de UniPensión:

- **Acceso:** pantalla de carga, Bienvenida, Iniciar sesión (con cuentas de demostración), Crear cuenta en 2 pasos
  (rol → datos, contraseña segura, WhatsApp +57, consentimiento versionado) y Recuperación.
- **Estudiante:** Inicio con buscador, catálogo con filtros combinados (universidad, barrio, precio, tipo, servicios, orden),
  filtros activos removibles, ubicación del dispositivo, vista Lista/Mapa con pines agrupados, paginación de 12,
  ficha con galería, contacto por WhatsApp, reporte de información, reserva, pago simulado, comprobante PDF y reseñas.
- **Propietario:** Inicio con estadísticas, Mis pensiones (estados de moderación y disponibilidad), editor de 3 pasos
  con mapa, fotos comprimidas y borrador automático, actualización de cupos y bandeja de solicitudes.
- **Administrador:** Resumen, moderación (aprobar, rechazar, ocultar, restaurar, resolver reportes, Plan Destacado),
  reportes de estudiantes (3 reportes ocultan la pensión), auditoría (trazabilidad, CSV, ocupación, reseñas, bitácora).
- **Perfil (todos):** ver y editar perfil con foto, configuración, cambio de contraseña y registro de consentimiento.

## Ejecución local

```bash
npm install
npm run build     # compila la aplicación React (client/dist)
npm start         # Express sirve la SPA + API en http://localhost:3000
```

Para desarrollo con recarga en vivo: `npm run dev` (backend) y `npm run dev:client` (React en el puerto 5173, con proxy /api al backend).

La base de datos se crea sola con datos semilla la primera vez.

**Usuarios de demostración** (también disponibles como acceso rápido en la pantalla Iniciar sesión)

| Rol | Correo | Clave |
|---|---|---|
| Estudiante | estudiante@unipension.co | est123 |
| Estudiante | estudiante2@unipension.co | est123 |
| Estudiante | estudiante3@unipension.co | est123 |
| Propietario | propietaria@unipension.co | prop123 |
| Administrador | admin@unipension.co | admin123 |

**Pruebas automáticas del API:** `npm test` (8 pruebas con el runner nativo de Node; usan una base temporal).

**Variables de entorno opcionales:** `PORT`, `SESSION_SECRET`, `DB_PATH` (ruta de la base SQLite local),
`TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` (base en la nube; si no están, se usa el archivo local) y
`MODO_DEMO=false` (desactiva las cuentas de demostración y la exigencia de documentos ficticios `DEMO-`).

## Publicación en la web (Vercel + Turso, gratis)

La aplicación se publica en **Vercel**: el frontend se sirve desde la CDN y la API de Express corre como función sin servidor (`api/index.js`, configurada en `vercel.json`).
Como las funciones no conservan archivos ni memoria, la base de datos está en **Turso** (SQLite en la nube) y las sesiones se guardan en la tabla `sesiones`.

1. **Base de datos** — crear la cuenta en [turso.tech](https://turso.tech) (plan gratuito) y, con la CLI de Turso:
   ```bash
   turso db create unipension-sincelejo
   turso db show unipension-sincelejo --url      # → TURSO_DATABASE_URL
   turso db tokens create unipension-sincelejo   # → TURSO_AUTH_TOKEN
   ```
2. **Crear tablas y datos semilla** (una sola vez, desde el equipo):
   ```bash
   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npm run db:iniciar
   ```
3. **Vercel** — importar el repositorio en [vercel.com](https://vercel.com/new) o usar `npx vercel`. Definir las variables de entorno
   `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` y `SESSION_SECRET` (texto aleatorio largo) en *Settings → Environment Variables*.
4. Cada `git push` a `main` vuelve a publicar automáticamente.

Las credenciales solo viven en Vercel y en el equipo de quien despliega: **nunca** se suben a GitHub (`.env*` está en `.gitignore`).

*Alternativa:* `render.yaml` sigue sirviendo para Render.com; con las mismas variables de Turso los datos también persisten allí.

## Estructura

```
unipension/
├── api/index.js             # Entrada de Vercel (exporta la app de Express)
├── client/                  # Aplicación React (Vite); fotos en client/public/img/pensiones/
│   ├── src/paginas/         # Acceso, InicioEstudiante, Catalogo, Detalle, MisReservas, Perfil
│   │   ├── propietario/     # InicioPropietario, MisPensiones, EditorPension, Solicitudes
│   │   └── admin/           # Resumen, Publicaciones, Reportes, Auditoria
│   ├── src/componentes/     # ui (Marca, Campo, Aviso, Dialogo…), Icono, Cabecera, Pie, TarjetaPension, MapaPensiones
│   ├── src/imagenes.js      # compresión de fotos en el navegador
│   └── src/estilos.css      # Sistema visual (paleta del prototipo + tipografía UniPensión)
├── backend/
│   ├── server.js            # Servidor Express (punto de entrada)
│   ├── db.js                # Esquema SQLite + datos semilla
│   ├── middleware/auth.js   # Control de acceso por rol (RNF-06)
│   ├── routes/
│   │   ├── auth.js          # RF-01: registro, login, sesión, perfil, contraseña, consentimiento
│   │   ├── pensiones.js     # HU-01..HU-05: catálogo, ficha, publicar, editar, cupos, WhatsApp, reportes, borrador
│   │   ├── reservas.js      # HU-06..HU-09, HU-11: reservas, pagos, bandeja
│   │   ├── resenas.js       # HU-10: calificaciones y moderación
│   │   └── admin.js         # HU-03/HU-12: moderación, reportes, indicadores, trazabilidad, CSV
│   ├── utils/               # pdf.js (HU-08), pensiones.js (cupos/validación), validacion.js, sesiones.js
│   └── scripts/             # mantenimiento: respaldo diario (actividad DB3, vacía por ahora)
├── pruebas/api.test.js      # pruebas automáticas del API (npm test)
└── docs/                    # GUIA_DESARROLLO.md, guía técnica y manual de usuario
```

## Flujo de ramas (GitHub Flow)

`main` (protegida) ← Pull Request ← `feature/HU-XX-descripcion`

Ver la guía completa en `docs/GUIA_DESARROLLO.md` y la sección 14 de `docs/Guia_Tecnica_UniPension.docx` (ramas por actividad, commits, Pull Requests y versiones). Cada Pull Request ejecuta `npm test` y la compilación con GitHub Actions (`.github/workflows/pruebas.yml`) y carga la plantilla `.github/pull_request_template.md`.

## Nota del prototipo

- La pasarela de pagos está **simulada** (se elige aprobado/rechazado). En producción se integra Wompi, Mercado Pago o PayU en `backend/routes/reservas.js`.
- Los correos se registran como **notificaciones en plataforma**. En producción se integra Nodemailer.
- Las fotografías se comprimen en el navegador y se guardan como data URL en SQLite (máx. 5 por pensión). Para producción se recomienda un almacenamiento de archivos (Cloudinary, S3 o `multer` + disco).
- La recuperación de contraseña responde sin enviar correo hasta configurar el servicio de correo.
- El contacto por WhatsApp solo abre `wa.me` si el propietario autorizó su número en el perfil; si no, muestra una vista previa.
