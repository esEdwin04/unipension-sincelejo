// ----------------------------------------------------------------------
// Módulo del panel administrativo (HU-12 → RF-14)
// Responsables: Desarrollador Backend + Administrador DB (consultas)
// -------------------------------------------------------------------
const express = require('express');
const db = require('../db');
const { requiereRol } = require('../middleware/auth');
const router = express.Router();

router.use(requiereRol('administrador'));
router.use(require('../utils/vencimientos').conVencimientosAlDia); // indicadores y ocupación al día

// GET /api/admin/indicadores — tablero con KPIs y ocupación por barrio
router.get('/indicadores', async (_req, res) => {
  // Todos los contadores en una sola consulta (un solo viaje de red hasta Turso)
  const kpis = await db.prepare(`SELECT
    (SELECT COUNT(*) FROM pensiones)                                          AS pensiones_total,
    (SELECT COUNT(*) FROM pensiones WHERE estado='Verificada')                AS pensiones_verificadas,
    (SELECT COUNT(*) FROM pensiones WHERE estado='Pendiente')                 AS pensiones_pendientes,
    (SELECT COUNT(*) FROM reservas)                                           AS reservas_total,
    (SELECT COUNT(*) FROM reservas WHERE estado='Confirmada')                 AS reservas_confirmadas,
    (SELECT COALESCE(SUM(valor),0) FROM pagos WHERE estado='Aprobado')        AS ingresos,
    (SELECT COUNT(*) FROM pensiones WHERE estado='Suspendida')                AS pensiones_suspendidas,
    (SELECT COUNT(*) FROM pensiones WHERE destacado=1)                        AS destacadas,
    (SELECT COUNT(*) FROM reportes_pensiones WHERE estado='Pendiente')        AS reportes_activos,
    (SELECT COUNT(*) FROM contactos)                                          AS contactos`).get();
  // Ocupación y arriendo promedio por barrio (tarea del Administrador DB, Sprint 4)
  const porBarrio = await db.prepare(`
    SELECT p.barrio,
           COUNT(h.id)                                               AS habitaciones,
           SUM(CASE WHEN h.estado='Ocupada' THEN 1 ELSE 0 END)       AS ocupadas,
           ROUND(100.0*SUM(CASE WHEN h.estado='Ocupada' THEN 1 ELSE 0 END)/COUNT(h.id),1) AS ocupacion_pct,
           ROUND(AVG(h.tarifa),0)                                    AS arriendo_promedio
    FROM pensiones p JOIN habitaciones h ON h.pension_id = p.id
    GROUP BY p.barrio ORDER BY ocupacion_pct DESC`).all();
  // Pensiones más solicitadas y mejor calificadas (esc. 4)
  const top = await db.prepare(`
    SELECT p.nombre, p.barrio,
           (SELECT COUNT(*) FROM reservas r JOIN habitaciones h ON h.id=r.habitacion_id
            WHERE h.pension_id = p.id) AS solicitudes,
           (SELECT ROUND(AVG(estrellas),1) FROM resenas rs
            WHERE rs.pension_id = p.id AND rs.estado='Publicada') AS calificacion
    FROM pensiones p ORDER BY solicitudes DESC, calificacion DESC LIMIT 5`).all();
  res.json({ kpis, porBarrio, top });
});

// GET /api/admin/trazabilidad?q=&desde=&hasta= — historial filtrable (esc. 1)
router.get('/trazabilidad', async (req, res) => {
  const { q, desde, hasta } = req.query;
  let sql = `
    SELECT r.id, r.estado, r.fecha_ingreso, r.meses, r.valor_total, r.creado_en,
           p.nombre AS pension, p.barrio, pr.nombre AS propietario, es.nombre AS estudiante,
           pg.consecutivo
    FROM reservas r
    JOIN habitaciones h ON h.id = r.habitacion_id
    JOIN pensiones p    ON p.id = h.pension_id
    JOIN usuarios pr    ON pr.id = p.propietario_id
    JOIN usuarios es    ON es.id = r.estudiante_id
    LEFT JOIN pagos pg  ON pg.reserva_id = r.id AND pg.estado='Aprobado'
    WHERE 1=1`;
  const params = [];
  if (q)     { sql += ` AND (p.nombre LIKE ? OR pr.nombre LIKE ? OR es.nombre LIKE ? OR p.barrio LIKE ?)`;
               params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
  if (desde) { sql += ` AND date(r.creado_en) >= date(?)`; params.push(desde); }
  if (hasta) { sql += ` AND date(r.creado_en) <= date(?)`; params.push(hasta); }
  sql += ' ORDER BY r.creado_en DESC';
  res.json(await db.prepare(sql).all(...params));
});

// GET /api/admin/reporte.csv — exportación (esc. 3)
router.get('/reporte.csv', async (req, res) => {
  const filas = await db.prepare(`
    SELECT r.id, p.nombre AS pension, p.barrio, pr.nombre AS propietario,
           es.nombre AS estudiante, r.fecha_ingreso, r.meses, r.valor_total, r.estado, r.creado_en
    FROM reservas r
    JOIN habitaciones h ON h.id=r.habitacion_id
    JOIN pensiones p ON p.id=h.pension_id
    JOIN usuarios pr ON pr.id=p.propietario_id
    JOIN usuarios es ON es.id=r.estudiante_id
    ORDER BY r.creado_en DESC`).all();
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const cab = 'id;pension;barrio;propietario;estudiante;fecha_ingreso;meses;valor_total;estado;creado_en';
  const cuerpo = filas.map(f => Object.values(f).map(esc).join(';')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=reporte_unipension.csv');
  res.send('﻿' + cab + '\n' + cuerpo); // BOM para que Excel abra bien las tildes
});

// GET /api/admin/bitacora — trazabilidad de verificaciones (HU-03)
router.get('/bitacora', async (_req, res) => {
  res.json(await db.prepare(`SELECT b.*, p.nombre AS pension, u.nombre AS administrador
    FROM bitacora_verificaciones b
    JOIN pensiones p ON p.id=b.pension_id JOIN usuarios u ON u.id=b.admin_id
    ORDER BY b.creado_en DESC LIMIT 50`).all());
});

// GET /api/admin/reportes — reportes de información de las pensiones (activos primero)
router.get('/reportes', async (_req, res) => {
  res.json(await db.prepare(`SELECT r.*, p.nombre AS pension, p.barrio, p.estado AS estado_pension, u.nombre AS estudiante, u.correo
    FROM reportes_pensiones r
    JOIN pensiones p ON p.id = r.pension_id
    JOIN usuarios u ON u.id = r.estudiante_id
    ORDER BY CASE r.estado WHEN 'Pendiente' THEN 0 ELSE 1 END, r.creado_en DESC`).all());
});

// PATCH /api/admin/reportes/:id — resolver o descartar un reporte individual
router.patch('/reportes/:id', async (req, res) => {
  const { estado, decision } = req.body;
  if (!['Resuelto', 'Descartado'].includes(estado))
    return res.status(400).json({ error: 'Estado de reporte no válido' });
  const result = await db.prepare(`UPDATE reportes_pensiones SET estado = ?, decision = ?, resuelto_en = ${db.AHORA}
    WHERE id = ? AND estado = 'Pendiente'`).run(estado, decision || null, +req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Reporte pendiente no encontrado' });
  res.json({ mensaje: `Reporte marcado como ${estado.toLowerCase()}` });
});

// ---------- MODERACIÓN DE PUBLICACIONES (prototipo: Aprobar, Rechazar, Ocultar, Restaurar, Destacar, Resolver) ----------
// POST /api/admin/pensiones/:id/moderar { accion, motivo }
const ACCIONES = {
  aprobar:          { estado: 'Verificada', bitacora: 'Verificada',        motivo: false, resuelve: true },
  rechazar:         { estado: 'Rechazada',  bitacora: 'Rechazada',         motivo: true,  resuelve: true },
  ocultar:          { estado: 'Suspendida', bitacora: 'Suspendida',        motivo: true,  resuelve: false },
  restaurar:        { estado: 'Verificada', bitacora: 'Restaurada',        motivo: true,  resuelve: true },
  resolver:         { estado: null,         bitacora: 'Reportes resueltos', motivo: true,  resuelve: true },
  destacar:         { estado: null,         bitacora: 'Destacada',         motivo: false, resuelve: false, destacado: 1 },
  quitar_destacado: { estado: null,         bitacora: 'Sin destacar',      motivo: false, resuelve: false, destacado: 0 },
};
router.post('/pensiones/:id/moderar', async (req, res) => {
  const { accion } = req.body;
  const motivo = String(req.body.motivo || '').trim();
  const a = ACCIONES[accion];
  if (!a) return res.status(400).json({ error: 'Acción de moderación no válida' });
  if (a.motivo && !motivo) return res.status(400).json({ error: 'Explica la decisión para el historial de moderación.' });
  const p = await db.prepare('SELECT * FROM pensiones WHERE id = ?').get(+req.params.id);
  if (!p) return res.status(404).json({ error: 'La pensión no existe.' });

  // HU-03 esc. 3: alerta si hay reservas en curso al ocultar
  const vigentes = (await db.prepare(`SELECT COUNT(*) AS n FROM reservas r JOIN habitaciones h ON h.id = r.habitacion_id
    WHERE h.pension_id = ? AND r.estado IN ('Pagada','Confirmada')`).get(p.id)).n;
  await db.transaction(async (tx) => {
    if (a.estado) {
      await tx.prepare(`UPDATE pensiones SET estado = ?, motivo_rechazo = ?, actualizado_en = ${db.AHORA} WHERE id = ?`)
        .run(a.estado, a.estado === 'Rechazada' ? motivo : null, p.id);
      await tx.prepare('INSERT INTO notificaciones (usuario_id,mensaje) VALUES (?,?)')
        .run(p.propietario_id, `Su pensión "${p.nombre}" cambió a estado ${a.estado}${motivo ? '. Motivo: ' + motivo : ''}`);
    }
    if (a.destacado !== undefined) await tx.prepare('UPDATE pensiones SET destacado = ? WHERE id = ?').run(a.destacado, p.id);
    if (a.resuelve)
      await tx.prepare(`UPDATE reportes_pensiones SET estado = 'Resuelto', decision = ?, resuelto_en = ${db.AHORA}
                  WHERE pension_id = ? AND estado = 'Pendiente'`).run(motivo || accion, p.id);
    await tx.prepare(`INSERT INTO bitacora_verificaciones (pension_id,admin_id,accion,motivo) VALUES (?,?,?,?)`)
      .run(p.id, req.session.usuario.id, a.bitacora, motivo || null);
  });
  res.json({
    mensaje: 'Decisión de moderación registrada y aplicada al catálogo.',
    advertencia: accion === 'ocultar' && vigentes > 0
      ? `La pensión tiene ${vigentes} reserva(s) vigente(s): se conservan hasta su finalización.` : null,
  });
});

module.exports = router;
