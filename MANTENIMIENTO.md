# Oasis Kafe — cómo se mantiene

Manual de trabajo de la web de Oasis Kafe (Jose Goikoa 1, Antiguo, Donostia). La presentación
del proyecto está en el [README](README.md).

En producción: <https://oasis-kafe-web.pages.dev> (Cloudflare) y <https://pil-08.github.io/Oasis-Kafe/> (GitHub Pages).
Qué hay en cada sitio y cómo se sube: ver «Publicación y respaldo».

Todo —CSS, JS, datos e imágenes— vive dentro de **un único fichero HTML**. Se abre con doble
clic, se manda por WhatsApp o se sube a cualquier hosting. Sin frameworks ni paso de
compilación; lo único que se pide fuera son las tipografías de Google Fonts y el mapa de Google.

## Cómo se trabaja

Editas **`oasis_kafe.html`** (en la raíz). El que sirve Cloudflare es **`docs/index.html`**,
que es una copia exacta; `docs/wrangler.jsonc` lo fija con `assets.directory: "docs"`.
El script de publicación se encarga de esa copia por ti.

`oasis_kafe.html`, `PUBLICAR-WEB.bat` y `desplegar.ps1` ya no se versionan (están en el
`.gitignore`): viven en el ordenador de quien publica. El historial anterior al commit `71fff7b`
todavía los contiene.

GitHub Pages también está activo en este repositorio y sirve `docs/`, pero ignora el fichero
`_headers`: la versión con las cabeceras de seguridad es la de Cloudflare.

### Publicar un cambio

1. Edita `oasis_kafe.html` y guarda.
2. Doble clic en **`PUBLICAR-WEB.bat`**

O desde la terminal, con un mensaje propio:

```powershell
.\desplegar.ps1 -Mensaje "Nuevos precios de tartas"
```

El script hace todo esto solo:

| Paso | Qué hace |
|---|---|
| 1 | Se sincroniza con GitHub (`fetch` + `pull` si hace falta) |
| 2 | Copia `oasis_kafe.html` → `docs/index.html` |
| 3 | `commit` + `push` a `main` |
| 4 | Espera a Cloudflare y **verifica por MD5** que la web sirve tu archivo exacto |

Si no hay cambios, avisa y no hace nada. Si la web no se actualiza en 3 minutos, te lo dice.

## Dónde están los datos dentro del HTML

La carta, los idiomas, las fotos y el horario **no están dispersos por el código**: son cinco
bloques JSON seguidos, hacia la línea 2180 de `oasis_kafe.html`. Busca `id="dataMenu"` y los
tienes los cinco a la vista.

| Bloque | Qué contiene |
|---|---|
| `<script type="application/json" id="dataMenu">` | **La carta: precios, productos, categorías.** |
| `… id="dataI18n">` | Textos en ES / EU / EN / FR. |
| `… id="dataPhotos">` | Las fotos, incrustadas en base64. |
| `… id="dataHours">` | El horario que alimenta el punto verde/rojo. |
| `… id="dataSite">` | La zona horaria, el teléfono y el número de WhatsApp al que llega el pedido. |

### Cambiar un precio

Dentro de `dataMenu`, cada producto es un objeto. `"price": null` sale como "Consultar".

```json
{ "id": "brownie", "name": { "es": "Brownie" }, "price": 1.95, "unit": "und" }
```

`unit` puede ser `"und"`, `"kg"`, `"plancha"` o `"entero"`; las tartas por porciones no llevan
`unit`. Guardas y publicas: no hay que compilar nada.

### Tartas por porciones

En `dataMenu` → `config.porcion`:

```json
{ "precio": 3.45, "gramos": 150, "porTarta": 6 }
```

El selector va de 1 a 6. En **3** pone "Media tarta", en **6** "Tarta completa", y el total es
`porciones × 3,45 €`. La mitad se calcula sola desde `porTarta`: si mañana salen 8 porciones,
cambia ese número y "media tarta" pasa a 4 sin tocar código.

Para cobrar una tarta concreta a otro precio por ración, añádele `"portionPrice": 3.60`. El
código lo admite, pero hoy ninguna tarta lo lleva (ver «Pendiente de confirmar con el negocio»).

## Tres cosas que no hay que tocar

- **`.gitattributes`** fija `*.html -text`. Sin eso, Git convertiría los finales de línea
  (CRLF → LF) y lo publicado dejaría de ser byte a byte lo que editas. El script de
  publicación compara MD5, así que una conversión silenciosa rompería la verificación.
- **`docs/_headers`** lleva una CSP estricta. Si añades algo externo nuevo (un iframe, un
  script, una fuente), **hay que permitirlo ahí** o el navegador lo bloquea en silencio.
  Ejemplo real: al pasar el mapa de OpenStreetMap a Google Maps hubo que cambiar
  `frame-src` a `https://maps.google.com https://www.google.com`.
- **`docs/index.html` no se edita a mano.** Es la copia que genera `desplegar.ps1`. Cualquier
  cambio que hagas ahí lo sobrescribe la siguiente publicación.

## La intro de marca

Al abrir la web aparece una pantalla marrón (`#775B43`) de unos 4 segundos: el sombrero del
logo cae sobre la cara y aparece «OASIS KAFE». Al terminar, el icono de la cabecera repite la
animación una sola vez.

- **Se salta** con un toque, una tecla o un gesto de scroll.
- **Una vez por sesión**: lo recuerda `sessionStorage` (clave `oasis-intro`), así que al
  recargar o navegar no vuelve a salir. Añade **`?intro`** a la dirección para verla otra vez y
  **`?sin-intro`** para saltarla (útil al hacer capturas o pruebas).
- **«Reducir movimiento»**: sin caída ni rebotes, solo un fundido suave.
- Mientras dura, la barra del navegador del móvil cambia al color marrón (`theme-color`).
- **Dónde está**: `<div id="intro">` y su `<script>` justo después de `<body>`; el CSS, en los
  bloques «Intro de marca» e «Icono de la cabecera» del `<style>`. Para quitarla, borra ese
  `div` y su script.
- **El logo no se toca.** Es el trazado real de la cabecera, definido una sola vez en un `<svg>`
  oculto (`id="lg-logo"` y sus máscaras `lg-*`) y compartido por la intro, el icono animado de la
  cabecera y la cita. «OASIS KAFE» está en Poppins Bold (tipografía parecida a la de las
  imágenes del logo, no idéntica); el pie, el buscador y el pin del mapa usan el logo estático.

## El rediseño de octubre de 2026

**Qué cambió.** Se rehicieron la **portada, los principios, los donuts, «Cómo encontrarnos», la
cita, el horario y el pie**. Las secciones de color acaban en una curva suave (el ala del
sombrero del logo). La portada lleva una foto de la vitrina en un círculo, un sello circular y
tres botones (carta, cómo llegar y WhatsApp). El donut dibujado pasó a ser un **anillo plano
que cambia de color con cada sabor**. El horario tiene una **esfera con el recorrido del sol**
de 6:00 a 22:00: marca los tramos abiertos de hoy y el sol se mueve según la hora.

**Qué NO cambió** (se conserva tal cual): la cabecera, la carta y la selección de productos
(pestañas, filtros, galería, filas con el «+», leches, alérgenos, tartas por porciones), el
pedido por WhatsApp, el visor de fotos, la intro, los datos, los textos, los cuatro idiomas y
la paleta (crema, marrón y marrón oscuro de siempre). Solo se añadió un tono, la **arena
`#E6BC80`** (`--arena`), sacado del propio donut. Las tipografías siguen siendo Fraunces y Karla.

### Dónde tocar cada cosa

| Quieres cambiar… | Dónde |
|---|---|
| Titular, textos y botones de la portada | `dataI18n` (`h1a`, `h1b`, `lede`, `ctaMenu`, `ctaMap`…). El botón «WhatsApp» no se traduce. |
| Las dos fotos de la portada | `dataPhotos` → `local`: la **2.ª** (grande) y la **3.ª** (pequeña) de la lista. No hay fotos duplicadas en el HTML. |
| Palabras del sello circular («CAFÉ · BROWNIES · BATIDOS · DONUTS · TARTAS») | `<textPath>` dentro de `.sello` en la portada. No se traduce. Caben unas 45 letras con la letra a 10,5 y `textLength="280"`; si añades más palabras, baja el `font-size`. |
| Nombre, descripción y **color** de cada sabor del donut | `FLAVORS` en el JS: `dot` es el color del anillo y del puntito del botón (hoy plátano `#D9A441`, calabaza `#C4622B`, boniato `#8C5340`, manzana `#EBD7AC`). |
| El horario | `dataHours`: alimenta la tabla, el punto verde/rojo **y la esfera**. La esfera cubre de 6:00 a 22:00; si algún día se abre antes o más tarde, hay que cambiar `polarDia` (los números 360 y 960) y las etiquetas «06:00»/«22:00» del `<svg>` de `.dial`. |
| El nombre grande del pie | `<svg class="rotulo">` en el `<footer>`: es un SVG con `textLength`, así ocupa justo el ancho en cualquier móvil. |
| Colores | Variables de `:root` (`--brand-primary`, `--brand-dark`, `--bg-canvas`, `--arena`…). Los estilos nuevos están al final del `<style>`, bajo el comentario «Oasis Kafe · rediseño con la paleta de siempre». |
| **El número de WhatsApp** | **Está escrito en 4 sitios**: `dataSite.waBase` (el pedido), el botón de la portada, el enlace de contacto y el botón del pedido (valor inicial). Cámbialos todos. |

### Qué no hay que tocar del rediseño

- **`overflow-x: hidden; overflow-x: clip` en `.banda` y en `.site-footer`.** Es lo que evita el
  hueco blanco a la derecha en iPhone (el mismo fallo que se arregló en `96b7f7c`): varias piezas
  decorativas sobresalen a propósito (el círculo de «Cómo encontrarnos», el sello, la foto
  pequeña). Sin ese recorte, la página mide 452 px en un móvil de 390. No pongas `overflow` en
  `html` ni en `body`: rompe la cabecera fija.
- **Las secciones de `<main>` son 7 `.banda`** y su orden de apilado se fija con
  `main > .banda:nth-child(1…7)`. Si añades o quitas una sección, ajusta esas reglas: cada banda
  tiene que quedar por encima de la siguiente para que se vea la curva.
- **El tamaño óptico de los titulares** (`font-variation-settings` con `opsz` en los titulares
  nuevos). Sin él, el motor de Safari que se probó pinta Fraunces más grueso y más ancho. No se
  ha podido confirmar en un iPhone real.

### Publicación y respaldo

- **La web está en dos sitios con la misma versión**: GitHub Pages
  (<https://pil-08.github.io/Oasis-Kafe/>, sirve `docs/` de `main` y **no aplica `_headers`**) y
  Cloudflare (<https://oasis-kafe-web.pages.dev>, proyecto `oasis-kafe`).
- **Cloudflare es de subida manual: no está conectado a GitHub**, así que un `push` no lo
  actualiza. Se sube arrastrando `index.html` y `_headers` en el panel del proyecto, o con
  Wrangler (hay que autorizar con `wrangler login` y cerrar con `wrangler logout` al acabar):

  ```powershell
  mkdir publicar-cf
  copy docs\index.html, docs\_headers publicar-cf\
  npx wrangler pages deploy publicar-cf --project-name oasis-kafe --branch main
  ```

  No subas `wrangler.jsonc`: quedaría público como un fichero más.
- **`desplegar.ps1`**: su paso 4 comprueba `https://oasis-kafe.pages.dev`, una dirección antigua
  que ya no existe, y Cloudflare no se actualiza al hacer `push`. Hasta que se corrija, un aviso
  en ese paso no significa que GitHub haya fallado.
- **Respaldo de la versión anterior al rediseño** (portada con el donut dibujado y la paleta
  crema, con la intro): rama **`respaldo-version-antigua`** y etiqueta
  **`respaldo-antes-del-rediseno`**, ambas en el commit `29bc266`. Para volver atrás:
  - *GitHub Pages*: `gh api -X PUT repos/Pil-08/Oasis-Kafe/pages -f "source[branch]=respaldo-version-antigua" -f "source[path]=/docs"`
    (y de nuevo `main` para volver a la nueva), o `git checkout respaldo-antes-del-rediseno -- docs/index.html`
    y un commit nuevo en `main`.
  - *Cloudflare*: en el panel del proyecto, pestaña **Despliegues**, restaurar el anterior; o subir
    el `docs/index.html` de esa etiqueta.

## Qué hay en la carpeta

| Ruta | Qué es |
|---|---|
| `oasis_kafe.html` | **El fichero maestro. Es lo que editas.** No se versiona (`.gitignore`). |
| `PUBLICAR-WEB.bat` | Doble clic para publicar. Solo llama a `desplegar.ps1`. No se versiona. |
| `desplegar.ps1` | Copia, commit, push y verificación por MD5. No se versiona. |
| `docs/index.html` | Lo que sirve Cloudflare. Copia automática del maestro. |
| `docs/_headers` | Cabeceras de seguridad y caché (CSP incluida). |
| `docs/wrangler.jsonc` | Configuración de Cloudflare: la carpeta `docs` es la que se publica. |
| `generador-antiguo/` | El generador original (`build.py` + `src/` + `assets/`). **Desfasado desde el 2-sep-2026, no lo uses para publicar.** Ver su `LEEME.md`. |

## El mapa

Coordenadas confirmadas por dos vías independientes (ficha de lugar de Google Maps y su
Plus Code local, `8X5V+V9`, que coincide):

```
43.3097313, -2.0065578
```

El mapa es un `<iframe class="map-embed">` con la URL escrita a mano dentro del HTML. Ese `src`
no usa coordenadas: busca por nombre y dirección (`q=Oasis Kafe, Jose Goikoa Kalea, 1, 20018
Donostia`), igual que los enlaces de «Cómo llegar». Si la dirección cambia, hay que editar el
`src` y esos enlaces; las coordenadas de arriba son solo de referencia. Ojo: el dominio del
iframe tiene que estar permitido en el `frame-src` de `docs/_headers`.

## Alérgenos

Las etiquetas (`sin_azucar_anadida`, `vegano`) solo se ponen donde el negocio lo afirma, y los
botones de filtro **se generan desde las etiquetas que existen de verdad**: no hay filtros
vacíos ni promesas de "sin gluten" sin dato detrás. Si añades etiquetas de alérgenos,
verifícalas antes: es información con consecuencias de salud.

## Pendiente de confirmar con el negocio

Dudas de datos que siguen abiertas desde el volcado inicial de la carta:

1. **Banoffee:** 23 €/kg en la etiqueta de la vitrina, 24 €/kg en el cartel de la pared.
   La web usa **23**. Hay que igualar los carteles o corregir la web.
2. **Bizcocho de avena:** el cartel ponía 22 €/kg; la instrucción posterior decía que solo
   plátano, café y arándanos van a 22. La web usa **21**.
3. **"Plancha de yogurt 28 €/kg"** aparecía en el cartel de la pared y **no está en la web**.
   Si es distinta de la plancha del cole, falta darla de alta.
4. **Horario:** una nota de prensa de 2024 daba L-V 8:00–15:00 y S-D 9:00–13:00. La web
   mantiene 8:00–14:30 · 16:30–19:00 y 9:00–13:30.

5. **Tartas de Oreo y de queso (24 €/kg):** cobran la ración a 3,45 €, igual que las de
   23 €/kg, así que una tarta entera sale a 20,70 € y no a 21,60 € (6 raciones de 150 g a
   24 €/kg). Si deben ir a 3,60 € la ración, hay que añadir `"portionPrice": 3.6` a `t_oreo` y
   `t_queso` en `dataMenu`.
6. ~~Donut animado de la portada~~ — **resuelto con el rediseño (oct-2026)**: la portada ya no tiene
   animaciones continuas; el donut es un anillo plano que solo cambia de color al elegir sabor.

Ya resuelto: todos los productos tienen precio (no queda ninguno en "Consultar").
