// =============================================================
// Perfil (prototipo): Mi perfil · Editar perfil · Configuración de la cuenta ·
// Cambiar contraseña · Privacidad y tratamiento de datos (RNF-05, RNF-07)
// =============================================================
import { useEffect, useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { API, fecha } from '../api.js';
import { useSesion } from '../App.jsx';
import Icono from '../componentes/Icono.jsx';
import { Aviso, Avatar, Campo, Cargando, ItemMenu, PoliticaDatos, TituloPagina } from '../componentes/ui.jsx';
import { comprimirFoto } from '../imagenes.js';

const ROL = { estudiante: 'Estudiante', propietario: 'Propietario', administrador: 'Administrador' };

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
  return (
    <div className="estrecho">
      <TituloPagina titulo="Mi perfil" />
      {exito && <Aviso tipo="ok" role="status">{exito}</Aviso>}
      <div className="perfil-hero">
        <Avatar usuario={perfil} grande />
        <h2>{perfil.nombre}</h2>
        <p>{perfil.rol === 'estudiante' ? `Estudiante · ${perfil.institucion || 'Sin institución'}`
          : perfil.rol === 'propietario' ? `Propietario · ${perfil.relacion || 'Propietario'}` : 'Administrador de la plataforma'}</p>
      </div>
      <div className="perfil-info">
        <span><small>Correo privado</small><b>{perfil.correo}</b></span>
        <span><small>{perfil.rol === 'propietario' ? 'WhatsApp' : 'Teléfono'}</small><b>{perfil.telefono || 'Sin registrar'}</b></span>
      </div>
      {perfil.rol === 'propietario' && (
        <Aviso>Documento privado: {perfil.documento || 'Sin registrar'}. No aparece en los anuncios.
          WhatsApp {perfil.whatsapp_habilitado ? 'habilitado para los estudiantes.' : 'no habilitado: los estudiantes ven una vista previa.'}</Aviso>
      )}
      <ItemMenu icono="editar" titulo="Editar perfil" onClick={() => nav('/perfil/editar')} />
      <ItemMenu icono="escudo" titulo="Configuración de la cuenta" onClick={() => nav('/perfil/configuracion')} />
      {perfil.rol === 'estudiante' && (
        <ItemMenu icono="edificio" titulo="Programa y residencia"
                  detalle={[perfil.programa, perfil.nivel, perfil.ciudad, perfil.zona].filter(Boolean).join(' · ') || 'Sin completar'} />
      )}
      <button className="salir" onClick={salir}><Icono nombre="salir" />Cerrar sesión</button>
    </div>
  );
}

function EditarPerfil({ perfil, guardado }) {
  const nav = useNavigate();
  const [f, setF] = useState(perfil);
  const [errores, setErrores] = useState({});
  const [ocupado, setOcupado] = useState(false);
  const [unis, setUnis] = useState([]);
  useEffect(() => { API.get('/pensiones/universidades').then(setUnis).catch(() => {}); }, []);
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
        <Campo etiqueta="Nombre completo" error={errores.nombre}><input value={f.nombre} onChange={set('nombre')} /></Campo>
        <Campo etiqueta="Correo electrónico" error={errores.correo}><input type="email" value={f.correo} onChange={set('correo')} /></Campo>
        <Campo etiqueta={f.rol === 'propietario' ? 'Número de WhatsApp (+57)' : 'Número de teléfono (+57)'} error={errores.telefono}>
          <input type="tel" value={f.telefono || ''} onChange={set('telefono')} placeholder="3XX XXX XXXX" />
        </Campo>
        {/* Opt-in exigido por WhatsApp para recibir mensajes de la empresa (RF-15) */}
        <label className="check"><input type="checkbox" checked={!!f.avisos_whatsapp} onChange={set('avisos_whatsapp')} />
          <span>Quiero recibir avisos de UniPensión por WhatsApp en este número
            ({f.rol === 'propietario' ? 'solicitudes nuevas y decisiones sobre mis publicaciones' : 'pagos y respuestas a mis reservas'}).</span></label>
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
              <Campo etiqueta="Carrera o programa académico"><input value={f.programa || ''} onChange={set('programa')} /></Campo>
              <Campo etiqueta="Semestre o nivel"><input value={f.nivel || ''} onChange={set('nivel')} /></Campo>
              <Campo etiqueta="Ciudad de origen o residencia"><input value={f.ciudad || ''} onChange={set('ciudad')} /></Campo>
              <Campo etiqueta="Zona de residencia"><input value={f.zona || ''} onChange={set('zona')} /></Campo>
            </div>
          </>
        )}
        {f.rol === 'propietario' && (
          <>
            <div className="titulo-form"><span><Icono nombre="edificio" tam={18} /></span><div><h2>Tu perfil como propietario</h2><p>Presentación pública y contacto autorizado.</p></div></div>
            <Campo etiqueta="Documento de identidad ficticio · privado" error={errores.documento}>
              <input value={f.documento || ''} onChange={set('documento')} placeholder="DEMO-001, nunca un documento real" />
            </Campo>
            <Campo etiqueta="Presentación pública"><textarea maxLength={700} value={f.bio || ''} onChange={set('bio')} /></Campo>
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
      <ItemMenu icono="mensaje" titulo="Avisos por WhatsApp" detalle={perfil.avisos_whatsapp ? 'Activados' : 'Desactivados'} onClick={() => nav('/perfil/editar')} />
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
