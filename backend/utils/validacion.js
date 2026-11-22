// =============================================================
// Reglas de validación compartidas por las rutas del API
// (tomadas del prototipo inicial y de los criterios de aceptación)
// =============================================================

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

// Servicios que el estudiante puede filtrar (mismos del prototipo)
const SERVICIOS = ['Alimentación', 'Lavandería', 'Internet', 'Agua', 'Energía', 'Cocina', 'Baño privado', 'Espacio de estudio'];

const RELACIONES = ['Propietario', 'Persona autorizada', 'Persona autorizada para arrendar', 'Persona autorizada para subarrendar'];

module.exports = { modoDemo, correoValido, claveSegura, normalizarCelular, normalizar, documentoValido, mensajeDocumento, SERVICIOS, RELACIONES };
