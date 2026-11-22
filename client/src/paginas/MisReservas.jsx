// =============================================================
// Mis reservas del estudiante (HU-07, HU-08, HU-11): pago (pasarela simulada),
// pestañas Vigentes / Histórico / Todas, detalle, comprobante PDF y notificaciones.
// =============================================================
import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { API, cop, fecha } from '../api.js';
import { Aviso, Campo, Cargando, Chip, Dialogo, TituloPagina, Vacio } from '../componentes/ui.jsx';

const VIGENTES = ['Pendiente de pago', 'Pagada', 'Confirmada'];

export default function MisReservas() {
  const [params, setParams] = useSearchParams();
  const idPagar = params.get('pagar');
  const [reservas, setReservas] = useState(null);
  const [notifs, setNotifs] = useState([]);
  const [filtro, setFiltro] = useState('vigentes');
  const [pago, setPago] = useState({ medio: 'PSE', simular: 'aprobado' });
  const [msj, setMsj] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [confirmarFin, setConfirmarFin] = useState(null);

  async function cargar() {
    try {
      const [r, n] = await Promise.all([API.get('/reservas/mias'), API.get('/reservas/notificaciones')]);
      setReservas(r); setNotifs(n);
    } catch (e) { setMsj({ t: 'error', m: e.message }); setReservas([]); }
  }
  useEffect(() => { cargar(); }, []);

  async function pagar(e) {
    e.preventDefault();
    try {
      const r = await API.post(`/reservas/${idPagar}/pagar`, pago);
      setMsj({ t: 'ok', m: `${r.mensaje} Comprobante ${r.consecutivo}.`, comprobante: idPagar });
      setParams({}); cargar();
    } catch (err) { setMsj({ t: 'error', m: err.message }); } // HU-07 esc. 2: permite reintentar
  }
  async function cancelar() {
    try { const r = await API.post(`/reservas/${idPagar}/cancelar`); setMsj({ t: 'ok', m: r.mensaje }); setParams({}); cargar(); }
    catch (err) { setMsj({ t: 'error', m: err.message }); }
  }
  async function finalizar(id) {
    try { const r = await API.post(`/reservas/${id}/finalizar`); setMsj({ t: 'ok', m: r.mensaje }); setConfirmarFin(null); cargar(); }
    catch (err) { setMsj({ t: 'error', m: err.message }); setConfirmarFin(null); }
  }

  const lista = (reservas || []).filter((r) => (filtro === 'vigentes' ? VIGENTES.includes(r.estado)
    : filtro === 'historico' ? !VIGENTES.includes(r.estado) : true));
  const porPagar = reservas?.find((r) => String(r.id) === idPagar);

  return (
    <main className="contenido">
      <TituloPagina titulo="Mis reservas" subtitulo="Tus solicitudes, pagos y comprobantes en un solo lugar" />
      {msj && <Aviso tipo={msj.t}>{msj.m}{msj.comprobante && <> <a href={`/api/reservas/${msj.comprobante}/comprobante`}>Descargar PDF</a></>}</Aviso>}

      {idPagar && (
        <section className="panel">
          <h2>Pagar reserva #{idPagar}</h2>
          {porPagar && <p className="muted">{porPagar.pension} · {porPagar.codigo} ({porPagar.tipo}) · Total {cop(porPagar.valor_total)}</p>}
          <Aviso tipo="alerta">Tienes <strong>30 minutos</strong> para completar el pago; si no, la habitación se libera automáticamente.</Aviso>
          <form onSubmit={pagar}>
            <div className="dos">
              <Campo etiqueta="Medio de pago">
                <select value={pago.medio} onChange={(e) => setPago({ ...pago, medio: e.target.value })}>
                  <option>PSE</option><option>Tarjeta</option><option>Nequi</option>
                </select>
              </Campo>
              <Campo etiqueta="Resultado (simulación de la pasarela)">
                <select value={pago.simular} onChange={(e) => setPago({ ...pago, simular: e.target.value })}>
                  <option value="aprobado">Transacción aprobada</option><option value="rechazado">Transacción rechazada</option>
                </select>
              </Campo>
            </div>
            <Aviso>La pasarela de pagos está simulada en esta versión: no se realizan cobros reales.</Aviso>
            <div className="fila-acciones">
              <button type="button" className="btn sec" onClick={cancelar}>Cancelar solicitud</button>
              <button className="btn">Pagar ahora</button>
            </div>
          </form>
        </section>
      )}

      <div className="pestanas" role="group" aria-label="Filtrar reservas">
        {[['vigentes', 'Vigentes'], ['historico', 'Histórico'], ['todas', 'Todas']].map(([k, t]) => (
          <button key={k} className={filtro === k ? 'activo' : ''} aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{t}</button>
        ))}
      </div>

      {!reservas ? <Cargando /> : lista.length === 0 ? (
        <Vacio icono="calendario" titulo="Aún no registras reservas en esta vista"
               texto="Explora el catálogo y encuentra tu pensión ideal." accion={<Link className="btn" to="/buscar">Explorar pensiones</Link>} />
      ) : (
        <div className="panel tabla-env">
          <table>
            <thead><tr><th>#</th><th>Pensión</th><th>Ingreso</th><th>Valor</th><th>Estado</th><th>Comprobante</th><th /></tr></thead>
            <tbody>
              {lista.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td><button className="btn-link" onClick={() => setDetalle(r)}>{r.pension}</button><br /><small>Barrio {r.barrio} · {r.codigo} ({r.tipo})</small></td>
                  <td>{r.fecha_ingreso}<br /><small>{r.meses} meses</small></td>
                  <td>{cop(r.valor_total)}</td>
                  <td><Chip clase={r.estado.split(' ')[0]}>{r.estado}</Chip></td>
                  <td>{r.consecutivo ? <a className="btn-link" href={`/api/reservas/${r.id}/comprobante`}>Descargar PDF</a> : '—'}</td>
                  <td className="celda-acciones">
                    {r.estado === 'Pendiente de pago' && <button className="btn chico" onClick={() => setParams({ pagar: r.id })}>Pagar</button>}
                    {r.estado === 'Confirmada' && <button className="btn sec chico" onClick={() => setConfirmarFin(r)}>Finalizar estadía</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="panel">
        <h2>Notificaciones</h2>
        {notifs.length === 0 && <p className="muted">Sin notificaciones.</p>}
        {notifs.map((x) => (
          <p key={x.id} style={{ borderBottom: '1px solid var(--linea)', padding: '10px 0', fontSize: '.92rem' }}>
            {x.mensaje} <small className="muted">({fecha(x.creado_en)})</small>
          </p>
        ))}
      </section>

      {detalle && (
        <Dialogo titulo={`Reserva #${detalle.id}`} cerrar={() => setDetalle(null)}>
          <dl className="registro-consentimiento">
            <div><dt>Pensión</dt><dd>{detalle.pension}</dd></div>
            <div><dt>Habitación</dt><dd>{detalle.codigo} · {detalle.tipo}</dd></div>
            <div><dt>Fecha de ingreso</dt><dd>{detalle.fecha_ingreso}</dd></div>
            <div><dt>Duración</dt><dd>{detalle.meses} meses</dd></div>
            <div><dt>Valor total</dt><dd>{cop(detalle.valor_total)}</dd></div>
            <div><dt>Estado</dt><dd>{detalle.estado}</dd></div>
            <div><dt>Solicitada</dt><dd>{fecha(detalle.creado_en)}</dd></div>
          </dl>
          {detalle.consecutivo && <a className="btn ancho" href={`/api/reservas/${detalle.id}/comprobante`}>Descargar comprobante {detalle.consecutivo}</a>}
        </Dialogo>
      )}
      {confirmarFin && (
        <Dialogo titulo="Finalizar estadía" cerrar={() => setConfirmarFin(null)}>
          <p>¿Confirmas que tu estadía en <b>{confirmarFin.pension}</b> finalizó? Esto libera la habitación y habilita la calificación de la pensión.</p>
          <div className="fila-acciones">
            <button className="btn sec" onClick={() => setConfirmarFin(null)}>Cancelar</button>
            <button className="btn" onClick={() => finalizar(confirmarFin.id)}>Confirmar</button>
          </div>
        </Dialogo>
      )}
    </main>
  );
}
