# Generador antiguo — NO refleja la web actual

> **Aviso: el contenido de esta carpeta está desfasado desde el 2 de septiembre de 2026.**
> No lo uses para publicar. Sirve solo como referencia del código legible original.

## Qué pasó

La web se generaba con `build.py`, que juntaba `src/*` y `assets/*` en un único HTML
autocontenido. En algún momento se dejó de usar y se pasó a **editar `oasis_kafe.html`
directamente**, en la raíz del proyecto.

Desde entonces, todos los cambios se han hecho solo en ese HTML. Lo que hay aquí se quedó atrás:

| Qué falta en `src/data/menu.json` | Dónde sí está |
|---|---|
| 5 galletas nuevas (arroz, canela, jengibre, matcha, pistacho) | `oasis_kafe.html` |
| Precios de ColaCao (1,90) y chocolate a la taza (2,60) | `oasis_kafe.html` |
| Retirada de Tartaletas, Bizcocho mini F.S., Madalenas y Brusquetta | `oasis_kafe.html` |
| Croissant + Txikis unificados a 2,50 | `oasis_kafe.html` |
| 9 de las 20 fotos (`assets/` solo tiene 11) | `oasis_kafe.html` |

## ¿Es peligroso ejecutarlo?

No. `build.py` escribe **únicamente** en `generador-antiguo/dist/oasis-kafe.html`.
No toca `docs/index.html` ni `oasis_kafe.html`, así que no puede romper la web publicada.
Lo que produzca, eso sí, será una versión con la carta vieja.

## Si algún día quieres volver a este flujo

Habría que trasladar a mano al `src/` todos los cambios hechos desde el 2 de septiembre.
La lista completa está en el historial de Git:

```bash
git log --oneline 0ff7176..HEAD
```

Las rutas internas de `build.py` son relativas a su propia carpeta, así que sigue
funcionando aquí dentro sin tocar nada.
