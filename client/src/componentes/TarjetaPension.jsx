// Tarjeta de pensión del catálogo y del inicio — rediseño v0.5.
// Toda la tarjeta es clicable (el enlace del título la cubre con ::after) y el lector de pantalla
// anuncia un solo enlace con el nombre de la pensión.
import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import Icono, { IconoServicio } from './Icono.jsx';
import { cop, cuposTexto, km } from '../api.js';
import BotonFavorito from './BotonFavorito.jsx';

const TIPO = { Mixta: 'Individual y compartida' };
// Escasez real (dato del servidor, nunca inventado): con 1 o 2 cupos la insignia se vuelve coral
const textoCupos = (n) => (n === 1 ? '¡Último cupo!' : n === 2 ? '¡Quedan 2 cupos!' : cuposTexto(n));

export default function TarjetaPension({ p, distancia, etiquetaDistancia }) {
  const servicios = String(p.servicios || '').split(',').map((s) => s.trim()).filter(Boolean);
  const cupos = p.cupos ?? p.habitaciones_libres;
  const nota = p.calificacion ? String(p.calificacion).replace('.', ',') : null;
  return (
    <article className="tarjeta-pension">
      <div className="tp-foto">
        <img src={p.foto || '/img/placeholder1.svg'} alt="" loading="lazy" />
        {p.destacado && <span className="insignia dest"><Icono nombre="estrella" tam={13} />Destacado</span>}
        {nota && (
          <span className="insignia nota" aria-label={`Calificación ${nota} de 5${p.total_resenas ? `, ${p.total_resenas} reseñas` : ''}`}>
            <span className="estrellas" aria-hidden="true">★</span><b>{nota}</b>
            {p.total_resenas > 0 && <small aria-hidden="true">({p.total_resenas})</small>}
          </span>
        )}
        <span className={`insignia cupos ${cupos > 0 ? (cupos <= 2 ? 'escaso' : '') : 'sin-cupos'}`}>{textoCupos(cupos)}</span>
        <BotonFavorito pension={p} />
      </div>
      <div className="tp-cuerpo">
        <Link className="tp-titulo" to={`/pension/${p.id}`}>{p.nombre}</Link>
        <p className="tp-lugar"><Icono nombre="ubicacion" tam={13} />{p.barrio}</p>
        {p.publicada !== false && <span className="tp-verificada"><Icono nombre="escudo" tam={14} />Verificada por UniPensión</span>}
        {servicios.length > 0 && (
          <div className="tp-servicios">
            {servicios.slice(0, 3).map((s) => <span key={s}><IconoServicio servicio={s} tam={14} />{s}</span>)}
            {servicios.length > 3 && <span>+{servicios.length - 3}</span>}
          </div>
        )}
        {p.comentario_destacado && <p className="tp-cita">“{p.comentario_destacado}”</p>}
        {distancia != null && <p className="tp-dist">Aprox. {km(distancia)} km en línea recta · {etiquetaDistancia}</p>}
        <div className="tp-precio">
          <b>{cop(p.tarifa_mensual)}<small> / mes</small></b>
          <span className="chip sin-punto">{TIPO[p.tipo_habitacion] || p.tipo_habitacion}</span>
        </div>
      </div>
    </article>
  );
}

// Carga diferida del mapa (Leaflet pesa ~150 KB)
const MapaDiferido = lazy(() => import('./MapaPensiones.jsx'));
export function Mapa(props) {
  return (
    <Suspense fallback={<div className="mapa-panel"><div className="mapa-carga"><span className="giro" /><b>Estamos preparando el mapa</b><span>Cargando OpenStreetMap…</span></div></div>}>
      <MapaDiferido {...props} />
    </Suspense>
  );
}
