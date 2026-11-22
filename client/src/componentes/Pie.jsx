// Pie de página con identidad y "Acerca de la plataforma" (estructura del prototipo inicial)
import { Marca } from './ui.jsx';

export default function Pie() {
  return (
    <footer className="pie">
      <div className="pie-in">
        <div className="pie-id"><Marca compacta /><b>UniPensión</b><span>Tu lugar cerca del campus.</span></div>
        <p>Proyecto académico · Ingeniería de Software, CECAR · Edwin Díaz, José Paternina, Jesús Villalba</p>
        <details>
          <summary>Acerca de la plataforma</summary>
          <div>
            <h3>Un proyecto académico en fase de prototipo</h3>
            <p>UniPensión Sincelejo centraliza y verifica la oferta de pensiones universitarias de la ciudad. Los datos
               de demostración (pensiones, perfiles y coordenadas) son ficticios.</p>
            <p>La verificación del administrador revisa la información y las fotografías publicadas; no certifica la
               identidad ni la propiedad legal del inmueble.</p>
            <p>La pasarela de pagos está simulada y los correos se registran como notificaciones dentro de la plataforma.
               El contacto por WhatsApp abre un enlace externo solo si el propietario autorizó su número.</p>
            <p>Contacto: <a href="mailto:contacto@unipension.co">contacto@unipension.co</a> · Sincelejo, Sucre — Colombia.</p>
          </div>
        </details>
      </div>
    </footer>
  );
}
