// =============================================================
// UniPensión Sincelejo — Capa de persistencia (SQLite)
// Responsable: Administrador de Base de Datos
// Crea el esquema y los datos semilla la primera vez que se ejecuta.
// =============================================================
const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

// DB_PATH permite usar otra base (por ejemplo, una temporal para las pruebas automáticas)
const db = new Database(process.env.DB_PATH || path.join(__dirname, 'unipension.db'));
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

CREATE TABLE IF NOT EXISTS reportes_pensiones (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  pension_id    INTEGER NOT NULL REFERENCES pensiones(id),
  estudiante_id INTEGER NOT NULL REFERENCES usuarios(id),
  motivo        TEXT NOT NULL,
  detalle       TEXT NOT NULL DEFAULT '',
  estado        TEXT NOT NULL DEFAULT 'Pendiente'
                CHECK (estado IN ('Pendiente','Resuelto','Descartado')),
  creado_en     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Índices para el catálogo con filtros (RNF-03, tarea del Administrador DB en Sprint 2)
CREATE INDEX IF NOT EXISTS idx_pensiones_estado  ON pensiones(estado);
CREATE INDEX IF NOT EXISTS idx_pensiones_barrio  ON pensiones(barrio);
CREATE INDEX IF NOT EXISTS idx_hab_pension       ON habitaciones(pension_id);
CREATE INDEX IF NOT EXISTS idx_reservas_hab      ON reservas(habitacion_id);
CREATE INDEX IF NOT EXISTS idx_reservas_est      ON reservas(estudiante_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reporte_pendiente_unico
  ON reportes_pensiones(pension_id, estudiante_id) WHERE estado='Pendiente';
`);

// ---------------------- MIGRACIONES (adaptación al prototipo inicial) ----------------------
// Agrega columnas nuevas sin borrar datos existentes. Se ejecuta en cada arranque y es idempotente.
function asegurarColumna(tabla, columna, definicion) {
  const existe = db.prepare(`PRAGMA table_info(${tabla})`).all().some((c) => c.name === columna);
  if (!existe) db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`);
}
// Perfil ampliado del usuario (pantallas Perfil / Editar perfil del prototipo)
asegurarColumna('usuarios', 'foto', 'TEXT');                       // data URL comprimida en el navegador
asegurarColumna('usuarios', 'institucion', 'TEXT');                // estudiante
asegurarColumna('usuarios', 'programa', 'TEXT');
asegurarColumna('usuarios', 'nivel', 'TEXT');
asegurarColumna('usuarios', 'ciudad', "TEXT DEFAULT 'Sincelejo'");
asegurarColumna('usuarios', 'zona', 'TEXT');
asegurarColumna('usuarios', 'bio', 'TEXT');                        // propietario: presentación pública
asegurarColumna('usuarios', 'relacion', 'TEXT');                   // Propietario / Persona autorizada…
asegurarColumna('usuarios', 'documento', 'TEXT');                  // privado, nunca se publica
asegurarColumna('usuarios', 'whatsapp_habilitado', 'INTEGER NOT NULL DEFAULT 0');
asegurarColumna('usuarios', 'consentimiento_version', 'TEXT');     // RNF-07: versión aceptada
asegurarColumna('usuarios', 'consentimiento_fecha', 'TEXT');
// Publicación ampliada (editor de 3 pasos, plan Destacado, moderación)
asegurarColumna('pensiones', 'tipo_habitacion', "TEXT NOT NULL DEFAULT 'Individual'");
asegurarColumna('pensiones', 'costos_adicionales', 'TEXT');
asegurarColumna('pensiones', 'instituciones', 'TEXT');             // referencias separadas por coma
asegurarColumna('pensiones', 'destacado', 'INTEGER NOT NULL DEFAULT 0');
asegurarColumna('pensiones', 'motivo_rechazo', 'TEXT');
asegurarColumna('pensiones', 'actualizado_en', 'TEXT');
asegurarColumna('pensiones', 'miniatura', 'TEXT');               // miniatura liviana para el catálogo
// Reportes de información: decisión del administrador
asegurarColumna('reportes_pensiones', 'decision', 'TEXT');
asegurarColumna('reportes_pensiones', 'resuelto_en', 'TEXT');

db.exec(`
CREATE TABLE IF NOT EXISTS contactos (                  -- aperturas de contacto por WhatsApp
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  pension_id    INTEGER NOT NULL REFERENCES pensiones(id),
  estudiante_id INTEGER NOT NULL REFERENCES usuarios(id),
  tipo          TEXT NOT NULL CHECK (tipo IN ('whatsapp','vista_previa')),
  creado_en     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS borradores (                 -- autoguardado del editor de pensiones
  usuario_id     INTEGER PRIMARY KEY REFERENCES usuarios(id),
  datos          TEXT NOT NULL,
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_pensiones_destacado ON pensiones(destacado);
CREATE INDEX IF NOT EXISTS idx_contactos_pension   ON contactos(pension_id);
`);

// ---------------------- DATOS SEMILLA ----------------------
const VERSION_POLITICA = '2026-01-prototipo';
const hash = (c) => bcrypt.hashSync(c, 10);
const hayUsuarios = db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n;
if (hayUsuarios === 0) {
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
    ['Pensión Doña Carmen','Cra 21 # 25-14','La Ford','Casa familiar a 5 minutos de CECAR, ambiente tranquilo.','Internet, Agua, Energía, Lavandería','No visitas después de las 9 pm; silencio después de las 10 pm',350000,100000,9.2801,-75.3922,'Verificada'],
    ['Residencia El Edén','Cll 28 # 18-30','Venecia','Habitaciones amplias con escritorio, cerca de Unisucre.','Internet, Agua, Energía, Alimentación, Espacio de estudio','Prohibido fumar; aseo compartido por turnos',420000,120000,9.3089,-75.3901,'Verificada'],
    ['Casa Universitaria La 20','Cra 20 # 22-08','Centro','Pensión céntrica con rutas de buseta a todas las universidades.','Internet, Agua, Energía, Cocina','Portón cierra a las 11 pm',300000,80000,9.3030,-75.3977,'Verificada'],
    ['Hospedaje Villa Sofía','Cll 31 # 25-50','Las Margaritas','Habitaciones individuales, ideal para estudiantes foráneos.','Internet, Lavandería, Alimentación','Mascotas no permitidas',480000,150000,9.3142,-75.3850,'Pendiente'],
  ];
  for (const d of demo) {
    const r = insP.run(2, ...d);
    insH.run(r.lastInsertRowid, 'H1', 'individual', d[6]);
    insH.run(r.lastInsertRowid, 'H2', 'compartida', Math.round(d[6]*0.7));
    insF.run(r.lastInsertRowid, '/img/placeholder1.svg');
    insF.run(r.lastInsertRowid, '/img/placeholder2.svg');
  }
  db.prepare(`UPDATE pensiones SET tipo_habitacion = 'Mixta'`).run();
  console.log('Base de datos inicializada con datos semilla.');
}

// Semilla complementaria del prototipo (se agrega una sola vez, también sobre bases ya existentes):
// estudiantes adicionales para probar reportes y pensiones de demostración para la paginación.
if (!db.prepare(`SELECT id FROM usuarios WHERE correo = 'estudiante2@unipension.co'`).get()) {
  const tx = db.transaction(() => {
    const insUser = db.prepare(`INSERT INTO usuarios (nombre, correo, clave_hash, telefono, rol, acepta_datos, institucion,
      consentimiento_version, consentimiento_fecha) VALUES (?,?,?,?,?,1,?,?,datetime('now','localtime'))`);
    insUser.run('Laura Montes', 'estudiante2@unipension.co', hash('est123'), '3023333333', 'estudiante', 'CECAR', VERSION_POLITICA);
    insUser.run('Daniel Castro', 'estudiante3@unipension.co', hash('est123'), '3024444444', 'estudiante', 'CUN Sincelejo', VERSION_POLITICA);
    db.prepare(`UPDATE usuarios SET institucion = 'CECAR' WHERE correo = 'estudiante@unipension.co' AND institucion IS NULL`).run();
    db.prepare(`UPDATE usuarios SET relacion = 'Propietario', documento = 'DEMO-CV-001',
      bio = 'Arrienda habitaciones a estudiantes desde hace varios años. Perfil de demostración.'
      WHERE correo = 'propietaria@unipension.co' AND relacion IS NULL`).run();

    const prop = db.prepare(`SELECT id FROM usuarios WHERE correo = 'propietaria@unipension.co'`).get();
    if (!prop) return;
    const insP = db.prepare(`INSERT INTO pensiones
      (propietario_id,nombre,direccion,barrio,descripcion,servicios,reglas,tarifa_mensual,deposito,lat,lng,estado,
       tipo_habitacion,costos_adicionales,instituciones,destacado)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insH = db.prepare(`INSERT INTO habitaciones (pension_id,codigo,tipo,tarifa,estado) VALUES (?,?,?,?,?)`);
    const insF = db.prepare(`INSERT INTO fotos (pension_id,url) VALUES (?,?)`);
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
    extra.forEach(([nombre, dir, barrio, servicios, tarifa, tipo, cap, cupos, lat, lng, dest, inst], i) => {
      const r = insP.run(prop.id, nombre, dir, barrio,
        `${nombre}: ${tipo === 'Individual' ? 'habitaciones individuales y ambiente de estudio' : 'habitaciones compartidas y zonas de convivencia'}. Registro de demostración para el prototipo académico.`,
        servicios,
        i % 2 ? 'Respetar horarios de descanso y mantener limpias las zonas comunes.' : 'Ambiente libre de humo. Acordar las visitas previamente.',
        tarifa, Math.round(tarifa / 4 / 10000) * 10000, lat, lng, 'Verificada',
        tipo, i % 3 ? 'Sin cargos adicionales declarados' : 'Energía según consumo, consultar condiciones.', inst, dest);
      for (let k = 1; k <= cap; k++)
        insH.run(r.lastInsertRowid, `H${k}`, tipo.toLowerCase(), tarifa, k <= cupos ? 'Libre' : 'Ocupada');
      insF.run(r.lastInsertRowid, i % 2 ? '/img/placeholder2.svg' : '/img/placeholder1.svg');
      insF.run(r.lastInsertRowid, i % 2 ? '/img/placeholder1.svg' : '/img/placeholder2.svg');
    });
  });
  tx();
}

db.VERSION_POLITICA = VERSION_POLITICA;
module.exports = db;
