// --------------------------------------------------------------------
// UniPensión Sincelejo — Capa de persistencia (libSQL / Turso)
// Responsable: jesus v
//
// - Producción (Vercel): base SQLite en la nube de Turso. Variables:
//     TURSO_DATABASE_URL  (libsql://<base>-<usuario>.turso.io)
//     TURSO_AUTH_TOKEN    (token de la base; nunca se sube a GitHub)
// - Desarrollo y pruebas: archivo local (backend/unipension.db o DB_PATH).
//
// La API imita la de better-sqlite3, pero es asíncrona:
//   await db.prepare(sql).get(...) · .all(...) · .run(...)
//   await db.transaction(async (tx) => { await tx.prepare(...).run(...) })
// Creacion del esquema y los datos semilla por primera vez (db.listo).
// --------------------------------------------------------------------

const path = require('path');
const bcrypt = require('bcryptjs');

const URL_REMOTA = process.env.TURSO_DATABASE_URL;
// El cliente de la nube va a aprovechar el cliente web (HTTP, sin binarios nativos); el cliente local es el que tiene soporte para archivos.
const { createClient } = URL_REMOTA ? require('@libsql/client/web') : require('@libsql/client');
const cliente = createClient(URL_REMOTA
  ? { url: URL_REMOTA, authToken: process.env.TURSO_AUTH_TOKEN }
  : { url: 'file:' + (process.env.DB_PATH || path.join(__dirname, 'unipension.db')) });

// Hora de Colombia (UTC-5, sin horario de verano). Los servidores en la nube trabajan en UTC,
// por eso no se usa 'localtime'. Se usa en el SQL como ${AHORA} o datetime('now','-5 hours','+30 minutes').
const AHORA = `datetime('now','-5 hours')`;
const hoyColombia = () => new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);

// libSQL no acepta undefined ni booleanos como parámetros
const parametro = (v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v);

function envolver(ejecutor) {
  const ejecutar = (sql, args) => ejecutor.execute({ sql, args: args.map(parametro) });
  return {
    prepare(sql) {
      return {
        get: async (...a) => (await ejecutar(sql, a)).rows[0],
        all: async (...a) => (await ejecutar(sql, a)).rows,
        run: async (...a) => {
          const r = await ejecutar(sql, a);
          return { changes: r.rowsAffected, lastInsertRowid: r.lastInsertRowid == null ? undefined : Number(r.lastInsertRowid) };
        },
      };
    },
    exec: (sql) => ejecutor.executeMultiple(sql),
  };
}

const db = envolver(cliente);

// Transacción de escritura: si la función lanza un error, se revierte todo
db.transaction = async (fn) => {
  const tx = await cliente.transaction('write');
  try {
    const resultado = await fn(envolver(tx));
    await tx.commit();
    return resultado;
  } catch (err) {
    await tx.rollback().catch(() => {});
    throw err;
  } finally {
    tx.close();
  }
};
db.close = () => cliente.close();

// Errores de restricción UNIQUE (el código varía entre el modo archivo y el remoto)
db.esDuplicado = (err) => /UNIQUE/i.test(`${err?.code} ${err?.extendedCode} ${err?.message}`);
db.AHORA = AHORA;
db.hoyColombia = hoyColombia;

const VERSION_POLITICA = '2026-01-prototipo';
db.VERSION_POLITICA = VERSION_POLITICA;
// Cambiar este valor obliga a revisar esquema, migraciones y semillas en el siguiente arranque
const VERSION_ESQUEMA = '0.4.0-favoritos';

// ---------------------- ESQUEMA ----------------------
const ESQUEMA = `
CREATE TABLE IF NOT EXISTS meta (clave TEXT PRIMARY KEY, valor TEXT);

CREATE TABLE IF NOT EXISTS usuarios (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre        TEXT NOT NULL,
  correo        TEXT NOT NULL UNIQUE,
  clave_hash    TEXT NOT NULL,
  telefono      TEXT,
  rol           TEXT NOT NULL CHECK (rol IN ('estudiante','propietario','administrador')),
  acepta_datos  INTEGER NOT NULL DEFAULT 0,          -- Ley 1581 de 2012 (RNF-07)
  creado_en     TEXT NOT NULL DEFAULT (${AHORA})
);

CREATE TABLE IF NOT EXISTS universidades (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre  TEXT NOT NULL UNIQUE,
  lat     REAL NOT NULL,
  lng     REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS pensiones (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  propietario_id INTEGER NOT NULL REFERENCES usuarios(id),
  nombre         TEXT NOT NULL,
  direccion      TEXT NOT NULL UNIQUE,               -- RF-03: direcciones no duplicadas
  barrio         TEXT NOT NULL,
  descripcion    TEXT,
  servicios      TEXT,                               -- lista separada por comas
  reglas         TEXT,
  tarifa_mensual INTEGER NOT NULL,
  deposito       INTEGER NOT NULL DEFAULT 0,
  lat            REAL, lng REAL,
  estado         TEXT NOT NULL DEFAULT 'Pendiente'   -- Pendiente | Verificada | Rechazada | Suspendida
                 CHECK (estado IN ('Pendiente','Verificada','Rechazada','Suspendida')),
  creado_en      TEXT NOT NULL DEFAULT (${AHORA})
);

CREATE TABLE IF NOT EXISTS habitaciones (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  pension_id  INTEGER NOT NULL REFERENCES pensiones(id) ON DELETE CASCADE,
  codigo      TEXT NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('individual','compartida')),
  tarifa      INTEGER NOT NULL,
  estado      TEXT NOT NULL DEFAULT 'Libre' CHECK (estado IN ('Libre','Bloqueada','Ocupada'))
);

CREATE TABLE IF NOT EXISTS fotos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  pension_id  INTEGER NOT NULL REFERENCES pensiones(id) ON DELETE CASCADE,
  url         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reservas (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  habitacion_id   INTEGER NOT NULL REFERENCES habitaciones(id),
  estudiante_id   INTEGER NOT NULL REFERENCES usuarios(id),
  fecha_ingreso   TEXT NOT NULL,
  meses           INTEGER NOT NULL,
  valor_total     INTEGER NOT NULL,
  estado          TEXT NOT NULL DEFAULT 'Pendiente de pago'
                  CHECK (estado IN ('Pendiente de pago','Pagada','Confirmada','Rechazada','Cancelada','Finalizada')),
  expira_en       TEXT,                              -- HU-07: límite de 30 min para pagar
  responder_antes TEXT,                              -- HU-09: 48 h para que responda el propietario
  creado_en       TEXT NOT NULL DEFAULT (${AHORA})
);

CREATE TABLE IF NOT EXISTS pagos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  reserva_id   INTEGER NOT NULL REFERENCES reservas(id),
  valor        INTEGER NOT NULL,
  medio        TEXT NOT NULL,
  estado       TEXT NOT NULL CHECK (estado IN ('Aprobado','Rechazado','Revertido')),
  consecutivo  TEXT UNIQUE,                          -- HU-08: consecutivo del comprobante
  creado_en    TEXT NOT NULL DEFAULT (${AHORA})
);

CREATE TABLE IF NOT EXISTS resenas (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  pension_id    INTEGER NOT NULL REFERENCES pensiones(id),
  estudiante_id INTEGER NOT NULL REFERENCES usuarios(id),
  reserva_id    INTEGER NOT NULL REFERENCES reservas(id),
  estrellas     INTEGER NOT NULL CHECK (estrellas BETWEEN 1 AND 5),
  comentario    TEXT,
  estado        TEXT NOT NULL DEFAULT 'Publicada' CHECK (estado IN ('Publicada','Reportada','Oculta')),
  creado_en     TEXT NOT NULL DEFAULT (${AHORA})
);

CREATE TABLE IF NOT EXISTS bitacora_verificaciones (   -- HU-03: trazabilidad del administrador
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  pension_id INTEGER NOT NULL REFERENCES pensiones(id),
  admin_id   INTEGER NOT NULL REFERENCES usuarios(id),
  accion     TEXT NOT NULL,
  motivo     TEXT,
  creado_en  TEXT NOT NULL DEFAULT (${AHORA})
);

CREATE TABLE IF NOT EXISTS notificaciones (            -- RF-15
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  mensaje    TEXT NOT NULL,
  leida      INTEGER NOT NULL DEFAULT 0,
  creado_en  TEXT NOT NULL DEFAULT (${AHORA})
);

CREATE TABLE IF NOT EXISTS reportes_pensiones (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  pension_id    INTEGER NOT NULL REFERENCES pensiones(id),
  estudiante_id INTEGER NOT NULL REFERENCES usuarios(id),
  motivo        TEXT NOT NULL,
  detalle       TEXT NOT NULL DEFAULT '',
  estado        TEXT NOT NULL DEFAULT 'Pendiente'
                CHECK (estado IN ('Pendiente','Resuelto','Descartado')),
  creado_en     TEXT NOT NULL DEFAULT (${AHORA})
);

CREATE TABLE IF NOT EXISTS contactos (                  -- aperturas de contacto por WhatsApp
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  pension_id    INTEGER NOT NULL REFERENCES pensiones(id),
  estudiante_id INTEGER NOT NULL REFERENCES usuarios(id),
  tipo          TEXT NOT NULL CHECK (tipo IN ('whatsapp','vista_previa')),
  creado_en     TEXT NOT NULL DEFAULT (${AHORA})
);

CREATE TABLE IF NOT EXISTS borradores (                 -- autoguardado del editor de pensiones
  usuario_id     INTEGER PRIMARY KEY REFERENCES usuarios(id),
  datos          TEXT NOT NULL,
  actualizado_en TEXT NOT NULL DEFAULT (${AHORA})
);

CREATE TABLE IF NOT EXISTS sesiones (                   -- sesiones HTTP (Vercel no conserva memoria entre peticiones)
  sid    TEXT PRIMARY KEY,
  datos  TEXT NOT NULL,
  expira INTEGER NOT NULL                               -- milisegundos desde 1970
);

CREATE TABLE IF NOT EXISTS favoritos (                  -- pensiones guardadas por el estudiante
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  pension_id INTEGER NOT NULL REFERENCES pensiones(id),
  creado_en  TEXT NOT NULL DEFAULT (${AHORA}),
  PRIMARY KEY (usuario_id, pension_id)
);

-- Índices para el catálogo con filtros (RNF-03)
CREATE INDEX IF NOT EXISTS idx_pensiones_estado  ON pensiones(estado);
CREATE INDEX IF NOT EXISTS idx_pensiones_barrio  ON pensiones(barrio);
CREATE INDEX IF NOT EXISTS idx_hab_pension       ON habitaciones(pension_id);
CREATE INDEX IF NOT EXISTS idx_fotos_pension     ON fotos(pension_id);
CREATE INDEX IF NOT EXISTS idx_reservas_hab      ON reservas(habitacion_id);
CREATE INDEX IF NOT EXISTS idx_reservas_est      ON reservas(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_contactos_pension ON contactos(pension_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_expira   ON sesiones(expira);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reporte_pendiente_unico
  ON reportes_pensiones(pension_id, estudiante_id) WHERE estado='Pendiente';
`;

// ---------------------- MIGRACIONES ----------------------
// Las columnas agregadas son las de la adaptación del prototipo. Idempotente: no borra los datos que ya existen.
const COLUMNAS = {
  usuarios: [
    ['foto', 'TEXT'], ['institucion', 'TEXT'], ['programa', 'TEXT'], ['nivel', 'TEXT'],
    ['ciudad', "TEXT DEFAULT 'Sincelejo'"], ['zona', 'TEXT'], ['bio', 'TEXT'], ['relacion', 'TEXT'],
    ['documento', 'TEXT'], ['whatsapp_habilitado', 'INTEGER NOT NULL DEFAULT 0'],
    ['consentimiento_version', 'TEXT'], ['consentimiento_fecha', 'TEXT'],
  ],
  pensiones: [
    ['tipo_habitacion', "TEXT NOT NULL DEFAULT 'Individual'"], ['costos_adicionales', 'TEXT'], ['instituciones', 'TEXT'],
    ['destacado', 'INTEGER NOT NULL DEFAULT 0'], ['motivo_rechazo', 'TEXT'], ['actualizado_en', 'TEXT'], ['miniatura', 'TEXT'],
  ],
  reportes_pensiones: [['decision', 'TEXT'], ['resuelto_en', 'TEXT']],
};
async function migrarColumnas() {
  for (const [tabla, columnas] of Object.entries(COLUMNAS)) {
    const existentes = new Set((await db.prepare(`PRAGMA table_info(${tabla})`).all()).map((c) => c.name));
    for (const [columna, definicion] of columnas)
      if (!existentes.has(columna)) await db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`);
  }
  await db.exec('CREATE INDEX IF NOT EXISTS idx_pensiones_destacado ON pensiones(destacado);');
}

// ---------------------- FOTOGRAFÍAS DE LAS PENSIONES DE DEMOSTRACIÓN ----------------------
// Fotos de Unsplash (licencia libre) en client/public/img/pensiones/. 
const foto = (n) => `/img/pensiones/habitacion-${String(n).padStart(2, '0')}.webp`;
const FOTOS_DEMO = {
  'Pensión Doña Carmen': [1, 2, 22],       'Residencia El Edén': [3, 12, 21],
  'Casa Universitaria La 20': [4, 16, 20], 'Hospedaje Villa Sofía': [5, 6, 13],
  'Pensión La Ceiba': [7, 14, 18],         'Pensión Casa Verde': [16, 4, 9],
  'Pensión El Patio': [8, 10, 20],         'Pensión Luz del Caribe': [17, 19, 21],
  'Pensión Los Almendros': [11, 15, 4],    'Pensión La Terraza': [9, 14, 2],
  'Pensión Casa Serena': [12, 18, 16],     'Pensión El Encuentro': [13, 22, 6],
  'Pensión La Arboleda': [10, 3, 19],
};
const fotosDe = (nombre) => (FOTOS_DEMO[nombre] || [1, 2]).map(foto);

// aqui Reemplazamos las ilustraciones de relleno por fotos reales en bases creadas con versiones anteriores
async function actualizarFotosDemo(tx) {
  const pensiones = await tx.prepare(`SELECT p.id, p.nombre FROM pensiones p
    WHERE NOT EXISTS (SELECT 1 FROM fotos f WHERE f.pension_id = p.id AND f.url NOT LIKE '/img/placeholder%')`).all();
  for (const p of pensiones) {
    if (!FOTOS_DEMO[p.nombre]) continue;
    await tx.prepare('DELETE FROM fotos WHERE pension_id = ?').run(p.id);
    for (const url of fotosDe(p.nombre)) await tx.prepare('INSERT INTO fotos (pension_id,url) VALUES (?,?)').run(p.id, url);
    await tx.prepare('UPDATE pensiones SET miniatura = NULL WHERE id = ?').run(p.id);
  }
}

// ---------------------- DATOS SEMILLA ----------------------
const hash = (c) => bcrypt.hashSync(c, 10);

async function sembrarBase(tx) {
  if ((await tx.prepare('SELECT COUNT(*) AS n FROM usuarios').get()).n > 0) return;
  const insUser = `INSERT INTO usuarios (nombre, correo, clave_hash, telefono, rol, acepta_datos) VALUES (?,?,?,?,?,1)`;
  await tx.prepare(insUser).run('Administrador Plataforma', 'admin@unipension.co', hash('admin123'), '3000000000', 'administrador');
  await tx.prepare(insUser).run('Carmen Vergara', 'propietaria@unipension.co', hash('prop123'), '3011111111', 'propietario');
  await tx.prepare(insUser).run('Luis Mendoza', 'estudiante@unipension.co', hash('est123'), '3022222222', 'estudiante');

  await tx.prepare(`INSERT INTO universidades (nombre,lat,lng) VALUES
    ('CECAR', 9.2748, -75.3906),
    ('Universidad de Sucre (Puerta Roja)', 9.3119, -75.3886),
    ('CUN Sincelejo', 9.3039, -75.3961)`).run();

  const demo = [
    ['Pensión Doña Carmen','Cra 21 # 25-14','La Ford','Casa familiar a 5 minutos de CECAR, ambiente tranquilo.','Internet, Agua, Energía, Lavandería','No visitas después de las 9 pm; silencio después de las 10 pm',350000,100000,9.2801,-75.3922,'Verificada'],
    ['Residencia El Edén','Cll 28 # 18-30','Venecia','Habitaciones amplias con escritorio, cerca de Unisucre.','Internet, Agua, Energía, Alimentación, Espacio de estudio','Prohibido fumar; aseo compartido por turnos',420000,120000,9.3089,-75.3901,'Verificada'],
    ['Casa Universitaria La 20','Cra 20 # 22-08','Centro','Pensión céntrica con rutas de buseta a todas las universidades.','Internet, Agua, Energía, Cocina','Portón cierra a las 11 pm',300000,80000,9.3030,-75.3977,'Verificada'],
    ['Hospedaje Villa Sofía','Cll 31 # 25-50','Las Margaritas','Habitaciones individuales, ideal para estudiantes foráneos.','Internet, Lavandería, Alimentación','Mascotas no permitidas',480000,150000,9.3142,-75.3850,'Pendiente'],
  ];
  for (const d of demo) {
    const { lastInsertRowid: id } = await tx.prepare(`INSERT INTO pensiones
      (propietario_id,nombre,direccion,barrio,descripcion,servicios,reglas,tarifa_mensual,deposito,lat,lng,estado,tipo_habitacion)
      VALUES (2,?,?,?,?,?,?,?,?,?,?,?,'Mixta')`).run(...d);
    await tx.prepare(`INSERT INTO habitaciones (pension_id,codigo,tipo,tarifa) VALUES (?,?,?,?)`).run(id, 'H1', 'individual', d[6]);
    await tx.prepare(`INSERT INTO habitaciones (pension_id,codigo,tipo,tarifa) VALUES (?,?,?,?)`).run(id, 'H2', 'compartida', Math.round(d[6] * 0.7));
    for (const url of fotosDe(d[0])) await tx.prepare('INSERT INTO fotos (pension_id,url) VALUES (?,?)').run(id, url);
  }
}

// Semilla complementaria del prototipo: estudiantes para probar reportes y pensiones para la paginación
async function sembrarPrototipo(tx) {
  if (await tx.prepare(`SELECT id FROM usuarios WHERE correo = 'estudiante2@unipension.co'`).get()) return;
  const insUser = `INSERT INTO usuarios (nombre, correo, clave_hash, telefono, rol, acepta_datos, institucion,
    consentimiento_version, consentimiento_fecha) VALUES (?,?,?,?,?,1,?,?,${AHORA})`;
  await tx.prepare(insUser).run('Laura Montes', 'estudiante2@unipension.co', hash('est123'), '3023333333', 'estudiante', 'CECAR', VERSION_POLITICA);
  await tx.prepare(insUser).run('Daniel Castro', 'estudiante3@unipension.co', hash('est123'), '3024444444', 'estudiante', 'CUN Sincelejo', VERSION_POLITICA);
  await tx.prepare(`UPDATE usuarios SET institucion = 'CECAR' WHERE correo = 'estudiante@unipension.co' AND institucion IS NULL`).run();
  await tx.prepare(`UPDATE usuarios SET relacion = 'Propietario', documento = 'DEMO-CV-001',
    bio = 'Arrienda habitaciones a estudiantes desde hace varios años. Perfil de demostración.'
    WHERE correo = 'propietaria@unipension.co' AND relacion IS NULL`).run();

  const prop = await tx.prepare(`SELECT id FROM usuarios WHERE correo = 'propietaria@unipension.co'`).get();
  if (!prop) return;
  // [nombre, dirección, barrio, servicios, tarifa, tipo, capacidad, cupos, lat, lng, destacado, institución]
  const extra = [
    ['Pensión La Ceiba', 'Cll 23 # 19-40', 'Centro', 'Internet, Alimentación, Lavandería, Espacio de estudio', 380000, 'Individual', 4, 2, 9.3021, -75.3955, 1, 'CECAR'],
    ['Pensión Casa Verde', 'Cra 17 # 30-12', 'La Ford', 'Internet, Cocina, Agua', 295000, 'Compartida', 6, 3, 9.2865, -75.3930, 0, 'CECAR'],
    ['Pensión El Patio', 'Cll 26 # 14-21', 'Venecia', 'Internet, Cocina, Lavandería, Agua, Energía', 340000, 'Individual', 3, 1, 9.3101, -75.3912, 0, 'Universidad de Sucre (Puerta Roja)'],
    ['Pensión Luz del Caribe', 'Cra 25 # 12-05', 'Majagual', 'Internet, Alimentación, Baño privado', 520000, 'Individual', 4, 3, 9.2950, -75.4010, 1, 'CUN Sincelejo'],
    ['Pensión Los Almendros', 'Cll 34 # 22-18', 'Los Alpes', 'Internet, Agua, Energía, Cocina', 270000, 'Compartida', 8, 4, 9.3170, -75.3885, 0, 'Universidad de Sucre (Puerta Roja)'],
    ['Pensión La Terraza', 'Cra 19 # 27-33', 'La Palma', 'Internet, Lavandería, Espacio de estudio, Baño privado', 450000, 'Individual', 5, 2, 9.3065, -75.3930, 0, 'CECAR'],
    ['Pensión Casa Serena', 'Cll 21 # 16-09', 'Centro', 'Internet, Alimentación, Agua, Energía', 390000, 'Compartida', 6, 1, 9.3012, -75.3990, 0, 'CUN Sincelejo'],
    ['Pensión El Encuentro', 'Cra 28 # 18-44', 'Majagual', 'Internet, Cocina, Agua', 310000, 'Compartida', 4, 2, 9.2930, -75.4025, 0, 'CECAR'],
    ['Pensión La Arboleda', 'Cll 30 # 11-60', 'Los Alpes', 'Internet, Alimentación, Lavandería, Agua, Energía', 430000, 'Individual', 3, 1, 9.3155, -75.3860, 0, 'Universidad de Sucre (Puerta Roja)'],
  ];
  for (const [i, [nombre, dir, barrio, servicios, tarifa, tipo, cap, cupos, lat, lng, dest, inst]] of extra.entries()) {
    const { lastInsertRowid: id } = await tx.prepare(`INSERT INTO pensiones
      (propietario_id,nombre,direccion,barrio,descripcion,servicios,reglas,tarifa_mensual,deposito,lat,lng,estado,
       tipo_habitacion,costos_adicionales,instituciones,destacado)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,'Verificada',?,?,?,?)`).run(prop.id, nombre, dir, barrio,
      `${nombre}: ${tipo === 'Individual' ? 'habitaciones individuales y ambiente de estudio' : 'habitaciones compartidas y zonas de convivencia'}. Registro de demostración para el prototipo académico.`,
      servicios,
      i % 2 ? 'Respetar horarios de descanso y mantener limpias las zonas comunes.' : 'Ambiente libre de humo. Acordar las visitas previamente.',
      tarifa, Math.round(tarifa / 4 / 10000) * 10000, lat, lng,
      tipo, i % 3 ? 'Sin cargos adicionales declarados' : 'Energía según consumo, consultar condiciones.', inst, dest);
    for (let k = 1; k <= cap; k++)
      await tx.prepare(`INSERT INTO habitaciones (pension_id,codigo,tipo,tarifa,estado) VALUES (?,?,?,?,?)`)
        .run(id, `H${k}`, tipo.toLowerCase(), tarifa, k <= cupos ? 'Libre' : 'Ocupada');
    for (const url of fotosDe(nombre)) await tx.prepare('INSERT INTO fotos (pension_id,url) VALUES (?,?)').run(id, url);
  }
}

// Arrendadores de demostración: la oferta real de Sincelejo es de muchos propietarios, no de uno solo.
// Datos ficticios (documento DEMO-, WhatsApp sin autorizar). Clave de todos: prop123.
const ARRENDADORES_DEMO = [
  // [nombre, correo, teléfono, relación, documento, presentación]
  ['Rafael Pérez Arrieta', 'propietario2@unipension.co', '3015550102', 'Propietario', 'DEMO-RP-002',
    'Docente pensionado; arrienda habitaciones en su casa de Venecia y La Palma desde 2015. Perfil de demostración.'],
  ['Martha Salgado Ruiz', 'propietario3@unipension.co', '3015550103', 'Persona autorizada para arrendar', 'DEMO-MS-003',
    'Administra pensiones familiares en el Centro, cerca de las rutas a las universidades. Perfil de demostración.'],
  ['Jorge Benítez Mercado', 'propietario4@unipension.co', '3015550104', 'Propietario', 'DEMO-JB-004',
    'Ofrece habitaciones compartidas económicas para estudiantes foráneos. Perfil de demostración.'],
  ['Yolanda Meza Tovar', 'propietario5@unipension.co', '3015550105', 'Propietario', 'DEMO-YM-005',
    'Casa amplia con zonas comunes y ambiente tranquilo para estudiar. Perfil de demostración.'],
];
// Quién publica cada pensión de demostración (las que no están aquí siguen con Carmen Vergara)
const ARRENDADOR_DE = {
  'Residencia El Edén': 'propietario2@unipension.co', 'Pensión El Patio': 'propietario2@unipension.co',
  'Pensión La Terraza': 'propietario2@unipension.co',
  'Casa Universitaria La 20': 'propietario3@unipension.co', 'Pensión La Ceiba': 'propietario3@unipension.co',
  'Pensión Casa Serena': 'propietario3@unipension.co',
  'Pensión Casa Verde': 'propietario4@unipension.co', 'Pensión Los Almendros': 'propietario4@unipension.co',
  'Hospedaje Villa Sofía': 'propietario5@unipension.co', 'Pensión El Encuentro': 'propietario5@unipension.co',
};

async function sembrarArrendadores(tx) {
  if (await tx.prepare(`SELECT valor FROM meta WHERE clave = 'semilla_arrendadores'`).get()) return;
  const carmen = await tx.prepare(`SELECT id FROM usuarios WHERE correo = 'propietaria@unipension.co'`).get();
  if (carmen) {
    const ids = {};
    for (const [nombre, correo, telefono, relacion, documento, bio] of ARRENDADORES_DEMO) {
      const existe = await tx.prepare('SELECT id FROM usuarios WHERE correo = ?').get(correo);
      ids[correo] = existe ? existe.id : (await tx.prepare(`INSERT INTO usuarios
          (nombre, correo, clave_hash, telefono, rol, acepta_datos, relacion, documento, bio, consentimiento_version, consentimiento_fecha)
          VALUES (?,?,?,?,'propietario',1,?,?,?,?,${AHORA})`)
        .run(nombre, correo, hash('prop123'), telefono, relacion, documento, bio, VERSION_POLITICA)).lastInsertRowid;
    }
    // Solo se trasladan pensiones de Carmen SIN reservas vigentes: una solicitud en curso no cambia de bandeja
    for (const [pension, correo] of Object.entries(ARRENDADOR_DE)) {
      await tx.prepare(`UPDATE pensiones SET propietario_id = ? WHERE nombre = ? AND propietario_id = ?
          AND NOT EXISTS (SELECT 1 FROM reservas r JOIN habitaciones h ON h.id = r.habitacion_id
                          WHERE h.pension_id = pensiones.id AND r.estado IN ('Pendiente de pago','Pagada','Confirmada'))`)
        .run(ids[correo], pension, carmen.id);
    }
  }
  await tx.prepare(`INSERT INTO meta (clave, valor) VALUES ('semilla_arrendadores', ?)`).run(new Date().toISOString());
}

// Reseñas de demostración (HU-10) para la sección «Mejor valoradas». Cada reseña se apoya en una
// estadía Finalizada del estudiante, como exige la regla de la historia. Se siembran una sola vez
// (marca en meta), así que si el administrador las oculta o se borran no vuelven a aparecer.
const RESENAS_DEMO = [
  // [pensión, correo del estudiante, estrellas, comentario, fecha de ingreso]
  ['Pensión Luz del Caribe', 'estudiante@unipension.co', 5, 'Habitación amplia y con baño privado. La comida es casera y a buena hora.', '2026-02-02'],
  ['Pensión Luz del Caribe', 'estudiante2@unipension.co', 5, 'Muy tranquila para estudiar y el internet nunca falló en todo el semestre.', '2026-02-09'],
  ['Pensión Luz del Caribe', 'estudiante3@unipension.co', 4, 'Todo bien; queda un poco lejos de la CUN, pero hay buseta cerca.', '2026-03-01'],
  ['Residencia El Edén', 'estudiante2@unipension.co', 5, 'Escritorio cómodo y buena luz. La dueña está pendiente de todo.', '2026-01-26'],
  ['Residencia El Edén', 'estudiante3@unipension.co', 5, 'A pocas cuadras de Unisucre. El aseo por turnos funciona bien.', '2026-02-16'],
  ['Residencia El Edén', 'estudiante@unipension.co', 4, 'Buena relación precio y calidad. A veces hay ruido el fin de semana.', '2026-03-09'],
  ['Pensión La Ceiba', 'estudiante@unipension.co', 5, 'Céntrica y con lavandería incluida, eso ahorra bastante.', '2026-01-19'],
  ['Pensión La Ceiba', 'estudiante3@unipension.co', 4, 'Ambiente de estudio de verdad. Las habitaciones son algo pequeñas.', '2026-02-23'],
  ['Pensión Doña Carmen', 'estudiante3@unipension.co', 4, 'Casa familiar, muy segura y cerca de CECAR.', '2026-01-12'],
  ['Pensión Doña Carmen', 'estudiante2@unipension.co', 4, 'Las reglas de horario son estrictas, pero se respeta el descanso.', '2026-02-02'],
  ['Pensión La Terraza', 'estudiante2@unipension.co', 4, 'La terraza es ideal para estudiar en la tarde.', '2026-03-02'],
  ['Pensión Casa Verde', 'estudiante@unipension.co', 3, 'Económica. La cocina compartida se llena a la hora del almuerzo.', '2026-02-09'],
];

async function sembrarResenas(tx) {
  if (await tx.prepare(`SELECT valor FROM meta WHERE clave = 'semilla_resenas'`).get()) return;
  if ((await tx.prepare('SELECT COUNT(*) AS n FROM resenas').get()).n === 0) {
    for (const [pension, correo, estrellas, comentario, ingreso] of RESENAS_DEMO) {
      const fila = await tx.prepare(`SELECT p.id AS pension_id, h.id AS habitacion_id, h.tarifa, p.deposito,
          (SELECT id FROM usuarios WHERE correo = ?) AS estudiante_id
        FROM pensiones p JOIN habitaciones h ON h.pension_id = p.id
        WHERE p.nombre = ? ORDER BY h.id LIMIT 1`).get(correo, pension);
      if (!fila?.estudiante_id) continue;
      // Estadía de 4 meses ya terminada; la habitación no cambia de estado (los cupos actuales se conservan)
      const { lastInsertRowid: reservaId } = await tx.prepare(`INSERT INTO reservas
        (habitacion_id, estudiante_id, fecha_ingreso, meses, valor_total, estado, creado_en)
        VALUES (?,?,?,4,?,'Finalizada',?)`).run(fila.habitacion_id, fila.estudiante_id, ingreso,
        fila.tarifa * 4 + fila.deposito, `${ingreso} 09:00:00`);
      await tx.prepare(`INSERT INTO resenas (pension_id, estudiante_id, reserva_id, estrellas, comentario, creado_en)
        VALUES (?,?,?,?,?,?)`).run(fila.pension_id, fila.estudiante_id, reservaId, estrellas, comentario,
        `${ingreso.slice(0, 5)}0${Number(ingreso.slice(5, 7)) + 4}-15 18:00:00`);
    }
  }
  await tx.prepare(`INSERT INTO meta (clave, valor) VALUES ('semilla_resenas', ?)`).run(new Date().toISOString());
}

// ---------------------- INICIALIZACIÓN ----------------------
// Si la base ya está en la versión actual solo cuesta una consulta (importante en arranques en frío de Vercel)
async function inicializar() {
  try {
    const v = await db.prepare(`SELECT valor FROM meta WHERE clave = 'esquema'`).get();
    if (v?.valor === VERSION_ESQUEMA) return;
  } catch { /* la tabla meta aún no existe */ }
  await db.exec(ESQUEMA);
  await migrarColumnas();
  await db.transaction(async (tx) => {
    await sembrarBase(tx);
    await sembrarPrototipo(tx);
    await actualizarFotosDemo(tx);
    await sembrarResenas(tx);
    await sembrarArrendadores(tx);
    await tx.prepare(`INSERT INTO meta (clave, valor) VALUES ('esquema', ?)
      ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`).run(VERSION_ESQUEMA);
  });
  console.log(`Base de datos lista (esquema ${VERSION_ESQUEMA}).`);
}

db.listo = inicializar();
db.listo.catch((err) => console.error('No se pudo inicializar la base de datos:', err));

module.exports = db;
