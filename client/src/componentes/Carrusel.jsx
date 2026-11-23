// =============================================================
// Carrusel de fotos: se desliza con el dedo (scroll-snap nativo, suave en iPhone y Android),
// con flechas y teclado (← →) en escritorio y puntos indicadores.
// Lo usan la galería de la ficha y la vista ampliada.
// =============================================================
import { useEffect, useRef } from 'react';
import Icono from './Icono.jsx';

export default function Carrusel({ fotos, indice, onCambio, textoAlt, onAbrir, clase = '' }) {
  const pista = useRef(null);
  const espera = useRef(null);
  const n = fotos.length;

  // Índice externo (miniaturas, flechas) → desplaza la pista hasta esa foto
  useEffect(() => {
    const el = pista.current;
    if (!el || !el.clientWidth) return;
    const x = indice * el.clientWidth;
    if (Math.abs(el.scrollLeft - x) > 2) el.scrollTo({ left: x, behavior: 'smooth' });
  }, [indice]);

  // Deslizamiento con el dedo → actualiza el índice cuando el movimiento termina
  // (esperar al final evita que un desplazamiento animado se detenga en una foto intermedia)
  function alDesplazar() {
    clearTimeout(espera.current);
    espera.current = setTimeout(() => {
      const el = pista.current;
      if (!el || !el.clientWidth) return;
      const i = Math.max(0, Math.min(n - 1, Math.round(el.scrollLeft / el.clientWidth)));
      if (i !== indice) onCambio(i);
    }, 90);
  }
  useEffect(() => () => clearTimeout(espera.current), []);

  const ir = (i) => onCambio(Math.max(0, Math.min(n - 1, i)));
  function teclas(e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); ir(indice + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); ir(indice - 1); }
  }

  return (
    <div className={`carrusel ${clase}`}>
      <div className="carrusel-pista" ref={pista} onScroll={alDesplazar} onKeyDown={teclas} tabIndex={0}
           role="region" aria-roledescription="carrusel" aria-label={`Fotografías, ${indice + 1} de ${n}. Desliza o usa las flechas.`}>
        {fotos.map((f, i) => (
          <div className="carrusel-diapositiva" key={i} aria-hidden={i !== indice}>
            <img src={f} alt={textoAlt(i)} loading={i === 0 ? 'eager' : 'lazy'} draggable={false}
                 onClick={onAbrir} style={onAbrir ? { cursor: 'zoom-in' } : undefined} />
          </div>
        ))}
      </div>
      {n > 1 && (
        <>
          <button type="button" className="carrusel-flecha anterior" onClick={() => ir(indice - 1)} disabled={indice === 0} aria-label="Foto anterior">
            <Icono nombre="atras" tam={20} />
          </button>
          <button type="button" className="carrusel-flecha siguiente" onClick={() => ir(indice + 1)} disabled={indice === n - 1} aria-label="Foto siguiente">
            <Icono nombre="flecha" tam={20} />
          </button>
          <div className="carrusel-puntos" aria-hidden="true">
            {fotos.map((_, i) => <span key={i} className={i === indice ? 'activo' : ''} />)}
          </div>
        </>
      )}
    </div>
  );
}
