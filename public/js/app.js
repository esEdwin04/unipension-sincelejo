// =============================================================
// Utilidades compartidas del frontend
// Responsable: Desarrollador Frontend
// =============================================================
const API = {
  async pedir(ruta, opciones = {}) {
    const res = await fetch('/api' + ruta, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      ...opciones,
      body: opciones.body ? JSON.stringify(opciones.body) : undefined,
    });
    const datos = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(datos.error || 'Error de red'), { datos, status: res.status });
    return datos;
  },
  get: (r) => API.pedir(r),
  post: (r, body) => API.pedir(r, { method: 'POST', body }),
  put: (r, body) => API.pedir(r, { method: 'PUT', body }),
  patch: (r, body) => API.pedir(r, { method: 'PATCH', body }),
};

const cop = (v) => '$' + Number(v).toLocaleString('es-CO');
const estrellas = (c) => c ? '★'.repeat(Math.round(c)) + '☆'.repeat(5 - Math.round(c)) + ` (${c})` : 'Sin calificaciones';

function aviso(contenedor, tipo, mensaje) {
  const el = typeof contenedor === 'string' ? document.getElementById(contenedor) : contenedor;
  el.innerHTML = `<div class="aviso ${tipo}">${mensaje}</div>`;
  if (tipo === 'ok') setTimeout(() => { el.innerHTML = ''; }, 5000);
}

// Barra de navegación según la sesión (RNF-06: cada rol ve sus módulos)
async function pintarNav(activa = '') {
  const { usuario } = await API.get('/auth/yo');
  const enlaces = [['index.html', 'Catálogo']];
  if (usuario?.rol === 'estudiante')  enlaces.push(['reservas.html', 'Mis reservas']);
  if (usuario?.rol === 'propietario') enlaces.push(['propietario.html', 'Mis pensiones']);
  if (usuario?.rol === 'administrador') enlaces.push(['admin.html', 'Panel admin']);

  document.getElementById('nav').innerHTML = `
    <div class="nav">
      <a class="logo" href="index.html">Uni<span>Pensión</span> Sincelejo</a>
      ${enlaces.map(([h, t]) => `<a class="enlace ${activa === h ? 'activo' : ''}" href="${h}">${t}</a>`).join('')}
      <div class="derecha">
        ${usuario
          ? `<span class="chip">${usuario.nombre.split(' ')[0]} · ${usuario.rol}</span>
             <button class="boton chico secundario" onclick="cerrarSesion()">Salir</button>`
          : `<a class="enlace" href="login.html">Ingresar</a>
             <a class="boton chico" style="color:#fff" href="registro.html">Registrarse</a>`}
      </div>
    </div>`;
  return usuario;
}

async function cerrarSesion() {
  await API.post('/auth/logout');
  location.href = 'index.html';
}
