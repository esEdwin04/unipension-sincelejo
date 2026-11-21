// =============================================================
// Cliente del API REST — compartido por todas las páginas
// =============================================================
async function pedir(ruta, opciones = {}) {
  const res = await fetch('/api' + ruta, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...opciones,
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(datos.error || 'Error de red'), { datos, status: res.status });
  return datos;
}

export const API = {
  get: (r) => pedir(r),
  post: (r, body) => pedir(r, { method: 'POST', body }),
  put: (r, body) => pedir(r, { method: 'PUT', body }),
  patch: (r, body) => pedir(r, { method: 'PATCH', body }),
};

export const cop = (v) => '$' + Number(v).toLocaleString('es-CO');
export const estrellas = (c) =>
  c ? '★'.repeat(Math.round(c)) + '☆'.repeat(5 - Math.round(c)) + ` ${c}` : 'Sin calificaciones';
