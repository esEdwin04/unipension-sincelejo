# Guía completa de desarrollo colaborativo — UniPensión Sincelejo

**Equipo:** Edwin Díaz · José Paternina · Jesús Villalba
**Asignatura:** Ingeniería de Software — CECAR · **Docente:** Laudyth Lambraño
**Metodología:** Scrum (4 sprints de 20 días hábiles)

---

## 1. Qué se entrega en este prototipo

El prototipo implementa las **12 historias de usuario** del Product Backlog con una arquitectura cliente-servidor en 3 capas (RNF-10):

| Capa | Carpeta | Contenido |
|---|---|---|
| Presentación | `public/` | 7 interfaces HTML responsivas + CSS + JS |
| Lógica de negocio | `backend/routes/` | API REST con 5 módulos |
| Persistencia | `backend/db.js` | Esquema SQLite (10 tablas) + datos semilla |

Para ejecutarlo: `npm install` y luego `npm start` → http://localhost:3000

---

## 2. Responsables y asignación de roles

Los documentos del proyecto definen 4 perfiles técnicos (Sprint Backlog) y los roles Scrum. Con un equipo de 3 personas, la asignación propuesta es:

| Integrante | Rol técnico principal | Rol Scrum adicional |
|---|---|---|
| **Edwin Díaz** | Desarrollador Frontend | Product Owner (valida criterios de aceptación) |
| **Jesús Villalba** | Desarrollador Backend | Scrum Master (facilita ceremonias, remueve impedimentos) |
| **José Paternina** | Administrador de Base de Datos | — |
| **Todos (rotativo por sprint)** | Ingeniero QA | Cada integrante prueba las historias que NO desarrolló |

> La asignación es ajustable: en Scrum las tareas se toman por voluntariado en la reunión diaria. Lo importante es que cada tarea del Sprint Backlog tenga un dueño registrado.

---

## 3. Tecnologías seleccionadas

| Componente | Tecnología | Justificación |
|---|---|---|
| Frontend | HTML5 + CSS3 + JavaScript | Sin framework: curva de aprendizaje mínima, responsivo con CSS Grid (RNF-01) |
| Mapas | Leaflet + OpenStreetMap | Gratuito, sin clave de API (HU-05) |
| Backend | Node.js 18+ con Express | API REST, un solo lenguaje en todo el proyecto |
| Base de datos | SQLite (prototipo) → MySQL (producción) | SQLite no requiere instalación; el SQL es portable |
| Autenticación | express-session + bcryptjs | Contraseñas con hash (RNF-05), control por rol (RNF-06) |
| PDF | PDFKit | Comprobantes de pago (HU-08 / RF-10) |
| Pagos | Simulado → Wompi (producción) | Wompi es la pasarela colombiana con sandbox gratuito |
| Correo | Notificaciones en BD → Nodemailer (producción) | RF-15 |
| Control de versiones | Git + GitHub | Desarrollo colaborativo con Pull Requests |

---

## 4. Paso a paso 0: preparación del entorno (todos los integrantes)

1. Instalar [Node.js LTS](https://nodejs.org) (incluye npm). Verificar: `node -v` y `npm -v`.
2. Instalar [Git](https://git-scm.com). Verificar: `git --version`.
3. Instalar Visual Studio Code con las extensiones *ESLint* y *GitLens*.
4. Crear cuenta en [github.com](https://github.com) con el correo institucional.
5. Configurar la identidad local:

```bash
git config --global user.name "Nombre Apellido"
git config --global user.email "correo@cecar.edu.co"
```

---

## 5. Paso a paso 1: montaje del repositorio en GitHub (hace: José, como responsable de la configuración)

**5.1. Crear el repositorio remoto**
En GitHub → *New repository* → nombre `unipension-sincelejo`, privado, sin README (el proyecto ya lo trae).

**5.2. Subir el prototipo**

```bash
cd unipension
git init
git add .
git commit -m "feat: prototipo inicial UniPensión Sincelejo (12 HU)"
git branch -M main
git remote add origin https://github.com/USUARIO/unipension-sincelejo.git
git push -u origin main
```

**5.3. Invitar al equipo**
*Settings → Collaborators → Add people* → agregar a los otros dos integrantes y al docente si lo solicita.

**5.4. Proteger la rama `main`**
*Settings → Branches → Add branch ruleset*: nombre `proteger-main`, target `main`, activar:
- ✅ *Require a pull request before merging* (mínimo 1 aprobación)
- ✅ *Block force pushes*

Así nadie sube código directo a `main`: todo pasa por revisión de un compañero.

**5.5. Tablero del proyecto**
*Projects → New project → Board* con columnas **Por iniciar · En proceso · En revisión (PR) · Hecho** — equivale al Sprint Backlog en Excel. Crear un *Issue* por cada tarea del sprint con etiqueta `HU-XX` y asignar al responsable.

---

## 6. Flujo de trabajo colaborativo (todos, en cada tarea)

**Regla de oro: una rama por historia/tarea, un Pull Request por rama, nunca trabajar directo en `main`.**

```bash
# 1. Antes de empezar el día, actualizar main local
git checkout main
git pull origin main

# 2. Crear la rama de la tarea (convención: tipo/HU-numero-descripcion)
git checkout -b feature/HU-04-filtros-catalogo

# 3. Trabajar y confirmar con mensajes claros (convención Conventional Commits)
git add public/js/catalogo.js
git commit -m "feat(HU-04): filtro por rango de precio en el catálogo"
# tipos: feat | fix | docs | style | refactor | test

# 4. Subir la rama y abrir el Pull Request
git push -u origin feature/HU-04-filtros-catalogo
# En GitHub aparece "Compare & pull request" → describir qué se hizo y qué criterio de aceptación cubre

# 5. Otro integrante revisa el PR (Files changed → Review → Approve)
#    El QA del sprint prueba la rama localmente:
git fetch origin
git checkout feature/HU-04-filtros-catalogo
npm start   # probar los criterios de aceptación de la HU

# 6. Con la aprobación, Merge pull request → Delete branch

# 7. Si hay conflicto al actualizar la rama:
git checkout feature/HU-04-filtros-catalogo
git merge main          # resolver conflictos en VS Code
git add . && git commit && git push
```

**Reunión diaria (15 min):** cada uno responde qué hizo, qué hará y qué lo bloquea; se actualizan las horas consumidas/restantes en el Sprint Backlog y se mueven las tarjetas del tablero.

---

## 7. Plan de actividades por sprint y por responsable

Cada tarea indica el archivo del prototipo donde ya existe la implementación base, para que el equipo la estudie, la pruebe y la extienda.

### Sprint 1 — Módulo de oferta (HU-01, HU-02, HU-03)

| Tarea (del Sprint Backlog) | Responsable | Archivos | Rama sugerida |
|---|---|---|---|
| Interfaz del formulario de publicación y cargue de fotos | **Edwin (Frontend)** | `public/propietario.html`, `public/js/propietario.js` | `feature/HU-01-form-publicacion` |
| Base de datos: pensiones, habitaciones, propietarios | **José (DB)** | `backend/db.js` (tablas `pensiones`, `habitaciones`, `fotos`) | `feature/HU-01-esquema-bd` |
| API REST de creación de pensiones | **Jesús (Backend)** | `backend/routes/pensiones.js` → `POST /api/pensiones` | `feature/HU-01-api-publicacion` |
| Pruebas de campos obligatorios y duplicados | **QA (rotativo)** | criterios HU-01 esc. 2 y 3 | `test/HU-01-validaciones` |
| Panel de moderación del administrador | **Edwin (Frontend)** | `public/admin.html`, `public/js/admin.js` | `feature/HU-03-panel-moderacion` |
| Lógica de cambio de estado + catálogo | **Jesús (Backend)** | `pensiones.js` → `PATCH /api/pensiones/:id/estado` | `feature/HU-03-cambio-estado` |
| Bitácora de verificaciones | **José (DB)** | `db.js` → tabla `bitacora_verificaciones` | `feature/HU-03-bitacora` |
| Interfaz de actualización (HU-02) | **Edwin (Frontend)** | `propietario.js` → función `editar()` | `feature/HU-02-edicion` |
| Endpoint PUT + bloqueo de campos críticos | **Jesús (Backend)** | `pensiones.js` → `PUT /api/pensiones/:id` | `feature/HU-02-endpoint-put` |

### Sprint 2 — Búsqueda y contratación (HU-04 a HU-07)

| Tarea | Responsable | Archivos |
|---|---|---|
| Catálogo con filtros dinámicos | **Edwin** | `index.html`, `js/catalogo.js` |
| Endpoint de búsqueda con filtros combinados | **Jesús** | `pensiones.js` → `GET /api/pensiones?barrio=&precio_min=…` |
| Índices para optimizar consultas (RNF-03) | **José** | `db.js` → sección `CREATE INDEX` |
| Vista de detalle con galería y mapa | **Edwin** | `pension.html`, `js/pension.js` (Leaflet) |
| Cálculo de distancia al campus | **Jesús** | `pensiones.js` → función `distanciaKm()` (Haversine) |
| Formulario de reserva con fechas | **Edwin** | `pension.js` → `form-reserva` |
| Bloqueo temporal del cupo y solapamiento | **Jesús** | `reservas.js` → `POST /api/reservas` + `liberarVencidas()` |
| Interfaz del proceso de pago | **Edwin** | `reservas.html` (panel de pago) |
| Integración de la pasarela | **Jesús** | `reservas.js` → `POST /api/reservas/:id/pagar` (ver §9.1) |
| Pruebas de transacciones y temporizador | **QA** | criterios HU-06/HU-07 |

### Sprint 3 — Soporte y confianza (HU-08 a HU-10)

| Tarea | Responsable | Archivos |
|---|---|---|
| Plantilla PDF del comprobante | **Edwin** | `backend/utils/pdf.js` (diseño visual) |
| Generación dinámica del PDF | **Jesús** | `reservas.js` → `GET /api/reservas/:id/comprobante` |
| Envío por correo | **Jesús** | ver §9.2 (Nodemailer) |
| Bandeja de solicitudes del propietario | **Edwin** | `propietario.html` (pestaña solicitudes) |
| Endpoints aceptar/rechazar/vencimiento 48 h | **Jesús** | `reservas.js` → `POST /api/reservas/:id/responder` |
| Módulo de notificaciones | **Jesús + José** | tabla `notificaciones` + `GET /api/reservas/notificaciones` |
| Componente de calificación por estrellas | **Edwin** | `pension.js` → `form-resena` |
| API de reseñas con validación de estadía | **Jesús** | `backend/routes/resenas.js` |
| Promedio y moderación | **Jesús** | `resenas.js` → `PATCH /api/resenas/:id/moderar` |

### Sprint 4 — Consulta y análisis (HU-11, HU-12)

| Tarea | Responsable | Archivos |
|---|---|---|
| Tablero de control con indicadores | **Edwin** | `admin.html`, `js/admin.js` |
| Endpoints de reportería | **Jesús** | `backend/routes/admin.js` → `/indicadores`, `/trazabilidad` |
| Exportación Excel/CSV | **Jesús** | `admin.js` → `GET /api/admin/reporte.csv` |
| Ocupación y arriendo promedio por barrio | **José** | consulta SQL en `/indicadores` (GROUP BY barrio) |
| Vista "Mis reservas" con pestañas | **Edwin** | `reservas.html`, `js/reservas.js` |
| API del historial del estudiante | **Jesús** | `reservas.js` → `GET /api/reservas/mias` |
| Pruebas de seguridad por rol (RNF-06) | **QA** | intentar acceder a datos ajenos con cada rol |
| Optimización de consultas del panel | **José** | `EXPLAIN QUERY PLAN` sobre las consultas de `admin.js` |

---

## 8. Plan de pruebas (Ingeniero QA de cada sprint)

Cada criterio de aceptación del anexo *Historias de Usuario.xlsx* es un caso de prueba. Ejemplos ejecutables con `curl` (o con la extensión *Thunder Client* de VS Code):

```bash
# HU-01 esc. 2 — dirección duplicada (espera error 409)
curl -X POST http://localhost:3000/api/pensiones \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Otra","direccion":"Cra 21 # 25-14","barrio":"X","tarifa_mensual":1}'

# HU-06 esc. 2 — fecha pasada (espera error 400)
curl -X POST http://localhost:3000/api/reservas \
  -H "Content-Type: application/json" \
  -d '{"habitacion_id":1,"fecha_ingreso":"2025-01-01","meses":6}'

# RNF-06 — un estudiante no puede verificar pensiones (espera 403)
curl -X PATCH http://localhost:3000/api/pensiones/1/estado \
  -H "Content-Type: application/json" -d '{"estado":"Suspendida","motivo":"x"}'
```

**Definición de Hecho (DoD)** acordada por el equipo: la historia tiene todos sus criterios de aceptación verificados por el QA, el código fue revisado y aprobado en un PR, está fusionado en `main` y el Sprint Backlog registra las horas.

---

## 9. Evolución del prototipo a producción

### 9.1. Pasarela de pagos real (Wompi — sandbox gratuito)

En `backend/routes/reservas.js`, reemplazar el bloque de simulación por la creación de un enlace de pago:

```javascript
// npm install node-fetch@2
const WOMPI = 'https://sandbox.wompi.co/v1';
const LLAVE_PUBLICA = process.env.WOMPI_PUB;   // guardar en .env, nunca en el código

router.post('/:id/pagar', requiereRol('estudiante'), async (req, res) => {
  const r = db.prepare('SELECT * FROM reservas WHERE id=? AND estudiante_id=?')
    .get(+req.params.id, req.session.usuario.id);
  if (!r) return res.status(404).json({ error: 'Reserva no encontrada' });

  // 1. Crear la transacción en Wompi (monto en centavos)
  const resp = await fetch(`${WOMPI}/payment_links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json',
               Authorization: `Bearer ${process.env.WOMPI_PRIV}` },
    body: JSON.stringify({
      name: `Reserva UniPensión #${r.id}`,
      description: 'Depósito / primer mes de arriendo',
      single_use: true, collect_shipping: false,
      amount_in_cents: r.valor_total * 100, currency: 'COP',
      redirect_url: `https://TU-DOMINIO/reservas.html?confirmar=${r.id}`,
    }),
  });
  const { data } = await resp.json();
  res.json({ url_pago: `https://checkout.wompi.co/l/${data.id}` });
});

// 2. Webhook que Wompi llama al aprobar/rechazar (configurarlo en el panel de Wompi)
router.post('/webhook-wompi', express.json(), (req, res) => {
  const evento = req.body;
  if (evento?.data?.transaction?.status === 'APPROVED') {
    const idReserva = +evento.data.transaction.reference;
    // …misma lógica actual de pago aprobado: estado Pagada, consecutivo, notificaciones
  }
  res.sendStatus(200);
});
```

### 9.2. Correos reales (RF-15) con Nodemailer

```javascript
// npm install nodemailer     (backend/utils/correo.js)
const nodemailer = require('nodemailer');
const transporte = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.CORREO, pass: process.env.CLAVE_APP }, // clave de aplicación de Gmail
});

async function enviarCorreo(para, asunto, html) {
  await transporte.sendMail({ from: '"UniPensión Sincelejo" <no-responder@unipension.co>', to: para, subject: asunto, html });
}
module.exports = { enviarCorreo };
```

Llamarlo en cada punto donde hoy se inserta en la tabla `notificaciones`.

### 9.3. Carga real de fotografías (HU-01 esc. 4)

```javascript
// npm install multer        (en backend/routes/pensiones.js)
const multer = require('multer');
const subir = multer({
  dest: path.join(__dirname, '..', '..', 'public', 'subidas'),
  limits: { fileSize: 5 * 1024 * 1024 },                    // máx. 5 MB (criterio HU-01)
  fileFilter: (_req, f, cb) => cb(null, /image\/(jpeg|png)/.test(f.mimetype)), // solo JPG/PNG
});

router.post('/:id/fotos', requiereRol('propietario'), subir.array('fotos', 6), (req, res) => {
  for (const f of req.files)
    db.prepare('INSERT INTO fotos (pension_id,url) VALUES (?,?)')
      .run(+req.params.id, '/subidas/' + f.filename);
  res.json({ mensaje: `${req.files.length} fotografía(s) cargada(s)` });
});
```

### 9.4. Migración a MySQL (RNF-12) y despliegue

- El esquema de `db.js` es SQL estándar: cambiar `AUTOINCREMENT` por `AUTO_INCREMENT` y usar el paquete `mysql2` con un *pool* de conexiones.
- Despliegue gratuito recomendado para la sustentación: **Render.com** (servicio web Node) o **Railway.app**; la base SQLite funciona tal cual en el plan gratuito.
- Variables en `.env`: `SESSION_SECRET`, `WOMPI_PUB`, `WOMPI_PRIV`, `CORREO`, `CLAVE_APP`. **Nunca** subir `.env` a GitHub (ya está en `.gitignore`).
- HTTPS (RNF-05): Render lo provee automático; activar `cookie: { secure: true }` en `server.js`.
- Copias de seguridad (RNF-09): en SQLite basta programar la copia del archivo `unipension.db`; en MySQL usar `mysqldump` diario.

---

## 10. Cronograma de ceremonias sugerido

| Ceremonia | Cuándo | Duración | Facilita |
|---|---|---|---|
| Sprint Planning | Día 1 del sprint | 2 h | Jesús (SM) |
| Daily (puede ser por WhatsApp/Meet) | Cada día hábil | 15 min | Jesús (SM) |
| Sprint Review (demo del incremento) | Día 20 | 1 h | Edwin (PO) valida criterios |
| Retrospectiva | Día 20 | 45 min | Jesús (SM) |

Al cerrar cada sprint: actualizar el *Sprint Backlog.xlsx* (horas y estatus), mover las historias del *Product Backlog.xlsx* a estado Hecho y etiquetar la versión en GitHub:

```bash
git tag -a sprint-1 -m "Incremento Sprint 1: módulo de oferta"
git push origin sprint-1
```
