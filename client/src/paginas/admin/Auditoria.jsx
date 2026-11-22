// =============================================================
// Auditoría (HU-12, HU-03, HU-10): funciones del panel administrativo existente
// que no están en el prototipo y se conservan: indicadores, trazabilidad con
// exportación CSV, ocupación por barrio, moderación de reseñas y bitácora.
// =============================================================
import { useEffect, useState } from 'react';
import { API, cop, estrellas, fecha } from '../../api.js';
import { useSesion } from '../../App.jsx';
import { Aviso, Campo, Cargando, Chip, TituloPagina } from '../../componentes/ui.jsx';
import PanelWhatsApp from './PanelWhatsApp.jsx';

export default function Auditoria() {
  const { avisar } = useSesion();
  const [pestana, setPestana] = useState('trazabilidad');
  const [datos, setDatos] = useState(null);
  const [traza, setTraza] = useState([]);
  const [ft, setFt] = useState({ q: '', desde: '', hasta: '' });
  const [resenas, setResenas] = useState([]);
  const [bitacora, setBitacora] = useState([]);
  const [error, setError] = useState('');

  async function cargar() {
    try {
      const [d, r, b] = await Promise.all([API.get('/admin/indicadores'), API.get('/resenas/reportadas'), API.get('/admin/bitacora')]);
      setDatos(d); setResenas(r); setBitacora(b);
      consultar();
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function consultar(e) {
    e?.preventDefault();
    if (ft.desde && ft.hasta && ft.desde > ft.hasta) return setError('La fecha inicial no puede ser posterior a la final.');
    setError('');
    const q = new URLSearchParams(Object.entries(ft).filter(([, v]) => v));
    try { setTraza(await API.get('/admin/trazabilidad?' + q)); } catch (err) { setError(err.message); }
  }
  async function moderar(id, decision) {
    try { const r = await API.patch(`/resenas/${id}/moderar`, { decision }); avisar(r.mensaje); cargar(); }
    catch (err) { setError(err.message); }
  }

  if (!datos) return <main className="contenido">{error ? <Aviso tipo="error">{error}</Aviso> : <Cargando />}</main>;
  const { kpis, porBarrio, top } = datos;

  return (
    <main className="contenido">
      <TituloPagina titulo="Auditoría de la plataforma" subtitulo="Trazabilidad de reservas y pagos, ocupación, reseñas y bitácora" />
      <div className="estadisticas">
        {[['Pensiones', kpis.pensiones_total], ['Verificadas', kpis.pensiones_verificadas], ['Reservas', kpis.reservas_total],
          ['Confirmadas', kpis.reservas_confirmadas], ['Ingresos (pagos aprobados)', cop(kpis.ingresos)]].map(([n, v]) => (
          <div key={n}><b>{v}</b><small>{n}</small></div>
        ))}
      </div>
      <div className="pestanas" role="group" aria-label="Secciones de auditoría">
        {[['trazabilidad', 'Trazabilidad'], ['ocupacion', 'Ocupación'], ['resenas', `Reseñas reportadas (${resenas.length})`], ['bitacora', 'Bitácora'], ['whatsapp', 'WhatsApp']].map(([k, t]) => (
          <button key={k} className={pestana === k ? 'activo' : ''} aria-pressed={pestana === k} onClick={() => setPestana(k)}>{t}</button>
        ))}
      </div>
      <Aviso tipo="error">{error}</Aviso>

      {pestana === 'trazabilidad' && (
        <section className="panel">
          <form onSubmit={consultar} className="filtros-tabla">
            <Campo etiqueta="Pensión, propietario, estudiante o barrio"><input value={ft.q} onChange={(e) => setFt({ ...ft, q: e.target.value })} /></Campo>
            <Campo etiqueta="Desde"><input type="date" value={ft.desde} onChange={(e) => setFt({ ...ft, desde: e.target.value })} /></Campo>
            <Campo etiqueta="Hasta"><input type="date" value={ft.hasta} onChange={(e) => setFt({ ...ft, hasta: e.target.value })} /></Campo>
            <button className="btn chico">Consultar</button>
            <a className="btn sec chico" href="/api/admin/reporte.csv">Exportar CSV</a>
          </form>
          <div className="tabla-env">
            <table>
              <thead><tr><th>#</th><th>Pensión</th><th>Propietario</th><th>Estudiante</th><th>Ingreso</th><th>Valor</th><th>Estado</th><th>Comprobante</th></tr></thead>
              <tbody>
                {traza.length === 0 && <tr><td colSpan="8">Sin registros para los filtros seleccionados.</td></tr>}
                {traza.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td><td>{r.pension}<br /><small>{r.barrio}</small></td><td>{r.propietario}</td><td>{r.estudiante}</td>
                    <td>{r.fecha_ingreso}</td><td>{cop(r.valor_total)}</td><td><Chip clase={r.estado.split(' ')[0]}>{r.estado}</Chip></td>
                    <td>{r.consecutivo ? <a className="btn-link" href={`/api/reservas/${r.id}/comprobante`}>{r.consecutivo}</a> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {pestana === 'ocupacion' && (
        <section className="panel tabla-env">
          <h2>Ocupación y arriendo promedio por barrio</h2>
          <table>
            <thead><tr><th>Barrio</th><th>Habitaciones</th><th>Ocupadas</th><th>% Ocupación</th><th>Arriendo promedio</th></tr></thead>
            <tbody>{porBarrio.map((b) => (
              <tr key={b.barrio}><td>{b.barrio}</td><td>{b.habitaciones}</td><td>{b.ocupadas}</td><td><strong>{b.ocupacion_pct}%</strong></td><td>{cop(b.arriendo_promedio)}</td></tr>
            ))}</tbody>
          </table>
          <h2 style={{ marginTop: 24 }}>Pensiones más solicitadas</h2>
          <table>
            <thead><tr><th>Pensión</th><th>Barrio</th><th>Solicitudes</th><th>Calificación</th></tr></thead>
            <tbody>{top.map((t) => (
              <tr key={t.nombre}><td>{t.nombre}</td><td>{t.barrio}</td><td>{t.solicitudes}</td><td className="estrellas">{estrellas(t.calificacion)}</td></tr>
            ))}</tbody>
          </table>
        </section>
      )}

      {pestana === 'resenas' && (
        <section className="panel">
          {resenas.length === 0 && <p className="muted">No hay reseñas reportadas.</p>}
          {resenas.map((r) => (
            <div className="resena" key={r.id}>
              <span className="estrellas">{'★'.repeat(r.estrellas)}</span> <strong>{r.estudiante}</strong> sobre <em>{r.pension}</em>
              <p>“{r.comentario}”</p>
              <div className="celda-acciones" style={{ marginTop: 8 }}>
                <button className="btn chico" onClick={() => moderar(r.id, 'publicar')}>Restaurar</button>
                <button className="btn chico peligro" onClick={() => moderar(r.id, 'ocultar')}>Ocultar definitivamente</button>
              </div>
            </div>
          ))}
        </section>
      )}

      {pestana === 'bitacora' && (
        <section className="panel tabla-env">
          <table>
            <thead><tr><th>Fecha</th><th>Pensión</th><th>Acción</th><th>Motivo</th><th>Administrador</th></tr></thead>
            <tbody>
              {bitacora.length === 0 && <tr><td colSpan="5">Sin registros.</td></tr>}
              {bitacora.map((b) => (
                <tr key={b.id}><td>{fecha(b.creado_en)}</td><td>{b.pension}</td><td><Chip clase={b.accion}>{b.accion}</Chip></td><td>{b.motivo || '—'}</td><td>{b.administrador}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {pestana === 'whatsapp' && <PanelWhatsApp />}
    </main>
  );
}
