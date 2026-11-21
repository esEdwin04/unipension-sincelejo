// =============================================================
// Panel administrativo (HU-03, HU-12 + moderación HU-10)
// Responsable: Desarrollador Frontend
// =============================================================
(async () => {
  const u = await pintarNav('admin.html');
  if (!u || u.rol !== 'administrador') return location.href = 'login.html?volver=admin.html';
  cargarTodo();
})();

document.querySelectorAll('.pestanas button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.pestanas button').forEach(x => x.classList.remove('activa'));
  b.classList.add('activa');
  document.querySelectorAll('.pestana').forEach(s => s.style.display = 'none');
  document.getElementById('p-' + b.dataset.p).style.display = 'block';
}));

async function cargarTodo() {
  const { kpis, porBarrio, top } = await API.get('/admin/indicadores');
  document.getElementById('kpis').innerHTML = [
    ['Pensiones', kpis.pensiones_total], ['Verificadas', kpis.pensiones_verificadas],
    ['Pendientes', kpis.pensiones_pendientes], ['Reservas', kpis.reservas_total],
    ['Confirmadas', kpis.reservas_confirmadas], ['Ingresos', cop(kpis.ingresos)],
  ].map(([n, v]) => `<div class="kpi"><div class="valor">${v}</div><div class="nombre">${n}</div></div>`).join('');

  document.getElementById('tabla-barrios').innerHTML = porBarrio.map(b =>
    `<tr><td>${b.barrio}</td><td>${b.habitaciones}</td><td>${b.ocupadas}</td>
     <td><strong>${b.ocupacion_pct}%</strong></td><td>${cop(b.arriendo_promedio)}</td></tr>`).join('');

  document.getElementById('tabla-top').innerHTML = top.map(t =>
    `<tr><td>${t.nombre}</td><td>${t.barrio}</td><td>${t.solicitudes}</td><td class="estrellas">${estrellas(t.calificacion)}</td></tr>`).join('');

  cargarVerificacion(); cargarTraza(); cargarModeracion(); cargarBitacora();
}

// HU-03
async function cargarVerificacion() {
  const lista = await API.get('/pensiones/pendientes');
  document.getElementById('tabla-verificacion').innerHTML = lista.map(p => `
    <tr>
      <td><strong>${p.nombre}</strong><br><span class="suave">${p.direccion}</span></td>
      <td>${p.propietario}</td><td>${p.barrio}</td><td>${cop(p.tarifa_mensual)}</td>
      <td><span class="estado ${p.estado}">${p.estado}</span></td>
      <td>
        <button class="boton chico ok" onclick="cambiarEstado(${p.id},'Verificada')">Verificar</button>
        <button class="boton chico peligro" onclick="cambiarEstado(${p.id},'Rechazada')">Rechazar</button>
        <button class="boton chico secundario" onclick="cambiarEstado(${p.id},'Suspendida')">Suspender</button>
      </td>
    </tr>`).join('');
}

async function cambiarEstado(id, estado) {
  let motivo = null;
  if (estado !== 'Verificada') {
    motivo = prompt(`Motivo de la ${estado.toLowerCase()} (se notifica al propietario):`);
    if (!motivo) return;
  }
  try {
    const r = await API.patch(`/pensiones/${id}/estado`, { estado, motivo });
    aviso('mensaje', r.advertencia ? 'info' : 'ok', r.mensaje + (r.advertencia ? '<br>' + r.advertencia : ''));
    cargarTodo();
  } catch (err) { aviso('mensaje', 'error', err.message); }
}

// HU-12
document.getElementById('form-traza').addEventListener('submit', (e) => { e.preventDefault(); cargarTraza(); });
async function cargarTraza() {
  const q = new URLSearchParams();
  const v = (id) => document.getElementById(id).value;
  if (v('t-q')) q.set('q', v('t-q'));
  if (v('t-desde')) q.set('desde', v('t-desde'));
  if (v('t-hasta')) q.set('hasta', v('t-hasta'));
  const lista = await API.get('/admin/trazabilidad?' + q);
  document.getElementById('tabla-traza').innerHTML = lista.map(r => `
    <tr><td>${r.id}</td><td>${r.pension}<br><span class="suave">${r.barrio}</span></td>
    <td>${r.propietario}</td><td>${r.estudiante}</td><td>${r.fecha_ingreso}</td>
    <td>${cop(r.valor_total)}</td><td><span class="estado ${r.estado.replace(/ /g,' ')}">${r.estado}</span></td>
    <td>${r.consecutivo || '—'}</td></tr>`).join('') ||
    '<tr><td colspan="8" class="suave">Sin registros para los filtros seleccionados.</td></tr>';
}

// Moderación de reseñas
async function cargarModeracion() {
  const lista = await API.get('/resenas/reportadas');
  document.getElementById('lista-reportadas').innerHTML = lista.map(r => `
    <div style="border-top:1px solid var(--borde);padding:10px 0">
      <span class="estrellas">${'★'.repeat(r.estrellas)}</span> <strong>${r.estudiante}</strong>
      sobre <em>${r.pension}</em>: "${r.comentario}"
      <div style="margin-top:6px">
        <button class="boton chico ok" onclick="moderar(${r.id},'publicar')">Restaurar</button>
        <button class="boton chico peligro" onclick="moderar(${r.id},'ocultar')">Ocultar definitivamente</button>
      </div>
    </div>`).join('') || '<p class="suave">No hay reseñas reportadas.</p>';
}
async function moderar(id, decision) {
  const r = await API.patch(`/resenas/${id}/moderar`, { decision });
  aviso('mensaje', 'ok', r.mensaje); cargarModeracion();
}

// Bitácora HU-03
async function cargarBitacora() {
  const lista = await API.get('/admin/bitacora');
  document.getElementById('tabla-bitacora').innerHTML = lista.map(b => `
    <tr><td>${b.creado_en}</td><td>${b.pension}</td>
    <td><span class="estado ${b.accion}">${b.accion}</span></td>
    <td>${b.motivo || '—'}</td><td>${b.administrador}</td></tr>`).join('') ||
    '<tr><td colspan="5" class="suave">Sin registros.</td></tr>';
}
