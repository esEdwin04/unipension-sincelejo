import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API, cop, estrellas } from '../api.js';
import { useSesion } from '../App.jsx';
import Aviso from '../componentes/Aviso.jsx';

// Panel administrativo (HU-03, HU-12 + moderación de HU-10)
export default function Admin() {
  const { usuario } = useSesion();
  const nav = useNavigate();
  const [pestana, setPestana] = useState('verificacion');
  const [datos, setDatos] = useState(null);           // indicadores
  const [pendientes, setPendientes] = useState([]);
  const [traza, setTraza] = useState([]);
  const [reportadas, setReportadas] = useState([]);
  const [bitacora, setBitacora] = useState([]);
  const [ft, setFt] = useState({ q: '', desde: '', hasta: '' });
  const [msj, setMsj] = useState(null);

  useEffect(() => {
    if (!usuario || usuario.rol !== 'administrador') return nav('/acceso');
    cargar();
  }, []);

  async function cargar() {
    setDatos(await API.get('/admin/indicadores'));
    setPendientes(await API.get('/pensiones/pendientes'));
    setReportadas(await API.get('/resenas/reportadas'));
    setBitacora(await API.get('/admin/bitacora'));
    consultarTraza();
  }

  async function consultarTraza(e) {
    e?.preventDefault();
    const q = new URLSearchParams(Object.entries(ft).filter(([, v]) => v));
    setTraza(await API.get('/admin/trazabilidad?' + q));
  }

  // HU-03: verificar / rechazar / suspender
  async function cambiarEstado(id, estado) {
    let motivo = null;
    if (estado !== 'Verificada') {
      motivo = prompt(`Motivo de la ${estado.toLowerCase()} (se notifica al propietario):`);
      if (!motivo) return;
    }
    try {
      const r = await API.patch(`/pensiones/${id}/estado`, { estado, motivo });
      setMsj({ t: r.advertencia ? 'info' : 'ok', m: r.mensaje + (r.advertencia ? '<br>' + r.advertencia : '') });
      cargar();
    } catch (err) { setMsj({ t: 'error', m: err.message }); }
  }

  async function moderar(id, decision) {
    const r = await API.patch(`/resenas/${id}/moderar`, { decision });
    setMsj({ t: 'ok', m: r.mensaje }); cargar();
  }

  if (!datos) return <main className="seccion"><p>Cargando…</p></main>;
  const { kpis, porBarrio, top } = datos;

  return (
    <main className="seccion">
      <p className="kicker">Administración</p>
      <h1 className="titulo-seccion">Panel de la plataforma</h1>
      {msj && <Aviso tipo={msj.t}>{msj.m}</Aviso>}

      <div className="kpis">
        {[['Pensiones', kpis.pensiones_total], ['Verificadas', kpis.pensiones_verificadas],
          ['Pendientes', kpis.pensiones_pendientes], ['Reservas', kpis.reservas_total],
          ['Confirmadas', kpis.reservas_confirmadas], ['Ingresos', cop(kpis.ingresos)]]
          .map(([n, v]) => (
            <div className="kpi" key={n}><div className="valor">{v}</div><div className="nombre">{n}</div></div>
          ))}
      </div>

      <div className="pestanas">
        {[['verificacion', 'Verificación'], ['trazabilidad', 'Trazabilidad'], ['ocupacion', 'Ocupación'],
          ['moderacion', 'Moderación'], ['bitacora', 'Bitácora']].map(([k, t]) => (
            <button key={k} className={pestana === k ? 'activa' : ''} onClick={() => setPestana(k)}>{t}</button>
          ))}
      </div>

      {pestana === 'verificacion' && (
        <div className="panel tabla-env">
          <table>
            <thead><tr><th>Pensión</th><th>Propietario</th><th>Barrio</th><th>Tarifa</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {pendientes.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.nombre}</strong><br /><small style={{color:'var(--niebla)'}}>{p.direccion}</small></td>
                  <td>{p.propietario}</td><td>{p.barrio}</td><td>{cop(p.tarifa_mensual)}</td>
                  <td><span className={`estado ${p.estado}`}>{p.estado}</span></td>
                  <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="boton chico" onClick={() => cambiarEstado(p.id, 'Verificada')}>Verificar</button>
                    <button className="boton chico peligro" onClick={() => cambiarEstado(p.id, 'Rechazada')}>Rechazar</button>
                    <button className="boton chico secundario" onClick={() => cambiarEstado(p.id, 'Suspendida')}>Suspender</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pestana === 'trazabilidad' && (
        <div className="panel">
          <form onSubmit={consultarTraza} className="filtros">
            <div style={{gridColumn:'span 2'}}><label>Buscar (pensión, propietario, estudiante o barrio)</label>
              <input value={ft.q} onChange={(e) => setFt({ ...ft, q: e.target.value })} /></div>
            <div><label>Desde</label><input type="date" value={ft.desde} onChange={(e) => setFt({ ...ft, desde: e.target.value })} /></div>
            <div><label>Hasta</label><input type="date" value={ft.hasta} onChange={(e) => setFt({ ...ft, hasta: e.target.value })} /></div>
            <button className="boton chico">Consultar</button>
            <a className="boton chico secundario" href="/api/admin/reporte.csv" style={{textAlign:'center'}}>Exportar CSV</a>
          </form>
          <div className="tabla-env">
            <table>
              <thead><tr><th>#</th><th>Pensión</th><th>Propietario</th><th>Estudiante</th><th>Ingreso</th><th>Valor</th><th>Estado</th><th>Comprobante</th></tr></thead>
              <tbody>
                {traza.length === 0 && <tr><td colSpan="8">Sin registros para los filtros seleccionados.</td></tr>}
                {traza.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.pension}<br /><small style={{color:'var(--niebla)'}}>{r.barrio}</small></td>
                    <td>{r.propietario}</td><td>{r.estudiante}</td><td>{r.fecha_ingreso}</td>
                    <td>{cop(r.valor_total)}</td>
                    <td><span className={`estado ${r.estado.split(' ')[0]}`}>{r.estado}</span></td>
                    <td>{r.consecutivo || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pestana === 'ocupacion' && (
        <div className="panel tabla-env">
          <h3 className="serif" style={{ fontSize: '1.3rem', marginBottom: 12 }}>Ocupación y arriendo promedio por barrio</h3>
          <table>
            <thead><tr><th>Barrio</th><th>Habitaciones</th><th>Ocupadas</th><th>% Ocupación</th><th>Arriendo promedio</th></tr></thead>
            <tbody>
              {porBarrio.map((b) => (
                <tr key={b.barrio}><td>{b.barrio}</td><td>{b.habitaciones}</td><td>{b.ocupadas}</td>
                  <td><strong>{b.ocupacion_pct}%</strong></td><td>{cop(b.arriendo_promedio)}</td></tr>
              ))}
            </tbody>
          </table>
          <h3 className="serif" style={{ fontSize: '1.3rem', margin: '26px 0 12px' }}>Pensiones más solicitadas</h3>
          <table>
            <thead><tr><th>Pensión</th><th>Barrio</th><th>Solicitudes</th><th>Calificación</th></tr></thead>
            <tbody>
              {top.map((t) => (
                <tr key={t.nombre}><td>{t.nombre}</td><td>{t.barrio}</td><td>{t.solicitudes}</td>
                  <td className="estrellas">{estrellas(t.calificacion)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pestana === 'moderacion' && (
        <div className="panel">
          {reportadas.length === 0 && <p style={{ color: 'var(--niebla)' }}>No hay reseñas reportadas.</p>}
          {reportadas.map((r) => (
            <div className="resena" key={r.id}>
              <span className="estrellas">{'★'.repeat(r.estrellas)}</span>{' '}
              <strong>{r.estudiante}</strong> sobre <em>{r.pension}</em>: “{r.comentario}”
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <button className="boton chico" onClick={() => moderar(r.id, 'publicar')}>Restaurar</button>
                <button className="boton chico peligro" onClick={() => moderar(r.id, 'ocultar')}>Ocultar definitivamente</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pestana === 'bitacora' && (
        <div className="panel tabla-env">
          <table>
            <thead><tr><th>Fecha</th><th>Pensión</th><th>Acción</th><th>Motivo</th><th>Administrador</th></tr></thead>
            <tbody>
              {bitacora.length === 0 && <tr><td colSpan="5">Sin registros.</td></tr>}
              {bitacora.map((b) => (
                <tr key={b.id}><td>{b.creado_en}</td><td>{b.pension}</td>
                  <td><span className={`estado ${b.accion}`}>{b.accion}</span></td>
                  <td>{b.motivo || '—'}</td><td>{b.administrador}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
