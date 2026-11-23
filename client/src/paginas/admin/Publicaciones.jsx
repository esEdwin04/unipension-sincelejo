// -------------------------------------------------------------------------------------
// Responsable: Edwin Diaz
// Moderación de publicaciones (HU-03) — prototipo inicial:
// filtros por estado, Ver detalle, Aprobar, Rechazar, Ocultar / Revisar y restaurar,
// Resolver reportes, Plan Destacado (activación manual) e historial de decisiones.
// --------------------------------------------------------------------------------------
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API, fecha } from '../../api.js';
import { useSesion } from '../../App.jsx';
import { ChipsEstado } from '../propietario/MisPensiones.jsx';
import { Aviso, Campo, Cargando, Dialogo, TituloPagina, Vacio } from '../../componentes/ui.jsx';

const FILTROS = [['Pendiente', 'Pendientes'], ['Verificada', 'Verificadas'], ['Rechazada', 'Rechazadas'], ['Suspendida', 'Ocultas'], ['destacados', 'Plan Destacado'], ['todas', 'Todas']];
const TITULO_ACCION = { rechazar: 'Rechazar publicación', ocultar: 'Ocultar publicación', restaurar: 'Restaurar tras revisión', resolver: 'Resolver reportes' };

export function useModeracion(recargar) {
  const { avisar } = useSesion();
  const [accion, setAccion] = useState(null); // { id, accion, motivo, error }
  async function ejecutar(id, tipo, motivo = '') {
    try {
      const r = await API.post(`/admin/pensiones/${id}/moderar`, { accion: tipo, motivo });
      avisar(r.advertencia ? `${r.mensaje} ${r.advertencia}` : r.mensaje);
      setAccion(null); recargar();
    } catch (err) {
      if (accion) setAccion({ ...accion, error: err.message }); else avisar(err.message);
    }
  }
  const dialogo = accion && (
    <Dialogo titulo={TITULO_ACCION[accion.accion]} cerrar={() => setAccion(null)}>
      <form onSubmit={(e) => {
        e.preventDefault();
        if (!accion.motivo.trim()) return setAccion({ ...accion, error: 'Explica la decisión para el historial de moderación.' });
        ejecutar(accion.id, accion.accion, accion.motivo.trim());
      }}>
        <Campo etiqueta="Motivo o decisión *" error={accion.error}>
          <textarea value={accion.motivo} onChange={(e) => setAccion({ ...accion, motivo: e.target.value })} />
        </Campo>
        {accion.accion === 'restaurar' && <Aviso>Se resolverán los reportes activos atendidos. Solo será pública si tiene cupos.</Aviso>}
        {accion.accion === 'ocultar' && <Aviso tipo="alerta">La pensión saldrá del catálogo. Las reservas vigentes se conservan hasta su finalización.</Aviso>}
        <button className="btn ancho">Confirmar decisión</button>
      </form>
    </Dialogo>
  );
  return { ejecutar, pedir: (id, tipo) => setAccion({ id, accion: tipo, motivo: '', error: '' }), dialogo };
}

export function TarjetaModeracion({ p, reportes = [], mod }) {
  const nav = useNavigate();
  return (
    <article className="tarjeta-gestion">
      <img src={p.foto || '/img/placeholder1.svg'} alt={p.nombre} loading="lazy" />
      <div className="tg-cuerpo">
        <ChipsEstado p={p} />
        <h2>{p.nombre}</h2>
        <p>{p.propietario} · {p.barrio} · {p.visible ? 'visible en el catálogo' : 'no visible en el catálogo'}</p>
        {p.motivo_rechazo && <p className="motivo-rechazo">{p.motivo_rechazo}</p>}
        {reportes.map((r) => (
          <div className="reporte-item" key={r.id}>
            <b>{r.motivo}</b><p>{r.detalle || 'Sin descripción adicional.'}</p>
            <small className="muted">{r.estudiante} · {fecha(r.creado_en)}</small>
          </div>
        ))}
        <div className="tg-acciones">
          <button className="btn sec chico" onClick={() => nav(`/pension/${p.id}`)}>Ver detalle</button>
          {!['Verificada', 'Suspendida'].includes(p.estado) && <button className="btn chico" onClick={() => mod.ejecutar(p.id, 'aprobar')}>Aprobar</button>}
          {p.estado !== 'Rechazada' && <button className="btn sec chico" onClick={() => mod.pedir(p.id, 'rechazar')}>Rechazar</button>}
          {p.estado === 'Suspendida'
            ? <button className="btn sec chico" onClick={() => mod.pedir(p.id, 'restaurar')}>Revisar y restaurar</button>
            : <button className="btn sec chico" onClick={() => mod.pedir(p.id, 'ocultar')}>Ocultar</button>}
          {(p.reportes_activos > 0 || reportes.length > 0) && <button className="btn sec chico" onClick={() => mod.pedir(p.id, 'resolver')}>Resolver reportes</button>}
        </div>
        <div className="control-destacado">
          <span><b>Plan Destacado</b><small>$30.000 COP / mes · activación manual, sin cobro</small></span>
          <button className="btn sec chico" onClick={() => mod.ejecutar(p.id, p.destacado ? 'quitar_destacado' : 'destacar')}>{p.destacado ? 'Desactivar' : 'Activar'}</button>
        </div>
        {p.destacado && !p.visible && <Aviso>El destacado no la hace pública: revisa moderación y cupos.</Aviso>}
      </div>
    </article>
  );
}

export function Historial() {
  const [bitacora, setBitacora] = useState([]);
  useEffect(() => { API.get('/admin/bitacora').then(setBitacora).catch(() => {}); }, []);
  if (!bitacora.length) return null;
  return (
    <details className="historial">
      <summary>Historial de decisiones ({bitacora.length})</summary>
      {bitacora.map((b) => (
        <p key={b.id}><b>{b.accion}</b> · {b.pension}<br /><small className="muted">{b.administrador} · {fecha(b.creado_en)}</small>
          {b.motivo && <><br />{b.motivo}</>}</p>
      ))}
    </details>
  );
}

export default function Publicaciones() {
  const [sp, setSp] = useSearchParams();
  const estado = sp.get('estado') || 'Pendiente';
  const [lista, setLista] = useState(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const recargar = () => setVersion((v) => v + 1);
  const mod = useModeracion(recargar);

  useEffect(() => {
    setLista(null);
    API.get(`/pensiones/pendientes?estado=${encodeURIComponent(estado)}`).then(setLista).catch((e) => { setError(e.message); setLista([]); });
  }, [estado, version]);

  return (
    <main className="contenido">
      <TituloPagina titulo="Moderación de publicaciones" subtitulo="Revisa el detalle antes de aprobar o rechazar" />
      <div className="pestanas" role="group" aria-label="Filtrar publicaciones">
        {FILTROS.map(([k, t]) => (
          <button key={k} className={estado === k ? 'activo' : ''} aria-pressed={estado === k} onClick={() => setSp({ estado: k })}>{t}</button>
        ))}
      </div>
      <Aviso tipo="error">{error}</Aviso>
      {!lista ? <Cargando /> : lista.length === 0 ? (
        <Vacio icono="lista" titulo="No hay publicaciones en esta vista" texto="Elige otro estado para seguir revisando las pensiones."
               accion={<button className="btn" onClick={() => setSp({ estado: 'todas' })}>Ver todas las publicaciones</button>} />
      ) : (
        <div className="grid-gestion">{lista.map((p) => <TarjetaModeracion key={p.id} p={p} mod={mod} />)}</div>
      )}
      <Historial key={version} />
      {mod.dialogo}
    </main>
  );
}
