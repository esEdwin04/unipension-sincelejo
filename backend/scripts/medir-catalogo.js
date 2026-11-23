// ------------------------------------------------------------------------------
// UniPensión Sincelejo — Medición de rendimiento del catálogo (DB5 · RNF-03)
// Responsable: José Paternina
//
// Crea una base TEMPORAL con 200 pensiones verificadas, levanta el API y mide
// GET /api/pensiones con distintos filtros. RNF-03 exige responder en menos de 3 s.
//
//   npm run db:medir                     -> 200 pensiones, 20 repeticiones por caso
//   PENSIONES=500 REPETICIONES=50 npm run db:medir
//
// Nunca toca backend/unipension.db ni la base de Turso: usa su propio archivo.
// ------------------------------------------------------------------------------
const os = require('os');
const fs = require('fs');
const path = require('path');

const TOTAL = Number(process.env.PENSIONES) || 200;
const REPETICIONES = Number(process.env.REPETICIONES) || 20;
const LIMITE_MS = 3000; // RNF-03

// La base temporal se fija ANTES de cargar la app, igual que en pruebas/api.test.js
delete process.env.TURSO_DATABASE_URL;
const dbTemporal = path.join(os.tmpdir(), `unipension-medicion-${process.pid}.db`);
process.env.DB_PATH = dbTemporal;
const app = require('../server');
const db = require('../db');
const { BARRIOS } = require('../utils/barrios');

const SERVICIOS = ['Internet', 'Cocina', 'Lavandería', 'Aire acondicionado', 'Parqueadero', 'Agua caliente'];
const azar = (n) => Math.floor(Math.random() * n);
const elegir = (lista) => lista[azar(lista.length)];

async function poblar() {
  const propietario = await db.prepare(`SELECT id FROM usuarios WHERE rol = 'propietario' LIMIT 1`).get();
  await db.transaction(async (tx) => {
    for (let i = 1; i <= TOTAL; i++) {
      const servicios = SERVICIOS.filter(() => Math.random() < 0.5);
      const { lastInsertRowid: id } = await tx.prepare(`
        INSERT INTO pensiones (propietario_id, nombre, direccion, barrio, descripcion, servicios, tarifa_mensual,
                               deposito, lat, lng, estado, tipo_habitacion, instituciones)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Verificada', ?, 'CECAR')`).run(
        propietario.id, `Pensión de prueba ${i}`, `Cll ${i} # ${azar(90) + 1}-${azar(90) + 1} (medición)`,
        elegir(BARRIOS), 'Habitación de prueba para medir el catálogo', servicios.join(', '),
        250000 + azar(30) * 10000, 50000, 9.28 + Math.random() * 0.04, -75.41 + Math.random() * 0.04,
        Math.random() < 0.5 ? 'Individual' : 'Compartida');
      for (let h = 1; h <= 3; h++) {
        await tx.prepare(`INSERT INTO habitaciones (pension_id, codigo, tipo, tarifa, estado) VALUES (?, ?, ?, ?, ?)`)
          .run(id, `H${h}`, h === 3 ? 'compartida' : 'individual', 300000, h === 1 ? 'Ocupada' : 'Libre');
      }
      await tx.prepare('INSERT INTO fotos (pension_id, url) VALUES (?, ?)').run(id, '/img/placeholder1.svg');
    }
  });
}

async function medir(base, nombre, consulta) {
  const tiempos = [];
  let resultados = 0;
  for (let i = 0; i < REPETICIONES; i++) {
    const inicio = performance.now();
    const res = await fetch(`${base}/pensiones${consulta}`);
    const datos = await res.json();
    tiempos.push(performance.now() - inicio);
    if (!res.ok) throw new Error(`${nombre}: respondió ${res.status}`);
    resultados = datos.length;
  }
  tiempos.sort((a, b) => a - b);
  const promedio = tiempos.reduce((s, t) => s + t, 0) / tiempos.length;
  const p95 = tiempos[Math.ceil(tiempos.length * 0.95) - 1];
  return { caso: nombre, resultados, promedio_ms: +promedio.toFixed(1), p95_ms: +p95.toFixed(1), max_ms: +tiempos.at(-1).toFixed(1) };
}

async function principal() {
  await db.listo;
  const t0 = performance.now();
  await poblar();
  const total = (await db.prepare(`SELECT COUNT(*) AS n FROM pensiones WHERE estado = 'Verificada'`).get()).n;
  console.log(`Base temporal con ${total} pensiones verificadas: ${TOTAL} de prueba + ${total - TOTAL} de demostración ` +
    `(${((performance.now() - t0) / 1000).toFixed(1)} s en crearlas)`);

  const servidor = app.listen(0);
  await new Promise((r) => servidor.once('listening', r));
  const base = `http://127.0.0.1:${servidor.address().port}/api`;

  const casos = [
    ['Sin filtros', ''],
    ['Por barrio', `?barrio=${encodeURIComponent(BARRIOS[0])}`],
    ['Rango de precio', '?precio_min=300000&precio_max=450000'],
    ['Tipo de habitación', '?tipo=individual'],
    ['Servicios', `?servicios=${encodeURIComponent('Internet,Cocina')}`],
    ['Búsqueda de texto', '?q=prueba'],
    ['Cerca de la universidad', '?universidad_id=1&dist_max=3&orden=cercania'],
    ['Todos los filtros', '?precio_max=500000&tipo=individual&servicios=Internet&universidad_id=1&orden=precio_asc'],
  ];
  const tabla = [];
  for (const [nombre, consulta] of casos) tabla.push(await medir(base, nombre, consulta));
  console.log(`\nGET /api/pensiones · ${REPETICIONES} repeticiones por caso`);
  console.table(tabla);

  const peor = Math.max(...tabla.map((f) => f.p95_ms));
  const cumple = peor < LIMITE_MS;
  console.log(`${cumple ? 'CUMPLE' : 'NO CUMPLE'} RNF-03: el caso más lento tarda ${peor} ms (p95); el límite es ${LIMITE_MS} ms.`);

  servidor.close();
  db.close();
  for (const sufijo of ['', '-wal', '-shm']) {
    try { fs.rmSync(dbTemporal + sufijo, { force: true, maxRetries: 10, retryDelay: 100 }); } catch { /* se queda en la carpeta temporal */ }
  }
  process.exit(cumple ? 0 : 1);
}

principal().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
