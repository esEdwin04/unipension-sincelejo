// ------------------------------------------------------------------------------
// UniPensión Sincelejo — Copias de seguridad de la base de datos (DB3 · RNF-09)
// Responsable: José Paternina
//
// Genera un archivo .sql con el esquema y todos los datos, sea la base local
// (backend/unipension.db o DB_PATH) o la de Turso (TURSO_DATABASE_URL).
// Conserva solo los últimos 30 respaldos (RESPALDO_RETENCION) y permite
// restaurar cualquiera de ellos en una base limpia para comprobarlo.
//
//   npm run db:respaldo                                   -> crea un respaldo
//   npm run db:restaurar -- <archivo.sql> <destino.db>    -> lo restaura
//
// No se conecta a la app ni cambia la base de origen: solo la lee.
// ------------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');

const URL_REMOTA = process.env.TURSO_DATABASE_URL;
const CARPETA = process.env.RESPALDO_DIR || path.join(__dirname, '..', 'respaldos');
const RETENCION = Number(process.env.RESPALDO_RETENCION) || 30;
const PREFIJO = 'respaldo-';

// Mismo criterio que db.js: en la nube el cliente web, en local el de archivos
function conectar(urlArchivo) {
  if (!urlArchivo && URL_REMOTA) {
    const { createClient } = require('@libsql/client/web');
    return createClient({ url: URL_REMOTA, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  const { createClient } = require('@libsql/client');
  const archivo = urlArchivo || process.env.DB_PATH || path.join(__dirname, '..', 'unipension.db');
  return createClient({ url: 'file:' + archivo });
}

// Convierte un valor de SQLite en un literal SQL seguro
function literal(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number' || typeof v === 'bigint') return String(v);
  if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) {
    return `X'${Buffer.from(v instanceof ArrayBuffer ? v : v.buffer).toString('hex')}'`;
  }
  return `'${String(v).replace(/'/g, "''")}'`;
}

const comillas = (nombre) => `"${nombre.replace(/"/g, '""')}"`;

// Fecha y hora de Colombia (UTC-5) para el nombre del archivo
function marcaDeTiempo() {
  return new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
}

async function generarRespaldo() {
  const cliente = conectar();
  const origen = URL_REMOTA ? 'Turso' : 'archivo local';
  const lineas = [
    `-- Respaldo UniPensión · origen: ${origen} · ${marcaDeTiempo()} (hora de Colombia)`,
    'PRAGMA foreign_keys=OFF;',
    'BEGIN TRANSACTION;',
  ];

  const objetos = (await cliente.execute(
    `SELECT type, name, sql FROM sqlite_master
     WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
     ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name`
  )).rows;

  let totalFilas = 0;
  for (const { type, name, sql } of objetos.filter((o) => o.type === 'table')) {
    lineas.push('', `-- Tabla ${name}`, `${sql};`);
    // Las sesiones son temporales: se guarda la tabla pero no su contenido
    if (name === 'sesiones') continue;
    const { columns, rows } = await cliente.execute(`SELECT * FROM ${comillas(name)}`);
    const cols = columns.map(comillas).join(', ');
    for (const fila of rows) {
      const valores = columns.map((_, i) => literal(fila[i])).join(', ');
      lineas.push(`INSERT INTO ${comillas(name)} (${cols}) VALUES (${valores});`);
    }
    totalFilas += rows.length;
    void type;
  }

  // Índices, vistas y disparadores van después de los datos
  const resto = objetos.filter((o) => o.type !== 'table');
  if (resto.length) lineas.push('', '-- Índices, vistas y disparadores');
  for (const { sql } of resto) lineas.push(`${sql};`);

  // Contadores de AUTOINCREMENT, para que los nuevos id no choquen al restaurar
  const hayContadores = (await cliente.execute(
    `SELECT 1 FROM sqlite_master WHERE name = 'sqlite_sequence'`
  )).rows.length > 0;
  if (hayContadores) {
    const contadores = (await cliente.execute('SELECT name, seq FROM sqlite_sequence')).rows;
    lineas.push('', '-- Contadores de AUTOINCREMENT', 'DELETE FROM sqlite_sequence;');
    for (const { name, seq } of contadores) {
      lineas.push(`INSERT INTO sqlite_sequence (name, seq) VALUES (${literal(name)}, ${literal(seq)});`);
    }
  }

  lineas.push('', 'COMMIT;', '');
  cliente.close();

  fs.mkdirSync(CARPETA, { recursive: true });
  const archivo = path.join(CARPETA, `${PREFIJO}${marcaDeTiempo()}.sql`);
  fs.writeFileSync(archivo, lineas.join('\n'));

  const tablas = objetos.filter((o) => o.type === 'table').length;
  console.log(`Respaldo creado: ${archivo}`);
  console.log(`  ${tablas} tablas · ${totalFilas} filas · ${(fs.statSync(archivo).size / 1024).toFixed(1)} KB`);
  aplicarRetencion();
}

// Conserva solo los últimos N respaldos (RNF-09: 30 días con uno diario)
function aplicarRetencion() {
  const respaldos = fs.readdirSync(CARPETA)
    .filter((f) => f.startsWith(PREFIJO) && f.endsWith('.sql'))
    .sort(); // el nombre lleva la fecha, así que el orden alfabético es cronológico
  const sobrantes = respaldos.slice(0, Math.max(0, respaldos.length - RETENCION));
  for (const f of sobrantes) fs.unlinkSync(path.join(CARPETA, f));
  if (sobrantes.length) console.log(`  Se eliminaron ${sobrantes.length} respaldos antiguos (se conservan ${RETENCION}).`);
}

// Restaura un respaldo en una base NUEVA; nunca sobrescribe una existente
async function restaurar(archivoSql, destino) {
  if (!archivoSql || !destino) {
    throw new Error('Uso: npm run db:restaurar -- <respaldo.sql> <base-nueva.db>');
  }
  if (fs.existsSync(destino)) {
    throw new Error(`El destino ${destino} ya existe. Por seguridad solo se restaura en una base limpia.`);
  }
  const cliente = conectar(destino);
  await cliente.executeMultiple(fs.readFileSync(archivoSql, 'utf8'));

  const tablas = (await cliente.execute(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
  )).rows;
  console.log(`Respaldo restaurado en ${destino}`);
  for (const { name } of tablas) {
    const { n } = (await cliente.execute(`SELECT COUNT(*) AS n FROM ${comillas(name)}`)).rows[0];
    console.log(`  ${name}: ${n} filas`);
  }
  cliente.close();
}

const [modo, ...args] = process.argv.slice(2);
const tarea = modo === '--restaurar' ? restaurar(...args) : generarRespaldo();
tarea.catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
