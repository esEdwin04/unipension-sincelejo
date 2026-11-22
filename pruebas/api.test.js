// =============================================================
// Pruebas automáticas del API (Ingeniero QA) — ejecutar con: npm test
// Usa una base de datos temporal, por lo que no altera backend/unipension.db
// Cubre los flujos del prototipo inicial + las historias de usuario existentes.
// =============================================================
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

const dbTemporal = path.join(os.tmpdir(), `unipension-test-${process.pid}.db`);
process.env.DB_PATH = dbTemporal;
const app = require('../backend/server');

let servidor, base;
before(async () => {
  servidor = app.listen(0);
  await new Promise((r) => servidor.once('listening', r));
  base = `http://127.0.0.1:${servidor.address().port}/api`;
});
after(() => {
  servidor.close();
  for (const sufijo of ['', '-wal', '-shm']) fs.rmSync(dbTemporal + sufijo, { force: true });
});

// Cliente con cookie de sesión propia (simula un navegador por usuario)
function cliente() {
  let cookie = '';
  const pedir = async (metodo, ruta, cuerpo) => {
    const res = await fetch(base + ruta, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const tipo = res.headers.get('content-type') || '';
    return { status: res.status, datos: tipo.includes('json') ? await res.json() : await res.text() };
  };
  return {
    get: (r) => pedir('GET', r), post: (r, b) => pedir('POST', r, b), put: (r, b) => pedir('PUT', r, b),
    patch: (r, b) => pedir('PATCH', r, b), del: (r) => pedir('DELETE', r),
    entrar: (correo, clave) => pedir('POST', '/auth/login', { correo, clave }),
  };
}

const nuevaPension = (extra = {}) => ({
  nombre: 'Pensión Prueba QA', descripcion: 'Habitaciones para pruebas automáticas', direccion: `Cll QA # ${Date.now()}`,
  barrio: 'Centro', lat: 9.3, lng: -75.39, tarifa_mensual: 350000, deposito: 50000, tipo_habitacion: 'Individual',
  capacidad: 3, cupos: 2, servicios: ['Internet', 'Cocina'], reglas: 'Silencio después de las 10 pm',
  fotos: ['/img/placeholder1.svg'], instituciones: ['CECAR'], ...extra,
});

test('Registro: valida contraseña segura, celular y consentimiento', async () => {
  const c = cliente();
  let r = await c.post('/auth/registro', { nombre: 'Ana QA', correo: 'ana.qa@correo.co', clave: 'debil', rol: 'estudiante', institucion: 'CECAR', acepta_datos: true });
  assert.equal(r.status, 400);
  assert.ok(r.datos.campos.clave);
  r = await c.post('/auth/registro', { nombre: 'Pedro QA', correo: 'pedro.qa@correo.co', clave: 'Segura123', rol: 'propietario', telefono: '123', documento: 'DEMO-1', acepta_datos: true });
  assert.equal(r.status, 400);
  assert.ok(r.datos.campos.telefono);
  r = await c.post('/auth/registro', { nombre: 'Ana QA', correo: 'ana.qa@correo.co', clave: 'Segura123', rol: 'administrador', acepta_datos: true });
  assert.equal(r.status, 400, 'no se registran administradores');
  r = await c.post('/auth/registro', { nombre: 'Ana QA', correo: 'ana.qa@correo.co', clave: 'Segura123', confirmar: 'Segura123', rol: 'estudiante', institucion: 'CECAR', acepta_datos: true });
  assert.equal(r.status, 201);
  const perfil = await c.get('/auth/perfil');
  assert.equal(perfil.datos.consentimiento_version, '2026-01-prototipo');
  assert.equal(perfil.datos.clave_hash, undefined, 'nunca se expone el hash');
});

test('Perfil: edición, teléfono +57 y cambio de contraseña', async () => {
  const c = cliente();
  await c.entrar('estudiante@unipension.co', 'est123');
  let r = await c.put('/auth/perfil', { telefono: '300 123 4567', programa: 'Ingeniería Industrial' });
  assert.equal(r.status, 200);
  assert.equal(r.datos.perfil.telefono, '+573001234567');
  r = await c.put('/auth/clave', { actual: 'incorrecta', nueva: 'Nueva1234' });
  assert.equal(r.status, 400);
});

test('Catálogo: búsqueda sin tildes, servicios, orden y destacados primero', async () => {
  const c = cliente();
  let r = await c.get('/pensiones');
  assert.equal(r.status, 200);
  assert.ok(r.datos.length >= 10);
  assert.equal(r.datos[0].destacado, true, 'los destacados van primero');
  r = await c.get('/pensiones?q=pension%20la%20ceiba');
  assert.ok(r.datos.some((p) => p.nombre === 'Pensión La Ceiba'));
  r = await c.get('/pensiones?servicios=Internet,Baño%20privado');
  assert.ok(r.datos.length > 0 && r.datos.every((p) => p.servicios.includes('Baño privado')));
  r = await c.get('/pensiones?orden=precio_asc');
  const normales = r.datos.filter((p) => !p.destacado).map((p) => p.tarifa_mensual);
  assert.deepEqual(normales, [...normales].sort((a, b) => a - b));
  r = await c.get('/pensiones?precio_min=500000&precio_max=100000');
  assert.equal(r.status, 400);
});

test('Publicación en 3 pasos → Pendiente → aprobada por el administrador → visible', async () => {
  const prop = cliente(); const admin = cliente(); const est = cliente();
  await prop.entrar('propietaria@unipension.co', 'prop123');
  await admin.entrar('admin@unipension.co', 'admin123');
  await est.entrar('estudiante@unipension.co', 'est123');

  let r = await prop.post('/pensiones', nuevaPension({ fotos: [] }));
  assert.equal(r.status, 400);
  assert.ok(r.datos.campos.fotos, 'exige al menos una foto');
  r = await prop.post('/pensiones', nuevaPension({ cupos: 9 }));
  assert.ok(r.datos.campos.cupos, 'cupos no pueden superar la capacidad');

  const datos = nuevaPension();
  r = await prop.post('/pensiones', datos);
  assert.equal(r.status, 201);
  const id = r.datos.id;
  r = await prop.post('/pensiones', { ...datos, nombre: 'Duplicada' });
  assert.equal(r.status, 409, 'dirección duplicada (HU-01 esc. 2)');

  r = await est.get(`/pensiones/${id}`);
  assert.equal(r.status, 404, 'una pensión pendiente no es pública');
  r = await admin.post(`/admin/pensiones/${id}/moderar`, { accion: 'rechazar' });
  assert.equal(r.status, 400, 'rechazar exige motivo');
  r = await admin.post(`/admin/pensiones/${id}/moderar`, { accion: 'aprobar' });
  assert.equal(r.status, 200);
  r = await est.get(`/pensiones/${id}`);
  assert.equal(r.status, 200);
  assert.equal(r.datos.cupos, 2);
  assert.equal(r.datos.capacidad, 3);
  assert.equal(r.datos.contacto.telefono, undefined, 'el teléfono no se publica');

  // Cupos: disponibilidad independiente de la moderación
  r = await prop.patch(`/pensiones/${id}/cupos`, { cupos: 0 });
  assert.equal(r.status, 200);
  r = await est.get('/pensiones');
  assert.ok(!r.datos.some((p) => p.id === id), 'sin cupos no aparece en el catálogo');
  r = await prop.patch(`/pensiones/${id}/cupos`, { cupos: 5 });
  assert.equal(r.status, 400);
  await prop.patch(`/pensiones/${id}/cupos`, { cupos: 1 });

  // Edición comercial: se mantiene verificada; edición de identidad: vuelve a revisión
  r = await prop.put(`/pensiones/${id}`, { tarifa_mensual: 360000 });
  assert.equal(r.datos.estado, 'Verificada');
  r = await prop.put(`/pensiones/${id}`, { nombre: 'Pensión QA renombrada' });
  assert.equal(r.datos.estado, 'Pendiente');
});

test('Contacto por WhatsApp: vista previa si el número no está habilitado', async () => {
  const est = cliente(); const prop = cliente();
  await est.entrar('estudiante@unipension.co', 'est123');
  const lista = (await est.get('/pensiones')).datos;
  let r = await est.post(`/pensiones/${lista[0].id}/contacto`);
  assert.equal(r.status, 200);
  assert.equal(r.datos.url, null);
  await prop.entrar('propietaria@unipension.co', 'prop123');
  await prop.put('/auth/perfil', { whatsapp_habilitado: true });
  r = await est.post(`/pensiones/${lista[0].id}/contacto`);
  assert.match(r.datos.url, /^https:\/\/wa\.me\/573011111111\?text=/);
});

test('Reportes: uno activo por estudiante y ocultamiento automático con tres estudiantes', async () => {
  const pensiones = (await cliente().get('/pensiones')).datos;
  const objetivo = pensiones[pensiones.length - 1].id;
  const correos = ['estudiante@unipension.co', 'estudiante2@unipension.co', 'estudiante3@unipension.co'];
  for (const [i, correo] of correos.entries()) {
    const c = cliente();
    await c.entrar(correo, 'est123');
    const r = await c.post(`/pensiones/${objetivo}/reportar`, { motivo: 'Sin cupos disponibles', detalle: 'Prueba' });
    assert.equal(r.status, 201);
    if (i === 0) {
      const dup = await c.post(`/pensiones/${objetivo}/reportar`, { motivo: 'Otro motivo' });
      assert.equal(dup.status, 409);
    }
    if (i === 2) assert.equal(r.datos.ocultada, true);
  }
  const visibles = (await cliente().get('/pensiones')).datos;
  assert.ok(!visibles.some((p) => p.id === objetivo));
  const admin = cliente();
  await admin.entrar('admin@unipension.co', 'admin123');
  const r = await admin.post(`/admin/pensiones/${objetivo}/moderar`, { accion: 'restaurar', motivo: 'Información corregida' });
  assert.equal(r.status, 200);
  const rep = (await admin.get('/admin/reportes')).datos.filter((x) => x.pension_id === objetivo);
  assert.ok(rep.every((x) => x.estado === 'Resuelto'));
});

test('Control de acceso por rol (RNF-06)', async () => {
  const est = cliente();
  await est.entrar('estudiante@unipension.co', 'est123');
  assert.equal((await est.get('/admin/indicadores')).status, 403);
  assert.equal((await est.post('/pensiones', nuevaPension())).status, 403);
  assert.equal((await cliente().get('/reservas/mias')).status, 401);
});

test('Reserva y pago simulado siguen funcionando (HU-06, HU-07)', async () => {
  const est = cliente();
  await est.entrar('estudiante2@unipension.co', 'est123');
  const pension = (await est.get('/pensiones')).datos[0];
  const ficha = (await est.get(`/pensiones/${pension.id}`)).datos;
  const hab = ficha.habitaciones.find((h) => h.estado === 'Libre');
  const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  let r = await est.post('/reservas', { habitacion_id: hab.id, fecha_ingreso: manana, meses: 3 });
  assert.equal(r.status, 201);
  r = await est.post(`/reservas/${r.datos.reserva_id}/pagar`, { medio: 'PSE', simular: 'aprobado' });
  assert.equal(r.status, 200);
  assert.match(r.datos.consecutivo, /^UP-/);
});
