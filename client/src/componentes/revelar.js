// =============================================================
// Efecto «descubrir»: los bloques aparecen al entrar en pantalla mientras se hace scroll.
// - Registra automáticamente los elementos de SELECTOR en todas las páginas (también los que se
//   cargan después, como los resultados del catálogo) y los que tengan el atributo data-revelar.
// - Variantes con data-revelar="izquierda" | "derecha" | "zoom".
// - Los elementos que entran juntos aparecen en cascada (retraso escalonado).
// - Respeta prefers-reduced-motion y, sin IntersectionObserver o sin JavaScript, todo se ve normal:
//   la clase .rv (oculto) solo la pone este módulo.
// Responsable: Desarrollador Frontend
// =============================================================
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SELECTOR = [
  '[data-revelar]', '.tarjeta-pension', '.bloque', '.panel', '.tarjeta-gestion', '.cabeza-seccion',
  '.estadisticas > *', '.pasos-grid > *', '.planes > *', '.barrio', '.item-menu', '.perfil-hero',
  '.perfil-info > *', '.hero-panel', '.form-editor', '.vacio', '.invita', '.tarjeta-inst', '.resena',
].join(',');
// Nunca dentro de diálogos ni del mapa (se verían con retraso o moverían los controles)
const EXCLUIR = 'dialog, .mapa-panel, .leaflet-container';
const PASO_MS = 90;
const MAX_ESCALONES = 6;

function sinMovimiento() {
  return typeof window === 'undefined' || !('IntersectionObserver' in window) ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useRevelarAlScroll() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (sinMovimiento()) return undefined;
    const raiz = document.getElementById('raiz');
    if (!raiz) return undefined;

    const observador = new IntersectionObserver((entradas) => {
      // Los que entran en el mismo cuadro aparecen escalonados, de arriba abajo y de izquierda a derecha
      const visibles = entradas.filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left);
      visibles.forEach((e, i) => {
        e.target.style.setProperty('--rv-retraso', `${Math.min(i, MAX_ESCALONES) * PASO_MS}ms`);
        e.target.classList.add('rv-visible');
        observador.unobserve(e.target);
        // Al terminar se quitan las clases: el elemento recupera sus propias transiciones (hover) y
        // no queda un transform que afecte posicionamientos sticky o fixed internos.
        const el = e.target;
        const fin = (ev) => {
          if (ev.target !== el || ev.propertyName !== 'transform') return; // ignora transiciones de los hijos
          el.removeEventListener('transitionend', fin);
          el.classList.remove('rv', 'rv-visible');
          el.style.removeProperty('--rv-retraso');
        };
        el.addEventListener('transitionend', fin);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });

    const registrar = (nodo) => {
      if (nodo.nodeType !== 1) return;
      const candidatos = nodo.matches(SELECTOR) ? [nodo, ...nodo.querySelectorAll(SELECTOR)] : nodo.querySelectorAll(SELECTOR);
      for (const el of candidatos) {
        if (el.dataset.rvListo || el.closest(EXCLUIR)) continue;
        el.dataset.rvListo = '1';
        el.classList.add('rv');
        observador.observe(el);
      }
    };

    registrar(raiz);
    const mutaciones = new MutationObserver((lista) => lista.forEach((m) => m.addedNodes.forEach(registrar)));
    mutaciones.observe(raiz, { childList: true, subtree: true });
    return () => { observador.disconnect(); mutaciones.disconnect(); };
  }, [pathname]);
}

// Barra de la cabecera: agrega una sombra cuando la página ya se desplazó
export function useCabeceraConScroll(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const actualizar = () => el.classList.toggle('con-scroll', window.scrollY > 8);
    actualizar();
    window.addEventListener('scroll', actualizar, { passive: true });
    return () => window.removeEventListener('scroll', actualizar);
  }, [ref]);
}
