// =============================================================
// Reglas de los campos de texto en el navegador. Son las mismas del servidor
// (backend/utils/validacion.js): aquí sirven para avisar antes de enviar; el servidor
// vuelve a validar siempre.
// =============================================================
const LETRAS = 'A-Za-zÁÉÍÓÚÜÑáéíóúüñ';
const RE_NOMBRE = new RegExp(`^[${LETRAS}]+(?:[ '.-][${LETRAS}]+)+$`);
const RE_VIA = /^(calle|cll|cl|carrera|cra|kra|kr|cr|transversal|tv|tr|diagonal|dg|avenida|av|circular|cq)\.?\s*\d{1,3}\s*[a-z]?(\s*bis\s*[a-z]?)?\s*(#|no\.?|n°|nº)\s*\d{1,3}\s*[a-z]?\s*-\s*\d{1,3}[a-z0-9 ,.#°º-]{0,40}$/i;
const RE_MANZANA = /^(mz|manzana)\.?\s*[a-z0-9]{1,4}\s*(lt|lote|casa|cs)\.?\s*\d{1,4}[a-z0-9 ,.-]{0,40}$/i;
export const RE_BARRIO_LIBRE = new RegExp(`^[${LETRAS}0-9][${LETRAS}0-9 .'-]{2,39}$`);

const limpio = (t) => String(t ?? '').trim().replace(/\s+/g, ' ');
export const nombreValido = (n) => { const t = limpio(n); return t.length >= 5 && t.length <= 80 && RE_NOMBRE.test(t); };
export const direccionValida = (d) => { const t = limpio(d); return RE_VIA.test(t) || RE_MANZANA.test(t); };
export const textoValido = (t, min, max) => { const x = String(t ?? '').trim(); return x.length >= min && x.length <= max && !/[<>]/.test(x); };
export const enSincelejo = (lat, lng) => lat >= 9.22 && lat <= 9.38 && lng >= -75.48 && lng <= -75.32;
export const LIMITES = { tarifaMin: 100000, tarifaMax: 3000000, capacidadMax: 30 };

// Filtros de escritura: impiden teclear caracteres que el campo no admite
export const soloDigitos = (t, max) => String(t || '').replace(/\D/g, '').slice(0, max);
export const soloLetras = (t, max = 80) => String(t || '').replace(new RegExp(`[^${LETRAS} '.-]`, 'g'), '').replace(/\s{2,}/g, ' ').slice(0, max);
export const soloAlfanumerico = (t, max = 15) => String(t || '').replace(/[^A-Za-z0-9.-]/g, '').toUpperCase().slice(0, max);
// Celular: acepta que peguen «+57 300 123 4567» y deja solo los 10 dígitos
export const celular = (t) => soloDigitos(String(t || '').replace(/^\s*\+?57\s*/, ''), 10);

export const MENSAJES = {
  nombre: 'Escribe tu nombre y apellido, solo con letras (5 a 80 caracteres).',
  celular: 'Celular colombiano: 10 dígitos que empiecen por 3.',
  direccion: 'Usa el formato de Sincelejo, por ejemplo «Cra 21 # 25-14» o «Mz 3 Lt 5».',
};
