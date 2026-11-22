// =============================================================
// Reglas de validación compartidas por las rutas del API
// (tomadas del prototipo inicial y de los criterios de aceptación)
// =============================================================

// Modo demostración: exige documentos ficticios con prefijo DEMO- (no se guardan cédulas reales)
const MODO_DEMO = process.env.MODO_DEMO !== 'false';

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

const documentoValido = (d) => !MODO_DEMO || String(d || '').startsWith('DEMO-');

// Servicios que el estudiante puede filtrar (mismos del prototipo)
const SERVICIOS = ['Alimentación', 'Lavandería', 'Internet', 'Agua', 'Energía', 'Cocina', 'Baño privado', 'Espacio de estudio'];

const RELACIONES = ['Propietario', 'Persona autorizada', 'Persona autorizada para arrendar', 'Persona autorizada para subarrendar'];

module.exports = { MODO_DEMO, correoValido, claveSegura, normalizarCelular, normalizar, documentoValido, SERVICIOS, RELACIONES };
