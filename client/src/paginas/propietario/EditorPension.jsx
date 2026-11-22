// =============================================================
// Editor de pensión en 3 pasos (HU-01 publicar / HU-02 editar) — prototipo inicial:
//   1. Información y ubicación (mapa + confirmación del punto)
//   2. Cupos, precio, servicios y convivencia
//   3. Fotografías (1 a 5, comprimidas en el navegador) y revisión
// Las pensiones nuevas guardan un borrador automático en el servidor.
// =============================================================
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API, cop } from '../../api.js';
import { useSesion } from '../../App.jsx';
import Icono from '../../componentes/Icono.jsx';
import { Mapa } from '../../componentes/TarjetaPension.jsx';
import { Aviso, Campo, Cargando, TituloPagina } from '../../componentes/ui.jsx';
import { comprimirFoto, miniatura, FOTOS_REFERENCIA } from '../../imagenes.js';

const SINCELEJO = { lat: 9.3047, lng: -75.3978 };
const NUEVA = { nombre: '', descripcion: '', direccion: '', barrio: '', lat: SINCELEJO.lat, lng: SINCELEJO.lng, instituciones: [],
  tarifa_mensual: '', deposito: 0, tipo_habitacion: 'Individual', capacidad: 1, cupos: 1, servicios: [], reglas: '',
  costos_adicionales: '', fotos: [] };
const CAMPOS_PASO = { 1: ['nombre', 'descripcion', 'direccion', 'barrio', 'lat'], 2: ['tarifa_mensual', 'tipo_habitacion', 'capacidad', 'cupos', 'reglas'], 3: ['fotos'] };

function validar(f, paso, ubicacionOk) {
  const e = {};
  if (paso === 1) {
    if (!f.nombre.trim()) e.nombre = 'Escribe el título de la pensión.';
    if (!f.descripcion.trim()) e.descripcion = 'Describe las habitaciones y condiciones.';
    if (!f.direccion.trim()) e.direccion = 'Escribe la dirección o una referencia general.';
    if (!f.barrio.trim()) e.barrio = 'Escribe el barrio.';
    if (!Number.isFinite(+f.lat) || !Number.isFinite(+f.lng) || f.lat === '' || f.lng === '') e.lat = 'Introduce latitud y longitud válidas.';
    else if (!ubicacionOk) e.lat = 'Confirma el punto de la pensión en el mapa.';
  }
  if (paso === 2) {
    if (!(+f.tarifa_mensual > 0)) e.tarifa_mensual = 'El precio debe ser mayor que cero.';
    if (!Number.isInteger(+f.capacidad) || +f.capacidad < 1) e.capacidad = 'La capacidad debe ser un entero mayor que cero.';
    if (!Number.isInteger(+f.cupos) || +f.cupos < 0 || +f.cupos > +f.capacidad) e.cupos = 'Los cupos deben ser enteros entre cero y la capacidad total.';
    if (!f.reglas.trim()) e.reglas = 'Indica las reglas de convivencia.';
  }
  if (paso === 3 && (f.fotos.length < 1 || f.fotos.length > 5)) e.fotos = 'Añade entre una y cinco fotografías.';
  return e;
}

export default function EditorPension() {
  const { id } = useParams();
  const editando = !!id;
  const { avisar, proteger } = useSesion();
  const nav = useNavigate();
  const [f, setF] = useState(null);
  const [original, setOriginal] = useState(null);
  const [paso, setPaso] = useState(1);
  const [errores, setErrores] = useState({});
  const [ubicacionOk, setUbicacionOk] = useState(false);
  const [unis, setUnis] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [ocupado, setOcupado] = useState(false);
  const [borrador, setBorrador] = useState(null); // borrador previo encontrado
  const [errorGeneral, setErrorGeneral] = useState('');
  const sucio = useRef(false);
  const enviado = useRef(false);

  useEffect(() => {
    API.get('/pensiones/universidades').then(setUnis).catch(() => {});
    API.get('/pensiones/servicios').then(setServicios).catch(() => {});
    if (editando) {
      API.get(`/pensiones/${id}`).then((p) => {
        if (!p.es_mia) throw new Error('Esta pensión pertenece a otro propietario.');
        const datos = {
          nombre: p.nombre, descripcion: p.descripcion || '', direccion: p.direccion, barrio: p.barrio, lat: p.lat ?? SINCELEJO.lat,
          lng: p.lng ?? SINCELEJO.lng, instituciones: String(p.instituciones || '').split(',').map((s) => s.trim()).filter(Boolean),
          tarifa_mensual: p.tarifa_mensual, deposito: p.deposito, tipo_habitacion: p.tipo_habitacion, capacidad: p.capacidad,
          cupos: p.cupos, max_cupos: p.max_cupos, servicios: String(p.servicios || '').split(',').map((s) => s.trim()).filter(Boolean),
          reglas: p.reglas || '', costos_adicionales: p.costos_adicionales || '', fotos: p.fotos, estado: p.estado };
        setF(datos); setOriginal(datos); setUbicacionOk(p.lat != null);
      }).catch((e) => setErrorGeneral(e.message));
    } else {
      setF(NUEVA);
      API.get('/pensiones/borrador').then((b) => { if (b) setBorrador(b); }).catch(() => {});
    }
  }, [id, editando]);

  // Protección de salida y autoguardado del borrador (solo pensiones nuevas)
  useEffect(() => {
    if (!f || !sucio.current) return undefined;
    proteger(editando ? '¿Salir sin guardar los cambios de la pensión?' : 'El borrador se conserva guardado. ¿Salir del editor?');
    if (editando) return undefined;
    const t = setTimeout(() => { API.put('/pensiones/borrador', f).catch(() => {}); }, 700);
    return () => clearTimeout(t);
  }, [f, editando, proteger]);
  useEffect(() => {
    const antes = (e) => { if (sucio.current && !enviado.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', antes);
    return () => { window.removeEventListener('beforeunload', antes); proteger(null); };
  }, [proteger]);

  if (errorGeneral && !f) return <main className="contenido"><Aviso tipo="error">{errorGeneral}</Aviso></main>;
  if (!f) return <Cargando />;

  const set = (k, v) => { sucio.current = true; setF((x) => ({ ...x, [k]: v })); setErrores((e) => ({ ...e, [k]: '' })); };
  const alternar = (k, valor, si) => set(k, si ? [...f[k], valor] : f[k].filter((x) => x !== valor));

  function salir() {
    if (sucio.current && !window.confirm(editando ? '¿Salir sin guardar los cambios?' : 'El borrador queda guardado. ¿Volver a Mis pensiones?')) return;
    proteger(null); sucio.current = false;
    nav('/mis-pensiones');
  }

  async function agregarFotos(archivos, indice) {
    if (!archivos?.length) return;
    if (indice === undefined && archivos.length + f.fotos.length > 5) return setErrores({ ...errores, fotos: 'Máximo cinco fotografías. Quita una antes de añadir otra.' });
    setOcupado(true);
    try {
      const nuevas = await Promise.all(Array.from(archivos).slice(0, indice === undefined ? 5 : 1).map((a) => comprimirFoto(a)));
      const fotos = [...f.fotos];
      if (indice === undefined) fotos.push(...nuevas); else fotos[indice] = nuevas[0];
      set('fotos', fotos);
    } catch (err) { setErrores({ ...errores, fotos: err.message }); }
    finally { setOcupado(false); }
  }

  function continuar() {
    const e = validar(f, paso, ubicacionOk);
    setErrores(e);
    if (!Object.keys(e).length) { setPaso(paso + 1); window.scrollTo({ top: 0 }); }
  }

  async function enviar() {
    for (const p of [1, 2, 3]) {
      const e = validar(f, p, ubicacionOk);
      if (Object.keys(e).length) { setErrores(e); setPaso(p); setErrorGeneral('Revisa los campos indicados antes de enviar.'); return; }
    }
    setOcupado(true); setErrorGeneral('');
    try {
      const datos = { ...f, lat: +f.lat, lng: +f.lng, tarifa_mensual: +f.tarifa_mensual, deposito: +f.deposito || 0,
                      capacidad: +f.capacidad, cupos: +f.cupos, miniatura: await miniatura(f.fotos[0]) };
      delete datos.estado; delete datos.max_cupos;
      if (editando && JSON.stringify(f.fotos) === JSON.stringify(original.fotos)) { delete datos.fotos; delete datos.miniatura; }
      const r = editando ? await API.put(`/pensiones/${id}`, datos) : await API.post('/pensiones', datos);
      enviado.current = true; sucio.current = false; proteger(null);
      avisar(r.mensaje);
      nav('/mis-pensiones');
    } catch (err) {
      const campos = err.campos || {};
      setErrores(campos);
      const pasoError = [1, 2, 3].find((p) => CAMPOS_PASO[p].some((c) => campos[c]));
      if (pasoError) setPaso(pasoError);
      setErrorGeneral(err.message);
    } finally { setOcupado(false); }
  }

  return (
    <main className="contenido">
      <TituloPagina titulo={editando ? 'Editar pensión' : 'Publicar pensión'} subtitulo="Tres pasos · información, cupos y fotografías" volver={salir} />
      {borrador && (
        <Aviso tipo="alerta">Tienes un borrador guardado ({borrador.nombre || 'sin título'}).{' '}
          <button className="btn-link" onClick={() => { const { _actualizado_en, ...b } = borrador; setF({ ...NUEVA, ...b }); sucio.current = true; setBorrador(null); }}>Continuar borrador</button>{' · '}
          <button className="btn-link" onClick={() => { API.del('/pensiones/borrador').catch(() => {}); setBorrador(null); }}>Descartar</button>
        </Aviso>
      )}
      <div className="pasos-editor">
        {[1, 2, 3].map((n) => (
          <button key={n} type="button" className={n <= paso ? 'on' : ''} disabled={n > paso} aria-label={`Paso ${n}`}
                  aria-current={n === paso ? 'step' : undefined} onClick={() => n < paso && setPaso(n)} />
        ))}
      </div>
      <div className="pasos-etiquetas" aria-hidden="true">
        <span className={paso === 1 ? 'activo' : ''}>1. Información</span><span className={paso === 2 ? 'activo' : ''}>2. Cupos y servicios</span>
        <span className={paso === 3 ? 'activo' : ''}>3. Fotos y revisión</span>
      </div>
      <Aviso>Plan básico gratuito · hasta cinco fotos. {editando
        ? 'Los cambios de título, dirección, barrio, ubicación o fotografías vuelven a revisión; tarifa, servicios, reglas y cupos se actualizan de inmediato.'
        : 'Toda pensión nueva requiere la revisión del administrador antes de aparecer en el catálogo.'}</Aviso>

      <form className="form-editor" noValidate onSubmit={(e) => { e.preventDefault(); paso < 3 ? continuar() : enviar(); }}>
        {paso === 1 && (
          <>
            <h2>Tu pensión y su ubicación</h2>
            <Campo etiqueta="Título *" error={errores.nombre}><input value={f.nombre} maxLength={100} onChange={(e) => set('nombre', e.target.value)} /></Campo>
            <Campo etiqueta="Descripción *" error={errores.descripcion}>
              <textarea value={f.descripcion} maxLength={2500} onChange={(e) => set('descripcion', e.target.value)} placeholder="Habitaciones, ambiente, cercanía a universidades…" />
            </Campo>
            <div className="dos">
              <Campo etiqueta="Dirección *" error={errores.direccion}>
                <input value={f.direccion} onChange={(e) => set('direccion', e.target.value)} placeholder="Cra 00 # 00-00" />
              </Campo>
              <Campo etiqueta="Barrio *" error={errores.barrio}><input value={f.barrio} onChange={(e) => set('barrio', e.target.value)} /></Campo>
              <Campo etiqueta="Latitud" error={errores.lat}>
                <input type="number" step="any" value={f.lat} onChange={(e) => { set('lat', e.target.value); setUbicacionOk(false); }} />
              </Campo>
              <Campo etiqueta="Longitud">
                <input type="number" step="any" value={f.lng} onChange={(e) => { set('lng', e.target.value); setUbicacionOk(false); }} />
              </Campo>
            </div>
            <Mapa pensiones={[]} seleccion={Number.isFinite(+f.lat) && Number.isFinite(+f.lng) ? { lat: +f.lat, lng: +f.lng } : null}
                  onSeleccionar={(pt) => { set('lat', +pt.lat.toFixed(6)); setF((x) => ({ ...x, lng: +pt.lng.toFixed(6) })); setUbicacionOk(false); }} bajo />
            <label className="confirmar-ubicacion">
              <input type="checkbox" checked={ubicacionOk} onChange={(e) => { setUbicacionOk(e.target.checked); setErrores({ ...errores, lat: '' }); }} />
              <span>Confirmo que el punto seleccionado corresponde a esta pensión.</span>
            </label>
            <fieldset>
              <legend>Instituciones cercanas de referencia</legend>
              <div className="checks">
                {unis.map((u) => (
                  <label className="check" key={u.id}>
                    <input type="checkbox" checked={f.instituciones.includes(u.nombre)} onChange={(e) => alternar('instituciones', u.nombre, e.target.checked)} />{u.nombre}
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}

        {paso === 2 && (
          <>
            <h2>Cupos, precio y convivencia</h2>
            <div className="dos">
              <Campo etiqueta="Precio mensual COP *" error={errores.tarifa_mensual}>
                <input type="number" min="1" step="10000" value={f.tarifa_mensual} onChange={(e) => set('tarifa_mensual', e.target.value)} />
              </Campo>
              <Campo etiqueta="Depósito COP">
                <input type="number" min="0" step="10000" value={f.deposito} onChange={(e) => set('deposito', e.target.value)} />
              </Campo>
              <Campo etiqueta="Tipo de habitación *" error={errores.tipo_habitacion}>
                <select value={f.tipo_habitacion} onChange={(e) => set('tipo_habitacion', e.target.value)}>
                  <option>Individual</option><option>Compartida</option>
                  {f.tipo_habitacion === 'Mixta' && <option value="Mixta">Individual y compartida</option>}
                </select>
              </Campo>
              <span />
              <Campo etiqueta="Capacidad total (habitaciones) *" error={errores.capacidad}>
                <input type="number" min="1" step="1" value={f.capacidad} onChange={(e) => set('capacidad', e.target.value)} />
              </Campo>
              <Campo etiqueta="Cupos disponibles *" error={errores.cupos}>
                <input type="number" min="0" max={f.capacidad} step="1" value={f.cupos} onChange={(e) => set('cupos', e.target.value)} />
              </Campo>
            </div>
            <p className="pista">{+f.cupos === 0 ? 'Ocupada: no aparecerá en el catálogo aunque esté verificada.' : 'Disponible: aparecerá solamente después de ser verificada.'}</p>
            <fieldset>
              <legend>Servicios incluidos</legend>
              <div className="checks">
                {servicios.map((s) => (
                  <label className="check" key={s}><input type="checkbox" checked={f.servicios.includes(s)} onChange={(e) => alternar('servicios', s, e.target.checked)} />{s}</label>
                ))}
              </div>
            </fieldset>
            <Campo etiqueta="Reglas de convivencia *" error={errores.reglas}><textarea value={f.reglas} onChange={(e) => set('reglas', e.target.value)} /></Campo>
            <Campo etiqueta="Costos adicionales"><input value={f.costos_adicionales} onChange={(e) => set('costos_adicionales', e.target.value)} placeholder="Indica si existen o escribe Ninguno" /></Campo>
          </>
        )}

        {paso === 3 && (
          <>
            <h2>Fotografías y revisión</h2>
            <label className="subir">
              <Icono nombre="mas" /><b>Añadir fotografías ({f.fotos.length}/5)</b><small>JPG, PNG o WebP · se comprimen en el navegador</small>
              <input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={ocupado || f.fotos.length >= 5}
                     onChange={(e) => { agregarFotos(e.target.files); e.target.value = ''; }} />
            </label>
            <button type="button" className="btn sec chico" disabled={ocupado || f.fotos.length >= 5}
                    onClick={() => set('fotos', [...f.fotos, FOTOS_REFERENCIA[f.fotos.length % FOTOS_REFERENCIA.length]])}>
              Añadir imagen de referencia
            </button>
            {errores.fotos && <p className="campo-error" role="alert">{errores.fotos}</p>}
            <div className="grid-fotos">
              {f.fotos.map((src, i) => (
                <div key={`${i}-${src.slice(-24)}`}>
                  <img src={src} alt={`Vista previa ${i + 1}`} />
                  <span>{i === 0 ? 'Principal' : `Foto ${i + 1}`}</span>
                  <label>Reemplazar<input type="file" accept="image/jpeg,image/png,image/webp" disabled={ocupado}
                                          onChange={(e) => { agregarFotos(e.target.files, i); e.target.value = ''; }} /></label>
                  <button type="button" disabled={ocupado} onClick={() => set('fotos', f.fotos.filter((_, k) => k !== i))}>Quitar</button>
                </div>
              ))}
            </div>
            <section className="vista-previa">
              <h3>{f.nombre || 'Sin título'}</h3>
              <p className="muted">{f.descripcion}</p>
              <dl>
                <div><dt>Barrio</dt><dd>{f.barrio}</dd></div>
                <div><dt>Mensualidad</dt><dd>{cop(f.tarifa_mensual)} COP</dd></div>
                <div><dt>Cupos</dt><dd>{f.cupos} de {f.capacidad} · {f.tipo_habitacion === 'Mixta' ? 'Mixta' : f.tipo_habitacion}</dd></div>
                <div><dt>Servicios</dt><dd>{f.servicios.join(', ') || 'No declarados'}</dd></div>
              </dl>
            </section>
            <Aviso>Al enviar se guarda como pendiente de revisión (salvo cambios comerciales en una pensión ya verificada).</Aviso>
          </>
        )}

        <Aviso tipo="error">{errorGeneral}</Aviso>
        <div className="fila-acciones">
          <button type="button" className="btn sec" disabled={ocupado} onClick={() => (paso === 1 ? salir() : setPaso(paso - 1))}>
            {paso === 1 ? (editando ? 'Cancelar' : 'Guardar borrador y salir') : 'Volver al paso anterior'}
          </button>
          <button className="btn" disabled={ocupado}>
            {ocupado ? 'Procesando…' : paso < 3 ? 'Continuar' : editando ? 'Guardar cambios' : 'Enviar pensión a revisión'}
          </button>
        </div>
      </form>
    </main>
  );
}
