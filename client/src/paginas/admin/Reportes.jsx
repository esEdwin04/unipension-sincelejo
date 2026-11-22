// Reportes de información (prototipo): pensiones con reportes activos de estudiantes
// y reportes ya resueltos. Un reporte activo por estudiante y pensión; 3 estudiantes → ocultamiento automático.
import { useEffect, useState } from 'react';
import { API, fecha } from '../../api.js';
import { Aviso, Cargando, TituloPagina, Vacio } from '../../componentes/ui.jsx';
import { TarjetaModeracion, useModeracion, Historial } from './Publicaciones.jsx';

export default function Reportes() {
  const [reportes, setReportes] = useState(null);
  const [pensiones, setPensiones] = useState([]);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const mod = useModeracion(() => setVersion((v) => v + 1));

  useEffect(() => {
    Promise.all([API.get('/admin/reportes'), API.get('/pensiones/pendientes?estado=todas')])
      .then(([r, p]) => { setReportes(r); setPensiones(p); })
      .catch((e) => { setError(e.message); setReportes([]); });
  }, [version]);

  const activos = (reportes || []).filter((r) => r.estado === 'Pendiente');
  const resueltos = (reportes || []).filter((r) => r.estado !== 'Pendiente');
  const conReportes = pensiones.filter((p) => activos.some((r) => r.pension_id === p.id));

  return (
    <main className="contenido">
      <TituloPagina titulo="Reportes de información" subtitulo="Un reporte activo por estudiante y pensión · tres estudiantes distintos ocultan la pensión preventivamente" />
      <Aviso tipo="error">{error}</Aviso>
      {!reportes ? <Cargando /> : conReportes.length === 0 ? (
        <Vacio icono="escudo" titulo="No hay reportes activos" texto="Los casos resueltos permanecen en el historial." />
      ) : (
        <div className="grid-gestion">
          {conReportes.map((p) => <TarjetaModeracion key={p.id} p={p} mod={mod} reportes={activos.filter((r) => r.pension_id === p.id)} />)}
        </div>
      )}
      {resueltos.length > 0 && (
        <details className="historial">
          <summary>Reportes resueltos ({resueltos.length})</summary>
          {resueltos.map((r) => (
            <p key={r.id}><b>{r.motivo}</b> · {r.pension}<br />
              <small className="muted">{r.estado} · {r.decision || 'sin detalle'} · {fecha(r.resuelto_en || r.creado_en)}</small></p>
          ))}
        </details>
      )}
      <Historial key={version} />
      {mod.dialogo}
    </main>
  );
}
