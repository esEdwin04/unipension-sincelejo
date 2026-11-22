// =============================================================
// Auditoría → WhatsApp (RF-15): estado de la integración con la WhatsApp Cloud API,
// bitácora de avisos enviados, simulados, omitidos o con error, y envío de prueba.
// =============================================================
import { useEffect, useState } from 'react';
import { API, fecha } from '../../api.js';
import { Aviso, Campo, Cargando, Chip } from '../../componentes/ui.jsx';

const CLASE_ESTADO = { Enviado: 'Confirmada', Simulado: 'Pendiente', Omitido: 'Finalizada', Error: 'Rechazada' };

export default function PanelWhatsApp() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [telefono, setTelefono] = useState('');
  const [prueba, setPrueba] = useState({ ocupado: false, resultado: '', tipo: '' });

  const cargar = () => API.get('/admin/whatsapp').then(setDatos).catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, []);

  async function enviarPrueba(e) {
    e.preventDefault();
    setPrueba({ ocupado: true, resultado: '', tipo: '' });
    try {
      const r = await API.post('/admin/whatsapp/prueba', { telefono });
      setPrueba({ ocupado: false, resultado: r.mensaje, tipo: r.estado === 'Enviado' ? 'ok' : '' });
    } catch (err) {
      setPrueba({ ocupado: false, resultado: err.message, tipo: 'error' });
    }
    cargar();
  }

  if (!datos) return <section className="panel">{error ? <Aviso tipo="error">{error}</Aviso> : <Cargando />}</section>;
  const total = (estado) => datos.resumen.find((r) => r.estado === estado)?.n || 0;

  return (
    <section className="panel">
      {datos.modo === 'real'
        ? <Aviso tipo="ok">Conectado a la WhatsApp Cloud API de Meta: los avisos se envían a quienes los aceptaron en su perfil.</Aviso>
        : <Aviso tipo="alerta">Modo simulado: faltan WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID. Los avisos se registran aquí, pero no se envían.</Aviso>}
      <div className="estadisticas">
        {['Enviado', 'Simulado', 'Omitido', 'Error'].map((e) => <div key={e}><b>{total(e)}</b><small>{e}</small></div>)}
      </div>

      <form className="filtros-tabla" onSubmit={enviarPrueba}>
        <Campo etiqueta="Enviar mensaje de prueba (hello_world) al celular">
          <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="3XX XXX XXXX" />
        </Campo>
        <button className="btn chico" disabled={prueba.ocupado || !telefono.trim()}>{prueba.ocupado ? 'Enviando…' : 'Enviar prueba'}</button>
      </form>
      <Aviso tipo={prueba.tipo} role="status">{prueba.resultado}</Aviso>
      <p className="fine">En modo de prueba de Meta solo se puede escribir a los números verificados en la app (máximo 5).</p>

      <div className="tabla-env">
        <table>
          <thead><tr><th>Fecha</th><th>Destinatario</th><th>Mensaje</th><th>Estado</th></tr></thead>
          <tbody>
            {datos.mensajes.length === 0 && <tr><td colSpan="4">Todavía no hay avisos por WhatsApp.</td></tr>}
            {datos.mensajes.map((m) => (
              <tr key={m.id}>
                <td>{fecha(m.creado_en)}</td>
                <td>{m.usuario || '—'}<br /><small>{m.telefono || 'sin celular'}</small></td>
                <td>{m.texto}<br /><small className="muted">{m.plantilla}</small></td>
                <td><Chip clase={CLASE_ESTADO[m.estado]}>{m.estado}</Chip>{m.detalle && <><br /><small>{m.detalle}</small></>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
