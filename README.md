# Oasis Kafe

La web de una cafetería y pastelería de Antiguo, en Donostia. Tiene la carta entera, con más
de setenta productos; el horario, con su puntito verde o rojo según estén abiertos o no; y un
carrito que va preparando el pedido para mandarlo por WhatsApp. Se lee en castellano,
euskera, inglés y francés.

**Verla funcionando:** <https://oasis-kafe-web.pages.dev>

## Lo que tiene de particular

Todo vive en un único fichero HTML de unos 3,7 MB: el CSS, el JavaScript, la carta, los textos
de los cuatro idiomas y las fotos. Se abre con doble clic, se puede mandar por WhatsApp o
subir a cualquier hosting. No hay framework, ni gestor de paquetes, ni paso de compilación:
se edita el fichero y se publica.

La carta tampoco está repartida por el código. Es un bloque de JSON dentro del propio HTML, de
modo que cambiar un precio es cambiar un número.

Algunos detalles que se cuidaron:

- **Cabeceras de seguridad estrictas.** `docs/_headers` fija una política de contenidos que no
  permite cargar scripts de terceros, hacer peticiones de red desde la página ni enviar
  formularios. Si algún día se añade algo externo, hay que permitirlo ahí a propósito.
- **Los filtros de la carta salen de las etiquetas que existen de verdad.** Una etiqueta solo
  se pone donde el negocio la afirma, así que no hay un botón de «sin gluten» sin dato detrás.
  En alérgenos, un filtro que promete de más es peor que no tener filtro.
- **Respeta el «reducir movimiento»** que el visitante tenga activado en su sistema.
- **Datos estructurados** de tipo `CafeOrCoffeeShop`, con dirección y horario, para que los
  buscadores puedan leer bien el negocio.

## Cómo se trabaja con ella

El manual para mantenerla (cambiar precios, publicar, lo que no hay que tocar y las dudas que
siguen abiertas con el negocio) está en [MANTENIMIENTO.md](MANTENIMIENTO.md).

## Un poco de historia

La web nació de un generador en Python, que se conserva en `generador-antiguo/`. El 2 de
septiembre de 2026 se dejó de usar y se pasó a editar el HTML directamente; esa carpeta ya no
refleja la web actual y se guarda solo como referencia.

## Autoría

Hecha por Samuel Pil, estudiante de Informática en la UPV, en Donostia
([LinkedIn](https://www.linkedin.com/in/samuel-pil)).

Es un trabajo para un cliente: el nombre, el logotipo y la carta son de Oasis Kafe y no se
ofrecen para reutilizarlos.
