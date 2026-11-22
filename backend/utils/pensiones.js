// =============================================================
// Lógica de negocio compartida del módulo de pensiones
// - Cupos = habitaciones en estado Libre; capacidad = total de habitaciones.
// - Las habitaciones con una reserva vigente quedan "bloqueadas" para la
//   edición manual de cupos (no se pueden liberar ni eliminar).
// Responsables: Desarrollador Backend + Administrador DB
// =============================================================
const db = require('../db');
const { SERVICIOS, normalizar } = require('./validacion');

const ESTADOS_RESERVA_VIGENTE = `('Pendiente de pago','Pagada','Confirmada')`;

// Distancia aproximada en km entre dos puntos (fórmula de Haversine) — HU-05
function distanciaKm(lat1, lng1, lat2, lng2) {
  const R = 6371, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

// Resumen de ocupación de una pensión
function ocupacion(pensionId) {
  const filas = db.prepare(`SELECT h.id, h.estado,
      EXISTS (SELECT 1 FROM reservas r WHERE r.habitacion_id = h.id AND r.estado IN ${ESTADOS_RESERVA_VIGENTE}) AS con_reserva
    FROM habitaciones h WHERE h.pension_id = ? ORDER BY h.id`).all(pensionId);
  const cupos = filas.filter((h) => h.estado === 'Libre').length;
  const conReserva = filas.filter((h) => h.con_reserva).length;
  return { capacidad: filas.length, cupos, con_reserva: conReserva, max_cupos: filas.length - conReserva, filas };
}

// Fija los cupos disponibles marcando habitaciones Libre/Ocupada (sin tocar las que tienen reserva vigente)
function fijarCupos(pensionId, cupos) {
  const o = ocupacion(pensionId);
  if (!Number.isInteger(cupos) || cupos < 0 || cupos > o.max_cupos)
    throw Object.assign(new Error(o.con_reserva
      ? `Escribe un número entero entre 0 y ${o.max_cupos}: ${o.con_reserva} habitación(es) tienen reservas vigentes.`
      : `Escribe un número entero entre 0 y ${o.capacidad}.`), { status: 400 });
  let restantes = cupos;
  const upd = db.prepare('UPDATE habitaciones SET estado = ? WHERE id = ?');
  for (const h of o.filas.filter((f) => !f.con_reserva)) {
    upd.run(restantes > 0 ? 'Libre' : 'Ocupada', h.id);
    restantes--;
  }
}

// Ajusta la cantidad de habitaciones a la capacidad pedida y actualiza tipo y tarifa
function sincronizarHabitaciones(pensionId, { capacidad, tipo, tarifa }) {
  const o = ocupacion(pensionId);
  const tipoHab = tipo === 'Compartida' ? 'compartida' : 'individual';
  if (capacidad > o.capacidad) {
    const ins = db.prepare(`INSERT INTO habitaciones (pension_id,codigo,tipo,tarifa,estado) VALUES (?,?,?,?, 'Ocupada')`);
    for (let k = o.capacidad + 1; k <= capacidad; k++) ins.run(pensionId, `H${k}`, tipoHab, tarifa);
  } else if (capacidad < o.capacidad) {
    // Solo se eliminan habitaciones que nunca han tenido reservas (preserva la trazabilidad)
    const eliminables = db.prepare(`SELECT h.id FROM habitaciones h WHERE h.pension_id = ?
      AND NOT EXISTS (SELECT 1 FROM reservas r WHERE r.habitacion_id = h.id) ORDER BY h.id DESC`).all(pensionId);
    const sobran = o.capacidad - capacidad;
    if (eliminables.length < sobran)
      throw Object.assign(new Error('No es posible reducir la capacidad: algunas habitaciones tienen historial de reservas.'), { status: 409 });
    const del = db.prepare('DELETE FROM habitaciones WHERE id = ?');
    eliminables.slice(0, sobran).forEach((h) => del.run(h.id));
  }
  // Tarifa: en pensiones mixtas la habitación compartida conserva el 70 % de la tarifa
  if (tipo === 'Mixta') {
    db.prepare(`UPDATE habitaciones SET tarifa = CASE tipo WHEN 'compartida' THEN ? ELSE ? END WHERE pension_id = ?`)
      .run(Math.round(tarifa * 0.7), tarifa, pensionId);
  } else {
    db.prepare('UPDATE habitaciones SET tarifa = ?, tipo = ? WHERE pension_id = ?').run(tarifa, tipoHab, pensionId);
  }
}

// Validación de la publicación (pasos 1, 2 y 3 del editor del prototipo)
function validarPublicacion(b) {
  const e = {};
  if (!String(b.nombre || '').trim()) e.nombre = 'Escribe el título de la pensión.';
  if (!String(b.descripcion || '').trim()) e.descripcion = 'Describe las habitaciones y condiciones.';
  if (!String(b.direccion || '').trim()) e.direccion = 'Escribe una dirección o referencia general.';
  if (!String(b.barrio || '').trim()) e.barrio = 'Escribe el barrio.';
  const lat = Number(b.lat), lng = Number(b.lng);
  if (b.lat === '' || b.lat == null || !Number.isFinite(lat) || Math.abs(lat) > 90 ||
      b.lng === '' || b.lng == null || !Number.isFinite(lng) || Math.abs(lng) > 180)
    e.lat = 'Introduce latitud y longitud válidas.';
  if (!(Number(b.tarifa_mensual) > 0)) e.tarifa_mensual = 'El precio debe ser mayor que cero.';
  if (!['Individual', 'Compartida', 'Mixta'].includes(b.tipo_habitacion)) e.tipo_habitacion = 'Selecciona el tipo de habitación.';
  const cap = Number(b.capacidad), cupos = Number(b.cupos);
  if (!Number.isInteger(cap) || cap < 1 || cap > 60) e.capacidad = 'La capacidad debe ser un entero mayor que cero.';
  if (!Number.isInteger(cupos) || cupos < 0 || cupos > cap) e.cupos = 'Los cupos deben ser enteros entre cero y la capacidad total.';
  if (!String(b.reglas || '').trim()) e.reglas = 'Indica las reglas de convivencia.';
  const fotos = Array.isArray(b.fotos) ? b.fotos : [];
  if (fotos.length < 1 || fotos.length > 5) e.fotos = 'Añade entre una y cinco fotografías.';
  else if (fotos.some((f) => typeof f !== 'string' || f.length > 700000 ||
           !(f.startsWith('/img/') || /^data:image\/(jpeg|png|webp);base64,/.test(f))))
    e.fotos = 'Cada fotografía debe ser JPG, PNG o WebP y pesar menos de 500 KB tras la compresión.';
  return e;
}

// Lista de servicios a texto (acepta arreglo o texto separado por comas)
const serviciosTexto = (s) => (Array.isArray(s) ? s : String(s || '').split(','))
  .map((x) => x.trim()).filter(Boolean).join(', ');

const listaServicios = (texto) => String(texto || '').split(',').map((s) => s.trim()).filter(Boolean);

// Una pensión es visible en el catálogo si está verificada y tiene cupos
const visible = (p, cupos) => p.estado === 'Verificada' && cupos > 0;

module.exports = {
  distanciaKm, ocupacion, fijarCupos, sincronizarHabitaciones, validarPublicacion,
  serviciosTexto, listaServicios, visible, normalizar, SERVICIOS, ESTADOS_RESERVA_VIGENTE,
};
