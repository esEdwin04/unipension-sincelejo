// Pie de página con columnas, al estilo del sitio de referencia
export default function Pie() {
  return (
    <footer className="pie">
      <div className="pie-inner">
        <div>
          <span className="marca">Uni<em>Pensión</em> Sincelejo</span>
          <p style={{fontSize:'.92rem',maxWidth:280}}>
            Hospedaje estudiantil verificado, cerca de tu campus. Compara, reserva y paga con confianza.
          </p>
        </div>
        <div>
          <h5>Menú</h5>
          <a href="/#pensiones">Pensiones</a>
          <a href="/#servicios">Servicios</a>
          <a href="/#preguntas">Preguntas frecuentes</a>
          <a href="/acceso">Ingresar</a>
        </div>
        <div>
          <h5>Legal</h5>
          <a href="/#preguntas">Tratamiento de datos (Ley 1581 de 2012)</a>
          <a href="/#preguntas">Términos del servicio</a>
        </div>
        <div>
          <h5>Contacto</h5>
          <a href="mailto:contacto@unipension.co">contacto@unipension.co</a>
          <a href="tel:+573000000000">+57 300 000 0000</a>
          <p style={{fontSize:'.92rem',marginTop:8}}>Sincelejo, Sucre — Colombia</p>
        </div>
      </div>
      <div className="pie-legal">
        © {new Date().getFullYear()} UniPensión Sincelejo · Proyecto académico — Ingeniería de Software, CECAR ·
        Edwin Díaz, José Paternina, Jesús Villalba
      </div>
    </footer>
  );
}
