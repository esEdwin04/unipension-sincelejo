# Guía de desarrollo colaborativo — UniPensión Sincelejo

**Equipo:** Edwin Díaz · José Paternina · Jesús Villalba
**Asignatura:** Ingeniería de Software — CECAR · **Docente:** Laudyth Lambraño
**Metodología:** Scrum (4 sprints de 20 días hábiles) · **Versión del software:** 0.3.0

> Esta guía resume el trabajo diario con GitHub. El detalle técnico de cada actividad (fragmentos de código,
> contrato de la API, pruebas) está en [`Guia_Tecnica_UniPension.docx`](Guia_Tecnica_UniPension.docx).
> El uso de la aplicación por rol está en el [`MANUAL_USUARIO.md`](MANUAL_USUARIO.md).

---

## 1. Qué contiene el proyecto

Arquitectura cliente-servidor en 3 capas (RNF-10). Express sirve la API y la aplicación React compilada desde un solo servicio.

| Capa | Carpeta | Contenido |
|---|---|---|
| Presentación | `client/` | SPA en React 18 + Vite: páginas por rol, componentes y estilos (`client/src/estilos.css`) |
| Lógica de negocio | `backend/routes/`, `backend/utils/` | API REST: `auth`, `pensiones`, `reservas`, `resenas`, `admin` |
| Persistencia | `backend/db.js` | Esquema SQLite, migraciones idempotentes y datos semilla |
| Pruebas | `pruebas/api.test.js` | 8 pruebas del API con `node:test` |
| Mantenimiento | `backend/scripts/` | Vacía por ahora: aquí va el respaldo diario (actividad DB3) |

```bash
npm install
npm run build     # compila client/ en client/dist
npm start         # http://localhost:3000
npm test          # debe terminar con: pass 8 · fail 0
```

Desarrollo con recarga en vivo (dos terminales): `npm run dev` (API en el puerto 3000) y `npm run dev:client` (React en el puerto 5173 con proxy `/api`).

> La carpeta `public/` (frontend HTML anterior) se retiró en la v0.3. Si `client/dist` no existe, el servidor responde
> con un aviso para ejecutar `npm run build`.

---

## 2. Responsables y roles

| Integrante | Áreas | Rol Scrum |
|---|---|---|
| **Edwin Díaz** | Frontend · Documentación · Configuración del repositorio | Product Owner (valida criterios de aceptación) |
| **Jesús Villalba** | Backend · Integración frontend-backend · Coordinación de QA | Scrum Master |
| **José Paternina** | Base de datos · Despliegue | — |
| **Todos (rotativo)** | QA: cada quien prueba lo que no desarrolló | — |

---

## 3. Tecnologías

| Componente | Tecnología | Justificación |
|---|---|---|
| Frontend | React 18 + React Router 6 + Vite 6 | SPA con navegación por rol; CSS propio responsivo (RNF-01) |
| Mapas | Leaflet + OpenStreetMap | Gratuito, sin clave de API (HU-05), carga diferida |
| Backend | Node.js 20 + Express 5 | API REST, un solo lenguaje en todo el proyecto |
| Base de datos | SQLite (better-sqlite3) → PostgreSQL o Turso | SQLite no requiere instalación; el SQL es portable |
| Autenticación | express-session + bcryptjs | Contraseñas con hash (RNF-05), control por rol (RNF-06) |
| PDF | PDFKit | Comprobantes de pago (HU-08) |
| Pagos | Simulado → Wompi sandbox (B3) | Pasarela colombiana con sandbox gratuito |
| Correo | Notificaciones en BD → Nodemailer (B1) | RF-15 |
| Integración continua | GitHub Actions (`.github/workflows/pruebas.yml`) | `npm test` y `npm run build` en cada Pull Request |

---

## 4. Preparación del entorno (todos, una sola vez)

1. Instalar [Node.js 20 LTS](https://nodejs.org) y [Git](https://git-scm.com). Verificar con `node -v` y `git --version`.
2. Instalar Visual Studio Code con las extensiones *ESLint* y *GitLens*.
3. Aceptar la invitación al repositorio que envía Edwin Díaz.
4. Configurar y clonar:

```bash
git config --global user.name "Nombre Apellido"
git config --global user.email "correo@cecar.edu.co"   # el mismo de GitHub
git config --global pull.rebase false
git clone https://github.com/esEdwin04/unipension-sincelejo.git
cd unipension-sincelejo
npm install && npm run build && npm test
```

---

## 5. Configuración del repositorio (G1 · Edwin Díaz)

Repositorio: https://github.com/esEdwin04/unipension-sincelejo (privado, rama principal `main`).

1. **Colaboradores:** *Settings → Collaborators → Add people* → José Paternina y Jesús Villalba con permiso *Write*.
2. **Proteger `main`:** *Settings → Rules → Rulesets → New branch ruleset* (`proteger-main`, objetivo `main`):
   - ✅ Require a pull request before merging (1 aprobación) y Dismiss stale approvals
   - ✅ Require status checks to pass → seleccionar **pruebas** después de la primera ejecución
   - ✅ Block force pushes · ✅ Restrict deletions
3. **Fusión:** *Settings → General → Pull Requests*: Allow squash merging y Automatically delete head branches.
4. **Etiquetas:** `frontend`, `backend`, `base-de-datos`, `qa`, `documentación`, `despliegue` y una por historia (`HU-04`…).
5. **Tablero:** *Projects → Board* con columnas **Por iniciar · En proceso · En revisión · Hecho**; un Issue por actividad de la sección 7.

---

## 6. Flujo de trabajo (todos, en cada actividad)

**Regla de oro: una actividad = un Issue = una rama = un Pull Request. Nadie trabaja directo en `main`.**

```bash
# 1. Partir de main actualizado
git switch main
git pull origin main

# 2. Rama de la actividad (formato: tipo/CODIGO-descripcion, sin tildes)
git switch -c feature/F1-filtro-fecha-ingreso

# 3. Confirmar en pasos pequeños (Conventional Commits en español)
git add client/src/paginas/Catalogo.jsx
git commit -m "feat(HU-04): campos de fecha de ingreso y meses en el panel de filtros"
# tipos: feat | fix | docs | style | refactor | test | chore | ci

# 4. Traer lo que otros fusionaron y probar
git fetch origin
git merge origin/main
npm test && npm run build

# 5. Subir y abrir el Pull Request (la plantilla .github/pull_request_template.md se carga sola)
git push -u origin feature/F1-filtro-fecha-ingreso

# 6. El revisor de la sección 7 prueba la rama, aprueba y se fusiona con «Squash and merge»

# 7. Limpiar
git switch main && git pull origin main
git branch -d feature/F1-filtro-fecha-ingreso
```

Conflictos: se resuelven en la rama de trabajo (`git merge origin/main`, elegir en VS Code, `npm test`, commit y push), nunca en `main`.

**Reunión diaria (15 min):** qué hice, qué haré, qué me bloquea; actualizar horas del Sprint Backlog y mover tarjetas.

---

## 7. Actividades por integrante (v0.3)

Las 12 historias de usuario de los sprints 1 a 4 ya tienen implementación base (ver tabla 3 de la guía técnica).
Las actividades siguientes completan los escenarios pendientes y las integraciones externas.

### 7.1. Edwin Díaz — Frontend y documentación

| Código | Actividad | Archivos | Rama | Revisa | Estado |
|---|---|---|---|---|---|
| G0 | Subir la versión 0.3 al repositorio | todo el proyecto | `feature/G0-adaptacion-prototipo` | Jesús | Rama subida, abrir PR |
| G1 | Colaboradores, protección de `main`, etiquetas y tablero | configuración de GitHub | — | — | Por iniciar (manual en GitHub) |
| F1 | Filtro por fecha de ingreso y meses (HU-04 esc. 1) | `client/src/paginas/Catalogo.jsx` | `feature/F1-filtro-fecha-ingreso` | Jesús | Rama subida, abrir PR; necesita B6 |
| F2 | Reenvío y anulación de comprobantes (HU-08 esc. 3 y 5) | `client/src/paginas/admin/Auditoria.jsx` | `feature/F2-reenvio-anulacion-ui` | Jesús | Rama subida, abrir PR; necesita B4 |
| F3 | Fotos e ilustraciones reales (WebP ≤ 200 KB) | `client/public/img/pensiones/`, `docs/CREDITOS_IMAGENES.md` | `chore/DS1-despliegue-vercel` | José | Hecho (en `main`): 22 fotos de Unsplash para la demostración |
| F4 | Revisión responsiva y de accesibilidad | `client/src/estilos.css`, `App.jsx`, `Detalle.jsx` | `fix/F4-accesibilidad-responsive` | José | Rama subida, abrir PR; falta Lighthouse |
| D1 | Guía actualizada y manual de usuario | `docs/GUIA_DESARROLLO.md`, `docs/MANUAL_USUARIO.md` | `docs/D1-manual-usuario` | José | Rama subida, abrir PR |

**Qué se hizo y qué falta en cada una**

- **F1:** se agregaron «Fecha de ingreso» y «Meses de estadía» al panel de filtros. Se validan en el cliente: la fecha no puede ser anterior a hoy (se usa la fecha local, no UTC) y los meses van de 1 a 12. Viajan en la URL y en `GET /api/pensiones` y aparecen como un solo filtro activo removible.
  Mientras el servidor no filtre por periodo, el catálogo muestra un aviso. **Cuando se fusione B6**, cambiar `FECHA_EN_SERVIDOR` a `true` en `Catalogo.jsx`.
- **F2:** cada fila con consecutivo en *Auditoría → Trazabilidad* tiene **Reenviar comprobante** y **Anular**. Anular pide el motivo en un diálogo (mínimo 10 caracteres).
  Usa `POST /api/admin/reservas/:id/reenviar` y `POST /api/admin/reservas/:id/anular` `{ motivo }`. Hasta que B4 exista, la interfaz indica que la acción depende del servidor.
- **F4:** se mejoró el contraste del foco (de 1,45:1 a 12:1), del foco de los campos (de 2,48:1 a 12:1) y del texto secundario `--niebla` (de 4,29:1 a 5,27:1). Se agregó el enlace «Saltar al contenido». La foto principal de la ficha ahora es un botón y el visor ampliado es un `<dialog>` que se cierra con Esc.
  **Falta:** ejecutar Lighthouse en modo móvil (Chrome DevTools → Lighthouse → Accessibility) en cada ruta y revisar a 375, 768 y 1280 px. Registrar los puntajes en el PR (meta ≥ 90).
- **D1:** esta guía y el manual de usuario. Actualizarlos al cerrar cada sprint.

### 7.2. Jesús Villalba — Backend e integración

| Código | Actividad | Archivos | Rama | Revisa |
|---|---|---|---|---|
| B1 | Servicio de correo (RF-15) | `backend/utils/correo.js` (nuevo) | `feature/B1-correo-nodemailer` | José |
| B2 | Recuperación de contraseña con token | `backend/routes/auth.js` | `feature/B2-recuperar-clave` | José |
| B3 | Pasarela Wompi en modo sandbox (HU-07) | `backend/routes/reservas.js` | `feature/B3-wompi-sandbox` | Edwin |
| B4 | Reenvío y anulación de comprobantes (API) | `backend/routes/admin.js` | `feature/B4-reenvio-anulacion-api` | Edwin |
| B5 | Seguridad de producción (RNF-05) | `backend/server.js` | `feature/B5-seguridad-produccion` | José |
| B6 | Disponibilidad por fecha de ingreso | `backend/routes/pensiones.js` | `feature/B6-disponibilidad-fecha` | Edwin |
| I1 | Contrato de la API actualizado | guía técnica, sección 9 | — | — |

### 7.3. José Paternina — Base de datos y despliegue

| Código | Actividad | Archivos | Rama | Revisa |
|---|---|---|---|---|
| DB1 | Migraciones (tokens, anulación, fecha de salida) | `backend/db.js` | `feature/DB1-migraciones` | Jesús |
| DB2 | Base persistente en la nube — **hecho: Turso** | `backend/db.js` | `chore/DS1-despliegue-vercel` | Jesús |
| DB3 | Respaldo diario con retención de 30 días (RNF-09) | `backend/scripts/respaldo.js` (nuevo) | `feature/DB3-respaldo-diario` | Edwin |
| DB4 | Fotos en Cloudinary | `backend/routes/pensiones.js` | `feature/DB4-fotos-cloudinary` | Jesús |
| DB5 | Rendimiento del catálogo (RNF-03) | `backend/db.js` | `feature/DB5-rendimiento-catalogo` | Jesús |
| DS1 | Despliegue — **hecho: Vercel**, https://unipension-sincelejo.vercel.app | `vercel.json`, `api/index.js` | `chore/DS1-despliegue-vercel` | Edwin |

**Dependencias entre áreas:** B6 → F1 · B4 → F2 · DB1 → B2, B4 y B6 · DB4 → F3.

---

## 8. Plan de pruebas (QA de cada sprint)

Cada escenario de *Historias de Usuario.xlsx* es un caso de prueba. Las pruebas automáticas se ejecutan con `npm test` y en GitHub Actions. Ejemplos manuales con `curl` o *Thunder Client*:

```bash
# HU-04 esc. 1 — catálogo por periodo (con B6: solo pensiones libres en ese periodo)
curl "http://localhost:3000/api/pensiones?fecha_ingreso=2027-01-15&meses=6"

# HU-06 esc. 2 — fecha pasada (espera 400; requiere sesión de estudiante)
curl -X POST http://localhost:3000/api/reservas \
  -H "Content-Type: application/json" \
  -d '{"habitacion_id":1,"fecha_ingreso":"2025-01-01","meses":6}'

# RNF-06 — sin sesión de administrador no se puede moderar (espera 401/403)
curl -X POST http://localhost:3000/api/admin/pensiones/1/moderar \
  -H "Content-Type: application/json" -d '{"accion":"ocultar","motivo":"prueba"}'
```

**Definición de Hecho (DoD):** criterios de aceptación verificados por QA, PR revisado y aprobado, `npm test` y `npm run build` en verde, fusionado en `main` y horas registradas en el Sprint Backlog.

---

## 9. Evolución a producción

Los fragmentos de código de cada integración (Nodemailer, Wompi, respaldo, migraciones) están en la sección 5.4 de la guía técnica. Reglas comunes:

- Credenciales solo en variables de entorno (`SESSION_SECRET`, `SMTP_*`, `WOMPI_*`), configuradas en Render. **Nunca** subir `.env`: ya está en `.gitignore`.
- HTTPS (RNF-05): Render lo provee; activar `trust proxy` y `cookie.secure` cuando `NODE_ENV=production` (B5).
- Copias de seguridad (RNF-09): `backend/scripts/respaldo.js` con `db.backup()` una vez al día (DB3).
- Fotografías: hoy se guardan comprimidas en la base; para producción, Cloudinary y solo la URL en la tabla `fotos` (DB4).

---

## 10. Ceremonias y versiones

| Ceremonia | Cuándo | Duración | Facilita |
|---|---|---|---|
| Sprint Planning | Día 1 del sprint | 2 h | Jesús (SM) |
| Daily | Cada día hábil | 15 min | Jesús (SM) |
| Sprint Review | Día 20 | 1 h | Edwin (PO) valida criterios |
| Retrospectiva | Día 20 | 45 min | Jesús (SM) |

Después de fusionar G0, etiquetar la versión y retirar la rama antigua:

```bash
git switch main && git pull origin main
git tag -a v0.3.0 -m "v0.3.0: adaptación al prototipo inicial"
git push origin v0.3.0
git push origin --delete feature/HU-04-filtros-catalogo   # su commit ya entra a main con G0
```
