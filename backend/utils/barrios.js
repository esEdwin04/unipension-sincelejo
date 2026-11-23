// =============================================================
// Barrios de Sincelejo (zona urbana) para los menús desplegables del catálogo y del editor.
// Fuentes: barrios nombrados por El Heraldo (corte de energía del 17-03-2024, más de 120 barrios),
// nombres de OpenStreetMap usados por el mapa de la plataforma y barrios legalizados recientemente
// (La Paz, Normandía, La Campiña, Antonio Nariño). Se excluyen «invasiones» y «sectores».
// No es exhaustiva: el editor ofrece «Otro barrio» con validación de formato.
// =============================================================
const BARRIOS = [
  '2 de Septiembre', '6 de Enero', '6 de Febrero', '20 de Enero', '28 de Mayo',
  'Alfonso López', 'Altos del Rosario', 'Antonio Nariño', 'Argelia', 'Barlovento', 'Bellavista', 'Bololó', 'Bolívar',
  'Boston', 'Botero', 'Buenos Aires', 'California', 'Camilo Torres', 'Centro', 'Cerrito Colorado', 'Chacurí',
  'Cielo Azul', 'Ciudad Caribe', 'Ciudad Jardín', 'Ciudad Satélite', 'Ciudadela Suiza', 'Ciudadela Universitaria',
  'Corea', 'Divino Salvador', 'Dulce Nombre', 'El Bongo', 'El Bosque', 'El Cairo', 'El Caribe', 'El Cortijo',
  'El Encanto', 'El Mirador', 'El Pinar', 'El Rosario', 'El Rubí', 'El Zumbado', 'Gaitán', 'Incora',
  'José Germán', 'La Bucaramanga', 'La Campiña', 'La Esperanza', 'La Estrella', 'La Fe', 'La Ford',
  'La Independencia', 'La María', 'La Pajuela', 'La Palma', 'La Paz', 'La Pollita', 'La Selva', 'La Vega',
  'Las Américas', 'Las Brisas', 'Las Canarias', 'Las Candelarias', 'Las Colinas', 'Las Delicias', 'Las Margaritas',
  'Las Mercedes', 'Los Alpes', 'Los Andes', 'Los Bosques', 'Los Laureles', 'Los Libertadores', 'Los Tejares',
  'Majagual', 'Media Luna', 'Minuto de Dios', 'Mochila', 'Narcisa', 'Normandía', 'Nuevo México', 'Pablo VI',
  'Panorama', 'Paraíso', 'Pasacorriendo', 'Pioneros', 'Pontevedra', 'Porvenir', 'Puerta Roja', 'Punto Norte',
  'Rita de Arrazola', 'San Francisco', 'San Jorge', 'San José', 'San Luis', 'San Rafael', 'San Roque',
  'Santa Catalina', 'Santa Fe', 'Sevilla', 'Sierra Flor', 'Tacaloa', 'Tamaralandia', 'Tierra Grata', 'Tierra Linda',
  'Todopoderoso', 'Uribe Uribe', 'Urbanización Central', 'Vallejo', 'Venecia', 'Vida', 'Villa Ángela',
  'Villa Carmela', 'Villa Carmen', 'Villa Country', 'Villa Natalia', 'Villa Orieta', 'Villa Rosario', 'Villa Suiza',
].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));

const sinTildes = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const INDICE = new Map(BARRIOS.map((b) => [sinTildes(b), b]));

// Devuelve el nombre oficial de la lista (corrige mayúsculas y tildes) o null si no está
const barrioDeLista = (texto) => INDICE.get(sinTildes(texto)) || null;

module.exports = { BARRIOS, barrioDeLista };
