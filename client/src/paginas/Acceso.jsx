import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../api.js';
import { useSesion } from '../App.jsx';
import Aviso from '../componentes/Aviso.jsx';

// Inicio de sesión y registro en una sola vista con pestañas (RF-01, RNF-07)
export default function Acceso() {
  const [modo, setModo] = useState('ingresar');
  const [msj, setMsj] = useState(null);
  const [l, setL] = useState({ correo: '', clave: '' });
  const [r, setR] = useState({ nombre: '', correo: '', telefono: '', clave: '', rol: 'estudiante', acepta_datos: false });
  const { refrescar } = useSesion();
  const nav = useNavigate();

  const destinos = { estudiante: '/', propietario: '/propietario', administrador: '/admin' };

  async function ingresar(e) {
    e.preventDefault();
    try {
      const { usuario } = await API.post('/auth/login', l);
      await refrescar(); nav(destinos[usuario.rol]);
    } catch (err) { setMsj(err.message); }
  }

  async function registrar(e) {
    e.preventDefault();
    try {
      const { usuario } = await API.post('/auth/registro', r);
      await refrescar(); nav(destinos[usuario.rol]);
    } catch (err) { setMsj(err.message); }
  }

  return (
    <main className="seccion acceso">
      <p className="kicker" style={{ textAlign: 'center' }}>Tu cuenta</p>
      <h1 className="titulo-seccion" style={{ textAlign: 'center' }}>
        {modo === 'ingresar' ? 'Bienvenido de nuevo' : 'Crear cuenta'}
      </h1>
      <div className="pestanas" style={{ justifyContent: 'center' }}>
        <button className={modo === 'ingresar' ? 'activa' : ''} onClick={() => setModo('ingresar')}>Ingresar</button>
        <button className={modo === 'registro' ? 'activa' : ''} onClick={() => setModo('registro')}>Registrarse</button>
      </div>
      {msj && <Aviso tipo="error">{msj}</Aviso>}

      {modo === 'ingresar' ? (
        <form onSubmit={ingresar} className="panel">
          <div className="campo"><label>Correo electrónico</label>
            <input type="email" required value={l.correo} onChange={(e) => setL({ ...l, correo: e.target.value })} /></div>
          <div className="campo"><label>Contraseña</label>
            <input type="password" required value={l.clave} onChange={(e) => setL({ ...l, clave: e.target.value })} /></div>
          <button className="boton" style={{ width: '100%' }}>Ingresar</button>
          <Aviso tipo="info">
            <strong>Usuarios de demostración</strong><br />
            estudiante@unipension.co / est123<br />
            propietaria@unipension.co / prop123<br />
            admin@unipension.co / admin123
          </Aviso>
        </form>
      ) : (
        <form onSubmit={registrar} className="panel">
          <div className="campo"><label>Nombre completo</label>
            <input required value={r.nombre} onChange={(e) => setR({ ...r, nombre: e.target.value })} /></div>
          <div className="campo"><label>Correo electrónico</label>
            <input type="email" required value={r.correo} onChange={(e) => setR({ ...r, correo: e.target.value })} /></div>
          <div className="campo"><label>Teléfono</label>
            <input value={r.telefono} onChange={(e) => setR({ ...r, telefono: e.target.value })} placeholder="300 000 0000" /></div>
          <div className="campo"><label>Contraseña</label>
            <input type="password" minLength="6" required value={r.clave} onChange={(e) => setR({ ...r, clave: e.target.value })} /></div>
          <div className="campo"><label>Quiero registrarme como</label>
            <select value={r.rol} onChange={(e) => setR({ ...r, rol: e.target.value })}>
              <option value="estudiante">Estudiante (busco pensión)</option>
              <option value="propietario">Propietario (ofrezco habitaciones)</option>
            </select></div>
          <label style={{ textTransform: 'none', letterSpacing: 0, fontSize: '.88rem', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <input type="checkbox" required style={{ width: 'auto', marginTop: 4 }}
                   checked={r.acepta_datos} onChange={(e) => setR({ ...r, acepta_datos: e.target.checked })} />
            <span>Autorizo el tratamiento de mis datos personales conforme a la Ley 1581 de 2012.</span>
          </label>
          <button className="boton" style={{ width: '100%', marginTop: 18 }}>Registrarme</button>
        </form>
      )}
    </main>
  );
}
