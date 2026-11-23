// =============================================================
// Lógica de negocio compartida del módulo de pensiones
// - Cupos = habitaciones en estado Libre; capacidad = total de habitaciones.
// - Las habitaciones con una reserva vigente quedan "bloqueadas" para la
//   edición manual de cupos (no se pueden liberar ni eliminar).
// Responsables: Desarrollador Backend + Administrador DB
// =============================================================
const db = require('../db');
const v = require('./validacion');
const { SERVICIOS, normalizar } = v;
const { barrioDeLista } = require('./barrios');

const ESTADOS_RESERVA_VIGENTE = `('Pendiente de pago','Pagada','Confirmada')`;

// Distancia aproximada en km entre dos puntos (fórmula de Haversine) — HU-05
function distanciaKm(lat1, lng1, lat2, lng2) {
  const R = 6371, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

// Resumen de ocupación de una pensión. `cx` es la conexión: db o una transacción en curso.
async function ocupacion(pensionId, cx = db) {
  const filas = await cx.prepare(`SELECT h.id, h.estado,
      EXISTS (SELECT 1 FROM reservas r WHERE r.habitacion_id = h.id AND r.estado IN ${ESTADOS_RESERVA_VIGENTE}) AS con_reserva
    FROM habitaciones h WHERE h.pension_id = ? ORDER BY h.id`).all(pensionId);
  const cupos = filas.filter((h) => h.estado === 'Libre').length;
  const conReserva = filas.filter((h) => h.con_reserva).length;
  return { capacidad: filas.length, cupos, con_reserva: conReserva, max_cupos: filas.length - conReserva, filas };
}

// Fija los cupos disponibles marcando habitaciones Libre/Ocupada (sin tocar las que tienen reserva vigente)
async function fijarCupos(pensionId, cupos, cx = db) {
  const o = await ocupacion(pensionId, cx);
  if (!Number.isInteger(cupos) || cupos < 0 || cupos > o.max_cupos)
    throw Object.assign(new Error(o.con_reserva
      ? `Escribe un número entero entre 0 y ${o.max_cupos}: ${o.con_reserva} habitación(es) tienen reservas vigentes.`
      : `Escribe un número entero entre 0 y ${o.capacidad}.`), { status: 400 });
  let restantes = cupos;
  for (const h of o.filas.filter((f) => !f.con_reserva)) {
    await cx.prepare('UPDATE habitaciones SET estado = ? WHERE id = ?').run(restantes > 0 ? 'Libre' : 'Ocupada', h.id);
    restantes--;
  }
}

// Ajusta la cantidad de habitaciones a la capacidad pedida y actualiza tipo y tarifa
async function sincronizarHabitaciones(pensionId, { capacidad, tipo, tarifa }, cx = db) {
  const o = await ocupacion(pensionId, cx);
  const tipoHab = tipo === 'Compartida' ? 'compartida' : 'individual';
  if (capacidad > o.capacidad) {
    for (let k = o.capacidad + 1; k <= capacidad; k++)
      await cx.prepare(`INSERT INTO habitaciones (pension_id,codigo,tipo,tarifa,estado) VALUES (?,?,?,?, 'Ocupada')`)
        .run(pensionId, `H${k}`, tipoHab, tarifa);
  } else if (capacidad < o.capacidad) {
    // Solo se eliminan habitaciones que nunca han tenido reservas (preserva la trazabilidad)
    const eliminables = await cx.prepare(`SELECT h.id FROM habitaciones h WHERE h.pension_id = ?
      AND NOT EXISTS (SELECT 1 FROM reservas r WHERE r.habitacion_id = h.id) ORDER BY h.id DESC`).all(pensionId);
    const sobran = o.capacidad - capacidad;
    if (eliminables.length < sobran)
      throw Object.assign(new Error('No es posible reducir la capacidad: algunas habitaciones tienen historial de reservas.'), { status: 409 });
    for (const h of eliminables.slice(0, sobran)) await cx.prepare('DELETE FROM habitaciones WHERE id = ?').run(h.id);
  }
  // Tarifa: en pensiones mixtas la habitación compartida conserva el 70 % de la tarifa
  if (tipo === 'Mixta') {
    await cx.prepare(`UPDATE habitaciones SET tarifa = CASE tipo WHEN 'compartida' THEN ? ELSE ? END WHERE pension_id = ?`)
      .run(Math.round(tarifa * 0.7), tarifa, pensionId);
  } else {
    await cx.prepare('UPDATE habitaciones SET tarifa = ?, tipo = ? WHERE pension_id = ?').run(tarifa, tipoHab, pensionId);
  }
}

// Validación de la publicación (pasos 1, 2 y 3 del editor). `anterior` (al editar) evita bloquear
// por reglas nuevas los campos que el propietario no cambió (dirección, barrio y ubicación).
function validarPublicacion(b, anterior = null) {
  const e = {};
  const cambio = (campo) => !anterior || String(b[campo] ?? '').trim() !== String(anterior[campo] ?? '').trim();
  if (!v.textoValido(b.nombre, 5, 80)) e.nombre = 'El título debe tener entre 5 y 80 caracteres, sin etiquetas.';
  if (!v.textoValido(b.descripcion, 20, 1500)) e.descripcion = 'Describe las habitaciones y condiciones (20 a 1500 caracteres).';
  if (cambio('direccion') && !v.direccionValida(b.direccion))
    e.direccion = 'Escribe la dirección con el formato de Sincelejo, por ejemplo «Cra 21 # 25-14» o «Mz 3 Lt 5».';
  if (cambio('barrio')) {
    const oficial = barrioDeLista(b.barrio);
    if (oficial) b.barrio = oficial;  // corrige mayúsculas y tildes
    else if (!v.RE_BARRIO_LIBRE.test(String(b.barrio || '').trim())) e.barrio = 'Selecciona el barrio de la lista o escribe uno válido (3 a 40 letras).';
  }
  const lat = Number(b.lat), lng = Number(b.lng);
  const ubicacionCambio = !anterior || lat !== anterior.lat || lng !== anterior.lng;
  if (b.lat === '' || b.lat == null || !Number.isFinite(lat) || b.lng === '' || b.lng == null || !Number.isFinite(lng))
    e.lat = 'Introduce latitud y longitud válidas.';
  else if (ubicacionCambio && !v.enSincelejo(lat, lng)) e.lat = 'La ubicación debe estar dentro de Sincelejo. Marca el punto en el mapa.';
  const tarifa = Number(b.tarifa_mensual);
  if (!Number.isInteger(tarifa) || tarifa < v.LIMITES.tarifaMin || tarifa > v.LIMITES.tarifaMax)
    e.tarifa_mensual = `El precio mensual debe ser un valor entero entre $${v.LIMITES.tarifaMin.toLocaleString('es-CO')} y $${v.LIMITES.tarifaMax.toLocaleString('es-CO')}.`;
  const deposito = Number(b.deposito || 0);
  if (!Number.isInteger(deposito) || deposito < 0 || (Number.isFinite(tarifa) && deposito > tarifa * 2))
    e.deposito = 'El depósito debe ser un valor entero entre 0 y dos meses de arriendo.';
  if (!['Individual', 'Compartida', 'Mixta'].includes(b.tipo_habitacion)) e.tipo_habitacion = 'Selecciona el tipo de habitación.';
  const cap = Number(b.capacidad), cupos = Number(b.cupos);
  if (!Number.isInteger(cap) || cap < 1 || cap > v.LIMITES.capacidadMax) e.capacidad = `La capacidad debe ser un entero entre 1 y ${v.LIMITES.capacidadMax}.`;
  if (!Number.isInteger(cupos) || cupos < 0 || cupos > cap) e.cupos = 'Los cupos deben ser enteros entre cero y la capacidad total.';
  if (!v.textoValido(b.reglas, 10, 800)) e.reglas = 'Indica las reglas de convivencia (10 a 800 caracteres).';
  if (b.costos_adicionales && !v.textoValido(b.costos_adicionales, 0, 200)) e.costos_adicionales = 'Máximo 200 caracteres, sin etiquetas.';
  const servicios = Array.isArray(b.servicios) ? b.servicios : String(b.servicios || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (servicios.some((x) => !SERVICIOS.includes(x))) e.servicios = 'Hay servicios que no están en la lista.';
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
