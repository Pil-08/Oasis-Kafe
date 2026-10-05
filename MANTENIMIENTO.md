# Oasis Kafe — cómo se mantiene

Manual de trabajo de la web de Oasis Kafe (Jose Goikoa 1, Antiguo, Donostia). La presentación
del proyecto está en el [README](README.md).

En producción: <https://oasis-kafe-web.pages.dev> (Cloudflare)

Todo —CSS, JS, datos e imágenes— vive dentro de **un único fichero HTML**. Se abre con doble
clic, se manda por WhatsApp o se sube a cualquier hosting. Sin dependencias, sin build.

## Cómo se trabaja

Editas **`oasis_kafe.html`** (en la raíz). El que sirve Cloudflare es **`docs/index.html`**,
que es una copia exacta; `docs/wrangler.jsonc` lo fija con `assets.directory: "docs"`.
El script de publicación se encarga de esa copia por ti.

`oasis_kafe.html`, `PUBLICAR-WEB.bat` y `desplegar.ps1` no se suben al repositorio (están en el
`.gitignore`): viven en el ordenador de quien publica.

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

La carta, los idiomas, las fotos y el horario **no están dispersos por el código**: son cuatro
bloques JSON seguidos, hacia la línea 2384 de `oasis_kafe.html`. Busca `id="dataMenu"` y los
tienes los cuatro a la vista.

| Bloque | Qué contiene |
|---|---|
| `<script type="application/json" id="dataMenu">` | **La carta: precios, productos, categorías.** |
| `… id="dataI18n">` | Textos en ES / EU / EN / FR. |
| `… id="dataPhotos">` | Las fotos, incrustadas en base64. |
| `… id="dataHours">` | El horario que alimenta el punto verde/rojo. |

### Cambiar un precio

Dentro de `dataMenu`, cada producto es un objeto. `"price": null` sale como "Consultar".

```json
{ "id": "brownie", "name": { "es": "Brownie" }, "price": 1.95, "unit": "und" }
```

`unit` puede ser `"und"` o `"kg"`. Guardas y publicas: no hay que compilar nada.

### Tartas por porciones

En `dataMenu` → `config.porcion`:

```json
{ "precio": 3.45, "gramos": 150, "porTarta": 6 }
```

El selector va de 1 a 6. En **3** pone "Media tarta", en **6** "Tarta completa", y el total es
`porciones × 3,45 €`. La mitad se calcula sola desde `porTarta`: si mañana salen 8 porciones,
cambia ese número y "media tarta" pasa a 4 sin tocar código.

Para cobrar una tarta concreta a otro precio por ración, añádele `"portionPrice": 3.60`.
Ya se usa en las tartas de 24 €/kg.

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

El mapa es un `<iframe class="map-embed">` con la URL escrita a mano dentro del HTML. Si
cambias las coordenadas, hay que editar su `src` directamente. Ojo: el dominio del iframe
tiene que estar permitido en el `frame-src` de `docs/_headers`.

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

Ya resueltas: todos los productos tienen precio (no queda ninguno en "Consultar"), y las
tartas de 24 €/kg cobran su ración aparte vía `portionPrice`.
