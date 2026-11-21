// =============================================================
// UniPensión Sincelejo — Servidor principal (Express)
// Arquitectura cliente-servidor en 3 capas (RNF-10):
//   presentación (public/) · lógica de negocio (routes/) · persistencia (db.js)
// =============================================================
const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PUERTO = process.env.PORT || 3000;

app.use(express.json({ limit: '5mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'unipension-dev-cambiar-en-produccion',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax' } // en producción: secure:true sobre HTTPS (RNF-05)
}));

// API REST
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/pensiones', require('./routes/pensiones'));
app.use('/api/reservas',  require('./routes/reservas'));
app.use('/api/resenas',   require('./routes/resenas'));
app.use('/api/admin',     require('./routes/admin'));

// Capa de presentación (RNF-01): sirve la aplicación React compilada (client/dist).
// Si aún no se ha ejecutado `npm run build`, usa el frontend estático de respaldo (public/).
const fs = require('fs');
const dist = path.join(__dirname, '..', 'client', 'dist');
const carpetaFrontend = fs.existsSync(path.join(dist, 'index.html')) ? dist : path.join(__dirname, '..', 'public');
app.use(express.static(carpetaFrontend));

// Fallback SPA: cualquier ruta que no sea /api devuelve index.html (React Router se encarga)
app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(carpetaFrontend, 'index.html')));

// Manejo de errores
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PUERTO, () =>
  console.log(`UniPensión Sincelejo ejecutándose en http://localhost:${PUERTO}
  Usuarios demo → admin@unipension.co/admin123 · propietaria@unipension.co/prop123 · estudiante@unipension.co/est123`));
