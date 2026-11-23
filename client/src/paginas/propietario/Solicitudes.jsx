// -------------------------------------------------------------------------------
// Responsable: Edwin Diaz
// Bandeja de solicitudes del propietario (HU-09): aceptar o rechazar con motivo (diálogo),
// plazo de 48 h y notificaciones.
// -------------------------------------------------------------------------------
import { useEffect, useState } from 'react';
import { API, cop, fecha } from '../../api.js';
import { useSesion } from '../../App.jsx';
import { Aviso, Campo, Cargando, Chip, Dialogo, TituloPagina, Vacio } from '../../componentes/ui.jsx';

export default function Solicitudes() {
  const { avisar } = useSesion();
  const [lista, setLista] = useState(null);
  const [notifs, setNotifs] = useState([]);
  const [rechazo, setRechazo] = useState(null); // { id, motivo, error }
  const [error, setError] = useState('');

  const cargar = async () => {
    try {
      const [s, n] = await Promise.all([API.get('/reservas/solicitudes'), API.get('/reservas/notificaciones')]);
      setLista(s); setNotifs(n);
    } catch (e) { setError(e.message); setLista([]); }
  };
  useEffect(() => { cargar(); }, []);

  async function responder(id, decision, motivo) {
    try {
      const r = await API.post(`/reservas/${id}/responder`, { decision, motivo });
      avisar(r.mensaje); setRechazo(null); cargar();
    } catch (err) {
      if (rechazo) setRechazo({ ...rechazo, error: err.message }); else setError(err.message);
    }
  }

  return (
    <main className="contenido">
      <TituloPagina titulo="Solicitudes de reserva" subtitulo="Responde las solicitudes pagadas en un máximo de 48 horas; si no, se cancelan automáticamente" />
      <Aviso tipo="error">{error}</Aviso>
      {!lista ? <Cargando /> : lista.length === 0 ? (
        <Vacio icono="solicitudes" titulo="No hay solicitudes por ahora" texto="Cuando un estudiante pague una reserva en tus pensiones aparecerá aquí." />
      ) : (
        <div className="panel tabla-env">
          <table>
            <thead><tr><th>#</th><th>Pensión / habitación</th><th>Estudiante</th><th>Ingreso</th><th>Valor</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {lista.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.pension}<br /><small>{s.codigo} · {s.tipo}</small></td>
                  <td>{s.estudiante}<br /><small>{s.estado === 'Confirmada' ? `${s.telefono || 'sin teléfono'} · ${s.correo}` : 'Contacto visible al aceptar'}</small></td>
                  <td>{s.fecha_ingreso}<br /><small>{s.meses} meses</small></td>
                  <td>{cop(s.valor_total)}</td>
                  <td><Chip clase={s.estado}>{s.estado}</Chip>{s.estado === 'Pagada' && s.responder_antes && <><br /><small>Responder antes de {fecha(s.responder_antes)}</small></>}</td>
                  <td className="celda-acciones">{s.estado === 'Pagada' && (<>
                    <button className="btn chico" onClick={() => responder(s.id, 'aceptar')}>Aceptar</button>
                    <button className="btn chico peligro" onClick={() => setRechazo({ id: s.id, motivo: '', error: '' })}>Rechazar</button>
                  </>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <section className="panel">
        <h2>Notificaciones</h2>
        {notifs.length === 0 && <p className="muted">Sin notificaciones.</p>}
        {notifs.map((x) => <p key={x.id} style={{ borderBottom: '1px solid var(--linea)', padding: '10px 0', fontSize: '.92rem' }}>{x.mensaje} <small className="muted">({fecha(x.creado_en)})</small></p>)}
      </section>
      {rechazo && (
        <Dialogo titulo="Rechazar solicitud" cerrar={() => setRechazo(null)}>
          <form onSubmit={(e) => { e.preventDefault(); if (!rechazo.motivo.trim()) return setRechazo({ ...rechazo, error: 'Indica el motivo del rechazo.' }); responder(rechazo.id, 'rechazar', rechazo.motivo.trim()); }}>
            <Campo etiqueta="Motivo (se notifica al estudiante) *" error={rechazo.error}>
              <textarea value={rechazo.motivo} onChange={(e) => setRechazo({ ...rechazo, motivo: e.target.value })} />
            </Campo>
            <Aviso>Al rechazar se libera el cupo y se registra la reversión del pago.</Aviso>
            <button className="btn peligro ancho">Confirmar rechazo</button>
          </form>
        </Dialogo>
      )}
    </main>
  );
}
