// =============================================================
// UniPensión Sincelejo — Servidor principal (Express)
// Arquitectura cliente-servidor en 3 capas (RNF-10):
//   presentación (client/) · lógica de negocio (routes/) · persistencia (db.js)
// =============================================================
const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PUERTO = process.env.PORT || 3000;

app.use(express.json({ limit: '8mb' })); // fotografías comprimidas en el navegador (máx. 5)
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
// Si aún no se ha ejecutado `npm run build`, el API funciona y las demás rutas indican cómo compilar.
const fs = require('fs');
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
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Exporta la app para las pruebas automáticas; solo escucha el puerto si se ejecuta directamente
module.exports = app;
if (require.main === module) app.listen(PUERTO, () =>
  console.log(`UniPensión Sincelejo ejecutándose en http://localhost:${PUERTO}
  Usuarios demo → admin@unipension.co/admin123 · propietaria@unipension.co/prop123 · estudiante@unipension.co/est123`));
