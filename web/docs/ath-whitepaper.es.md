# Whitepaper de ATH

## El token del protocolo Platho

ATH es el token de utilidad de Platho. Se usa para las recompensas por actividad, los descuentos en la comisión de protocolo tras el airdrop, los nombres `.ath`, las actualizaciones de avatar, las ventas de estabilidad de mercado, la recompra y la quema.

ATH no es un token administrativo. No otorga poder para reescribir saldos, pausar operaciones, emitir nueva oferta ni cambiar lo que poseen las personas usuarias. Su papel es alimentar la economía de la aplicación y ligar el uso de Platho a la contabilidad on-chain.

Este documento describe el modelo de ATH en Platho.

## Parámetros principales

ATH tiene una oferta total fija:

```text
100,000,000 ATH
```

Precio de referencia en el lanzamiento:

```text
1 ATH = 0.001 GRAM
```

Valoración totalmente diluida en el lanzamiento:

```text
100,000,000 ATH * 0.001 GRAM = 100,000 GRAM
```

ATH parte de una capitalización de referencia de `100,000 GRAM`.

## Oferta fija

ATH lo emite el contrato `ATHMaster`. Al inicializarse, `ATHMaster` fija la oferta total en `100,000,000 ATH`.

No existe función de emisión posterior al génesis. `ATHMaster` no implementa acuñación administrativa, pausa, lista negra, impuesto de transferencia, transferencia forzosa ni retirada de emergencia.

La emisión primaria ocurre una sola vez, mediante `DeployTreasurySupply`, que envía la oferta completa a la wallet ATH de tesorería. La emisión de génesis no puede repetirse.

La oferta total solo disminuye por quema. `ATHMaster` acepta una quema únicamente tras una notificación de quema autenticada procedente de la wallet ATH determinista de la dirección propietaria. Verificada esta, `ATHMaster` reduce `total_supply` y envía `ATHBurnFinalized`.

Quemar ATH es una reducción real de la oferta total, no una transferencia a una dirección en desuso.

## Distribución de la oferta

La oferta de ATH se reparte en cuatro categorías:

| Categoría | Porcentaje | Cantidad |
| --- | ---: | ---: |
| Airdrop por actividad | 15% | 15,000,000 ATH |
| Liquidez inicial | 15% | 15,000,000 ATH |
| Vesting de protocolo a largo plazo | 10% | 10,000,000 ATH |
| Reserva de estabilidad de mercado | 60% | 60,000,000 ATH |

Este reparto define la estructura económica de Platho:

- El 15% se distribuye entre las personas usuarias mediante la actividad en la aplicación, antes del lanzamiento del pool.
- El 15% se destina a la liquidez inicial.
- El 10% queda bloqueado en un vesting inmutable a largo plazo.
- El 60% se aporta a MarketStabilitySeller y se bloquea en el génesis; después se vende en tramos por encima del precio de lanzamiento, una vez congelado el precio tras el pool.

En el génesis final, el airdrop por actividad y la reserva de vesting a largo plazo están respaldados por las wallets ATH oficiales de AirdropPool y ATHVesting, y el verificador de release comprueba esos saldos antes de una publicación en producción. La reserva de estabilidad de `60,000,000 ATH` se aporta a MarketStabilitySeller y se bloquea en el génesis final, respaldada por su wallet ATH oficial de venta, y el verificador comprueba ese respaldo antes de una publicación en producción. La reserva está capitalizada desde el principio, pero no se vende hasta que el pool se lanza, momento en que una congelación de precios única y ligada a evidencias fija el precio base del tramo.

## Vesting de protocolo a largo plazo

La reserva de vesting a largo plazo es:

```text
10,000,000 ATH
```

Se guarda en `ATHVesting`, no en un compartimento de tesorería modificable. El calendario está fijado en el contrato:

```text
100,000 ATH per 365-day period
100 periods
10,000,000 ATH total
```

Cualquiera puede disparar una reclamación de pago una vez que el ATH ha devengado, pero la persona beneficiaria es inmutable. El contrato no tiene aceleración, cambio de beneficiario, pausa, retirada administrativa, salida de emergencia ni liberación discrecional.

En el génesis final, la wallet oficial `ATHWallet(owner = ATHVesting, master = ATHMaster)` debe contener exactamente `10,000,000 ATH`. El verificador exige además cero ATH reclamado, fase inactiva y ninguna transferencia pendiente antes del lanzamiento.

Esta reserva es deliberadamente lenta. Crea un horizonte largo para el desarrollo del protocolo sin colocar sobre el mercado, en el lanzamiento, un bloque líquido de 10M ATH.

## Airdrop por actividad

El airdrop por actividad es:

```text
15,000,000 ATH
```

Recompensa por publicación exitosa:

```text
10 ATH
```

La recompensa se acumula para quien publica en forma de crédito: una cápsula aceptada es un crédito, y un crédito son `10 ATH`, igual en todos los carriles. Los créditos se acumulan en la cuenta propia de quien publica (`AirdropTicket`, una por wallet) y se canjean por lotes desde `AirdropPool`; el ATH llega a la wallet ATH de la propia persona usuaria.

Los intentos fallidos de publicación no generan recompensas por actividad.

Contabilidad de la recompensa:

```text
credits += 1                 // un crédito = 10 ATH
airdrop_remaining -= 10 ATH
```

El presupuesto es un múltiplo exacto de la recompensa: `15,000,000 ATH` son `1,500,000` créditos. Cuando se agotan, cesan las nuevas recompensas por actividad.

El airdrop por actividad está respaldado por la wallet ATH oficial de `AirdropPool`, que es donde residen esos `15,000,000 ATH`.

El pago se realiza por lotes, no cápsula a cápsula. Cada entrega arrastra un coste fijo no recuperable de unos `0.0166 GRAM`, y ese coste no depende de cuántos créditos lleve la entrega. Pagar cápsula a cápsula a lo largo de 1,500,000 cápsulas quemaría más de lo que esas cápsulas recaudan en comisiones de protocolo, así que los créditos se acumulan y se canjean en lotes.

## Precio de la actividad

Los mensajes parten del precio base actual:

```text
0.0191 GRAM
```

Cifras exactas actuales antes del descuento por ATH:

```text
mensaje privado:  0.0191 GRAM
primer contacto:  0.0178 GRAM
publicación:      0.0203 GRAM
```

Por cada publicación exitosa la persona usuaria recibe:

```text
10 ATH
```

Al precio de referencia del lanzamiento:

```text
10 ATH * 0.001 GRAM = 0.01 GRAM
```

Esto liga la distribución temprana de ATH al uso real de la aplicación. La recompensa es un bono por actividad, no un reembolso, un cashback, un descuento ni la promesa de que ATH compense el coste en GRAM de publicar. El valor de referencia de `10 ATH` puede ser inferior al coste en GRAM de una cápsula, y es deliberado: se recibe propiedad temprana de la red por uso real, no una compensación garantizada.

Precio de las cápsulas: una publicación pública desde `0.0203 GRAM`, una cápsula privada desde `0.0191 GRAM`. Los bloques de cápsula públicos o privados más grandes cuestan más, porque el cuerpo elegido de 1, 2, 4, 8, 16 o 32 KiB cambia la reserva de ejecución y almacenamiento en el fragmento. La recompensa sigue siendo `10 ATH` por cápsula finalizada con éxito, sea cual sea su tamaño.

Una publicación privada usa por defecto el perfil de seguridad híbrido: X25519 + ML-KEM-768 + AES-GCM. No hay un modo clásico más barato para los mensajes privados.

ATH puede cotizar por encima o por debajo del precio de referencia una vez exista el pool oficial. La recompensa por actividad no es un rendimiento de inversión, una expectativa de beneficio ni una garantía de precio.

## Comisión de protocolo y precio para la persona usuaria

La comisión de protocolo es distinta del coste total para quien usa la aplicación.

Comisión de protocolo:

| Tipo de publicación | Comisión de protocolo |
| --- | ---: |
| Publicación pública | 0.010 GRAM |
| Mensaje privado híbrido | 0.010 GRAM |

El precio final cubre la comisión de protocolo, el gas y la dotación para almacenar la entrada en su fragmento:

| Publicación | Se adjunta |
| --- | ---: |
| Mensaje privado | 0.0191 GRAM |
| Primer contacto | 0.0178 GRAM |
| Publicación o comentario público | 0.0203 GRAM |
| Actualización de avatar | 0.0395 GRAM |
| Activación de la cuenta | 0.0600 GRAM |

El cliente adjunta siempre la mayor de las dos cifras: la que hace falta para crear el fragmento. El excedente no se pierde: el fragmento se queda exactamente con lo que necesita y devuelve el resto a quien envía. Si la estimación de red llega más alta de lo previsto, el cliente añade un margen encima; ese margen es margen y no pago, y también se devuelve. Los descuentos por ATH se aplican a la comisión de protocolo, no a los costes de red ni a las reservas de almacenamiento.

## Descuentos por ATH

ATH reduce las comisiones de protocolo de los mensajes una vez que el airdrop por actividad se ha distribuido por completo.

Los descuentos se desbloquean solo cuando el airdrop restante es:

```text
airdrop_remaining_ath == 0 ATH
```

Hasta ese punto la comisión de protocolo se paga íntegra.

Umbral de descuento completo:

```text
10,000 ATH
```

Si el saldo de ATH en la wallet propia es de al menos `10,000 ATH`, se alcanza el tramo de descuento completo sobre el componente de comisión de Platho. Los costes de red y las reservas de almacenamiento se siguen pagando.

Por debajo de `10,000 ATH` la comisión decrece linealmente:

```text
raw_discounted_fee = ceil(full_fee * (10,000 ATH - min(user_ath_balance, 10,000 ATH)) / 10,000 ATH)
discounted_fee = raw_discounted_fee
```

El cálculo redondea hacia arriba. Con las constantes actuales, la comisión de protocolo completa es de `0.010 GRAM` (`10,000,000 nanotons`) tanto para cápsulas públicas como privadas, y la reducción máxima es de `0.010 GRAM` por cápsula.

## Lanzamiento del pool

El pool ATH/GRAM se lanza después de que se haya distribuido el airdrop por actividad completo de `15,000,000 ATH`.

Secuencia de lanzamiento:

1. Las personas usuarias reciben ATH por el uso real de Platho.
2. Se distribuye el airdrop por actividad completo.
3. Se desbloquean los descuentos por ATH.
4. Se lanza el pool ATH/GRAM.
5. Se congelan las evidencias de ruta y de precio posteriores al pool.
6. Se habilita la división de recompra.

El pool arranca desde el precio de referencia:

```text
1 ATH = 0.001 GRAM
```

Asignación de liquidez inicial:

```text
15,000,000 ATH
```

El lado GRAM al precio de lanzamiento:

```text
15,000,000 ATH * 0.001 GRAM = 15,000 GRAM
```

Las comisiones de protocolo recaudadas antes del lanzamiento financian por completo el lado GRAM de la liquidez inicial. Forma parte del arranque y no convierte las recompensas por actividad en un derecho denominado en GRAM.

El pool se lanza alrededor de un token ya distribuido mediante el uso de la aplicación. Eso distingue a ATH de un listado vacío sin base de usuarias y usuarios.

## FeeAccumulator

Las comisiones de protocolo en GRAM se recaudan en `FeeAccumulator`.

Antes de habilitar la división de recompra, todo el GRAM acumulado pasa al compartimento de tesorería:

```text
accumulated_ton -> treasury_due_ton
```

`buyback_due_ton` no crece hasta que se habilita la división.

Tras `EnableBuybackSplit`, el GRAM acumulado se reparte:

```text
50% -> treasury_due_ton
50% -> buyback_due_ton
```

Si el importe en nanotons es impar, el resto queda del lado de la recompra:

```text
treasury_amount = floor(amount * 50%)
buyback_amount = amount - treasury_amount
```

`EnableBuybackSplit` es una acción sin retorno que ejecuta la persona receptora inmutable de tesorería, después del lanzamiento del pool y de la congelación de la ruta de recompra. Es un poder real de un solo uso: no puede robar fondos, pausar, salir de emergencia ni cambiar direcciones, pero cambia permanentemente la economía de FeeAccumulator, de una acumulación de arranque solo para tesorería a una división 50/50 entre tesorería y recompra. Se habilita únicamente tras superar la comprobación previa a la publicación.

Los poderes de publicación de Platho son deliberadamente estrechos y casi siempre de un solo uso. Existen, y conviene nombrarlos con honestidad: la propiedad de tesorería despliega una vez la oferta primaria de ATH; el controlador de génesis realiza el enlace previo al sellado y el sellado; el controlador de lanzamiento de BuybackBurn congela una vez la ruta posterior al pool; la congelación de precios de MarketStabilitySeller la ejecuta una vez su controlador de lanzamiento; y la receptora de tesorería de FeeAccumulator habilita la división de recompra sin retorno tras la comprobación previa. Ninguno de estos roles es una salida de emergencia, una pausa, una actualización, una retirada administrativa ni un control arbitrario sobre los saldos.

## Recompra y quema

La recompra se ejecuta a través de `FeeAccumulator` y `BuybackBurn`.

BuybackBurn acepta únicamente un sobre ejecutable completo:

```text
51.05 GRAM
```

Estructura del sobre:

```text
50.00 GRAM  - importe de la oferta en STON.fi
1.00 GRAM   - gas de reenvío de ruta
0.05 GRAM   - gas de transferencia pTON
```

Unos `50 GRAM` a secas no son un fragmento de recompra válido. La recompra se acepta solo como sobre de ruta completo.

Una vez congelada la ruta, BuybackBurn ejecuta la recompra así:

1. Acepta `51.05 GRAM` solo del FeeAccumulator vinculado.
2. Registra el importe en `reserve_due_ton`.
3. Con `ExecuteBuybackChunk` consume un sobre.
4. Usa la cotización congelada y el minOut congelado.
5. Fija internamente la fecha límite de STON.fi.
6. Envía la ruta a través de la wallet pTON congelada.
7. Acepta ATH solo por la wallet ATH oficial de BuybackBurn.
8. Verifica que la wallet de origen coincide con el pool STON.fi congelado.
9. Envía el ATH recibido a quemar por la wallet ATH oficial.
10. Cierra el ciclo solo tras `ATHBurnFinalized` de `ATHMaster`.

El éxito de la recompra no lo define un mensaje del router, una solicitud de quema saliente ni una notificación de quema de ATHWallet. Lo define únicamente que BuybackBurn reciba un `ATHBurnFinalized` autenticado de ATHMaster. Hasta que llega esa finalización, BuybackBurn sigue en estado de quema pendiente o de reintento; los paneles e indexadores no deben contar el ATH como quemado solo porque se haya enviado un intento de quema.

Si la quema no se finaliza, el ATH recibido pasa a la deuda de reintento. `RetryAthBurnDue` quema el importe completo de esa deuda.

## Comisiones por nombre

Registrar un nombre `.ath` se paga en ATH a través de la wallet ATH oficial de UsernameRegistry.

Precios:

| Longitud del nombre | Precio |
| ---: | ---: |
| 4 caracteres | 10,000 ATH |
| 5 caracteres | 1,000 ATH |
| 6 o más | 100 ATH |

UsernameRegistry acepta únicamente el precio exacto. Ni pagar de menos ni pagar de más crea un nombre.

Una acuñación aceptada pasa por un estado pendiente y despliega un `UsernameNFTItem`. El pago no se reconoce como ingreso hasta que el item queda confirmado. Confirmado el item, el importe se reparte:

```text
50% -> treasury_due_ath
50% -> burn_due_ath
```

La acuñación de un nombre se paga en ATH desde la wallet propia. Los rechazos por nombre inválido, precio incorrecto o nombre duplicado se devuelven a la persona propietaria por la vía de reembolso de notificaciones de ATHWallet. UsernameRegistry no mantiene un compartimento externo de reembolso para nombres.

El ATH de una acuñación de nombre se convierte en ingreso del protocolo solo después de confirmarse el despliegue del item correspondiente.

La autoridad sobre los nombres está dividida a propósito: `UsernameRegistry` ancla el nombre a un `UsernameNFTItem` exacto, y el estado del item lleva la propiedad actual. Transferir el item transfiere el nombre. El item ofrece datos NFT estándar y metadatos TEP-64 on-chain, incluido `name = <username>.ath`; no depende de ningún servidor de Platho para sus metadatos. Los bytes del nombre son literales y no se normalizan para mostrarlos: los nombres con separadores iniciales, finales, consecutivos o formados solo por separadores son válidos siempre que cada byte pertenezca al conjunto permitido `a-z`, `0-9`, `_`, `-` y la longitud esté entre 4 y 16. Si se intentó desplegar el item pero su ACK nunca llegó al registro, `PrunePendingUsernameMint` es deliberadamente no destructivo: no supone el fallo, no borra el estado pendiente y no crea deuda de reembolso. La vía de recuperación es un `UsernameItemDeployedAck` tardío o `UsernameNFTItem.ResendDeployedAck`, de modo que un item ya inicializado todavía puede volverse autoritativo. Si el despliegue del item sí rebota, el registro pide a la wallet ATH oficial que devuelva la notificación pendiente. Un `UsernameNFTItem` desplegado sin que `UsernameRegistry.name_records[name_hash]` apunte a ese item exacto no es autoritativo: clientes, indexadores e interfaces no deben tratar el item por sí solo como la propiedad del nombre `.ath`, ni usar la persona propietaria del registro como propietaria actual tras una transferencia.

## Comisiones por avatar

Coste de actualizar el avatar:

```text
100 ATH
```

La actualización del avatar se paga en ATH desde la wallet propia: una transferencia con notificación desde su wallet ATH hacia la wallet ATH oficial de ProfileRegistry.

ProfileRegistry acepta la actualización solo si se cumplen todas las condiciones:

- el importe es exactamente `100 ATH`;
- quien envía es la wallet ATH oficial de ProfileRegistry;
- la wallet pagadora es la wallet ATH de la persona propietaria;
- la wallet propietaria está en la basechain;
- el hash del avatar no es cero;
- el identificador de flujo no es cero;
- el número de partes está entre 1 y 16;
- el formato de medio es WebP.

Una actualización aceptada crea una nueva versión de avatar y reparte la comisión:

```text
50 ATH -> treasury_due_ath
50 ATH -> burn_due_ath
```

Una notificación de avatar rechazada se devuelve por la vía de reembolso de notificaciones de ATHWallet. ProfileRegistry no crea un compartimento de reembolso aparte para actualizaciones mal formadas.

ProfileRegistry pone precio y liquida el pago, pero no guarda estado de perfil: el puntero autenticado al avatar vive en el KeyShard de la propia persona propietaria. Los bytes de la imagen viven en PublicShard, en el dominio AVATAR; el cliente reconstruye el WebP a partir de ellos o de una caché local y coteja los bytes con el `avatar_hash` almacenado. Un historial ausente o truncado se muestra como no disponible.

## Market Stability Seller

MarketStabilitySeller es una reserva pública en contrato que distribuye ATH después del lanzamiento del pool oficial:

```text
60,000,000 ATH
```

Su propósito es reducir la distorsión del mercado temprano causada por una liquidez fina. En el lanzamiento, un pool pequeño puede moverse bruscamente por un grupo reducido de compradores tempranos. Si eso ocurre, quienes necesitan ATH para acciones reales dentro de Platho pueden verse obligados a comprar en un pico de precio artificial.

MarketStabilitySeller crea una escalera de oferta transparente por encima del precio de lanzamiento. Vende ATH en tramos de tamaño fijo. Cada tramo siguiente es más caro que el anterior, y cada uno tiene un límite duro de tamaño. Tras la congelación de precios única y ligada a evidencias, el calendario de tramos es determinista y el equipo no puede cambiarlo a mano.

Si especuladores tempranos intentan absorber una gran cantidad de ATH, compran de la reserva pública a precios de tramo crecientes, en lugar de drenar toda la liquidez barata de un pool fino y revendérsela a las personas usuarias. Si alguien necesita ATH para Platho, puede comprarlo a un precio de tramo público y conocido sin empujar un pool pequeño en vertical con una sola ola de demanda.

La reserva no vuelca tokens al mercado. No vende por sí sola ni crea presión vendedora sin demanda. Solo hay venta cuando alguien compra voluntariamente del tramo actual. Sin demanda, la reserva permanece inactiva.

La utilidad on-chain de ATH es concreta:

- registrar un nombre `.ath` se paga en ATH a través de UsernameRegistry;
- las actualizaciones del puntero de avatar se pagan en ATH a través de ProfileRegistry;
- el ATH en la wallet propia reduce la comisión de protocolo de las publicaciones una vez pasada la puerta de distribución por actividad;
- las comisiones aceptadas por nombres y avatares crean deuda de tesorería y deuda de quema;
- BuybackBurn compra ATH con comisiones de protocolo en GRAM y quema el ATH recibido a través de ATHMaster.

Las publicaciones se pagan en GRAM directamente desde la wallet. ATH no paga la transacción de publicación entera. Reduce el componente de comisión de protocolo una vez abierta la puerta de descuentos.

Esto liga la demanda de ATH a acciones concretas del protocolo: nombres `.ath`, actualizaciones de avatar, descuentos de comisión tras el airdrop y la presión de recompra y quema. MarketStabilitySeller amplía la oferta disponible solo a medida que se toma el siguiente tramo, de modo que el acceso temprano es público y determinista en lugar de estar dominado por un pool fino.

La reserva se vende solo tras la congelación de precios posterior al pool.

La congelación de precios es un poder real de lanzamiento y de un solo uso. Fija el precio base del tramo una vez, a partir de las evidencias del lanzamiento del pool, y después se borra el hash del controlador de lanzamiento. Desde entonces MarketStabilitySeller no puede robar fondos, pausar las ventas, vaciar saldos de emergencia, pasar por encima de quien compra ni cambiar la tabla de precios.

MarketStabilitySeller se capitaliza en el génesis final con la reserva completa de `60,000,000 ATH`, financiada mediante el flujo autenticado de dotación hacia la wallet ATH oficial de venta, hasta un tope duro de `60,000,000 ATH`. `mainnet:genesis:verify` comprueba que la parte vendedora sostiene la reserva completa y que el respaldo de su wallet ATH oficial es de al menos `60,000,000 ATH` antes de una publicación en producción. Una transferencia ordinaria y no solicitada de ATH a esa wallet oficial no incrementa la reserva contabilizada, no amplía la oferta vendible y puede quedar atascada; un saldo por encima de `60,000,000 ATH` se trata como una advertencia, no como reserva adicional.

Vender es un paso aparte, posterior al pool. La reserva no se vende antes del lanzamiento; en ese momento la congelación de precios única y ligada a evidencias fija el precio base del tramo, y a partir de ahí el calendario es determinista y el equipo no puede cambiarlo a mano.

La reserva se divide en 20 tramos:

```text
20 * 3,000,000 ATH = 60,000,000 ATH
```

Cada tramo tiene un multiplicador:

```text
x2, x3, x4, ..., x21
```

Esto crea una escalera de precios suave. A medida que el proyecto gana popularidad, el mercado recibe oferta adicional de ATH, pero cada tramo siguiente es más caro que el anterior. La demanda temprana no golpea de golpe un pool fino, y la subida de precio no se convierte en un muro vertical que vuelva incómodo usar un token de utilidad.

Fórmula de compra:

```text
price = ceil(base_tranche_price * current_multiplier * amount / 3,000,000 ATH)
```

`base_tranche_price` se congela tras el lanzamiento del pool y coincide exactamente con la evidencia de precio x1.

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

Una compra no puede cruzar el límite de un tramo. Esto impide comprar ATH del tramo siguiente al precio del anterior.

Los ingresos en GRAM se reconocen solo después de entregar el ATH a quien compra. Si la transferencia de ATH falla o rebota, la reserva se restaura, quien compra recupera el principal en GRAM pagado y la deuda de tesorería no aumenta.

Vendido el tramo final x21, MarketStabilitySeller deja de regular el precio de ATH. Desde ese punto el precio lo fija enteramente el mercado: liquidez, oferta disponible, demanda de nombres `.ath`, actualizaciones de avatar, descuentos de comisión tras el airdrop y la presión de recompra y quema.

Incluso en el escalón x21 la valoración de referencia sigue siendo moderada frente al modelo de utilidad:

```text
1 ATH = 0.021 GRAM
100,000,000 ATH = 2,100,000 GRAM
```

En el escalón x21 MarketStabilitySeller ha completado su liberación programada de reserva. Después, el precio de ATH lo fija por completo el mercado a través de la liquidez, la demanda de uso, la oferta disponible y la presión de recompra y quema. La única distribución de protocolo que queda es el calendario lento de vesting a largo plazo, limitado a `100,000 ATH` al año.

## Compartimentos de tesorería y quema

UsernameRegistry y ProfileRegistry usan el mismo modelo de reparto de comisiones en ATH:

```text
accepted ATH fee -> 50% treasury_due_ath + 50% burn_due_ath
```

Vaciar la deuda de tesorería envía ATH a la persona receptora de tesorería a través de la wallet ATH oficial.

Vaciar la deuda de quema envía una solicitud de quema de ATH por la wallet ATH oficial. La oferta disminuye solo tras finalizarse la quema en ATHMaster.

Las vías de fallo y rebote restauran los compartimentos de deuda. La contabilidad se conserva hasta que la transferencia o la quema aguas abajo se completa.

## Contabilidad en ATHWallet

Los saldos de ATH viven en contratos ATHWallet deterministas.

ATHWallet gestiona:

- el abono de la emisión de génesis;
- la transferencia ordinaria;
- la transferencia con notificación;
- la notificación de acuñación de nombre;
- la notificación de avatar;
- la solicitud de quema;
- la confirmación de notificación;
- la poda de una notificación obsoleta;
- la recuperación tras rebote o fallo.

Los contratos que aceptan ATH como pago no aceptan mensajes directos de direcciones arbitrarias. Solo aceptan notificaciones de su propia ATHWallet oficial. La autenticación de la wallet de origen ocurre dentro de ATHWallet mediante derivación determinista.

ATH expone puntos de entrada de transferencia al estilo TEP-74 para herramientas jetton genéricas, pero las acciones de protocolo de Platho usan mensajes de notificación ATH autenticados. Las integraciones externas no deben suponer que los flujos de notificación de Platho emiten un `JettonTransferNotification` genérico.

Las transferencias internas salientes en ATHWallet están protegidas por contabilidad de pendientes en origen y por una confirmación en origen. Un saldo no se restaura a partir del cuerpo de un rebote sin prueba de una operación pendiente.

## Ciclo de vida de ATH

1. `ATHMaster` crea la oferta fija de `100,000,000 ATH`.
2. Un despliegue de tesorería único recibe la oferta en la wallet ATH de tesorería.
3. La oferta se reparte entre actividad, liquidez, vesting a largo plazo y estabilidad de mercado.
4. Las personas usuarias publican mensajes pagando directamente desde su propia wallet.
5. Una publicación exitosa abona `10 ATH` de recompensa por actividad.
6. Cuando el airdrop por actividad de `15,000,000 ATH` se ha distribuido por completo y `airdrop_remaining_ath == 0`, se desbloquean los descuentos de comisión.
7. El pool ATH/GRAM se lanza al precio de referencia `1 ATH = 0.001 GRAM`.
8. Se congelan las evidencias de ruta y de precio posteriores al pool.
9. MarketStabilitySeller vende la reserva por los tramos x2..x21.
10. Habilitada la división, FeeAccumulator reparte las comisiones en GRAM entre tesorería y recompra.
11. BuybackBurn compra ATH con comisiones en GRAM y lo quema a través de ATHMaster.
12. Las comisiones por nombre y perfil crean deuda de tesorería en ATH y deuda de quema en ATH.
13. La oferta total disminuye gradualmente mediante quemas autenticadas.

## Modelo final

ATH une cuatro capas de Platho:

1. **Uso de la aplicación**: los mensajes generan recompensas por actividad.
2. **Funciones de pago**: los nombres y los avatares requieren ATH.
3. **Descuentos**: un saldo de ATH reduce la comisión de protocolo tras la puerta de distribución.
4. **Reducción de oferta**: parte de las comisiones en ATH y del resultado de la recompra se quema a través de ATHMaster.

El modelo parte de una oferta fija y una valoración de referencia de `100,000 GRAM`. La distribución primaria está ligada al uso real y pagado: los mensajes parten de `0.0191 GRAM` —hoy `0.0191 GRAM` un mensaje privado y `0.0203 GRAM` una publicación pública— más un bono de actividad de `10 ATH` por cápsula finalizada. Las clases de tamaño públicas o privadas mayores cuestan más. Ese bono no es un reembolso, una compensación ni una promesa de beneficio. Distribuido el primer 15% de la oferta, se lanza el pool, se desbloquean los descuentos y se abre la vía de recompra.

ATH existe como token de trabajo dentro de Platho: se distribuye por actividad, se usa en acciones de pago, reduce la comisión de protocolo, se vende desde la reserva por una escalera definida y se quema on-chain. Superada la escalera de estabilidad de mercado, el precio futuro de ATH lo determinan el mercado y el uso del protocolo.
