import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API, cop, estrellas } from '../api.js';

// =============================================================
// Página de inicio — organización inspirada en hotelería boutique:
// hero a pantalla completa → presentación 2 columnas → listado
// apilado de pensiones con filtros → bloques alternos → fila de
// servicios → preguntas frecuentes.  (HU-04 integrada al listado)
// =============================================================
export default function Inicio() {
  const [pensiones, setPensiones] = useState([]);
  const [barrios, setBarrios] = useState([]);
  const [unis, setUnis] = useState([]);
  const [sinResultados, setSinResultados] = useState(false);
  const [f, setF] = useState({ barrio: '', precio_min: '', precio_max: '', tipo: '', universidad_id: '', dist_max: '' });
  const nav = useNavigate();

  useEffect(() => {
    API.get('/pensiones/barrios').then(setBarrios);
    API.get('/pensiones/universidades').then(setUnis);
    buscar();
  }, []);

  async function buscar(filtros = f) {
    const q = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v));
    const lista = await API.get('/pensiones?' + q);
    setPensiones(lista);
    setSinResultados(lista.length === 0);
  }

  const limpiar = () => {
    const vacio = { barrio: '', precio_min: '', precio_max: '', tipo: '', universidad_id: '', dist_max: '' };
    setF(vacio); buscar(vacio);
  };
  const campo = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <main>
      {/* ---------- HERO ---------- */}
      <section className="hero">
        <div className="hero-fondo" />
        <div className="hero-contenido">
          <p className="kicker">Sincelejo · Sucre</p>
          <h1>Tu hogar universitario,<br />a pasos del campus</h1>
          <p>Pensiones estudiantiles verificadas una a una. Compara barrios, precios y servicios;
             reserva tu cupo y paga en línea con total tranquilidad.</p>
          <a href="#pensiones" className="boton claro">Reservar</a>
        </div>
        <span className="indicador">Desliza</span>
      </section>

      {/* ---------- PRESENTACIÓN (2 columnas) ---------- */}
      <section className="seccion dos-columnas">
        <div>
          <p className="kicker">Bienvenido</p>
          <h2 className="titulo-seccion">Llegar a estudiar no debería ser complicado</h2>
          <p className="intro-seccion" style={{marginBottom:18}}>
            Cada semestre, cientos de estudiantes llegan a Sincelejo desde Sampués, San Marcos, Tolú,
            Ovejas, Sincé y departamentos vecinos. UniPensión reúne en un solo lugar la oferta real de
            habitaciones en casas de familia: con fotos, tarifas claras y reglas de convivencia.
          </p>
          <p className="intro-seccion">
            Un administrador revisa cada publicación antes de mostrarla, y solo los estudiantes que
            terminaron su estadía pueden calificar. Sin avisos desactualizados ni ofertas falsas.
          </p>
          <a href="#pensiones" className="boton secundario">Ver pensiones</a>
        </div>
        <div className="marco-foto"><img src="/img/placeholder1.svg" alt="Casa de pensión estudiantil" /></div>
      </section>

      {/* ---------- LISTADO DE PENSIONES (bloques apilados + filtros) ---------- */}
      <section className="seccion alterno ancha" id="pensiones">
        <div className="seccion" style={{paddingTop:0,paddingBottom:0}}>
          <p className="kicker">Nuestra oferta</p>
          <h2 className="titulo-seccion">Pensiones verificadas</h2>
          <p className="intro-seccion">Filtra por barrio, precio, tipo de habitación y distancia a tu universidad.</p>

          <form className="filtros" onSubmit={(e) => { e.preventDefault(); buscar(); }}>
            <div><label>Barrio</label>
              <select value={f.barrio} onChange={campo('barrio')}>
                <option value="">Todos</option>
                {barrios.map((b) => <option key={b.barrio}>{b.barrio}</option>)}
              </select></div>
            <div><label>Precio mín.</label><input type="number" min="0" step="10000" value={f.precio_min} onChange={campo('precio_min')} placeholder="0" /></div>
            <div><label>Precio máx.</label><input type="number" min="0" step="10000" value={f.precio_max} onChange={campo('precio_max')} placeholder="600.000" /></div>
            <div><label>Habitación</label>
              <select value={f.tipo} onChange={campo('tipo')}>
                <option value="">Todas</option><option value="individual">Individual</option><option value="compartida">Compartida</option>
              </select></div>
            <div><label>Universidad</label>
              <select value={f.universidad_id} onChange={campo('universidad_id')}>
                <option value="">Ninguna</option>
                {unis.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select></div>
            <div><label>Dist. máx. (km)</label><input type="number" min="0" step="0.5" value={f.dist_max} onChange={campo('dist_max')} placeholder="2" /></div>
            <button className="boton chico" type="submit">Buscar</button>
            <button className="boton chico secundario" type="button" onClick={limpiar}>Limpiar filtros</button>
          </form>

          {sinResultados && (
            <div className="aviso info">Sin resultados para los filtros seleccionados. Intenta ampliar el rango de búsqueda.</div>
          )}

          {pensiones.map((p) => (
            <article className="ficha-lista" key={p.id}>
              <div className="foto"><img src={p.foto || '/img/placeholder1.svg'} alt={`Fotografía de ${p.nombre}`} /></div>
              <div className="cuerpo">
                <p className="meta">Barrio {p.barrio}{p.distancia_km != null && ` · a ${p.distancia_km} km de tu universidad`}</p>
                <h3>{p.nombre}</h3>
                <span className="estrellas">{estrellas(p.calificacion)}</span>
                <p style={{marginTop:10}}>{p.descripcion || 'Habitaciones para estudiantes en casa de familia.'}</p>
                <div className="precio">{cop(p.tarifa_mensual)} <small>COP / MES · {p.habitaciones_libres} hab. disponible(s)</small></div>
                <div className="acciones">
                  <button className="boton" onClick={() => nav(`/pension/${p.id}#reservar`)}>Reservar</button>
                  <Link className="boton secundario" to={`/pension/${p.id}`}>Ver pensión</Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- ELIGE UNIPENSIÓN (bloques alternos) ---------- */}
      <section className="seccion">
        <p className="kicker">Elige UniPensión</p>
        <h2 className="titulo-seccion">Pensado para tu tranquilidad</h2>
        <div className="elige" style={{marginTop:40}}>
          <article>
            <div className="marco-foto"><img src="/img/placeholder2.svg" alt="Habitación estudiantil" /></div>
            <h3>Verificación real</h3>
            <p>Un administrador revisa la documentación y las fotografías de cada vivienda antes de
               publicarla. Las pensiones suspendidas salen del catálogo de inmediato.</p>
          </article>
          <article>
            <div className="marco-foto"><img src="/img/placeholder1.svg" alt="Fachada de pensión" /></div>
            <h3>Reserva y pago en línea</h3>
            <p>Aparta tu cupo con bloqueo temporal, paga el depósito o el primer mes por la pasarela y
               recibe tu comprobante en PDF al instante.</p>
          </article>
        </div>
      </section>

      {/* ---------- FILA DE SERVICIOS ---------- */}
      <section className="seccion alterno ancha" id="servicios">
        <div className="seccion" style={{paddingTop:0,paddingBottom:0}}>
          <p className="kicker">Servicios</p>
          <h2 className="titulo-seccion">Lo que encuentras en nuestras pensiones</h2>
          <div className="servicios-fila" style={{marginTop:40}}>
            {[['☾','Habitaciones'],['⚲','Cerca al campus'],['✧','Internet wifi'],['❋','Lavandería'],['✦','Alimentación']]
              .map(([ic, t]) => (
              <div className="servicio-item" key={t}>
                <div className="icono">{ic}</div><h4>{t}</h4>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- PREGUNTAS FRECUENTES (acordeón) ---------- */}
      <section className="seccion faq" id="preguntas">
        <p className="kicker">Preguntas frecuentes</p>
        <h2 className="titulo-seccion">Antes de reservar</h2>
        <div style={{marginTop:30}}>
          <details>
            <summary>¿Cómo sé que una pensión es real?</summary>
            <p>Toda publicación pasa por la verificación del administrador de la plataforma: documentación
               del propietario, fotografías y condiciones mínimas. Solo las pensiones en estado
               «Verificada» aparecen en el catálogo.</p>
          </details>
          <details>
            <summary>¿Qué pago se hace por la plataforma?</summary>
            <p>Únicamente el pago que formaliza la reserva: el depósito o el primer mes de arriendo. Los
               meses siguientes se acuerdan directamente con el propietario.</p>
          </details>
          <details>
            <summary>¿Cuánto tiempo tengo para pagar mi reserva?</summary>
            <p>Al generar la solicitud, el cupo queda bloqueado durante 30 minutos. Si no completas el
               pago en ese tiempo, la habitación se libera automáticamente para otros estudiantes.</p>
          </details>
          <details>
            <summary>¿Qué pasa si el propietario no responde?</summary>
            <p>El propietario tiene 48 horas para aceptar o rechazar tu solicitud pagada. Si no responde,
               la reserva se cancela automáticamente y el pago se revierte.</p>
          </details>
          <details>
            <summary>¿Puedo calificar la pensión donde viví?</summary>
            <p>Sí. Al finalizar tu estadía se habilita la calificación de 1 a 5 estrellas con reseña, que
               ayuda a orientar a otros estudiantes.</p>
          </details>
        </div>
      </section>
    </main>
  );
}
