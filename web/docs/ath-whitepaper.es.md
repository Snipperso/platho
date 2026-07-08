# Documento técnico de ATH

## El token del protocolo Platho

ATH es el token de utilidad de Platho. Se utiliza para recompensas por actividad, descuentos en las comisiones del protocolo posteriores al airdrop, nombres de usuario `.ath`, actualizaciones del avatar del perfil, ventas de estabilidad de mercado, recompra y quema.

ATH no es un token administrativo. No otorga la capacidad de reescribir saldos, pausar operaciones, acuñar nueva oferta ni cambiar las reglas de propiedad de los usuarios. Su función es impulsar la economía de la aplicación y conectar el uso de Platho con la contabilidad on-chain.

Este documento describe el modelo de ATH en Platho.

## Parámetros básicos

ATH tiene una oferta total fija:

```text
100,000,000 ATH
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

No existe función de acuñación posterior al génesis. `ATHMaster` no implementa acuñación administrativa, pausa, lista negra, impuesto de transferencia, transferencia forzada ni drenaje de rescate.

El despliegue de la oferta inicial se realiza una sola vez mediante `DeployTreasurySupply`. Envía la oferta completa a la billetera ATH de la tesorería. El despliegue de la oferta de génesis no puede repetirse.

La oferta total solo disminuye mediante la quema. `ATHMaster` acepta una quema únicamente tras una notificación de quema autenticada procedente de la billetera ATH determinista de la dirección propietaria. Tras la verificación, `ATHMaster` reduce `total_supply` y envía `ATHBurnFinalized`.

La quema de ATH es una reducción real de la oferta total, no una transferencia a una dirección sin uso.

## Asignación de la oferta

La oferta de ATH se asigna en cuatro categorías:

| Categoría | Porcentaje | Cantidad |
| --- | ---: | ---: |
| Airdrop por actividad | 15% | 15,000,000 ATH |
| Liquidez inicial | 15% | 15,000,000 ATH |
| Vesting del protocolo a largo plazo | 10% | 10,000,000 ATH |
| Reserva de estabilidad de mercado | 60% | 60,000,000 ATH |

Esta asignación define la estructura económica de Platho:

- El 15% de la oferta se distribuye a los usuarios a través de la actividad en la aplicación antes del lanzamiento del pool.
- El 15% de la oferta se utiliza para la liquidez inicial.
- El 10% de la oferta queda bloqueado en un vesting inmutable a largo plazo.
- El 60% de la oferta se aporta a MarketStabilitySeller y se bloquea en el génesis, para luego venderse en tramos por encima del precio de lanzamiento tras el congelamiento de precios posterior al pool.

El airdrop por actividad y la reserva de vesting a largo plazo están respaldados, en el génesis final, por las billeteras ATH oficiales de Vault y ATHVesting, y el verificador de publicación comprueba esos saldos antes de la publicación en producción. La reserva de estabilidad de mercado de `60,000,000 ATH` se aporta a MarketStabilitySeller y se bloquea en el génesis final, respaldada por su billetera ATH oficial de vendedor, y el verificador de publicación comprueba ese respaldo antes de la publicación en producción. La reserva se capitaliza desde el principio, pero no se vende hasta después del lanzamiento del pool, cuando el congelamiento de precios único y vinculado a evidencia fija el precio base del tramo.

## Vesting del protocolo a largo plazo

La reserva de vesting a largo plazo es:

```text
10,000,000 ATH
```

Está en manos de `ATHVesting`, no de un cubo de tesorería mutable. El calendario de vesting está fijado en el contrato:

```text
100,000 ATH per 365-day period
100 periods
10,000,000 ATH total
```

Cualquiera puede activar una reclamación una vez que el ATH ha completado su vesting, pero el beneficiario es inmutable. El contrato no tiene función de aceleración, cambio de beneficiario, pausa, barrido administrativo, drenaje de rescate ni liberación discrecional.

En el génesis final, la billetera oficial `ATHWallet(owner = ATHVesting, master = ATHMaster)` debe contener exactamente `10,000,000 ATH`. El verificador también exige cero ATH reclamado, fase inactiva y ninguna transferencia pendiente antes del lanzamiento.

Esta reserva es intencionadamente lenta. Crea un horizonte largo para el desarrollo del protocolo sin colocar un cubo líquido de 10M ATH por encima del mercado en el lanzamiento.

## Airdrop por actividad

El airdrop por actividad es:

```text
15,000,000 ATH
```

Recompensa por cada publicación exitosa:

```text
10 ATH
```

La recompensa se acredita al saldo interno de ATH del usuario en Vault tras una publicación exitosa. Una publicación exitosa significa que Vault envió la carga útil a CapsuleHub, CapsuleHub aceptó la entrada y Vault recibió el acuse de recibo.

Los intentos de publicación fallidos no generan recompensas por actividad.

Contabilidad de la recompensa:

```text
user.ath_balance += 10 ATH
airdrop_remaining -= 10 ATH
```

Si el cubo restante del airdrop está por debajo de 10 ATH, se acredita la cantidad restante. Una vez agotado el cubo, se detienen las nuevas recompensas por actividad.

El airdrop por actividad se contabiliza en Vault y está respaldado por la billetera ATH oficial de Vault prefinanciada.

Los depósitos de ATH en Vault solo se admiten a través del flujo de transferencia con notificación de la ATHWallet del usuario
(`ATHTransferRequestWithNotify`) hacia Vault. Una transferencia ordinaria manual de ATH a la ATHWallet oficial de Vault no
está admitida: puede aumentar el saldo bruto de la billetera oficial, pero no crea `Vault.user.ath_balance` y no debe
mostrarse en la PWA como una vía de depósito.

Los retiros de ATH de Vault son comandos externos de Vault firmados. La reserva de ejecución para el despliegue de la ATHWallet posterior, la transferencia, el almacenamiento y el
ACK se paga con el saldo interno de GRAM del usuario en Vault. Vault solo acredita de vuelta el valor de
ACK/fallo/rebote autenticado que recibe, menos la reserva de reembolso local y limitado por el valor interno reservado.

## Precio de la actividad

Los mensajes parten del precio base público actual:

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

Esto vincula la distribución temprana de ATH con el uso real de la aplicación. La recompensa es una bonificación por actividad, no un reembolso, cashback,
descuento ni promesa de que ATH compensará el coste en GRAM de una publicación. El valor de referencia de lanzamiento de `10 ATH` puede ser
inferior al coste en GRAM de la cápsula, y eso es intencionado: los usuarios reciben propiedad temprana de la red por un uso real,
no un reembolso garantizado.

Precios de las cápsulas: las publicaciones públicas de 1 KiB parten de `0.0337 GRAM` y las cápsulas privadas híbridas de 1 KiB de `0.0347 GRAM`. Los bloques de cápsula públicos o privados más grandes cuestan más porque el cuerpo seleccionado de 1, 2, 4, 8, 16 o 32 KiB
cambia la reserva de ejecución y almacenamiento de Vault/CapsuleHub. La recompensa se mantiene en `10 ATH` por cada cápsula
finalizada con éxito, independientemente del tamaño de la cápsula.

La publicación privada utiliza el perfil de seguridad híbrido de forma predeterminada: X25519 + ML-KEM-768 + AES-GCM. No existe un modo privado clásico más económico.

ATH puede negociarse por encima o por debajo del precio de referencia de lanzamiento una vez que exista el pool oficial. La recompensa por actividad no es un rendimiento de inversión, una expectativa de beneficio ni una garantía de precio.

## Comisión del protocolo y precio para el usuario

Dentro de Vault, la comisión del protocolo es distinta del coste total de cara al usuario.

Comisión del protocolo:

| Tipo de publicación | Comisión del protocolo |
| --- | ---: |
| Publicación pública | 0.010 GRAM |
| Mensaje privado híbrido | 0.010 GRAM |

El precio de cara al usuario incluye la comisión del protocolo, la dotación de almacenamiento del índice/encabezado compacto, la reserva de ejecución local de Vault y el reembolso de ACK esperado:

| Tipo de publicación | Precio de cara al usuario |
| --- | ---: |
| Público (desde) | from 0.0337 GRAM |
| Ejemplo exacto actual de publicación pública | 0.0337 GRAM |
| Ejemplo exacto actual de privado híbrido de 1 KiB | 0.0347 GRAM |

Si la PWA recibe una estimación de red conservadora más alta, añade el exceso estimado al cargo máximo canónico, redondeado hacia arriba en pasos limpios de `0.001 GRAM`. Los descuentos de ATH se aplican a la comisión del protocolo, no a los costes de red ni a las reservas de almacenamiento. Este recargo es un margen de seguridad firmado: si CapsuleHub acepta la publicación, el ACK de éxito devuelve únicamente la reserva de ACK de publicación fija de `30,000,000` nanotons (`0.030 GRAM`). Después de que Vault procese ese ACK, se acreditan al usuario aproximadamente `25,800,000` nanotons en su saldo interno de GRAM de Vault. La parte por encima del valor canónico requerido permanece en CapsuleHub como excedente de reserva de red/almacenamiento. No se devuelve a Vault y no se cuenta como `accrued_plato_fee_ton` en el momento de la publicación. Solo el excedente bruto por encima de la reserva protegida de CapsuleHub puede barrerse posteriormente sin permiso hacia FeeAccumulator, donde sigue la contabilidad normal de tesorería/recompra. CapsuleHub almacena metadatos de entrada autenticados y compactos y el hash del cuerpo; el cuerpo pesado se recupera del historial de transacciones de publicación aceptadas y se verifica localmente.

## Descuentos de ATH

ATH reduce las comisiones del protocolo de los mensajes después de que el airdrop por actividad se haya distribuido por completo.

Los descuentos se desbloquean únicamente cuando el airdrop por actividad restante es:

```text
airdrop_remaining_ath == 0 ATH
```

Antes de este punto, la comisión del protocolo se paga íntegramente.

Umbral de descuento total:

```text
10,000 ATH
```

Si el saldo interno de ATH del usuario en Vault es de al menos `10,000 ATH`, el usuario alcanza el nivel de descuento total de la comisión del protocolo para el componente de comisión de Platho. Los costes de red y las reservas de almacenamiento se siguen pagando.

Si el saldo está por debajo de `10,000 ATH`, la comisión disminuye linealmente:

```text
raw_discounted_fee = ceil(full_fee * (10,000 ATH - min(user_ath_balance, 10,000 ATH)) / 10,000 ATH)
discounted_fee = raw_discounted_fee
```

El cálculo redondea hacia arriba. Con las constantes actuales, la comisión total del protocolo es de `0.010 GRAM` (`10,000,000 nanotons`) tanto para las cápsulas públicas como para las privadas, y la reducción máxima es de `0.010 GRAM` por cápsula.

## Lanzamiento del pool

El pool ATH/GRAM se lanza después de que el airdrop por actividad completo de `15,000,000 ATH` se haya distribuido.

La secuencia de lanzamiento es:

1. Los usuarios reciben ATH mediante el uso real de Platho.
2. Se distribuye el airdrop por actividad completo.
3. Se desbloquean los descuentos de ATH.
4. Se lanza el pool ATH/GRAM.
5. La evidencia de la ruta posterior al pool y la evidencia de precios quedan congeladas.
6. Se habilita la división de recompra.

El pool parte del precio de referencia:

```text
1 ATH = 0.001 GRAM
```

Asignación de liquidez inicial:

```text
15,000,000 ATH
```

Lado GRAM al precio de lanzamiento:

```text
15,000,000 ATH * 0.001 GRAM = 15,000 GRAM
```

Las comisiones del protocolo recaudadas antes del lanzamiento del pool financian todo el lado GRAM de la liquidez inicial. Esto forma parte del
arranque del lanzamiento y no convierte las recompensas por actividad en un derecho denominado en GRAM.

El pool se lanza en torno a un token que ya ha sido distribuido a través del uso de la aplicación. Esto separa a ATH de una cotización vacía sin base de usuarios.

## FeeAccumulator

Las comisiones del protocolo en GRAM se recaudan en `FeeAccumulator`.

Antes de que se habilite la división de recompra, todo el GRAM acumulado se mueve al cubo de la tesorería:

```text
accumulated_ton -> treasury_due_ton
```

`buyback_due_ton` no crece antes de que se habilite la división.

Después de `EnableBuybackSplit`, el GRAM acumulado se divide:

```text
50% -> treasury_due_ton
50% -> buyback_due_ton
```

Si la cantidad es impar en nanotons, el resto permanece en el lado de la recompra:

```text
treasury_amount = floor(amount * 50%)
buyback_amount = amount - treasury_amount
```

`EnableBuybackSplit` es una acción de un solo sentido ejecutada por el receptor inmutable de la tesorería tras el lanzamiento del pool y el
congelamiento de la ruta de recompra. Esta es una autoridad real de un solo uso: no puede robar fondos, pausar, rescatar ni cambiar direcciones, pero cambia permanentemente
la economía de FeeAccumulator desde la acumulación de arranque solo hacia la tesorería a la división 50/50 tesorería/recompra. Se
habilita únicamente después de que la comprobación previa a la publicación pase.

Las autoridades de publicación de Platho son deliberadamente estrechas y, en su mayoría, de un solo uso. Aun así existen y deben nombrarse con honestidad:
el propietario de la tesorería despliega la oferta inicial de ATH una vez; el controlador de génesis realiza la vinculación previa al sellado y el sellado;
el controlador de lanzamiento de BuybackBurn congela la ruta posterior al pool una vez; el congelamiento de precios de MarketStabilitySeller lo realiza
una vez su controlador de lanzamiento; y el receptor de tesorería de FeeAccumulator habilita la división de recompra de un solo sentido tras la comprobación previa. Ninguno de estos
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

`50 GRAM` en bruto no es un fragmento de recompra válido. La recompra solo se acepta como un sobre de ruta completo.

Tras el congelamiento de la ruta, BuybackBurn ejecuta una recompra de la siguiente manera:

1. Acepta `51.05 GRAM` únicamente del FeeAccumulator vinculado.
2. Registra la cantidad en `reserve_due_ton`.
3. En `ExecuteBuybackChunk`, consume un sobre.
4. Utiliza la cotización congelada y el minOut congelado.
5. Establece internamente la fecha límite de STON.fi.
6. Envía la ruta a través de la billetera pTON congelada.
7. Acepta ATH únicamente a través de la billetera ATH oficial de BuybackBurn.
8. Verifica que la billetera de origen coincida con el pool congelado de STON.fi.
9. Envía el ATH recibido a quema a través de la billetera ATH oficial.
10. Completa el ciclo únicamente tras `ATHBurnFinalized` de `ATHMaster`.

El éxito de la recompra no se define por un mensaje del enrutador, una solicitud de quema saliente ni una notificación de quema de ATHWallet. Se define
únicamente cuando BuybackBurn recibe `ATHBurnFinalized` autenticado de ATHMaster. Hasta que llega esa finalización,
BuybackBurn debe seguir tratándose como en estado de quema pendiente o de reintento; los paneles e indexadores no deben contar el ATH como
quemado simplemente porque se haya enviado un intento de quema.

Si la quema no se finaliza, el ATH recibido pasa a la deuda de reintento. `RetryAthBurnDue` quema el importe total de la deuda de reintento.

## Comisiones de nombres de usuario

El registro de nombres de usuario `.ath` se paga en ATH a través de la billetera ATH oficial de UsernameRegistry.

Precios:

| Longitud del nombre | Precio |
| ---: | ---: |
| 4 caracteres | 10,000 ATH |
| 5 caracteres | 1,000 ATH |
| 6+ caracteres | 100 ATH |

UsernameRegistry acepta únicamente el precio exacto. Pagar de menos y pagar de más no crean un nombre.

Una acuñación aceptada pasa por un estado pendiente y despliega `UsernameNFTItem`. Antes del acuse de recibo del ítem, el pago no se reconoce como ingreso. Tras el acuse de recibo del ítem, el importe se divide:

```text
50% -> treasury_due_ath
50% -> burn_due_ath
```

La acuñación de nombres de usuario se financia con Vault. Los rechazos por nombre de usuario inválido, precio incorrecto o nombre duplicado rebotan a través de la
vía de notificación de la billetera ATH oficial para que Vault pueda restaurar el ATH interno del usuario. UsernameRegistry no mantiene un
cubo de reembolso de nombres de usuario externo directo en el flujo actual financiado con Vault.

El ATH procedente de la acuñación de nombres de usuario se convierte en ingreso del protocolo únicamente después de que se confirme el despliegue del ítem correspondiente.

La autoridad sobre los nombres de usuario está dividida deliberadamente: `UsernameRegistry` ancla el nombre a un `UsernameNFTItem` exacto, y el
estado del ítem lleva al propietario actual. Las transferencias del ítem transfieren el nombre de usuario. El ítem expone datos de NFT estándar
y metadatos on-chain TEP-64, incluido `name = <username>.ath`; no depende de un servidor de Platho para los metadatos.
Los bytes del nombre de usuario son literales y no están normalizados para su visualización: los nombres iniciales, finales, consecutivos y compuestos solo por separadores son
válidos cuando cada byte pertenece al conjunto permitido `a-z`, `0-9`, `_`, `-` y la longitud es de 4..16.
Si se intentó el despliegue del ítem pero el ACK del ítem nunca llegó al registro, `PrunePendingUsernameMint` es intencionadamente
no destructivo: no adivina el fallo, no elimina el estado pendiente ni crea deuda de reembolso. La vía de recuperación es un
`UsernameItemDeployedAck` tardío o `UsernameNFTItem.ResendDeployedAck`, de modo que un ítem inicializado aún puede volverse autoritativo.
Si el despliegue del ítem realmente rebota, el registro solicita a la billetera ATH oficial que reembolse la notificación pendiente.
Un `UsernameNFTItem` desplegado sin que `UsernameRegistry.name_records[name_hash]` apunte a ese ítem exacto es
no autoritativo: los clientes, indexadores y la interfaz no deben tratar el ítem por sí solo como propiedad del nombre `.ath`, y no deben
usar al propietario del registro como propietario actual tras las transferencias.

## Comisiones del avatar del perfil

Coste de actualización del avatar del perfil:

```text
100 ATH
```

Las actualizaciones del avatar del perfil se financian con Vault. La PWA envía `SetProfileAvatarFromVaultBalance` a Vault; Vault paga a través de su vía de notificación de billetera ATH oficial hacia la billetera ATH oficial de ProfileRegistry. El pago del avatar directamente desde la billetera del usuario no está admitido.

ProfileRegistry acepta la actualización únicamente cuando se cumplen todas las condiciones:

- el importe es exactamente `100 ATH`;
- el remitente es la billetera ATH oficial de ProfileRegistry;
- la billetera pagadora es el Vault vinculado;
- la billetera propietaria está en basechain;
- el hash del avatar no es cero;
- el id de flujo no es cero;
- el número de partes es de 1 a 16;
- el formato de medios es WebP.

Una actualización aceptada crea una nueva versión del avatar y divide la comisión:

```text
50 ATH -> treasury_due_ath
50 ATH -> burn_due_ath
```

Una notificación de avatar rechazada se reembolsa a través de la vía de rebote de notificación de la ATHWallet. ProfileRegistry no crea un cubo de reembolso separado para actualizaciones de avatar malformadas.

ProfileRegistry almacena el puntero del avatar autenticado, no los bytes permanentes de la imagen. La PWA debe reconstruir los datos WebP del avatar a partir de las entradas públicas de CapsuleHub o de la caché local y verificar los bytes frente al `avatar_hash` almacenado; el historial ausente o podado se muestra como no disponible.

## Market Stability Seller

MarketStabilitySeller es una reserva de contrato público que distribuye ATH después del lanzamiento del pool oficial:

```text
60,000,000 ATH
```

Su propósito es reducir la distorsión del mercado temprano causada por la liquidez escasa. En el lanzamiento, un pool pequeño puede moverse bruscamente por un pequeño grupo de compradores tempranos. Si eso ocurre, los usuarios que necesitan ATH para acciones reales de Platho pueden verse obligados a comprar en un pico de precio artificial.

MarketStabilitySeller crea una escalera de oferta transparente por encima del precio de lanzamiento. Vende ATH en tramos de tamaño fijo. Cada tramo siguiente es más caro que el anterior, y cada tramo tiene un límite de tamaño estricto. Tras el congelamiento de precios único y vinculado a evidencia, el calendario de tramos es determinista y el equipo no puede cambiarlo manualmente.

Si los especuladores tempranos intentan absorber una gran cantidad de ATH, compran de la reserva pública a precios de tramo crecientes en lugar de extraer toda la liquidez barata de un pool escaso y revenderla a los usuarios. Si los usuarios ordinarios necesitan ATH para Platho, pueden comprarlo a un precio de tramo público conocido sin empujar verticalmente un pool pequeño con una sola ola de demanda.

La reserva no arroja tokens al mercado. No vende por sí sola y no crea presión vendedora sin demanda. Una venta ocurre solo cuando un comprador adquiere voluntariamente del tramo actual. Si no hay demanda, la reserva permanece inactiva.

La utilidad on-chain de ATH es específica:

- el registro de nombres de usuario `.ath` se paga en ATH a través de UsernameRegistry;
- las actualizaciones del puntero del avatar del perfil se pagan en ATH a través de ProfileRegistry;
- el ATH mantenido en el saldo interno de Vault del usuario reduce la comisión del protocolo para las publicaciones de Vault después del umbral de distribución por actividad;
- las comisiones aceptadas de nombres de usuario y avatares crean deuda de tesorería y deuda de quema;
- BuybackBurn compra ATH con las comisiones del protocolo en GRAM y quema el ATH recibido a través de ATHMaster.

Las publicaciones de Vault se pagan en GRAM. ATH no paga toda la transacción de publicación. Reduce el componente de comisión del protocolo después de que el umbral de descuento esté abierto.

Esto hace que la demanda de ATH esté vinculada a acciones concretas del protocolo: nombres `.ath`, actualizaciones de avatar, descuentos de comisión del protocolo en Vault posteriores al airdrop y presión de recompra/quema. MarketStabilitySeller amplía la oferta disponible solo a medida que los compradores toman el siguiente tramo, de modo que el acceso temprano es público y determinista en lugar de estar dominado por un pool escaso.

La reserva se vende únicamente después del congelamiento de precios posterior al pool.

El congelamiento de precios es una autoridad de lanzamiento real de un solo uso. Fija el precio base del tramo una vez a partir de la evidencia del lanzamiento del pool, y luego se borra el hash del controlador de lanzamiento. Después de eso, MarketStabilitySeller no puede robar fondos, pausar ventas, rescatar saldos, anular a compradores ni mutar el calendario de precios.

MarketStabilitySeller se capitaliza en el génesis final con la reserva completa de `60,000,000 ATH`, financiada a través del
flujo autenticado de financiador de reserva hacia la billetera ATH oficial de vendedor, hasta el límite estricto de `60,000,000 ATH`.
`mainnet:genesis:verify` comprueba que el vendedor lleve la reserva completa y que el respaldo de su billetera ATH oficial de vendedor
sea de al menos `60,000,000 ATH` antes de la publicación en producción. Una transferencia ordinaria de ATH no solicitada hacia la billetera ATH oficial de
vendedor no aumenta la reserva contabilizada, no amplía la oferta vendible y puede quedarse atascada; un saldo de billetera
por encima de `60,000,000 ATH` se trata como una advertencia, no como reserva adicional.

La venta es un paso separado posterior al pool. La reserva no se vende hasta después del lanzamiento del pool, cuando el congelamiento de precios único y vinculado a evidencia
fija el precio base del tramo; a partir de entonces, el calendario de tramos es determinista y el equipo no puede cambiarlo manualmente.

La reserva se divide en 20 tramos:

```text
20 * 3,000,000 ATH = 60,000,000 ATH
```

Cada tramo tiene un multiplicador:

```text
x2, x3, x4, ..., x21
```

Esto crea una escalera de precios suave. A medida que crece la popularidad del proyecto, el mercado recibe oferta adicional de ATH, pero cada tramo siguiente es más caro que el anterior. La demanda temprana no golpea de inmediato un pool escaso, y el crecimiento del precio no se convierte en un muro vertical que haga que el token de utilidad sea incómodo de usar.

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

| Tramo | Multiplicador | Precio por 3M ATH | Precio por 1 ATH |
| ---: | ---: | ---: | ---: |
| 1 | x2 | 6,000 GRAM | 0.002 GRAM |
| 2 | x3 | 9,000 GRAM | 0.003 GRAM |
| 3 | x4 | 12,000 GRAM | 0.004 GRAM |
| ... | ... | ... | ... |
| 15 | x16 | 48,000 GRAM | 0.016 GRAM |
| ... | ... | ... | ... |
| 20 | x21 | 63,000 GRAM | 0.021 GRAM |

Una sola compra no puede cruzar el límite de un tramo. Esto impide comprar ATH del siguiente tramo al precio del tramo anterior.

El ingreso en GRAM se reconoce únicamente después de que el ATH se entregue al comprador. Si la transferencia de ATH falla o rebota, la reserva se restaura, el comprador recibe de vuelta el principal en GRAM pagado, y la deuda de tesorería no aumenta.

Después de que se venda el último tramo x21, MarketStabilitySeller ya no regula el precio de ATH. A partir de ese punto, el precio queda plenamente determinado por el mercado: liquidez, oferta disponible, demanda de nombres `.ath`, actualizaciones de avatar, descuentos de comisión del protocolo en Vault posteriores al airdrop y presión de recompra/quema.

Incluso en el paso x21, la valoración de referencia se mantiene moderada en relación con el modelo de utilidad:

```text
1 ATH = 0.021 GRAM
100,000,000 ATH = 2,100,000 GRAM
```

En el paso x21, MarketStabilitySeller ha terminado su liberación programada de reserva. Después de eso, el precio de ATH queda plenamente determinado por el mercado a través de la liquidez, la demanda de uso, la oferta disponible y la presión de recompra/quema. La única asignación de protocolo restante es el calendario lento de vesting a largo plazo, limitado a `100,000 ATH` por año.

## Cubos de tesorería y de quema

UsernameRegistry y ProfileRegistry utilizan el mismo modelo de división de comisiones de ATH:

```text
accepted ATH fee -> 50% treasury_due_ath + 50% burn_due_ath
```

El vaciado de la deuda de tesorería envía ATH al receptor de la tesorería a través de la billetera ATH oficial.

El vaciado de la deuda de quema envía una solicitud de quema de ATH a través de la billetera ATH oficial. La oferta disminuye únicamente después de la finalización de la quema en ATHMaster.

Las vías de fallo y rebote restauran los cubos de deuda. La contabilidad se conserva hasta que se completa la transferencia o la quema posterior.

## Contabilidad de ATHWallet

Los saldos de ATH residen en contratos ATHWallet deterministas.

ATHWallet gestiona:

- el crédito de la oferta de génesis;
- la transferencia ordinaria;
- la transferencia con notificación;
- la notificación de acuñación de nombre de usuario;
- la notificación de avatar del perfil;
- la solicitud de quema;
- el acuse de recibo de la notificación;
- la poda de notificaciones obsoletas;
- la recuperación de rebote/fallo.

Los contratos que aceptan ATH como pago no aceptan mensajes directos de direcciones arbitrarias. Aceptan notificaciones únicamente de su ATHWallet oficial. La autenticación de la billetera de origen se realiza dentro de ATHWallet mediante la derivación determinista de la billetera.

ATH expone puntos de entrada de transferencia de estilo TEP-74 para herramientas genéricas de jetton, pero las acciones del protocolo Platho utilizan mensajes de notificación de ATH autenticados. Las integraciones externas no deben suponer que los flujos de notificación de Platho emiten un `JettonTransferNotification` genérico.

Las transferencias internas salientes en ATHWallet están protegidas por la contabilidad de pendientes del lado de origen y el acuse de recibo de origen. El saldo no se restaura a partir de un cuerpo de rebote sin prueba de pendiente.

## Ciclo de vida de ATH

1. `ATHMaster` crea una oferta fija de `100,000,000 ATH`.
2. El despliegue de tesorería de un solo uso recibe la oferta en la billetera ATH de la tesorería.
3. La oferta se asigna entre actividad, liquidez, vesting a largo plazo y estabilidad de mercado.
4. Los usuarios publican mensajes a través de Vault.
5. Una publicación exitosa acredita una recompensa por actividad de `10 ATH`.
6. Después de que el airdrop por actividad completo de `15,000,000 ATH` se distribuye y `airdrop_remaining_ath == 0`, se desbloquean los descuentos de comisión del protocolo de ATH.
7. El pool ATH/GRAM se lanza al precio de referencia `1 ATH = 0.001 GRAM`.
8. La evidencia de la ruta posterior al pool y la evidencia de precios quedan congeladas.
9. MarketStabilitySeller vende la reserva a través de los tramos x2..x21.
10. Después de habilitar la división, FeeAccumulator reparte las comisiones del protocolo en GRAM entre la tesorería y la recompra.
11. BuybackBurn compra ATH con las comisiones del protocolo en GRAM y quema ATH a través de ATHMaster.
12. Las comisiones de nombres de usuario y de perfil crean deuda de tesorería de ATH y deuda de quema de ATH.
13. La oferta total disminuye gradualmente a través de quemas autenticadas.

## Modelo final

ATH conecta cuatro capas de Platho:

1. **Uso de la aplicación** - los mensajes crean recompensas por actividad.
2. **Funciones de pago** - los nombres de usuario y los avatares requieren ATH.
3. **Descuentos** - el saldo de ATH reduce la comisión del protocolo tras el umbral de distribución.
4. **Reducción de la oferta** - parte de las comisiones de ATH y del resultado de la recompra se quema a través de ATHMaster.

El modelo comienza con una oferta fija y una valoración de referencia de `100,000 GRAM`. La distribución primaria a los usuarios está vinculada al uso real de pago: los mensajes parten de `0.0337 GRAM` — actualmente `0.0337 GRAM` para una publicación pública de 1 KiB y `0.0347 GRAM` para una cápsula privada híbrida de 1 KiB, más una bonificación por actividad de `10 ATH` por cada cápsula finalizada. Las clases de tamaño públicas o privadas más grandes cuestan más. Esa bonificación no es un reembolso, una devolución ni una promesa de beneficio. Después de que se distribuye el primer 15% de la oferta, se lanza el pool, se desbloquean los descuentos de comisión del protocolo y se abre la vía de recompra.

ATH existe como un token funcional dentro de Platho: se distribuye a través de la actividad, se utiliza en acciones de pago, reduce la comisión del protocolo, se vende de la reserva a través de una escalera definida y se quema mediante quema on-chain. Tras la escalera de estabilidad de mercado, el precio futuro de ATH queda determinado por el mercado y el uso del protocolo.
