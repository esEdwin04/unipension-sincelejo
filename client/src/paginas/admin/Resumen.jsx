// Responsable: Edwin Diaz
// Resumen del administrador (prototipo): hero, contadores que llevan a cada vista y planes
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API, cop, primerNombre } from '../../api.js';
import { useSesion } from '../../App.jsx';
import { Aviso, Planes, TituloPagina } from '../../componentes/ui.jsx';

export default function Resumen() {
  const { usuario } = useSesion();
  const nav = useNavigate();
  const [k, setK] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { API.get('/admin/indicadores').then((d) => setK(d.kpis)).catch((e) => setError(e.message)); }, []);

  return (
    <main className="contenido">
      <TituloPagina titulo={`Hola, ${primerNombre(usuario.nombre)}`} subtitulo="Administración de la plataforma · verificación, reportes y auditoría" />
      <section className="hero-panel">
        <div className="vidrio vidrio-hero">
          <p className="eyebrow">Moderación UniPensión</p>
          <h2>Pensiones claras, decisiones trazables.</h2>
          <p>Revisa condiciones, fotografías y reportes antes de publicar. Cada decisión queda en la bitácora.</p>
          <button className="btn claro" onClick={() => nav('/admin/publicaciones?estado=Pendiente')}>Revisar publicaciones</button>
        </div>
      </section>
      <Aviso tipo="error">{error}</Aviso>
      {k && (
        <>
          <div className="estadisticas">
            <button onClick={() => nav('/admin/publicaciones?estado=Pendiente')}><b>{k.pensiones_pendientes}</b><small>Pendientes</small></button>
            <button onClick={() => nav('/admin/reportes')}><b>{k.reportes_activos}</b><small>Reportes activos</small></button>
            <button onClick={() => nav('/admin/publicaciones?estado=Suspendida')}><b>{k.pensiones_suspendidas}</b><small>Ocultas</small></button>
            <button onClick={() => nav('/admin/publicaciones?estado=destacados')}><b>{k.destacadas}</b><small>Destacadas</small></button>
          </div>
          <div className="estadisticas">
            <div><b>{k.pensiones_verificadas}</b><small>Verificadas de {k.pensiones_total}</small></div>
            <div><b>{k.reservas_total}</b><small>Reservas ({k.reservas_confirmadas} confirmadas)</small></div>
            <div><b>{k.contactos}</b><small>Contactos por WhatsApp</small></div>
            <button onClick={() => nav('/admin/auditoria')}><b style={{ fontSize: '1.7rem' }}>{cop(k.ingresos)}</b><small>Pagos aprobados · ver auditoría</small></button>
          </div>
        </>
      )}
      <Aviso>Verificar el contenido de un anuncio no certifica la identidad, la propiedad legal ni la disponibilidad real del inmueble.</Aviso>
      <Planes />
    </main>
  );
}
