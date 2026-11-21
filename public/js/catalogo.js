// =============================================================
// Catálogo público con filtros (HU-04)
// Responsable: Desarrollador Frontend
// =============================================================
pintarNav('index.html');

async function cargarOpciones() {
  const [barrios, unis] = await Promise.all([
    API.get('/pensiones/barrios'), API.get('/pensiones/universidades')
  ]);
  document.getElementById('f-barrio').innerHTML =
    '<option value="">Todos</option>' + barrios.map(b => `<option>${b.barrio}</option>`).join('');
  document.getElementById('f-uni').innerHTML =
    '<option value="">Ninguna</option>' + unis.map(u => `<option value="${u.id}">${u.nombre}</option>`).join('');
}

async function buscar() {
  const q = new URLSearchParams();
  const v = (id) => document.getElementById(id).value;
  if (v('f-barrio')) q.set('barrio', v('f-barrio'));
  if (v('f-min'))    q.set('precio_min', v('f-min'));
  if (v('f-max'))    q.set('precio_max', v('f-max'));
  if (v('f-tipo'))   q.set('tipo', v('f-tipo'));
  if (v('f-uni'))    q.set('universidad_id', v('f-uni'));
  if (v('f-dist'))   q.set('dist_max', v('f-dist'));

  const lista = await API.get('/pensiones?' + q.toString());
  const cont = document.getElementById('catalogo');
  document.getElementById('mensaje').innerHTML = '';

  if (!lista.length) { // Criterio HU-04 esc. 3
    cont.innerHTML = '';
    aviso('mensaje', 'info', 'Sin resultados para los filtros seleccionados. Intente ampliar el rango de búsqueda.');
    return;
  }
  cont.innerHTML = lista.map(p => `
    <a class="tarjeta-pension" href="pension.html?id=${p.id}">
      <div class="foto"><img src="${p.foto || 'img/placeholder1.svg'}" alt="Foto de ${p.nombre}"></div>
      <div class="cuerpo">
        <strong>${p.nombre}</strong>
        <span class="suave">Barrio ${p.barrio}${p.distancia_km != null ? ' · a ' + p.distancia_km + ' km' : ''}</span>
        <span class="estrellas">${estrellas(p.calificacion)}</span>
        <span class="precio">${cop(p.tarifa_mensual)} / mes</span>
        <span class="suave">${p.habitaciones_libres} habitación(es) disponible(s)</span>
      </div>
    </a>`).join('');
}

document.getElementById('form-filtros').addEventListener('submit', (e) => { e.preventDefault(); buscar(); });
document.getElementById('btn-limpiar').addEventListener('click', () => { // HU-04 esc. 4
  document.getElementById('form-filtros').reset(); buscar();
});

cargarOpciones().then(buscar);
