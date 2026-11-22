// =============================================================
// UniPensión Sincelejo — Servidor principal (Express)
// Arquitectura cliente-servidor en 3 capas (RNF-10):
//   presentación (client/) · lógica de negocio (routes/) · persistencia (db.js)
// Se ejecuta igual en local (npm start) y en Vercel (api/index.js exporta esta app).
// =============================================================
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const { AlmacenSesiones, SIETE_DIAS } = require('./utils/sesiones');

const app = express();
const PUERTO = process.env.PORT || 3000;
const PRODUCCION = process.env.NODE_ENV === 'production';

if (PRODUCCION && !process.env.SESSION_SECRET)
  console.warn('ADVERTENCIA: falta SESSION_SECRET; las sesiones usan una clave de desarrollo.');

// Vercel y Render atienden HTTPS en un proxy: sin esto la cookie segura no se enviaría (RNF-05)
app.set('trust proxy', 1);
app.use(express.json({ limit: '4mb' })); // fotografías comprimidas en el navegador (máx. 5); límite de Vercel: 4,5 MB

// La base se inicializa una sola vez por instancia; las peticiones esperan a que esté lista
app.use('/api', async (_req, _res, next) => { await db.listo; next(); });
app.use(session({
  store: new AlmacenSesiones(db),
  secret: process.env.SESSION_SECRET || 'unipension-dev-cambiar-en-produccion',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: PRODUCCION, maxAge: SIETE_DIAS },
}));

// API REST
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/pensiones', require('./routes/pensiones'));
app.use('/api/reservas',  require('./routes/reservas'));
app.use('/api/resenas',   require('./routes/resenas'));
app.use('/api/admin',     require('./routes/admin'));
app.use('/api/favoritos', require('./routes/favoritos'));

// Capa de presentación (RNF-01): sirve la aplicación React compilada (client/dist).
// En Vercel los archivos estáticos los sirve la CDN y esta parte no se usa.
const dist = path.join(__dirname, '..', 'client', 'dist');
const indice = path.join(dist, 'index.html');
app.use(express.static(dist));

// Fallback SPA: cualquier ruta que no sea /api devuelve index.html (React Router se encarga)
app.get(/^\/(?!api\/).*/, (_req, res) => {
  if (fs.existsSync(indice)) return res.sendFile(indice);
  res.status(503).type('text/plain; charset=utf-8')
    .send('El frontend no está compilado. Ejecuta `npm run build` y vuelve a iniciar el servidor.');
});

// Manejo de errores
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.type === 'entity.too.large')
    return res.status(413).json({ error: 'La solicitud es demasiado grande. Reduce el tamaño o la cantidad de fotografías.' });
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Exporta la app para Vercel y las pruebas automáticas; solo escucha el puerto si se ejecuta directamente
module.exports = app;
if (require.main === module) app.listen(PUERTO, () =>
  console.log(`UniPensión Sincelejo ejecutándose en http://localhost:${PUERTO}
  Usuarios demo → admin@unipension.co/admin123 · propietaria@unipension.co/prop123 · estudiante@unipension.co/est123`));
