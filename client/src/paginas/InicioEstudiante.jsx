// Inicio del estudiante (prototipo): hero con buscador, institución de referencia,
// pensiones para descubrir y "Tu próximo lugar, paso a paso".
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API, primerNombre } from '../api.js';
import { useSesion } from '../App.jsx';
import TarjetaPension from '../componentes/TarjetaPension.jsx';
import Icono from '../componentes/Icono.jsx';
import { Aviso, Cargando, Vacio } from '../componentes/ui.jsx';

export default function InicioEstudiante() {
  const { usuario } = useSesion();
  const nav = useNavigate();
  const [pensiones, setPensiones] = useState(null);
  const [valoradas, setValoradas] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    API.get('/pensiones').then(setPensiones).catch((e) => setError(e.message));
    API.get('/pensiones/mejor-valoradas?limite=3').then(setValoradas).catch(() => setValoradas([]));
  }, []);

  return (
    <main className="contenido">
      <section className="hero-est" aria-label="Encuentra tu lugar en Sincelejo">
        <img src="/img/hero-habitacion.svg" alt="" />
        <div className="hero-est-in">
          <p className="kicker"><span /> TU PRÓXIMA ETAPA EMPIEZA AQUÍ</p>
          <small>{usuario ? `Hola, ${primerNombre(usuario.nombre)}` : 'Hola'}</small>
          <h1>Una nueva etapa.<br /><span>Un lugar para ti.</span></h1>
          <p>Encuentra un espacio para estudiar, descansar y sentirte en casa.</p>
          <button className="buscador-falso" onClick={() => nav('/buscar')}>
            <Icono nombre="buscar" /><span>Busca tu pensión en Sincelejo</span><span className="ir"><Icono nombre="flecha" tam={20} /></span>
          </button>
        </div>
        <span className="hero-lugar"><Icono nombre="ubicacion" tam={16} /> Sincelejo, Sucre</span>
      </section>

      {usuario && (
        <section className="tarjeta-inst">
          <span className="ic"><Icono nombre="libro" tam={24} /></span>
          <div><small>TU PUNTO DE PARTIDA</small><b>{usuario.institucion || 'Selecciona una institución'}</b>
            <span>Filtra el catálogo por distancia a tu campus</span></div>
          <button className="btn sec chico" onClick={() => nav('/perfil/editar')}><Icono nombre="editar" tam={16} /> Cambiar</button>
        </section>
      )}

      <section className="cabeza-seccion">
        <div><p className="eyebrow">Espacios para tu día a día</p><h2>Pensiones para descubrir</h2></div>
        <Link className="btn-link" to="/buscar">Ver catálogo <Icono nombre="flecha" tam={17} /></Link>
      </section>
      <Aviso tipo="error">{error}</Aviso>
      {!pensiones && !error && <Cargando texto="Cargando pensiones…" />}
      {pensiones?.length === 0 && <Vacio titulo="Aún no hay pensiones verificadas" texto="Vuelve pronto: la oferta se publica tras la revisión del administrador." />}
      <div className="grid-pensiones">
        {pensiones?.slice(0, 6).map((p) => <TarjetaPension key={p.id} p={p} />)}
      </div>

      {/* Mejor valoradas (HU-10): promedio de reseñas de estudiantes con estadía finalizada */}
      {valoradas?.length > 0 && (
        <>
          <section className="cabeza-seccion" aria-labelledby="titulo-valoradas">
            <div><p className="eyebrow">Opiniones de estudiantes que ya vivieron allí</p><h2 id="titulo-valoradas">Mejor valoradas</h2></div>
            <Link className="btn-link" to="/buscar?orden=calificacion">Ver todas <Icono nombre="flecha" tam={17} /></Link>
          </section>
          <div className="grid-pensiones">
            {valoradas.map((p) => <TarjetaPension key={p.id} p={p} />)}
          </div>
          <p className="fine">Solo opinan estudiantes con una estadía finalizada en la pensión. Las reseñas se moderan.</p>
        </>
      )}

      <section className="pasos">
        <p className="eyebrow">A tu ritmo, con información clara</p>
        <h2>Tu próximo lugar, paso a paso.</h2>
        <div className="pasos-grid">
          <div><span><Icono nombre="buscar" /></span><b>Explora y compara</b><p>Filtra por precio, servicios y distancia a tu universidad.</p></div>
          <div><span><Icono nombre="edificio" /></span><b>Conoce el espacio</b><p>Revisa las fotos, los cupos y las reglas de convivencia.</p></div>
          <div><span><Icono nombre="mensaje" /></span><b>Habla directamente</b><p>Consulta tus dudas con el propietario por WhatsApp.</p></div>
          <div><span><Icono nombre="calendario" /></span><b>Reserva en línea</b><p>Aparta tu cupo, paga y descarga tu comprobante en PDF.</p></div>
        </div>
      </section>
    </main>
  );
}
