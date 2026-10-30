# Informe de auditoría y rediseño

**Proyecto:** Catracho Coconut Ponche — tienda web académica  
**Ubicación:** `C:\Users\Jota Daniel\proyects\UNAH\Proyecto 2`  
**Fecha:** 29 de octubre de 2026  
**Alcance:** auditoría funcional, visual, de persistencia, seguridad, accesibilidad y rendimiento; rediseño de la experiencia de compra.

---

## 1. Resumen ejecutivo

Se reemplazó la interfaz anterior por una tienda con navegación superior, identidad visual más cuidada, animaciones discretas y un flujo completo de compra local:

- Catálogo con búsqueda, filtros, orden y favoritos.
- Registro, inicio de sesión, sesión persistente y cierre de sesión.
- Carrito persistente con cantidades, modificadores, cupones y entrega.
- Checkout de tres pasos con validación y pago simulado.
- Historial de pedidos, reordenar y comprobante imprimible.
- Internacionalización español/inglés.
- Persistencia total en `localStorage`, sin backend.

La aplicación fue validada en Chrome headless con **74 comprobaciones, 0 fallos, 0 errores de consola y 0 errores de red**. También se revisaron capturas de escritorio (1440 × 1000) y móvil (390 × 844).

> El proyecto no es un repositorio Git. No se crearon commits ni se hizo push. Los archivos originales se conservaron en `_backup-2026-10-29/`.

---

## 2. Hallazgos y correcciones

| # | Hallazgo | Corrección aplicada |
|---|---|---|
| 1 | La navegación lateral ocupaba espacio permanente y no se adaptaba bien a móvil. | Se reemplazó por un header superior sticky con navegación horizontal, menú móvil y búsqueda integrada. |
| 2 | La variable CSS `--c-surface-solid` no estaba definida y rompía algunos fondos. | Se construyó un sistema de tokens completo en `css/styles.css`; la auditoría no encontró variables huérfanas (salvo `--i`, usada intencionalmente en línea). |
| 3 | Faltaba la clase `.btn-sm`, usada por botones del historial. | Se añadieron `.btn-sm`, `.btn-icon`, estados hover/focus y tamaños coherentes. |
| 4 | `showToast` ignoraba el tipo de mensaje y todos los avisos se veían igual. | Nuevo `toast(message, type)` con variantes `success`, `error` e `info`, iconos y `aria-live`. |
| 5 | El filtro de menú afectaba tarjetas que no eran del catálogo. | El filtrado ahora se aplica solo a la grilla de productos y actualiza el contador de resultados. |
| 6 | El lote de eventos calculaba mal las cantidades al agregar al carrito. | `addEventBatch()` separa packs de 6 y unidades sueltas, actualiza el carrito y muestra un aviso. |
| 7 | El carrito leía `localStorage` sin validar estructura ni cantidades. | `sanitizeCart()` valida producto, cantidad, modificadores, deduplica y limita a 99 unidades. |
| 8 | `js/i18n.js` existía pero no se cargaba. | Se cargó antes de `main.js` y se integró con `data-i18n`, `t()` y cambio de idioma en caliente. |
| 9 | FontAwesome se cargaba desde un CDN externo. | Se instaló localmente en `assets/vendor/fontawesome/`; la tienda funciona sin CDN. |
| 10 | El enlace de WhatsApp usaba un número de ejemplo. | `STORE_WHATSAPP = ""` desactiva y oculta los botones hasta configurar un número real. También se eliminó el enlace muerto del pie. |
| 11 | No existía autenticación ni persistencia de sesión. | Registro/login local, hash con sal, sesión con vencimiento (12 h o 30 días) y cuenta demo. |
| 12 | El carrito, favoritos y pedidos no sobrevivían a una recarga. | Persistencia versionada en `localStorage` y sincronización entre pestañas. |
| 13 | No había un flujo de compra completo. | Checkout de 3 pasos, validación por paso, entrega, pago simulado, confirmación y comprobante. |
| 14 | Los datos de tarjeta podían quedar en el formulario entre compras. | Los campos de tarjeta se limpian al abrir cada checkout; solo se guardan los últimos 4 dígitos en el pedido. |
| 15 | El nombre del titular de la tarjeta no se validaba. | Se añadió validación y mensaje `checkout.invalidCardName` en español e inglés. |
| 16 | Al bajar la cantidad del carrito a cero el ítem no se eliminaba. | `changeCartQty()` permite llegar a 0 y elimina el ítem correctamente. |
| 17 | Buscar desde otra vista cerraba la búsqueda móvil al cambiar de vista. | `switchView()` acepta `keepSearch` y la búsqueda conserva el foco y el panel abierto. |
| 18 | Los productos no personalizables no abrían su detalle desde la acción secundaria. | Todas las tarjetas usan `customize`; el modal muestra el detalle aunque no haya modificadores. |
| 19 | Marcar un favorito volvía a renderizar toda la grilla y producía parpadeo. | `toggleFavorite()` actualiza solo los botones `.fav-btn` con `refreshFavoriteButtons()`. |
| 20 | El menú móvil semitransparente dejaba ver el contenido de fondo. | El panel y la búsqueda móvil usan fondo opaco; la animación ya no altera la opacidad. |
| 21 | No había atajos ni cierre por teclado de los paneles. | `Escape` cierra el panel superior, `Ctrl/Cmd + K` y `/` enfocan la búsqueda, y hay trampa de foco en overlays. |
| 22 | La navegación por hash no respondía al botón Atrás del navegador. | Se añadió manejo de `popstate` y vistas enlazables (`#menu`, `#heritage`, etc.). |
| 23 | Las imágenes principales pesaban demasiado para una carga local. | Se generaron versiones WebP: hero de 800 KB a 85 KB, manzanas de 686 KB a 78 KB, pocillo de 227 KB a 35 KB y logo de 165 KB a 7 KB. |
| 24 | El pie conservaba un enlace de WhatsApp sin número. | Se retiró el enlace; queda solo Instagram, que sí tiene destino real. |
| 25 | Al cambiar de idioma se perdía el nombre de la cuenta en el header. | `syncLanguageUI()` vuelve a aplicar traducciones y luego `updateAccountUI()` restaura el nombre del usuario. |
| 26 | Una etiqueta con `data-i18n` contenía un `span` anidado; al traducir se habría borrado la marca “Opcional”. | Se movió `data-i18n` al texto interno y se añadió una prueba que verifica que ninguna traducción destruya elementos hijos. |

---

## 3. Arquitectura implementada

### Estructura

- `index.html`: estructura semántica, seis vistas (`menu`, `heritage`, `craft`, `calculator`, `team`, `account`), header, carrito, modales y pie.
- `css/styles.css`: sistema visual con tokens, componentes, responsive, animaciones, accesibilidad y estilos de impresión.
- `js/i18n.js`: diccionario ES/EN, `t()`, `applyTranslations()`, `setLanguage()` y `toggleLanguage()`.
- `js/main.js`: IIFE con catálogo, estado, persistencia, autenticación, carrito, checkout, cuenta y eventos.
- `assets/vendor/fontawesome/`: CSS y webfonts locales.
- `assets/img/`: fotografías y versiones WebP optimizadas.

### Flujo de compra

1. El usuario explora el catálogo, busca, filtra u ordena.
2. Agrega productos al carrito, elige modificadores y cantidades.
3. Aplica un cupón y selecciona el lugar de entrega.
4. Inicia sesión o se registra si aún no tiene cuenta.
5. Completa datos, entrega y pago en tres pasos.
6. Confirma el pedido; se guarda localmente y se muestra el comprobante.
7. Puede ver el historial, repetir el pedido o imprimir el comprobante.

### Área de cuenta

La cuenta se reorganizó como un **panel de socio**, con una estructura distinta a la de un perfil tradicional:

- **Carnet superior** a ancho completo con monograma, nombre, correo, teléfono, número de socio, cierre de sesión y una franja de métricas (pedidos, total comprado, favoritos y antigüedad).
- **Pestañas horizontales** (`Resumen`, `Pedidos`, `Favoritos`, `Mis datos`) con navegación por teclado (`←`, `→`, `Inicio`, `Fin`).
- **Resumen** con el último pedido, accesos rápidos y una nota de almacenamiento local.
- **Pedidos** en línea de tiempo vertical, no en tarjetas apiladas.
- **Favoritos** como filas compactas con acciones rápidas.
- **Mis datos** como ficha de lectura con cierre de sesión.
- **Estado sin sesión** como invitación dividida en dos columnas con pasos numerados.

---

## 4. Persistencia

| Clave | Contenido |
|---|---|
| `ccp:users:v1` | Usuarios registrados (nombre, correo, teléfono, sal y hash). |
| `ccp:session:v1` | Sesión activa con `userId`, creación y vencimiento. |
| `ccp:cart:v1` | Ítems del carrito con producto, cantidad y modificadores. |
| `ccp:orders:v1` | Historial de pedidos (máximo 200). |
| `ccp:favorites:v1` | IDs de productos favoritos. |
| `ccp:coupon:v1` | Cupón aplicado. |
| `ccp:prefs:v1` | Preferencias de entrega, dirección y horario. |
| `ccp:orderSequence:v1` | Secuencia anual para referencias `CCP-AAAA-0000`. |
| `catracho_store_lang` | Idioma seleccionado (`es`/`en`). |

También se migra el carrito legado `catracho_cart` y se elimina la clave obsoleta `catracho_sb_collapsed`. La sincronización entre pestañas escucha el evento `storage` para carrito, favoritos, sesión y cupón.

---

## 5. Seguridad y privacidad

- **Sin backend:** no se envían datos a ningún servidor; todo vive en el navegador.
- **Contraseñas:** se guardan con sal aleatoria de 16 bytes y SHA-256 mediante `crypto.subtle`, con respaldo en JavaScript puro. El respaldo fue verificado contra vectores conocidos de SHA-256.
- **Sesión:** vencimiento de 12 horas sin “recordarme” y 30 días con la opción activa.
- **Tarjeta:** es una simulación. No se guarda el número completo; solo los últimos 4 dígitos en el pedido. Los campos se limpian al abrir otro checkout.
- **XSS:** los datos dinámicos se insertan con `escapeHtml()` o `textContent`; los mensajes de formulario usan `textContent`.
- **WhatsApp:** desactivado por defecto. Si se configura un número, el mensaje se envía por `wa.me` con `encodeURIComponent`.
- **Cuenta demo:** `demo@catracho.hn` / `demo1234`. Es pública y solo sirve para probar el flujo.

### Limitación importante

Esta autenticación es adecuada para una demostración académica local, **no para producción**. En un sistema real se necesita un backend, HTTPS, cookies seguras, rate limiting, verificación de correo y un algoritmo de hash lento (Argon2, scrypt o PBKDF2 con muchas iteraciones). `localStorage` es accesible para cualquier script del mismo origen.

---

## 6. Accesibilidad

Implementado:

- Enlace “Saltar al contenido principal”.
- Landmarks semánticos (`header`, `nav`, `main`, `footer`).
- `aria-label`, `aria-current`, `aria-expanded`, `aria-pressed` y `aria-modal`.
- Errores de formulario con `aria-invalid` y mensajes visibles.
- `aria-live` para avisos.
- Trampa de foco en modales y cierre con `Escape`.
- Atajos `Ctrl/Cmd + K` y `/` para búsqueda.
- Estilos `:focus-visible` y soporte de `prefers-reduced-motion`.
- Contraste alto sobre fondo espresso y tipografía legible.

Pendiente para una auditoría formal:

- Asociar cada error con `aria-describedby`.
- Traducir todos los `aria-label` estáticos al cambiar de idioma.
- Prueba con lector de pantalla (NVDA/VoiceOver) y navegación solo con teclado en todos los flujos.

---

## 7. Rendimiento

| Recurso | Antes | Después | Reducción |
|---|---:|---:|---:|
| `ponche-cup-jar` | 800 KB | 85 KB | ~89 % |
| `dehydrated-apples-cutout` | 686 KB | 78 KB | ~89 % |
| `cup-top-view` | 227 KB | 35 KB | ~85 % |
| `logo` | 165 KB | 7 KB | ~96 % |

Además:

- Imágenes secundarias con `loading="lazy"` y dimensiones declaradas.
- Hero con `fetchpriority="high"`.
- FontAwesome local, sin dependencia de CDN.
- Renderizado de catálogo limitado a cinco productos; no hay virtualización porque no se necesita.
- Los PNG originales se conservan como respaldo, pero la interfaz usa WebP.

---

## 8. Pruebas ejecutadas

### Validación estática

| Comprobación | Resultado |
|---|---|
| `node --check js/main.js` | OK |
| `node --check js/i18n.js` | OK |
| Claves i18n faltantes | 0 (las claves dinámicas `checkout.*`, `cust.*`, `delivery.schedule*` se resuelven por prefijo) |
| IDs referenciados por JS sin HTML | 0 (`pmQty` y `pmTotal` se generan dinámicamente en el modal) |
| Acciones HTML sin `case` en el manejador | 0 |
| Variables CSS indefinidas | 0 (excepto `--i`, definida en línea para el retraso de animación) |

### Prueba de navegador (Chrome headless)

**84 comprobaciones, 0 fallos, 0 errores de consola, 0 errores de red.**

Cobertura principal:

- Carga de la página, cinco productos, hero, header sticky y ausencia de sidebar.
- Sin desbordamiento horizontal en escritorio y móvil.
- Búsqueda, búsqueda desde otra vista, limpieza y contador de resultados.
- Cambio ES/EN, persistencia del idioma y nombre de cuenta tras el cambio.
- Registro, cierre de sesión, login demo y sesión persistente.
- Carnet de socio, cuatro pestañas, cambio entre Resumen, Pedidos, Favoritos y Mis datos, y estado de invitado.
- Favoritos, modal de favoritos, `Escape` y persistencia tras recargar.
- Carrito, cupón `UNAH2026`, descuento, eliminación del cupón y cantidad a cero.
- Modal de producto, incluido un producto no personalizable.
- Checkout: datos precargados, entrega con dirección, validación de tarjeta, pago en efectivo, términos y confirmación.
- Pedido persistido, carrito vaciado, comprobante con contenido y referencia `CCP-2026-0001`.
- Historial en la pestaña Pedidos, favoritos en su pestaña y ficha en Mis datos; persistencia tras recargar.
- Cuenta móvil sin desbordamiento horizontal.
- Menú móvil, búsqueda móvil y lightbox.

### Revisión visual

Se revisaron capturas de:

- Escritorio: menú, catálogo, historia, proceso, calculadora, equipo, cuenta (resumen, pedidos e invitado), checkout y comprobante.
- Móvil: menú, menú desplegable, búsqueda y cuenta.

No se detectaron solapamientos críticos ni desbordamientos tras corregir el panel móvil.

---

## 9. Riesgos residuales y recomendaciones

1. **Sin backend:** los pedidos no llegan a la tienda. Para operar de verdad hace falta API, base de datos y notificaciones.
2. **Pago simulado:** no hay pasarela ni cobro real; la tarjeta solo valida formato con Luhn.
3. **Datos locales:** borrar los datos del navegador elimina cuentas, pedidos y favoritos. No hay respaldo en la nube.
4. **Contraseñas locales:** el hash con sal es mejor que texto plano, pero no sustituye autenticación de producción.
5. **WhatsApp desactivado:** falta un número real; los botones permanecen ocultos hasta configurar `STORE_WHATSAPP`.
6. **Comprobante interno:** el documento aclara que no es una factura fiscal. No se implementó CAI, RTN, ISV ni numeración SAR.
7. **WebP:** requiere navegadores modernos. Los PNG originales siguen disponibles si se necesita compatibilidad adicional.
8. **Protocolo `file://`:** algunas funciones de historial o almacenamiento pueden variar. Se recomienda servir la carpeta por HTTP local.
9. **Accesibilidad:** falta una revisión formal con lector de pantalla y `aria-describedby` en errores.
10. **Pruebas automatizadas:** la validación se ejecutó de forma puntual; conviene incorporar Playwright al proyecto si se va a mantener.
11. **Historial limitado:** se conservan como máximo 200 pedidos y no hay panel para cambiar estados.
12. **Contenido académico:** nombres, fotografías y afirmaciones del producto deben verificarse antes de un uso comercial.

---

## 10. Cómo ejecutar

1. Abrir `index.html` en Chrome o Edge.
2. O, preferiblemente, servir la carpeta:
   ```bash
   cd "C:\Users\Jota Daniel\proyects\UNAH\Proyecto 2"
   npx serve .
   ```
3. Cuenta demo:
   - Correo: `demo@catracho.hn`
   - Contraseña: `demo1234`
4. Cupones de prueba: `UNAH2026`, `PONCHE10`, `CATRACHO15`.
5. Para activar WhatsApp, editar `STORE_WHATSAPP` en `js/main.js` con el número real en formato internacional.

---

## 11. Archivos modificados y respaldo

**Modificados**

- `index.html`
- `css/styles.css`
- `js/main.js`
- `js/i18n.js`

**Añadidos**

- `assets/img/ponche-cup-jar.webp`
- `assets/img/dehydrated-apples-cutout.webp`
- `assets/img/cup-top-view.webp`
- `assets/img/logo-160.webp`
- `INFORME-AUDITORIA.md`

**Respaldo**

- `_backup-2026-10-29/index.html`
- `_backup-2026-10-29/css/styles.css`
- `_backup-2026-10-29/js/main.js`
- `_backup-2026-10-29/js/i18n.js`

**No modificado**

- Imágenes originales en `assets/img/`.
- PDFs y material académico.
- Carpeta `extracted_pdf_images/`.

---

## 12. Conclusión

El rediseño cumple con lo solicitado: navegación superior, login con persistencia, experiencia de compra tipo e-commerce, mejora visual y de animaciones, y corrección de los errores detectados. La aplicación queda lista para revisión y demostración local.

**Estado:** listo para revisión del usuario.
