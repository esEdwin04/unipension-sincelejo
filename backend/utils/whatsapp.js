// =============================================================
// Notificaciones por WhatsApp (RF-15) con la WhatsApp Cloud API de Meta.
// Responsable: Desarrollador Backend
//
// Variables de entorno (en Vercel; nunca en GitHub):
//   WHATSAPP_TOKEN            token de acceso de la app de Meta (System User o temporal)
//   WHATSAPP_PHONE_NUMBER_ID  ID del número que envía (WhatsApp → API Setup)
//   WHATSAPP_API_VERSION      versión de la Graph API (por defecto v26.0)
//   WHATSAPP_IDIOMA           idioma de las plantillas aprobadas (por defecto es)
//   WHATSAPP_PLANTILLA_PRUEBA si vale hello_world, envía esa plantilla de Meta en todos los
//                             eventos: sirve para probar la conexión antes de aprobar las propias
//
// Sin WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID funciona en MODO SIMULADO: no envía nada,
// pero registra el mensaje que se habría enviado en la tabla mensajes_whatsapp.
//
// Reglas de Meta que respeta este módulo:
// - Los mensajes que inicia la empresa deben usar plantillas aprobadas (categoría Utilidad).
// - Solo se escribe a usuarios que aceptaron recibir avisos (columna avisos_whatsapp = opt-in).
// =============================================================
const db = require('../db');
const { normalizarCelular } = require('./validacion');

const config = () => ({
  token: process.env.WHATSAPP_TOKEN,
  numeroId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  version: process.env.WHATSAPP_API_VERSION || 'v26.0',
  idioma: process.env.WHATSAPP_IDIOMA || 'es',
  prueba: process.env.WHATSAPP_PLANTILLA_PRUEBA,
});
const modo = () => { const c = config(); return c.token && c.numeroId ? 'real' : 'simulado'; };

// Plantillas que deben crearse y aprobarse en Meta con este nombre y este texto exactos
// (docs/WHATSAPP.md). {{n}} son los parámetros, en orden. Meta no permite que el texto
// empiece o termine con una variable.
const PLANTILLAS = {
  unipension_solicitud_nueva:
    'Hola {{1}}, tienes una nueva solicitud pagada (#{{2}}) para «{{3}}». Respóndela en UniPensión en las próximas 48 horas o se cancelará.',
  unipension_pago_aprobado:
    'Hola {{1}}, tu pago de la reserva #{{2}} en «{{3}}» fue aprobado (comprobante {{4}}). El propietario tiene 48 horas para responder.',
  unipension_reserva_aceptada:
    'Hola {{1}}, tu reserva #{{2}} en «{{3}}» fue aceptada. El propietario te contactará para coordinar tu ingreso.',
  unipension_reserva_rechazada:
    'Hola {{1}}, tu reserva #{{2}} en «{{3}}» fue rechazada. Motivo: {{4}}. El pago será revertido.',
  unipension_reserva_cancelada:
    'Hola {{1}}, tu solicitud #{{2}} en «{{3}}» se canceló porque el propietario no respondió en 48 horas. El pago será revertido.',
  unipension_publicacion_estado:
    'Hola {{1}}, tu pensión «{{2}}» ahora está {{3}}. Detalle: {{4}}. Revisa tu panel en UniPensión.',
};

const rellenar = (plantilla, params) => PLANTILLAS[plantilla].replace(/\{\{(\d+)\}\}/g, (_m, n) => params[n - 1] ?? '');
// Meta rechaza parámetros vacíos, con saltos de línea o con más de 4 espacios seguidos
const limpiar = (v) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim().slice(0, 300) || '—';

async function registrar(fila) {
  try {
    await db.prepare(`INSERT INTO mensajes_whatsapp (usuario_id, telefono, plantilla, texto, estado, detalle, wamid)
      VALUES (?,?,?,?,?,?,?)`).run(fila.usuario_id, fila.telefono, fila.plantilla, fila.texto, fila.estado, fila.detalle, fila.wamid);
  } catch (err) { console.error('No se pudo registrar el mensaje de WhatsApp:', err.message); }
}

// Cómo se nombra cada estado de moderación en los avisos (la interfaz muestra «Oculta» para Suspendida)
const ESTADO_VISIBLE = {
  Verificada: 'aprobada y visible si tiene cupos', Rechazada: 'rechazada',
  Suspendida: 'oculta del catálogo', Pendiente: 'en revisión',
};

// Envía una plantilla a un número (+57…). Devuelve { estado, detalle, wamid }. Nunca lanza errores.
// { prueba: true } envía la plantilla hello_world de Meta (para comprobar la conexión).
async function enviarPlantilla(telefono, plantilla, params, { prueba = false } = {}) {
  const c = config();
  if (modo() === 'simulado') return { estado: 'Simulado', detalle: 'Sin credenciales de Meta: no se envió.' };
  const template = prueba || c.prueba === 'hello_world'
    ? { name: 'hello_world', language: { code: 'en_US' } }
    : { name: plantilla, language: { code: c.idioma },
        components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }] };
  const control = new AbortController();
  const limite = setTimeout(() => control.abort(), 5000); // no retrasar la respuesta del API más de 5 s
  try {
    const r = await fetch(`https://graph.facebook.com/${c.version}/${c.numeroId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: telefono.replace(/\D/g, ''), type: 'template', template }),
      signal: control.signal,
    });
    const datos = await r.json().catch(() => ({}));
    if (!r.ok) return { estado: 'Error', detalle: `${r.status} ${datos.error?.code ?? ''} ${datos.error?.message ?? ''}`.trim().slice(0, 500) };
    return { estado: 'Enviado', detalle: template.name === 'hello_world' ? 'Plantilla de prueba hello_world' : null, wamid: datos.messages?.[0]?.id };
  } catch (err) {
    return { estado: 'Error', detalle: err.name === 'AbortError' ? 'Meta no respondió en 5 s' : err.message };
  } finally {
    clearTimeout(limite);
  }
}

// Avisa a un usuario de UniPensión si aceptó los avisos y tiene un celular válido.
async function avisar(usuarioId, plantilla, params) {
  if (!PLANTILLAS[plantilla]) throw new Error(`Plantilla de WhatsApp desconocida: ${plantilla}`);
  const u = await db.prepare('SELECT id, nombre, telefono, avisos_whatsapp FROM usuarios WHERE id = ?').get(usuarioId);
  if (!u) return null;
  const valores = [String(u.nombre).split(' ')[0], ...params].map(limpiar);
  const texto = rellenar(plantilla, valores);
  const telefono = normalizarCelular(u.telefono);
  const base = { usuario_id: u.id, telefono, plantilla, texto, wamid: null };
  if (!u.avisos_whatsapp) return registrar({ ...base, estado: 'Omitido', detalle: 'El usuario no aceptó avisos por WhatsApp.' });
  if (!telefono) return registrar({ ...base, estado: 'Omitido', detalle: 'Sin celular colombiano válido.' });
  const r = await enviarPlantilla(telefono, plantilla, valores);
  if (r.estado === 'Error') console.error(`WhatsApp (${plantilla}) → ${r.detalle}`);
  return registrar({ ...base, ...r });
}

// Varios avisos en paralelo; los fallos se registran y no interrumpen la operación principal.
// Se espera a que terminen antes de responder: en Vercel la función se congela al responder.
const avisarTodos = (avisos) => Promise.allSettled(avisos.map(([id, plantilla, params]) => avisar(id, plantilla, params)));

module.exports = { avisar, avisarTodos, enviarPlantilla, modo, PLANTILLAS, ESTADO_VISIBLE, rellenar };
