// -------------------------------------------------------------------------
// Reglas de validación compartidas por las rutas del API
// (tomadas del prototipo inicial y de los criterios de aceptación)
// -----------------------------------------------------------------------

// Modo demostración (por defecto): cuentas de acceso rápido y documentos ficticios con prefijo DEMO-.
// En producción con usuarios reales se desactiva con MODO_DEMO=false. Se lee en cada llamada.
const modoDemo = () => process.env.MODO_DEMO !== 'false';

const correoValido = (c) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(c || '').trim());

// Mínimo 8 caracteres con mayúscula, minúscula y número
const claveSegura = (c) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(String(c || ''));

// Celular colombiano: 10 dígitos que empiezan por 3. Devuelve +57XXXXXXXXXX o null
function normalizarCelular(valor) {
  const digitos = String(valor || '').replace(/\D/g, '').replace(/^0057/, '57');
  const local = digitos.startsWith('57') && digitos.length === 12 ? digitos.slice(2) : digitos;
  return /^3\d{9}$/.test(local) ? `+57${local}` : null;
}

// Texto sin tildes y en minúsculas, para búsquedas que no distinguen acentos
const normalizar = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Documento del propietario (privado, nunca se publica).
// Demo: identificador ficticio DEMO-…  ·  Real: cédula (6 a 10 dígitos) o CE/pasaporte (5 a 15 letras y números)
const limpiarDocumento = (d) => String(d || '').replace(/[.\s-]/g, '').toUpperCase();
function documentoValido(d) {
  if (modoDemo()) return String(d || '').startsWith('DEMO-');
  const x = limpiarDocumento(d);
  return /^\d{6,10}$/.test(x) || /^(?=.*\d)[A-Z0-9]{5,15}$/.test(x);
}
const mensajeDocumento = () => (modoDemo()
  ? 'No uses un documento real. Escribe un identificador ficticio DEMO-.'
  : 'Escribe tu número de cédula (6 a 10 dígitos) o de cédula de extranjería / pasaporte.');

// ---------- Reglas de formato para los campos de texto ----------
// Las mismas reglas se aplican en el navegador (client/src/validacion.js) para avisar antes de enviar.
const LETRAS = "A-Za-zÁÉÍÓÚÜÑáéíóúüñ";
// Nombre de persona: al menos nombre y apellido, solo letras, espacios, apóstrofo, punto o guion
const RE_NOMBRE = new RegExp(`^[${LETRAS}]+(?:[ '.-][${LETRAS}]+)+$`);
const nombreValido = (n) => { const t = String(n || '').trim().replace(/\s+/g, ' '); return t.length >= 5 && t.length <= 80 && RE_NOMBRE.test(t); };
// Dirección colombiana: «Cra 21 # 25-14», «Cll 28 # 18-30», «Calle 23B #19-40 Apto 2», «Mz 3 Lt 5»
const RE_VIA = /^(calle|cll|cl|carrera|cra|kra|kr|cr|transversal|tv|tr|diagonal|dg|avenida|av|circular|cq)\.?\s*\d{1,3}\s*[a-z]?(\s*bis\s*[a-z]?)?\s*(#|no\.?|n°|nº)\s*\d{1,3}\s*[a-z]?\s*-\s*\d{1,3}[a-z0-9 ,.#°º-]{0,40}$/i;
const RE_MANZANA = /^(mz|manzana)\.?\s*[a-z0-9]{1,4}\s*(lt|lote|casa|cs)\.?\s*\d{1,4}[a-z0-9 ,.-]{0,40}$/i;
const direccionValida = (d) => { const t = String(d || '').trim().replace(/\s+/g, ' '); return RE_VIA.test(t) || RE_MANZANA.test(t); };
// Texto libre: longitud y sin caracteres de control ni etiquetas HTML
const textoValido = (t, min, max) => { const x = String(t ?? '').trim(); return x.length >= min && x.length <= max && !/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(x); };
// Barrio fuera de la lista («Otro barrio»): letras, números y espacios, 3 a 40 caracteres
const RE_BARRIO_LIBRE = new RegExp(`^[${LETRAS}0-9][${LETRAS}0-9 .'-]{2,39}$`);
// Ubicación dentro del área urbana de Sincelejo (con margen)
const enSincelejo = (lat, lng) => lat >= 9.22 && lat <= 9.38 && lng >= -75.48 && lng <= -75.32;
const LIMITES = { tarifaMin: 100000, tarifaMax: 3000000, capacidadMax: 30, mesesMax: 12 };

// Servicios que el estudiante puede filtrar (mismos del prototipo)
const SERVICIOS = ['Alimentación', 'Lavandería', 'Internet', 'Agua', 'Energía', 'Cocina', 'Baño privado', 'Espacio de estudio'];

const RELACIONES = ['Propietario', 'Persona autorizada', 'Persona autorizada para arrendar', 'Persona autorizada para subarrendar'];

module.exports = {
  modoDemo, correoValido, claveSegura, normalizarCelular, normalizar, documentoValido, mensajeDocumento,
  nombreValido, direccionValida, textoValido, RE_BARRIO_LIBRE, enSincelejo, LIMITES, SERVICIOS, RELACIONES,
};
