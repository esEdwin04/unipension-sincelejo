// =============================================================
// Almacén de sesiones de express-session sobre la base de datos (tabla `sesiones`).
// En Vercel cada petición puede llegar a una instancia distinta y la memoria no se conserva,
// así que la sesión (usuario y rol, RNF-06) debe guardarse en la base compartida.
// =============================================================
const session = require('express-session');

const SIETE_DIAS = 7 * 24 * 3600 * 1000;

class AlmacenSesiones extends session.Store {
  constructor(db) {
    super();
    this.db = db;
  }

  expiraDe(datos) {
    const fin = datos?.cookie?.expires ? new Date(datos.cookie.expires).getTime() : NaN;
    return Number.isFinite(fin) ? fin : Date.now() + SIETE_DIAS;
  }

  get(sid, cb) {
    this.db.prepare('SELECT datos, expira FROM sesiones WHERE sid = ?').get(sid)
      .then((fila) => cb(null, fila && fila.expira > Date.now() ? JSON.parse(fila.datos) : null), cb);
  }

  set(sid, datos, cb = () => {}) {
    this.db.prepare(`INSERT INTO sesiones (sid, datos, expira) VALUES (?,?,?)
        ON CONFLICT(sid) DO UPDATE SET datos = excluded.datos, expira = excluded.expira`)
      .run(sid, JSON.stringify(datos), this.expiraDe(datos))
      // De vez en cuando se borran las sesiones vencidas (sin bloquear la respuesta)
      .then(() => (Math.random() < 0.05
        ? this.db.prepare('DELETE FROM sesiones WHERE expira < ?').run(Date.now()).catch(() => {}) : null))
      .then(() => cb(null), cb);
  }

  touch(sid, datos, cb = () => {}) {
    this.db.prepare('UPDATE sesiones SET expira = ? WHERE sid = ?').run(this.expiraDe(datos), sid)
      .then(() => cb(null), cb);
  }

  destroy(sid, cb = () => {}) {
    this.db.prepare('DELETE FROM sesiones WHERE sid = ?').run(sid).then(() => cb(null), cb);
  }
}

module.exports = { AlmacenSesiones, SIETE_DIAS };
