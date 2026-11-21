import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API, cop } from '../api.js';
import { useSesion } from '../App.jsx';
import Aviso from '../componentes/Aviso.jsx';

// Panel del propietario (HU-01, HU-02, HU-09)
const NUEVA = { nombre: '', direccion: '', barrio: '', tarifa_mensual: '', deposito: 0,
                ind: 1, comp: 0, servicios: '', descripcion: '', reglas: '' };

export default function Propietario() {
  const { usuario } = useSesion();
  const nav = useNavigate();
  const [pestana, setPestana] = useState('publicaciones');
  const [mias, setMias] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [n, setN] = useState(NUEVA);
  const [msj, setMsj] = useState(null);
  const [edita, setEdita] = useState(null); // {id, tarifa_mensual, servicios}

  useEffect(() => {
    if (!usuario || usuario.rol !== 'propietario') return nav('/acceso');
    cargar();
  }, []);

  async function cargar() {
    setMias(await API.get('/pensiones/mias'));
    setSolicitudes(await API.get('/reservas/solicitudes'));
  }

  // HU-01: publicar
  async function publicar(e) {
    e.preventDefault();
    const habitaciones = [];
    for (let i = 1; i <= +n.ind; i++)  habitaciones.push({ codigo: 'IND-' + i, tipo: 'individual', tarifa: +n.tarifa_mensual });
    for (let i = 1; i <= +n.comp; i++) habitaciones.push({ codigo: 'COMP-' + i, tipo: 'compartida', tarifa: Math.round(+n.tarifa_mensual * 0.7) });
    try {
      const r = await API.post('/pensiones', { ...n, tarifa_mensual: +n.tarifa_mensual, deposito: +n.deposito || 0, habitaciones });
      setMsj({ t: 'ok', m: r.mensaje + ' El administrador la revisará antes de publicarla en el catálogo.' });
      setN(NUEVA); setPestana('publicaciones'); cargar();
    } catch (err) {
      let m = err.message;
      if (err.datos?.campos) m += ': ' + err.datos.campos.join(', ');
      setMsj({ t: 'error', m });
    }
  }

  // HU-02: editar tarifa/servicios
  async function guardarEdicion(e) {
    e.preventDefault();
    try {
      const r = await API.put('/pensiones/' + edita.id, {
        tarifa_mensual: +edita.tarifa_mensual || null,
        servicios: edita.servicios || null,
      });
      setMsj({ t: 'ok', m: r.mensaje }); setEdita(null); cargar();
    } catch (err) { setMsj({ t: 'error', m: err.message }); }
  }

  // HU-09: responder solicitudes
  async function responder(id, decision) {
    let motivo = null;
    if (decision === 'rechazar') {
      motivo = prompt('Motivo del rechazo (se notifica al estudiante):');
      if (!motivo) return;
    }
    try {
      const r = await API.post(`/reservas/${id}/responder`, { decision, motivo });
      setMsj({ t: 'ok', m: r.mensaje }); cargar();
    } catch (err) { setMsj({ t: 'error', m: err.message }); }
  }

  const campo = (k) => (e) => setN({ ...n, [k]: e.target.value });

  return (
    <main className="seccion">
      <p className="kicker">Panel del propietario</p>
      <h1 className="titulo-seccion">Mis pensiones</h1>
      {msj && <Aviso tipo={msj.t}>{msj.m}</Aviso>}

      <div className="pestanas">
        {[['publicaciones', 'Publicaciones'], ['nueva', 'Publicar pensión'], ['solicitudes', 'Solicitudes de reserva']]
          .map(([k, t]) => (
            <button key={k} className={pestana === k ? 'activa' : ''} onClick={() => setPestana(k)}>{t}</button>
          ))}
      </div>

      {pestana === 'publicaciones' && (
        <div className="panel tabla-env">
          <table>
            <thead><tr><th>Pensión</th><th>Barrio</th><th>Tarifa</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {mias.length === 0 && <tr><td colSpan="5">Aún no tienes publicaciones.</td></tr>}
              {mias.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.nombre}</strong><br /><small style={{color:'var(--niebla)'}}>{p.direccion}</small></td>
                  <td>{p.barrio}</td>
                  <td>{cop(p.tarifa_mensual)}</td>
                  <td><span className={`estado ${p.estado}`}>{p.estado}</span></td>
                  <td><button className="boton chico secundario"
                        onClick={() => setEdita({ id: p.id, tarifa_mensual: p.tarifa_mensual, servicios: p.servicios || '' })}>
                        Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {edita && (
            <form onSubmit={guardarEdicion} className="filtros" style={{ marginTop: 20, marginBottom: 0 }}>
              <div><label>Nueva tarifa mensual (COP)</label>
                <input type="number" min="50000" step="10000" value={edita.tarifa_mensual}
                       onChange={(e) => setEdita({ ...edita, tarifa_mensual: e.target.value })} /></div>
              <div style={{gridColumn:'span 2'}}><label>Servicios incluidos</label>
                <input value={edita.servicios}
                       onChange={(e) => setEdita({ ...edita, servicios: e.target.value })} /></div>
              <button className="boton chico">Guardar cambios</button>
              <button className="boton chico secundario" type="button" onClick={() => setEdita(null)}>Cancelar</button>
            </form>
          )}
        </div>
      )}

      {pestana === 'nueva' && (
        <form onSubmit={publicar} className="panel filtros" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
          <div><label>Nombre de la pensión *</label><input required value={n.nombre} onChange={campo('nombre')} /></div>
          <div><label>Dirección *</label><input required placeholder="Cra 00 # 00-00" value={n.direccion} onChange={campo('direccion')} /></div>
          <div><label>Barrio *</label><input required value={n.barrio} onChange={campo('barrio')} /></div>
          <div><label>Tarifa mensual (COP) *</label><input type="number" min="50000" step="10000" required value={n.tarifa_mensual} onChange={campo('tarifa_mensual')} /></div>
          <div><label>Depósito (COP)</label><input type="number" min="0" step="10000" value={n.deposito} onChange={campo('deposito')} /></div>
          <div><label>Hab. individuales</label><input type="number" min="0" value={n.ind} onChange={campo('ind')} /></div>
          <div><label>Hab. compartidas</label><input type="number" min="0" value={n.comp} onChange={campo('comp')} /></div>
          <div style={{ gridColumn: '1/-1' }}><label>Servicios incluidos (separados por coma)</label>
            <input placeholder="Internet, Servicios públicos, Lavandería, Alimentación" value={n.servicios} onChange={campo('servicios')} /></div>
          <div style={{ gridColumn: '1/-1' }}><label>Descripción</label>
            <textarea rows="2" value={n.descripcion} onChange={campo('descripcion')} /></div>
          <div style={{ gridColumn: '1/-1' }}><label>Reglas de convivencia</label>
            <textarea rows="2" value={n.reglas} onChange={campo('reglas')} /></div>
          <div style={{ gridColumn: '1/-1' }}><label>Fotografías (JPG o PNG, máx. 5 MB)</label>
            <input type="file" accept=".jpg,.jpeg,.png" multiple />
            <small style={{ color: 'var(--niebla)' }}>En el prototipo las imágenes se representan con marcadores de posición.</small></div>
          <button className="boton">Publicar pensión</button>
        </form>
      )}

      {pestana === 'solicitudes' && (
        <div className="panel tabla-env">
          <p style={{ color: 'var(--niebla)', marginBottom: 14, fontSize: '.9rem' }}>
            Las solicitudes pagadas deben responderse en un máximo de 48 horas; de lo contrario se cancelan automáticamente.
          </p>
          <table>
            <thead><tr><th>#</th><th>Pensión / Hab.</th><th>Estudiante</th><th>Ingreso</th><th>Valor</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {solicitudes.length === 0 && <tr><td colSpan="7">No hay solicitudes por ahora.</td></tr>}
              {solicitudes.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.pension}<br /><small style={{color:'var(--niebla)'}}>{s.codigo} · {s.tipo}</small></td>
                  <td>{s.estudiante}<br /><small style={{color:'var(--niebla)'}}>
                    {s.estado === 'Confirmada' ? `${s.telefono} · ${s.correo}` : 'Contacto visible al aceptar'}</small></td>
                  <td>{s.fecha_ingreso} ({s.meses} meses)</td>
                  <td>{cop(s.valor_total)}</td>
                  <td><span className={`estado ${s.estado}`}>{s.estado}</span></td>
                  <td>{s.estado === 'Pagada' && (
                    <span style={{ display: 'flex', gap: 8 }}>
                      <button className="boton chico" onClick={() => responder(s.id, 'aceptar')}>Aceptar</button>
                      <button className="boton chico peligro" onClick={() => responder(s.id, 'rechazar')}>Rechazar</button>
                    </span>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
