// Tarjeta de pensión del catálogo y del inicio del estudiante
import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import Icono, { IconoServicio } from './Icono.jsx';
import { cop, cuposTexto, km } from '../api.js';

export default function TarjetaPension({ p, distancia, etiquetaDistancia }) {
  const servicios = String(p.servicios || '').split(',').map((s) => s.trim()).filter(Boolean);
  return (
    <article className="tarjeta-pension">
      <div className="tp-foto">
        <img src={p.foto || '/img/placeholder1.svg'} alt={`Imagen de ${p.nombre}`} loading="lazy" />
        {p.destacado && <span className="insignia dest"><Icono nombre="estrella" tam={13} />Destacado</span>}
        <span className="insignia cupos">{cuposTexto(p.cupos ?? p.habitaciones_libres)}</span>
      </div>
      <div className="tp-cuerpo">
        <div className="tp-precio">
          <b>{cop(p.tarifa_mensual)}<small> / mes</small></b>
          <span className="chip sin-punto">{p.tipo_habitacion === 'Mixta' ? 'Individual y compartida' : p.tipo_habitacion}</span>
        </div>
        <Link className="tp-titulo" to={`/pension/${p.id}`} aria-label={`Ver ${p.nombre}`}>{p.nombre}</Link>
        <p className="tp-lugar"><Icono nombre="ubicacion" tam={14} />{p.barrio} · Sincelejo</p>
        <div className="tp-servicios">
          {servicios.slice(0, 3).map((s) => <span key={s}><IconoServicio servicio={s} tam={15} />{s}</span>)}
        </div>
        {p.calificacion && <span className="estrellas">{'★'.repeat(Math.round(p.calificacion))} {String(p.calificacion).replace('.', ',')}</span>}
        {distancia != null && <p className="tp-dist">Aprox. {km(distancia)} km en línea recta · {etiquetaDistancia}</p>}
        <div className="tp-pie">
          <span>Información declarada</span>
          <Link to={`/pension/${p.id}`}>Ver pensión <Icono nombre="flecha" tam={16} /></Link>
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
