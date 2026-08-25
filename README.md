# Oasis Kafe — web

Web de una sola página, autocontenida, para Oasis Kafe (Jose Goikoa 1, Antiguo, Donostia).

```
python3 build.py          →  dist/oasis-kafe.html   (y una copia en docs/index.html)
```

Un solo fichero HTML con el CSS, el JS, los datos y las imágenes dentro. Se abre con doble clic,
se manda por WhatsApp o se sube a cualquier hosting. Sin dependencias, sin build de node.

## Publicarla (GitHub Pages)

`docs/index.html` es lo que sirve GitHub Pages. **Ahora mismo es la versión editada a mano**
(`oasis_kafe_donostia.html`), no la que genera `build.py` — desde que existe esa versión manual,
`build.py` deja de tocar `docs/index.html` a propósito, para no pisarla. Para activar Pages
(una sola vez):

1. En GitHub: **Settings → Pages**
2. **Source:** Deploy from a branch
3. **Branch:** `main` · carpeta **`/docs`** → Save

A los pocos minutos la web queda publicada en `https://pil-08.github.io/Oasis-Cafe-de-Pil_08/`.

Para volver a publicar la versión generada por `build.py` en vez de la manual:
`cp dist/oasis-kafe.html docs/index.html`.

## Qué hay dentro

| Carpeta | Qué es |
|---|---|
| `build.py` | Generador. La configuración del negocio está arriba del todo. |
| `src/index.html` | Estructura, con marcadores `{{TOKEN}}`. |
| `src/styles.css` | Estilos. |
| `src/app.js` | Toda la lógica: carta, carrito, idiomas, horario, galería. |
| `src/data/menu.json` | **La carta. Es lo que se toca para cambiar precios.** |
| `src/data/i18n.json` | Textos en ES / EU / EN / FR. |
| `assets/fotos/` | Fotos del local. |
| `assets/productos/` | Fotos de producto de la zona de tartas. |
| `ANALISIS.md` | Revisión del script anterior y qué se ha corregido. |

## Añadir las fotos

Suelta los ficheros con **exactamente** estos nombres y vuelve a lanzar `python3 build.py`.
Valen `.jpg`, `.jpeg`, `.png`, `.webp` o `.avif`.

**`assets/fotos/`** (galería del local, sale bajo las pestañas de la carta)

| Fichero | Foto |
|---|---|
| `01-vitrina-tartas.jpg` | Vitrina de tartas y pastas |
| `02-vitrina-bolleria.jpg` | Vitrina de bizcochos y bollería |
| `03-rincon.jpg` | El rincón del espejo |
| `04-barra.jpg` | La barra |

**`assets/productos/`** (tarjetas de la zona de tartas)

| Fichero | Producto |
|---|---|
| `bizcocho-vegano.jpg` | Bizcocho vegano |
| `plancha-cole.jpg` | Plancha de bizcocho para colegios |
| `tres-leches-completo.jpg` | Tres Leches completo |
| `tres-leches-pequeno.jpg` | Tres Leches pequeño |

Mientras falte alguna, su hueco sale rayado con el nombre del fichero que espera. El build
también lo lista al terminar. No hace falta recortar ni retocar nada: el encuadre y el realce
se aplican por CSS (`--pos` y `--photo-filter`), así que puedes cambiar la foto cuando quieras
sin tocar el JPEG. El encuadre de cada una se ajusta en `FOTOS_LOCAL` / `FOTOS_PRODUCTO`
dentro de `build.py`.

## El mapa

Coordenadas ya confirmadas y puestas en `build.py`:

```python
"coords": (43.3097313, -2.0065578),
```

Verificadas por dos vías independientes (ficha de lugar de Google Maps y su Plus Code local,
`8X5V+V9`, que coincide). El mapa usa el embed de **OpenStreetMap**
(`openstreetmap.org/export/embed.html`), no el de Google: ese endpoint es gratuito, no requiere
clave de API y está pensado para incrustar — el de Google (`maps?q=...&output=embed`) es un
endpoint no oficial que deja de cargar sin previo aviso.

Se omite a propósito el parámetro `&marker=`, así el mapa no dibuja ningún marcador propio; el
único pin visible es la chapa con el logo, anclada por su punta al centro exacto del encuadre
—justo donde caería un marcador— y es en sí misma un enlace a "Cómo llegar".

Si cambias las coordenadas, recuerda que `docs/index.html` (la versión manual) tiene su propio
`<iframe class="map-embed">` con la URL escrita a mano — no se actualiza solo al tocar
`build.py`. Hay que editar su `src` también.

## Tartas por porciones

Definido en `src/data/menu.json` → `config.porcion`:

```json
{ "precio": 3.45, "gramos": 150, "porTarta": 6 }
```

El selector va de 1 a 6. En **3** pone "Media tarta", en **6** "Tarta completa", y el total es
`porciones × 3,45 €`. La mitad se calcula sola desde `porTarta`: si mañana salen 8 porciones,
cambia ese número y "media tarta" pasa a 4 sin tocar código.

Para cobrar una tarta concreta a otro precio por ración, añádele `"portionPrice": 3.60`.

## Cambiar precios

Todo en `src/data/menu.json`. `"price": null` sale como "Consultar".

```json
{ "id": "brownie", "name": { "es": "Brownie" }, "price": 1.95, "unit": "und" }
```

`unit` puede ser `"und"` o `"kg"`. Después, `python3 build.py`.

## Alérgenos

Las etiquetas (`sin_azucar_anadida`, `vegano`) solo se ponen donde el negocio lo afirma, y los
botones de filtro **se generan desde las etiquetas que existen de verdad**: no hay filtros
vacíos ni promesas de "sin gluten" sin dato detrás. Si añades etiquetas de alérgenos, verifícalas
antes: es información con consecuencias de salud.

## Comprobado en navegador

54 comprobaciones sobre Chromium (precios, porciones, carrito, WhatsApp, los 4 idiomas,
horario, anclaje del pin, teclado y accesibilidad). El script de pruebas no se versiona;
está en el scratchpad de la sesión.

## Pendiente

Ver la sección 6 de `ANALISIS.md`: precios en conflicto entre carteles y etiquetas, y los
productos que aún salen como "Consultar".
