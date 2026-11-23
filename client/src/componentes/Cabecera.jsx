// Responsable: Edwin Diaz
// Cabecera de la aplicación (marca + cuenta) y navegación principal por rol
import { useRef } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useCabeceraConScroll } from './revelar.js';
import { useSesion } from '../App.jsx';
import { Marca, Avatar } from './ui.jsx';
import Icono from './Icono.jsx';

const ROL = { estudiante: 'Estudiante', propietario: 'Propietario', administrador: 'Administrador' };

export default function Cabecera() {
  const { usuario, irA } = useSesion();
  const ref = useRef(null);
  useCabeceraConScroll(ref); // sombra al desplazarse
  return (
    <header className="app-cabecera" ref={ref}>
      <div className="app-cabecera-in">
        <button className="marca-app" onClick={() => irA('/')} aria-label="UniPensión, volver al inicio">
          <Marca compacta />
          <span><b>Uni<em>Pensión</em></b><small>Pensiones estudiantiles · Sincelejo</small></span>
        </button>
        {usuario ? (
          <div className="cuenta">
            <span><b>{usuario.nombre}</b><small>{ROL[usuario.rol]}</small></span>
            <Avatar usuario={usuario} onClick={() => irA('/perfil')} />
          </div>
        ) : (
          <div className="cuenta"><Link className="btn chico" to="/ingresar">Iniciar sesión</Link></div>
        )}
      </div>
    </header>
  );
}

export function NavPrincipal({ items }) {
  const { irA } = useSesion();
  return (
    <nav className="nav-principal" aria-label="Navegación principal">
      {items.map(([ruta, icono, texto]) => (
        <NavLink key={ruta} to={ruta} end={ruta === '/'} className={({ isActive }) => (isActive ? 'activo' : '')}
                 onClick={(e) => { e.preventDefault(); irA(ruta); }}>
          <span className="ic"><Icono nombre={icono} tam={20} /></span>{texto}
        </NavLink>
      ))}
    </nav>
  );
}
