// =============================================================
// Historial del estudiante + pago de reservas (HU-07, HU-08, HU-11)
// Responsable: Desarrollador Frontend
// =============================================================
let filtro = 'vigentes', reservas = [];
const idPagar = new URLSearchParams(location.search).get('pagar');

(async () => {
  const u = await pintarNav('reservas.html');
  if (!u || u.rol !== 'estudiante') return location.href = 'login.html?volver=reservas.html';
  if (idPagar) {
    document.getElementById('panel-pago').style.display = 'block';
    document.getElementById('pg-id').textContent = '#' + idPagar;
  }
  cargar(); cargarNotif();
})();

document.querySelectorAll('.pestanas button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.pestanas button').forEach(x => x.classList.remove('activa'));
  b.classList.add('activa'); filtro = b.dataset.f; pintar();
}));

async function cargar() { reservas = await API.get('/reservas/mias'); pintar(); }

function pintar() {
  const vigentes = ['Pendiente de pago', 'Pagada', 'Confirmada'];
  let lista = reservas;
  if (filtro === 'vigentes')  lista = reservas.filter(r => vigentes.includes(r.estado));
  if (filtro === 'historico') lista = reservas.filter(r => !vigentes.includes(r.estado));

  document.getElementById('tabla-reservas').innerHTML = lista.map(r => `
    <tr>
      <td>${r.id}</td>
      <td><strong>${r.pension}</strong><br><span class="suave">Barrio ${r.barrio} · ${r.codigo} (${r.tipo})</span></td>
      <td>${r.fecha_ingreso}<br><span class="suave">${r.meses} meses</span></td>
      <td>${cop(r.valor_total)}</td>
      <td><span class="estado ${r.estado.replace(/ /g, ' ')}">${r.estado}</span></td>
      <td>${r.consecutivo ? `<a href="/api/reservas/${r.id}/comprobante">Descargar PDF</a>` : '—'}</td>
      <td>
        ${r.estado === 'Pendiente de pago' ? `<a class="boton chico" style="color:#fff" href="reservas.html?pagar=${r.id}">Pagar</a>` : ''}
        ${r.estado === 'Confirmada' ? `<button class="boton chico secundario" onclick="finalizar(${r.id})">Finalizar estadía</button>` : ''}
      </td>
    </tr>`).join('') ||
    // HU-11 esc. 4: estudiante sin reservas
    `<tr><td colspan="7" class="suave">Aún no registras reservas en esta vista.
      <a href="index.html">Explora el catálogo</a> y encuentra tu pensión ideal.</td></tr>`;
}

// HU-07: pago simulado contra la "pasarela"
document.getElementById('form-pago')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const r = await API.post(`/reservas/${idPagar}/pagar`, {
      medio: document.getElementById('pg-medio').value,
      simular: document.getElementById('pg-sim').value,
    });
    aviso('pg-mensaje', 'ok', `${r.mensaje} Comprobante: <strong>${r.consecutivo}</strong>.
      <a href="/api/reservas/${idPagar}/comprobante">Descargar PDF</a>`);
    cargar(); cargarNotif();
  } catch (err) { aviso('pg-mensaje', 'error', err.message); } // esc. 2: permite reintentar
});

document.getElementById('pg-cancelar')?.addEventListener('click', async () => {
  try {
    const r = await API.post(`/reservas/${idPagar}/cancelar`);
    aviso('pg-mensaje', 'ok', r.mensaje); cargar();
  } catch (err) { aviso('pg-mensaje', 'error', err.message); }
});

async function finalizar(id) {
  if (!confirm('¿Confirmas que tu estadía finalizó? Esto habilita la calificación de la pensión.')) return;
  const r = await API.post(`/reservas/${id}/finalizar`);
  aviso('mensaje', 'ok', r.mensaje); cargar();
}

async function cargarNotif() {
  const n = await API.get('/reservas/notificaciones');
  document.getElementById('lista-notif').innerHTML = n.length
    ? n.map(x => `<p>• ${x.mensaje} <span class="suave">(${x.creado_en})</span></p>`).join('')
    : 'Sin notificaciones.';
}
