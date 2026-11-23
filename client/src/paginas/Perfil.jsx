// -------------------------------------------------------------------------------
// Responsable: Edwin Diaz.
// Perfil (prototipo): Mi perfil · Editar perfil · Configuración de la cuenta ·
// Cambiar contraseña · Privacidad y tratamiento de datos (RNF-05, RNF-07)
// --------------------------------------------------------------------------------
import { useEffect, useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { API, fecha, modoDemo, textoDocumento } from '../api.js';
import { useSesion } from '../App.jsx';
import Icono from '../componentes/Icono.jsx';
import { Aviso, Avatar, Campo, Cargando, ItemMenu, PoliticaDatos, TituloPagina } from '../componentes/ui.jsx';
import { comprimirFoto } from '../imagenes.js';
import { celular, MENSAJES, nombreValido, soloAlfanumerico, soloLetras, textoValido } from '../validacion.js';

const ROL = { estudiante: 'Estudiante', propietario: 'Propietario', administrador: 'Administrador' };
// «+573022222222» → «+57 302 222 2222»
const formatoCelular = (t) => { const d = String(t || '').replace(/\D/g, '').replace(/^57(?=3\d{9}$)/, '');
  return /^3\d{9}$/.test(d) ? `+57 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : t; };

export default function Perfil() {
  const { refrescar } = useSesion();
  const [perfil, setPerfil] = useState(null);
  const [exito, setExito] = useState('');
  const [error, setError] = useState('');
  const cargar = () => API.get('/auth/perfil').then(setPerfil).catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, []);
  const guardado = async (msg, nuevo) => { if (nuevo) setPerfil(nuevo); else await cargar(); setExito(msg); refrescar(); };

  if (error) return <main className="contenido"><Aviso tipo="error">{error}</Aviso></main>;
  if (!perfil) return <Cargando />;
  return (
    <main className="contenido">
      <Routes>
        <Route index element={<VerPerfil perfil={perfil} exito={exito} />} />
        <Route path="editar" element={<EditarPerfil perfil={perfil} guardado={guardado} />} />
        <Route path="configuracion" element={<Configuracion perfil={perfil} exito={exito} />} />
        <Route path="clave" element={<CambiarClave guardado={guardado} />} />
        <Route path="privacidad" element={<Privacidad perfil={perfil} guardado={guardado} />} />
      </Routes>
    </main>
  );
}

function VerPerfil({ perfil, exito }) {
  const { salir } = useSesion();
  const nav = useNavigate();
  const esEst = perfil.rol === 'estudiante', esProp = perfil.rol === 'propietario';
  const subtitulo = esEst ? `Estudiante · ${perfil.institucion || 'Sin institución'}`
    : esProp ? `Propietario · ${perfil.relacion || 'Propietario'}` : 'Administrador de la plataforma';
  // Datos de la cuenta, en un solo lugar y en orden de importancia
  const datos = [
    ['mensaje', 'Correo', perfil.correo],
    ['usuario', esProp ? 'WhatsApp' : 'Teléfono', formatoCelular(perfil.telefono)],
    esProp && ['escudo', 'Número de documento', perfil.documento],
    esEst && ['libro', 'Institución', perfil.institucion],
    esEst && ['edificio', 'Programa', [perfil.programa, perfil.nivel].filter(Boolean).join(' · ')],
    esEst && ['ubicacion', 'Ciudad de origen', [perfil.ciudad, perfil.zona].filter(Boolean).join(' · ')],
  ].filter(Boolean);
  const completos = datos.filter(([, , v]) => v).length;

  return (
    <>
      <TituloPagina titulo="Mi perfil" subtitulo="Tus datos, tu cuenta y tu privacidad en un solo lugar" />
      {exito && <Aviso tipo="ok" role="status">{exito}</Aviso>}
      <div className="perfil-layout">
        <section className="perfil-hero perfil-tarjeta" aria-label="Tus datos">
          <Avatar usuario={perfil} grande />
          <h2>{perfil.nombre}</h2>
          <p>{subtitulo}</p>
          <dl className="perfil-datos">
            {datos.map(([icono, etiqueta, valor]) => (
              <div key={etiqueta}>
                <span className="ic"><Icono nombre={icono} tam={18} /></span>
                <dt>{etiqueta}</dt>
                <dd className={valor ? '' : 'vacio-dato'}>{valor || 'Sin completar'}</dd>
              </div>
            ))}
          </dl>
          {completos < datos.length && (
            <button className="btn sec chico" onClick={() => nav('/perfil/editar')}>
              <Icono nombre="editar" tam={16} />Completar perfil ({completos}/{datos.length})
            </button>
          )}
        </section>

        <section className="perfil-acciones" aria-labelledby="titulo-cuenta">
          <h2 id="titulo-cuenta">Tu cuenta</h2>
          <ItemMenu icono="editar" titulo="Editar perfil" detalle="Foto, nombre, teléfono y datos personales" onClick={() => nav('/perfil/editar')} />
          <ItemMenu icono="llave" titulo="Cambiar contraseña" detalle="Mínimo 8 caracteres con mayúscula, minúscula y número" onClick={() => nav('/perfil/clave')} />
          <ItemMenu icono="escudo" titulo="Configuración de la cuenta" detalle="Correo, teléfono y avisos" onClick={() => nav('/perfil/configuracion')} />
          <ItemMenu icono="libro" titulo="Privacidad y datos personales" detalle="Política aceptada y tus derechos (Ley 1581)" onClick={() => nav('/perfil/privacidad')} />
          {esProp && (
            <Aviso tipo={perfil.whatsapp_habilitado ? 'ok' : 'alerta'}>
              {perfil.whatsapp_habilitado
                ? 'Tu WhatsApp está habilitado: los estudiantes pueden escribirte desde la ficha.'
                : 'Tu WhatsApp no está habilitado: los estudiantes solo ven una vista previa. Actívalo en Editar perfil.'}
              {' '}Tu número de documento nunca aparece en los anuncios.
            </Aviso>
          )}
          <button className="salir" onClick={salir}><Icono nombre="salir" />Cerrar sesión</button>
        </section>
      </div>
    </>
  );
}

function EditarPerfil({ perfil, guardado }) {
  const nav = useNavigate();
  const [f, setF] = useState(perfil);
  const [errores, setErrores] = useState({});
  const [ocupado, setOcupado] = useState(false);
  const [unis, setUnis] = useState([]);
  const [demo, setDemo] = useState(true);
  useEffect(() => { API.get('/pensiones/universidades').then(setUnis).catch(() => {}); modoDemo().then(setDemo); }, []);
  const doc = textoDocumento(demo);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const cambios = JSON.stringify(f) !== JSON.stringify(perfil);
  const volver = () => { if (!cambios || window.confirm('¿Descartar los cambios que no guardaste?')) nav('/perfil'); };

  async function foto(e) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setOcupado(true);
    try { setF({ ...f, foto: await comprimirFoto(archivo, 320, 0.7) }); setErrores({ ...errores, foto: '' }); }
    catch (err) { setErrores({ ...errores, foto: err.message }); }
    finally { setOcupado(false); }
  }
  async function guardar(e) {
    e.preventDefault();
    // Validación previa (el servidor vuelve a validar)
    const err = {};
    if (!nombreValido(f.nombre)) err.nombre = MENSAJES.nombre;
    if (f.telefono && !/^3\d{9}$/.test(celular(f.telefono))) err.telefono = MENSAJES.celular;
    for (const [k, max] of [['programa', 80], ['nivel', 30], ['ciudad', 60], ['zona', 60], ['bio', 500]])
      if (f[k] && !textoValido(f[k], 2, max)) err[k] = `Entre 2 y ${max} caracteres, sin los signos < >.`;
    if (Object.keys(err).length) { setErrores(err); return; }
    setOcupado(true);
    const { id, rol, creado_en, consentimiento_version, consentimiento_fecha, ...datos } = f; // eslint-disable-line no-unused-vars
    try { const r = await API.put('/auth/perfil', datos); await guardado(r.mensaje, r.perfil); nav('/perfil'); }
    catch (err) { setErrores({ ...err.campos, form: err.message }); }
    finally { setOcupado(false); }
  }

  return (
    <div className="estrecho">
      <TituloPagina titulo="Editar perfil" volver={volver} />
      <form className="form-editor" onSubmit={guardar} noValidate>
        <label className="foto-perfil">
          <Avatar usuario={f} grande />
          <b>Cambiar foto de perfil</b><small className="muted">JPG, PNG o WebP · se comprime antes de guardar</small>
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={ocupado} onChange={foto} />
          {errores.foto && <span className="campo-error">{errores.foto}</span>}
        </label>
        {f.foto && <button type="button" className="btn-link centrado" onClick={() => setF({ ...f, foto: '' })}>Quitar foto</button>}
        <div className="titulo-form"><span><Icono nombre="usuario" tam={18} /></span><div><h2>Información personal</h2><p>Mantén tus datos al día.</p></div></div>
        <Campo etiqueta="Nombre y apellido" error={errores.nombre}>
          <input value={f.nombre} maxLength={80} onChange={(e) => setF({ ...f, nombre: soloLetras(e.target.value) })} />
        </Campo>
        <Campo etiqueta="Correo electrónico" error={errores.correo}><input type="email" maxLength={100} value={f.correo} onChange={set('correo')} /></Campo>
        <Campo etiqueta={f.rol === 'propietario' ? 'Número de WhatsApp (+57)' : 'Número de teléfono (+57)'} error={errores.telefono}>
          <input type="tel" inputMode="numeric" maxLength={13} value={f.telefono || ''} placeholder="3XX XXX XXXX"
                 onChange={(e) => setF({ ...f, telefono: celular(e.target.value) })} />
        </Campo>
        {f.rol === 'estudiante' && (
          <>
            <div className="titulo-form"><span><Icono nombre="libro" tam={18} /></span><div><h2>Tu vida estudiantil</h2><p>Institución, programa y residencia.</p></div></div>
            <Campo etiqueta="Institución educativa">
              <select value={f.institucion || ''} onChange={set('institucion')}>
                <option value="">Selecciona una institución</option>
                {unis.map((u) => <option key={u.id}>{u.nombre}</option>)}
                <option>Otra institución</option>
              </select>
            </Campo>
            <div className="dos">
              <Campo etiqueta="Carrera o programa académico" error={errores.programa}><input maxLength={80} value={f.programa || ''} onChange={set('programa')} /></Campo>
              <Campo etiqueta="Semestre o nivel" error={errores.nivel}><input maxLength={30} value={f.nivel || ''} onChange={set('nivel')} placeholder="Ej.: 3.er semestre" /></Campo>
              <Campo etiqueta="Ciudad de origen o residencia" error={errores.ciudad}>
                <input maxLength={60} value={f.ciudad || ''} onChange={(e) => setF({ ...f, ciudad: soloLetras(e.target.value, 60) })} />
              </Campo>
              <Campo etiqueta="Zona de residencia" error={errores.zona}><input maxLength={60} value={f.zona || ''} onChange={set('zona')} /></Campo>
            </div>
          </>
        )}
        {f.rol === 'propietario' && (
          <>
            <div className="titulo-form"><span><Icono nombre="edificio" tam={18} /></span><div><h2>Tu perfil como propietario</h2><p>Presentación pública y contacto autorizado.</p></div></div>
            <Campo etiqueta={doc.etiqueta} error={errores.documento}>
              <input value={f.documento || ''} maxLength={15} placeholder={doc.ayuda} autoComplete="off"
                     onChange={(e) => setF({ ...f, documento: soloAlfanumerico(e.target.value) })} />
            </Campo>
            <Campo etiqueta="Presentación pública" error={errores.bio}><textarea maxLength={500} value={f.bio || ''} onChange={set('bio')} /></Campo>
            <Campo etiqueta="Relación con la pensión">
              <select value={f.relacion || 'Propietario'} onChange={set('relacion')}>
                <option>Propietario</option><option>Persona autorizada</option>
                <option>Persona autorizada para arrendar</option><option>Persona autorizada para subarrendar</option>
              </select>
            </Campo>
            <label className="check"><input type="checkbox" checked={!!f.whatsapp_habilitado} onChange={set('whatsapp_habilitado')} />
              <span>Este número de WhatsApp es mío o está autorizado para que los estudiantes me contacten.</span></label>
            <Aviso>Si no lo habilitas, los estudiantes solo verán una vista previa del mensaje.</Aviso>
          </>
        )}
        <Aviso tipo="error">{errores.form}</Aviso>
        <div className="fila-acciones">
          <button type="button" className="btn sec" onClick={() => nav('/perfil')}>Cancelar</button>
          <button className="btn" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </form>
    </div>
  );
}

function Configuracion({ perfil, exito }) {
  const { salir } = useSesion();
  const nav = useNavigate();
  return (
    <div className="estrecho">
      <TituloPagina titulo="Configuración de la cuenta" volver={() => nav('/perfil')} />
      {exito && <Aviso tipo="ok" role="status">{exito}</Aviso>}
      <ItemMenu icono="usuario" titulo="Información personal" detalle="Consultar y editar perfil" onClick={() => nav('/perfil/editar')} />
      <ItemMenu icono="llave" titulo="Cambiar contraseña" detalle="Mínimo 8 caracteres con mayúscula, minúscula y número" onClick={() => nav('/perfil/clave')} />
      <ItemMenu icono="mensaje" titulo="Correo electrónico" detalle={perfil.correo} onClick={() => nav('/perfil/editar')} />
      <ItemMenu icono="usuario" titulo="Teléfono" detalle={perfil.telefono || 'Sin registrar'} onClick={() => nav('/perfil/editar')} />
      <ItemMenu icono="escudo" titulo="Privacidad y política de datos" onClick={() => nav('/perfil/privacidad')} />
      <button className="salir" onClick={salir}><Icono nombre="salir" />Cerrar sesión</button>
      <Aviso>No se ofrece borrado automático de cuentas con publicaciones, reservas o decisiones vinculadas, para no perder trazabilidad.
        Para suprimir tus datos escribe a contacto@unipension.co.</Aviso>
    </div>
  );
}

function CambiarClave({ guardado }) {
  const nav = useNavigate();
  const [errores, setErrores] = useState({});
  const [ocupado, setOcupado] = useState(false);
  async function enviar(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const actual = String(fd.get('actual')), nueva = String(fd.get('nueva')), confirmar = String(fd.get('confirmar'));
    const err = {};
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(nueva)) err.nueva = 'Mínimo 8 caracteres, mayúscula, minúscula y número.';
    if (nueva !== confirmar) err.confirmar = 'Las contraseñas no coinciden.';
    setErrores(err);
    if (Object.keys(err).length) return;
    setOcupado(true);
    try { const r = await API.put('/auth/clave', { actual, nueva }); await guardado(r.mensaje); nav('/perfil/configuracion'); }
    catch (ex) { setErrores({ ...ex.campos, form: ex.message }); }
    finally { setOcupado(false); }
  }
  return (
    <div className="estrecho">
      <TituloPagina titulo="Cambiar contraseña" volver={() => nav('/perfil/configuracion')} />
      <form className="form-editor" onSubmit={enviar} noValidate>
        <Aviso>Tu contraseña se guarda cifrada con bcrypt (RNF-05). Usa una que no utilices en otros sitios.</Aviso>
        <Campo etiqueta="Contraseña actual" error={errores.actual}><input name="actual" type="password" autoComplete="current-password" /></Campo>
        <Campo etiqueta="Nueva contraseña" error={errores.nueva}><input name="nueva" type="password" autoComplete="new-password" /></Campo>
        <Campo etiqueta="Confirmar nueva contraseña" error={errores.confirmar}><input name="confirmar" type="password" autoComplete="new-password" /></Campo>
        <Aviso tipo="error">{errores.form && !errores.actual ? errores.form : ''}</Aviso>
        <button className="btn ancho" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Actualizar contraseña'}</button>
      </form>
    </div>
  );
}

function Privacidad({ perfil, guardado }) {
  const nav = useNavigate();
  async function aceptar() {
    try { const r = await API.post('/auth/consentimiento'); await guardado(r.mensaje, r.perfil); nav('/perfil'); }
    catch { /* el error se mostraría en un aviso; la acción es idempotente */ }
  }
  return (
    <div className="estrecho">
      <TituloPagina titulo="Privacidad y tratamiento de datos" volver={() => nav('/perfil/configuracion')} />
      <Aviso>Tu ubicación solo se usa en memoria durante la búsqueda y no se comparte con los propietarios.</Aviso>
      <PoliticaDatos />
      {perfil.consentimiento_version ? (
        <dl className="registro-consentimiento">
          <div><dt>Usuario</dt><dd>#{perfil.id}</dd></div>
          <div><dt>Aceptación</dt><dd>{fecha(perfil.consentimiento_fecha)}</dd></div>
          <div><dt>Versión</dt><dd>{perfil.consentimiento_version}</dd></div>
        </dl>
      ) : <p className="muted" style={{ margin: '12px 0' }}>Cuenta creada antes del registro de versiones: no consta la versión aceptada.</p>}
      <button className="btn sec" onClick={aceptar}>Aceptar política actual</button>
    </div>
  );
}
