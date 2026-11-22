// =============================================================
// Vencimientos de reservas (HU-07 esc. 3 y HU-09 esc. 3)
// - 30 min sin pagar: la reserva se cancela y la habitación vuelve a estar Libre.
// - 48 h sin respuesta del propietario: se cancela, se libera la habitación y se revierte el pago.
//
// No hay un proceso programado (en Vercel no corre nada entre peticiones): los vencimientos se
// aplican antes de cualquier consulta que muestre disponibilidad (catálogo, ficha, inicio del
// propietario, panel del administrador y reservas), así los cupos siempre están al día.
// =============================================================
const db = require('../db');
const { AHORA } = db;

async function liberarVencidas() {
  // Consulta previa sin transacción: casi siempre no hay nada que liberar (un solo viaje a la base)
  const hay = await db.prepare(`SELECT 1 FROM reservas
    WHERE (estado = 'Pendiente de pago' AND expira_en < ${AHORA})
       OR (estado = 'Pagada' AND responder_antes < ${AHORA}) LIMIT 1`).get();
  if (!hay) return;
  await db.transaction(async (tx) => {
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
      await tx.prepare('INSERT INTO notificaciones (usuario_id,mensaje) VALUES (?,?)').run(r.estudiante_id,
        `Su solicitud #${r.id} fue cancelada por falta de respuesta del propietario (48 h). El pago será revertido.`);
    }
  });
}

// Middleware para los routers que muestran o modifican disponibilidad
const conVencimientosAlDia = async (_req, _res, next) => { await liberarVencidas(); next(); };

module.exports = { liberarVencidas, conVencimientosAlDia };
