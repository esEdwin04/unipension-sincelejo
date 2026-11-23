// Rsponsable: Edwin Diaz
// Botón «Agregar a favoritos» (corazón). Estudiante: guarda o quita la pensión.
// Visitante sin cuenta: lleva a iniciar sesión. Propietario y administrador: no se muestra.
import { useNavigate } from 'react-router-dom';
import { useSesion } from '../App.jsx';
import Icono from './Icono.jsx';

export default function BotonFavorito({ pension, conTexto = false }) {
  const { usuario, favoritos, alternarFavorito, avisar } = useSesion();
  const nav = useNavigate();
  if (usuario && usuario.rol !== 'estudiante') return null;
  const activo = favoritos.has(pension.id);
  const etiqueta = activo ? `Quitar «${pension.nombre}» de favoritos` : `Agregar «${pension.nombre}» a favoritos`;

  function pulsar(e) {
    e.preventDefault();
    e.stopPropagation(); // la tarjeta completa es un enlace: el corazón no debe abrir la ficha
    if (!usuario) { avisar('Inicia sesión como estudiante para guardar pensiones en favoritos.'); nav('/ingresar'); return; }
    alternarFavorito(pension);
  }

  return (
    <button type="button" className={`fav ${activo ? 'activo' : ''} ${conTexto ? 'con-texto' : ''}`}
            aria-pressed={activo} aria-label={conTexto ? undefined : etiqueta} title={etiqueta} onClick={pulsar}>
      <Icono nombre="corazon" tam={conTexto ? 20 : 19} />
      {conTexto && <span>{activo ? 'Guardada en favoritos' : 'Agregar a favoritos'}</span>}
    </button>
  );
}
