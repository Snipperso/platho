# Política de Privacidad

Última actualización: 22 de octubre de 2026

Platho es un mensajero sin backend. Este documento es breve porque hay muy poco
que revelar, y es concreto allí donde algo sale realmente de tu dispositivo.

## Qué recopilamos

Nada.

No existe ningún servidor de Platho. La aplicación es una página estática que se
ejecuta por completo en tu navegador. No operamos ningún sistema de cuentas,
ninguna base de datos de usuarios, ninguna analítica, ningún informe de fallos y
ninguna publicidad. No podemos ver tus mensajes, tus contactos, tu saldo ni tu
actividad, porque nada de ello se nos envía.

No pedimos una dirección de correo electrónico, un número de teléfono ni un
nombre.

## Qué permanece en tu dispositivo

- Tu frase de recuperación de 24 palabras, y las claves de la billetera y de mensajería derivadas de ella.
- Tu historial de mensajes. (Un borrador sin enviar solo se guarda en memoria y desaparece al cerrar la página).
- Los nombres que das a tus contactos, y cuáles fijaste o dejaste de marcar como no leídos.
- Los nombres que les pones a tus billeteras: se guardan como texto normal para que la pantalla de bloqueo pueda mostrarlos antes de cualquier contraseña.
- Tus ajustes, incluida una clave de API opcional de un proveedor público de nodos TON.

Nada de esto llega hasta nosotros, y no todo está protegido igual, así que se
nombra cada elemento por separado en lugar de hacer una sola afirmación:

- **La frase de recuperación y las claves derivadas de ella** se cifran con una
  contraseña que tú eliges (AES-GCM-256, derivación de claves PBKDF2-SHA-256). Sin
  esa contraseña no pueden leerse, ni por nosotros ni por quien tenga el
  dispositivo.
  Si un gestor de contraseñas guarda esa contraseña por ti, la billetera de este
  dispositivo está tan protegida como ese gestor: normalmente, tu cuenta en el
  dispositivo y, si sincroniza, su nube.
- **El historial de mensajes, las claves de tus conversaciones y grupos, los nombres que das a tus contactos y el registro de quién te escribió primero**
  están cifrados con claves derivadas de tu frase de recuperación. Esas claves
  solo existen mientras tu billetera está desbloqueada y nunca se escriben en el
  dispositivo, así que una copia de los archivos del navegador —una copia de
  seguridad, una imagen de disco, otra cuenta en el mismo ordenador— no puede
  leer nada de ello sin tu contraseña: ni los mensajes, ni las claves, ni los
  nombres. En un dispositivo que guarda tu billetera, lo mismo vale para lo que la aplicación conserva para mostrar rápido imágenes, perfiles y publicaciones, y para los canales públicos que sigues y hasta dónde los has leído.
- **Los ajustes** —tema, idioma— se guardan como texto normal, y nada de ello nos llega. Igual se guardan los canales
  públicos que sigues y hasta dónde los has leído en un dispositivo sin billetera, hasta que se cree o se restaure una en él.
  El único secreto entre ellos, la clave API opcional de un proveedor de nodos, se sella
  con una clave que tu navegador guarda en este dispositivo en lugar de guardarse
  como texto plano.

Borrar los datos de tu navegador elimina todo ello del dispositivo. Lo que tu
frase de recuperación puede recuperar viene de la cadena: tus mensajes están
publicados allí, y las claves que abren tus conversaciones y grupos, tus notas y
tus suscripciones también se guardan allí, cifradas con una clave derivada de la
frase; sin ella nadie, tampoco nosotros, puede leerlos ni restaurarlos. Dentro de
Telegram puedes guardar una copia más, descrita más abajo en Telegram Mini App:
una copia cifrada de tu billetera a la que no llega el borrado de los datos del
navegador.

## Qué es público por diseño

**Los mensajes privados se cifran en tu dispositivo** antes de publicarse, y solo
el destinatario previsto puede leer su contenido.

**Las publicaciones públicas no están cifradas.** Se escriben en la cadena de
bloques TON en texto plano y son permanentes: ni nosotros, ni un administrador,
ni un gobierno, ni tú como autor podéis eliminarlas. No publiques nada de forma
pública que pudieras necesitar retirar después.

La cadena de bloques es un registro público. Incluso en el caso de los mensajes
cifrados, el hecho de que se haya producido una transacción, su hora y su coste
son visibles para cualquiera. Las direcciones de billetera son públicas. Si
vinculas una dirección a tu identidad en otro lugar, la actividad de esa
dirección puede asociarse contigo.

**Las denuncias y las reacciones son transacciones públicas desde tu billetera.**
Cuando denuncias una publicación o reaccionas a ella, la transacción la envía tu
billetera a una dirección que cualquiera puede calcular a partir de la
publicación, así que cualquiera —incluido el autor de esa publicación— puede ver
qué billetera denunció o reaccionó. Una denuncia desestimada y una sanción
levantada deshacen su efecto, no el registro: la transacción permanece en la
cadena para siempre.

## Terceros con los que contacta tu dispositivo

La aplicación no tiene ningún servidor nuestro con el que comunicarse, así que se
comunica directamente con la infraestructura pública de TON. Cuando usas Platho,
tu navegador envía solicitudes a:

- `toncenter.com`
- `tonapi.io`
- `nft.fragment.com`

Estos proveedores ven necesariamente tu dirección IP y las solicitudes que hace
tu dispositivo, y operan bajo sus propias políticas de privacidad, que nosotros
no controlamos. Salvo lo que elijas guardar en Telegram (ver Telegram Mini App
más abajo), este es el único punto en el que información sobre ti sale de
tu dispositivo hacia una parte distinta de la propia cadena de bloques. Si usas
una VPN o la red Tor, estos proveedores ven eso en su lugar.

Si aportas tu propia clave de API de uno de estos proveedores, se almacena en tu
dispositivo y se envía únicamente a ese proveedor; y, si guardas tu billetera en
Telegram, también se guarda allí, cifrada, junto a la copia de la billetera (ver
más abajo).

## Telegram Mini App

Platho también puede ejecutarse dentro de Telegram como Mini App. En ese modo es
el propio Telegram el que determina qué proporciona a la aplicación y qué
registra sobre tu uso de Telegram; eso se rige por la política de privacidad de
Telegram, no por esta.

En ese modo tu billetera vive en uno de dos lugares, y eliges cuál en Ajustes →
«Dónde se guarda la billetera». **De forma predeterminada vive solo en este
dispositivo**: no se envía ninguna copia de ella a Telegram (solo las pequeñas
marcas descritas más abajo), y si se pierden los datos del dispositivo —Telegram
puede borrar el almacenamiento de una aplicación, sobre todo en iPhone—, solo
sus 24 palabras o su archivo de clave la recuperan.

**Si eliges guardarla en Telegram, una copia cifrada de tu billetera se guarda
en el almacenamiento en la nube de Telegram** (CloudStorage), para que cualquier
dispositivo con sesión iniciada en tu cuenta de Telegram pueda abrirla con tu
contraseña. La copia es el mismo registro cifrado con tu contraseña que guarda
tu dispositivo: la frase de recuperación y la dirección de la billetera están
dentro del cifrado. Junto a ellas están los parámetros necesarios para
descifrarla y un identificador derivado de la frase de recuperación, con el que
la aplicación reconoce su propia copia; sin la frase, ese identificador no puede
vincularse a tu dirección (tu archivo de clave lo lleva junto a la dirección).
Telegram guarda la copia en sus servidores y la asocia a tu cuenta de Telegram;
sin tu contraseña no se puede descifrar, así que elige una contraseña fuerte que
no uses en ningún otro sitio. Si aportaste una clave de API de un proveedor de
nodos, se guarda junto a la copia, cifrada con una clave derivada de tu frase de
recuperación. Cada copia lleva además un número de versión, con el que la aplicación sabe qué copia es más reciente, y una firma hecha con una clave derivada de la frase de recuperación, con la que la aplicación comprueba que la copia y su versión proceden de tu billetera.

Cada billetera que guardas en Telegram tiene allí su propia copia, cifrada con la contraseña de esa billetera; crear o elegir otra billetera en un dispositivo no borra ninguna. Todo dispositivo con tu cuenta de Telegram iniciada muestra las billeteras guardadas allí —en su pantalla de bloqueo y en Ajustes → «Otras billeteras»—, y cada una se abre con su propia contraseña. Cuando cambia la contraseña de una billetera, su copia en Telegram toma la nueva. Las billeteras usadas antes en un dispositivo se conservan en él de la misma manera.

En la nube de Telegram se guardan además algunos valores pequeños: una nota de
que cerraste el inicio rápido, una marca de que confirmaste las 24 palabras de
una billetera y, mientras no se haya guardado el archivo de clave de una
billetera, un indicador; la marca y el indicador solo puede reconocerlos esa
billetera. Ninguno de ellos contiene una dirección. La aplicación escribe en la
nube de Telegram solo cuando Telegram confirma que se abrió desde el bot oficial
@PlathoBot. Cuando Telegram guarda una copia de una billetera, el nombre que le
pongas se guarda junto a ella, cifrado con una clave derivada de la frase de
recuperación de esa billetera —Telegram no puede leerlo— y se borra con la
última copia que haya allí.

«Borrar la copia de Telegram» elimina la copia de tu billetera que hay allí y la clave de API guardada junto a ella; «Olvidar esta billetera» elimina una billetera de «Otras billeteras» en este dispositivo y su copia en Telegram. La opción «Borrar datos locales» de la propia aplicación borra solo este dispositivo —no elimina nada de Telegram—, y borrar la caché de Telegram o los datos del navegador deja las copias de Telegram donde están. Fuera de Telegram, la billetera no se copia a ninguna parte.

## Menores

Platho no está dirigido a menores de 13 años.

## Cambios

Si esta política cambia, la fecha que figura arriba cambia con ella. La versión
vigente es siempre la publicada en la aplicación y en platho.app.

## Idioma

Este documento se publica en varios idiomas. Las traducciones se ofrecen por comodidad;
si difieren, la versión en inglés es la que prevalece.

## Contacto

Preguntas sobre esta política: https://t.me/plathoapp
