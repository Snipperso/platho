# Política de Privacidad

Última actualización: 18 de agosto de 2026

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
- Tu historial de mensajes y tus borradores.
- Tus ajustes, incluida una clave de API opcional de un proveedor público de nodos TON.

Estos datos se guardan en el almacenamiento local de tu navegador y se cifran con
una contraseña que tú eliges (AES-GCM-256 con derivación de claves
PBKDF2-SHA-256). Nunca los recibimos. Borrar los datos de tu navegador los
elimina y, sin tu frase de recuperación, ni nosotros ni nadie más podemos
restaurarlos.

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

## Terceros con los que contacta tu dispositivo

La aplicación no tiene ningún servidor nuestro con el que comunicarse, así que se
comunica directamente con la infraestructura pública de TON. Cuando usas Platho,
tu navegador envía solicitudes a:

- `toncenter.com`
- `tonapi.io`
- `mainnet-v4.tonhubapi.com`

Estos proveedores ven necesariamente tu dirección IP y las solicitudes que hace
tu dispositivo, y operan bajo sus propias políticas de privacidad, que nosotros
no controlamos. Este es el único punto en el que información sobre ti sale de tu
dispositivo hacia una parte distinta de la propia cadena de bloques. Si usas una
VPN o la red Tor, estos proveedores ven eso en su lugar.

Si aportas tu propia clave de API de uno de estos proveedores, se almacena
localmente en tu dispositivo y se envía únicamente a ese proveedor.

## Telegram Mini App

Platho también puede ejecutarse dentro de Telegram como Mini App. En ese modo es
el propio Telegram el que determina qué proporciona a la aplicación y qué
registra sobre tu uso de Telegram; eso se rige por la política de privacidad de
Telegram, no por esta.

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
