// =============================================================
// Ficha de la pensión (HU-05) + reserva (HU-06) + reseñas (HU-10)
// + contacto por WhatsApp y reporte de información (prototipo inicial).
// Propietario y administrador la ven en modo "Revisión de pensión".
// =============================================================
import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { API, cop, cuposTexto, fecha, estrellas, km, ETIQUETA_ESTADO } from '../api.js';
import { useSesion } from '../App.jsx';
import Icono, { IconoServicio } from '../componentes/Icono.jsx';
import { Mapa } from '../componentes/TarjetaPension.jsx';
import { Aviso, Avatar, Campo, Cargando, Dialogo, Chip } from '../componentes/ui.jsx';

export default function Detalle() {
  const { id } = useParams();
  const { usuario, avisar } = useSesion();
  const nav = useNavigate();
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  const [foto, setFoto] = useState(0);
  const [visor, setVisor] = useState(false);
  const [dialogo, setDialogo] = useState(null);       // 'contacto' | 'reporte'
  const [contacto, setContacto] = useState(null);
  const [motivos, setMotivos] = useState([]);
  const [reporte, setReporte] = useState({ motivo: '', detalle: '', enviado: false, error: '' });
  const [reserva, setReserva] = useState({ habitacion_id: '', fecha_ingreso: '', meses: 6 });
  const [msjReserva, setMsjReserva] = useState(null);
  const [puedeResenar, setPuedeResenar] = useState(false);
  const [resena, setResena] = useState({ estrellas: 5, comentario: '' });
  const [msjResena, setMsjResena] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const estudiante = usuario?.rol === 'estudiante';

  async function cargar() {
    try {
      const d = await API.get('/pensiones/' + id);
      setP(d);
      const libre = d.habitaciones.find((h) => h.estado === 'Libre');
      setReserva((r) => ({ ...r, habitacion_id: libre?.id || '' }));
      if (estudiante) {
        const mias = await API.get('/reservas/mias');
        setPuedeResenar(mias.some((r) => r.pension === d.nombre && r.estado === 'Finalizada'));
      }
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { cargar(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (estudiante) API.get('/pensiones/motivos-reporte').then(setMotivos).catch(() => {}); }, [estudiante]);

  const volver = () => (window.history.length > 1 ? nav(-1) : nav(usuario?.rol === 'propietario' ? '/mis-pensiones' : '/buscar'));
  const revision = usuario && !estudiante;

  if (error) return (
    <div><header className="barra-sup"><button className="btn-icono" onClick={volver} aria-label="Volver"><Icono nombre="atras" /></button><b>Detalle de pensión</b><span /></header>
      <main className="contenido"><Aviso tipo="error">{error}</Aviso><Link className="btn" to="/buscar">Ir al catálogo</Link></main></div>
  );
  if (!p) return <Cargando texto="Cargando la pensión…" />;

  const servicios = String(p.servicios || '').split(',').map((s) => s.trim()).filter(Boolean);
  const libres = p.habitaciones.filter((h) => h.estado === 'Libre');
  const hab = p.habitaciones.find((h) => h.id === +reserva.habitacion_id);
  const total = hab ? hab.tarifa * (+reserva.meses || 0) + p.deposito : 0;
  // Fecha local (toISOString usa UTC: en Colombia, después de las 7 p. m. daría el día siguiente)
  const ahora = new Date();
  const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;

  // Contactar: el estudiante escribe su mensaje y se abre su WhatsApp en el chat del arrendador
  function contactar() {
    if (!usuario) return nav('/ingresar');
    const nombre = String(usuario.nombre || '').split(' ')[0];
    setContacto({
      texto: `Hola, soy ${nombre}. Vi el anuncio «${p.nombre}» en UniPensión y quisiera más información sobre los cupos disponibles.`,
      error: '', enviado: null,
    });
    setDialogo('contacto');
  }

  async function enviarContacto(e) {
    e.preventDefault();
    const texto = contacto.texto.trim();
    if (texto.length < 10) return setContacto({ ...contacto, error: 'Escribe un mensaje de al menos 10 caracteres.' });
    // La pestaña se abre dentro del clic (los navegadores bloquean ventanas abiertas después de esperar
    // al servidor) y se redirige a WhatsApp cuando llega el enlace con el número del arrendador.
    const ventana = p.contacto?.whatsapp ? window.open('', '_blank') : null;
    setOcupado(true);
    try {
      const r = await API.post(`/pensiones/${p.id}/contacto`, { mensaje: texto });
      if (r.url && ventana) { ventana.opener = null; ventana.location.href = r.url; }
      else ventana?.close();
      setContacto({ ...contacto, error: '', enviado: r });
    } catch (err) {
      ventana?.close();
      setContacto({ ...contacto, error: err.campos?.mensaje || err.message });
    } finally { setOcupado(false); }
  }

  async function enviarReporte(e) {
    e.preventDefault();
    if (!reporte.motivo) return setReporte({ ...reporte, error: 'Selecciona un motivo.' });
    setOcupado(true);
    try {
      await API.post(`/pensiones/${p.id}/reportar`, { motivo: reporte.motivo, detalle: reporte.detalle });
      setReporte({ ...reporte, enviado: true, error: '' });
    } catch (err) { setReporte({ ...reporte, error: err.message }); }
    finally { setOcupado(false); }
  }

  async function enviarReserva(e) {
    e.preventDefault();
    if (!usuario) return nav('/ingresar');
    try {
      const r = await API.post('/reservas', { ...reserva, habitacion_id: +reserva.habitacion_id, meses: +reserva.meses });
      nav(`/mis-reservas?pagar=${r.reserva_id}`);
    } catch (err) {
      let m = err.message;
      if (err.datos?.similares?.length)
        m += '. Habitaciones similares disponibles: ' + err.datos.similares.map((s) => `${s.pension} (${s.codigo}, ${cop(s.tarifa)})`).join(' · ');
      setMsjReserva({ t: 'error', m });
      // Otro estudiante tomó el cupo: se recargan los cupos para no ofrecer una habitación ocupada
      if (err.status === 409) cargar();
    }
  }

  async function enviarResena(e) {
    e.preventDefault();
    try {
      const r = await API.post('/resenas', { pension_id: p.id, ...resena, estrellas: +resena.estrellas });
      setMsjResena({ t: 'ok', m: r.mensaje }); setPuedeResenar(false); cargar();
    } catch (err) { setMsjResena({ t: 'error', m: err.message }); }
  }

  async function reportarResena(rid) {
    if (!window.confirm('¿Reportar esta reseña como ofensiva o falsa? Se ocultará mientras el administrador la revisa.')) return;
    try { const r = await API.post(`/resenas/${rid}/reportar`); avisar(r.mensaje); cargar(); }
    catch (err) { avisar(err.message); }
  }

  return (
    <div>
      <header className="barra-sup detalle-cab">
        <button className="btn-icono" onClick={volver} aria-label="Volver" autoFocus><Icono nombre="atras" /></button>
        <b>{revision ? 'Revisión de pensión' : 'Detalle de pensión'}</b><span />
      </header>
      <main className="contenido">
        <section className="galeria" aria-label="Galería de fotografías">
          <div className="galeria-principal">
            <img src={p.fotos[foto] || p.fotos[0] || '/img/placeholder1.svg'} alt={`Fotografía ${foto + 1} de ${p.nombre}`} onClick={() => setVisor(true)} />
            <span className="contador"><Icono nombre="foto" tam={16} />{foto + 1} / {p.fotos.length}</span>
          </div>
          {p.fotos.length > 1 && (
            <div className="miniaturas">
              {p.fotos.slice(0, 5).map((f, i) => (
                <button key={i} className={foto === i ? 'activo' : ''} aria-label={`Ver foto ${i + 1}`} aria-pressed={foto === i} onClick={() => setFoto(i)}>
                  <img src={f} alt="" />
                </button>
              ))}
            </div>
          )}
        </section>
        <p className="fine">Fotografías aportadas por el propietario · toca la imagen para ampliarla</p>

        <div className="det-titulo">
          <p className="eyebrow">Pensión estudiantil</p>
          {p.destacado && <Chip clase="destacado">Destacado</Chip>}
        </div>
        <h1>{p.nombre}</h1>
        <p className="det-lugar"><Icono nombre="ubicacion" tam={16} />{p.barrio} · Sincelejo, Sucre
          {p.calificacion && <span className="estrellas" style={{ marginLeft: 10 }}>{estrellas(p.calificacion)}</span>}</p>
        {revision && <Aviso tipo={p.estado === 'Verificada' ? 'ok' : 'alerta'}>
          Moderación: {ETIQUETA_ESTADO[p.estado]}. {p.visible ? 'Visible en el catálogo.' : 'No visible en el catálogo.'}
          {p.motivo_rechazo && ` Motivo: ${p.motivo_rechazo}.`} La verificación no certifica identidad ni propiedad legal.</Aviso>}

        <div className="det-layout">
          <div>
            <section className="bloque"><h2>Un espacio para tu día a día</h2><p>{p.descripcion || 'Habitaciones para estudiantes en casa de familia.'}</p></section>
            <section className="bloque">
              <h2>Lo que incluye tu pensión</h2>
              {!servicios.length && <p>El propietario no ha declarado servicios incluidos. Consúltalos directamente.</p>}
              <div className="amenidades">{servicios.map((s) => <span key={s}><IconoServicio servicio={s} tam={21} />{s}</span>)}</div>
            </section>
            <section className="bloque">
              <h2>Condiciones y convivencia</h2>
              <p>{p.reglas || 'No registradas.'}</p>
              <div className="extras"><b>Costos adicionales</b><p>{p.costos_adicionales || 'No declarados; consultar directamente.'}</p></div>
            </section>
            <section className="bloque">
              <h2>Conoce la ubicación</h2>
              <p className="det-lugar" style={{ marginBottom: 12 }}><Icono nombre="ubicacion" tam={18} />{p.direccion} · barrio {p.barrio}</p>
              {p.lat != null && <Mapa pensiones={[{ ...p, foto: p.fotos[0] }]} seleccion={{ lat: p.lat, lng: p.lng }} bajo nota={false} />}
              <ul className="lista-dist">
                {p.universidades.map((u) => <li key={u.id}><span>{u.nombre}</span><span>{u.distancia_km != null ? `${km(u.distancia_km)} km aprox.` : '—'}</span></li>)}
              </ul>
              <Aviso>Ubicación declarada por el propietario. La distancia se calcula en línea recta.</Aviso>
            </section>
            <section className="bloque">
              <h2>Reseñas de estudiantes</h2>
              {p.resenas.length === 0 && <p>Aún no hay reseñas para esta pensión.</p>}
              {p.resenas.map((r) => (
                <div className="resena" key={r.id}>
                  <span className="estrellas">{'★'.repeat(r.estrellas)}</span> <strong>{r.nombre}</strong>
                  <small className="muted"> · {fecha(r.creado_en)}</small>
                  <p>{r.comentario}</p>
                  {p.es_mia && <button className="btn-link" onClick={() => reportarResena(r.id)}>Reportar reseña</button>}
                </div>
              ))}
              {estudiante && (puedeResenar ? (
                <form onSubmit={enviarResena} style={{ marginTop: 16 }}>
                  <Campo etiqueta="Tu calificación">
                    <select value={resena.estrellas} onChange={(e) => setResena({ ...resena, estrellas: e.target.value })}>
                      {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)} ({n})</option>)}
                    </select>
                  </Campo>
                  <Campo etiqueta="Comentario">
                    <textarea maxLength={1000} value={resena.comentario} onChange={(e) => setResena({ ...resena, comentario: e.target.value })}
                              placeholder="Cuéntales a otros estudiantes cómo fue tu estadía" />
                  </Campo>
                  <button className="btn chico">Publicar reseña</button>
                </form>
              ) : <p className="fine" style={{ marginTop: 10 }}>La calificación se habilita únicamente al finalizar una estadía en esta pensión.</p>)}
              {msjResena && <Aviso tipo={msjResena.t}>{msjResena.m}</Aviso>}
            </section>
            {estudiante && (
              <button className="btn-reportar" onClick={() => { setReporte({ motivo: '', detalle: '', enviado: false, error: '' }); setDialogo('reporte'); }}>
                <Icono nombre="escudo" tam={18} />Reportar información incorrecta
              </button>
            )}
          </div>

          <aside className="det-lateral">
            <section className="bloque resumen-precio" aria-label="Precio y disponibilidad" style={{ margin: 0 }}>
              <p className="eyebrow">Tu mensualidad</p>
              <div className="precio">{cop(p.tarifa_mensual)}<small> / mes</small></div>
              <p className={`disp ${p.disponibilidad}`}>{p.disponibilidad} · {cuposTexto(p.cupos)}</p>
              <div className="hechos">
                <span><Icono nombre="inicio" tam={20} /><b>{p.tipo_habitacion === 'Mixta' ? 'Individual y compartida' : p.tipo_habitacion}</b>Tipo de habitación</span>
                <span><Icono nombre="usuario" tam={20} /><b>{p.cupos} de {p.capacidad}</b>Cupos disponibles</span>
              </div>
              <p className="fine">Depósito: {cop(p.deposito)} · Precio y disponibilidad declarados por el propietario.</p>
            </section>

            {!revision && (
              <section className="bloque" id="reservar" style={{ margin: 0 }}>
                <h2>Reserva tu cupo</h2>
                <form onSubmit={enviarReserva}>
                  <Campo etiqueta="Habitación">
                    <select required value={reserva.habitacion_id} onChange={(e) => setReserva({ ...reserva, habitacion_id: e.target.value })}>
                      {libres.length === 0 && <option value="">Sin habitaciones disponibles</option>}
                      {libres.map((h) => <option key={h.id} value={h.id}>{h.codigo} · {h.tipo} · {cop(h.tarifa)}/mes</option>)}
                    </select>
                  </Campo>
                  <div className="dos">
                    <Campo etiqueta="Fecha de ingreso">
                      <input type="date" required min={hoy} value={reserva.fecha_ingreso} onChange={(e) => setReserva({ ...reserva, fecha_ingreso: e.target.value })} />
                    </Campo>
                    <Campo etiqueta="Meses">
                      <input type="number" min="1" max="12" required value={reserva.meses} onChange={(e) => setReserva({ ...reserva, meses: e.target.value })} />
                    </Campo>
                  </div>
                  {hab && <Aviso>Costo estimado: <strong>{cop(total)}</strong> ({cop(hab.tarifa)} × {reserva.meses || 0} meses + depósito {cop(p.deposito)})</Aviso>}
                  {msjReserva && <Aviso tipo={msjReserva.t}>{msjReserva.m}</Aviso>}
                  <button className="btn ancho" disabled={libres.length === 0 || !p.visible}>
                    {usuario ? 'Continuar al pago' : 'Inicia sesión para reservar'}
                  </button>
                </form>
              </section>
            )}

            <section className="bloque" style={{ margin: 0 }}>
              <h2>Tu contacto en la pensión</h2>
              {p.contacto ? (
                <div className="dueno">
                  <Avatar usuario={p.contacto} />
                  <div><b>{p.contacto.nombre}</b><small>{p.contacto.relacion}</small><p>{p.contacto.bio || 'Propietario registrado en UniPensión.'}</p></div>
                </div>
              ) : <Aviso>El perfil público del propietario no está disponible.</Aviso>}
              <p className="fine">No se ha verificado legalmente la identidad ni la propiedad.</p>
              <details className="privacidad-contacto">
                <summary>Privacidad del contacto</summary>
                <p className="muted">El documento de identidad, el correo y el teléfono del propietario nunca aparecen en la ficha pública.
                  El número solo se usa en el enlace de WhatsApp si el propietario lo autorizó.</p>
              </details>
            </section>
          </aside>
        </div>
      </main>

      {!revision && (
        <div className="barra-fija">
          <div className="barra-fija-in">
            <div><b>{cop(p.tarifa_mensual)}<small> / mes</small></b><span>{cuposTexto(p.cupos)}</span></div>
            <div className="botones">
              <a className="btn sec" href="#reservar">Reservar</a>
              <button className="btn" disabled={ocupado || !p.visible || (usuario && !estudiante)} onClick={contactar}>
                <Icono nombre="mensaje" tam={20} />{usuario ? <><span className="solo-escritorio">Contactar por </span>WhatsApp</> : <><span className="solo-escritorio">Ingresa para </span>contactar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {visor && <div className="visor" onClick={() => setVisor(false)} role="dialog" aria-label="Vista ampliada"><img src={p.fotos[foto]} alt={`Fotografía ampliada de ${p.nombre}`} /></div>}

      {dialogo === 'contacto' && contacto && (
        <Dialogo titulo={`Escribir a ${p.contacto?.nombre?.split(' ')[0] || 'el arrendador'} por WhatsApp`} cerrar={() => setDialogo(null)}>
          {!contacto.enviado ? (
            <form onSubmit={enviarContacto}>
              {!p.contacto?.whatsapp && (
                <Aviso tipo="alerta">El arrendador todavía no ha vinculado su número de WhatsApp. Puedes preparar el mensaje,
                  pero no se abrirá WhatsApp: mientras tanto, usa «Reserva tu cupo».</Aviso>)}
              <Campo etiqueta="Tu mensaje" error={contacto.error}>
                <textarea rows={5} maxLength={1000} value={contacto.texto} autoFocus
                          onChange={(e) => setContacto({ ...contacto, texto: e.target.value, error: '' })} />
              </Campo>
              <p className="fine">Se agrega el enlace a este anuncio. El mensaje sale desde tu WhatsApp y el arrendador te responde
                allí. Contactar no reserva el cupo.</p>
              <button className="btn ancho" style={{ marginTop: 12 }} disabled={ocupado}>
                <Icono nombre="mensaje" tam={20} />{ocupado ? 'Abriendo WhatsApp…' : p.contacto?.whatsapp ? 'Enviar por WhatsApp' : 'Ver vista previa'}
              </button>
            </form>
          ) : (
            <>
              <Aviso tipo={contacto.enviado.url ? 'ok' : ''} role="status">{contacto.enviado.url
                ? `Abrimos WhatsApp con el chat de ${contacto.enviado.arrendador || 'el arrendador'} y tu mensaje listo. Toca «Enviar» en WhatsApp para que le llegue.`
                : 'El arrendador no ha vinculado su WhatsApp: este es el mensaje que recibiría.'}</Aviso>
              <p className="mensaje-wa">{contacto.enviado.mensaje}</p>
              {contacto.enviado.url && (
                <a className="btn sec ancho" href={contacto.enviado.url} target="_blank" rel="noopener noreferrer" style={{ marginBottom: 10 }}>
                  ¿No se abrió? Abrir WhatsApp</a>)}
              <button className="btn ancho" style={{ marginTop: 6 }} onClick={() => setDialogo(null)}>Listo</button>
            </>
          )}
        </Dialogo>
      )}

      {dialogo === 'reporte' && (
        <Dialogo titulo="Reportar información incorrecta" cerrar={() => setDialogo(null)}>
          {reporte.enviado ? (
            <>
              <Aviso tipo="ok">Tu reporte quedó registrado para moderación.</Aviso>
              <button className="btn ancho" onClick={() => setDialogo(null)}>Volver a la pensión</button>
            </>
          ) : (
            <form onSubmit={enviarReporte}>
              <Campo etiqueta="Motivo obligatorio" error={reporte.error}>
                <select value={reporte.motivo} onChange={(e) => setReporte({ ...reporte, motivo: e.target.value })}>
                  <option value="">Selecciona un motivo</option>
                  {motivos.map((m) => <option key={m}>{m}</option>)}
                </select>
              </Campo>
              <Campo etiqueta="Descripción (opcional)">
                <textarea maxLength={1500} value={reporte.detalle} onChange={(e) => setReporte({ ...reporte, detalle: e.target.value })} />
              </Campo>
              <Aviso>Solo se admite un reporte activo por persona y pensión. Tres estudiantes distintos activan una revisión preventiva.</Aviso>
              <button className="btn ancho" disabled={ocupado}>{ocupado ? 'Registrando…' : 'Enviar reporte'}</button>
            </form>
          )}
        </Dialogo>
      )}
    </div>
  );
}
