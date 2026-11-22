// =============================================================
// Módulo de autenticación y perfil (RF-01, RNF-05, RNF-07)
// Pantallas del prototipo: Bienvenida, Crear cuenta (2 pasos), Iniciar sesión,
// Recuperación, Mi perfil, Editar perfil, Cambiar contraseña, Privacidad.
// Responsable: Desarrollador Backend
// =============================================================
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requiereSesion } = require('../middleware/auth');
const v = require('../utils/validacion');
const router = express.Router();

// Campos que se pueden devolver al propio usuario (nunca clave_hash)
const CAMPOS_PERFIL = `id, nombre, correo, telefono, rol, foto, institucion, programa, nivel, ciudad, zona, bio,
  relacion, documento, whatsapp_habilitado, avisos_whatsapp, consentimiento_version, consentimiento_fecha, creado_en`;

const resumen = (u) => ({ id: u.id, nombre: u.nombre, rol: u.rol });
const perfilDe = async (id) => {
  const u = await db.prepare(`SELECT ${CAMPOS_PERFIL} FROM usuarios WHERE id = ?`).get(id);
  if (u) { u.whatsapp_habilitado = !!u.whatsapp_habilitado; u.avisos_whatsapp = !!u.avisos_whatsapp; }
  return u;
};

// POST /api/auth/registro — Paso 2 del registro (el paso 1 elige el rol)
router.post('/registro', async (req, res) => {
  const { nombre, correo, clave, confirmar, telefono, rol, acepta_datos, institucion, documento, relacion } = req.body;
  const errores = {};
  if (!['estudiante', 'propietario'].includes(rol))
    return res.status(400).json({ error: 'El registro público no permite administradores' });
  if (!nombre || String(nombre).trim().length < 3) errores.nombre = 'Escribe tu nombre completo.';
  if (!v.correoValido(correo)) errores.correo = 'Escribe un correo válido.';
  else if (await db.prepare('SELECT id FROM usuarios WHERE lower(correo) = lower(?)').get(correo.trim()))
    errores.correo = 'Ya existe una cuenta con ese correo.';
  if (!v.claveSegura(clave)) errores.clave = 'Usa al menos 8 caracteres, mayúscula, minúscula y número.';
  if (confirmar !== undefined && confirmar !== clave) errores.confirmar = 'Las contraseñas no coinciden.';
  const celular = telefono ? v.normalizarCelular(telefono) : null;
  if ((rol === 'propietario' || telefono) && !celular)
    errores.telefono = 'Número celular colombiano: 10 dígitos que comiencen por 3.';
  if (rol === 'estudiante' && !institucion) errores.institucion = 'Selecciona tu institución.';
  if (rol === 'propietario' && !v.documentoValido(documento))
    errores.documento = 'No uses un documento real. Escribe un identificador ficticio DEMO-.';
  if (!acepta_datos) errores.acepta_datos = 'Debe autorizar el tratamiento de datos personales (Ley 1581 de 2012).';
  if (Object.keys(errores).length)
    return res.status(400).json({ error: Object.values(errores)[0], campos: errores });

  const r = await db.prepare(`INSERT INTO usuarios (nombre, correo, clave_hash, telefono, rol, acepta_datos, institucion,
      documento, relacion, consentimiento_version, consentimiento_fecha)
      VALUES (?,?,?,?,?,1,?,?,?,?,${db.AHORA})`)
    .run(nombre.trim(), correo.trim().toLowerCase(), bcrypt.hashSync(clave, 10), celular, rol,
         rol === 'estudiante' ? institucion : null, rol === 'propietario' ? documento : null,
         rol === 'propietario' ? (v.RELACIONES.includes(relacion) ? relacion : 'Propietario') : null,
         db.VERSION_POLITICA);
  req.session.usuario = { id: r.lastInsertRowid, nombre: nombre.trim(), rol };
  res.status(201).json({ mensaje: 'Cuenta creada', usuario: req.session.usuario });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { correo, clave } = req.body;
  const u = await db.prepare('SELECT * FROM usuarios WHERE lower(correo) = lower(?)').get(String(correo || '').trim());
  if (!u || !bcrypt.compareSync(clave || '', u.clave_hash))
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  req.session.usuario = resumen(u);
  res.json({ mensaje: 'Sesión iniciada', usuario: req.session.usuario });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ mensaje: 'Sesión cerrada' }));
});

// GET /api/auth/yo → usuario en sesión con los datos que usa la cabecera
router.get('/yo', async (req, res) => {
  if (!req.session.usuario) return res.json({ usuario: null });
  const u = await perfilDe(req.session.usuario.id);
  if (!u) { req.session.destroy(() => {}); return res.json({ usuario: null }); }
  res.json({ usuario: { id: u.id, nombre: u.nombre, rol: u.rol, foto: u.foto, institucion: u.institucion, relacion: u.relacion } });
});

// GET /api/auth/demo → cuentas de demostración para el acceso rápido (solo en modo demo)
router.get('/demo', (_req, res) => {
  if (!v.MODO_DEMO) return res.json([]);
  res.json([
    { nombre: 'Luis Mendoza', rol: 'estudiante', correo: 'estudiante@unipension.co', clave: 'est123' },
    { nombre: 'Laura Montes', rol: 'estudiante', correo: 'estudiante2@unipension.co', clave: 'est123' },
    { nombre: 'Daniel Castro', rol: 'estudiante', correo: 'estudiante3@unipension.co', clave: 'est123' },
    { nombre: 'Carmen Vergara', rol: 'propietario', correo: 'propietaria@unipension.co', clave: 'prop123' },
    { nombre: 'Administrador Plataforma', rol: 'administrador', correo: 'admin@unipension.co', clave: 'admin123' },
  ]);
});

// POST /api/auth/recuperar — la recuperación real requiere un servicio de correo (Nodemailer)
router.post('/recuperar', (req, res) => {
  if (!v.correoValido(req.body.correo)) return res.status(400).json({ error: 'Escribe un correo electrónico válido.' });
  res.status(202).json({
    mensaje: 'No se envió ningún correo ni se modificó la contraseña: la recuperación requiere configurar el servicio de correo del backend.',
    pendiente: true,
  });
});

// ---------- PERFIL ----------
router.get('/perfil', requiereSesion, async (req, res) => res.json(await perfilDe(req.session.usuario.id)));

router.put('/perfil', requiereSesion, async (req, res) => {
  const actual = await perfilDe(req.session.usuario.id);
  const b = req.body;
  const errores = {};
  const nombre = b.nombre !== undefined ? String(b.nombre).trim() : actual.nombre;
  if (nombre.length < 3) errores.nombre = 'Escribe un nombre completo.';
  const correo = b.correo !== undefined ? String(b.correo).trim().toLowerCase() : actual.correo;
  if (!v.correoValido(correo) ||
      await db.prepare('SELECT id FROM usuarios WHERE lower(correo) = ? AND id <> ?').get(correo, actual.id))
    errores.correo = 'Correo no válido o ya registrado.';
  let telefono = actual.telefono;
  if (b.telefono !== undefined) {
    telefono = b.telefono ? v.normalizarCelular(b.telefono) : null;
    if (b.telefono && !telefono) errores.telefono = 'Usa 10 dígitos de celular colombiano; se guardará con +57.';
  }
  if (actual.rol === 'propietario' && !telefono) errores.telefono = 'El propietario debe registrar un WhatsApp válido.';
  const whatsapp = b.whatsapp_habilitado !== undefined ? !!b.whatsapp_habilitado : actual.whatsapp_habilitado;
  if (whatsapp && !telefono) errores.telefono = 'Configura un número válido para habilitar WhatsApp.';
  const avisos = b.avisos_whatsapp !== undefined ? !!b.avisos_whatsapp : actual.avisos_whatsapp;
  if (avisos && !telefono) errores.telefono = 'Registra tu celular para recibir avisos por WhatsApp.';
  if (actual.rol === 'propietario' && b.documento !== undefined && !v.documentoValido(b.documento))
    errores.documento = 'Solo se aceptan documentos ficticios con prefijo DEMO-.';
  if (b.foto && (!/^data:image\/(jpeg|png|webp);base64,/.test(b.foto) || b.foto.length > 400000))
    errores.foto = 'La foto debe ser una imagen JPG, PNG o WebP comprimida.';
  if (Object.keys(errores).length) return res.status(400).json({ error: Object.values(errores)[0], campos: errores });

  const val = (k) => (b[k] !== undefined ? (String(b[k]).trim() || null) : actual[k]);
  await db.prepare(`UPDATE usuarios SET nombre=?, correo=?, telefono=?, foto=?, institucion=?, programa=?, nivel=?, ciudad=?,
      zona=?, bio=?, relacion=?, documento=?, whatsapp_habilitado=?, avisos_whatsapp=? WHERE id=?`)
    .run(nombre, correo, telefono, b.foto !== undefined ? (b.foto || null) : actual.foto,
         val('institucion'), val('programa'), val('nivel'), val('ciudad'), val('zona'),
         actual.rol === 'propietario' ? val('bio') : actual.bio,
         actual.rol === 'propietario' ? val('relacion') : actual.relacion,
         actual.rol === 'propietario' ? val('documento') : actual.documento,
         whatsapp ? 1 : 0, avisos ? 1 : 0, actual.id);
  req.session.usuario.nombre = nombre;
  res.json({ mensaje: 'Cambios guardados.', perfil: await perfilDe(actual.id) });
});

// PUT /api/auth/clave { actual, nueva }
router.put('/clave', requiereSesion, async (req, res) => {
  const { actual, nueva } = req.body;
  const u = await db.prepare('SELECT clave_hash FROM usuarios WHERE id = ?').get(req.session.usuario.id);
  if (!bcrypt.compareSync(actual || '', u.clave_hash))
    return res.status(400).json({ error: 'La contraseña actual no es correcta.', campos: { actual: 'La contraseña actual no es correcta.' } });
  if (!v.claveSegura(nueva))
    return res.status(400).json({ error: 'Mínimo 8 caracteres, mayúscula, minúscula y número.', campos: { nueva: 'Mínimo 8 caracteres, mayúscula, minúscula y número.' } });
  await db.prepare('UPDATE usuarios SET clave_hash = ? WHERE id = ?').run(bcrypt.hashSync(nueva, 10), req.session.usuario.id);
  res.json({ mensaje: 'Contraseña actualizada.' });
});

// POST /api/auth/consentimiento — registra la aceptación de la política vigente (RNF-07)
router.post('/consentimiento', requiereSesion, async (req, res) => {
  await db.prepare(`UPDATE usuarios SET acepta_datos = 1, consentimiento_version = ?, consentimiento_fecha = ${db.AHORA}
              WHERE id = ?`).run(db.VERSION_POLITICA, req.session.usuario.id);
  res.json({ mensaje: 'Aceptación de política registrada.', perfil: await perfilDe(req.session.usuario.id) });
});

module.exports = router;
