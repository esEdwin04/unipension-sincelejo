import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { API, cop, estrellas } from '../api.js';
import { useSesion } from '../App.jsx';
import Aviso from '../componentes/Aviso.jsx';

// Ficha detallada + solicitud de reserva + reseñas (HU-05, HU-06, HU-10)
export default function Detalle() {
  const { id } = useParams();
  const { usuario } = useSesion();
  const nav = useNavigate();
  const [p, setP] = useState(null);
  const [visor, setVisor] = useState(null);
  const [msj, setMsj] = useState(null);
  const [puedeResenar, setPuedeResenar] = useState(false);
  const [reserva, setReserva] = useState({ habitacion_id: '', fecha_ingreso: '', meses: 6 });
  const [resena, setResena] = useState({ estrellas: 5, comentario: '' });
  const mapaRef = useRef(null);

  const cargar = async () => {
    const d = await API.get('/pensiones/' + id);
    setP(d);
    const libre = d.habitaciones.find((h) => h.estado === 'Libre');
    setReserva((r) => ({ ...r, habitacion_id: libre?.id || '' }));
    if (usuario?.rol === 'estudiante') {
      const mias = await API.get('/reservas/mias');
      setPuedeResenar(mias.some((r) => r.pension === d.nombre && r.estado === 'Finalizada'));
    }
  };
  useEffect(() => { cargar(); }, [id]);

  // Mapa Leaflet (HU-05 esc. 4)
  useEffect(() => {
    if (!p?.lat || mapaRef.current) return;
    const m = L.map('mapa').setView([p.lat, p.lng], 15);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(m);
    L.marker([p.lat, p.lng]).addTo(m).bindPopup(p.nombre).openPopup();
    mapaRef.current = m;
    return () => { m.remove(); mapaRef.current = null; };
  }, [p]);

  if (!p) return <main className="seccion"><p>Cargando…</p></main>;

  const hab = p.habitaciones.find((h) => h.id === +reserva.habitacion_id);
  const libres = p.habitaciones.filter((h) => h.estado === 'Libre');
  const total = hab ? hab.tarifa * (+reserva.meses || 0) + p.deposito : 0;
  const hoy = new Date().toISOString().slice(0, 10);

  async function enviarReserva(e) {
    e.preventDefault();
    if (!usuario) return nav('/acceso');
    if (usuario.rol !== 'estudiante') return setMsj({ t: 'error', m: 'Solo los estudiantes pueden solicitar reservas.' });
    try {
      const r = await API.post('/reservas', { ...reserva, habitacion_id: +reserva.habitacion_id, meses: +reserva.meses });
      nav(`/mis-reservas?pagar=${r.reserva_id}`);
    } catch (err) {
      let m = err.message;
      if (err.datos?.similares?.length)
        m += '. Similares: ' + err.datos.similares.map((s) => `${s.pension} (${s.codigo}, ${cop(s.tarifa)})`).join(' · ');
      setMsj({ t: 'error', m });
    }
  }

  async function enviarResena(e) {
    e.preventDefault();
    try {
      const r = await API.post('/resenas', { pension_id: +id, ...resena, estrellas: +resena.estrellas });
      setMsj({ t: 'ok', m: r.mensaje }); cargar();
    } catch (err) { setMsj({ t: 'error', m: err.message }); }
  }

  return (
    <main className="seccion">
      <p className="kicker">Barrio {p.barrio} · {p.direccion}</p>
      <h1 className="titulo-seccion">{p.nombre}</h1>
      <span className="estrellas">{estrellas(p.calificacion)}</span>
      {msj && <Aviso tipo={msj.t}>{msj.m}</Aviso>}

      <div className="detalle-grid" style={{ marginTop: 30 }}>
        <div>
          {/* Galería con visor (HU-05 esc. 3) */}
          <div className="galeria">
            {p.fotos.map((f, i) => (
              <img key={f + i} src={f} alt={`Fotografía ${i + 1} de ${p.nombre}`}
                   className={i === 0 ? 'principal' : ''} onClick={() => setVisor(f)} />
            ))}
          </div>

          <h3 className="serif" style={{ fontSize: '1.5rem', margin: '34px 0 10px' }}>La pensión</h3>
          <p style={{ color: 'var(--niebla)' }}>{p.descripcion || 'Habitaciones para estudiantes en casa de familia.'}</p>

          <h3 className="serif" style={{ fontSize: '1.5rem', margin: '30px 0 12px' }}>Servicios incluidos</h3>
          <div>{(p.servicios || '').split(',').filter(Boolean).map((s) => <span className="etiqueta" key={s}>{s.trim()}</span>)}</div>

          <h3 className="serif" style={{ fontSize: '1.5rem', margin: '30px 0 10px' }}>Reglas de convivencia</h3>
          <p style={{ color: 'var(--niebla)' }}>{p.reglas || 'No registradas.'}</p>

          <h3 className="serif" style={{ fontSize: '1.5rem', margin: '34px 0 12px' }}>Ubicación y distancia al campus</h3>
          <div id="mapa" />
          <ul className="lista-info" style={{ marginTop: 10 }}>
            {p.universidades.map((u) => (
              <li key={u.nombre}><span>{u.nombre}</span><span>{u.distancia_km ?? '—'} km aprox.</span></li>
            ))}
          </ul>

          <h3 className="serif" style={{ fontSize: '1.5rem', margin: '34px 0 6px' }}>Reseñas de estudiantes</h3>
          {p.resenas.length === 0 && <p style={{ color: 'var(--niebla)' }}>Aún no hay reseñas para esta pensión.</p>}
          {p.resenas.map((r, i) => (
            <div className="resena" key={i}>
              <span className="estrellas">{'★'.repeat(r.estrellas)}</span>
              <strong style={{ marginLeft: 8 }}>{r.nombre}</strong>
              <span style={{ color: 'var(--niebla)', fontSize: '.85rem' }}> · {r.creado_en.slice(0, 10)}</span>
              <p style={{ color: 'var(--niebla)' }}>{r.comentario}</p>
            </div>
          ))}
          {/* HU-10: solo con estadía finalizada */}
          {usuario?.rol === 'estudiante' && (puedeResenar ? (
            <form onSubmit={enviarResena} style={{ marginTop: 20 }}>
              <div className="campo"><label>Tu calificación</label>
                <select value={resena.estrellas} onChange={(e) => setResena({ ...resena, estrellas: e.target.value })}>
                  {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)}</option>)}
                </select></div>
              <div className="campo"><label>Comentario</label>
                <textarea rows="3" value={resena.comentario}
                          onChange={(e) => setResena({ ...resena, comentario: e.target.value })}
                          placeholder="Cuéntales a otros estudiantes cómo fue tu estadía" /></div>
              <button className="boton chico">Publicar reseña</button>
            </form>
          ) : (
            <p style={{ color: 'var(--niebla)', fontSize: '.9rem', marginTop: 12 }}>
              La calificación se habilita únicamente al finalizar una estadía en esta pensión.
            </p>
          ))}
        </div>

        {/* ---------- Caja de reserva (HU-06) ---------- */}
        <aside className="panel reservar-caja" id="reservar">
          <p className="kicker" style={{ marginBottom: 6 }}>Reserva tu cupo</p>
          <div className="precio">{cop(p.tarifa_mensual)} <small>COP / MES</small></div>
          <form onSubmit={enviarReserva}>
            <div className="campo"><label>Habitación</label>
              <select required value={reserva.habitacion_id}
                      onChange={(e) => setReserva({ ...reserva, habitacion_id: e.target.value })}>
                {libres.length === 0 && <option value="">Sin habitaciones disponibles</option>}
                {libres.map((h) => (
                  <option key={h.id} value={h.id}>{h.codigo} · {h.tipo} · {cop(h.tarifa)}/mes</option>
                ))}
              </select></div>
            <div className="campo"><label>Fecha de ingreso</label>
              <input type="date" required min={hoy} value={reserva.fecha_ingreso}
                     onChange={(e) => setReserva({ ...reserva, fecha_ingreso: e.target.value })} /></div>
            <div className="campo"><label>Duración (meses)</label>
              <input type="number" min="1" max="12" required value={reserva.meses}
                     onChange={(e) => setReserva({ ...reserva, meses: e.target.value })} /></div>
            {hab && (
              <Aviso tipo="info">
                Costo estimado: <strong>{cop(total)}</strong><br />
                ({cop(hab.tarifa)} × {reserva.meses || 0} meses + depósito {cop(p.deposito)})
              </Aviso>
            )}
            <button className="boton" style={{ width: '100%' }} disabled={libres.length === 0}>
              Continuar al pago
            </button>
          </form>
        </aside>
      </div>

      {visor && (
        <div className="visor" onClick={() => setVisor(null)}>
          <img src={visor} alt="Vista ampliada" />
        </div>
      )}
    </main>
  );
}
