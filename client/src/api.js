// =============================================================
// Cliente del API REST — compartido por todas las páginas
// Los errores incluyen `campos` cuando el backend devuelve errores por campo.
// =============================================================
async function pedir(ruta, opciones = {}) {
  let res;
  try {
    res = await fetch('/api' + ruta, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      ...opciones,
      body: opciones.body ? JSON.stringify(opciones.body) : undefined,
    });
  } catch {
    throw Object.assign(new Error('No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.'), { status: 0, campos: {} });
  }
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(datos.error || 'Ocurrió un error inesperado'),
      { datos, status: res.status, campos: datos.campos || {} });
  }
  return datos;
}

export const API = {
  get: (r) => pedir(r),
  post: (r, body) => pedir(r, { method: 'POST', body }),
  put: (r, body) => pedir(r, { method: 'PUT', body }),
  patch: (r, body) => pedir(r, { method: 'PATCH', body }),
  del: (r) => pedir(r, { method: 'DELETE' }),
};

export const cop = (v) => '$' + Number(v || 0).toLocaleString('es-CO');
export const estrellas = (c) =>
  c ? '★'.repeat(Math.round(c)) + '☆'.repeat(5 - Math.round(c)) + ` ${String(c).replace('.', ',')}` : 'Sin calificaciones';
export const km = (d) => Number(d).toFixed(1).replace('.', ',');
export const cuposTexto = (n) => (n > 0 ? `${n} ${n === 1 ? 'cupo disponible' : 'cupos disponibles'}` : 'Sin cupos por ahora');
export const fecha = (t) => (t ? new Date(t.replace(' ', 'T')).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '');
export const primerNombre = (n) => String(n || '').split(' ')[0];

// Etiquetas de estado de moderación (HU-03): Pendiente · Verificada · Rechazada · Suspendida (oculta)
export const ETIQUETA_ESTADO = { Pendiente: 'Pendiente', Verificada: 'Verificada', Rechazada: 'Rechazada', Suspendida: 'Oculta' };
export const EXPLICA_ESTADO = {
  Pendiente: 'En revisión. No aparece en el catálogo hasta que administración la apruebe.',
  Verificada: 'Aprobada para publicación. Solo aparece si tiene cupos disponibles.',
  Rechazada: 'Necesita correcciones. Edítala y se enviará nuevamente a revisión.',
  Suspendida: 'Retirada preventivamente del catálogo. Solo administración puede restaurarla tras revisarla.',
};
