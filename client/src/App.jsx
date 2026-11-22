// =============================================================
// Aplicación UniPensión — sesión, navegación por rol y rutas
// Estructura tomada del prototipo inicial:
//   sin sesión → Bienvenida / Ingresar / Crear cuenta / Recuperación
//   con sesión → cabecera + navegación por rol (pestañas en escritorio, barra inferior en móvil)
// =============================================================
import { useCallback, useEffect, useRef, useState, createContext, useContext } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { API } from './api.js';
import { Splash } from './componentes/ui.jsx';
import Cabecera, { NavPrincipal } from './componentes/Cabecera.jsx';
import Pie from './componentes/Pie.jsx';
import Icono from './componentes/Icono.jsx';
import { useRevelarAlScroll } from './componentes/revelar.js';
import { Bienvenida, Ingresar, Registro, Recuperar } from './paginas/Acceso.jsx';
import InicioEstudiante from './paginas/InicioEstudiante.jsx';
import Favoritos from './paginas/Favoritos.jsx';
import Catalogo from './paginas/Catalogo.jsx';
import Detalle from './paginas/Detalle.jsx';
import MisReservas from './paginas/MisReservas.jsx';
import Perfil from './paginas/Perfil.jsx';
import InicioPropietario from './paginas/propietario/InicioPropietario.jsx';
import MisPensiones from './paginas/propietario/MisPensiones.jsx';
import EditorPension from './paginas/propietario/EditorPension.jsx';
import Solicitudes from './paginas/propietario/Solicitudes.jsx';
import Resumen from './paginas/admin/Resumen.jsx';
import Publicaciones from './paginas/admin/Publicaciones.jsx';
import Reportes from './paginas/admin/Reportes.jsx';
import Auditoria from './paginas/admin/Auditoria.jsx';

// Contexto de sesión: usuario autenticado, refresco, avisos y protección de borradores
const CtxSesion = createContext(null);
export const useSesion = () => useContext(CtxSesion);

const NAV = {
  invitado: [['/', 'inicio', 'Inicio'], ['/buscar', 'buscar', 'Buscar'], ['/ingresar', 'usuario', 'Ingresar']],
  estudiante: [['/', 'inicio', 'Inicio'], ['/buscar', 'buscar', 'Buscar'], ['/favoritos', 'corazon', 'Favoritos'], ['/mis-reservas', 'calendario', 'Reservas'], ['/perfil', 'usuario', 'Perfil']],
  propietario: [['/', 'inicio', 'Inicio'], ['/mis-pensiones', 'edificio', 'Mis pensiones'], ['/solicitudes', 'solicitudes', 'Solicitudes'], ['/perfil', 'usuario', 'Perfil']],
  administrador: [['/', 'inicio', 'Resumen'], ['/admin/publicaciones', 'lista', 'Publicaciones'], ['/admin/reportes', 'escudo', 'Reportes'], ['/admin/auditoria', 'grafica', 'Auditoría'], ['/perfil', 'usuario', 'Perfil']],
};

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [splash, setSplash] = useState(true);
  const [toast, setToast] = useState('');
  const protegida = useRef(null); // mensaje de confirmación si hay un borrador sin enviar
  const [favoritos, setFavoritos] = useState(() => new Set()); // id de las pensiones guardadas por el estudiante
  const { pathname } = useLocation();
  const nav = useNavigate();

  const refrescar = useCallback(async () => {
    try { const d = await API.get('/auth/yo'); setUsuario(d.usuario); return d.usuario; }
    catch { setUsuario(null); return null; }
    finally { setCargando(false); }
  }, []);

  useEffect(() => {
    refrescar();
    const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => setSplash(false), reducir ? 250 : 1100);
    return () => clearTimeout(t);
  }, [refrescar]);
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  useRevelarAlScroll(); // efecto «descubrir»: los bloques aparecen al hacer scroll
  // Favoritos del estudiante: se cargan al iniciar sesión y se comparten con todas las tarjetas
  useEffect(() => {
    if (usuario?.rol !== 'estudiante') { setFavoritos(new Set()); return; }
    API.get('/favoritos/ids').then((ids) => setFavoritos(new Set(ids))).catch(() => {});
  }, [usuario?.id, usuario?.rol]);
  // Guarda o quita una pensión con actualización optimista (si el servidor falla, se revierte)
  const alternarFavorito = useCallback(async (pension) => {
    const guardado = favoritos.has(pension.id);
    const cambiar = (agregar) => setFavoritos((f) => { const n = new Set(f); agregar ? n.add(pension.id) : n.delete(pension.id); return n; });
    cambiar(!guardado);
    try {
      const r = guardado ? await API.del(`/favoritos/${pension.id}`) : await API.put(`/favoritos/${pension.id}`);
      setToast(r.mensaje);
    } catch (e) { cambiar(guardado); setToast(e.message); }
  }, [favoritos]);
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(''), 6500); return () => clearTimeout(t); }, [toast]);

  const proteger = useCallback((msg) => { protegida.current = msg; }, []);
  const salir = async () => {
    await API.post('/auth/logout').catch(() => {});
    setUsuario(null); setToast(''); nav('/');
  };
  // Navegación que respeta un borrador sin enviar (editor de pensiones)
  const irA = (ruta) => {
    if (protegida.current && !window.confirm(protegida.current)) return false;
    protegida.current = null;
    nav(ruta);
    return true;
  };

  if (cargando || splash) return <Splash />;

  const ctx = { usuario, refrescar, salir, avisar: setToast, irA, proteger, favoritos, alternarFavorito };
  const rol = usuario?.rol || 'invitado';
  const enDetalle = pathname.startsWith('/pension/');

  // Sin sesión: pantallas de acceso a pantalla completa (excepto catálogo y ficha públicos)
  if (!usuario && ['/', '/ingresar', '/registro', '/recuperar'].includes(pathname)) {
    return (
      <CtxSesion.Provider value={ctx}>
        <Routes>
          <Route path="/" element={<Bienvenida />} />
          <Route path="/ingresar" element={<Ingresar />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/recuperar" element={<Recuperar />} />
        </Routes>
      </CtxSesion.Provider>
    );
  }

  const soloRol = (r, el) => (usuario?.rol === r ? el : <Navigate to={usuario ? '/' : '/ingresar'} replace />);
  const conSesion = (el) => (usuario ? el : <Navigate to="/ingresar" replace />);

  return (
    <CtxSesion.Provider value={ctx}>
      <div className="app">
        {/* Enlace para saltar la navegación con el teclado (WCAG 2.4.1) */}
        <a href="#contenido" className="saltar" onClick={(e) => {
          e.preventDefault();
          const principal = document.querySelector('main');
          if (principal) { principal.setAttribute('tabindex', '-1'); principal.focus(); }
        }}>Saltar al contenido</a>
        {!enDetalle && <Cabecera />}
        {!enDetalle && <NavPrincipal items={NAV[rol]} />}
        {toast && (
          <div className="toast" role="status"><Icono nombre="check" tam={18} />{toast}
            <button onClick={() => setToast('')} aria-label="Cerrar aviso">×</button></div>
        )}
        <Routes>
          <Route path="/" element={
            rol === 'propietario' ? <InicioPropietario /> : rol === 'administrador' ? <Resumen /> : <InicioEstudiante />} />
          <Route path="/buscar" element={rol === 'invitado' || rol === 'estudiante' ? <Catalogo /> : <Navigate to="/" replace />} />
          <Route path="/pension/:id" element={<Detalle />} />
          <Route path="/mis-reservas" element={soloRol('estudiante', <MisReservas />)} />
          <Route path="/favoritos" element={soloRol('estudiante', <Favoritos />)} />
          <Route path="/perfil/*" element={conSesion(<Perfil />)} />
          <Route path="/mis-pensiones" element={soloRol('propietario', <MisPensiones />)} />
          <Route path="/mis-pensiones/nueva" element={soloRol('propietario', <EditorPension />)} />
          <Route path="/mis-pensiones/:id/editar" element={soloRol('propietario', <EditorPension />)} />
          <Route path="/solicitudes" element={soloRol('propietario', <Solicitudes />)} />
          <Route path="/propietario" element={<Navigate to="/mis-pensiones" replace />} />
          <Route path="/admin" element={<Navigate to="/" replace />} />
          <Route path="/admin/publicaciones" element={soloRol('administrador', <Publicaciones />)} />
          <Route path="/admin/reportes" element={soloRol('administrador', <Reportes />)} />
          <Route path="/admin/auditoria" element={soloRol('administrador', <Auditoria />)} />
          <Route path="/acceso" element={<Navigate to={usuario ? '/' : '/ingresar'} replace />} />
          <Route path="/ingresar" element={<Navigate to="/" replace />} />
          <Route path="/registro" element={<Navigate to="/" replace />} />
          <Route path="*" element={<main className="contenido"><h1>Página no encontrada</h1>
            <p className="muted" style={{ margin: '10px 0 20px' }}>La dirección no existe o no tienes acceso a ella.</p>
            <button className="btn" onClick={() => nav('/')}>Volver al inicio</button></main>} />
        </Routes>
        {!enDetalle && <Pie />}
      </div>
    </CtxSesion.Provider>
  );
}
