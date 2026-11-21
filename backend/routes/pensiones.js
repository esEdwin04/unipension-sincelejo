// =============================================================
// Módulo de pensiones: publicación, edición, verificación y catálogo
// (HU-01, HU-02, HU-03, HU-04, HU-05 → RF-02 a RF-07)
// Responsable: Desarrollador Backend
// =============================================================
const express = require('express');
const db = require('../db');
const { requiereRol } = require('../middleware/auth');
const router = express.Router();

// Distancia aproximada en km entre dos puntos (fórmula de Haversine) — HU-05
function distanciaKm(lat1, lng1, lat2, lng2) {
  const R = 6371, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

// ---------- CATÁLOGO PÚBLICO (HU-04) ----------
// GET /api/pensiones?barrio=&precio_min=&precio_max=&tipo=&universidad_id=&dist_max=
router.get('/', (req, res) => {
  const { barrio, precio_min, precio_max, tipo, universidad_id, dist_max } = req.query;
  let sql = `
    SELECT p.*,
           (SELECT ROUND(AVG(estrellas),1) FROM resenas r WHERE r.pension_id = p.id AND r.estado='Publicada') AS calificacion,
           (SELECT COUNT(*) FROM habitaciones h WHERE h.pension_id = p.id AND h.estado='Libre'
              AND (? IS NULL OR h.tipo = ?)) AS habitaciones_libres,
           (SELECT url FROM fotos f WHERE f.pension_id = p.id LIMIT 1) AS foto
    FROM pensiones p
    WHERE p.estado = 'Verificada'`;
  const params = [tipo || null, tipo || null];
  if (barrio)     { sql += ' AND p.barrio = ?';          params.push(barrio); }
  if (precio_min) { sql += ' AND p.tarifa_mensual >= ?'; params.push(+precio_min); }
  if (precio_max) { sql += ' AND p.tarifa_mensual <= ?'; params.push(+precio_max); }
  sql += ' ORDER BY calificacion DESC NULLS LAST, p.creado_en DESC';

  let lista = db.prepare(sql).all(...params).filter(p => p.habitaciones_libres > 0);

  // Filtro por distancia a la universidad seleccionada
  if (universidad_id) {
    const uni = db.prepare('SELECT * FROM universidades WHERE id = ?').get(+universidad_id);
    if (uni) {
      lista = lista.map(p => ({ ...p, distancia_km: p.lat ? distanciaKm(p.lat, p.lng, uni.lat, uni.lng) : null }));
      if (dist_max) lista = lista.filter(p => p.distancia_km !== null && p.distancia_km <= +dist_max);
      lista.sort((a, b) => (a.distancia_km ?? 99) - (b.distancia_km ?? 99));
    }
  }
  res.json(lista); // Si está vacío, el frontend muestra "Sin resultados…" (criterio HU-04 esc. 3)
});

// GET /api/pensiones/barrios  → opciones del filtro
router.get('/barrios', (_req, res) => {
  res.json(db.prepare(`SELECT DISTINCT barrio FROM pensiones WHERE estado='Verificada' ORDER BY barrio`).all());
});

// GET /api/pensiones/universidades
router.get('/universidades', (_req, res) => {
  res.json(db.prepare('SELECT * FROM universidades').all());
});

// ---------- FICHA DETALLADA (HU-05) ----------
router.get('/:id', (req, res, next) => {
  if (!/^\d+$/.test(req.params.id)) return next(); // deja pasar /mias y /pendientes
  const p = db.prepare('SELECT * FROM pensiones WHERE id = ?').get(+req.params.id);
  if (!p) return res.status(404).json({ error: 'Pensión no encontrada' });
  p.fotos = db.prepare('SELECT url FROM fotos WHERE pension_id = ?').all(p.id).map(f => f.url);
  p.habitaciones = db.prepare('SELECT * FROM habitaciones WHERE pension_id = ?').all(p.id);
  p.calificacion = db.prepare(`SELECT ROUND(AVG(estrellas),1) AS c FROM resenas
                               WHERE pension_id = ? AND estado='Publicada'`).get(p.id).c;
  p.resenas = db.prepare(`SELECT r.estrellas, r.comentario, r.creado_en, u.nombre
                          FROM resenas r JOIN usuarios u ON u.id = r.estudiante_id
                          WHERE r.pension_id = ? AND r.estado='Publicada'
                          ORDER BY r.creado_en DESC`).all(p.id);
  p.universidades = db.prepare('SELECT * FROM universidades').all()
    .map(u => ({ nombre: u.nombre, distancia_km: p.lat ? distanciaKm(p.lat, p.lng, u.lat, u.lng) : null }));
  res.json(p);
});

// ---------- PUBLICAR PENSIÓN (HU-01) ----------
router.post('/', requiereRol('propietario'), (req, res) => {
  const { nombre, direccion, barrio, descripcion, servicios, reglas,
          tarifa_mensual, deposito, lat, lng, habitaciones } = req.body;
  // Criterio HU-01 esc. 3: campos obligatorios
  const faltantes = ['nombre','direccion','barrio','tarifa_mensual'].filter(c => !req.body[c]);
  if (faltantes.length) return res.status(400).json({ error: 'Campos obligatorios faltantes', campos: faltantes });
  // Criterio HU-01 esc. 2: dirección duplicada
  if (db.prepare('SELECT id FROM pensiones WHERE direccion = ?').get(direccion))
    return res.status(409).json({ error: 'Esta dirección ya se encuentra publicada en la plataforma' });

  const tx = db.transaction(() => {
    const r = db.prepare(`INSERT INTO pensiones
      (propietario_id,nombre,direccion,barrio,descripcion,servicios,reglas,tarifa_mensual,deposito,lat,lng)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(req.session.usuario.id, nombre, direccion, barrio, descripcion || '', servicios || '',
           reglas || '', +tarifa_mensual, +deposito || 0, lat || null, lng || null);
    const pid = r.lastInsertRowid;
    for (const h of (habitaciones || [{ codigo: 'H1', tipo: 'individual', tarifa: +tarifa_mensual }])) {
      db.prepare('INSERT INTO habitaciones (pension_id,codigo,tipo,tarifa) VALUES (?,?,?,?)')
        .run(pid, h.codigo, h.tipo, +h.tarifa);
    }
    db.prepare('INSERT INTO fotos (pension_id,url) VALUES (?,?)').run(pid, '/img/placeholder1.svg');
    return pid;
  });
  const pid = tx();
  // Criterio HU-01 esc. 1: queda "Pendiente de verificación"
  res.status(201).json({ mensaje: 'Pensión registrada con estado Pendiente de verificación', id: pid });
});

// GET /api/pensiones/mias → publicaciones del propietario en sesión
router.get('/mias', requiereRol('propietario'), (req, res) => {
  res.json(db.prepare('SELECT * FROM pensiones WHERE propietario_id = ? ORDER BY creado_en DESC')
    .all(req.session.usuario.id));
});

// ---------- EDITAR PENSIÓN (HU-02) ----------
router.put('/:id', requiereRol('propietario'), (req, res) => {
  const p = db.prepare('SELECT * FROM pensiones WHERE id = ? AND propietario_id = ?')
    .get(+req.params.id, req.session.usuario.id);
  if (!p) return res.status(404).json({ error: 'Pensión no encontrada o no le pertenece' });

  // Criterio HU-02 esc. 4: bloqueo de campos críticos con reservas vigentes
  const reservasVigentes = db.prepare(`
    SELECT COUNT(*) AS n FROM reservas r JOIN habitaciones h ON h.id = r.habitacion_id
    WHERE h.pension_id = ? AND r.estado IN ('Pagada','Confirmada')`).get(p.id).n;
  if (reservasVigentes > 0 && req.body.direccion && req.body.direccion !== p.direccion)
    return res.status(409).json({ error: 'La dirección no puede modificarse mientras existan reservas vigentes' });

  const { descripcion, servicios, reglas, tarifa_mensual, deposito } = req.body;
  db.prepare(`UPDATE pensiones SET descripcion = COALESCE(?,descripcion),
              servicios = COALESCE(?,servicios), reglas = COALESCE(?,reglas),
              tarifa_mensual = COALESCE(?,tarifa_mensual), deposito = COALESCE(?,deposito)
              WHERE id = ?`)
    .run(descripcion, servicios, reglas, tarifa_mensual, deposito, p.id);
  // Criterio HU-02 esc. 1: la tarifa aplica a nuevas solicitudes; las confirmadas guardan su valor_total
  res.json({ mensaje: 'Publicación actualizada' });
});

// ---------- VERIFICACIÓN DEL ADMINISTRADOR (HU-03) ----------
router.get('/pendientes', requiereRol('administrador'), (_req, res) => {
  res.json(db.prepare(`SELECT p.*, u.nombre AS propietario FROM pensiones p
                       JOIN usuarios u ON u.id = p.propietario_id
                       ORDER BY CASE p.estado WHEN 'Pendiente' THEN 0 ELSE 1 END, p.creado_en DESC`).all());
});

router.patch('/:id/estado', requiereRol('administrador'), (req, res) => {
  const { estado, motivo } = req.body; // Verificada | Rechazada | Suspendida
  if (!['Verificada', 'Rechazada', 'Suspendida'].includes(estado))
    return res.status(400).json({ error: 'Estado no válido' });
  if (['Rechazada', 'Suspendida'].includes(estado) && !motivo)
    return res.status(400).json({ error: 'Debe indicar el motivo' });

  const p = db.prepare('SELECT * FROM pensiones WHERE id = ?').get(+req.params.id);
  if (!p) return res.status(404).json({ error: 'Pensión no encontrada' });

  // Criterio HU-03 esc. 3: alerta si hay reservas en curso al suspender
  const vigentes = db.prepare(`SELECT COUNT(*) AS n FROM reservas r
    JOIN habitaciones h ON h.id = r.habitacion_id
    WHERE h.pension_id = ? AND r.estado IN ('Pagada','Confirmada')`).get(p.id).n;

  const tx = db.transaction(() => {
    db.prepare('UPDATE pensiones SET estado = ? WHERE id = ?').run(estado, p.id);
    db.prepare(`INSERT INTO bitacora_verificaciones (pension_id,admin_id,accion,motivo) VALUES (?,?,?,?)`)
      .run(p.id, req.session.usuario.id, estado, motivo || null);
    db.prepare('INSERT INTO notificaciones (usuario_id,mensaje) VALUES (?,?)')
      .run(p.propietario_id, `Su pensión "${p.nombre}" cambió a estado ${estado}${motivo ? '. Motivo: ' + motivo : ''}`);
  });
  tx();
  res.json({
    mensaje: `Estado actualizado a ${estado}`,
    advertencia: estado === 'Suspendida' && vigentes > 0
      ? `La pensión tiene ${vigentes} reserva(s) vigente(s): se conservan hasta su finalización.` : null
  });
});

module.exports = router;
