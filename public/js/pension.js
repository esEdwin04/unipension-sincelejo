// =============================================================
// Ficha detallada + solicitud de reserva (HU-05, HU-06, HU-10)
// Responsable: Desarrollador Frontend
// =============================================================
const idPension = new URLSearchParams(location.search).get('id');
let pension = null, usuarioActual = null;

async function cargar() {
  usuarioActual = await pintarNav();
  pension = await API.get('/pensiones/' + idPension);
  const $ = (id) => document.getElementById(id);

  $('p-nombre').textContent = pension.nombre;
  $('p-ubicacion').textContent = `${pension.direccion} · Barrio ${pension.barrio}`;
  $('p-calificacion').textContent = estrellas(pension.calificacion);
  $('p-descripcion').textContent = pension.descripcion || '';
  $('p-reglas').textContent = pension.reglas || 'No registradas';
  $('p-servicios').innerHTML = (pension.servicios || '').split(',').filter(Boolean)
    .map(s => `<span class="etiqueta">${s.trim()}</span>`).join('') || '<span class="suave">No registrados</span>';

  // Galería con visor (HU-05 esc. 3)
  $('p-galeria').innerHTML = pension.fotos
    .map((f, i) => `<img src="${f}" class="${i === 0 ? 'principal' : ''}" onclick="abrirVisor('${f}')" alt="Foto ${i + 1}">`).join('');

  // Habitaciones disponibles
  const libres = pension.habitaciones.filter(h => h.estado === 'Libre');
  $('s-habitacion').innerHTML = libres.length
    ? libres.map(h => `<option value="${h.id}" data-tarifa="${h.tarifa}">${h.codigo} · ${h.tipo} · ${cop(h.tarifa)}/mes</option>`).join('')
    : '<option value="">Sin habitaciones disponibles</option>';
  $('s-fecha').min = new Date().toISOString().slice(0, 10); // HU-06 esc. 2

  // Distancias a las universidades (HU-05 esc. 4)
  $('p-distancias').innerHTML = pension.universidades
    .map(u => `<li>${u.nombre}: <strong>${u.distancia_km ?? '—'} km</strong> aprox.</li>`).join('');

  // Mapa (Leaflet + OpenStreetMap)
  if (pension.lat && window.L) {
    const mapa = L.map('mapa').setView([pension.lat, pension.lng], 15);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      { attribution: '© OpenStreetMap' }).addTo(mapa);
    L.marker([pension.lat, pension.lng]).addTo(mapa).bindPopup(pension.nombre).openPopup();
  }

  // Reseñas
  $('p-resenas').innerHTML = pension.resenas.length
    ? pension.resenas.map(r => `
        <div style="border-top:1px solid var(--borde);padding:10px 0">
          <span class="estrellas">${'★'.repeat(r.estrellas)}</span>
          <strong style="margin-left:6px">${r.nombre}</strong>
          <span class="suave"> · ${r.creado_en.slice(0, 10)}</span>
          <p>${r.comentario || ''}</p>
        </div>`).join('')
    : '<p class="suave">Aún no hay reseñas para esta pensión.</p>';

  // HU-10 esc. 2: el formulario solo se habilita con estadía finalizada
  if (usuarioActual?.rol === 'estudiante') {
    const mias = await API.get('/reservas/mias');
    const finalizada = mias.some(r => r.pension === pension.nombre && r.estado === 'Finalizada');
    if (finalizada) document.getElementById('form-resena').style.display = 'block';
    else document.getElementById('r-nota').textContent =
      'La calificación se habilita únicamente al finalizar una estadía en esta pensión.';
  }
  calcularCosto();
}

// HU-05 esc. 2: costo estimado = tarifa × meses + depósito
function calcularCosto() {
  const sel = document.getElementById('s-habitacion').selectedOptions[0];
  const meses = +document.getElementById('s-meses').value || 0;
  if (!sel?.dataset.tarifa || !meses) return;
  const total = +sel.dataset.tarifa * meses + pension.deposito;
  document.getElementById('s-costo').innerHTML =
    `Costo estimado: <strong>${cop(total)}</strong><br>
     <span class="suave">(${cop(sel.dataset.tarifa)} × ${meses} meses + depósito ${cop(pension.deposito)})</span>`;
}
document.getElementById('s-habitacion').addEventListener('change', calcularCosto);
document.getElementById('s-meses').addEventListener('input', calcularCosto);

// HU-06: crear la solicitud y pasar al pago
document.getElementById('form-reserva').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!usuarioActual) return location.href = 'login.html?volver=pension.html?id=' + idPension;
  if (usuarioActual.rol !== 'estudiante')
    return aviso('s-mensaje', 'error', 'Solo los estudiantes pueden solicitar reservas.');
  try {
    const r = await API.post('/reservas', {
      habitacion_id: +document.getElementById('s-habitacion').value,
      fecha_ingreso: document.getElementById('s-fecha').value,
      meses: +document.getElementById('s-meses').value,
    });
    location.href = `reservas.html?pagar=${r.reserva_id}`;
  } catch (err) { // HU-06 esc. 3: solapamiento → sugerir similares
    let msj = err.message;
    if (err.datos?.similares?.length)
      msj += '<br>Habitaciones similares: ' + err.datos.similares
        .map(s => `${s.pension} (${s.codigo}, ${cop(s.tarifa)})`).join(' · ');
    aviso('s-mensaje', 'error', msj);
  }
});

// HU-10: publicar reseña
document.getElementById('form-resena').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const r = await API.post('/resenas', {
      pension_id: +idPension,
      estrellas: +document.getElementById('r-estrellas').value,
      comentario: document.getElementById('r-comentario').value,
    });
    aviso('mensaje', 'ok', r.mensaje); cargar();
  } catch (err) { aviso('mensaje', 'error', err.message); }
});

// Visor de imágenes
function abrirVisor(src) {
  document.getElementById('visor-img').src = src;
  document.getElementById('visor').classList.add('abierto');
}
document.getElementById('visor').addEventListener('click', (e) => e.currentTarget.classList.remove('abierto'));

cargar();
