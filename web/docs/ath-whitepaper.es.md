# Libro blanco de ATH

## El token del protocolo Platho

ATH es el token de utilidad de Platho. Se utiliza para recompensas por actividad, descuentos en las comisiones del protocolo tras el airdrop, nombres de usuario `.ath`, actualizaciones del avatar del perfil, ventas de estabilidad de mercado, recompra y quema.

ATH no es un token administrativo. No otorga la capacidad de reescribir saldos, pausar operaciones, acuñar nueva oferta ni cambiar las reglas de propiedad de los usuarios. Su función es impulsar la economía de la aplicación y conectar el uso de Platho con la contabilidad on-chain.

Este documento describe el modelo de ATH en Platho v1.

## Parámetros principales

ATH tiene una oferta total fija:

```text
100,000,000 ATH
```

ATH utiliza 9 decimales:

```text
1 ATH = 1,000,000,000 atomic units
```

Oferta total en unidades atómicas:

```text
100,000,000,000,000,000
```

El precio de referencia de lanzamiento es:

```text
1 ATH = 0.001 GRAM
```

La valoración totalmente diluida en el lanzamiento es:

```text
100,000,000 ATH * 0.001 GRAM = 100,000 GRAM
```

ATH parte de una capitalización de referencia de `100,000 GRAM`.

## Oferta fija

ATH es emitido por `ATHMaster`. En la inicialización, `ATHMaster` fija la oferta total en `100,000,000 ATH`.

No existe una función de acuñación posterior al génesis. `ATHMaster` no implementa acuñación administrativa, pausa, lista negra, impuesto sobre transferencias, transferencia forzada ni drenaje de rescate.

El despliegue de la oferta inicial se realiza una sola vez mediante `DeployTreasurySupply`. Envía la oferta completa al monedero ATH de tesorería. El despliegue de la oferta génesis no puede repetirse.

La oferta total solo disminuye mediante la quema. `ATHMaster` acepta una quema únicamente tras una notificación de quema autenticada procedente del monedero ATH determinista de la dirección propietaria. Tras la verificación, `ATHMaster` reduce `total_supply` y envía `ATHBurnFinalized`.

La quema de ATH es una reducción real de la oferta total, no una transferencia a una dirección sin uso.

## Asignación de la oferta

La oferta de ATH se asigna en cuatro categorías:

| Categoría | Porcentaje | Cantidad |
| --- | ---: | ---: |
| Airdrop por actividad | 15% | 15,000,000 ATH |
| Liquidez inicial | 15% | 15,000,000 ATH |
| Vesting a largo plazo del protocolo | 10% | 10,000,000 ATH |
| Reserva de estabilidad de mercado | 60% | 60,000,000 ATH |

Esta asignación define la estructura económica de Platho:

- El 15% de la oferta se distribuye a los usuarios mediante la actividad en la aplicación antes del lanzamiento del pool.
- El 15% de la oferta se destina a liquidez inicial.
- El 10% de la oferta queda bloqueado en un vesting inmutable a largo plazo.
- El 60% de la oferta se reserva para MarketStabilitySeller y se vende en tramos por encima del precio de lanzamiento tras la congelación de precios posterior al pool y la comprobación de disponibilidad de financiación de la reserva.

El airdrop por actividad y la reserva de vesting a largo plazo están respaldados en el génesis final por los monederos ATH oficiales de Vault y ATHVesting, y el verificador de la versión comprueba esos saldos antes de la publicación en producción. La asignación de estabilidad de mercado de `60,000,000 ATH` está reservada para MarketStabilitySeller, pero no se financia en el seller en el génesis final. La financiación del seller solo ocurre tras el lanzamiento del pool, la congelación de precios única vinculada a evidencias y el flujo de notificación del financiador de reserva vinculado; la disponibilidad del seller solo es válida tras verificarse `reserve_due_ath`, `reserve_funded_total_ath` y el respaldo del monedero ATH oficial del seller.

## Vesting a largo plazo del protocolo

La reserva de vesting a largo plazo es:

```text
10,000,000 ATH
```

Está en poder de `ATHVesting`, no de un bucket de tesorería mutable. El calendario de vesting está fijado en el contrato:

```text
100,000 ATH per 365-day period
100 periods
10,000,000 ATH total
```

Cualquiera puede activar una reclamación una vez que el ATH ha entrado en vesting, pero el beneficiario es inmutable. El contrato no tiene función de aceleración, cambio de beneficiario, pausa, barrido administrativo, drenaje de rescate ni liberación discrecional.

En el génesis final, el `ATHWallet(owner = ATHVesting, master = ATHMaster)` oficial debe contener exactamente `10,000,000 ATH`. El verificador también exige cero ATH reclamado, fase inactiva y ninguna transferencia pendiente antes del lanzamiento.

Esta reserva es intencionadamente lenta. Crea un horizonte largo para el desarrollo del protocolo sin colocar un bucket líquido de 10M ATH por encima del mercado en el lanzamiento.

## Airdrop por actividad

El airdrop por actividad es:

```text
15,000,000 ATH
```

Recompensa por cada publicación exitosa:

```text
10 ATH
```

La recompensa se acredita en el saldo interno de ATH del usuario en Vault tras una publicación exitosa. Una publicación exitosa significa que Vault envió el payload a CapsuleHub, CapsuleHub aceptó la entrada y Vault recibió la confirmación.

Los intentos de publicación fallidos no generan recompensas por actividad.

Contabilidad de la recompensa:

```text
user.ath_balance += 10 ATH
airdrop_remaining -= 10 ATH
```

Si el bucket restante del airdrop es inferior a 10 ATH, se acredita la cantidad restante. Una vez que el bucket se agota, dejan de generarse nuevas recompensas por actividad.

El airdrop por actividad se contabiliza en Vault y está respaldado por el monedero ATH oficial de Vault prefinanciado.

Los depósitos de ATH en Vault solo se admiten a través del flujo de transferencia-con-notificación del ATHWallet del usuario
(`ATHTransferRequestWithNotify`) hacia Vault. Una transferencia ordinaria manual de ATH al ATHWallet oficial de Vault no está
admitida: puede aumentar el saldo bruto del monedero oficial, pero no crea `Vault.user.ath_balance` y no debe
mostrarse en la PWA como una vía de depósito.

Los retiros de ATH de Vault son comandos externos firmados de Vault. La reserva de despliegue, transferencia, almacenamiento y
ejecución de ACK del ATHWallet posterior se paga con el saldo interno de GRAM del usuario en Vault. Vault solo reacredita el valor
de ACK/fallo/rebote autenticado que recibe, menos la reserva local de reembolso y limitado por el valor interno reservado. El texto del producto
no debe prometer un reembolso completo del excedente de GRAM.

## Precio de la actividad

El texto público del producto puede indicar que los mensajes parten del precio base público exacto actual:

```text
from 0.0337 GRAM
```

Los ejemplos canónicos exactos actuales antes del descuento de ATH son:

```text
public post: 0.0337 GRAM
hybrid private 1 KiB capsule: 0.0347 GRAM
```

Por una publicación exitosa, el usuario recibe:

```text
10 ATH
```

Al precio de referencia de lanzamiento:

```text
10 ATH * 0.001 GRAM = 0.01 GRAM
```

Esto vincula la distribución temprana de ATH con el uso real de la aplicación. La recompensa es un bono por actividad, no un reembolso, cashback,
descuento ni promesa de que ATH compensará el coste en GRAM de una publicación. El valor de referencia de lanzamiento de `10 ATH` puede ser
inferior al coste en GRAM de la cápsula, y eso es intencionado: los usuarios reciben propiedad temprana de la red por el uso real,
no un reembolso garantizado.

El texto del producto puede resumir la tarificación de las cápsulas como mensajes desde `0.0337 GRAM`; los ejemplos canónicos exactos actuales son publicaciones públicas de 1 KiB desde `0.0337 GRAM` y cápsulas privadas híbridas de 1 KiB desde `0.0347 GRAM`. Los bloques de cápsula públicos o privados más grandes cuestan más porque el
cuerpo seleccionado de 1, 2, 4, 8, 16 o 32 KiB cambia la reserva de ejecución y almacenamiento de Vault/CapsuleHub. La recompensa se mantiene en `10 ATH` por cada
cápsula finalizada con éxito, independientemente del tamaño de la cápsula.

La publicación privada utiliza el perfil de seguridad híbrido de forma predeterminada: X25519 + ML-KEM-768 + AES-GCM. No existe un modo de mensaje privado clásico más barato en V1.

ATH puede cotizar por encima o por debajo del precio de referencia de lanzamiento una vez que el pool oficial exista. La documentación del protocolo no debe presentar
la recompensa por actividad como retorno de inversión, expectativa de beneficio ni garantía de precio.

## Comisión del protocolo y precio para el usuario

Dentro de Vault, la comisión del protocolo es distinta del coste total de cara al usuario.

Comisión del protocolo:

| Tipo de publicación | Comisión del protocolo |
| --- | ---: |
| Publicación pública | 0.010 GRAM |
| Mensaje privado híbrido | 0.010 GRAM |

El precio de cara al usuario incluye la comisión del protocolo, la dotación de almacenamiento compacto de índice/cabecera, la reserva de ejecución local de Vault y el reembolso esperado del ACK:

| Tipo de publicación | Precio de cara al usuario |
| --- | ---: |
| Etiqueta pública/de producto | from 0.0337 GRAM |
| Ejemplo exacto actual de publicación pública | 0.0337 GRAM |
| Ejemplo exacto actual de privado híbrido de 1 KiB | 0.0347 GRAM |

Si la PWA recibe una estimación de red conservadora más alta, añade el excedente estimado al cargo máximo canónico, redondeado hacia arriba a pasos limpios de `0.001 GRAM`. Los descuentos de ATH se aplican a la comisión del protocolo, no a los costes de red ni a las reservas de almacenamiento. Este recargo es un margen de seguridad firmado: si CapsuleHub acepta la publicación, el ACK de éxito devuelve solo la reserva fija del ACK de publicación de `30,000,000` nanotons (`0.030 GRAM`). Tras procesar Vault ese ACK, se acreditan al usuario aproximadamente `25,800,000` nanotons en el saldo interno de GRAM de Vault. La parte por encima del valor requerido canónico permanece en CapsuleHub como excedente de reserva de red/almacenamiento. No se devuelve a Vault y no se contabiliza como `accrued_plato_fee_ton` en el momento de la publicación. Solo el excedente bruto por encima de la reserva protegida de CapsuleHub puede barrerse más tarde de forma permisiva hacia FeeAccumulator, donde sigue la contabilidad normal de tesorería/recompra. CapsuleHub almacena metadatos de entrada compactos y autenticados y el hash del cuerpo; el cuerpo pesado se recupera del historial de transacciones de publicación aceptadas y se verifica localmente.

## Descuentos de ATH

ATH reduce las comisiones del protocolo de los mensajes después de que el airdrop por actividad se haya distribuido por completo.

Los descuentos se desbloquean solo cuando el airdrop por actividad restante es:

```text
airdrop_remaining_ath == 0 ATH
```

Antes de este punto, la comisión del protocolo se paga íntegramente.

Umbral de descuento completo:

```text
10,000 ATH
```

Si el saldo interno de ATH del usuario en Vault es de al menos `10,000 ATH`, el usuario alcanza el nivel de descuento completo de la comisión del protocolo para el componente de comisión de Platho. Los costes de red y las reservas de almacenamiento siguen pagándose.

Si el saldo es inferior a `10,000 ATH`, la comisión disminuye linealmente:

```text
raw_discounted_fee = ceil(full_fee * (10,000 ATH - min(user_ath_balance, 10,000 ATH)) / 10,000 ATH)
discounted_fee = raw_discounted_fee
```

El cálculo redondea hacia arriba. Con las constantes actuales, la comisión completa del protocolo es de `0.010 GRAM` (`10,000,000 nanotons`) tanto para cápsulas públicas como privadas, y la reducción máxima es de `0.010 GRAM` por cápsula.

## Lanzamiento del pool

El pool ATH/GRAM se lanza después de que se haya distribuido el airdrop por actividad completo de `15,000,000 ATH`.

La secuencia de lanzamiento es:

1. Los usuarios reciben ATH mediante el uso real de Platho.
2. Se distribuye el airdrop por actividad completo.
3. Se desbloquean los descuentos de ATH.
4. Se lanza el pool ATH/GRAM.
5. Se congelan las evidencias de ruta posterior al pool y las evidencias de precios.
6. Se habilita la división de recompra.

El pool parte del precio de referencia:

```text
1 ATH = 0.001 GRAM
```

Asignación de liquidez inicial:

```text
15,000,000 ATH
```

Lado de GRAM al precio de lanzamiento:

```text
15,000,000 ATH * 0.001 GRAM = 15,000 GRAM
```

No se espera que las comisiones del protocolo recaudadas antes del lanzamiento del pool financien por completo el lado de GRAM de la liquidez inicial. El
plan de liquidez inicial puede requerir financiación del proyecto/tesorería además de los ingresos del protocolo. Esto forma parte del bootstrap de lanzamiento
y no convierte las recompensas por actividad en un derecho denominado en GRAM.

El pool se lanza en torno a un token que ya se ha distribuido mediante el uso de la aplicación. Esto separa a ATH de un listado vacío sin base de usuarios.

## FeeAccumulator

Las comisiones del protocolo en GRAM se recaudan en `FeeAccumulator`.

Antes de habilitar la división de recompra, todo el GRAM acumulado se mueve al bucket de tesorería:

```text
accumulated_ton -> treasury_due_ton
```

`buyback_due_ton` no crece antes de habilitar la división.

Tras `EnableBuybackSplit`, el GRAM acumulado se divide:

```text
50% -> treasury_due_ton
50% -> buyback_due_ton
```

Si la cantidad es impar en nanotons, el resto permanece en el lado de la recompra:

```text
treasury_amount = floor(amount * 50%)
buyback_amount = amount - treasury_amount
```

`EnableBuybackSplit` es una acción unidireccional ejecutada por el receptor de tesorería inmutable tras el lanzamiento del pool y la
congelación de la ruta de recompra. Se trata de una autoridad real de una sola vez: no puede robar fondos, pausar, rescatar ni cambiar direcciones, pero cambia permanentemente
la economía de FeeAccumulator, de la acumulación de bootstrap solo en tesorería a la división 50/50 tesorería/recompra. Se
habilita únicamente después de que pase la comprobación previa a la publicación.

Las autoridades de publicación de Platho son deliberadamente estrechas y, en su mayoría, de un solo uso. Aun así existen y deben nombrarse honestamente:
el propietario de la tesorería despliega la oferta inicial de ATH una vez; el controlador del génesis realiza la vinculación previa al sellado y el sellado;
el controlador de lanzamiento de BuybackBurn congela la ruta posterior al pool una vez; la congelación de precios de MarketStabilitySeller la realiza
una vez su controlador de lanzamiento; y el receptor de tesorería de FeeAccumulator habilita la división de recompra unidireccional tras la comprobación previa. Ninguno de estos
roles es un mecanismo de rescate, pausa, actualización, drenaje administrativo ni control arbitrario de saldos.

## Recompra y quema

La recompra se ejecuta a través de `FeeAccumulator` y `BuybackBurn`.

BuybackBurn acepta únicamente un sobre de ejecución completo:

```text
51.05 GRAM
```

Estructura del sobre:

```text
50.00 GRAM  - STON.fi offer amount
1.00 GRAM   - route forward gas
0.05 GRAM   - pTON transfer gas
```

Un `50 GRAM` en bruto no es un fragmento de recompra válido. La recompra se acepta únicamente como un sobre de ruta completo.

Tras la congelación de la ruta, BuybackBurn ejecuta una recompra de la siguiente manera:

1. Acepta `51.05 GRAM` únicamente del FeeAccumulator vinculado.
2. Registra la cantidad en `reserve_due_ton`.
3. En `ExecuteBuybackChunk`, consume un sobre.
4. Utiliza la cotización congelada y el minOut congelado.
5. Establece el deadline de STON.fi internamente.
6. Envía la ruta a través del monedero pTON congelado.
7. Acepta ATH únicamente a través del monedero ATH oficial de BuybackBurn.
8. Verifica que el monedero de origen coincide con el pool de STON.fi congelado.
9. Envía el ATH recibido a quema a través del monedero ATH oficial.
10. Completa el ciclo solo tras `ATHBurnFinalized` de `ATHMaster`.

El éxito de la recompra no se define por un mensaje del router, una solicitud de quema saliente ni una notificación de quema del ATHWallet. Se define
únicamente cuando BuybackBurn recibe un `ATHBurnFinalized` autenticado de ATHMaster. Hasta que llega esa finalización,
BuybackBurn debe seguir tratándose como estado de quema pendiente o de reintento; los paneles e indexadores no deben contar el ATH como
quemado simplemente porque se haya enviado un intento de quema.

Si la quema no se finaliza, el ATH recibido pasa a la deuda de reintento. `RetryAthBurnDue` quema la totalidad de la deuda de reintento.

## Comisiones de nombres de usuario

El registro de nombres de usuario `.ath` se paga en ATH a través del monedero ATH oficial de UsernameRegistry.

Precios:

| Longitud del nombre | Precio |
| ---: | ---: |
| 4 caracteres | 10,000 ATH |
| 5 caracteres | 1,000 ATH |
| 6+ caracteres | 100 ATH |

UsernameRegistry acepta únicamente el precio exacto. Pagar de menos o de más no crea un nombre.

Una acuñación aceptada pasa por el estado pendiente y despliega `UsernameNFTItem`. Antes de la confirmación del item, el pago no se reconoce como ingreso. Tras la confirmación del item, la cantidad se divide:

```text
50% -> treasury_due_ath
50% -> burn_due_ath
```

La acuñación actual de nombres de usuario en V1 se financia desde Vault. Los rechazos por nombre de usuario inválido, precio incorrecto o nombre duplicado rebotan a través de la
vía de notificación del monedero ATH oficial para que Vault pueda restaurar el ATH interno del usuario. UsernameRegistry no mantiene un
bucket directo externo de reembolso de nombres de usuario en el flujo actual financiado por Vault.

El ATH de la acuñación de nombres de usuario se convierte en ingreso del protocolo solo tras confirmarse el despliegue del item correspondiente.

La autoridad sobre los nombres de usuario se divide deliberadamente: `UsernameRegistry` ancla el nombre a un único `UsernameNFTItem` exacto, y el
estado del item lleva el propietario actual. Las transferencias del item transfieren el nombre de usuario. El item expone datos NFT estándar
y metadatos on-chain TEP-64, incluido `name = <username>.ath`; no depende de un servidor de Platho para los metadatos.
Los bytes del nombre de usuario en V1 son literales y no se normalizan para su visualización: los nombres iniciales, finales, consecutivos y compuestos solo por separadores son
válidos cuando cada byte pertenece al conjunto permitido `a-z`, `0-9`, `_`, `-` y la longitud es 4..16.
Si se intentó el despliegue del item pero el ACK del item nunca llegó al registro, `PrunePendingUsernameMint` es intencionadamente
no destructivo en V1: no adivina el fallo, no borra el estado pendiente ni crea deuda de reembolso. La vía de recuperación es un
`UsernameItemDeployedAck` tardío o `UsernameNFTItem.ResendDeployedAck`, de modo que un item inicializado aún puede volverse autoritativo.
Si el despliegue del item rebota realmente, el registro pide al monedero ATH oficial que reembolse la notificación pendiente.
Un `UsernameNFTItem` desplegado sin que `UsernameRegistry.name_records[name_hash]` apunte a ese item exacto es
no autoritativo: los clientes, indexadores y la interfaz no deben tratar el item por sí solo como propiedad del nombre `.ath`, y no deben
usar el propietario del registro como el propietario actual tras las transferencias.

## Comisiones del avatar de perfil

Coste de actualización del avatar de perfil:

```text
100 ATH
```

Las actualizaciones actuales del avatar de perfil en V1 se financian desde Vault. La PWA envía `SetProfileAvatarFromVaultBalance` a Vault; Vault paga a través de la vía de notificación de su monedero ATH oficial hacia el monedero ATH oficial de ProfileRegistry. El pago del avatar directamente desde el monedero del usuario no es un flujo de producto admitido en V1.

ProfileRegistry acepta la actualización solo cuando se cumplen todas las condiciones:

- la cantidad es exactamente `100 ATH`;
- el remitente es el monedero ATH oficial de ProfileRegistry;
- el monedero pagador es el Vault vinculado;
- el monedero propietario está en basechain;
- el hash del avatar no es cero;
- el id del stream no es cero;
- el número de partes es de 1 a 16;
- el formato de medios es WebP.

Una actualización aceptada crea una nueva versión del avatar y divide la comisión:

```text
50 ATH -> treasury_due_ath
50 ATH -> burn_due_ath
```

Una notificación de avatar rechazada se reembolsa a través de la vía de rebote de notificación del ATHWallet. ProfileRegistry no crea un bucket de reembolso separado para actualizaciones de avatar mal formadas.

ProfileRegistry almacena el puntero autenticado del avatar, no los bytes permanentes de la imagen. La PWA debe reconstruir los datos WebP del avatar a partir de entradas públicas de CapsuleHub o de la caché local y verificar los bytes contra el `avatar_hash` almacenado; el historial ausente o purgado se muestra como no disponible.

## Market Stability Seller

MarketStabilitySeller es una reserva de contrato público que distribuye ATH tras el lanzamiento del pool oficial:

```text
60,000,000 ATH
```

Su propósito es reducir la distorsión de mercado temprana causada por la liquidez escasa. En el lanzamiento, un pool pequeño puede moverse bruscamente por un grupo reducido de compradores tempranos. Si eso ocurre, los usuarios que necesitan ATH para acciones reales de Platho pueden verse obligados a comprar dentro de un pico de precio artificial.

MarketStabilitySeller crea una escalera de oferta transparente por encima del precio de lanzamiento. Vende ATH en tramos de tamaño fijo. Cada tramo siguiente es más caro que el anterior, y cada tramo tiene un límite de tamaño estricto. Tras la congelación de precios única vinculada a evidencias, el calendario de tramos es determinista y el equipo no puede cambiarlo manualmente.

Si los especuladores tempranos intentan absorber una gran cantidad de ATH, compran de la reserva pública a precios de tramo crecientes en lugar de extraer toda la liquidez barata de un pool escaso y revenderla a los usuarios. Si los usuarios corrientes necesitan ATH para Platho, pueden comprarlo a un precio de tramo público conocido sin empujar un pool pequeño verticalmente con una única ola de demanda.

La reserva no vuelca tokens en el mercado. No vende por sí sola y no crea presión de venta sin demanda. Una venta solo ocurre cuando un comprador adquiere voluntariamente del tramo actual. Si no hay demanda, la reserva permanece inactiva.

La utilidad on-chain de ATH es específica:

- el registro de nombres de usuario `.ath` se paga en ATH a través de UsernameRegistry;
- las actualizaciones del puntero del avatar de perfil se pagan en ATH a través de ProfileRegistry;
- el ATH mantenido en el saldo interno de Vault del usuario reduce la comisión del protocolo para las publicaciones de Vault tras la barrera de distribución por actividad;
- las comisiones aceptadas de nombres de usuario y avatares crean deuda de tesorería y deuda de quema;
- BuybackBurn compra ATH con las comisiones del protocolo en GRAM y quema el ATH recibido a través de ATHMaster.

Las publicaciones de Vault se pagan en GRAM. ATH no paga la transacción de publicación completa. Reduce el componente de comisión del protocolo una vez abierta la barrera de descuento.

Esto hace que la demanda de ATH esté ligada a acciones concretas del protocolo: nombres `.ath`, actualizaciones de avatar, descuentos en la comisión del protocolo de Vault tras el airdrop y presión de recompra/quema. MarketStabilitySeller expande la oferta disponible solo a medida que los compradores toman el siguiente tramo, de modo que el acceso temprano es público y determinista en lugar de estar dominado por un pool escaso.

La reserva se vende únicamente tras la congelación de precios posterior al pool.

La congelación de precios es una autoridad de lanzamiento real de una sola vez. Fija el precio base del tramo una vez a partir de la evidencia del lanzamiento del pool, y luego se borra el hash del controlador de lanzamiento. Después de eso, MarketStabilitySeller no puede robar fondos, pausar ventas, rescatar saldos, anular a los compradores ni mutar el calendario de precios.

La disponibilidad de MarketStabilitySeller es una barrera posterior al pool, no un sustituto de la verificación del génesis final. La secuencia
de producción es: `mainnet:genesis:verify` pasa sobre la instantánea final limpia, el precio se congela tras el lanzamiento del pool, el
financiador de reserva vinculado financia el seller mediante el flujo de notificación, y luego `market-stability:readiness` comprueba el estado del seller, la financiación, la evidencia de
precios y el respaldo del monedero. La disponibilidad del seller es válida para producción solo tras pasar esa comprobación de disponibilidad.

La financiación se acepta únicamente:

- tras el sellado;
- tras la congelación de precios;
- a través del monedero ATH oficial del seller;
- desde el financiador de reserva vinculado;
- hasta el tope total de `60,000,000 ATH`.

Solo la financiación de reserva autenticada aumenta la contabilidad de reserva vendible. El runtime permite financiación de reserva parcial y venta parcial, pero la disponibilidad de lanzamiento exige la reserva completa: `reserve_due_ath == 60,000,000 ATH`, `reserve_funded_total_ath == 60,000,000 ATH` y un respaldo del monedero oficial de al menos `60,000,000 ATH`. Una transferencia ordinaria no solicitada de ATH al monedero ATH oficial del seller no aumenta `reserve_due_ath` ni `reserve_funded_total_ath`, no expande la oferta vendible y puede quedar bloqueada. La comprobación de disponibilidad trata un saldo del monedero oficial por encima de `60,000,000 ATH` como una advertencia, no como reserva adicional.

La reserva se divide en 20 tramos:

```text
20 * 3,000,000 ATH = 60,000,000 ATH
```

Cada tramo tiene un multiplicador:

```text
x2, x3, x4, ..., x21
```

Esto crea una escalera de precios suave. A medida que crece la popularidad del proyecto, el mercado recibe oferta adicional de ATH, pero cada tramo siguiente es más caro que el anterior. La demanda temprana no golpea inmediatamente un pool escaso, y el crecimiento del precio no se convierte en un muro vertical que haga incómodo usar el token de utilidad.

Fórmula de compra:

```text
price = ceil(base_tranche_price * current_multiplier * amount / 3,000,000 ATH)
```

`base_tranche_price` se congela tras el lanzamiento del pool y coincide exactamente con la evidencia de precios x1.

Al precio de lanzamiento `1 ATH = 0.001 GRAM`, el precio x1 de un tramo es:

```text
3,000,000 ATH * 0.001 GRAM = 3,000 GRAM
```

Por lo tanto:

| Tramo | Multiplicador | Precio de 3M ATH | Precio por 1 ATH |
| ---: | ---: | ---: | ---: |
| 1 | x2 | 6,000 GRAM | 0.002 GRAM |
| 2 | x3 | 9,000 GRAM | 0.003 GRAM |
| 3 | x4 | 12,000 GRAM | 0.004 GRAM |
| ... | ... | ... | ... |
| 15 | x16 | 48,000 GRAM | 0.016 GRAM |
| ... | ... | ... | ... |
| 20 | x21 | 63,000 GRAM | 0.021 GRAM |

Una única compra no puede cruzar el límite de un tramo. Esto evita comprar ATH del tramo siguiente al precio del tramo anterior.

El ingreso en GRAM se reconoce solo tras entregarse el ATH al comprador. Si la transferencia de ATH falla o rebota, se restaura la reserva, el comprador recibe de vuelta el principal en GRAM pagado y la deuda de tesorería no aumenta.

Tras venderse el tramo final x21, MarketStabilitySeller ya no regula el precio de ATH. A partir de ese punto, el precio queda plenamente determinado por el mercado: liquidez, oferta disponible, demanda de nombres `.ath`, actualizaciones de avatar, descuentos en la comisión del protocolo de Vault tras el airdrop y presión de recompra/quema.

Incluso en el escalón x21, la valoración de referencia se mantiene moderada respecto al modelo de utilidad:

```text
1 ATH = 0.021 GRAM
100,000,000 ATH = 2,100,000 GRAM
```

En el escalón x21, MarketStabilitySeller ha terminado su liberación programada de reserva. Después de eso, el precio de ATH queda plenamente determinado por el mercado según la liquidez, la demanda de uso, la oferta disponible y la presión de recompra/quema. La única asignación restante del protocolo es el calendario lento de vesting a largo plazo, limitado a `100,000 ATH` al año.

## Buckets de tesorería y quema

UsernameRegistry y ProfileRegistry usan el mismo modelo de división de comisiones en ATH:

```text
accepted ATH fee -> 50% treasury_due_ath + 50% burn_due_ath
```

El vaciado de deuda de tesorería envía ATH al receptor de tesorería a través del monedero ATH oficial.

El vaciado de deuda de quema envía una solicitud de quema de ATH a través del monedero ATH oficial. La oferta disminuye solo tras la finalización de la quema en ATHMaster.

Las vías de fallo y rebote restauran los buckets de deuda. La contabilidad se conserva hasta que se completa la transferencia o quema posterior.

## Contabilidad del ATHWallet

Los saldos de ATH residen en contratos ATHWallet deterministas.

ATHWallet gestiona:

- crédito de la oferta génesis;
- transferencia ordinaria;
- transferencia con notificación;
- notificación de acuñación de nombre de usuario;
- notificación de avatar de perfil;
- solicitud de quema;
- confirmación de notificación;
- poda de notificaciones obsoletas;
- recuperación de rebote/fallo.

Los contratos que aceptan ATH como pago no aceptan mensajes directos de direcciones arbitrarias. Aceptan notificaciones únicamente de su ATHWallet oficial. La autenticación del monedero de origen se realiza dentro de ATHWallet mediante derivación determinista del monedero.

ATH expone entrypoints de transferencia estilo TEP-74 para herramientas de jetton genéricas, pero las acciones del protocolo Platho usan mensajes de notificación de ATH autenticados. Las integraciones externas no deben asumir que los flujos de notificación de Platho emiten un `JettonTransferNotification` genérico.

Las transferencias internas salientes en ATHWallet están protegidas por contabilidad pendiente del lado de origen y confirmación del origen. El saldo no se restaura a partir de un cuerpo de rebote sin prueba de pendiente.

## Ciclo de vida de ATH

1. `ATHMaster` crea una oferta fija de `100,000,000 ATH`.
2. El despliegue de tesorería de un solo uso recibe la oferta en el monedero ATH de tesorería.
3. La oferta se asigna entre actividad, liquidez, vesting a largo plazo y estabilidad de mercado.
4. Los usuarios publican mensajes a través de Vault.
5. Una publicación exitosa acredita una recompensa por actividad de `10 ATH`.
6. Tras distribuirse el airdrop por actividad completo de `15,000,000 ATH` y `airdrop_remaining_ath == 0`, se desbloquean los descuentos en la comisión del protocolo de ATH.
7. El pool ATH/GRAM se lanza al precio de referencia `1 ATH = 0.001 GRAM`.
8. Se congelan las evidencias de ruta posterior al pool y las evidencias de precios.
9. MarketStabilitySeller vende la reserva a través de los tramos x2..x21.
10. Tras habilitarse la división, FeeAccumulator reparte las comisiones del protocolo en GRAM entre tesorería y recompra.
11. BuybackBurn compra ATH con las comisiones del protocolo en GRAM y quema ATH a través de ATHMaster.
12. Las comisiones de nombres de usuario y perfiles crean deuda de tesorería en ATH y deuda de quema en ATH.
13. La oferta total disminuye gradualmente mediante quemas autenticadas.

## Modelo final

ATH conecta cuatro capas de Platho:

1. **Uso de la aplicación** - los mensajes generan recompensas por actividad.
2. **Funciones de pago** - los nombres de usuario y los avatares requieren ATH.
3. **Descuentos** - el saldo de ATH reduce la comisión del protocolo tras la barrera de distribución.
4. **Reducción de la oferta** - parte de las comisiones en ATH y del resultado de la recompra se quema a través de ATHMaster.

El modelo comienza con una oferta fija y una valoración de referencia de `100,000 GRAM`. La distribución primaria a los usuarios está ligada al uso real de pago: el texto del producto puede indicar que los mensajes parten de `0.0337 GRAM`, mientras que los ejemplos exactos actuales son `0.0337 GRAM` para una publicación pública de 1 KiB y `0.0347 GRAM` para una cápsula privada híbrida de 1 KiB, más un bono por actividad de `10 ATH` por cápsula finalizada. Las clases de tamaño públicas o privadas más grandes cuestan más. Ese bono no es un reembolso, una devolución ni una promesa de beneficio. Tras distribuirse el primer 15% de la oferta, se lanza el pool, se desbloquean los descuentos en la comisión del protocolo y se abre la vía de recompra.

ATH existe como un token operativo dentro de Platho: se distribuye mediante la actividad, se usa en acciones de pago, reduce la comisión del protocolo, se vende desde la reserva a través de una escalera definida y se quema mediante quema on-chain. Tras la escalera de estabilidad de mercado, el precio futuro de ATH lo determinan el mercado y el uso del protocolo.
