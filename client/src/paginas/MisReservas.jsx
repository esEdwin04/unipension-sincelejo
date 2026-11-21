import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { API, cop } from '../api.js';
import { useSesion } from '../App.jsx';
import Aviso from '../componentes/Aviso.jsx';

// Historial del estudiante + pago de reservas (HU-07, HU-08, HU-11)
const VIGENTES = ['Pendiente de pago', 'Pagada', 'Confirmada'];

export default function MisReservas() {
  const { usuario } = useSesion();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const idPagar = params.get('pagar');
  const [reservas, setReservas] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [filtro, setFiltro] = useState('vigentes');
  const [pago, setPago] = useState({ medio: 'PSE', simular: 'aprobado' });
  const [msj, setMsj] = useState(null);

  useEffect(() => {
    if (!usuario || usuario.rol !== 'estudiante') return nav('/acceso');
    cargar();
  }, []);

  async function cargar() {
    setReservas(await API.get('/reservas/mias'));
    setNotifs(await API.get('/reservas/notificaciones'));
  }

  // HU-07: pago contra la pasarela (simulada en el prototipo)
  async function pagar(e) {
    e.preventDefault();
    try {
      const r = await API.post(`/reservas/${idPagar}/pagar`, pago);
      setMsj({ t: 'ok', m: `${r.mensaje} Comprobante <strong>${r.consecutivo}</strong> — <a href="/api/reservas/${idPagar}/comprobante">descargar PDF</a>.` });
      setParams({}); cargar();
    } catch (err) { setMsj({ t: 'error', m: err.message }); } // esc. 2: permite reintentar
  }

  async function cancelar() {
    try {
      const r = await API.post(`/reservas/${idPagar}/cancelar`);
      setMsj({ t: 'ok', m: r.mensaje }); setParams({}); cargar();
    } catch (err) { setMsj({ t: 'error', m: err.message }); }
  }

  async function finalizar(id) {
    if (!confirm('¿Confirmas que tu estadía finalizó? Esto habilita la calificación de la pensión.')) return;
    const r = await API.post(`/reservas/${id}/finalizar`);
    setMsj({ t: 'ok', m: r.mensaje }); cargar();
  }

  const lista = reservas.filter((r) =>
    filtro === 'vigentes' ? VIGENTES.includes(r.estado) :
    filtro === 'historico' ? !VIGENTES.includes(r.estado) : true);

  return (
    <main className="seccion">
      <p className="kicker">Tu cuenta</p>
      <h1 className="titulo-seccion">Mis reservas</h1>
      {msj && <Aviso tipo={msj.t}>{msj.m}</Aviso>}

      {idPagar && (
        <div className="panel">
          <h3 className="serif" style={{ fontSize: '1.4rem', marginBottom: 10 }}>Pagar reserva #{idPagar}</h3>
          <Aviso tipo="info">Tienes <strong>30 minutos</strong> para completar el pago; de lo contrario, la habitación se libera automáticamente.</Aviso>
          <form onSubmit={pagar} className="filtros" style={{ marginBottom: 0 }}>
            <div><label>Medio de pago</label>
              <select value={pago.medio} onChange={(e) => setPago({ ...pago, medio: e.target.value })}>
                <option>PSE</option><option>Tarjeta</option><option>Nequi</option>
              </select></div>
            <div><label>Resultado (simulación de la pasarela)</label>
              <select value={pago.simular} onChange={(e) => setPago({ ...pago, simular: e.target.value })}>
                <option value="aprobado">Transacción aprobada</option>
                <option value="rechazado">Transacción rechazada</option>
              </select></div>
            <button className="boton chico">Pagar ahora</button>
            <button className="boton chico secundario" type="button" onClick={cancelar}>Cancelar solicitud</button>
          </form>
        </div>
      )}

      <div className="pestanas">
        {[['vigentes', 'Vigentes'], ['historico', 'Histórico'], ['todas', 'Todas']].map(([k, t]) => (
          <button key={k} className={filtro === k ? 'activa' : ''} onClick={() => setFiltro(k)}>{t}</button>
        ))}
      </div>

      <div className="panel tabla-env">
        <table>
          <thead><tr><th>#</th><th>Pensión</th><th>Ingreso</th><th>Valor</th><th>Estado</th><th>Comprobante</th><th></th></tr></thead>
          <tbody>
            {lista.length === 0 && (
              <tr><td colSpan="7">
                Aún no registras reservas en esta vista. <Link to="/" style={{textDecoration:'underline'}}>Explora el catálogo</Link> y encuentra tu pensión ideal.
              </td></tr>
            )}
            {lista.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td><strong>{r.pension}</strong><br /><small style={{color:'var(--niebla)'}}>Barrio {r.barrio} · {r.codigo} ({r.tipo})</small></td>
                <td>{r.fecha_ingreso}<br /><small style={{color:'var(--niebla)'}}>{r.meses} meses</small></td>
                <td>{cop(r.valor_total)}</td>
                <td><span className={`estado ${r.estado.split(' ')[0]}`}>{r.estado}</span></td>
                <td>{r.consecutivo
                  ? <a href={`/api/reservas/${r.id}/comprobante`} style={{textDecoration:'underline'}}>Descargar PDF</a> : '—'}</td>
                <td style={{ display: 'flex', gap: 8 }}>
                  {r.estado === 'Pendiente de pago' &&
                    <button className="boton chico" onClick={() => setParams({ pagar: r.id })}>Pagar</button>}
                  {r.estado === 'Confirmada' &&
                    <button className="boton chico secundario" onClick={() => finalizar(r.id)}>Finalizar estadía</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h3 className="serif" style={{ fontSize: '1.4rem', marginBottom: 10 }}>Notificaciones</h3>
        {notifs.length === 0 && <p style={{ color: 'var(--niebla)' }}>Sin notificaciones.</p>}
        {notifs.map((x) => (
          <p key={x.id} style={{ borderBottom: '1px solid var(--linea)', padding: '8px 0', fontSize: '.92rem' }}>
            {x.mensaje} <small style={{ color: 'var(--niebla)' }}>({x.creado_en})</small>
          </p>
        ))}
      </div>
    </main>
  );
}
