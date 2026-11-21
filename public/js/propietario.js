// =============================================================
// Panel del propietario (HU-01, HU-02, HU-09)
// Responsable: Desarrollador Frontend
// =============================================================
(async () => {
  const u = await pintarNav('propietario.html');
  if (!u || u.rol !== 'propietario') return location.href = 'login.html?volver=propietario.html';
  cargarMias(); cargarSolicitudes();
})();

// Pestañas
document.querySelectorAll('.pestanas button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.pestanas button').forEach(x => x.classList.remove('activa'));
  b.classList.add('activa');
  document.querySelectorAll('.pestana').forEach(s => s.style.display = 'none');
  document.getElementById('p-' + b.dataset.p).style.display = 'block';
}));

async function cargarMias() {
  const lista = await API.get('/pensiones/mias');
  document.getElementById('tabla-mias').innerHTML = lista.map(p => `
    <tr>
      <td><strong>${p.nombre}</strong><br><span class="suave">${p.direccion}</span></td>
      <td>${p.barrio}</td>
      <td>${cop(p.tarifa_mensual)}</td>
      <td><span class="estado ${p.estado}">${p.estado}</span></td>
      <td><button class="boton chico secundario" onclick="editar(${p.id}, ${p.tarifa_mensual})">Editar tarifa/servicios</button></td>
    </tr>`).join('') || '<tr><td colspan="5" class="suave">Aún no tienes publicaciones.</td></tr>';
}

// HU-02: edición rápida (tarifa y servicios)
async function editar(id, tarifaActual) {
  const tarifa = prompt('Nueva tarifa mensual (COP):', tarifaActual);
  if (tarifa === null) return; // HU-02 esc. 3: cancelar mantiene la información original
  const servicios = prompt('Servicios incluidos (separados por coma, vacío = no cambiar):', '');
  try {
    const r = await API.put('/pensiones/' + id, {
      tarifa_mensual: +tarifa || null,
      servicios: servicios || null,
    });
    aviso('mensaje', 'ok', r.mensaje); cargarMias();
  } catch (err) { aviso('mensaje', 'error', err.message); }
}

// HU-01: publicar
document.getElementById('form-pension').addEventListener('submit', async (e) => {
  e.preventDefault();
  const v = (id) => document.getElementById(id).value;
  const habitaciones = [];
  for (let i = 1; i <= +v('n-ind');  i++) habitaciones.push({ codigo: 'IND-' + i,  tipo: 'individual', tarifa: +v('n-tarifa') });
  for (let i = 1; i <= +v('n-comp'); i++) habitaciones.push({ codigo: 'COMP-' + i, tipo: 'compartida', tarifa: Math.round(+v('n-tarifa') * 0.7) });
  try {
    const r = await API.post('/pensiones', {
      nombre: v('n-nombre'), direccion: v('n-direccion'), barrio: v('n-barrio'),
      tarifa_mensual: +v('n-tarifa'), deposito: +v('n-deposito') || 0,
      servicios: v('n-servicios'), descripcion: v('n-descripcion'), reglas: v('n-reglas'),
      habitaciones,
    });
    aviso('n-mensaje', 'ok', r.mensaje + ' El administrador la revisará antes de publicarla en el catálogo.');
    e.target.reset(); cargarMias();
  } catch (err) { // HU-01 esc. 2 y 3
    let msj = err.message;
    if (err.datos?.campos) msj += ': ' + err.datos.campos.join(', ');
    aviso('n-mensaje', 'error', msj);
  }
});

// HU-09: bandeja de solicitudes
async function cargarSolicitudes() {
  const lista = await API.get('/reservas/solicitudes');
  document.getElementById('tabla-solicitudes').innerHTML = lista.map(s => `
    <tr>
      <td>${s.id}</td>
      <td>${s.pension}<br><span class="suave">${s.codigo} · ${s.tipo}</span></td>
      <td>${s.estudiante}<br><span class="suave">${s.estado === 'Confirmada' ? s.telefono + ' · ' + s.correo : 'Contacto visible al aceptar'}</span></td>
      <td>${s.fecha_ingreso} (${s.meses} meses)</td>
      <td>${cop(s.valor_total)}</td>
      <td><span class="estado ${s.estado}">${s.estado}</span></td>
      <td>${s.estado === 'Pagada' ? `
        <button class="boton chico ok" onclick="responder(${s.id},'aceptar')">Aceptar</button>
        <button class="boton chico peligro" onclick="responder(${s.id},'rechazar')">Rechazar</button>` : '—'}</td>
    </tr>`).join('') || '<tr><td colspan="7" class="suave">No hay solicitudes por ahora.</td></tr>';
}

async function responder(id, decision) {
  let motivo = null;
  if (decision === 'rechazar') {
    motivo = prompt('Motivo del rechazo (se notifica al estudiante):');
    if (!motivo) return;
  }
  try {
    const r = await API.post(`/reservas/${id}/responder`, { decision, motivo });
    aviso('mensaje', 'ok', r.mensaje); cargarSolicitudes();
  } catch (err) { aviso('mensaje', 'error', err.message); }
}
