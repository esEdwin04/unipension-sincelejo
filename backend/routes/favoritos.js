// =============================================================
// Favoritos: el estudiante guarda pensiones para compararlas después.
// Solo estudiantes (RNF-06); cada uno ve únicamente sus propios favoritos.
//   GET    /api/favoritos          → pensiones guardadas (datos de tarjeta, más recientes primero)
//   GET    /api/favoritos/ids      → solo los id (para pintar los corazones en el catálogo)
//   PUT    /api/favoritos/:id      → guardar (idempotente)
//   DELETE /api/favoritos/:id      → quitar (idempotente)
// Responsable: Desarrollador Backend
// =============================================================
const express = require('express');
const db = require('../db');
const { requiereRol } = require('../middleware/auth');
const router = express.Router();

router.use(requiereRol('estudiante'));

router.get('/', async (req, res) => {
  const lista = await db.prepare(`
    SELECT p.id, p.nombre, p.barrio, p.servicios, p.tarifa_mensual, p.tipo_habitacion, p.destacado, p.estado,
           (SELECT ROUND(AVG(estrellas),1) FROM resenas r WHERE r.pension_id = p.id AND r.estado = 'Publicada') AS calificacion,
           (SELECT COUNT(*) FROM resenas r WHERE r.pension_id = p.id AND r.estado = 'Publicada') AS total_resenas,
           (SELECT COUNT(*) FROM habitaciones h WHERE h.pension_id = p.id AND h.estado = 'Libre') AS cupos,
           COALESCE(p.miniatura, (SELECT url FROM fotos f WHERE f.pension_id = p.id ORDER BY f.id LIMIT 1)) AS foto,
           fv.creado_en AS guardado_en
    FROM favoritos fv JOIN pensiones p ON p.id = fv.pension_id
    WHERE fv.usuario_id = ?
    ORDER BY fv.creado_en DESC, p.id DESC`).all(req.session.usuario.id);
  // Una pensión oculta o en revisión sigue en la lista para que el estudiante sepa qué pasó con ella
  res.json(lista.map((p) => ({ ...p, destacado: !!p.destacado, publicada: p.estado === 'Verificada' })));
});

router.get('/ids', async (req, res) => {
  const filas = await db.prepare('SELECT pension_id FROM favoritos WHERE usuario_id = ?').all(req.session.usuario.id);
  res.json(filas.map((f) => f.pension_id));
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Pensión no válida' });
  // Solo se pueden guardar pensiones publicadas (las verificadas son las únicas públicas)
  const p = await db.prepare(`SELECT id, nombre FROM pensiones WHERE id = ? AND estado = 'Verificada'`).get(id);
  if (!p) return res.status(404).json({ error: 'Pensión no encontrada' });
  await db.prepare('INSERT OR IGNORE INTO favoritos (usuario_id, pension_id) VALUES (?,?)').run(req.session.usuario.id, id);
  res.json({ mensaje: `«${p.nombre}» se guardó en tus favoritos.`, favorito: true });
});

router.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM favoritos WHERE usuario_id = ? AND pension_id = ?').run(req.session.usuario.id, Number(req.params.id));
  res.json({ mensaje: 'Se quitó de tus favoritos.', favorito: false });
});

module.exports = router;
