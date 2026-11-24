// ------------------------------------------------------------------------------
// Pruebas automáticas del API (Ingeniero QA) — ejecutar con: npm test
// Usa una base de datos temporal, por lo que no altera backend/unipension.db
// Cubre los flujos del prototipo inicial + las historias de usuario existentes.
// -----------------------------------------------------------------------------------
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
after(async () => {
  servidor.close();
  require('../backend/db').close(); // en Windows no se puede borrar un archivo SQLite abierto (EPERM)
  // libSQL libera el archivo un instante después de cerrar: se reintenta y, si sigue bloqueado,
  // se deja en la carpeta temporal del sistema en lugar de marcar la prueba como fallida
  for (const sufijo of ['', '-wal', '-shm']) {
    try { fs.rmSync(dbTemporal + sufijo, { force: true, maxRetries: 10, retryDelay: 100 }); }
    catch (err) { console.warn(`No se pudo borrar ${dbTemporal + sufijo}: ${err.code}`); }
  }
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

let contadorQA = 0; // direcciones distintas y con formato válido para cada pensión de prueba
const nuevaPension = (extra = {}) => ({
  nombre: 'Pensión Prueba QA', descripcion: 'Habitaciones para pruebas automáticas', direccion: `Cll ${10 + (contadorQA++ % 80)} # ${Date.now() % 90 + 1}-${Date.now() % 97 + 1}`,
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
  // Mensaje escrito por el estudiante: llega tal cual, con el enlace al anuncio
  r = await est.post(`/pensiones/${lista[0].id}/contacto`, { mensaje: '  ¿Aceptan estudiantes de primer semestre?  ' });
  assert.equal(r.status, 200);
  assert.equal(r.datos.arrendador, 'Carmen');
  const [texto, enlace] = r.datos.mensaje.split('\n\nAnuncio en UniPensión: ');
  assert.equal(texto, '¿Aceptan estudiantes de primer semestre?');
  assert.equal(enlace, `${base.replace(/\/api$/, '')}/pension/${lista[0].id}`);
  assert.equal(decodeURIComponent(r.datos.url.split('?text=')[1]), r.datos.mensaje);
  // Sin texto se usa el mensaje sugerido con el nombre del estudiante
  r = await est.post(`/pensiones/${lista[0].id}/contacto`, {});
  assert.match(r.datos.mensaje, /^Hola, soy Luis\. Vi el anuncio «/);
  // Límite de longitud y solo estudiantes con sesión
  assert.equal((await est.post(`/pensiones/${lista[0].id}/contacto`, { mensaje: 'x'.repeat(1001) })).status, 400);
  assert.equal((await prop.post(`/pensiones/${lista[0].id}/contacto`, { mensaje: 'Hola' })).status, 403);
  assert.equal((await cliente().post(`/pensiones/${lista[0].id}/contacto`, { mensaje: 'Hola' })).status, 401);
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

test('Disponibilidad: reservar, cancelar, vencer y rechazar actualizan los cupos del catálogo (HU-04, HU-06, HU-09)', async () => {
  const db = require('../backend/db');
  const anon = cliente(), est = cliente(), prop = cliente();
  await est.entrar('estudiante2@unipension.co', 'est123');
  await prop.entrar('propietario3@unipension.co', 'prop123'); // Martha Salgado publica «Pensión Casa Serena»
  const enCatalogo = async (nombre) => (await anon.get('/pensiones')).datos.find((x) => x.nombre === nombre);
  const manana = new Date(Date.now() + 86400e3).toISOString().slice(0, 10);

  // «Pensión Casa Serena» tiene un único cupo libre
  const antes = await enCatalogo('Pensión Casa Serena');
  assert.equal(antes.cupos, 1);
  const libre = (await anon.get(`/pensiones/${antes.id}`)).datos.habitaciones.find((h) => h.estado === 'Libre');

  // 1. Reservar el último cupo: la habitación queda bloqueada y la pensión sale del catálogo
  let r = await est.post('/reservas', { habitacion_id: libre.id, fecha_ingreso: manana, meses: 6 });
  assert.equal(r.status, 201);
  let reserva = r.datos.reserva_id;
  assert.equal(await enCatalogo('Pensión Casa Serena'), undefined);
  let ficha = (await anon.get(`/pensiones/${antes.id}`)).datos;
  assert.equal(ficha.cupos, 0);
  assert.equal(ficha.disponibilidad, 'Ocupada');
  assert.equal(ficha.habitaciones.find((h) => h.id === libre.id).estado, 'Bloqueada');
  // Otro estudiante ya no puede tomarla
  const otro = cliente(); await otro.entrar('estudiante3@unipension.co', 'est123');
  assert.equal((await otro.post('/reservas', { habitacion_id: libre.id, fecha_ingreso: manana, meses: 6 })).status, 409);

  // 2. Cancelar antes de pagar: vuelve al catálogo
  assert.equal((await est.post(`/reservas/${reserva}/cancelar`)).status, 200);
  assert.equal((await enCatalogo('Pensión Casa Serena')).cupos, 1);

  // 3. Bloqueo vencido (30 min sin pagar): el catálogo lo libera sin pasar por las rutas de reservas
  reserva = (await est.post('/reservas', { habitacion_id: libre.id, fecha_ingreso: manana, meses: 6 })).datos.reserva_id;
  assert.equal(await enCatalogo('Pensión Casa Serena'), undefined);
  await db.prepare(`UPDATE reservas SET expira_en = datetime('now','-5 hours','-1 minutes') WHERE id = ?`).run(reserva);
  assert.equal((await enCatalogo('Pensión Casa Serena'))?.cupos, 1);
  assert.equal((await anon.get(`/pensiones/${antes.id}`)).datos.habitaciones.find((h) => h.id === libre.id).estado, 'Libre');

  // 4. Pagada → ocupada; el propietario la rechaza → libre otra vez
  reserva = (await est.post('/reservas', { habitacion_id: libre.id, fecha_ingreso: manana, meses: 6 })).datos.reserva_id;
  assert.equal((await est.post(`/reservas/${reserva}/pagar`, { medio: 'PSE', simular: 'aprobado' })).status, 200);
  ficha = (await anon.get(`/pensiones/${antes.id}`)).datos;
  assert.equal(ficha.habitaciones.find((h) => h.id === libre.id).estado, 'Ocupada');
  assert.equal((await prop.get('/pensiones/mias')).datos.find((x) => x.id === antes.id).cupos, 0);
  assert.equal((await prop.post(`/reservas/${reserva}/responder`, { decision: 'rechazar', motivo: 'Prueba' })).status, 200);
  assert.equal((await enCatalogo('Pensión Casa Serena')).cupos, 1);
});

test('Mejor valoradas: promedio, cantidad de reseñas, orden y moderación (HU-10)', async () => {
  const anon = cliente(), prop = cliente();
  let r = await anon.get('/pensiones/mejor-valoradas?limite=12');
  assert.equal(r.status, 200);
  const lista = r.datos;
  assert.ok(lista.length >= 6);
  // Orden: promedio descendente y, a igual promedio, más reseñas primero
  for (let i = 1; i < lista.length; i++) {
    const [a, b] = [lista[i - 1], lista[i]];
    assert.ok(a.calificacion > b.calificacion || (a.calificacion === b.calificacion && a.total_resenas >= b.total_resenas));
  }
  const luz = lista.find((p) => p.nombre === 'Pensión Luz del Caribe');
  assert.deepEqual([luz.calificacion, luz.total_resenas], [4.7, 3]);
  assert.match(luz.foto, /^\/img\/pensiones\//);
  assert.ok(luz.comentario_destacado.length > 10);
  assert.equal((await anon.get('/pensiones/mejor-valoradas?limite=2')).datos.length, 2);
  // La ficha muestra las mismas reseñas
  assert.equal((await anon.get(`/pensiones/${luz.id}`)).datos.resenas.length, 3);

  // Una reseña reportada por el propietario deja de contar: La Terraza tenía una sola
  const terraza = lista.find((p) => p.nombre === 'Pensión La Terraza');
  const resena = (await anon.get(`/pensiones/${terraza.id}`)).datos.resenas[0];
  await prop.entrar('propietario2@unipension.co', 'prop123'); // Rafael Pérez publica «Pensión La Terraza»
  assert.equal((await prop.post(`/resenas/${resena.id}/reportar`)).status, 200);
  r = await anon.get('/pensiones/mejor-valoradas?limite=12');
  assert.equal(r.datos.find((p) => p.nombre === 'Pensión La Terraza'), undefined);
});

test('Arrendadores: las pensiones de demostración no son todas del mismo propietario', async () => {
  const db = require('../backend/db');
  const duenos = await db.prepare(`SELECT u.correo, COUNT(*) AS n FROM pensiones p JOIN usuarios u ON u.id = p.propietario_id
    WHERE u.correo LIKE '%@unipension.co' GROUP BY u.correo`).all();
  assert.ok(duenos.length >= 5, `solo hay ${duenos.length} arrendadores`);
  assert.ok(duenos.every((d) => d.n <= 4), 'ningún arrendador concentra la oferta');
  // Cada arrendador ve solo sus pensiones y su ficha pública muestra su nombre
  const rafael = cliente(); await rafael.entrar('propietario2@unipension.co', 'prop123');
  const mias = (await rafael.get('/pensiones/mias')).datos.map((p) => p.nombre).sort();
  assert.deepEqual(mias, ['Pensión El Patio', 'Pensión La Terraza', 'Residencia El Edén']);
  const eden = (await cliente().get('/pensiones')).datos.find((p) => p.nombre === 'Residencia El Edén');
  assert.equal((await cliente().get(`/pensiones/${eden.id}`)).datos.contacto.nombre, 'Rafael Pérez Arrieta');
  // Las 5 cuentas de propietario aparecen en el acceso rápido de demostración
  assert.equal((await cliente().get('/auth/demo')).datos.filter((c) => c.rol === 'propietario').length, 5);
});

test('Favoritos: guardar, listar y quitar; solo el estudiante dueño los ve', async () => {
  const est = cliente(), otro = cliente(), prop = cliente(), anon = cliente();
  await est.entrar('estudiante@unipension.co', 'est123');
  await otro.entrar('estudiante2@unipension.co', 'est123');
  await prop.entrar('propietaria@unipension.co', 'prop123');
  const [a, b] = (await anon.get('/pensiones')).datos;

  assert.equal((await anon.put(`/favoritos/${a.id}`)).status, 401);   // sin sesión
  assert.equal((await prop.put(`/favoritos/${a.id}`)).status, 403);   // solo estudiantes
  assert.equal((await est.put('/favoritos/999999')).status, 404);     // pensión inexistente
  assert.equal((await est.put(`/favoritos/${a.id}`)).status, 200);
  assert.equal((await est.put(`/favoritos/${a.id}`)).status, 200);    // idempotente
  await est.put(`/favoritos/${b.id}`);
  assert.deepEqual((await est.get('/favoritos/ids')).datos.sort((x, y) => x - y), [a.id, b.id].sort((x, y) => x - y));
  const lista = (await est.get('/favoritos')).datos;
  assert.equal(lista.length, 2);
  assert.ok(lista.every((p) => p.publicada && p.foto && p.tarifa_mensual > 0));
  // Otro estudiante no ve los favoritos ajenos
  assert.deepEqual((await otro.get('/favoritos/ids')).datos, []);
  // Quitar
  assert.equal((await est.del(`/favoritos/${a.id}`)).status, 200);
  assert.deepEqual((await est.get('/favoritos/ids')).datos, [b.id]);
});

test('Modo real (MODO_DEMO=false): sin cuentas demo y documento de identidad real', async () => {
  const anterior = process.env.MODO_DEMO;
  process.env.MODO_DEMO = 'false';
  try {
    const anon = cliente();
    assert.deepEqual((await anon.get('/auth/modo')).datos, { demo: false });
    assert.deepEqual((await anon.get('/auth/demo')).datos, []);
    const base = { rol: 'propietario', nombre: 'Propietaria Real', clave: 'Segura123', confirmar: 'Segura123',
      telefono: '3104445566', acepta_datos: true, relacion: 'Propietario' };
    // Documento ficticio o vacío ya no sirve; la cédula real sí
    let r = await anon.post('/auth/registro', { ...base, correo: `real${Date.now()}@correo.co`, documento: '12' });
    assert.equal(r.status, 400);
    assert.match(r.datos.campos.documento, /cédula/);
    r = await anon.post('/auth/registro', { ...base, correo: `real${Date.now()}@correo.co`, documento: '1.102.345.678' });
    assert.equal(r.status, 201);
  } finally {
    if (anterior === undefined) delete process.env.MODO_DEMO; else process.env.MODO_DEMO = anterior;
  }
  assert.deepEqual((await cliente().get('/auth/modo')).datos, { demo: true });
});

test('Validación de campos: dirección, barrio, ubicación, precio, nombre, reserva y reseña', async () => {
  const prop = cliente(), est = cliente(), anon = cliente();
  await prop.entrar('propietaria@unipension.co', 'prop123');
  await est.entrar('estudiante@unipension.co', 'est123');
  const err = async (extra) => (await prop.post('/pensiones', nuevaPension(extra))).datos.campos || {};
  assert.ok((await err({ direccion: 'cerca a la ceiba' })).direccion);
  assert.ok((await err({ barrio: '<b>x</b>' })).barrio);
  assert.ok((await err({ lat: 4.71, lng: -74.07 })).lat);                 // Bogotá: fuera de Sincelejo
  assert.ok((await err({ tarifa_mensual: 5000 })).tarifa_mensual);
  assert.ok((await err({ deposito: 9000000 })).deposito);
  assert.ok((await err({ descripcion: 'corta' })).descripcion);
  assert.ok((await err({ servicios: ['Piscina'] })).servicios);
  // Barrio escrito sin tildes ni mayúsculas se guarda con el nombre oficial
  const r = await prop.post('/pensiones', nuevaPension({ barrio: 'ciudad jardin' }));
  assert.equal(r.status, 201);
  assert.equal((await prop.get(`/pensiones/${r.datos.id}`)).datos.barrio, 'Ciudad Jardín');
  // Lista de barrios reales para los menús
  const barrios = (await anon.get('/pensiones/barrios-sincelejo')).datos;
  assert.ok(barrios.length > 100);
  assert.ok(barrios.find((b) => b.barrio === 'Centro').pensiones > 0);
  // Nombre de persona: con apellido y sin números
  assert.equal((await est.put('/auth/perfil', { nombre: 'Luis 123' })).status, 400);
  assert.equal((await est.put('/auth/perfil', { programa: '<script>x</script>' })).status, 400);
  // Reserva: meses entre 1 y 12 y fecha no mayor a un año
  const p = (await anon.get('/pensiones')).datos[0];
  const hab = (await anon.get(`/pensiones/${p.id}`)).datos.habitaciones.find((h) => h.estado === 'Libre');
  const manana = new Date(Date.now() + 86400e3).toISOString().slice(0, 10);
  assert.equal((await est.post('/reservas', { habitacion_id: hab.id, fecha_ingreso: manana, meses: 24 })).status, 400);
  assert.equal((await est.post('/reservas', { habitacion_id: hab.id, fecha_ingreso: '2099-01-01', meses: 6 })).status, 400);
  assert.equal((await est.post('/resenas', { pension_id: p.id, estrellas: 9 })).status, 400);
});

// DB1: migraciones para recuperación de contraseña (B2), anulación de pagos (B4) y fecha de salida (B6)
test('Migraciones DB1: tokens de recuperación, anulación de pagos y fecha de salida', async () => {
  const db = require('../backend/db');
  await db.listo;
  const columnas = async (tabla) => (await db.prepare(`PRAGMA table_info(${tabla})`).all()).map((c) => c.name);
  assert.ok((await columnas('tokens_recuperacion')).includes('token_hash'));
  for (const c of ['anulado_en', 'motivo_anulacion', 'anulado_por']) assert.ok((await columnas('pagos')).includes(c));
  // Las reservas sembradas ya tienen fecha de salida
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM reservas WHERE fecha_salida IS NULL').get()).n, 0);
  // Una reserva nueva la calcula sola y se recalcula si cambian los meses
  const hab = await db.prepare(`SELECT id FROM habitaciones WHERE estado = 'Libre' LIMIT 1`).get();
  const est = await db.prepare(`SELECT id FROM usuarios WHERE rol = 'estudiante' LIMIT 1`).get();
  const { lastInsertRowid: id } = await db.prepare(`INSERT INTO reservas (habitacion_id, estudiante_id, fecha_ingreso, meses, valor_total)
    VALUES (?, ?, '2027-01-31', 1, 1)`).run(hab.id, est.id);
  const salida = async () => (await db.prepare('SELECT fecha_salida FROM reservas WHERE id = ?').get(id)).fecha_salida;
  assert.equal(await salida(), '2027-03-03'); // SQLite suma el mes y normaliza el 31 de febrero
  await db.prepare('UPDATE reservas SET meses = 6 WHERE id = ?').run(id);
  assert.equal(await salida(), '2027-07-31');
  await db.prepare('DELETE FROM reservas WHERE id = ?').run(id);
});
