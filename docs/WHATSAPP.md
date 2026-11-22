# Avisos por WhatsApp (RF-15) — WhatsApp Cloud API de Meta

UniPensión envía avisos automáticos por WhatsApp cuando ocurre algo importante en una reserva o en una publicación.
El código está en `backend/utils/whatsapp.js`. Sin credenciales funciona en **modo simulado**: no envía nada y registra cada aviso en la tabla `mensajes_whatsapp`. Esos avisos se ven en *Administrador → Auditoría → WhatsApp*.

## Qué se envía y a quién

| Evento | Destinatario | Plantilla |
|---|---|---|
| Pago aprobado de una reserva | Propietario | `unipension_solicitud_nueva` |
| Pago aprobado de una reserva | Estudiante | `unipension_pago_aprobado` |
| Propietario acepta la solicitud | Estudiante | `unipension_reserva_aceptada` |
| Propietario rechaza la solicitud | Estudiante | `unipension_reserva_rechazada` |
| Solicitud cancelada por falta de respuesta en 48 h | Estudiante | `unipension_reserva_cancelada` |
| Moderación: aprobar, rechazar, ocultar, restaurar; ocultamiento automático por 3 reportes | Propietario | `unipension_publicacion_estado` |

Los avisos solo se envían a quien marcó en *Perfil → Editar* la casilla **«Quiero recibir avisos de UniPensión por WhatsApp»** y tiene un celular colombiano válido. Es el consentimiento (opt-in) que exige la política de WhatsApp Business. Si alguien no la marcó, el aviso queda en la bitácora como **Omitido**.

Las notificaciones dentro de la plataforma siguen funcionando igual; WhatsApp es un canal adicional. Si Meta falla o tarda más de 5 segundos, la operación principal (pago, aceptación, moderación) **no** se interrumpe y el aviso queda registrado como **Error**.

## Configuración en Meta (una sola vez)

1. **Crear la app:** en https://developers.facebook.com, *My Apps → Create App*, elegir el caso de uso **Connect with customers through WhatsApp** y asociar una cuenta de Meta Business (se crea gratis en el mismo paso).
2. **Número de prueba:** en *WhatsApp → API Setup*, Meta asigna un número de prueba gratuito. Copiar:
   - **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`
   - **Temporary access token** → `WHATSAPP_TOKEN` (dura 24 h; ver el paso 5 para uno permanente)
3. **Destinatarios de prueba:** en la misma página, en *To*, agregar y verificar con un código hasta **5 celulares** (los del equipo). En modo de prueba Meta rechaza cualquier otro número (error 131030).
4. **Plantillas:** en *WhatsApp Manager → Message templates → Create template*, crear cada plantilla de la tabla siguiente con categoría **Utility**, idioma **Spanish (es)**, el nombre exacto y el texto exacto. Meta suele aprobarlas en minutos. Si piden ejemplos para las variables, usar los de la columna «Ejemplo».
5. **Token permanente** (para producción): en *Business Settings → Users → System users*, crear un usuario de sistema con rol *Admin*, asignarle la app y la cuenta de WhatsApp, y generar un token con los permisos `whatsapp_business_messaging` y `whatsapp_business_management`.

| Nombre | Texto del cuerpo | Ejemplo de variables |
|---|---|---|
| `unipension_solicitud_nueva` | Hola {{1}}, tienes una nueva solicitud pagada (#{{2}}) para «{{3}}». Respóndela en UniPensión en las próximas 48 horas o se cancelará. | Carmen · 12 · Pensión La Ceiba |
| `unipension_pago_aprobado` | Hola {{1}}, tu pago de la reserva #{{2}} en «{{3}}» fue aprobado (comprobante {{4}}). El propietario tiene 48 horas para responder. | Luis · 12 · Pensión La Ceiba · UP-00012-48211 |
| `unipension_reserva_aceptada` | Hola {{1}}, tu reserva #{{2}} en «{{3}}» fue aceptada. El propietario te contactará para coordinar tu ingreso. | Luis · 12 · Pensión La Ceiba |
| `unipension_reserva_rechazada` | Hola {{1}}, tu reserva #{{2}} en «{{3}}» fue rechazada. Motivo: {{4}}. El pago será revertido. | Luis · 12 · Pensión La Ceiba · La habitación ya no está disponible |
| `unipension_reserva_cancelada` | Hola {{1}}, tu solicitud #{{2}} en «{{3}}» se canceló porque el propietario no respondió en 48 horas. El pago será revertido. | Luis · 12 · Pensión La Ceiba |
| `unipension_publicacion_estado` | Hola {{1}}, tu pensión «{{2}}» ahora está {{3}}. Detalle: {{4}}. Revisa tu panel en UniPensión. | Carmen · Pensión La Ceiba · aprobada y visible si tiene cupos · sin observaciones |

El texto de referencia está en `PLANTILLAS` (`backend/utils/whatsapp.js`). Si se cambia allí, hay que crear una plantilla nueva en Meta, porque las plantillas aprobadas no se editan libremente.

## Variables de entorno

| Variable | Obligatoria | Valor |
|---|---|---|
| `WHATSAPP_TOKEN` | Sí, para envío real | Token de acceso (temporal o del usuario de sistema) |
| `WHATSAPP_PHONE_NUMBER_ID` | Sí, para envío real | ID del número que envía |
| `WHATSAPP_API_VERSION` | No | Versión de la Graph API; por defecto `v26.0` |
| `WHATSAPP_IDIOMA` | No | Código de idioma de las plantillas; por defecto `es` |
| `WHATSAPP_PLANTILLA_PRUEBA` | No | `hello_world` envía la plantilla de ejemplo de Meta en todos los eventos, para probar mientras se aprueban las propias |

En local se ponen en `.env.local` (no se sube a GitHub). En producción se cargan en Vercel (*Settings → Environment Variables*) y luego hay que volver a desplegar.

## Cómo probar

1. Con las credenciales cargadas, entrar como administrador → *Auditoría → WhatsApp*. El aviso verde confirma la conexión.
2. Escribir un celular verificado en el paso 3 y pulsar **Enviar prueba**: llega el mensaje `hello_world` de Meta.
3. Con un estudiante que tenga ese celular y la casilla de avisos activa, reservar y pagar. Llega `unipension_pago_aprobado` y la bitácora lo muestra como **Enviado**.

Errores frecuentes en la bitácora:

| Código | Significado | Qué hacer |
|---|---|---|
| 131030 | El número no está en la lista de prueba | Verificarlo en *API Setup → To* |
| 132001 | La plantilla no existe en ese idioma | Revisar el nombre y que el idioma sea `es` |
| 132000 | Cantidad de parámetros distinta a la plantilla | Comparar el texto con la tabla de arriba |
| 190 | Token vencido o inválido | Generar otro token (el temporal dura 24 h) |

## Costos

El número de prueba y los mensajes a los 5 números verificados son gratis. En producción, Meta cobra cada plantilla de utilidad que se entrega, alrededor de 0,01 USD en Colombia. Los mensajes de servicio dentro de las 24 horas posteriores a que el usuario escriba son gratuitos. Hay que revisar la tarifa vigente en la página de precios de WhatsApp Business.
