// =============================================================
// Pantallas de acceso (RF-01, RNF-05, RNF-07) — prototipo inicial:
// Bienvenida → Iniciar sesión | Crear cuenta (1. Tu experiencia · 2. Tus datos) | Recuperación
// =============================================================
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API, documentoValido, modoDemo, textoDocumento } from '../api.js';
import { useSesion } from '../App.jsx';
import { Marca, Campo, Aviso, PoliticaDatos, VERSION_POLITICA } from '../componentes/ui.jsx';
import Icono from '../componentes/Icono.jsx';

function Escenario({ titulo, volver, children }) {
  return (
    <div className="escenario">
      <div className="escenario-panel">
        {volver && (
          <header className="barra-sup">
            <button className="btn-icono" onClick={volver} aria-label="Volver"><Icono nombre="atras" /></button>
            <b>{titulo}</b><span />
          </header>
        )}
        {children}
      </div>
    </div>
  );
}

function CampoClave({ etiqueta, error, nombre, ...props }) {
  const [ver, setVer] = useState(false);
  return (
    <Campo etiqueta={etiqueta} error={error}>
      <span className="clave">
        <input name={nombre} type={ver ? 'text' : 'password'} {...props} />
        <button type="button" onClick={() => setVer(!ver)}>{ver ? 'Ocultar' : 'Mostrar'}</button>
      </span>
    </Campo>
  );
}

const correoOk = (c) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c);
const claveOk = (c) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(c);
const celularOk = (t) => /^3\d{9}$/.test(String(t).replace(/\D/g, '').replace(/^57(?=3\d{9}$)/, ''));

export function Bienvenida() {
  const nav = useNavigate();
  return (
    <Escenario>
      <main className="bienvenida">
        <div className="bienvenida-arte">
          <Marca />
          <div className="ciudad" aria-hidden="true"><span /><span /><span /><span /><span /></div>
        </div>
        <div className="bienvenida-texto">
          <p className="eyebrow">Pensiones estudiantiles · Sincelejo</p>
          <h1>Encuentra tu lugar</h1>
          <p>Encuentra la pensión ideal para tu vida estudiantil, cerca de tu campus.</p>
          <button className="btn ancho" onClick={() => nav('/ingresar')}>Iniciar sesión</button>
          <button className="btn sec ancho" onClick={() => nav('/registro')}>Crear cuenta</button>
          <Link className="btn-link centrado" to="/buscar">Explorar pensiones sin cuenta</Link>
          <small>Aplicación web responsiva · Proyecto académico CECAR</small>
        </div>
      </main>
    </Escenario>
  );
}

export function Ingresar() {
  const { refrescar } = useSesion();
  const nav = useNavigate();
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [demo, setDemo] = useState([]);
  useEffect(() => { API.get('/auth/demo').then(setDemo).catch(() => {}); }, []);

  async function entrar(correo, clave) {
    setEnviando(true);
    try {
      await API.post('/auth/login', { correo, clave });
      await refrescar();
      nav('/');
    } catch (err) { setErrores({ form: err.message }); }
    finally { setEnviando(false); }
  }
  function enviar(e) {
    e.preventDefault();
    if (enviando) return;
    const f = new FormData(e.currentTarget);
    const correo = String(f.get('correo') || '').trim(), clave = String(f.get('clave') || '');
    const err = {};
    if (!correoOk(correo)) err.correo = 'Escribe un correo electrónico válido.';
    if (!clave) err.clave = 'Escribe tu contraseña.';
    setErrores(err);
    if (!Object.keys(err).length) entrar(correo, clave);
  }

  return (
    <Escenario titulo="" volver={() => nav('/')}>
      <section className="relleno">
        <div className="acceso-cabeza"><Marca /><h1>Bienvenido de nuevo</h1><p>Encuentra tu lugar y continúa donde lo dejaste.</p></div>
        <form onSubmit={enviar} noValidate>
          <Campo etiqueta="Correo electrónico" error={errores.correo}>
            <input name="correo" type="email" placeholder="tu@correo.com" autoComplete="username" />
          </Campo>
          <CampoClave etiqueta="Contraseña" nombre="clave" error={errores.clave} placeholder="Tu contraseña" autoComplete="current-password" />
          <div className="fila-form">
            <small>Tus datos viajan cifrados con la sesión</small>
            <Link className="btn-link" to="/recuperar">¿Olvidaste tu contraseña?</Link>
          </div>
          <Aviso tipo="error">{errores.form}</Aviso>
          <button className="btn ancho" disabled={enviando}>{enviando ? 'Comprobando…' : 'Iniciar sesión'}</button>
        </form>
        <Link className="btn-link centrado" to="/registro">¿No tienes una cuenta? <b>Crear cuenta</b></Link>
        {demo.length > 0 && (
          <div className="demo">
            <div><b>Cuentas de demostración</b><small>Acceso rápido · tres estudiantes para probar los reportes</small></div>
            {demo.map((d) => (
              <button key={d.correo} type="button" disabled={enviando} onClick={() => entrar(d.correo, d.clave)}>
                <span><b>{d.nombre}{d.rol !== 'estudiante' ? ` · ${d.rol === 'propietario' ? 'Propietario' : 'Administrador'}` : ''}</b>
                  <small>{d.correo}</small><small>Clave de prueba: {d.clave}</small></span>
                <strong>Entrar</strong>
              </button>
            ))}
          </div>
        )}
      </section>
    </Escenario>
  );
}

export function Registro() {
  const { refrescar } = useSesion();
  const nav = useNavigate();
  const [paso, setPaso] = useState('rol');
  const [rol, setRol] = useState(null);
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [unis, setUnis] = useState([]);
  const [demo, setDemo] = useState(true);
  useEffect(() => {
    API.get('/pensiones/universidades').then(setUnis).catch(() => {});
    modoDemo().then(setDemo);
  }, []);
  const doc = textoDocumento(demo);

  async function enviar(e) {
    e.preventDefault();
    if (enviando) return;
    const f = new FormData(e.currentTarget);
    const v = (k) => String(f.get(k) || '').trim();
    const datos = { rol, nombre: v('nombre'), correo: v('correo'), telefono: v('telefono'), clave: String(f.get('clave') || ''),
      confirmar: String(f.get('confirmar') || ''), institucion: v('institucion'), documento: v('documento'),
      relacion: v('relacion'), acepta_datos: !!f.get('politica') };
    const err = {};
    if (datos.nombre.length < 3) err.nombre = 'Escribe tu nombre completo.';
    if (!correoOk(datos.correo)) err.correo = 'Escribe un correo válido.';
    if (!claveOk(datos.clave)) err.clave = 'Usa al menos 8 caracteres, mayúscula, minúscula y número.';
    if (datos.clave !== datos.confirmar) err.confirmar = 'Las contraseñas no coinciden.';
    if ((rol === 'propietario' || datos.telefono) && !celularOk(datos.telefono))
      err.telefono = 'Número celular colombiano: 10 dígitos que comiencen por 3. Se guardará con +57.';
    if (rol === 'propietario' && !documentoValido(datos.documento, demo)) err.documento = doc.error;
    if (rol === 'estudiante' && !datos.institucion) err.institucion = 'Selecciona tu institución.';
    if (!datos.acepta_datos) err.politica = 'Acepta la política de tratamiento de datos personales para continuar.';
    setErrores(err);
    if (Object.keys(err).length) return;
    setEnviando(true);
    try {
      await API.post('/auth/registro', datos);
      await refrescar();
      nav('/');
    } catch (ex) { setErrores({ ...ex.campos, form: ex.message }); }
    finally { setEnviando(false); }
  }

  if (paso === 'rol') {
    return (
      <Escenario titulo="Crear cuenta" volver={() => nav('/')}>
        <section className="relleno">
          <p className="eyebrow">Elige tu experiencia</p>
          <h1 style={{ margin: '8px 0' }}>Tu próxima etapa empieza aquí.</h1>
          <p className="muted">Elige cómo quieres usar UniPensión.</p>
          <div className="progreso" aria-label="Paso 1 de 2: elige tu experiencia">
            <span className="activo">1. Tu experiencia</span><span>2. Tus datos</span>
          </div>
          {[['estudiante', 'edificio', 'Soy estudiante', 'Busco una pensión cerca de mi institución.'],
            ['propietario', 'llave', 'Soy propietario', 'Quiero publicar y administrar mis pensiones y cupos.']].map(([k, ic, t, d]) => (
            <button key={k} type="button" className={`tarjeta-rol ${rol === k ? 'sel' : ''}`} aria-pressed={rol === k} onClick={() => setRol(k)}>
              <span className="ic"><Icono nombre={ic} tam={28} /></span>
              <span><b>{t}</b><small>{d}</small></span>
              <span className="radio">{rol === k && <Icono nombre="check" tam={15} />}</span>
            </button>
          ))}
          <button className="btn ancho" disabled={!rol} onClick={() => { setErrores({}); setPaso('datos'); }}>
            Continuar {rol === 'estudiante' ? 'como estudiante' : rol === 'propietario' ? 'como propietario' : ''}
          </button>
          <Aviso>Los administradores no se registran públicamente ni se asignan desde el perfil.</Aviso>
        </section>
      </Escenario>
    );
  }

  return (
    <Escenario titulo={`Registro de ${rol}`}
               volver={() => { if (window.confirm('¿Volver? Los datos no enviados del formulario se descartarán.')) setPaso('rol'); }}>
      <form className="relleno" onSubmit={enviar} noValidate>
        <p className="eyebrow">Hagamos espacio para ti</p>
        <h1 style={{ margin: '8px 0' }}>Crea tu cuenta.</h1>
        <div className="progreso" aria-label="Paso 2 de 2: tus datos">
          <span className="hecho">1. Tu experiencia</span><span className="activo">2. Tus datos</span>
        </div>
        <div className="titulo-form"><span>01</span><div><h2>Un poco sobre ti</h2><p>Los campos con * son obligatorios.</p></div></div>
        <Campo etiqueta="Nombre completo *" error={errores.nombre}><input name="nombre" autoComplete="name" /></Campo>
        <Campo etiqueta="Correo electrónico *" error={errores.correo}><input name="correo" type="email" autoComplete="email" /></Campo>
        <Campo etiqueta={rol === 'propietario' ? 'Número de WhatsApp *' : 'Número de teléfono (opcional)'} error={errores.telefono}>
          <input name="telefono" type="tel" placeholder="+57 3XX XXX XXXX" autoComplete="tel" />
        </Campo>
        {rol === 'estudiante' ? (
          <Campo etiqueta="Institución educativa *" error={errores.institucion}>
            <select name="institucion" defaultValue="">
              <option value="">Selecciona una institución</option>
              {unis.map((u) => <option key={u.id}>{u.nombre}</option>)}
              <option>Otra institución</option>
            </select>
          </Campo>
        ) : (
          <>
            <Campo etiqueta={doc.etiqueta} error={errores.documento}>
              <input name="documento" placeholder={doc.ayuda} autoComplete="off" />
            </Campo>
            <Campo etiqueta="Relación con la pensión">
              <select name="relacion">
                <option>Propietario</option><option>Persona autorizada para arrendar</option><option>Persona autorizada para subarrendar</option>
              </select>
            </Campo>
          </>
        )}
        <div className="titulo-form"><span>02</span><div><h2>Tu acceso</h2><p>Usa una contraseña que no utilices en otros sitios.</p></div></div>
        <CampoClave etiqueta="Contraseña *" nombre="clave" error={errores.clave} autoComplete="new-password" />
        <Campo etiqueta="Confirmar contraseña *" error={errores.confirmar}><input name="confirmar" type="password" autoComplete="new-password" /></Campo>
        <div className="titulo-form"><span>03</span><div><h2>Privacidad y consentimiento</h2><p>Consulta la política antes de continuar.</p></div></div>
        <PoliticaDatos />
        <label className="check"><input name="politica" type="checkbox" />
          <span>Acepto la política de tratamiento de datos personales (Ley 1581 de 2012, versión {VERSION_POLITICA}).</span></label>
        {errores.politica && <small className="campo-error" role="alert">{errores.politica}</small>}
        <Aviso tipo="error">{errores.form}</Aviso>
        <button className="btn ancho" style={{ marginTop: 18 }} disabled={enviando}>
          {enviando ? 'Creando cuenta…' : `Crear cuenta de ${rol}`}
        </button>
        <button type="button" className="btn-link centrado" onClick={() => nav('/')}>Volver a la bienvenida</button>
      </form>
    </Escenario>
  );
}

export function Recuperar() {
  const nav = useNavigate();
  const [msj, setMsj] = useState(null);
  async function enviar(e) {
    e.preventDefault();
    const correo = String(new FormData(e.currentTarget).get('correo') || '').trim();
    try { const r = await API.post('/auth/recuperar', { correo }); setMsj({ t: 'alerta', m: r.mensaje }); }
    catch (err) { setMsj({ t: 'error', m: err.message }); }
  }
  return (
    <Escenario titulo="Recuperación" volver={() => nav('/ingresar')}>
      <section className="relleno">
        <div className="acceso-cabeza"><Marca /><h1>Recupera tu contraseña</h1>
          <p>Ingresa el correo asociado a tu cuenta y te indicaremos cómo restablecer tu contraseña.</p></div>
        <form onSubmit={enviar}>
          <Campo etiqueta="Correo electrónico"><input name="correo" type="email" required autoComplete="email" /></Campo>
          <button className="btn ancho">Consultar recuperación</button>
        </form>
        {msj ? <Aviso tipo={msj.t}>{msj.m}</Aviso>
             : <Aviso>La recuperación por correo depende del servicio de correo del backend (pendiente de configurar).</Aviso>}
        <button className="btn-link centrado" onClick={() => nav('/ingresar')}>Volver a iniciar sesión</button>
      </section>
    </Escenario>
  );
}
