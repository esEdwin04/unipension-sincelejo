// =============================================================
// Componentes de interfaz reutilizables (marca, campos, avisos, diálogos…)
// Responsable: Desarrollador Frontend
// =============================================================
import { useEffect, useRef } from 'react';
import Icono from './Icono.jsx';

// Logotipo: casa con ventanas + palabra UniPensión en la tipografía de la identidad
export function Marca({ compacta = false }) {
  return (
    <span className={`marca ${compacta ? 'compacta' : ''}`}>
      <svg viewBox="0 0 80 70" role="img" aria-label="UniPensión">
        <path d="M10 31 40 7l30 24" fill="none" stroke="#173B35" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18 34v9a22 22 0 0 0 44 0v-9" fill="none" stroke="#173B35" strokeWidth="10" strokeLinecap="round" />
        <g fill="#35B89A">
          <rect x="32" y="30" width="7" height="7" rx="1" /><rect x="42" y="30" width="7" height="7" rx="1" />
          <rect x="32" y="40" width="7" height="7" rx="1" /><rect x="42" y="40" width="7" height="7" rx="1" />
        </g>
      </svg>
      {!compacta && (<><strong>Uni<em>Pensión</em></strong><small>SINCELEJO · TU LUGAR CERCA DEL CAMPUS</small></>)}
    </span>
  );
}

export const Splash = () => (
  <div className="splash" aria-label="UniPensión, cargando">
    <div><Marca /><span className="splash-punto" /></div>
  </div>
);

export function Campo({ etiqueta, error, children }) {
  return (
    <label className={`campo ${error ? 'con-error' : ''}`}>
      <span>{etiqueta}</span>
      {children}
      {error && <small className="campo-error" role="alert">{error}</small>}
    </label>
  );
}

// Mensajes de estado. Solo texto: nunca se inyecta HTML (evita XSS con datos de usuarios)
export function Aviso({ tipo = '', children, role }) {
  if (!children) return null;
  return <div className={`aviso ${tipo}`} role={role || (tipo === 'error' ? 'alert' : undefined)}>{children}</div>;
}

export function Cargando({ texto = 'Cargando…' }) {
  return <div className="cargando" role="status"><span className="giro" />{texto}</div>;
}

export function Vacio({ icono = 'buscar', titulo, texto, accion }) {
  return (
    <div className="vacio">
      <Icono nombre={icono} tam={34} />
      <h2>{titulo}</h2>
      {texto && <p>{texto}</p>}
      {accion}
    </div>
  );
}

// Diálogo modal nativo (<dialog>): accesible con teclado y tecla Esc
export function Dialogo({ titulo, cerrar, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog className="dialogo" ref={ref} aria-label={titulo} onCancel={(e) => { e.preventDefault(); cerrar(); }}>
      <header>
        <h2>{titulo}</h2>
        <button type="button" className="btn-icono" onClick={cerrar} aria-label="Cerrar"><Icono nombre="cerrar" /></button>
      </header>
      <div className="dialogo-cuerpo">{children}</div>
    </dialog>
  );
}

export function Avatar({ usuario, grande = false, onClick }) {
  const iniciales = String(usuario?.nombre || '?').split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  const contenido = usuario?.foto ? <img src={usuario.foto} alt={`Foto de ${usuario.nombre}`} /> : iniciales;
  if (onClick) return <button className={`avatar ${grande ? 'grande' : ''}`} onClick={onClick} aria-label="Abrir mi perfil">{contenido}</button>;
  return <span className={`avatar ${grande ? 'grande' : ''}`}>{contenido}</span>;
}

export function ItemMenu({ icono, titulo, detalle, onClick }) {
  const interior = (
    <>
      <span className="ic"><Icono nombre={icono} tam={20} /></span>
      <span><b>{titulo}</b>{detalle && <small>{detalle}</small>}</span>
      {onClick ? <span aria-hidden="true">›</span> : <span />}
    </>
  );
  return onClick
    ? <button type="button" className="item-menu" onClick={onClick}>{interior}</button>
    : <div className="item-menu">{interior}</div>;
}

export function Chip({ clase = '', children, sinPunto = false }) {
  return <span className={`chip ${clase} ${sinPunto ? 'sin-punto' : ''}`}>{children}</span>;
}

// Política de tratamiento de datos (RNF-07, Ley 1581 de 2012)
export const VERSION_POLITICA = '2026-01-prototipo';
export function PoliticaDatos() {
  return (
    <details className="politica">
      <summary>Consultar política de tratamiento de datos personales</summary>
      <div>
        <h3>Política de tratamiento de datos — UniPensión Sincelejo</h3>
        <p>Versión {VERSION_POLITICA}. Proyecto académico de Ingeniería de Software, CECAR.</p>
        <p>Finalidad: permitir el registro, la búsqueda, la publicación, la reserva y la moderación de pensiones
           estudiantiles en Sincelejo. Se almacenan datos de perfil, publicaciones, reservas, reportes y aperturas
           de contacto en la base de datos de la plataforma.</p>
        <p>El documento del propietario es privado: no aparece en los anuncios ni en los enlaces de contacto.
           Mientras la plataforma esté en modo demostración, usa únicamente datos ficticios.</p>
        <p>Tu autorización registra usuario, fecha, hora y versión de la política. Puedes consultar y editar tus datos
           en Perfil. El administrador ve los reportes para moderarlos; la información no se vende ni se cede.</p>
        <p>Antes de recopilar datos reales deben definirse el responsable del tratamiento y el canal para ejercer los
           derechos de conocer, actualizar, rectificar y suprimir los datos (Ley 1581 de 2012).</p>
      </div>
    </details>
  );
}

// Planes de publicación del prototipo (el Destacado se activa manualmente desde administración, sin cobro)
export function Planes() {
  return (
    <section className="planes">
      <div>
        <p className="eyebrow">Plan básico</p>
        <h3>Gratuito</h3>
        <p>Hasta cinco fotos, filtros, contacto por WhatsApp, reservas en línea y gestión de cupos.</p>
      </div>
      <div>
        <p className="eyebrow">Plan destacado</p>
        <h3>$30.000 <small>COP / mes por anuncio</small></h3>
        <p>Prioridad en el catálogo e insignia. Activación manual desde administración; el cobro no está implementado.</p>
      </div>
    </section>
  );
}

export function TituloPagina({ titulo, subtitulo, volver }) {
  return (
    <>
      {volver && <button className="volver" onClick={volver}><Icono nombre="atras" tam={18} />Volver</button>}
      <header className="titulo-pagina"><h1>{titulo}</h1>{subtitulo && <p>{subtitulo}</p>}</header>
    </>
  );
}
