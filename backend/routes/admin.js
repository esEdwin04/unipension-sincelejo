// =============================================================
// Módulo del panel administrativo (HU-12 → RF-14)
// Responsables: Desarrollador Backend + Administrador DB (consultas)
// =============================================================
const express = require('express');
const db = require('../db');
const { requiereRol } = require('../middleware/auth');
const router = express.Router();

router.use(requiereRol('administrador'));

// GET /api/admin/indicadores — tablero con KPIs y ocupación por barrio
router.get('/indicadores', (_req, res) => {
  const kpis = {
    pensiones_total:      db.prepare(`SELECT COUNT(*) n FROM pensiones`).get().n,
    pensiones_verificadas:db.prepare(`SELECT COUNT(*) n FROM pensiones WHERE estado='Verificada'`).get().n,
    pensiones_pendientes: db.prepare(`SELECT COUNT(*) n FROM pensiones WHERE estado='Pendiente'`).get().n,
    reservas_total:       db.prepare(`SELECT COUNT(*) n FROM reservas`).get().n,
    reservas_confirmadas: db.prepare(`SELECT COUNT(*) n FROM reservas WHERE estado='Confirmada'`).get().n,
    ingresos:             db.prepare(`SELECT COALESCE(SUM(valor),0) n FROM pagos WHERE estado='Aprobado'`).get().n,
  };
  // Ocupación y arriendo promedio por barrio (tarea del Administrador DB, Sprint 4)
  const porBarrio = db.prepare(`
    SELECT p.barrio,
           COUNT(h.id)                                               AS habitaciones,
           SUM(CASE WHEN h.estado='Ocupada' THEN 1 ELSE 0 END)       AS ocupadas,
           ROUND(100.0*SUM(CASE WHEN h.estado='Ocupada' THEN 1 ELSE 0 END)/COUNT(h.id),1) AS ocupacion_pct,
           ROUND(AVG(h.tarifa),0)                                    AS arriendo_promedio
    FROM pensiones p JOIN habitaciones h ON h.pension_id = p.id
    GROUP BY p.barrio ORDER BY ocupacion_pct DESC`).all();
  // Pensiones más solicitadas y mejor calificadas (esc. 4)
  const top = db.prepare(`
    SELECT p.nombre, p.barrio,
           (SELECT COUNT(*) FROM reservas r JOIN habitaciones h ON h.id=r.habitacion_id
            WHERE h.pension_id = p.id) AS solicitudes,
           (SELECT ROUND(AVG(estrellas),1) FROM resenas rs
            WHERE rs.pension_id = p.id AND rs.estado='Publicada') AS calificacion
    FROM pensiones p ORDER BY solicitudes DESC, calificacion DESC LIMIT 5`).all();
  res.json({ kpis, porBarrio, top });
});

// GET /api/admin/trazabilidad?q=&desde=&hasta= — historial filtrable (esc. 1)
router.get('/trazabilidad', (req, res) => {
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
  res.json(db.prepare(sql).all(...params));
});

// GET /api/admin/reporte.csv — exportación (esc. 3)
router.get('/reporte.csv', (req, res) => {
  const filas = db.prepare(`
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
router.get('/bitacora', (_req, res) => {
  res.json(db.prepare(`SELECT b.*, p.nombre AS pension, u.nombre AS administrador
    FROM bitacora_verificaciones b
    JOIN pensiones p ON p.id=b.pension_id JOIN usuarios u ON u.id=b.admin_id
    ORDER BY b.creado_en DESC LIMIT 50`).all());
});

module.exports = router;
