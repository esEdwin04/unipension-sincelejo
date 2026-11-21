// =============================================================
// Módulo de reservas y pagos (HU-06, HU-07, HU-08, HU-09, HU-11)
// Responsable: Desarrollador Backend
// La pasarela de pagos se SIMULA en el prototipo: en producción se
// integra Wompi / Mercado Pago / PayU según la guía del proyecto.
// =============================================================
const express = require('express');
const db = require('../db');
const { requiereRol, requiereSesion } = require('../middleware/auth');
const { generarComprobantePDF } = require('../utils/pdf');
const router = express.Router();

// Libera bloqueos vencidos (30 min sin pagar) y solicitudes sin respuesta (48 h) — HU-07 esc.3 y HU-09 esc.3
function liberarVencidas() {
  const tx = db.transaction(() => {
    const vencidasPago = db.prepare(`SELECT * FROM reservas
      WHERE estado = 'Pendiente de pago' AND expira_en < datetime('now','localtime')`).all();
    for (const r of vencidasPago) {
      db.prepare(`UPDATE reservas SET estado='Cancelada' WHERE id=?`).run(r.id);
      db.prepare(`UPDATE habitaciones SET estado='Libre' WHERE id=?`).run(r.habitacion_id);
    }
    const sinRespuesta = db.prepare(`SELECT * FROM reservas
      WHERE estado = 'Pagada' AND responder_antes < datetime('now','localtime')`).all();
    for (const r of sinRespuesta) {
      db.prepare(`UPDATE reservas SET estado='Cancelada' WHERE id=?`).run(r.id);
      db.prepare(`UPDATE habitaciones SET estado='Libre' WHERE id=?`).run(r.habitacion_id);
      db.prepare(`UPDATE pagos SET estado='Revertido' WHERE reserva_id=?`).run(r.id);
      db.prepare('INSERT INTO notificaciones (usuario_id,mensaje) VALUES (?,?)')
        .run(r.estudiante_id, `Su solicitud #${r.id} fue cancelada por falta de respuesta del propietario (48 h). El pago será revertido.`);
    }
  });
  tx();
}
router.use((_req, _res, next) => { liberarVencidas(); next(); });

// ---------- CREAR SOLICITUD (HU-06) ----------
router.post('/', requiereRol('estudiante'), (req, res) => {
  const { habitacion_id, fecha_ingreso, meses } = req.body;
  if (!habitacion_id || !fecha_ingreso || !meses)
    return res.status(400).json({ error: 'Habitación, fecha de ingreso y duración son obligatorios' });
  // Esc. 2: fecha anterior a hoy
  if (fecha_ingreso < new Date().toISOString().slice(0, 10))
    return res.status(400).json({ error: 'La fecha de ingreso no puede ser anterior al día actual' });

  const h = db.prepare(`SELECT h.*, p.nombre AS pension, p.deposito, p.estado AS estado_pension
                        FROM habitaciones h JOIN pensiones p ON p.id = h.pension_id
                        WHERE h.id = ?`).get(+habitacion_id);
  if (!h) return res.status(404).json({ error: 'Habitación no encontrada' });
  if (h.estado_pension !== 'Verificada')
    return res.status(409).json({ error: 'La pensión no está disponible para reservas' });
  // Esc. 3: solapamiento — otro estudiante tomó el cupo primero
  if (h.estado !== 'Libre') {
    const similares = db.prepare(`SELECT h2.id, h2.codigo, h2.tipo, h2.tarifa, p.nombre AS pension
      FROM habitaciones h2 JOIN pensiones p ON p.id = h2.pension_id
      WHERE h2.estado='Libre' AND p.estado='Verificada' AND h2.tipo = ? LIMIT 3`).all(h.tipo);
    return res.status(409).json({ error: 'El cupo acaba de ser ocupado por otro estudiante', similares });
  }

  const valorTotal = h.tarifa * +meses + h.deposito;
  const tx = db.transaction(() => {
    db.prepare(`UPDATE habitaciones SET estado='Bloqueada' WHERE id=?`).run(h.id); // bloqueo temporal
    return db.prepare(`INSERT INTO reservas (habitacion_id,estudiante_id,fecha_ingreso,meses,valor_total,expira_en)
      VALUES (?,?,?,?,?, datetime('now','localtime','+30 minutes'))`)
      .run(h.id, req.session.usuario.id, fecha_ingreso, +meses, valorTotal);
  });
  const r = tx();
  res.status(201).json({
    mensaje: 'Reserva creada en estado Pendiente de pago. Tiene 30 minutos para completar el pago.',
    reserva_id: r.lastInsertRowid, valor_total: valorTotal
  });
});

// ---------- CANCELAR ANTES DE PAGAR (HU-06 esc. 4) ----------
router.post('/:id/cancelar', requiereRol('estudiante'), (req, res) => {
  const r = db.prepare(`SELECT * FROM reservas WHERE id=? AND estudiante_id=? AND estado='Pendiente de pago'`)
    .get(+req.params.id, req.session.usuario.id);
  if (!r) return res.status(404).json({ error: 'Reserva no encontrada o ya procesada' });
  db.prepare(`UPDATE reservas SET estado='Cancelada' WHERE id=?`).run(r.id);
  db.prepare(`UPDATE habitaciones SET estado='Libre' WHERE id=?`).run(r.habitacion_id);
  res.json({ mensaje: 'Solicitud cancelada y habitación liberada' });
});

// ---------- PAGO SIMULADO (HU-07) ----------
// body: { medio: 'PSE'|'Tarjeta'|'Nequi', simular: 'aprobado'|'rechazado' }
router.post('/:id/pagar', requiereRol('estudiante'), (req, res) => {
  const r = db.prepare(`SELECT r.*, h.pension_id FROM reservas r
                        JOIN habitaciones h ON h.id = r.habitacion_id
                        WHERE r.id=? AND r.estudiante_id=?`).get(+req.params.id, req.session.usuario.id);
  if (!r) return res.status(404).json({ error: 'Reserva no encontrada' });
  if (r.estado !== 'Pendiente de pago')
    return res.status(409).json({ error: `La reserva está en estado "${r.estado}"` });

  const { medio = 'PSE', simular = 'aprobado' } = req.body;
  // Esc. 2: pago rechazado → se permite reintentar sin perder la solicitud
  if (simular === 'rechazado') {
    db.prepare(`INSERT INTO pagos (reserva_id,valor,medio,estado) VALUES (?,?,?,'Rechazado')`)
      .run(r.id, r.valor_total, medio);
    return res.status(402).json({ error: 'Transacción rechazada por la entidad. Intente con otro medio de pago.' });
  }

  const consecutivo = 'UP-' + String(r.id).padStart(5, '0') + '-' + Date.now().toString().slice(-5);
  const pension = db.prepare('SELECT * FROM pensiones WHERE id=?').get(r.pension_id);
  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO pagos (reserva_id,valor,medio,estado,consecutivo) VALUES (?,?,?,'Aprobado',?)`)
      .run(r.id, r.valor_total, medio, consecutivo);
    db.prepare(`UPDATE reservas SET estado='Pagada',
                responder_antes = datetime('now','localtime','+48 hours') WHERE id=?`).run(r.id);
    db.prepare(`UPDATE habitaciones SET estado='Ocupada' WHERE id=?`).run(r.habitacion_id);
    db.prepare('INSERT INTO notificaciones (usuario_id,mensaje) VALUES (?,?)')
      .run(pension.propietario_id, `Nueva solicitud pagada #${r.id} para "${pension.nombre}". Tiene 48 horas para responder.`);
    db.prepare('INSERT INTO notificaciones (usuario_id,mensaje) VALUES (?,?)')
      .run(r.estudiante_id, `Pago aprobado (${consecutivo}). En el prototipo, el correo de confirmación se registra como notificación.`);
  });
  tx();
  res.json({ mensaje: 'Pago aprobado. Reserva pagada, pendiente de aceptación del propietario.', consecutivo });
});

// ---------- COMPROBANTE PDF (HU-08) ----------
router.get('/:id/comprobante', requiereSesion, (req, res) => {
  const datos = db.prepare(`
    SELECT r.id AS reserva_id, r.fecha_ingreso, r.meses, r.valor_total,
           pg.consecutivo, pg.medio, pg.creado_en AS fecha_pago, pg.estado AS estado_pago,
           u.nombre AS estudiante, u.correo,
           pe.nombre AS pension, pe.direccion, pe.barrio, pr.nombre AS propietario
    FROM reservas r
    JOIN pagos pg       ON pg.reserva_id = r.id AND pg.estado IN ('Aprobado','Revertido')
    JOIN usuarios u     ON u.id = r.estudiante_id
    JOIN habitaciones h ON h.id = r.habitacion_id
    JOIN pensiones pe   ON pe.id = h.pension_id
    JOIN usuarios pr    ON pr.id = pe.propietario_id
    WHERE r.id = ?`).get(+req.params.id);
  if (!datos) return res.status(404).json({ error: 'No existe comprobante para esta reserva' });

  const { rol, id } = req.session.usuario;
  if (rol === 'estudiante' && db.prepare('SELECT estudiante_id FROM reservas WHERE id=?').get(datos.reserva_id).estudiante_id !== id)
    return res.status(403).json({ error: 'Solo puede descargar sus propios comprobantes' }); // RNF-06

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=comprobante_${datos.consecutivo}.pdf`);
  generarComprobantePDF(datos, res);
});

// ---------- BANDEJA DEL PROPIETARIO (HU-09) ----------
router.get('/solicitudes', requiereRol('propietario'), (req, res) => {
  res.json(db.prepare(`
    SELECT r.*, h.codigo, h.tipo, p.nombre AS pension, u.nombre AS estudiante, u.telefono, u.correo
    FROM reservas r
    JOIN habitaciones h ON h.id = r.habitacion_id
    JOIN pensiones p    ON p.id = h.pension_id
    JOIN usuarios u     ON u.id = r.estudiante_id
    WHERE p.propietario_id = ? AND r.estado IN ('Pagada','Confirmada','Rechazada')
    ORDER BY r.creado_en DESC`).all(req.session.usuario.id));
});

router.post('/:id/responder', requiereRol('propietario'), (req, res) => {
  const { decision, motivo } = req.body; // 'aceptar' | 'rechazar'
  const r = db.prepare(`
    SELECT r.*, p.propietario_id, p.nombre AS pension FROM reservas r
    JOIN habitaciones h ON h.id = r.habitacion_id
    JOIN pensiones p    ON p.id = h.pension_id WHERE r.id = ?`).get(+req.params.id);
  if (!r || r.propietario_id !== req.session.usuario.id)
    return res.status(404).json({ error: 'Solicitud no encontrada' });
  if (r.estado !== 'Pagada') return res.status(409).json({ error: `La solicitud está en estado "${r.estado}"` });

  if (decision === 'aceptar') {
    db.prepare(`UPDATE reservas SET estado='Confirmada' WHERE id=?`).run(r.id);
    db.prepare('INSERT INTO notificaciones (usuario_id,mensaje) VALUES (?,?)')
      .run(r.estudiante_id, `¡Reserva #${r.id} aceptada en "${r.pension}"! El propietario se pondrá en contacto para coordinar el ingreso.`);
    return res.json({ mensaje: 'Reserva confirmada y estudiante notificado' });
  }
  if (decision === 'rechazar') {
    if (!motivo) return res.status(400).json({ error: 'Debe indicar el motivo del rechazo' });
    const tx = db.transaction(() => {
      db.prepare(`UPDATE reservas SET estado='Rechazada' WHERE id=?`).run(r.id);
      db.prepare(`UPDATE habitaciones SET estado='Libre' WHERE id=?`).run(r.habitacion_id);
      db.prepare(`UPDATE pagos SET estado='Revertido' WHERE reserva_id=? AND estado='Aprobado'`).run(r.id);
      db.prepare('INSERT INTO notificaciones (usuario_id,mensaje) VALUES (?,?)')
        .run(r.estudiante_id, `Reserva #${r.id} rechazada. Motivo: ${motivo}. El pago será revertido.`);
    });
    tx();
    return res.json({ mensaje: 'Solicitud rechazada, cupo liberado y pago revertido' });
  }
  res.status(400).json({ error: 'Decisión no válida' });
});

// ---------- HISTORIAL DEL ESTUDIANTE (HU-11) ----------
router.get('/mias', requiereRol('estudiante'), (req, res) => {
  res.json(db.prepare(`
    SELECT r.*, h.codigo, h.tipo, p.nombre AS pension, p.barrio, pg.consecutivo
    FROM reservas r
    JOIN habitaciones h ON h.id = r.habitacion_id
    JOIN pensiones p    ON p.id = h.pension_id
    LEFT JOIN pagos pg  ON pg.reserva_id = r.id AND pg.estado='Aprobado'
    WHERE r.estudiante_id = ?
    ORDER BY r.creado_en DESC`).all(req.session.usuario.id)); // RNF-06: solo sus datos
});

// Finalizar estadía (habilita la reseña — apoyo para demo de HU-10)
router.post('/:id/finalizar', requiereRol('estudiante'), (req, res) => {
  const r = db.prepare(`SELECT * FROM reservas WHERE id=? AND estudiante_id=? AND estado='Confirmada'`)
    .get(+req.params.id, req.session.usuario.id);
  if (!r) return res.status(404).json({ error: 'Reserva confirmada no encontrada' });
  db.prepare(`UPDATE reservas SET estado='Finalizada' WHERE id=?`).run(r.id);
  db.prepare(`UPDATE habitaciones SET estado='Libre' WHERE id=?`).run(r.habitacion_id);
  res.json({ mensaje: 'Estadía finalizada. Ya puede calificar la pensión.' });
});

// ---------- NOTIFICACIONES (RF-15) ----------
router.get('/notificaciones', requiereSesion, (req, res) => {
  res.json(db.prepare(`SELECT * FROM notificaciones WHERE usuario_id=? ORDER BY creado_en DESC LIMIT 20`)
    .all(req.session.usuario.id));
});

module.exports = router;
