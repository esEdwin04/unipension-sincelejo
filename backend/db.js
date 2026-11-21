// =============================================================
// UniPensión Sincelejo — Capa de persistencia (SQLite)
// Responsable: Administrador de Base de Datos
// Crea el esquema y los datos semilla la primera vez que se ejecuta.
// =============================================================
const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const db = new Database(path.join(__dirname, 'unipension.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------------------- ESQUEMA ----------------------
db.exec(`
CREATE TABLE IF NOT EXISTS usuarios (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre        TEXT NOT NULL,
  correo        TEXT NOT NULL UNIQUE,
  clave_hash    TEXT NOT NULL,
  telefono      TEXT,
  rol           TEXT NOT NULL CHECK (rol IN ('estudiante','propietario','administrador')),
  acepta_datos  INTEGER NOT NULL DEFAULT 0,          -- Ley 1581 de 2012 (RNF-07)
  creado_en     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
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
  creado_en      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
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
  creado_en       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS pagos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  reserva_id   INTEGER NOT NULL REFERENCES reservas(id),
  valor        INTEGER NOT NULL,
  medio        TEXT NOT NULL,
  estado       TEXT NOT NULL CHECK (estado IN ('Aprobado','Rechazado','Revertido')),
  consecutivo  TEXT UNIQUE,                          -- HU-08: consecutivo del comprobante
  creado_en    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS resenas (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  pension_id    INTEGER NOT NULL REFERENCES pensiones(id),
  estudiante_id INTEGER NOT NULL REFERENCES usuarios(id),
  reserva_id    INTEGER NOT NULL REFERENCES reservas(id),
  estrellas     INTEGER NOT NULL CHECK (estrellas BETWEEN 1 AND 5),
  comentario    TEXT,
  estado        TEXT NOT NULL DEFAULT 'Publicada' CHECK (estado IN ('Publicada','Reportada','Oculta')),
  creado_en     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS bitacora_verificaciones (   -- HU-03: trazabilidad del administrador
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  pension_id INTEGER NOT NULL REFERENCES pensiones(id),
  admin_id   INTEGER NOT NULL REFERENCES usuarios(id),
  accion     TEXT NOT NULL,
  motivo     TEXT,
  creado_en  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS notificaciones (            -- RF-15
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  mensaje    TEXT NOT NULL,
  leida      INTEGER NOT NULL DEFAULT 0,
  creado_en  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Índices para el catálogo con filtros (RNF-03, tarea del Administrador DB en Sprint 2)
CREATE INDEX IF NOT EXISTS idx_pensiones_estado  ON pensiones(estado);
CREATE INDEX IF NOT EXISTS idx_pensiones_barrio  ON pensiones(barrio);
CREATE INDEX IF NOT EXISTS idx_hab_pension       ON habitaciones(pension_id);
CREATE INDEX IF NOT EXISTS idx_reservas_hab      ON reservas(habitacion_id);
CREATE INDEX IF NOT EXISTS idx_reservas_est      ON reservas(estudiante_id);
`);

// ---------------------- DATOS SEMILLA ----------------------
const hayUsuarios = db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n;
if (hayUsuarios === 0) {
  const hash = (c) => bcrypt.hashSync(c, 10);
  const insUser = db.prepare(`INSERT INTO usuarios (nombre, correo, clave_hash, telefono, rol, acepta_datos) VALUES (?,?,?,?,?,1)`);
  insUser.run('Administrador Plataforma', 'admin@unipension.co',       hash('admin123'), '3000000000', 'administrador');
  insUser.run('Carmen Vergara',           'propietaria@unipension.co', hash('prop123'),  '3011111111', 'propietario');
  insUser.run('Luis Mendoza',             'estudiante@unipension.co',  hash('est123'),   '3022222222', 'estudiante');

  db.prepare(`INSERT INTO universidades (nombre,lat,lng) VALUES
    ('CECAR', 9.2748, -75.3906),
    ('Universidad de Sucre (Puerta Roja)', 9.3119, -75.3886),
    ('CUN Sincelejo', 9.3039, -75.3961)`).run();

  const insP = db.prepare(`INSERT INTO pensiones
    (propietario_id,nombre,direccion,barrio,descripcion,servicios,reglas,tarifa_mensual,deposito,lat,lng,estado)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insH = db.prepare(`INSERT INTO habitaciones (pension_id,codigo,tipo,tarifa) VALUES (?,?,?,?)`);
  const insF = db.prepare(`INSERT INTO fotos (pension_id,url) VALUES (?,?)`);

  const demo = [
    ['Pensión Doña Carmen','Cra 21 # 25-14','La Ford','Casa familiar a 5 minutos de CECAR, ambiente tranquilo.','Internet, Servicios públicos, Lavandería','No visitas después de las 9 pm; silencio después de las 10 pm',350000,100000,9.2801,-75.3922,'Verificada'],
    ['Residencia El Edén','Cll 28 # 18-30','Venecia','Habitaciones amplias con escritorio, cerca de Unisucre.','Internet, Servicios públicos, Alimentación','Prohibido fumar; aseo compartido por turnos',420000,120000,9.3089,-75.3901,'Verificada'],
    ['Casa Universitaria La 20','Cra 20 # 22-08','Centro','Pensión céntrica con rutas de buseta a todas las universidades.','Internet, Servicios públicos','Portón cierra a las 11 pm',300000,80000,9.3030,-75.3977,'Verificada'],
    ['Hospedaje Villa Sofía','Cll 31 # 25-50','Las Margaritas','Habitaciones individuales, ideal para estudiantes foráneos.','Internet, Lavandería, Alimentación','Mascotas no permitidas',480000,150000,9.3142,-75.3850,'Pendiente'],
  ];
  for (const d of demo) {
    const r = insP.run(2, ...d);
    insH.run(r.lastInsertRowid, 'H1', 'individual', d[6]);
    insH.run(r.lastInsertRowid, 'H2', 'compartida', Math.round(d[6]*0.7));
    insF.run(r.lastInsertRowid, '/img/placeholder1.svg');
    insF.run(r.lastInsertRowid, '/img/placeholder2.svg');
  }
  console.log('Base de datos inicializada con datos semilla.');
}

module.exports = db;
