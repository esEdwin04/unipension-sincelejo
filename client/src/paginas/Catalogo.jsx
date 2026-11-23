// =============================================================
// Catálogo "¿Dónde quieres vivir?" (HU-04) — prototipo inicial:
// buscador, panel de filtros, filtros activos removibles, ubicación del dispositivo,
// vista Lista / Mapa, conteo, paginación de 12 y estado sin resultados.
// =============================================================
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API, cop } from '../api.js';
import TarjetaPension, { Mapa } from '../componentes/TarjetaPension.jsx';
import Icono, { IconoServicio } from '../componentes/Icono.jsx';
import { Aviso, Campo, Cargando, Vacio, TituloPagina } from '../componentes/ui.jsx';

const POR_PAGINA = 12;
const VACIO = { q: '', universidad_id: '', precio_min: '', precio_max: '', tipo: '', servicios: [], orden: 'recientes', barrio: '' };
const ORDENES = { recientes: 'Más recientes', precio_asc: 'Menor precio', precio_desc: 'Mayor precio', calificacion: 'Mejor calificadas', cercania: 'Más cercanas' };

function distanciaKm(a, b) {
  const r = (x) => (x * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Los filtros viven en la URL: se pueden compartir y se conservan al volver de la ficha
const leer = (sp) => ({ ...VACIO, ...Object.fromEntries(sp.entries()), servicios: sp.get('servicios') ? sp.get('servicios').split(',') : [] });

export default function Catalogo() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  // Cambiar de página o de vista no vuelve a consultar el API
  const claveFiltros = [...sp.entries()].filter(([k]) => !['pagina', 'vista'].includes(k)).map((e) => e.join('=')).join('&');
  const filtros = useMemo(() => leer(new URLSearchParams(claveFiltros)), [claveFiltros]);
  const [borrador, setBorrador] = useState(filtros);
  const [texto, setTexto] = useState(filtros.q);
  const [panel, setPanel] = useState(false);
  const [vista, setVista] = useState(sp.get('vista') || 'lista');
  const [lista, setLista] = useState(null);
  const [error, setError] = useState('');
  const [errorRango, setErrorRango] = useState('');
  const [unis, setUnis] = useState([]);
  const [barrios, setBarrios] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [ubicacion, setUbicacion] = useState(null);
  const [referencia, setReferencia] = useState(null);
  const [geo, setGeo] = useState({ estado: 'inactivo', msj: '' });
  const [centrar, setCentrar] = useState({ u: 0, c: 0 });
  const pagina = Math.max(1, +sp.get('pagina') || 1);

  useEffect(() => {
    API.get('/pensiones/universidades').then(setUnis).catch(() => {});
    API.get('/pensiones/barrios-sincelejo').then(setBarrios).catch(() => {});
    API.get('/pensiones/servicios').then(setServicios).catch(() => {});
  }, []);

  useEffect(() => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(filtros)) {
      if (k === 'servicios') { if (v.length) q.set(k, v.join(',')); }
      else if (String(v).trim() && !['pagina', 'vista'].includes(k)) q.set(k, v);
    }
    setError('');
    setLista(null);
    API.get('/pensiones?' + q).then(setLista).catch((e) => { setError(e.message); setLista([]); });
  }, [filtros]);

  const aplicar = (nuevos, extra = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(nuevos)) {
      if (k === 'servicios') { if (v.length) q.set(k, v.join(',')); }
      else if (String(v).trim() && !(k === 'orden' && v === 'recientes')) q.set(k, v);
    }
    if (vista !== 'lista') q.set('vista', vista);
    Object.entries(extra).forEach(([k, v]) => q.set(k, v));
    setSp(q);
  };
  const limpiar = () => { setTexto(''); setBorrador(VACIO); setErrorRango(''); aplicar(VACIO); };
  const quitar = (k, valor) => {
    const n = { ...filtros, [k]: k === 'servicios' ? filtros.servicios.filter((s) => s !== valor) : VACIO[k] };
    if (k === 'q') setTexto('');
    if (k === 'universidad_id' && n.orden === 'cercania') n.orden = 'recientes';
    setBorrador(n); aplicar(n);
  };
  const cambiarVista = (v) => {
    setVista(v);
    const q = new URLSearchParams(sp); v === 'lista' ? q.delete('vista') : q.set('vista', v); setSp(q, { replace: true });
  };
  const irPagina = (n) => { const q = new URLSearchParams(sp); q.set('pagina', n); setSp(q); window.scrollTo({ top: 0 }); };

  function enviarPanel(e) {
    e.preventDefault();
    const min = Number(borrador.precio_min), max = Number(borrador.precio_max);
    if (min < 0 || max < 0 || (borrador.precio_min && borrador.precio_max && min > max)) {
      setErrorRango('El rango de precios debe ser positivo y el mínimo no puede superar el máximo.');
      return;
    }
    setErrorRango('');
    setPanel(false);
    aplicar({ ...borrador, q: texto });
  }

  // Ubicación del dispositivo: solo en memoria durante la búsqueda, no se guarda ni se comparte
  function usarUbicacion() {
    if (!window.isSecureContext) return setGeo({ estado: 'error', msj: 'La ubicación requiere HTTPS o localhost. Puedes seguir usando los filtros.' });
    if (!navigator.geolocation) return setGeo({ estado: 'error', msj: 'Este navegador no ofrece ubicación. Busca por universidad, barrio o toca el mapa.' });
    setGeo({ estado: 'buscando', msj: 'Solicitando permiso de ubicación…' });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUbicacion({ lat: coords.latitude, lng: coords.longitude, precision: coords.accuracy });
        cambiarVista('mapa');
        setGeo({ estado: 'ok', msj: `Ubicación autorizada. Precisión aproximada: ${Math.round(coords.accuracy)} m. Solo se usa en esta búsqueda; no se guarda ni se comparte.` });
      },
      (err) => setGeo({ estado: 'error', msj: err.code === 1
        ? 'Permiso denegado. Habilita la ubicación en el navegador o toca el mapa para elegir una referencia.'
        : err.code === 3 ? 'La solicitud de ubicación tardó demasiado. Vuelve a intentarlo o busca por universidad y barrio.'
        : 'La ubicación no está disponible en este dispositivo. Puedes continuar por filtros o seleccionando un punto en el mapa.' }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  const punto = ubicacion || referencia;
  const resultados = useMemo(() => {
    if (!lista) return [];
    const conDist = lista.map((p) => ({ ...p, _d: punto && p.lat != null ? distanciaKm(punto, p) : null }));
    return punto && !filtros.universidad_id ? [...conDist].sort((a, b) => (a._d ?? 99) - (b._d ?? 99)) : conDist;
  }, [lista, punto, filtros.universidad_id]);
  const paginas = Math.max(1, Math.ceil(resultados.length / POR_PAGINA));
  const actual = Math.min(pagina, paginas);
  const visibles = resultados.slice((actual - 1) * POR_PAGINA, actual * POR_PAGINA);
  const uni = unis.find((u) => String(u.id) === String(filtros.universidad_id));

  const activos = [
    ['q', filtros.q, `Búsqueda: ${filtros.q}`],
    ['universidad_id', filtros.universidad_id, uni ? `Cerca de ${uni.nombre}` : ''],
    ['barrio', filtros.barrio, `Barrio ${filtros.barrio}`],
    ['precio_min', filtros.precio_min, `Desde ${cop(filtros.precio_min)}`],
    ['precio_max', filtros.precio_max, `Hasta ${cop(filtros.precio_max)}`],
    ['tipo', filtros.tipo, filtros.tipo === 'individual' ? 'Habitación individual' : 'Habitación compartida'],
    ['orden', filtros.orden !== 'recientes' ? filtros.orden : '', ORDENES[filtros.orden]],
  ].filter(([, v]) => v);
  const hayFiltros = activos.length > 0 || filtros.servicios.length > 0;

  const tarjetas = (
    <>
      <div className="grid-pensiones">
        {visibles.map((p) => (
          <TarjetaPension key={p.id} p={p}
            distancia={p.distancia_km ?? p._d}
            etiquetaDistancia={p.distancia_km != null ? `hasta ${uni?.nombre}` : ubicacion ? 'desde tu ubicación' : 'desde el punto elegido'} />
        ))}
      </div>
      {resultados.length > POR_PAGINA && (
        <nav className="paginacion" aria-label="Páginas del catálogo">
          <button disabled={actual <= 1} onClick={() => irPagina(actual - 1)}>Anterior</button>
          <span>Página {actual} de {paginas}</span>
          <button disabled={actual >= paginas} onClick={() => irPagina(actual + 1)}>Siguiente</button>
        </nav>
      )}
    </>
  );

  return (
    <main className="contenido">
      <TituloPagina titulo="¿Dónde quieres vivir?" subtitulo="Pensiones y cupos para tu vida estudiantil en Sincelejo" />
      <form className="buscador" role="search" onSubmit={(e) => { e.preventDefault(); aplicar({ ...filtros, q: texto }); }}>
        <Icono nombre="ubicacion" />
        <input aria-label="Buscar pensiones" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Barrio, universidad, servicio o pensión" />
        <button type="button" className="b-filtro" aria-label="Abrir filtros" aria-expanded={panel}
                onClick={() => { setBorrador({ ...filtros, q: texto }); setPanel(!panel); }}>
          <Icono nombre="filtro" />{hayFiltros && <i />}
        </button>
        <button className="b-ir" aria-label="Ejecutar búsqueda"><Icono nombre="buscar" /></button>
      </form>

      <div className="herramientas">
        <button className="btn sec chico" onClick={usarUbicacion} disabled={geo.estado === 'buscando'}>
          <Icono nombre="ubicacion" tam={18} />{geo.estado === 'buscando' ? 'Buscando ubicación…' : ubicacion ? 'Actualizar mi ubicación' : 'Usar mi ubicación'}
        </button>
        <div className="alternar" role="group" aria-label="Vista del catálogo">
          <button className={vista === 'lista' ? 'activo' : ''} aria-pressed={vista === 'lista'} onClick={() => cambiarVista('lista')}><Icono nombre="lista" tam={17} />Lista</button>
          <button className={vista === 'mapa' ? 'activo' : ''} aria-pressed={vista === 'mapa'} onClick={() => cambiarVista('mapa')}><Icono nombre="mapa" tam={17} />Mapa</button>
        </div>
      </div>

      {hayFiltros && (
        <div className="filtros-activos" aria-label="Filtros activos">
          {activos.map(([k, , t]) => (
            <button key={k} onClick={() => quitar(k)} aria-label={`Quitar filtro: ${t}`}>{t}<Icono nombre="cerrar" tam={14} /></button>
          ))}
          {filtros.servicios.map((s) => (
            <button key={s} onClick={() => quitar('servicios', s)} aria-label={`Quitar filtro: ${s}`}>
              <IconoServicio servicio={s} tam={15} />{s}<Icono nombre="cerrar" tam={14} /></button>
          ))}
        </div>
      )}
      {geo.msj && <Aviso tipo={geo.estado === 'error' ? 'alerta' : ''} role="status">{geo.msj}</Aviso>}

      {panel && (
        <form className="panel-filtros" onSubmit={enviarPanel}>
          <div className="dos">
            <Campo etiqueta="Universidad cercana">
              <select value={borrador.universidad_id} onChange={(e) => setBorrador({ ...borrador, universidad_id: e.target.value })}>
                <option value="">Todas</option>
                {unis.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
            </Campo>
            <Campo etiqueta="Barrio">
              <select value={borrador.barrio} onChange={(e) => setBorrador({ ...borrador, barrio: e.target.value })}>
                <option value="">Todos los barrios</option>
                <optgroup label="Con pensiones disponibles">
                  {barrios.filter((b) => b.pensiones > 0).map((b) => (
                    <option key={b.barrio} value={b.barrio}>{b.barrio} ({b.pensiones})</option>
                  ))}
                </optgroup>
                <optgroup label="Otros barrios de Sincelejo">
                  {barrios.filter((b) => !b.pensiones).map((b) => <option key={b.barrio} value={b.barrio}>{b.barrio}</option>)}
                </optgroup>
              </select>
            </Campo>
            <Campo etiqueta="Precio mínimo COP">
              <input type="number" min="0" step="10000" value={borrador.precio_min} placeholder="250000"
                     onChange={(e) => setBorrador({ ...borrador, precio_min: e.target.value })} />
            </Campo>
            <Campo etiqueta="Precio máximo COP" error={errorRango}>
              <input type="number" min="0" step="10000" value={borrador.precio_max} placeholder="700000"
                     onChange={(e) => setBorrador({ ...borrador, precio_max: e.target.value })} />
            </Campo>
            <Campo etiqueta="Tipo de habitación">
              <select value={borrador.tipo} onChange={(e) => setBorrador({ ...borrador, tipo: e.target.value })}>
                <option value="">Todas</option><option value="individual">Individual</option><option value="compartida">Compartida</option>
              </select>
            </Campo>
            <Campo etiqueta="Orden de resultados">
              <select value={borrador.orden} onChange={(e) => setBorrador({ ...borrador, orden: e.target.value })}>
                {Object.entries(ORDENES).filter(([k]) => k !== 'cercania' || borrador.universidad_id)
                  .map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select>
            </Campo>
          </div>
          <fieldset>
            <legend>Servicios incluidos · deben cumplirse todos</legend>
            <div className="checks">
              {servicios.map((s) => (
                <label className="check" key={s}>
                  <input type="checkbox" checked={borrador.servicios.includes(s)}
                         onChange={(e) => setBorrador({ ...borrador, servicios: e.target.checked ? [...borrador.servicios, s] : borrador.servicios.filter((x) => x !== s) })} />
                  {s}
                </label>
              ))}
            </div>
          </fieldset>
          <Aviso>La distancia a la universidad se calcula en línea recta desde las coordenadas registradas de cada pensión.</Aviso>
          <div className="fila-acciones">
            <button type="button" className="btn sec" onClick={() => { limpiar(); setPanel(false); }}>Limpiar filtros</button>
            <button className="btn">Aplicar filtros</button>
          </div>
        </form>
      )}

      <div className="resultados-cab" aria-live="polite">
        <b>{lista ? `${resultados.length} ${resultados.length === 1 ? 'pensión encontrada' : 'pensiones encontradas'}` : 'Buscando…'}</b>
        {hayFiltros && <button onClick={limpiar}>Limpiar filtros</button>}
      </div>
      <Aviso tipo="error">{error}</Aviso>

      {!lista ? <Cargando texto="Buscando pensiones…" /> : resultados.length === 0 ? (
        <Vacio titulo="Sin resultados para los filtros seleccionados" texto="Prueba otra universidad, barrio o un rango de precio más amplio."
               accion={<button className="btn" onClick={limpiar}>Limpiar filtros</button>} />
      ) : vista === 'mapa' ? (
        <div className="vista-mapa">
          <div>{tarjetas}</div>
          <div className="columna-mapa">
            <div className="mapa-acciones">
              {ubicacion && <button className="btn sec chico" onClick={() => setCentrar((c) => ({ ...c, u: c.u + 1 }))}>Centrar en mi ubicación</button>}
              <button className="btn sec chico" onClick={() => setCentrar((c) => ({ ...c, c: c.c + 1 }))}>Ver pensiones en Sincelejo</button>
            </div>
            <Mapa pensiones={resultados} ubicacion={ubicacion} seleccion={referencia} onSeleccionar={setReferencia}
                  onAbrir={(id) => nav(`/pension/${id}`)} centrarUbicacion={centrar.u} centrarCiudad={centrar.c} />
            <p className="fine">{resultados.filter((p) => p.lat != null).length} marcadores de resultados filtrados, sin límite de paginación.</p>
            {referencia && <Aviso>Referencia manual: {referencia.lat.toFixed(5)}, {referencia.lng.toFixed(5)}. No es la ubicación del dispositivo.
              {' '}<button className="btn-link" onClick={() => setReferencia(null)}>Quitar</button></Aviso>}
          </div>
        </div>
      ) : tarjetas}
      <p className="pie-catalogo">Solo se muestran pensiones verificadas con cupos · Los destacados respetan tus filtros.</p>
    </main>
  );
}
