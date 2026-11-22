// =============================================================
// Inicio del propietario — panel compacto (v0.5.1).
// Encabezado con acciones · indicadores · dos columnas: «Tus pensiones» (estado y cupos) y
// «Solicitudes por responder» (con su plazo de 48 h) · planes. Sin banners decorativos que
// empujen la información hacia abajo.
// =============================================================
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API, cop, fecha, primerNombre, ETIQUETA_ESTADO } from '../../api.js';
import { useSesion } from '../../App.jsx';
import Icono from '../../componentes/Icono.jsx';
import { Aviso, Cargando, Chip, Planes } from '../../componentes/ui.jsx';

// Horas que faltan para el límite de respuesta (la fecha del servidor está en hora de Colombia)
function horasRestantes(limite) {
  if (!limite) return null;
  const ms = new Date(limite.replace(' ', 'T') + '-05:00') - Date.now();
  return Math.max(0, Math.round(ms / 3600e3));
}

export default function InicioPropietario() {
  const { usuario } = useSesion();
  const nav = useNavigate();
  const [mias, setMias] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    API.get('/pensiones/mias').then(setMias).catch((e) => { setError(e.message); setMias([]); });
    API.get('/reservas/solicitudes').then(setSolicitudes).catch(() => {});
  }, []);

  const pendientes = solicitudes.filter((s) => s.estado === 'Pagada')
    .sort((a, b) => String(a.responder_antes).localeCompare(String(b.responder_antes)));
  const lista = mias || [];
  const indicadores = [
    ['Pensiones', lista.length, '/mis-pensiones'],
    ['Visibles en el catálogo', lista.filter((p) => p.visible).length, '/mis-pensiones'],
    ['En revisión', lista.filter((p) => p.estado === 'Pendiente').length, '/mis-pensiones'],
    ['Cupos libres', lista.reduce((t, p) => t + (p.cupos || 0), 0), '/mis-pensiones'],
    ['Por responder', pendientes.length, '/solicitudes', pendientes.length > 0],
  ];

  return (
    <main className="contenido panel-propietario">
      <header className="pp-cabeza">
        <div>
          <p className="eyebrow">Panel del arrendador</p>
          <h1>Hola, {primerNombre(usuario.nombre)}</h1>
          <p className="muted">Gestiona tus pensiones, los cupos y las solicitudes de reserva.</p>
        </div>
        <div className="pp-acciones">
          <button className="btn" onClick={() => nav('/mis-pensiones/nueva')}><Icono nombre="mas" tam={18} />Publicar pensión</button>
          <button className="btn sec" onClick={() => nav('/solicitudes')}><Icono nombre="solicitudes" tam={18} />Solicitudes</button>
        </div>
      </header>

      <Aviso tipo="error">{error}</Aviso>
      {pendientes.length > 0 && (
        <Aviso tipo="alerta">Tienes {pendientes.length} {pendientes.length === 1 ? 'solicitud pagada' : 'solicitudes pagadas'} esperando
          respuesta. Respóndelas antes de 48 horas o se cancelarán automáticamente.</Aviso>
      )}

      <div className="estadisticas pp-indicadores">
        {indicadores.map(([texto, valor, ruta, urgente]) => (
          <button key={texto} className={urgente ? 'urgente' : ''} onClick={() => nav(ruta)}>
            <b>{mias ? valor : '–'}</b><small>{texto}</small>
          </button>
        ))}
      </div>

      <div className="pp-columnas">
        <section className="panel" aria-labelledby="pp-pensiones">
          <div className="pp-titulo">
            <h2 id="pp-pensiones">Tus pensiones</h2>
            <Link className="btn-link" to="/mis-pensiones">Administrar <Icono nombre="flecha" tam={16} /></Link>
          </div>
          {!mias && <Cargando texto="Cargando tus pensiones…" />}
          {mias?.length === 0 && (
            <div className="pp-vacio">
              <p>Aún no has publicado pensiones. Publicar es gratis: administración revisa la información y luego aparece en el catálogo.</p>
              <button className="btn chico" onClick={() => nav('/mis-pensiones/nueva')}><Icono nombre="mas" tam={16} />Publicar mi primera pensión</button>
            </div>
          )}
          <ul className="pp-lista">
            {lista.map((p) => (
              <li key={p.id}>
                <img src={p.foto || '/img/placeholder1.svg'} alt="" loading="lazy" />
                <div>
                  <Link to={`/pension/${p.id}`} className="pp-nombre">{p.nombre}</Link>
                  <small>{p.barrio} · {cop(p.tarifa_mensual)}/mes</small>
                  <span className="chips">
                    <Chip clase={p.estado}>{ETIQUETA_ESTADO[p.estado]}</Chip>
                    <Chip clase={p.cupos > 0 ? 'Disponible' : 'Ocupada'}>{p.cupos}/{p.capacidad} cupos</Chip>
                  </span>
                </div>
                <Link className="btn sec chico" to={`/mis-pensiones/${p.id}/editar`} aria-label={`Editar ${p.nombre}`}><Icono nombre="editar" tam={16} /></Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel" aria-labelledby="pp-solicitudes">
          <div className="pp-titulo">
            <h2 id="pp-solicitudes">Por responder</h2>
            <Link className="btn-link" to="/solicitudes">Ver todas <Icono nombre="flecha" tam={16} /></Link>
          </div>
          {pendientes.length === 0 ? (
            <div className="pp-vacio">
              <Icono nombre="check" tam={26} />
              <p>No tienes solicitudes pendientes. Cuando un estudiante pague una reserva aparecerá aquí.</p>
            </div>
          ) : (
            <ul className="pp-solicitudes">
              {pendientes.slice(0, 4).map((s) => {
                const horas = horasRestantes(s.responder_antes);
                return (
                  <li key={s.id}>
                    <div>
                      <b>{s.estudiante}</b>
                      <small>{s.pension} · {s.codigo} · ingreso {s.fecha_ingreso}</small>
                    </div>
                    <span className={`pp-plazo ${horas !== null && horas <= 12 ? 'urgente' : ''}`} title={`Responder antes de ${fecha(s.responder_antes)}`}>
                      {horas === null ? '—' : `${horas} h`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {pendientes.length > 0 && <button className="btn ancho" onClick={() => nav('/solicitudes')}>Responder solicitudes</button>}
        </section>
      </div>

      <Planes />
      <p className="fine">La disponibilidad (cupos) se actualiza sin modificar la moderación de la pensión.</p>
    </main>
  );
}
