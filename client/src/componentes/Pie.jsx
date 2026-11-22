// Pie de página — rediseño v0.5: identidad, enlaces de exploración y nota del proyecto académico
import { Link } from 'react-router-dom';
import { Marca } from './ui.jsx';

export default function Pie() {
  return (
    <footer className="pie">
      <div className="pie-in">
        <div>
          <div className="pie-id"><Marca compacta /><b>UniPensión</b><span>Pensiones universitarias verificadas, cerca de tu campus en Sincelejo, Sucre.</span></div>
        </div>
        <nav aria-label="Explorar">
          <h3>Explorar</h3>
          <ul className="pie-enlaces">
            <li><Link to="/buscar">Catálogo de pensiones</Link></li>
            <li><Link to="/buscar?orden=calificacion">Mejor valoradas</Link></li>
            <li><Link to="/buscar?vista=mapa">Ver en el mapa</Link></li>
          </ul>
        </nav>
        <nav aria-label="Para propietarios">
          <h3>Propietarios</h3>
          <ul className="pie-enlaces">
            <li><Link to="/registro">Publicar una pensión</Link></li>
            <li><a href="mailto:contacto@unipension.co">contacto@unipension.co</a></li>
          </ul>
        </nav>
        <div className="pie-legal">
          <p>Proyecto académico · Ingeniería de Software, CECAR · Edwin Díaz, José Paternina, Jesús Villalba</p>
          <details>
            <summary>Acerca de la plataforma</summary>
            <div>
              <h3>Un proyecto académico en fase de prototipo</h3>
              <p>UniPensión Sincelejo centraliza y verifica la oferta de pensiones universitarias de la ciudad. Los datos
                 de demostración (pensiones, perfiles, reseñas y coordenadas) son ficticios; las fotografías son de Unsplash.</p>
              <p>La verificación del administrador revisa la información y las fotografías publicadas; no certifica la
                 identidad ni la propiedad legal del inmueble.</p>
              <p>La pasarela de pagos está simulada y los correos se registran como notificaciones dentro de la plataforma.
                 El contacto por WhatsApp abre el chat del arrendador solo si autorizó su número.</p>
            </div>
          </details>
        </div>
      </div>
    </footer>
  );
}
