// ------------------------------------------------------------------------------
// Responsable: Edwin Diaz
// Mapa de pensiones (Leaflet + OpenStreetMap, sin clave de API)
// - Pines con precio y agrupación de pensiones cercanas
// - Ubicación autorizada del estudiante (azul) y referencia manual (amarillo)
// - onSeleccionar: permite elegir un punto tocando el mapa (catálogo y editor)
// Se carga de forma diferida (React.lazy) para no aumentar la carga inicial.
// -------------------------------------------------------------------------------
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cop } from '../api.js';

export const SINCELEJO = { lat: 9.3047, lng: -75.3978 };
const valida = (p) => p && Number.isFinite(+p.lat) && Number.isFinite(+p.lng);

export default function MapaPensiones({
  pensiones = [], ubicacion = null, seleccion = null, onSeleccionar, onAbrir,
  centrarUbicacion = 0, centrarCiudad = 0, bajo = false, nota = true,
}) {
  const nodo = useRef(null);
  const mapa = useRef(null);
  const capaPines = useRef(null);
  const capaPuntos = useRef(null);
  const cb = useRef({ onSeleccionar, onAbrir });
  cb.current = { onSeleccionar, onAbrir };
  const [errorTeselas, setErrorTeselas] = useState('');

  // Creación del mapa (una sola vez)
  useEffect(() => {
    const m = L.map(nodo.current, { scrollWheelZoom: false, zoomControl: false })
      .setView([SINCELEJO.lat, SINCELEJO.lng], 13);
    L.control.zoom({ position: 'bottomright' }).addTo(m);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m).on('tileerror', () => setErrorTeselas('No se pudo cargar parte del mapa. Comprueba la conexión; el catálogo sigue disponible.'));
    capaPines.current = L.layerGroup().addTo(m);
    capaPuntos.current = L.layerGroup().addTo(m);
    m.on('click', (e) => cb.current.onSeleccionar?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
    const obs = new ResizeObserver(() => m.invalidateSize({ animate: false }));
    obs.observe(nodo.current);
    mapa.current = m;
    return () => { obs.disconnect(); m.remove(); mapa.current = null; };
  }, []);

  // Pines de pensiones con agrupación por cercanía en pantalla
  useEffect(() => {
    const m = mapa.current, capa = capaPines.current;
    if (!m || !capa) return undefined;
    const conCoord = pensiones.filter(valida);
    if (conCoord.length > 1 && !ubicacion && !seleccion)
      m.fitBounds(L.latLngBounds(conCoord.map((p) => [p.lat, p.lng])), { padding: [50, 50], maxZoom: 16, animate: false });
    else if (conCoord.length === 1 && !onSeleccionar) m.setView([conCoord[0].lat, conCoord[0].lng], 15, { animate: false });

    const dibujar = () => {
      capa.clearLayers();
      const grupos = [];
      for (const p of conCoord) {
        const pt = m.latLngToLayerPoint([p.lat, p.lng]);
        const g = grupos.find((x) => pt.distanceTo(m.latLngToLayerPoint([x[0].lat, x[0].lng])) < 80);
        g ? g.push(p) : grupos.push([p]);
      }
      for (const g of grupos) {
        if (g.length > 1) {
          const centro = L.latLngBounds(g.map((p) => [p.lat, p.lng])).getCenter();
          const lista = document.createElement('div');
          lista.className = 'popup-lista';
          const t = document.createElement('b');
          t.textContent = `${g.length} pensiones en esta zona`;
          lista.append(t);
          for (const p of g) {
            const b = document.createElement('button');
            b.type = 'button';
            const img = document.createElement('img'); img.src = p.foto || '/img/placeholder1.svg'; img.alt = '';
            const s = document.createElement('span');
            const n = document.createElement('b'); n.textContent = p.nombre;
            const d = document.createElement('small'); d.textContent = `${cop(p.tarifa_mensual)} / mes`;
            s.append(n, d); b.append(img, s);
            b.onclick = () => cb.current.onAbrir?.(p.id);
            lista.append(b);
          }
          L.marker(centro, { icon: L.divIcon({ className: '', html: `<span class="pin-cluster">${g.length}</span>`, iconSize: [44, 44] }),
                             title: `${g.length} pensiones agrupadas` })
            .bindPopup(lista).addTo(capa);
          continue;
        }
        const p = g[0];
        const pop = document.createElement('div');
        pop.className = 'popup-pension';
        const img = document.createElement('img'); img.src = p.foto || '/img/placeholder1.svg'; img.alt = p.nombre;
        const n = document.createElement('b'); n.textContent = p.nombre;
        const d = document.createElement('small');
        d.textContent = `${cop(p.tarifa_mensual)}/mes${p.cupos != null ? ` · ${p.cupos} cupo${p.cupos === 1 ? '' : 's'}` : ''}`;
        pop.append(img, n, d);
        if (cb.current.onAbrir) {
          const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Ver pensión';
          b.onclick = () => cb.current.onAbrir?.(p.id);
          pop.append(b);
        }
        L.marker([p.lat, p.lng], { icon: L.divIcon({ className: '', html: `<span class="pin-precio">${cop(p.tarifa_mensual)}</span>`, iconSize: [0, 0] }),
                                   title: p.nombre })
          .bindPopup(pop).addTo(capa);
      }
    };
    dibujar();
    m.on('zoomend', dibujar);
    return () => { m.off('zoomend', dibujar); };
  }, [pensiones]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ubicación del estudiante y referencia manual
  useEffect(() => {
    const capa = capaPuntos.current;
    if (!capa) return;
    capa.clearLayers();
    if (valida(ubicacion)) {
      L.circleMarker([ubicacion.lat, ubicacion.lng], { radius: 9, color: '#fff', fillColor: '#246cdc', fillOpacity: 1, weight: 3 })
        .bindTooltip('Tu ubicación autorizada').addTo(capa);
      if (ubicacion.precision > 0)
        L.circle([ubicacion.lat, ubicacion.lng], { radius: ubicacion.precision, color: '#246cdc', fillOpacity: 0.08, weight: 1 }).addTo(capa);
      mapa.current?.setView([ubicacion.lat, ubicacion.lng], 15, { animate: false });
    }
    if (valida(seleccion)) {
      L.circleMarker([seleccion.lat, seleccion.lng], { radius: 9, color: '#9b6c10', fillColor: '#ffc857', fillOpacity: 1 })
        .bindTooltip(onSeleccionar ? 'Punto seleccionado' : 'Ubicación de la pensión').addTo(capa);
      if (!ubicacion) mapa.current?.setView([seleccion.lat, seleccion.lng], Math.max(mapa.current.getZoom(), 15), { animate: false });
    }
  }, [ubicacion, seleccion]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (centrarUbicacion && valida(ubicacion)) mapa.current?.setView([ubicacion.lat, ubicacion.lng], 15); }, [centrarUbicacion]); // eslint-disable-line
  useEffect(() => { if (centrarCiudad) mapa.current?.setView([SINCELEJO.lat, SINCELEJO.lng], 13); }, [centrarCiudad]);

  return (
    <section className="mapa-panel" aria-label="Mapa OpenStreetMap de pensiones">
      <div ref={nodo} className={`mapa-osm ${bajo ? 'bajo' : ''}`} />
      <div className="mapa-leyenda">
        {pensiones.length > 0 && <span><i className="l-pension" />Pensiones</span>}
        {ubicacion && <span><i className="l-usuario" />Tu ubicación autorizada</span>}
        {(seleccion || onSeleccionar) && <span><i className="l-ref" />{onSeleccionar ? 'Referencia manual' : 'Ubicación'}</span>}
      </div>
      {nota && onSeleccionar && <p className="mapa-nota">Toca el mapa para elegir un punto de referencia.</p>}
      {errorTeselas && <p className="campo-error" role="status">{errorTeselas}</p>}
    </section>
  );
}
