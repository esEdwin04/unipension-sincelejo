// =============================================================
// Módulo de calificaciones y reseñas (HU-10 → RF-12)
// Responsable: Desarrollador Backend
// =============================================================
const express = require('express');
const db = require('../db');
const { requiereRol } = require('../middleware/auth');
const router = express.Router();

// POST /api/resenas  { pension_id, estrellas, comentario }
router.post('/', requiereRol('estudiante'), async (req, res) => {
  const { pension_id, estrellas, comentario } = req.body;
  if (!pension_id || !estrellas) return res.status(400).json({ error: 'Pensión y calificación son obligatorias' });

  // Esc. 2: solo con estadía finalizada en esa pensión
  const estadia = await db.prepare(`
    SELECT r.id FROM reservas r JOIN habitaciones h ON h.id = r.habitacion_id
    WHERE h.pension_id = ? AND r.estudiante_id = ? AND r.estado = 'Finalizada'
    ORDER BY r.creado_en DESC LIMIT 1`).get(+pension_id, req.session.usuario.id);
  if (!estadia)
    return res.status(403).json({ error: 'La calificación solo se habilita al finalizar una estadía en esta pensión' });

  const yaReseno = await db.prepare('SELECT id FROM resenas WHERE reserva_id = ?').get(estadia.id);
  if (yaReseno) return res.status(409).json({ error: 'Ya registró una reseña para esta estadía' });

  await db.prepare(`INSERT INTO resenas (pension_id,estudiante_id,reserva_id,estrellas,comentario)
              VALUES (?,?,?,?,?)`)
    .run(+pension_id, req.session.usuario.id, estadia.id, +estrellas, comentario || '');
  // Esc. 3: el promedio se recalcula con AVG() en cada consulta del catálogo/ficha
  res.status(201).json({ mensaje: 'Reseña publicada. El promedio de la pensión fue actualizado.' });
});

// POST /api/resenas/:id/reportar  (propietario reporta reseña ofensiva — esc. 4)
router.post('/:id/reportar', requiereRol('propietario'), async (req, res) => {
  const r = await db.prepare(`SELECT rs.* FROM resenas rs JOIN pensiones p ON p.id = rs.pension_id
                        WHERE rs.id = ? AND p.propietario_id = ?`).get(+req.params.id, req.session.usuario.id);
  if (!r) return res.status(404).json({ error: 'Reseña no encontrada en sus pensiones' }); // RNF-06
  await db.prepare(`UPDATE resenas SET estado='Reportada' WHERE id=?`).run(r.id); // oculta preventivamente
  res.json({ mensaje: 'Reseña oculta de forma preventiva y enviada al administrador para moderación' });
});

// Moderación del administrador
router.get('/reportadas', requiereRol('administrador'), async (_req, res) => {
  res.json(await db.prepare(`SELECT r.*, u.nombre AS estudiante, p.nombre AS pension
    FROM resenas r JOIN usuarios u ON u.id=r.estudiante_id JOIN pensiones p ON p.id=r.pension_id
    WHERE r.estado='Reportada'`).all());
});

router.patch('/:id/moderar', requiereRol('administrador'), async (req, res) => {
  const { decision } = req.body; // 'publicar' | 'ocultar'
  if (!['publicar', 'ocultar'].includes(decision)) return res.status(400).json({ error: 'Decisión no válida' });
  const nuevo = decision === 'publicar' ? 'Publicada' : 'Oculta';
  await db.prepare(`UPDATE resenas SET estado=? WHERE id=?`).run(nuevo, +req.params.id);
  res.json({ mensaje: `Reseña ${nuevo.toLowerCase()}` });
});

module.exports = router;
