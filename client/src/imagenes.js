// =============================================================
// Compresión de fotografías en el navegador antes de enviarlas al API
// (evita subir archivos de varios MB; mismo enfoque del prototipo inicial)
// =============================================================
const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];

function cargarImagen(src) {
  return new Promise((ok, falla) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => falla(new Error('No se pudo leer la fotografía.'));
    img.src = src;
  });
}

function redimensionar(img, lado, calidad) {
  const escala = Math.min(1, lado / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round((img.naturalWidth || img.width) * escala);
  lienzo.height = Math.round((img.naturalHeight || img.height) * escala);
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('El navegador no permite comprimir imágenes.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
  return lienzo.toDataURL('image/jpeg', calidad);
}

// Archivo → data URL JPEG comprimida (lado mayor `lado` px)
export async function comprimirFoto(archivo, lado = 1200, calidad = 0.72) {
  if (!TIPOS.includes(archivo.type)) throw new Error('Selecciona una imagen JPG, PNG o WebP.');
  if (archivo.size > 12 * 1024 * 1024) throw new Error('Cada fotografía debe pesar menos de 12 MB.');
  const url = URL.createObjectURL(archivo);
  try {
    return redimensionar(await cargarImagen(url), lado, calidad);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Miniatura liviana para el catálogo (las rutas /img/ se usan tal cual)
export async function miniatura(src) {
  if (!src || src.startsWith('/img/')) return src || null;
  return redimensionar(await cargarImagen(src), 480, 0.65);
}

export const FOTOS_REFERENCIA = ['/img/placeholder1.svg', '/img/placeholder2.svg', '/img/placeholder3.svg'];
