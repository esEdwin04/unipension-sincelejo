// Mis pensiones (HU-01, HU-02): estados de moderación y disponibilidad independientes,
// ver detalle, editar, actualizar cupos (diálogo) y marcar ocupada.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API, cop, ETIQUETA_ESTADO, EXPLICA_ESTADO } from '../../api.js';
import { useSesion } from '../../App.jsx';
import Icono from '../../componentes/Icono.jsx';
import { Aviso, Campo, Cargando, Chip, Dialogo, TituloPagina, Vacio } from '../../componentes/ui.jsx';

export function ChipsEstado({ p }) {
  return (
    <div className="chips">
      <Chip clase={p.estado}>{ETIQUETA_ESTADO[p.estado]}</Chip>
      <Chip clase={p.cupos > 0 ? 'Disponible' : 'Ocupada'}>{p.cupos > 0 ? 'Disponible' : 'Ocupada'} · {p.cupos}/{p.capacidad} cupos</Chip>
      {p.destacado && <Chip clase="destacado">Destacado</Chip>}
    </div>
  );
}

export default function MisPensiones() {
  const { avisar } = useSesion();
  const nav = useNavigate();
  const [mias, setMias] = useState(null);
  const [error, setError] = useState('');
  const [cupos, setCupos] = useState(null); // { p, valor, error }

  const cargar = () => API.get('/pensiones/mias').then(setMias).catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, []);

  async function guardarCupos(p, valor) {
    try {
      const r = await API.patch(`/pensiones/${p.id}/cupos`, { cupos: Number(valor) });
      avisar(r.mensaje); setCupos(null); cargar();
    } catch (err) {
      if (cupos) setCupos({ ...cupos, error: err.message }); else setError(err.message);
    }
  }

  return (
    <main className="contenido">
      <TituloPagina titulo="Mis pensiones" subtitulo="Moderación y disponibilidad son estados independientes" />
      <button className="btn ancho" onClick={() => nav('/mis-pensiones/nueva')}><Icono nombre="mas" />Publicar pensión</button>
      <Aviso tipo="error">{error}</Aviso>
      {!mias ? <Cargando /> : mias.length === 0 ? (
        <Vacio icono="edificio" titulo="Tu primera pensión empieza aquí" texto="Completa tres pasos y envíala a revisión." />
      ) : (
        <div className="grid-gestion">
          {mias.map((p) => (
            <article className="tarjeta-gestion" key={p.id}>
              <img src={p.foto || '/img/placeholder1.svg'} alt={p.nombre} loading="lazy" />
              <div className="tg-cuerpo">
                <ChipsEstado p={p} />
                <h2>{p.nombre}</h2>
                <p>{p.barrio} · {cop(p.tarifa_mensual)}/mes · {p.contactos} contacto(s) por WhatsApp</p>
                <p className="explica">{EXPLICA_ESTADO[p.estado]}</p>
                {p.motivo_rechazo && <p className="motivo-rechazo"><b>Motivo:</b> {p.motivo_rechazo}</p>}
                <div className="tg-acciones">
                  <button className="btn sec chico" onClick={() => nav(`/pension/${p.id}`)}>Ver detalle</button>
                  <button className="btn chico" onClick={() => nav(`/mis-pensiones/${p.id}/editar`)}><Icono nombre="editar" tam={16} />Editar pensión</button>
                  <button className="btn sec chico" onClick={() => setCupos({ p, valor: String(p.cupos), error: '' })}>Actualizar cupos</button>
                  {p.cupos > 0 && <button className="btn sec chico" onClick={() => guardarCupos(p, 0)}>Marcar ocupada</button>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {cupos && (
        <Dialogo titulo="Actualizar disponibilidad" cerrar={() => setCupos(null)}>
          <form onSubmit={(e) => {
            e.preventDefault();
            const n = Number(cupos.valor);
            if (cupos.valor === '' || !Number.isInteger(n) || n < 0 || n > cupos.p.max_cupos)
              return setCupos({ ...cupos, error: `Escribe un número entero entre 0 y ${cupos.p.max_cupos}.` });
            guardarCupos(cupos.p, n);
          }}>
            <p style={{ marginBottom: 12 }}><b>{cupos.p.nombre}</b></p>
            <Campo etiqueta={`Cupos disponibles (capacidad ${cupos.p.capacidad})`} error={cupos.error}>
              <input type="number" min="0" max={cupos.p.max_cupos} step="1" value={cupos.valor} onChange={(e) => setCupos({ ...cupos, valor: e.target.value })} />
            </Campo>
            {cupos.p.max_cupos < cupos.p.capacidad && <Aviso tipo="alerta">{cupos.p.capacidad - cupos.p.max_cupos} habitación(es) tienen reservas vigentes y no se pueden liberar manualmente.</Aviso>}
            <Aviso>Cero cupos significa ocupada. Tener cupos no evita la moderación: solo se publica si está verificada.</Aviso>
            <button className="btn ancho">Guardar cupos</button>
          </form>
        </Dialogo>
      )}
    </main>
  );
}
