import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { API } from '../api.js';
import { useSesion } from '../App.jsx';

// Cabecera fija: transparente sobre el hero, sólida al hacer scroll (estilo boutique)
export default function Cabecera({ transparente }) {
  const { usuario, refrescar } = useSesion();
  const [solida, setSolida] = useState(!transparente);
  const [abierto, setAbierto] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    if (!transparente) { setSolida(true); return; }
    const alScroll = () => setSolida(window.scrollY > 60);
    alScroll();
    window.addEventListener('scroll', alScroll);
    return () => window.removeEventListener('scroll', alScroll);
  }, [transparente]);

  const salir = async () => { await API.post('/auth/logout'); await refrescar(); nav('/'); };
  const cerrar = () => setAbierto(false);

  return (
    <header className={`cabecera ${transparente ? (solida ? 'solida' : '') : 'interior'}`}>
      <Link to="/" className="marca" onClick={cerrar}>Uni<em>Pensión</em> Sincelejo</Link>
      <button className="hamburguesa" aria-label="Abrir menú" onClick={() => setAbierto(!abierto)}>☰</button>
      <nav className={`menu ${abierto ? 'abierto' : ''}`}>
        <NavLink to="/" onClick={cerrar} className={({isActive}) => isActive ? 'activo' : ''}>Inicio</NavLink>
        <a href="/#pensiones" onClick={cerrar}>Pensiones</a>
        <a href="/#servicios" onClick={cerrar}>Servicios</a>
        <a href="/#preguntas" onClick={cerrar}>Preguntas</a>
        {usuario?.rol === 'estudiante' && <NavLink to="/mis-reservas" onClick={cerrar}>Mis reservas</NavLink>}
        {usuario?.rol === 'propietario' && <NavLink to="/propietario" onClick={cerrar}>Mis pensiones</NavLink>}
        {usuario?.rol === 'administrador' && <NavLink to="/admin" onClick={cerrar}>Panel</NavLink>}
        {usuario ? (
          <>
            <span className="chip-usuario">{usuario.nombre.split(' ')[0]}</span>
            <button className="boton chico secundario" onClick={salir} style={{borderColor:'currentColor',color:'inherit',background:'transparent'}}>Salir</button>
          </>
        ) : (
          <Link to="/acceso" onClick={cerrar} className="boton chico claro"
                style={!solida && transparente ? {} : {borderColor:'var(--oliva)',color:'var(--oliva)'}}>
            Ingresar
          </Link>
        )}
      </nav>
    </header>
  );
}
