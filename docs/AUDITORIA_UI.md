# Auditoría UI/UX y rediseño v0.5 — «Descubre tu lugar»

Fecha: noviembre de 2026 · Alcance: todas las pantallas de UniPensión (acceso, estudiante, propietario, administrador) a 375 px y 1280 px.
Método: revisión del sistema de estilos (`client/src/estilos.css`, 150 clases), capturas reales con Chrome emulando un celular de 375 px y un escritorio de 1280 px, y cálculo de contraste WCAG.

## 1. Hallazgos de la versión 0.4

| # | Hallazgo | Impacto | Severidad |
|---|---|---|---|
| 1 | Los precios en Cormorant Garamond usan números de estilo antiguo: en «$520.000» las cifras suben y bajan de la línea | Es el dato que más se compara y era el más difícil de leer | Alta |
| 2 | El texto «Ingresa para» del botón Contactar heredaba el gris de `.barra-fija span` sobre el fondo verde oscuro (≈ 2:1) | Ilegible en la llamada a la acción principal de la ficha | Alta |
| 3 | El foco visible era menta al 45 % (1,45:1) y el de los campos, menta (2,48:1) | Incumple WCAG 2.4.7 y 1.4.11: quien navega con teclado no ve dónde está | Alta |
| 4 | El texto secundario `--niebla` daba 4,29:1 sobre los bloques alternos | Incumple WCAG 1.4.3 | Media |
| 5 | El botón de volver de la ficha tenía `autoFocus` y aparecía con el anillo de foco encendido al cargar | Ruido visual en cada visita | Media |
| 6 | Tarjetas idénticas, sin jerarquía; el pie «Información declarada / Ver pensión» se repetía en cada tarjeta y solo el título era clicable | Difícil de escanear; objetivo táctil pequeño | Media |
| 7 | La portada del estudiante era un banner con un SVG genérico y una lista; no había forma de descubrir por barrio o universidad | La página no invitaba a explorar | Media |
| 8 | La bienvenida usaba una ilustración plana (barras grises como «ciudad») | No comunica qué ofrece la plataforma | Baja |
| 9 | La navegación de visitantes duplicaba «Iniciar sesión» (cabecera) e «Ingresar» (pestañas) | Redundancia | Baja |
| 10 | Sin enlace «Saltar al contenido» | Incumple WCAG 2.4.1 | Baja |
| 11 | El pie de página era una línea de texto sin enlaces | Final de página sin salida | Baja |

Nota de método: Chrome sin ventana impone un ancho mínimo cercano a 500 px. Las capturas «móviles» hechas así parecían desbordadas, pero era un artefacto: en un celular real de 375 px (emulación con DevTools) no hay desbordamiento horizontal.

## 2. Decisiones del rediseño

**Dirección visual.** Editorial y cálida, como una revista de vivienda: fondo papel (`#f8f5ef`), verde bosque como color de marca (`#0f3b33`), ámbar para destacados y la fotografía como protagonista.

**Tipografía.** Fraunces para los títulos y Plus Jakarta Sans para la interfaz.
- Fraunces es una serif moderna de eje óptico, con cifras alineadas (`lining-nums`): resuelve el hallazgo 1 sin perder el carácter editorial.
- Plus Jakarta Sans es legible en tamaños pequeños y en formularios.

**Contraste verificado (WCAG 2.2 AA).** Todas las combinaciones cumplen.

| Combinación | Contraste |
|---|---|
| Texto principal sobre papel | 15,2:1 |
| Texto secundario (`--niebla`) sobre papel / papel alterno / blanco | 5,4 / 4,95 / 5,9:1 |
| Etiquetas verdes (`--ok`) sobre papel y sobre su chip | 5,5 / 5,2:1 |
| Botón principal (blanco sobre bosque) | 12,4:1 |
| Insignia «Destacado» (texto sobre ámbar) | 7,5:1 |
| Anillo de foco sobre papel | 11,4:1 |
| Texto del pie y de «Cómo funciona» sobre bosque | 7,6 / 8,3:1 |

**Componentes.**
- **Botones:** en forma de píldora con altura mínima de 50 px.
- **Campos:** borde de 1,5 px y foco con halo.
- **Tarjeta de pensión:** toda la tarjeta es clicable con un solo enlace accesible. La calificación va en una insignia sobre la foto, el barrio arriba en mayúsculas pequeñas y el precio abajo, con cifras legibles. La foto hace un zoom suave al pasar el cursor.
- **Navegación:** en celular, barra inferior flotante; en escritorio, píldoras bajo la cabecera. La cabecera muestra una sombra al desplazarse.
- **Diálogos:** entran con una animación corta y el fondo se desenfoca.

**Inicio del estudiante (nuevo recorrido).** Portada con collage de fotos, buscador, atajos por universidad y cifras reales (pensiones, cupos libres, barrios) → Mejor valoradas → **Explora por barrio** (nuevo) → Pensiones para descubrir → Cómo funciona.

**Acceso.** En escritorio la fotografía ocupa la pantalla y el formulario entra como una hoja a la derecha. En celular, foto con el logotipo en tarjeta.

## 3. Efecto «descubrir» (aparición al hacer scroll)

Implementado en `client/src/componentes/revelar.js` y en las clases `.rv` / `.rv-visible` de `estilos.css`.

- **Automático:** registra solo los bloques de todas las páginas (tarjetas, bloques, paneles, estadísticas, pasos, barrios, ítems de perfil…), también los que llegan después de cargar, como los resultados del catálogo o la paginación.
- **En cascada:** los elementos que entran juntos aparecen escalonados cada 90 ms, de arriba abajo y de izquierda a derecha. Para otra animación se agrega `data-revelar="izquierda" | "derecha" | "zoom"` a cualquier elemento.
- **Sin efectos secundarios:** al terminar se quitan las clases, así no queda un `transform` que afecte a elementos *sticky* ni a las transiciones de *hover*. No se aplica dentro de diálogos ni del mapa.
- **Accesible y robusto:** con `prefers-reduced-motion` no hay animaciones. Sin JavaScript o sin `IntersectionObserver` todo se ve normal, porque la clase que oculta solo la pone el script.
- **Medido en el navegador:** en el inicio se registran 21 bloques; al recorrer la página aparecen todos y no queda ninguno oculto. En el catálogo, las 12 tarjetas que llegan después también se registran y aparecen.

## 4. Pendiente

- Ejecutar Lighthouse (Accesibilidad y Rendimiento) en modo móvil y registrar los puntajes; la meta de la actividad F4 es ≥ 90.
- Probar en un iPhone y un Android reales: barra inferior flotante con `safe-area-inset`, y scroll del buscador fijo del catálogo.
- La rama `fix/F4-accesibilidad-responsive` queda reemplazada por este rediseño: el foco, el contraste, el salto al contenido y el `autoFocus` ya están resueltos aquí. Solo conserva el visor de fotos con `<dialog>`, que se puede traer después.
