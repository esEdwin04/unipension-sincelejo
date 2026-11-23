// Pie de página: identidad y enlaces de exploración
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
      </div>
    </footer>
  );
}
