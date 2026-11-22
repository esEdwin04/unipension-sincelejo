// Inicio del propietario (prototipo): "Publica. Revisa. Conecta." + estadísticas + planes
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API, primerNombre } from '../../api.js';
import { useSesion } from '../../App.jsx';
import Icono from '../../componentes/Icono.jsx';
import { Aviso, Planes, TituloPagina } from '../../componentes/ui.jsx';

export default function InicioPropietario() {
  const { usuario } = useSesion();
  const nav = useNavigate();
  const [mias, setMias] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    API.get('/pensiones/mias').then(setMias).catch((e) => setError(e.message));
    API.get('/reservas/solicitudes').then(setSolicitudes).catch(() => {});
  }, []);
  const porResponder = solicitudes.filter((s) => s.estado === 'Pagada').length;

  return (
    <main className="contenido">
      <TituloPagina titulo={`Hola, ${primerNombre(usuario.nombre)}`} subtitulo="Gestiona tus pensiones, los cupos disponibles y las solicitudes de reserva" />
      <section className="hero-panel">
        <p className="eyebrow">Tu espacio, su nuevo hogar</p>
        <h2>Publica. Revisa. Conecta.</h2>
        <p>Registra tu pensión; administración la revisa y los estudiantes te contactan por WhatsApp o reservan en línea.</p>
        <button className="btn claro" onClick={() => nav('/mis-pensiones/nueva')}><Icono nombre="mas" />Publicar pensión</button>
      </section>
      <Aviso tipo="error">{error}</Aviso>
      <div className="estadisticas">
        <div><b>{mias.length}</b><small>Mis pensiones</small></div>
        <div><b>{mias.filter((p) => p.visible).length}</b><small>Visibles en el catálogo</small></div>
        <div><b>{mias.filter((p) => p.estado === 'Pendiente').length}</b><small>En revisión</small></div>
        <div><b>{mias.reduce((a, p) => a + p.cupos, 0)}</b><small>Cupos declarados</small></div>
        <button onClick={() => nav('/solicitudes')}><b>{porResponder}</b><small>Solicitudes por responder</small></button>
      </div>
      {porResponder > 0 && <Aviso tipo="alerta">Tienes {porResponder} solicitud(es) pagada(s) esperando respuesta. Respóndelas antes de 48 horas o se cancelarán automáticamente.</Aviso>}
      <div className="fila-acciones">
        <button className="btn sec" onClick={() => nav('/mis-pensiones')}>Administrar mis pensiones</button>
        <button className="btn sec" onClick={() => nav('/solicitudes')}>Ver solicitudes de reserva</button>
      </div>
      <Planes />
      <Aviso>La disponibilidad (cupos) se actualiza sin modificar la moderación de la pensión.</Aviso>
    </main>
  );
}
