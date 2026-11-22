// =============================================================
// Módulo de pensiones: catálogo, ficha, publicación en 3 pasos, edición,
// cupos, contacto por WhatsApp, reportes y borradores.
// (HU-01, HU-02, HU-03, HU-04, HU-05 → RF-02 a RF-07)
// Responsable: Desarrollador Backend
// =============================================================
const express = require('express');
const db = require('../db');
const { requiereRol } = require('../middleware/auth');
const P = require('../utils/pensiones');
const { normalizarCelular } = require('../utils/validacion');
const router = express.Router();
const { AHORA } = db;

const MOTIVOS_REPORTE = ['Información desactualizada', 'Precio o condiciones incorrectas', 'Sin cupos disponibles',
  'Ubicación incorrecta', 'Contenido engañoso', 'Problema de seguridad', 'Otro motivo',
  // valores de la versión anterior, aceptados por compatibilidad
  'Precio incorrecto', 'Disponibilidad incorrecta', 'Otro'];

// Atrapa los errores con status lanzados por los helpers
const manejar = (fn) => async (req, res) => {
  try { return await fn(req, res); } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  }
};

// ---------- CATÁLOGO PÚBLICO (HU-04) ----------
// GET /api/pensiones?q=&barrio=&precio_min=&precio_max=&tipo=&universidad_id=&dist_max=&servicios=a,b&orden=
router.get('/', async (req, res) => {
  const { q, barrio, precio_min, precio_max, tipo, universidad_id, dist_max, servicios, orden } = req.query;
  if (precio_min && precio_max && +precio_min > +precio_max)
    return res.status(400).json({ error: 'El rango de precios debe ser positivo y el mínimo no puede superar el máximo.' });
  let sql = `
    SELECT p.id, p.nombre, p.barrio, p.direccion, p.descripcion, p.servicios, p.tarifa_mensual, p.deposito, p.lat, p.lng,
           p.tipo_habitacion, p.instituciones, p.destacado, p.creado_en,
           (SELECT ROUND(AVG(estrellas),1) FROM resenas r WHERE r.pension_id = p.id AND r.estado='Publicada') AS calificacion,
           (SELECT COUNT(*) FROM habitaciones h WHERE h.pension_id = p.id AND h.estado='Libre'
              AND (? IS NULL OR h.tipo = ?)) AS habitaciones_libres,
           (SELECT COUNT(*) FROM habitaciones h WHERE h.pension_id = p.id) AS capacidad,
           COALESCE(p.miniatura, (SELECT url FROM fotos f WHERE f.pension_id = p.id ORDER BY f.id LIMIT 1)) AS foto
    FROM pensiones p
    WHERE p.estado = 'Verificada'`;
  const params = [tipo || null, tipo || null];
  if (barrio)     { sql += ' AND p.barrio = ?';          params.push(barrio); }
  if (precio_min) { sql += ' AND p.tarifa_mensual >= ?'; params.push(+precio_min); }
  if (precio_max) { sql += ' AND p.tarifa_mensual <= ?'; params.push(+precio_max); }

  let lista = (await db.prepare(sql).all(...params)).filter((p) => p.habitaciones_libres > 0)
    .map((p) => ({ ...p, cupos: p.habitaciones_libres, destacado: !!p.destacado }));

  // Búsqueda libre sin distinguir tildes: todas las palabras deben aparecer
  const palabras = P.normalizar(q).split(/\s+/).filter(Boolean);
  if (palabras.length) {
    lista = lista.filter((p) => {
      const texto = P.normalizar([p.nombre, p.descripcion, p.barrio, p.direccion, p.tipo_habitacion, p.servicios, p.instituciones].join(' '));
      return palabras.every((w) => texto.includes(w));
    });
  }
  // Servicios: deben cumplirse todos los seleccionados
  const pedidos = String(servicios || '').split(',').map(P.normalizar).filter(Boolean);
  if (pedidos.length) {
    lista = lista.filter((p) => {
      const tiene = P.listaServicios(p.servicios).map(P.normalizar);
      return pedidos.every((s) => tiene.includes(s));
    });
  }
  // Distancia a la universidad seleccionada
  let uni = null;
  if (universidad_id) {
    uni = await db.prepare('SELECT * FROM universidades WHERE id = ?').get(+universidad_id);
    if (uni) {
      lista = lista.map((p) => ({ ...p, distancia_km: p.lat != null ? P.distanciaKm(p.lat, p.lng, uni.lat, uni.lng) : null }));
      if (dist_max) lista = lista.filter((p) => p.distancia_km !== null && p.distancia_km <= +dist_max);
    }
  }
  // Orden: destacados primero (plan Destacado) y luego el criterio elegido
  const criterio = {
    precio_asc: (a, b) => a.tarifa_mensual - b.tarifa_mensual,
    precio_desc: (a, b) => b.tarifa_mensual - a.tarifa_mensual,
    calificacion: (a, b) => (b.calificacion ?? 0) - (a.calificacion ?? 0),
    cercania: (a, b) => (a.distancia_km ?? 99) - (b.distancia_km ?? 99),
    recientes: (a, b) => String(b.creado_en).localeCompare(String(a.creado_en)) || b.id - a.id,
  }[orden] || (uni ? (a, b) => (a.distancia_km ?? 99) - (b.distancia_km ?? 99)
                   : (a, b) => String(b.creado_en).localeCompare(String(a.creado_en)) || b.id - a.id);
  lista.sort((a, b) => Number(b.destacado) - Number(a.destacado) || criterio(a, b));
  res.json(lista); // Si está vacío, el frontend muestra "Sin resultados…" (criterio HU-04 esc. 3)
});

// GET /api/pensiones/barrios  → opciones del filtro
router.get('/barrios', async (_req, res) => {
  res.json(await db.prepare(`SELECT DISTINCT barrio FROM pensiones WHERE estado='Verificada' ORDER BY barrio`).all());
});

// GET /api/pensiones/universidades
router.get('/universidades', async (_req, res) => res.json(await db.prepare('SELECT * FROM universidades ORDER BY id').all()));

// GET /api/pensiones/servicios → servicios que se pueden filtrar
router.get('/servicios', (_req, res) => res.json(P.SERVICIOS));

// GET /api/pensiones/motivos-reporte
router.get('/motivos-reporte', (_req, res) => res.json(MOTIVOS_REPORTE.slice(0, 7)));

// ---------- BORRADOR DEL EDITOR (autoguardado) ----------
router.get('/borrador', requiereRol('propietario'), async (req, res) => {
  const b = await db.prepare('SELECT datos, actualizado_en FROM borradores WHERE usuario_id = ?').get(req.session.usuario.id);
  res.json(b ? { ...JSON.parse(b.datos), _actualizado_en: b.actualizado_en } : null);
});
router.put('/borrador', requiereRol('propietario'), async (req, res) => {
  const datos = JSON.stringify(req.body || {});
  if (datos.length > 4_000_000) return res.status(413).json({ error: 'El borrador es demasiado grande.' });
  await db.prepare(`INSERT INTO borradores (usuario_id, datos, actualizado_en) VALUES (?,?,${AHORA})
              ON CONFLICT(usuario_id) DO UPDATE SET datos = excluded.datos, actualizado_en = excluded.actualizado_en`)
    .run(req.session.usuario.id, datos);
  res.json({ mensaje: 'Borrador guardado' });
});
router.delete('/borrador', requiereRol('propietario'), async (req, res) => {
  await db.prepare('DELETE FROM borradores WHERE usuario_id = ?').run(req.session.usuario.id);
  res.json({ mensaje: 'Borrador descartado' });
});

// Agrega cupos, capacidad y visibilidad a una lista de pensiones (consultas en paralelo)
const conOcupacion = (lista, extra = () => ({})) => Promise.all(lista.map(async (p) => {
  const o = await P.ocupacion(p.id);
  return { ...p, destacado: !!p.destacado, cupos: o.cupos, capacidad: o.capacidad, visible: P.visible(p, o.cupos), ...extra(o) };
}));

// GET /api/pensiones/mias → publicaciones del propietario en sesión
router.get('/mias', requiereRol('propietario'), async (req, res) => {
  const lista = await db.prepare(`SELECT p.id, p.nombre, p.barrio, p.direccion, p.tarifa_mensual, p.estado, p.tipo_habitacion,
      p.destacado, p.motivo_rechazo, p.creado_en,
      COALESCE(p.miniatura, (SELECT url FROM fotos f WHERE f.pension_id = p.id ORDER BY f.id LIMIT 1)) AS foto,
      (SELECT COUNT(*) FROM contactos c WHERE c.pension_id = p.id) AS contactos
    FROM pensiones p WHERE p.propietario_id = ? ORDER BY p.creado_en DESC, p.id DESC`).all(req.session.usuario.id);
  res.json(await conOcupacion(lista, (o) => ({ max_cupos: o.max_cupos })));
});

// ---------- VERIFICACIÓN DEL ADMINISTRADOR (HU-03) ----------
// GET /api/pensiones/pendientes?estado=Pendiente|Verificada|Rechazada|Suspendida|destacados|todas
router.get('/pendientes', requiereRol('administrador'), async (req, res) => {
  const { estado } = req.query;
  let sql = `SELECT p.id, p.nombre, p.barrio, p.direccion, p.tarifa_mensual, p.estado, p.tipo_habitacion, p.destacado,
      p.motivo_rechazo, p.creado_en, u.nombre AS propietario,
      COALESCE(p.miniatura, (SELECT url FROM fotos f WHERE f.pension_id = p.id ORDER BY f.id LIMIT 1)) AS foto,
      (SELECT COUNT(*) FROM reportes_pensiones r WHERE r.pension_id = p.id AND r.estado = 'Pendiente') AS reportes_activos
    FROM pensiones p JOIN usuarios u ON u.id = p.propietario_id`;
  const params = [];
  if (['Pendiente', 'Verificada', 'Rechazada', 'Suspendida'].includes(estado)) { sql += ' WHERE p.estado = ?'; params.push(estado); }
  else if (estado === 'destacados') sql += ' WHERE p.destacado = 1';
  sql += ` ORDER BY CASE p.estado WHEN 'Pendiente' THEN 0 ELSE 1 END, p.creado_en DESC`;
  res.json(await conOcupacion(await db.prepare(sql).all(...params)));
});

// Cambio de estado clásico (se conserva por compatibilidad; el panel nuevo usa /api/admin/pensiones/:id/moderar)
router.patch('/:id/estado', requiereRol('administrador'), async (req, res) => {
  const { estado, motivo } = req.body; // Verificada | Rechazada | Suspendida
  if (!['Verificada', 'Rechazada', 'Suspendida'].includes(estado))
    return res.status(400).json({ error: 'Estado no válido' });
  if (['Rechazada', 'Suspendida'].includes(estado) && !motivo)
    return res.status(400).json({ error: 'Debe indicar el motivo' });
  const p = await db.prepare('SELECT * FROM pensiones WHERE id = ?').get(+req.params.id);
  if (!p) return res.status(404).json({ error: 'Pensión no encontrada' });
  const vigentes = (await db.prepare(`SELECT COUNT(*) AS n FROM reservas r JOIN habitaciones h ON h.id = r.habitacion_id
    WHERE h.pension_id = ? AND r.estado IN ('Pagada','Confirmada')`).get(p.id)).n;
  await db.transaction(async (tx) => {
    await tx.prepare(`UPDATE pensiones SET estado = ?, motivo_rechazo = ?, actualizado_en = ${AHORA} WHERE id = ?`)
      .run(estado, estado === 'Rechazada' ? motivo : null, p.id);
    await tx.prepare(`INSERT INTO bitacora_verificaciones (pension_id,admin_id,accion,motivo) VALUES (?,?,?,?)`)
      .run(p.id, req.session.usuario.id, estado, motivo || null);
    await tx.prepare('INSERT INTO notificaciones (usuario_id,mensaje) VALUES (?,?)')
      .run(p.propietario_id, `Su pensión "${p.nombre}" cambió a estado ${estado}${motivo ? '. Motivo: ' + motivo : ''}`);
  });
  res.json({
    mensaje: `Estado actualizado a ${estado}`,
    advertencia: estado === 'Suspendida' && vigentes > 0
      ? `La pensión tiene ${vigentes} reserva(s) vigente(s): se conservan hasta su finalización.` : null,
  });
});

// ---------- FICHA DETALLADA (HU-05) ----------
router.get('/:id', async (req, res, next) => {
  if (!/^\d+$/.test(req.params.id)) return next();
  const p = await db.prepare('SELECT * FROM pensiones WHERE id = ?').get(+req.params.id);
  const u = req.session.usuario;
  // Solo las verificadas son públicas; el propietario y el administrador pueden revisar las demás
  if (!p || (p.estado !== 'Verificada' && !(u && (u.rol === 'administrador' || u.id === p.propietario_id))))
    return res.status(404).json({ error: 'Pensión no encontrada' });
  // Consultas independientes en paralelo (en Turso cada una es un viaje de red)
  const [o, dueno, fotos, habitaciones, calificacion, resenas, universidades] = await Promise.all([
    P.ocupacion(p.id),
    db.prepare('SELECT id, nombre, relacion, bio, foto, telefono, whatsapp_habilitado FROM usuarios WHERE id = ?').get(p.propietario_id),
    db.prepare('SELECT url FROM fotos WHERE pension_id = ? ORDER BY id').all(p.id),
    db.prepare('SELECT id, codigo, tipo, tarifa, estado FROM habitaciones WHERE pension_id = ? ORDER BY id').all(p.id),
    db.prepare(`SELECT ROUND(AVG(estrellas),1) AS c FROM resenas WHERE pension_id = ? AND estado='Publicada'`).get(p.id),
    db.prepare(`SELECT r.id, r.estrellas, r.comentario, r.creado_en, u.nombre FROM resenas r
                JOIN usuarios u ON u.id = r.estudiante_id
                WHERE r.pension_id = ? AND r.estado='Publicada' ORDER BY r.creado_en DESC`).all(p.id),
    db.prepare('SELECT * FROM universidades ORDER BY id').all(),
  ]);
  const respuesta = {
    ...p,
    destacado: !!p.destacado,
    fotos: fotos.map((f) => f.url),
    habitaciones,
    cupos: o.cupos, capacidad: o.capacidad, max_cupos: o.max_cupos,
    disponibilidad: o.cupos > 0 ? 'Disponible' : 'Ocupada',
    visible: P.visible(p, o.cupos),
    calificacion: calificacion.c,
    resenas,
    universidades: universidades
      .map((x) => ({ id: x.id, nombre: x.nombre, distancia_km: p.lat != null ? P.distanciaKm(p.lat, p.lng, x.lat, x.lng) : null })),
    // Perfil público del contacto: sin documento, correo ni teléfono (privacidad del prototipo)
    contacto: dueno ? { nombre: dueno.nombre, relacion: dueno.relacion || 'Propietario', bio: dueno.bio, foto: dueno.foto,
                        whatsapp: !!(dueno.whatsapp_habilitado && normalizarCelular(dueno.telefono)) } : null,
    es_mia: !!(u && u.id === p.propietario_id),
  };
  delete respuesta.miniatura;
  res.json(respuesta);
});

// ---------- CONTACTO POR WHATSAPP ----------
// El estudiante escribe su mensaje en la ficha y se abre SU WhatsApp en el chat del arrendador
// con el texto listo (enlace oficial wa.me). El número del arrendador nunca se publica en la ficha:
// solo viaja en esta respuesta, a un estudiante con sesión, si el arrendador lo autorizó.
const MAX_MENSAJE_CONTACTO = 1000;
const mensajeSugerido = (pension, estudiante) =>
  `Hola, soy ${String(estudiante || '').split(' ')[0] || 'estudiante'}. Vi el anuncio «${pension}» en UniPensión y quisiera más información sobre los cupos disponibles.`;

// POST /api/pensiones/:id/contacto { mensaje? } → registra el contacto y devuelve el enlace de WhatsApp
router.post('/:id/contacto', requiereRol('estudiante'), async (req, res) => {
  const p = await db.prepare(`SELECT p.*, u.nombre AS arrendador, u.telefono, u.whatsapp_habilitado FROM pensiones p
                              JOIN usuarios u ON u.id = p.propietario_id WHERE p.id = ?`).get(+req.params.id);
  if (!p || !P.visible(p, (await P.ocupacion(p.id)).cupos))
    return res.status(409).json({ error: 'La pensión no está disponible para contacto.' });
  const escrito = typeof req.body?.mensaje === 'string' ? req.body.mensaje.trim() : '';
  if (escrito.length > MAX_MENSAJE_CONTACTO)
    return res.status(400).json({ error: `El mensaje no puede superar ${MAX_MENSAJE_CONTACTO} caracteres.`, campos: { mensaje: 'Mensaje demasiado largo.' } });
  // El enlace al anuncio le permite al arrendador saber por cuál de sus pensiones le escriben
  const enlace = `${req.protocol}://${req.get('host')}/pension/${p.id}`;
  const mensaje = `${escrito || mensajeSugerido(p.nombre, req.session.usuario.nombre)}\n\nAnuncio en UniPensión: ${enlace}`;
  const celular = normalizarCelular(p.telefono); // los registros antiguos guardan el número sin +57
  const habilitado = !!(p.whatsapp_habilitado && celular);
  await db.prepare('INSERT INTO contactos (pension_id, estudiante_id, tipo) VALUES (?,?,?)')
    .run(p.id, req.session.usuario.id, habilitado ? 'whatsapp' : 'vista_previa');
  res.json({
    mensaje,
    arrendador: String(p.arrendador || '').split(' ')[0],
    url: habilitado ? `https://wa.me/${celular.slice(1)}?text=${encodeURIComponent(mensaje)}` : null,
  });
});

// ---------- REPORTAR INFORMACIÓN INCORRECTA ----------
router.post('/:id/reportar', requiereRol('estudiante'), async (req, res) => {
  const pensionId = Number(req.params.id);
  const { motivo, detalle = '' } = req.body;
  if (!Number.isInteger(pensionId) || !MOTIVOS_REPORTE.includes(motivo))
    return res.status(400).json({ error: 'Selecciona un motivo válido para el reporte' });
  if (typeof detalle !== 'string' || detalle.length > 1500)
    return res.status(400).json({ error: 'La descripción no puede superar 1500 caracteres' });
  const pension = await db.prepare(`SELECT id, nombre, propietario_id FROM pensiones WHERE id = ? AND estado = 'Verificada'`).get(pensionId);
  if (!pension) return res.status(404).json({ error: 'Pensión verificada no encontrada' });

  let result;
  try {
    result = await db.prepare(`INSERT INTO reportes_pensiones (pension_id,estudiante_id,motivo,detalle) VALUES (?,?,?,?)`)
      .run(pensionId, req.session.usuario.id, motivo, detalle.trim());
  } catch (err) {
    if (db.esDuplicado(err)) return res.status(409).json({ error: 'Ya tienes un reporte activo para esta pensión.' });
    throw err;
  }
  // Tres estudiantes distintos con reportes activos → retiro preventivo del catálogo (Suspendida)
  const distintos = (await db.prepare(`SELECT COUNT(DISTINCT estudiante_id) n FROM reportes_pensiones
    WHERE pension_id = ? AND estado = 'Pendiente'`).get(pensionId)).n;
  let ocultada = false;
  if (distintos >= 3) {
    await db.transaction(async (tx) => {
      await tx.prepare(`UPDATE pensiones SET estado = 'Suspendida', actualizado_en = ${AHORA} WHERE id = ?`).run(pensionId);
      const avisar = (id, mensaje) => tx.prepare('INSERT INTO notificaciones (usuario_id,mensaje) VALUES (?,?)').run(id, mensaje);
      await avisar(pension.propietario_id, `Su pensión "${pension.nombre}" fue retirada preventivamente del catálogo por reportes de estudiantes.`);
      for (const a of await tx.prepare(`SELECT id FROM usuarios WHERE rol = 'administrador'`).all())
        await avisar(a.id, `"${pension.nombre}" se ocultó automáticamente al recibir reportes de ${distintos} estudiantes.`);
    });
    ocultada = true;
  }
  res.status(201).json({ mensaje: 'Tu reporte quedó registrado para moderación.', id: result.lastInsertRowid, ocultada });
});

// ---------- PUBLICAR PENSIÓN (HU-01) — editor de 3 pasos ----------
async function guardarFotos(cx, pensionId, fotos, miniatura) {
  await cx.prepare('DELETE FROM fotos WHERE pension_id = ?').run(pensionId);
  for (const f of fotos) await cx.prepare('INSERT INTO fotos (pension_id,url) VALUES (?,?)').run(pensionId, f);
  const mini = typeof miniatura === 'string' && miniatura.length < 120000 &&
    (miniatura.startsWith('/img/') || /^data:image\/(jpeg|png|webp);base64,/.test(miniatura)) ? miniatura : null;
  await cx.prepare('UPDATE pensiones SET miniatura = ? WHERE id = ?').run(mini, pensionId);
}

router.post('/', requiereRol('propietario'), manejar(async (req, res) => {
  const b = { ...req.body };
  // Compatibilidad con el formulario anterior (lista de habitaciones sin tipo/capacidad/fotos)
  if (Array.isArray(b.habitaciones) && b.capacidad === undefined) {
    b.capacidad = b.habitaciones.length; b.cupos = b.habitaciones.length;
    b.tipo_habitacion = b.tipo_habitacion || 'Individual';
  }
  if (!b.fotos) b.fotos = ['/img/placeholder1.svg'];
  b.capacidad = Number(b.capacidad); b.cupos = Number(b.cupos);
  const errores = P.validarPublicacion(b);
  if (Object.keys(errores).length)
    return res.status(400).json({ error: 'Revisa los campos indicados', campos: errores });
  // Criterio HU-01 esc. 2: dirección duplicada
  if (await db.prepare('SELECT id FROM pensiones WHERE lower(direccion) = lower(?)').get(b.direccion.trim()))
    return res.status(409).json({ error: 'Esta dirección ya se encuentra publicada en la plataforma', campos: { direccion: 'Dirección ya publicada.' } });

  const pid = await db.transaction(async (tx) => {
    const r = await tx.prepare(`INSERT INTO pensiones
      (propietario_id,nombre,direccion,barrio,descripcion,servicios,reglas,tarifa_mensual,deposito,lat,lng,
       tipo_habitacion,costos_adicionales,instituciones,actualizado_en)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,${AHORA})`)
      .run(req.session.usuario.id, b.nombre.trim(), b.direccion.trim(), b.barrio.trim(), b.descripcion.trim(),
           P.serviciosTexto(b.servicios), b.reglas.trim(), +b.tarifa_mensual, +b.deposito || 0, +b.lat, +b.lng,
           b.tipo_habitacion, String(b.costos_adicionales || '').trim() || null,
           (Array.isArray(b.instituciones) ? b.instituciones : []).join(', ') || null);
    const id = r.lastInsertRowid;
    await P.sincronizarHabitaciones(id, { capacidad: b.capacidad, tipo: b.tipo_habitacion, tarifa: +b.tarifa_mensual }, tx);
    await P.fijarCupos(id, b.cupos, tx);
    await guardarFotos(tx, id, b.fotos, b.miniatura);
    await tx.prepare('DELETE FROM borradores WHERE usuario_id = ?').run(req.session.usuario.id);
    return id;
  });
  // Criterio HU-01 esc. 1: queda "Pendiente de verificación"
  res.status(201).json({ mensaje: 'Tu pensión fue enviada a revisión. No será pública hasta su aprobación.', id: pid });
}));

// ---------- EDITAR PENSIÓN (HU-02) ----------
// Cambios comerciales (tarifa, servicios, descripción, reglas, cupos) se reflejan de inmediato (HU-02 esc. 1 y 2).
// Cambios de identidad (título, dirección, barrio, ubicación, fotografías) vuelven a revisión (moderación del prototipo).
router.put('/:id', requiereRol('propietario'), manejar(async (req, res) => {
  const p = await db.prepare('SELECT * FROM pensiones WHERE id = ? AND propietario_id = ?').get(+req.params.id, req.session.usuario.id);
  if (!p) return res.status(404).json({ error: 'Pensión no encontrada o no le pertenece' });
  const o = await P.ocupacion(p.id);
  const fotosActuales = (await db.prepare('SELECT url FROM fotos WHERE pension_id = ? ORDER BY id').all(p.id)).map((f) => f.url);
  // Valores por defecto: los actuales (permite ediciones parciales, como en la versión anterior)
  const b = {
    nombre: p.nombre, descripcion: p.descripcion, direccion: p.direccion, barrio: p.barrio, lat: p.lat, lng: p.lng,
    tarifa_mensual: p.tarifa_mensual, deposito: p.deposito, tipo_habitacion: p.tipo_habitacion, capacidad: o.capacidad,
    cupos: o.cupos, servicios: p.servicios, reglas: p.reglas || 'No registradas', costos_adicionales: p.costos_adicionales,
    instituciones: String(p.instituciones || '').split(',').map((s) => s.trim()).filter(Boolean), fotos: fotosActuales,
    ...Object.fromEntries(Object.entries(req.body).filter(([, v]) => v !== null && v !== undefined)),
  };
  b.capacidad = Number(b.capacidad); b.cupos = Number(b.cupos);
  const errores = P.validarPublicacion(b);
  if (Object.keys(errores).length) return res.status(400).json({ error: 'Revisa los campos indicados', campos: errores });

  // Criterio HU-02 esc. 4: bloqueo de campos críticos con reservas vigentes
  const reservasVigentes = (await db.prepare(`SELECT COUNT(*) AS n FROM reservas r JOIN habitaciones h ON h.id = r.habitacion_id
    WHERE h.pension_id = ? AND r.estado IN ('Pagada','Confirmada')`).get(p.id)).n;
  if (reservasVigentes > 0 && b.direccion.trim() !== p.direccion)
    return res.status(409).json({ error: 'La dirección no puede modificarse mientras existan reservas vigentes', campos: { direccion: 'Bloqueada por reservas vigentes.' } });
  if (b.direccion.trim().toLowerCase() !== p.direccion.toLowerCase() &&
      await db.prepare('SELECT id FROM pensiones WHERE lower(direccion) = lower(?) AND id <> ?').get(b.direccion.trim(), p.id))
    return res.status(409).json({ error: 'Esta dirección ya se encuentra publicada en la plataforma' });

  const cambioIdentidad = b.nombre.trim() !== p.nombre || b.direccion.trim() !== p.direccion || b.barrio.trim() !== p.barrio ||
    +b.lat !== p.lat || +b.lng !== p.lng || JSON.stringify(b.fotos) !== JSON.stringify(fotosActuales);
  // Rechazada → vuelve a revisión al editar; Suspendida solo la restaura el administrador
  const nuevoEstado = p.estado === 'Suspendida' ? 'Suspendida'
    : (p.estado === 'Rechazada' || cambioIdentidad) ? 'Pendiente' : p.estado;

  await db.transaction(async (tx) => {
    await tx.prepare(`UPDATE pensiones SET nombre=?, descripcion=?, direccion=?, barrio=?, lat=?, lng=?, servicios=?, reglas=?,
        tarifa_mensual=?, deposito=?, tipo_habitacion=?, costos_adicionales=?, instituciones=?, estado=?,
        motivo_rechazo = CASE WHEN ? = 'Pendiente' THEN NULL ELSE motivo_rechazo END,
        actualizado_en = ${AHORA} WHERE id = ?`)
      .run(b.nombre.trim(), b.descripcion.trim(), b.direccion.trim(), b.barrio.trim(), +b.lat, +b.lng,
           P.serviciosTexto(b.servicios), b.reglas.trim(), +b.tarifa_mensual, +b.deposito || 0, b.tipo_habitacion,
           String(b.costos_adicionales || '').trim() || null,
           (Array.isArray(b.instituciones) ? b.instituciones : String(b.instituciones || '').split(','))
             .map((s) => String(s).trim()).filter(Boolean).join(', ') || null,
           nuevoEstado, nuevoEstado, p.id);
    await P.sincronizarHabitaciones(p.id, { capacidad: b.capacidad, tipo: b.tipo_habitacion, tarifa: +b.tarifa_mensual }, tx);
    await P.fijarCupos(p.id, b.cupos, tx);
    if (JSON.stringify(b.fotos) !== JSON.stringify(fotosActuales)) await guardarFotos(tx, p.id, b.fotos, b.miniatura);
    await tx.prepare('DELETE FROM borradores WHERE usuario_id = ?').run(req.session.usuario.id);
  });
  res.json({
    mensaje: nuevoEstado === 'Pendiente' && p.estado !== 'Pendiente'
      ? 'Cambios guardados. La pensión volvió a revisión y no será pública hasta su aprobación.'
      : 'Publicación actualizada',
    estado: nuevoEstado,
  });
}));

// ---------- ACTUALIZAR CUPOS (disponibilidad independiente de la moderación) ----------
router.patch('/:id/cupos', requiereRol('propietario'), manejar(async (req, res) => {
  const p = await db.prepare('SELECT id FROM pensiones WHERE id = ? AND propietario_id = ?').get(+req.params.id, req.session.usuario.id);
  if (!p) return res.status(404).json({ error: 'Pensión no encontrada o no le pertenece' });
  await db.transaction((tx) => P.fijarCupos(p.id, Number(req.body.cupos), tx));
  res.json({ mensaje: 'Cupos actualizados. La moderación de la pensión no cambió.', ...(await P.ocupacion(p.id)), filas: undefined });
}));

module.exports = router;
