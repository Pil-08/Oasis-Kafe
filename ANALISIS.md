# Análisis del script original

Revisión del generador `oasis_antigravity.html`. Ordenado por gravedad.

## 1. Bloqueantes — la página no funcionaba

### 1.1 El `<script>` estaba vacío
```js
<script>
// Código JS reactivo autónomo (gestión de carrito, multidioma ES/EU/EN/FR, horarios vivos y filtros)
</script>
```
Ese comentario era **todo** el JavaScript. Consecuencias en cadena:

| Elemento | Qué pasaba |
|---|---|
| `#menuGrid` | **La carta salía vacía.** Se anunciaba "La carta" y no se pintaba ni un producto. |
| `#tabGallery`, `#tartasSection` | `display:none` fijo, invisibles para siempre. |
| Botones ES/EU/EN/FR | Decorativos. Los ~40 `data-i18n` no los leía nadie. |
| `#liveTxt` | Congelado en "Comprobando horario…". |
| `#liveDot` | **Verde fijo: decía "abierto" a las 3 de la mañana.** |
| `.current-day` | Definido en CSS, nunca aplicado a ninguna fila. |
| Carrito | No abría. `#cartWaBtn` apuntaba a `href="#"`. |
| Sabores del donut | No cambiaban `#donutTop` / `#donutSide` / `#donutCrust`. |
| Buscador y filtros | Inertes. |

### 1.2 Las imágenes extraídas no se usaban
```python
img_data_uris = {name: uri for uri, name in zip(all_data_uris, names)}
```
`img_data_uris` no aparece **ni una vez** en el f-string del HTML. Se descomprimían 11 imágenes para tirarlas a la basura: el fichero se llamaba "con imagenes" y generaba una página sin ninguna.

## 2. Fallos de robustez

| # | Problema | Efecto |
|---|---|---|
| 2.1 | `template_m.group(1)` sin comprobar el match | `AttributeError: 'NoneType'` críptico si cambia el bundle |
| 2.2 | `zip(all_data_uris, names)` | Trunca en silencio; si el orden cambia, cada nombre apunta a otra foto |
| 2.3 | `svg_data_uris['logo_cup']` | Se rellena bajo `if uuid in manifest` pero se lee siempre → `KeyError` al formatear |
| 2.4 | `gzip.decompress()` sin comprobar cabecera | `BadGzipFile` si el asset viene sin comprimir |
| 2.5 | `open(out,'w')` sin `makedirs` | Peta si la carpeta de salida no existe |
| 2.6 | `import os` sin usar | Ruido |
| 2.7 | Rutas `C:\Users\User\...` fijas | Solo funciona en esa máquina |

## 3. Mantenibilidad

**El f-string gigante con CSS dentro.** ~700 líneas con cada `{` y `}` duplicado a mano. Una llave suelta = `KeyError` o `ValueError` en tiempo de ejecución, sin ayuda del editor. Es el fallo que más caro sale a la larga.

*Ahora:* `src/index.html`, `src/styles.css` y `src/app.js` son ficheros normales con resaltado y linter; `build.py` solo sustituye `{{TOKENS}}`.

## 4. HTML, CSS y accesibilidad

| # | Problema | Corregido |
|---|---|---|
| 4.1 | `.section-header`, `.section-title`, `.section-desc` usadas en HTML, **nunca definidas** en CSS | Definidas |
| 4.2 | `.menu-search-icon` en CSS, sin elemento en HTML: 36px de hueco vacío | Icono SVG añadido |
| 4.3 | `role="tablist"` sin hijos `role="tab"` — ARIA inválida | `role`, `aria-selected`, `aria-controls` + flechas ←→ |
| 4.4 | Cajón del carrito sin `role=dialog`, sin trampa de foco, sin Escape; enfocable estando cerrado | Diálogo modal completo con `hidden` |
| 4.5 | `maximum-scale=5.0` limita el zoom | Quitado |
| 4.6 | `<html lang="es">` fijo con 4 idiomas ofrecidos | Cambia con el idioma |
| 4.7 | Toast sin `role="status"` | Lo anuncian los lectores de pantalla |
| 4.8 | `viewport-fit=cover` sin `env(safe-area-inset-*)` | Márgenes seguros aplicados |
| 4.9 | `@media (max-width:860px){ .header-tel{display:none} }` — **el teléfono desaparecía justo en móvil** | Se mantiene como botón de icono |
| 4.10 | `scroll-behavior:smooth` y transiciones sin `prefers-reduced-motion` | Bloque añadido |
| 4.11 | `scrollbar-width:none` sin `::-webkit-scrollbar` | Añadido + máscara de degradado en los bordes |
| 4.12 | Tabla de horario sin `<caption>` | Añadido |
| 4.13 | `width:min(390px,100vw)` — `100vw` incluye la barra de scroll | `100%` |
| 4.14 | Sin skip link, sin favicon, sin Open Graph, sin JSON-LD | Todo añadido |
| 4.15 | `backdrop-filter` sin prefijo `-webkit-` | Añadido |
| 4.16 | `alt="Logo"` junto al texto "Oasis Kafe" — se lee dos veces | `alt=""` |
| 4.17 | Sin estilos de impresión (una carta se imprime) | `@media print` |

## 5. Correcciones de lógica al implementar

- **Horario en la zona del local.** Calcularlo con la hora del visitante hacía que alguien en México viera "abierto" cuando está cerrado. Ahora se calcula con `Intl.DateTimeFormat` sobre `Europe/Madrid`.
- **Punto de estado neutro al arrancar.** Antes verde por defecto; si el JS falla, mentía. Ahora arranca gris.
- **Búsqueda insensible a acentos.** `datil` encuentra `dátil`, `platano` encuentra `plátano`.
- **La búsqueda mira también la categoría**, así "dátil" trae los 7 donuts y no solo los 4 que lo llevan en el nombre.
- **Filtros generados desde los datos.** Los 5 botones fijos (`sin_gluten`, `vegano`, `sin_lactosa`…) prometían filtros de alérgenos sin ningún dato detrás. Ahora solo aparece el filtro que tiene productos etiquetados de verdad.
- **Sin `innerHTML` con datos.** Todo se construye con `createElement` y `textContent`.
- **Enlace de WhatsApp con `encodeURIComponent`.**

## 6. Discrepancias en los datos — para confirmar

Salidas de comparar los carteles y las etiquetas de las fotos:

1. **Banoffee: 23 €/kg en la etiqueta de la vitrina, 24 €/kg en el cartel de la pared.** Se ha usado 23. Hay que igualarlo.
2. **Bizcocho de avena:** el cartel pone 22 €/kg; la instrucción posterior dice que solo plátano, café y arándanos van a 22. Se ha usado **21** (manda la instrucción).
3. **Tarta de Oreo (24 €/kg)** está en la vitrina pero no en el cartel de la pared.
4. **"Plancha de yogurt 28 €/kg"** del cartel puede ser lo mismo que la plancha del cole (28 €). Solo está la del cole; si son distintas, hay que añadir la otra.
5. **Plancha del cole:** se ha tomado 28 € por pieza, no por kilo ("vale 28€").
6. **Ración a 3,45 €** = 150 g × 23 €/kg. Para las tartas de **24 €/kg** (Oreo y queso al horno) la ración saldría a **3,60 €**. Ahora todas cobran 3,45; hay campo `portionPrice` por producto si se quiere afinar.
7. **Horario:** una nota de prensa de 2024 daba L-V 8:00–15:00 y S-D 9:00–13:00. Se ha mantenido el del código original (8:00–14:30 · 16:30–19:00 y 9:00–13:30).
8. **Sin precio** (salen como "Consultar"): donuts, croissant, chocolate a la taza, ColaCao, Tres Leches pequeño.
