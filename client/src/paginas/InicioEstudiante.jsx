// ----------------------------------------------------------------------------------------
// Respondsable: Edwin Diaz
// Inicio del estudiante (y de visitantes sin cuenta) — rediseño v0.5 «Descubre tu lugar».
// Recorrido de arriba abajo: portada con collage y buscador → mejor valoradas → explorar por
// barrio → pensiones para descubrir → cómo funciona.
// Las secciones aparecen al hacer scroll (componentes/revelar.js).
// ----------------------------------------------------------------------------------------
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API, cop, primerNombre } from '../api.js';
import { useSesion } from '../App.jsx';
import TarjetaPension from '../componentes/TarjetaPension.jsx';
import Icono from '../componentes/Icono.jsx';
import { Aviso, Cargando, Vacio } from '../componentes/ui.jsx';

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

export default function InicioEstudiante() {
  const { usuario } = useSesion();
  const nav = useNavigate();
  const [pensiones, setPensiones] = useState(null);
  const [valoradas, setValoradas] = useState(null);
  const [unis, setUnis] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    API.get('/pensiones').then(setPensiones).catch((e) => setError(e.message));
    API.get('/pensiones/mejor-valoradas?limite=3').then(setValoradas).catch(() => setValoradas([]));
    API.get('/pensiones/universidades').then(setUnis).catch(() => {});
  }, []);

  // Cifras reales del catálogo y agrupación por barrio para «Explora por barrio»
  const cupos = pensiones?.reduce((t, p) => t + (p.cupos || 0), 0) ?? 0;
  const barrios = useMemo(() => {
    const grupos = {};
    for (const p of pensiones || []) {
      const g = (grupos[p.barrio] ||= { barrio: p.barrio, total: 0, desde: Infinity, foto: p.foto });
      g.total += 1;
      g.desde = Math.min(g.desde, p.tarifa_mensual);
    }
    return Object.values(grupos).sort((a, b) => b.total - a.total || a.barrio.localeCompare(b.barrio)).slice(0, 4);
  }, [pensiones]);
  const mejor = valoradas?.[0];

  return (
    <main className="contenido">
      {/* ---------- Portada ---------- */}
      <section className="portada" aria-labelledby="titulo-portada">
        <div className="portada-texto">
          <p className="kicker entrada"><span /> Pensiones verificadas en Sincelejo</p>
          <small className="entrada" style={{ '--d': '60ms' }}>{usuario ? `Hola, ${primerNombre(usuario.nombre)}` : 'Tu próxima etapa empieza aquí'}</small>
          <h1 id="titulo-portada" className="entrada" style={{ '--d': '120ms' }}>Tu lugar en Sincelejo, <em>a pasos</em> del campus.</h1>
          <p className="entrada" style={{ '--d': '200ms' }}>Compara pensiones revisadas por UniPensión, mira fotos reales, habla con el arrendador por WhatsApp y aparta tu cupo en línea.</p>
          <button className="buscador-falso entrada" style={{ '--d': '280ms' }} onClick={() => nav('/buscar')}>
            <Icono nombre="buscar" /><span>Barrio, universidad o servicio…</span><span className="ir"><Icono nombre="flecha" tam={20} /></span>
          </button>
          {unis.length > 0 && (
            <nav className="atajos entrada" style={{ '--d': '360ms' }} aria-label="Buscar cerca de una universidad">
              {unis.map((u) => (
                <Link key={u.id} to={`/buscar?universidad_id=${u.id}&orden=cercania`}><Icono nombre="libro" tam={15} />Cerca de {u.nombre.split(' (')[0]}</Link>
              ))}
            </nav>
          )}
          {pensiones && (
            <div className="cifras entrada" style={{ '--d': '440ms' }}>
              <div><b>{pensiones.length}</b><small>pensiones disponibles</small></div>
              <div><b>{cupos}</b><small>cupos libres hoy</small></div>
              <div><b>{new Set(pensiones.map((p) => p.barrio)).size}</b><small>barrios</small></div>
            </div>
          )}
        </div>
        <div className="collage" aria-hidden="true">
          <img className="c1 entrada" src="/img/pensiones/habitacion-17.webp" alt="" style={{ '--d': '150ms' }} />
          <img className="c2 entrada" src="/img/pensiones/habitacion-19.webp" alt="" style={{ '--d': '320ms' }} />
          <img className="c3 entrada" src="/img/pensiones/habitacion-03.webp" alt="" style={{ '--d': '460ms' }} />
          {mejor && (
            <div className="collage-nota entrada" style={{ '--d': '600ms' }}>
              <span className="estrellas">★ {String(mejor.calificacion).replace('.', ',')}</span>
              <b>{mejor.nombre}</b><small>{plural(mejor.total_resenas, 'reseña', 'reseñas')} de estudiantes</small>
            </div>
          )}
        </div>
      </section>

      {usuario && (
        <section className="tarjeta-inst">
          <span className="ic"><Icono nombre="libro" tam={24} /></span>
          <div><small>TU PUNTO DE PARTIDA</small><b>{usuario.institucion || 'Selecciona una institución'}</b>
            <span>Filtra el catálogo por distancia a tu campus</span></div>
          <button className="btn sec chico" onClick={() => nav('/perfil/editar')}><Icono nombre="editar" tam={16} /> Cambiar</button>
        </section>
      )}
      <Aviso tipo="error">{error}</Aviso>

      {/* ---------- Mejor valoradas (HU-10) ---------- */}
      {valoradas?.length > 0 && (
        <section className="seccion" aria-labelledby="titulo-valoradas">
          <div className="cabeza-seccion">
            <div><p className="eyebrow">Opiniones de quienes ya vivieron allí</p><h2 id="titulo-valoradas">Mejor valoradas</h2></div>
            <Link className="btn-link" to="/buscar?orden=calificacion">Ver todas <Icono nombre="flecha" tam={17} /></Link>
          </div>
          <div className="grid-pensiones">
            {valoradas.map((p) => <TarjetaPension key={p.id} p={p} />)}
          </div>
          <p className="fine" style={{ marginTop: 14 }}>Solo opinan estudiantes con una estadía finalizada en la pensión. Las reseñas se moderan.</p>
        </section>
      )}

      {/* ---------- Explora por barrio ---------- */}
      {barrios.length > 0 && (
        <section className="seccion" aria-labelledby="titulo-barrios">
          <div className="cabeza-seccion">
            <div><p className="eyebrow">Cada barrio tiene su ritmo</p><h2 id="titulo-barrios">Explora por barrio</h2></div>
          </div>
          <div className="barrios">
            {barrios.map((b) => (
              <Link key={b.barrio} className="barrio" to={`/buscar?barrio=${encodeURIComponent(b.barrio)}`}>
                <img src={b.foto || '/img/placeholder1.svg'} alt="" loading="lazy" />
                <div><b>{b.barrio}</b><small>{plural(b.total, 'pensión', 'pensiones')} · desde {cop(b.desde)}</small></div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---------- Para descubrir ---------- */}
      <section className="seccion" aria-labelledby="titulo-descubrir">
        <div className="cabeza-seccion">
          <div><p className="eyebrow">Recién verificadas</p><h2 id="titulo-descubrir">Pensiones para descubrir</h2></div>
          <Link className="btn-link" to="/buscar">Ver catálogo <Icono nombre="flecha" tam={17} /></Link>
        </div>
        {!pensiones && !error && <Cargando texto="Cargando pensiones…" />}
        {pensiones?.length === 0 && <Vacio titulo="Aún no hay pensiones verificadas" texto="Vuelve pronto: la oferta se publica tras la revisión del administrador." />}
        <div className="grid-pensiones">
          {pensiones?.slice(0, 6).map((p) => <TarjetaPension key={p.id} p={p} />)}
        </div>
      </section>

      {/* ---------- Cómo funciona ---------- */}
      <section className="pasos" aria-labelledby="titulo-pasos">
        <p className="eyebrow">A tu ritmo, con información clara</p>
        <h2 id="titulo-pasos">Tu próximo lugar, paso a paso.</h2>
        <div className="pasos-grid">
          <div><span><Icono nombre="buscar" /></span><b>Explora y compara</b><p>Filtra por precio, servicios, barrio y distancia a tu universidad.</p></div>
          <div><span><Icono nombre="edificio" /></span><b>Conoce el espacio</b><p>Fotos, cupos, reglas de convivencia y reseñas de otros estudiantes.</p></div>
          <div><span><Icono nombre="mensaje" /></span><b>Habla directamente</b><p>Escríbele al arrendador por WhatsApp con un mensaje listo.</p></div>
          <div><span><Icono nombre="calendario" /></span><b>Reserva en línea</b><p>Aparta tu cupo, paga y descarga tu comprobante en PDF.</p></div>
        </div>
      </section>

    </main>
  );
}
