import { useEffect, useState, createContext, useContext } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { API } from './api.js';
import Cabecera from './componentes/Cabecera.jsx';
import Pie from './componentes/Pie.jsx';
import Inicio from './paginas/Inicio.jsx';
import Detalle from './paginas/Detalle.jsx';
import Acceso from './paginas/Acceso.jsx';
import Propietario from './paginas/Propietario.jsx';
import MisReservas from './paginas/MisReservas.jsx';
import Admin from './paginas/Admin.jsx';

// Contexto de sesión: expone el usuario autenticado a toda la aplicación
const CtxSesion = createContext(null);
export const useSesion = () => useContext(CtxSesion);

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const { pathname } = useLocation();

  const refrescar = () => API.get('/auth/yo').then((d) => setUsuario(d.usuario)).finally(() => setCargando(false));
  useEffect(() => { refrescar(); }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  if (cargando) return null;
  return (
    <CtxSesion.Provider value={{ usuario, refrescar }}>
      <Cabecera transparente={pathname === '/'} />
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/pension/:id" element={<Detalle />} />
        <Route path="/acceso" element={<Acceso />} />
        <Route path="/propietario" element={<Propietario />} />
        <Route path="/mis-reservas" element={<MisReservas />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
      <Pie />
    </CtxSesion.Provider>
  );
}
