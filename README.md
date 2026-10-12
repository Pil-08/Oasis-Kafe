# Oasis Kafe

La web de una cafetería y pastelería de Antiguo, en Donostia. Tiene la carta entera, con más
de setenta productos; el horario, con su puntito verde o rojo según estén abiertos o no y una
esfera que sigue el recorrido del sol a lo largo del día; y un
carrito que va preparando el pedido para mandarlo por WhatsApp. La interfaz está en castellano,
euskera, inglés y francés; más de la mitad de los nombres de producto, de momento, solo existen
en castellano.

**Verla funcionando:** <https://oasis-kafe-web.pages.dev> (Cloudflare). También está, con la
misma versión, en GitHub Pages: <https://pil-08.github.io/Oasis-Kafe/>

## Lo que tiene de particular

Todo vive en un único fichero HTML de unos 3,8 MB: el CSS, el JavaScript, la carta, los textos
de los cuatro idiomas y las fotos. Se abre con doble clic, se puede mandar por WhatsApp o
subir a cualquier hosting. No hay framework, ni gestor de paquetes, ni paso de compilación:
se edita el fichero y se publica. Lo único que se pide a otros servidores son las tipografías
(Fraunces y Karla, de Google Fonts) y el mapa de Google.

La carta tampoco está repartida por el código. Es un bloque de JSON dentro del propio HTML, de
modo que cambiar un precio es cambiar un número.

Hay tres decisiones que conviene conocer. La primera es de seguridad: `docs/_headers` fija una
política de contenidos que no deja cargar scripts de otros dominios, hacer peticiones de red
desde la página ni enviar formularios. Sí admite scripts y estilos incrustados, porque la web
es un solo fichero, y si algún día se añade algo externo hay que permitirlo ahí a propósito.

La segunda tiene que ver con los alérgenos. Los filtros de la carta salen de las etiquetas que
existen de verdad, y una etiqueta solo se pone donde el negocio la afirma, de modo que no hay
un botón de «sin gluten» sin dato detrás. Un filtro que promete de más es peor que no tener
filtro.

La tercera es el movimiento: todas las animaciones respetan el «reducir movimiento» que el
visitante tenga activado en su sistema. Al abrir la web sale una intro de marca de unos cuatro
segundos, con el sombrero del logo cayendo, que se salta con un toque; con «reducir movimiento»
se queda en un fundido suave. Desde el rediseño de octubre de 2026 no queda ninguna excepción: el
donut de la portada dejó de ser un dibujo flotante.

A los buscadores el negocio les llega como datos estructurados (`CafeOrCoffeeShop`, con
dirección y horario).

## Cómo se trabaja con ella

El manual para mantenerla (cambiar precios, publicar, lo que no hay que tocar y las dudas que
siguen abiertas con el negocio) está en [MANTENIMIENTO.md](MANTENIMIENTO.md).

## Un poco de historia

La web nació de un generador en Python, que se conserva en `generador-antiguo/`. El 2 de
septiembre de 2026 se dejó de usar y se pasó a editar el HTML directamente; esa carpeta ya no
refleja la web actual y se guarda solo como referencia.

En octubre de 2026 se rehízo la portada, los principios, los donuts, «Cómo encontrarnos», la
cita, el horario y el pie, con la paleta de siempre y un botón de WhatsApp en la portada; la
carta y el pedido quedaron como estaban. La versión anterior se conserva en la rama
`respaldo-version-antigua` (etiqueta `respaldo-antes-del-rediseno`).

## Autoría

Hecha por Samuel Pil, estudiante de Informática en la UPV, en Donostia
([LinkedIn](https://www.linkedin.com/in/samuel-pil)).

Es un trabajo para un cliente: el nombre, el logotipo y la carta son de Oasis Kafe y no se
ofrecen para reutilizarlos.
