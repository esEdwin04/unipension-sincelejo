# Manual de usuario — UniPensión Sincelejo

Versión 0.3.0 · Proyecto académico de Ingeniería de Software (CECAR)

UniPensión reúne en un solo sitio las pensiones universitarias verificadas de Sincelejo. Los estudiantes buscan, comparan, reservan y pagan un cupo. Los propietarios publican y administran su oferta. El administrador verifica cada publicación antes de que aparezca en el catálogo.

> En el modo de demostración todos los datos son ficticios y el pago es una simulación: no se cobra dinero real.

## Contenido

1. [Primeros pasos](#1-primeros-pasos)
2. [Estudiante](#2-estudiante)
3. [Propietario](#3-propietario)
4. [Administrador](#4-administrador)
5. [Perfil (todos los roles)](#5-perfil-todos-los-roles)
6. [Preguntas frecuentes](#6-preguntas-frecuentes)

---

## 1. Primeros pasos

### 1.1. Entrar a la aplicación

Abre la dirección de UniPensión en el navegador del celular o del computador. Verás la pantalla de **Bienvenida** con dos opciones: **Iniciar sesión** y **Crear cuenta**. Si solo quieres mirar, usa **Explorar pensiones sin cuenta**: puedes ver el catálogo y las fichas, pero para contactar o reservar debes iniciar sesión.

### 1.2. Crear una cuenta (2 pasos)

1. **Elige tu rol:** *Estudiante* (buscas dónde vivir) o *Propietario* (arriendas habitaciones).
2. **Completa tus datos:**
   - Nombre, correo y WhatsApp colombiano (+57).
   - Contraseña de al menos 8 caracteres con una mayúscula, una minúscula y un número.
   - Estudiante: institución donde estudias. Propietario: documento (en demostración debe empezar por `DEMO-`) y tu relación con el inmueble.
   - Marca la aceptación de la **política de tratamiento de datos**. Puedes leerla antes de aceptar.

### 1.3. Iniciar sesión y recuperar la contraseña

Escribe tu correo y contraseña. Con **Mostrar** ves lo que escribiste. En el modo de demostración aparecen accesos rápidos:

| Rol | Correo | Clave |
|---|---|---|
| Estudiante | estudiante@unipension.co | est123 |
| Propietario | propietaria@unipension.co | prop123 |
| Administrador | admin@unipension.co | admin123 |

**¿Olvidaste tu contraseña?** registra la solicitud. El envío del enlace por correo todavía no está disponible, y la pantalla lo indica.

### 1.4. Moverse por la aplicación

La navegación cambia según tu rol: en el computador aparece debajo de la cabecera y en el celular como barra inferior. Tocando tu foto (arriba a la derecha) abres tu perfil. Si usas el teclado, la primera tecla **Tab** muestra **Saltar al contenido**.

---

## 2. Estudiante

Menú: **Inicio · Buscar · Reservas · Perfil**

### 2.1. Inicio

Tiene un buscador, la institución que tomas como referencia (**Cambiar** abre tu perfil), pensiones sugeridas y los pasos para reservar. **Ver catálogo** abre la búsqueda.

### 2.2. Buscar una pensión

1. Escribe en el buscador un barrio, una universidad, un servicio o el nombre de una pensión. No importa si usas tildes.
2. Toca el botón de **filtros** para afinar:
   - **Universidad cercana** (muestra la distancia en línea recta y permite ordenar por cercanía)
   - **Barrio**, **precio mínimo y máximo**, **tipo de habitación** (individual o compartida)
   - **Fecha de ingreso** y **meses de estadía**: la fecha no puede ser anterior a hoy y los meses van de 1 a 12
   - **Servicios incluidos**: la pensión debe tener *todos* los que marques
   - **Orden**: más recientes, menor o mayor precio, mejor calificadas o más cercanas
3. Pulsa **Aplicar filtros**. Cada filtro aparece como una etiqueta encima de los resultados; tócala para quitarlo, o usa **Limpiar filtros**.
4. Cambia entre **Lista** y **Mapa**. En el mapa, cada pin muestra el precio y los pines cercanos se agrupan. Toca un punto para usarlo como referencia de distancia.
5. **Usar mi ubicación** pide permiso al navegador. La ubicación solo se usa durante la búsqueda; no se guarda ni se comparte.

Se muestran 12 pensiones por página. Solo aparecen pensiones verificadas y con cupos; las del plan Destacado salen primero, siempre que cumplan tus filtros.

> Mientras el servidor no tenga lista la consulta por periodo, el filtro por fecha de ingreso muestra un aviso y deja ver todas las pensiones con cupos hoy.

### 2.3. Ficha de la pensión

- **Galería:** toca la foto principal para ampliarla; ciérrala con la **X**, con la tecla **Esc** o tocando fuera de la imagen.
- Precio, depósito, disponibilidad, servicios, reglas de convivencia, costos adicionales, mapa y distancias a las universidades.
- **Contactar por WhatsApp:** abre WhatsApp con un mensaje listo. Si el propietario no autorizó su número, verás una vista previa del mensaje.
- **Reportar información:** si algo no coincide con la realidad, elige un motivo y envíalo. Solo puedes tener un reporte activo por pensión.
- **Reseñas:** calificación de 1 a 5 estrellas y comentarios de otros estudiantes.

### 2.4. Reservar y pagar

1. En la ficha, elige la **habitación**, la **fecha de ingreso** y los **meses**, y envía la solicitud.
2. El cupo queda **bloqueado 30 minutos**. Ve a **Reservas** y pulsa **Pagar ahora**.
3. Elige el medio de pago (PSE, tarjeta o Nequi). En la demostración puedes simular un pago aprobado o rechazado.
4. Con el pago aprobado recibes un **comprobante en PDF** con número consecutivo (**Descargar PDF**).
5. El propietario tiene **48 horas** para aceptar o rechazar. Si rechaza, el cupo se libera y se registra la reversión del pago. Si no responde a tiempo, la solicitud se cancela sola.

Mientras no hayas pagado puedes **Cancelar solicitud**.

### 2.5. Mis reservas y reseñas

**Reservas** muestra tus solicitudes vigentes y el historial, con su estado, el valor y el comprobante. También ves las notificaciones de la plataforma. Cuando termine tu estadía, pulsa **Finalizar estadía**: desde ese momento puedes dejar una reseña de la pensión.

---

## 3. Propietario

Menú: **Inicio · Mis pensiones · Solicitudes · Perfil**

### 3.1. Inicio

Muestra cuántas pensiones tienes, cuántas están visibles, cuántas en revisión y cuántos cupos libres hay. También explica los planes: el **Básico** es gratuito y el **Destacado** lo activa el administrador.

### 3.2. Publicar una pensión (3 pasos)

1. **Tu pensión y su ubicación:** título, descripción, dirección y barrio. Marca el punto en el mapa y confirma que corresponde a la pensión.
2. **Cupos, precio y convivencia:** capacidad total, cupos disponibles, tipo de habitación, precio mensual, depósito, costos adicionales, servicios incluidos y reglas de convivencia.
3. **Fotografías y revisión:** de 1 a 5 fotos JPG, PNG o WebP. Se comprimen en el navegador antes de enviarse.

El editor guarda un **borrador automático**: si sales, al volver puedes **Continuar borrador** o **Descartar**. Toda pensión nueva queda **Pendiente** hasta que el administrador la apruebe.

### 3.3. Mis pensiones

Cada tarjeta muestra dos estados independientes:

| Estado de moderación | Qué significa |
|---|---|
| Pendiente | En revisión; aún no aparece en el catálogo |
| Verificada | Aprobada; aparece si tiene cupos |
| Rechazada | Necesita correcciones; al editarla vuelve a revisión (se muestra el motivo) |
| Oculta | Retirada del catálogo; solo el administrador puede restaurarla |

Acciones: **Ver detalle**, **Editar pensión**, **Actualizar cupos** y **Marcar ocupada**.

Al editar una pensión verificada, los cambios de tarifa, servicios, descripción, reglas y cupos se publican de inmediato. Los cambios de título, dirección, barrio, ubicación o fotos la devuelven a **Pendiente**. Si hay reservas vigentes, la dirección no se puede cambiar.

### 3.4. Solicitudes de reserva

Aquí llegan las solicitudes ya pagadas. Respóndelas en menos de **48 horas**:

- **Aceptar:** confirma la reserva al estudiante.
- **Rechazar:** escribe el motivo (se le notifica al estudiante). El cupo se libera y se registra la reversión del pago.

---

## 4. Administrador

Menú: **Resumen · Publicaciones · Reportes · Auditoría · Perfil**

### 4.1. Resumen

Contadores de pensiones pendientes, ocultas y destacadas, reportes activos, contactos por WhatsApp y pagos aprobados. Cada contador abre la vista filtrada correspondiente.

### 4.2. Publicaciones (moderación)

Filtra por estado: Pendientes, Verificadas, Rechazadas, Ocultas, Plan Destacado o Todas. Revisa el detalle antes de decidir.

| Acción | Efecto | ¿Pide motivo? |
|---|---|---|
| Aprobar | La pensión pasa a Verificada | No |
| Rechazar | El propietario debe corregirla | Sí |
| Ocultar | Sale del catálogo; las reservas vigentes se conservan | Sí |
| Revisar y restaurar | Vuelve a estar visible y resuelve los reportes atendidos | Sí |
| Plan Destacado | Da prioridad en el catálogo; no la publica por sí solo | No |

Cada decisión queda en la **bitácora** y se notifica al propietario.

### 4.3. Reportes

Lista los reportes de información que envían los estudiantes. Cada estudiante puede tener un reporte activo por pensión. Cuando **tres estudiantes distintos** reportan la misma pensión, esta se **oculta automáticamente** hasta que la revises.

### 4.4. Auditoría

- **Trazabilidad:** todas las reservas y pagos. Puedes filtrar por texto y fechas y **Exportar CSV**. En las filas con comprobante:
  - **Reenviar comprobante:** vuelve a enviar el PDF al estudiante.
  - **Anular:** pide el motivo (mínimo 10 caracteres) y deja el comprobante anulado. No se puede deshacer.
  - Si la pantalla dice que la acción todavía no está disponible en el servidor, es porque esa función aún está en desarrollo.
- **Ocupación:** porcentaje de ocupación y arriendo promedio por barrio, y las pensiones más solicitadas.
- **Reseñas reportadas:** **Restaurar** u **Ocultar definitivamente**.
- **Bitácora:** historial de las decisiones de moderación, con su motivo y quién la tomó.

---

## 5. Perfil (todos los roles)

- **Mi perfil / Editar:** foto (se comprime antes de guardarse), nombre, teléfono y datos de tu rol. El estudiante registra institución, programa y ciudad de origen. El propietario registra su presentación pública y si autoriza el contacto por WhatsApp.
- **Cambiar contraseña:** pide la contraseña actual y la nueva dos veces.
- **Privacidad:** muestra la versión de la política que aceptaste y la fecha. Si hay una versión nueva, pulsa **Aceptar política actual**.
- **Cerrar sesión.**

El correo y el documento del propietario son privados: no aparecen en los anuncios ni en los enlaces de contacto.

---

## 6. Preguntas frecuentes

**No encuentro una pensión que sí existe.** Solo se muestran pensiones verificadas y con cupos. Quita filtros con **Limpiar filtros**.

**El botón «Usar mi ubicación» no funciona.** El navegador necesita permiso y una conexión segura (HTTPS). Si lo negaste, habilítalo en la configuración del navegador o toca un punto en el mapa.

**Pagué, pero la reserva no está confirmada.** Después del pago, el propietario tiene 48 horas para aceptarla. El estado aparece en **Reservas** y en las notificaciones.

**No me deja dejar una reseña.** Las reseñas se habilitan cuando la estadía está finalizada.

**¿Se cobra dinero real?** No. En esta versión el pago es una simulación.
