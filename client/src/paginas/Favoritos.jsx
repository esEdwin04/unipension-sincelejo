// =============================================================
// Favoritos del estudiante: pensiones guardadas para comparar y decidir después.
// Al quitar un corazón la tarjeta desaparece de la lista (el estado vive en App).
// =============================================================
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API } from '../api.js';
import { useSesion } from '../App.jsx';
import TarjetaPension from '../componentes/TarjetaPension.jsx';
import Icono from '../componentes/Icono.jsx';
import { Aviso, Cargando, TituloPagina, Vacio } from '../componentes/ui.jsx';

export default function Favoritos() {
  const { favoritos } = useSesion();
  const [lista, setLista] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { API.get('/favoritos').then(setLista).catch((e) => setError(e.message)); }, []);

  // Se muestran solo las que siguen marcadas (al quitar el corazón desaparecen sin recargar)
  const visibles = lista?.filter((p) => favoritos.has(p.id)) ?? [];
  const noPublicadas = visibles.filter((p) => !p.publicada);
  const sinCupos = visibles.filter((p) => p.publicada && !p.cupos).length;

  return (
    <main className="contenido">
      <TituloPagina titulo="Tus favoritos" subtitulo="Las pensiones que guardaste para comparar con calma" />
      <Aviso tipo="error">{error}</Aviso>
      {!lista && !error && <Cargando texto="Cargando tus favoritos…" />}
      {lista && visibles.length === 0 && (
        <Vacio icono="corazon" titulo="Aún no has guardado pensiones"
               texto="Toca el corazón de cualquier pensión del catálogo para guardarla aquí y compararla después."
               accion={<Link className="btn" to="/buscar"><Icono nombre="buscar" tam={18} />Explorar pensiones</Link>} />
      )}
      {visibles.length > 0 && (
        <>
          <p className="resultados-cab"><b>{visibles.length} {visibles.length === 1 ? 'pensión guardada' : 'pensiones guardadas'}</b>
            {sinCupos > 0 && <span className="muted">{sinCupos} sin cupos por ahora</span>}</p>
          {noPublicadas.length > 0 && (
            <Aviso tipo="alerta">{noPublicadas.map((p) => p.nombre).join(', ')} ya no {noPublicadas.length === 1 ? 'está publicada' : 'están publicadas'} en
              el catálogo (en revisión u oculta por administración). Puedes quitarla de tus favoritos.</Aviso>
          )}
          <div className="grid-pensiones">
            {visibles.map((p) => <TarjetaPension key={p.id} p={p} />)}
          </div>
        </>
      )}
    </main>
  );
}
