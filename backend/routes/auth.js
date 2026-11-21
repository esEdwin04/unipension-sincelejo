// =============================================================
// Módulo de autenticación (RF-01, RNF-05, RNF-07)
// Responsable: Desarrollador Backend
// =============================================================
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const router = express.Router();

// POST /api/auth/registro
router.post('/registro', (req, res) => {
  const { nombre, correo, clave, telefono, rol, acepta_datos } = req.body;
  if (!nombre || !correo || !clave || !rol)
    return res.status(400).json({ error: 'Nombre, correo, clave y rol son obligatorios' });
  if (!['estudiante', 'propietario'].includes(rol))
    return res.status(400).json({ error: 'Rol no permitido en el registro público' });
  if (!acepta_datos)
    return res.status(400).json({ error: 'Debe autorizar el tratamiento de datos personales (Ley 1581 de 2012)' });

  const existe = db.prepare('SELECT id FROM usuarios WHERE correo = ?').get(correo);
  if (existe) return res.status(409).json({ error: 'El correo ya está registrado' });

  const hash = bcrypt.hashSync(clave, 10); // RNF-05: contraseña cifrada con hash
  const r = db.prepare(`INSERT INTO usuarios (nombre,correo,clave_hash,telefono,rol,acepta_datos)
                        VALUES (?,?,?,?,?,1)`).run(nombre, correo, hash, telefono || null, rol);
  req.session.usuario = { id: r.lastInsertRowid, nombre, rol };
  res.status(201).json({ mensaje: 'Registro exitoso', usuario: req.session.usuario });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { correo, clave } = req.body;
  const u = db.prepare('SELECT * FROM usuarios WHERE correo = ?').get(correo || '');
  if (!u || !bcrypt.compareSync(clave || '', u.clave_hash))
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  req.session.usuario = { id: u.id, nombre: u.nombre, rol: u.rol };
  res.json({ mensaje: 'Sesión iniciada', usuario: req.session.usuario });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ mensaje: 'Sesión cerrada' }));
});

// GET /api/auth/yo  → usuario en sesión (para la barra de navegación)
router.get('/yo', (req, res) => res.json({ usuario: req.session.usuario || null }));

module.exports = router;
