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
const { avisarTodos } = require('../utils/whatsapp');
const router = express.Router();
const { AHORA } = db;

const notificar = (cx, usuarioId, mensaje) =>
  cx.prepare('INSERT INTO notificaciones (usuario_id,mensaje) VALUES (?,?)').run(usuarioId, mensaje);

// Libera bloqueos vencidos (30 min sin pagar) y solicitudes sin respuesta (48 h) — HU-07 esc.3 y HU-09 esc.3
async function liberarVencidas() {
  // Consulta previa sin transacción: casi siempre no hay nada que liberar
  const hay = await db.prepare(`SELECT 1 FROM reservas
    WHERE (estado = 'Pendiente de pago' AND expira_en < ${AHORA})
       OR (estado = 'Pagada' AND responder_antes < ${AHORA}) LIMIT 1`).get();
  if (!hay) return;
  const canceladas = await db.transaction(async (tx) => {
    const vencidasPago = await tx.prepare(`SELECT * FROM reservas
      WHERE estado = 'Pendiente de pago' AND expira_en < ${AHORA}`).all();
    for (const r of vencidasPago) {
      await tx.prepare(`UPDATE reservas SET estado='Cancelada' WHERE id=?`).run(r.id);
      await tx.prepare(`UPDATE habitaciones SET estado='Libre' WHERE id=?`).run(r.habitacion_id);
    }
    const sinRespuesta = await tx.prepare(`SELECT * FROM reservas
      WHERE estado = 'Pagada' AND responder_antes < ${AHORA}`).all();
    for (const r of sinRespuesta) {
      await tx.prepare(`UPDATE reservas SET estado='Cancelada' WHERE id=?`).run(r.id);
      await tx.prepare(`UPDATE habitaciones SET estado='Libre' WHERE id=?`).run(r.habitacion_id);
      await tx.prepare(`UPDATE pagos SET estado='Revertido' WHERE reserva_id=?`).run(r.id);
      await notificar(tx, r.estudiante_id, `Su solicitud #${r.id} fue cancelada por falta de respuesta del propietario (48 h). El pago será revertido.`);
    }
    return sinRespuesta;
  });
  if (canceladas.length) {
    const nombres = await db.prepare(`SELECT r.id, p.nombre FROM reservas r JOIN habitaciones h ON h.id = r.habitacion_id
      JOIN pensiones p ON p.id = h.pension_id WHERE r.id IN (${canceladas.map(() => '?').join(',')})`).all(...canceladas.map((r) => r.id));
    const pension = Object.fromEntries(nombres.map((n) => [n.id, n.nombre]));
    await avisarTodos(canceladas.map((r) => [r.estudiante_id, 'unipension_reserva_cancelada', [r.id, pension[r.id]]]));
  }
}
router.use(async (_req, _res, next) => { await liberarVencidas(); next(); });

// ---------- CREAR SOLICITUD (HU-06) ----------
router.post('/', requiereRol('estudiante'), async (req, res) => {
  const { habitacion_id, fecha_ingreso, meses } = req.body;
  if (!habitacion_id || !fecha_ingreso || !meses)
    return res.status(400).json({ error: 'Habitación, fecha de ingreso y duración son obligatorios' });
  // Esc. 2: fecha anterior a hoy (fecha de Colombia, no UTC)
  if (fecha_ingreso < db.hoyColombia())
    return res.status(400).json({ error: 'La fecha de ingreso no puede ser anterior al día actual' });

  const h = await db.prepare(`SELECT h.*, p.nombre AS pension, p.deposito, p.estado AS estado_pension
                              FROM habitaciones h JOIN pensiones p ON p.id = h.pension_id
                              WHERE h.id = ?`).get(+habitacion_id);
  if (!h) return res.status(404).json({ error: 'Habitación no encontrada' });
  if (h.estado_pension !== 'Verificada')
    return res.status(409).json({ error: 'La pensión no está disponible para reservas' });

  const valorTotal = h.tarifa * +meses + h.deposito;
  // El bloqueo es condicional (estado='Libre') dentro de la transacción: si dos estudiantes
  // piden el mismo cupo a la vez, solo uno lo obtiene.
  const r = await db.transaction(async (tx) => {
    const bloqueo = await tx.prepare(`UPDATE habitaciones SET estado='Bloqueada' WHERE id=? AND estado='Libre'`).run(h.id);
    if (!bloqueo.changes) return null;
    return tx.prepare(`INSERT INTO reservas (habitacion_id,estudiante_id,fecha_ingreso,meses,valor_total,expira_en)
      VALUES (?,?,?,?,?, datetime('now','-5 hours','+30 minutes'))`)
      .run(h.id, req.session.usuario.id, fecha_ingreso, +meses, valorTotal);
  });
  // Esc. 3: solapamiento — otro estudiante tomó el cupo primero
  if (!r) {
    const similares = await db.prepare(`SELECT h2.id, h2.codigo, h2.tipo, h2.tarifa, p.nombre AS pension
      FROM habitaciones h2 JOIN pensiones p ON p.id = h2.pension_id
      WHERE h2.estado='Libre' AND p.estado='Verificada' AND h2.tipo = ? LIMIT 3`).all(h.tipo);
    return res.status(409).json({ error: 'El cupo acaba de ser ocupado por otro estudiante', similares });
  }
  res.status(201).json({
    mensaje: 'Reserva creada en estado Pendiente de pago. Tiene 30 minutos para completar el pago.',
    reserva_id: r.lastInsertRowid, valor_total: valorTotal
  });
});

// ---------- CANCELAR ANTES DE PAGAR (HU-06 esc. 4) ----------
router.post('/:id/cancelar', requiereRol('estudiante'), async (req, res) => {
  const r = await db.prepare(`SELECT * FROM reservas WHERE id=? AND estudiante_id=? AND estado='Pendiente de pago'`)
    .get(+req.params.id, req.session.usuario.id);
  if (!r) return res.status(404).json({ error: 'Reserva no encontrada o ya procesada' });
  await db.transaction(async (tx) => {
    await tx.prepare(`UPDATE reservas SET estado='Cancelada' WHERE id=?`).run(r.id);
    await tx.prepare(`UPDATE habitaciones SET estado='Libre' WHERE id=?`).run(r.habitacion_id);
  });
  res.json({ mensaje: 'Solicitud cancelada y habitación liberada' });
});

// ---------- PAGO SIMULADO (HU-07) ----------
// body: { medio: 'PSE'|'Tarjeta'|'Nequi', simular: 'aprobado'|'rechazado' }
router.post('/:id/pagar', requiereRol('estudiante'), async (req, res) => {
  const r = await db.prepare(`SELECT r.*, h.pension_id FROM reservas r
                              JOIN habitaciones h ON h.id = r.habitacion_id
                              WHERE r.id=? AND r.estudiante_id=?`).get(+req.params.id, req.session.usuario.id);
  if (!r) return res.status(404).json({ error: 'Reserva no encontrada' });
  if (r.estado !== 'Pendiente de pago')
    return res.status(409).json({ error: `La reserva está en estado "${r.estado}"` });

  const { medio = 'PSE', simular = 'aprobado' } = req.body;
  // Esc. 2: pago rechazado → se permite reintentar sin perder la solicitud
  if (simular === 'rechazado') {
    await db.prepare(`INSERT INTO pagos (reserva_id,valor,medio,estado) VALUES (?,?,?,'Rechazado')`)
      .run(r.id, r.valor_total, medio);
    return res.status(402).json({ error: 'Transacción rechazada por la entidad. Intente con otro medio de pago.' });
  }

  const consecutivo = 'UP-' + String(r.id).padStart(5, '0') + '-' + Date.now().toString().slice(-5);
  const pension = await db.prepare('SELECT * FROM pensiones WHERE id=?').get(r.pension_id);
  await db.transaction(async (tx) => {
    await tx.prepare(`INSERT INTO pagos (reserva_id,valor,medio,estado,consecutivo) VALUES (?,?,?,'Aprobado',?)`)
      .run(r.id, r.valor_total, medio, consecutivo);
    await tx.prepare(`UPDATE reservas SET estado='Pagada',
                      responder_antes = datetime('now','-5 hours','+48 hours') WHERE id=?`).run(r.id);
    await tx.prepare(`UPDATE habitaciones SET estado='Ocupada' WHERE id=?`).run(r.habitacion_id);
    await notificar(tx, pension.propietario_id, `Nueva solicitud pagada #${r.id} para "${pension.nombre}". Tiene 48 horas para responder.`);
    await notificar(tx, r.estudiante_id, `Pago aprobado (${consecutivo}). En el prototipo, el correo de confirmación se registra como notificación.`);
  });
  await avisarTodos([
    [pension.propietario_id, 'unipension_solicitud_nueva', [r.id, pension.nombre]],
    [r.estudiante_id, 'unipension_pago_aprobado', [r.id, pension.nombre, consecutivo]],
  ]);
  res.json({ mensaje: 'Pago aprobado. Reserva pagada, pendiente de aceptación del propietario.', consecutivo });
});

// ---------- COMPROBANTE PDF (HU-08) ----------
router.get('/:id/comprobante', requiereSesion, async (req, res) => {
  const datos = await db.prepare(`
    SELECT r.id AS reserva_id, r.estudiante_id, r.fecha_ingreso, r.meses, r.valor_total,
           pg.consecutivo, pg.medio, pg.creado_en AS fecha_pago, pg.estado AS estado_pago,
           u.nombre AS estudiante, u.correo,
           pe.nombre AS pension, pe.direccion, pe.barrio, pe.propietario_id, pr.nombre AS propietario
    FROM reservas r
    JOIN pagos pg       ON pg.reserva_id = r.id AND pg.estado IN ('Aprobado','Revertido')
    JOIN usuarios u     ON u.id = r.estudiante_id
    JOIN habitaciones h ON h.id = r.habitacion_id
    JOIN pensiones pe   ON pe.id = h.pension_id
    JOIN usuarios pr    ON pr.id = pe.propietario_id
    WHERE r.id = ?`).get(+req.params.id);
  if (!datos) return res.status(404).json({ error: 'No existe comprobante para esta reserva' });

  const { rol, id } = req.session.usuario;
  if (rol === 'estudiante' && datos.estudiante_id !== id)
    return res.status(403).json({ error: 'Solo puede descargar sus propios comprobantes' }); // RNF-06
  if (rol === 'propietario' && datos.propietario_id !== id)
    return res.status(403).json({ error: 'Solo puede descargar comprobantes de sus pensiones' }); // RNF-06

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=comprobante_${datos.consecutivo}.pdf`);
  generarComprobantePDF(datos, res);
});

// ---------- BANDEJA DEL PROPIETARIO (HU-09) ----------
router.get('/solicitudes', requiereRol('propietario'), async (req, res) => {
  res.json(await db.prepare(`
    SELECT r.*, h.codigo, h.tipo, p.nombre AS pension, u.nombre AS estudiante, u.telefono, u.correo
    FROM reservas r
    JOIN habitaciones h ON h.id = r.habitacion_id
    JOIN pensiones p    ON p.id = h.pension_id
    JOIN usuarios u     ON u.id = r.estudiante_id
    WHERE p.propietario_id = ? AND r.estado IN ('Pagada','Confirmada','Rechazada')
    ORDER BY r.creado_en DESC`).all(req.session.usuario.id));
});

router.post('/:id/responder', requiereRol('propietario'), async (req, res) => {
  const { decision, motivo } = req.body; // 'aceptar' | 'rechazar'
  const r = await db.prepare(`
    SELECT r.*, p.propietario_id, p.nombre AS pension FROM reservas r
    JOIN habitaciones h ON h.id = r.habitacion_id
    JOIN pensiones p    ON p.id = h.pension_id WHERE r.id = ?`).get(+req.params.id);
  if (!r || r.propietario_id !== req.session.usuario.id)
    return res.status(404).json({ error: 'Solicitud no encontrada' });
  if (r.estado !== 'Pagada') return res.status(409).json({ error: `La solicitud está en estado "${r.estado}"` });

  if (decision === 'aceptar') {
    await db.transaction(async (tx) => {
      await tx.prepare(`UPDATE reservas SET estado='Confirmada' WHERE id=?`).run(r.id);
      await notificar(tx, r.estudiante_id, `¡Reserva #${r.id} aceptada en "${r.pension}"! El propietario se pondrá en contacto para coordinar el ingreso.`);
    });
    await avisarTodos([[r.estudiante_id, 'unipension_reserva_aceptada', [r.id, r.pension]]]);
    return res.json({ mensaje: 'Reserva confirmada y estudiante notificado' });
  }
  if (decision === 'rechazar') {
    if (!motivo) return res.status(400).json({ error: 'Debe indicar el motivo del rechazo' });
    await db.transaction(async (tx) => {
      await tx.prepare(`UPDATE reservas SET estado='Rechazada' WHERE id=?`).run(r.id);
      await tx.prepare(`UPDATE habitaciones SET estado='Libre' WHERE id=?`).run(r.habitacion_id);
      await tx.prepare(`UPDATE pagos SET estado='Revertido' WHERE reserva_id=? AND estado='Aprobado'`).run(r.id);
      await notificar(tx, r.estudiante_id, `Reserva #${r.id} rechazada. Motivo: ${motivo}. El pago será revertido.`);
    });
    await avisarTodos([[r.estudiante_id, 'unipension_reserva_rechazada', [r.id, r.pension, motivo]]]);
    return res.json({ mensaje: 'Solicitud rechazada, cupo liberado y pago revertido' });
  }
  res.status(400).json({ error: 'Decisión no válida' });
});

// ---------- HISTORIAL DEL ESTUDIANTE (HU-11) ----------
router.get('/mias', requiereRol('estudiante'), async (req, res) => {
  res.json(await db.prepare(`
    SELECT r.*, h.codigo, h.tipo, p.nombre AS pension, p.barrio, pg.consecutivo
    FROM reservas r
    JOIN habitaciones h ON h.id = r.habitacion_id
    JOIN pensiones p    ON p.id = h.pension_id
    LEFT JOIN pagos pg  ON pg.reserva_id = r.id AND pg.estado='Aprobado'
    WHERE r.estudiante_id = ?
    ORDER BY r.creado_en DESC`).all(req.session.usuario.id)); // RNF-06: solo sus datos
});

// Finalizar estadía (habilita la reseña — apoyo para demo de HU-10)
router.post('/:id/finalizar', requiereRol('estudiante'), async (req, res) => {
  const r = await db.prepare(`SELECT * FROM reservas WHERE id=? AND estudiante_id=? AND estado='Confirmada'`)
    .get(+req.params.id, req.session.usuario.id);
  if (!r) return res.status(404).json({ error: 'Reserva confirmada no encontrada' });
  await db.transaction(async (tx) => {
    await tx.prepare(`UPDATE reservas SET estado='Finalizada' WHERE id=?`).run(r.id);
    await tx.prepare(`UPDATE habitaciones SET estado='Libre' WHERE id=?`).run(r.habitacion_id);
  });
  res.json({ mensaje: 'Estadía finalizada. Ya puede calificar la pensión.' });
});

// ---------- NOTIFICACIONES (RF-15) ----------
router.get('/notificaciones', requiereSesion, async (req, res) => {
  res.json(await db.prepare(`SELECT * FROM notificaciones WHERE usuario_id=? ORDER BY creado_en DESC, id DESC LIMIT 20`)
    .all(req.session.usuario.id));
});

module.exports = router;
