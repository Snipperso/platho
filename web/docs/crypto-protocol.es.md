# Protocolo criptográfico de mensajes de Platho

Este documento describe el cifrado de mensajes del lado del cliente implementado por el prototipo PWA estático.

## Suites

| Suite | Valor de contrato | Propósito |
| --- | ---: | --- |
| `hybrid-v1` | `2` | Mensajes privados que usan X25519 más ML-KEM-768 más AES-GCM. |

La publicación privada V1 solo acepta `CRYPTO_SUITE_HYBRID = 2`.

## Paquetes de claves

Cada frase de recuperación GRAM de 24 palabras creada o importada por la PWA deriva de forma determinista una identidad de mensajería con un par de claves de cifrado y una clave de firma Ed25519. El material de la clave pública de cifrado se exporta como un paquete de clave pública:

- `keyId`: identificador basado en SHA-256 sobre el material de la clave pública.
- `x25519PublicKey`: clave pública ECDH clásica de 32 bytes.
- `mlKem768PublicKey`: clave pública ML-KEM-768 de 1184 bytes para `hybrid-v1`.
- `mlKem768PublicKeyHash`: SHA-256 de la clave pública ML-KEM-768.
- `mlKem768PublicKeyLen`: siempre `1184` para `hybrid-v1`.

La PWA recalcula `keyId`, `mlKem768PublicKeyHash` y `mlKem768PublicKeyLen` antes del cifrado. Se rechaza un paquete que declare un id, una suite, una suite de contrato, un hash o una longitud que no coincidan.

La búsqueda de destinatarios se define mediante `enc_pubkey`, `sign_pubkey` en cadena y la celda completa en cadena de `pq_kem_pubkey` almacenada en el registro de clave activo del Vault. El hash y la longitud permanecen en el registro como campos de vinculación compactos, pero la clave pública ML-KEM-768 completa es lo que permite a otro cliente cifrar realmente una cápsula `hybrid-v1`.

## Paquetes firmados

La PWA puede exportar un paquete de clave pública firmado. La carga útil firmada incluye:

- el dominio de protocolo `PLATHO.MESSAGING.KEY_BUNDLE.SIGNATURE.V1`;
- las marcas de tiempo de emisión y de caducidad opcional;
- los marcadores de posición opcionales para la billetera del propietario y la dirección del Vault;
- el paquete de cifrado público;
- la clave pública de firma Ed25519 de 32 bytes.

La firma cubre la carga útil JSON estable y se verifica antes de confiar en el paquete. Esto evita la manipulación local silenciosa del paquete y le da al cliente exactamente el `sign_pubkey` que el Vault almacena en `KeyRecord`.

El `keyId` de la PWA es un identificador de paquete del cliente. No reemplaza al `current_key_id` del contrato Vault, que se calcula en cadena a partir de la dirección del propietario, la generación de la clave, la clave de firma, la clave de cifrado, el hash PQ, la longitud PQ y la suite criptográfica. Un cliente de producción debe verificar el paquete contra el registro de clave del Vault antes de confiar en él para una identidad de billetera.

El paquete firmado es una autofirma de clave de mensajería. La propiedad de la billetera se ancla mediante la activación del Vault: la billetera Platho incrustada envía `RegisterMessagingKeys`, las rotaciones posteriores de `ReplaceMessagingKeys` son mensajes externos firmados con autenticación del Vault, y los destinatarios verifican el paquete firmado contra el registro de clave activo en cadena para esa billetera.

## Propiedad de la billetera

La PWA de producción no usa un conector de billetera externo. Un usuario crea o importa una frase de recuperación GRAM normal de 24 palabras, y la PWA
deriva de forma determinista la clave de la billetera GRAM, una clave de autenticación del Vault independiente y las claves de cifrado/firma de mensajería a partir de esa frase. La activación
del Vault es el ancla de propiedad: la billetera incrustada firma y envía `RegisterMessagingKeys` desde la misma billetera que posee el registro de clave en cadena.
`ReplaceMessagingKeys` rota únicamente el registro de clave pública de recepción/mensajería; no rota la clave de autenticación del Vault.

Los destinatarios confían en un paquete de mensajería solo después de comprobarlo contra el registro de clave activo del Vault para esa billetera:

- el propietario del registro es la billetera esperada;
- `enc_pubkey` y `sign_pubkey` coinciden con el paquete firmado;
- los registros híbridos exponen la celda completa `pq_kem_pubkey`, no solo su hash;
- los bytes decodificados de la clave ML-KEM-768 tienen como hash `pq_kem_pubkey_hash`;
- el `current_key_id` activo apunta al registro de clave verificado.

El flujo de exportación/importación de perfiles maneja la frase de recuperación GRAM de 24 palabras. No hay una copia de seguridad separada de la clave de mensajería ni
un modo de conexión de billetera externa en la v1 final.

## Disposición compacta de bytes

Las celdas en cadena de las cápsulas privadas usan la disposición binaria final `platho.byte-layout.v1`. La PWA puede envolver las cápsulas en JSON para la interfaz de exportación/compartir, pero la carga útil del protocolo son bytes binarios, no JSON ni un puntero fuera de cadena. `CapsuleHub` almacena cabeceras/índices autenticados compactos más el hash del cuerpo; la celda del cuerpo cifrado permanece en el cuerpo de la transacción de publicación aceptada y se reconstruye a partir del historial de mensajes de TON, luego se verifica contra los hashes almacenados.

Cada publicación pasa por el Vault como un mensaje externo firmado financiado con el saldo del Vault. El usuario primero financia su saldo GRAM
interno del Vault, luego la PWA firma una solicitud de publicación con el `auth_pubkey` activo; un retransmisor puede enviar el
mensaje externo sin poseer la clave de la billetera ni la clave de firma de mensajería. La carga útil firmada está separada por dominio con `VPB1`,
`deployment_manifest_hash`, la dirección del Vault de destino y el tipo de publicación, antes del propietario, el nonce, el cargo máximo y la carga útil.
El valor GRAM que CapsuleHub realmente devuelve en un ACK o un rebote se acredita al saldo GRAM interno del Vault del usuario,
limitado por el importe de reembolso de publicación pendiente registrado. Si el saldo del Vault o el acceso a la cadena no están disponibles, la
PWA falla de forma cerrada y no debe exponer acciones de publicación.

Dado que `auth_pubkey` autoriza el gasto del saldo del Vault, comprometer únicamente la clave local de firma de mensajería no autoriza
acciones de publicación, comprobación de pago, nombre de usuario o avatar del Vault. Un compromiso de la clave de firma de mensajería aún puede afectar las firmas de identidad
a nivel de mensaje, por lo que el reemplazo de clave revoca el antiguo registro de clave pública de recepción para futuras comprobaciones de cifrado entrante.

El precio de los mensajes en la PWA es por cápsula. Con las reservas actuales y sin descuento ATH, los ejemplos canónicos exactos son entradas públicas de 1 KiB desde `0.0337 GRAM` y cápsulas privadas
`hybrid-v1` de 1 KiB desde `0.0347 GRAM`; las clases de tamaño públicas o privadas mayores cuestan más según la clase canónica. Esto incluye la tarifa completa
del protocolo Platho de `0.01 GRAM`, la dotación de almacenamiento del índice compacto de CapsuleHub, la reserva de ejecución local del Vault y el
reembolso ACK esperado. Por separado, si la estimación conservadora de tarifa de la PWA es superior a la asignación de tarifas de red incluida
de `0.005 GRAM`, se añade
el exceso redondeado como recargo. Las llamadas a contratos aún parten de sus valores
requeridos canónicos: las publicaciones del Vault envían `maxCharge = canonical_max_charge + surcharge`. CapsuleHub no tiene ninguna ABI directa de publicación de usuario
en la v1 final; cada publicación es Vault -> CapsuleHub. Los descuentos ATH se aplican solo después de que el airdrop de actividad del Vault
haya distribuido 15,000,000 ATH; antes de esa condición, las tarifas del protocolo de mensajes usan la tarifa completa de `0.01 GRAM`. La PWA debe mostrar la retención final
y el coste neto para el tamaño de contenido seleccionado antes de firmar.

El recargo es un margen de seguridad firmado de red/almacenamiento, no un depósito de tarifas reembolsables. CapsuleHub acepta las publicaciones del Vault
cuando el valor adjunto es al menos el valor requerido canónico, pero un ACK de publicación exitoso devuelve solo la reserva fija
de ACK de publicación de `30,000,000` nanotons (`0.030 GRAM`). Después de que el Vault procese ese ACK, se acredita al usuario aproximadamente
`25,800,000` nanotons en el saldo GRAM interno del Vault. Cualquier recargo firmado por encima del valor requerido canónico permanece en
CapsuleHub como exceso de reserva de red/almacenamiento; no se devuelve al Vault y no se contabiliza como
`accrued_plato_fee_ton`.

CapsuleHub protege una reserva GRAM en bruto igual a `accrued_plato_fee_ton + max(100 GRAM, 1.25 * live_index_1y_storage_reserve)`.
La reserva en vivo usa contadores de entradas privadas/públicas no podados en lugar de contadores históricos de `latest_id`. Una llamada
`SweepExcessReserve` sin permisos independiente puede mover solo el excedente por encima de ese importe protegido a FeeAccumulator como
`DepositProtocolFee`, donde sigue la división normal de tesorería/recompra. El envío ordinario de mensajes no realiza este
barrido. Si ese depósito de barrido rebota, el importe devuelto se reclasifica intencionadamente como `accrued_plato_fee_ton`
respaldado para que pueda reintentarse a través de la ruta normal de vaciado de tarifas.
Las llamadas parciales normales `FlushFees` deben ser al menos la tarifa pública actual del protocolo (`0.010 GRAM`); un importe menor es
válido solo cuando es la totalidad del depósito acumulado restante, de modo que el polvo con descuento aún pueda finalizarse.

CapsuleHub registra `created_at = now()` para cada entrada privada y pública. La PWA usa esa marca de tiempo del contrato para el ordenamiento y para la búsqueda acotada en el historial de transacciones; las marcas de tiempo de las cabeceras del cliente permanecen como metadatos de carga útil autenticados, no como autoridad de descubrimiento. Los metadatos compactos de las entradas pueden podarse sin permisos después de la ventana de retención configurada de un año, mientras que la disponibilidad del cuerpo depende de la cobertura del historial de mensajes del proveedor de TON elegido y de la caché cifrada local del usuario.

El saldo ATH del Vault se acredita mediante contabilidad explícita de flujo de notificación, no escaneando el saldo en bruto de la billetera oficial.
La ruta de depósito admitida es la del `ATHTransferRequestWithNotify` de la ATHWallet del usuario hacia el Vault. La transferencia ordinaria manual de ATH
a la ATHWallet oficial del Vault no está admitida y no debe mostrarse como dirección de depósito ni tratarse como un
crédito en el libro mayor del Vault. El retiro de ATH del Vault es un comando externo firmado del Vault. Su reserva de despliegue/transferencia/ACK
de la ATHWallet posterior se paga con el saldo GRAM interno del Vault del usuario, y el Vault acredita de vuelta solo
el valor autenticado de ACK/fallo/rebote que recibe, menos la reserva de reembolso local y limitado por el valor interno reservado.

Las publicaciones y comentarios públicos son un perfil abierto independiente, no cápsulas privadas sin cifrado. Almacenan una celda compacta
de cabecera pública `PPH1` más una celda de cuerpo público en bruto. El texto del cuerpo público y los bytes de imagen/avatar públicos usan las mismas
clases de tamaño de cápsula pública de 1, 2, 4, 8, 16 o 32 KiB que el presupuesto de cuerpo visible para el usuario. Los metadatos de la cabecera nunca reducen
ese presupuesto de cuerpo. Las publicaciones públicas no tienen opción poscuántica; la redacción pública usa la etiqueta de producto `from 0.0337 GRAM`,
mientras que el ejemplo base público exacto actual es `0.0337 GRAM` más la misma
regla de recargo de tarifa de red. `kind = 1` es una publicación pública; el bit 0 de `flags` de la publicación cierra los comentarios para esa publicación. `kind = 2` es
un comentario público de un solo nivel con `parent_entry_id:uint64` y `parent_body_hash:uint256` en la cabecera. `kind = 3` es una
publicación de imagen pública, `kind = 4` es un comentario de imagen pública y `kind = 5` es media de avatar de billetera pública. Las cabeceras públicas también llevan `stream_id:uint128`,
`part_index:uint16`, `part_count:uint16` y `media_format:u8`; la v1 pública usa `media_format = 0` para texto y
`media_format = 1` para partes de imagen/avatar WebP. Las cabeceras de publicación pública, publicación de imagen y avatar también llevan
`profile_version:uint32` y `avatar_hash:uint256`; cero significa que no hay puntero de avatar. El texto público largo o los datos de imagen se reconstruyen a partir de múltiples entradas
solo después de que cada entrada haya usado la clase de tamaño público más pequeña que quepa, hasta 32 KiB. La PWA oficial comprime las imágenes seleccionadas a objetivos WebP de 8 KiB
(`low`), 16 KiB (`medium`), 32 KiB (`good`, predeterminado) o 64 KiB (`maximum`) antes de dividirlas. No hay capa de edición/borrado/reacción/moderación ni contadores en la v1.

Los avatares de billetera son actualizaciones de perfil pagadas, no activos fuera de cadena. Los bytes del avatar se publican como entradas públicas de CapsuleHub
`kind = 5`, luego `ProfileRegistry` registra el puntero de billetera autenticado:
`version`, `avatar_hash`, el primer `avatar_entry_id`, `avatar_stream_id`, `avatar_part_count` y `media_format`. Los lectores
resuelven el puntero de perfil a partir de la cabecera privada firmada o de la cabecera de la publicación pública, verifican el registro de ProfileRegistry
correspondiente, obtienen las entradas públicas del avatar desde CapsuleHub, concatenan las partes en orden de índice y exigen que los bytes WebP reconstruidos
tengan como hash `avatar_hash`. La caché local del avatar es solo una aceleración; la fuente de verdad es CapsuleHub más
ProfileRegistry.

`header0_cell` almacena exactamente 140 bytes:

```text
PH0B
|| version:u8
|| publish_kind:u8
|| size_class:u8
|| crypto_suite:u8
|| sender_key_id:32 bytes
|| recipient_key_id:32 bytes
|| sender_sign_pubkey:32 bytes
|| profile_version:uint32
|| avatar_hash:uint256
```

`header1_cell` almacena exactamente 30 bytes:

```text
PH1B
|| version:u8
|| flags:u8 = 0
|| created_at_s:u32
|| expires_at_s:u32
|| client_nonce:16 bytes
```

`size_class + crypto_suite` implican la suite. `profile_version` y `avatar_hash` apuntan al avatar de la billetera del remitente en el
momento del envío y están cubiertos por el hash de la cabecera más la firma del remitente. `recipient_sign_pubkey` y los hashes de hilo
intencionadamente no se almacenan en las celdas de cabecera pública. Los datos de hilo/agrupación pertenecen dentro de los metadatos de la cápsula cifrada.

Cada cuerpo cifrado se ensambla como:

```text
PLB1 || version:u8 || suite:u8 || flags:u8 || reserved:u8
     || message_id:u128
     || aes_gcm_nonce:12 bytes
     || x25519_ephemeral_public:32 bytes
     || ml_kem_768_ciphertext:1088 bytes, only for hybrid-v1
     || aes_gcm_ciphertext_and_tag
```

El texto plano de AES-GCM es una única ranura de cápsula fija seleccionada por `size_class`:

```text
PCP1
|| version:u8
|| kind:u8
|| flags:u8
|| media_format:u8
|| stream_id:u128
|| part_index:u16
|| part_count:u16
|| content_len:u16
|| reserved:u16
|| payload[useful_size]
```

El área de contenido útil se rellena hasta la clase de cápsula privada seleccionada de 1, 2, 4, 8, 16 o 32 KiB. Un mensaje con 1 byte, 500 bytes o 1024 bytes de texto útil tiene el mismo tamaño de texto plano cifrado en la clase de 1 KiB. Los mensajes por encima de la clase seleccionada se dividen en cápsulas independientes con metadatos cifrados de `stream_id`, `part_index` y `part_count`. Una cápsula nunca mezcla unidades de texto/imagen no relacionadas; el receptor reensambla las cápsulas independientes de vuelta en el mensaje original.

Tipos de contenido:

- `1` texto: bytes UTF-8, hasta el tamaño útil de cápsula privada seleccionado.
- `2` imagen: bytes de imagen comprimida, hasta el tamaño útil de cápsula privada seleccionado; `media_format` es `1` WebP, `2` AVIF, `3` JPEG o `4` PNG.
- `3` comprobación de pago: `asset:u8 || reserved:u8 || amount:u128 || intent_id:uint256 || secret32:uint256`.

Los cuerpos de comprobación de pago intencionadamente no incluyen `tx`, tiempo de activación ni caducidad. El receptor reclama mediante `intent_id + secret32`; si el remitente ya canceló la comprobación o esta ya fue reclamada, la interfaz indica que la comprobación ya fue reclamada o cancelada por el remitente.

El cuerpo cifrado puede envolverse para exportar/compartir como:

```text
PLC1 || version:u8 || suite:u8 || chunk_index:u8 || chunk_total:u8 || message_id:u128 || body_slice
```

Para el cuerpo de cápsula final, `chunk_total` es siempre `1`. `PLC1` es solo un marco de paquete/exportación. La transacción de publicación aceptada Vault -> CapsuleHub lleva los bytes del cuerpo `PLB1` ensamblados en una celda snake; CapsuleHub persiste solo metadatos y hashes autenticados compactos.

Límites privados finales de la v1:

| Suite | Tope útil por cápsula | Bytes del cuerpo | Bytes por fragmento de exportación |
| --- | ---: | ---: | ---: |
| `hybrid-v1` | 1 KiB | 2,228 bytes | 2,252 bytes |
| `hybrid-v1` | 2 KiB | 3,252 bytes | 3,276 bytes |
| `hybrid-v1` | 4 KiB | 5,300 bytes | 5,324 bytes |
| `hybrid-v1` | 8 KiB | 9,396 bytes | 9,420 bytes |
| `hybrid-v1` | 16 KiB | 17,588 bytes | 17,612 bytes |
| `hybrid-v1` | 32 KiB | 33,972 bytes | 33,996 bytes |

La fuente canónica de esta disposición es `artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md`.

AES-GCM usa un nonce de 12 bytes y una etiqueta de 16 bytes. La longitud del texto cifrado es igual a la longitud del texto plano más la etiqueta.

El prefijo de cuerpo compacto, `header0Hash` y `header1Hash` se pasan como datos autenticados adicionales de AES-GCM. Cambiar las cabeceras binarias de enrutamiento, la suite, el nonce, el texto cifrado KEM, los bytes de los fragmentos o la firma del remitente hace que la verificación o el descifrado fallen.

Antes del descifrado, el cliente también comprueba:

- que la suite del cuerpo compacto coincide con `header0`;
- que el id de clave del destinatario coincide con `header0.recipientKeyId`;
- que los cuerpos `hybrid-v1` sí llevan un texto cifrado ML-KEM de 1088 bytes;
- que cada fragmento tiene la misma suite, id de mensaje y total de fragmentos.

## Derivación de claves

Para `hybrid-v1`:

```text
x25519_secret = X25519(sender_ephemeral_secret, recipient_x25519_public)
mlkem_secret  = ML-KEM-768.Encapsulate(recipient_mlkem_public)
message_key   = HKDF-SHA-256(x25519_secret || mlkem_secret, compact_aad_hash)
```

El texto plano se cifra con AES-256-GCM.

La implementación rechaza los secretos compartidos X25519 de todo ceros para evitar aceptar claves públicas de orden bajo.

## Cápsulas cifradas privadas

El cliente envuelve los cuerpos cifrados compactos en una cápsula privada antes de la publicación. Una cápsula privada tiene:

- `header0`: la cabecera binaria de enrutamiento `PH0B` de 140 bytes descrita anteriormente.
- `header1`: la cabecera binaria de repetición `PH1B` de 30 bytes descrita anteriormente.
- `body`: los metadatos de fragmentos de `platho.byte-layout.v1` más los fragmentos binarios codificados en base64url.
- `hashes`: los valores de `Cell.hash()` de TON para las celdas exactas en cadena que contienen `header0`, `header1` y los bytes del cuerpo cifrado.
- `chainCells`: cargas útiles BOC en base64 que usan `ton-snake-byte-cell.v1`; estas son las celdas aceptadas en la transacción de publicación Vault -> CapsuleHub y autenticadas por `CapsuleHub`, no un puntero fuera de cadena.
- `senderSignature`: firma Ed25519 sobre el id de la cápsula y los tres hashes.

Para `hybrid-v1`, la cápsula usa el perfil híbrido de CapsuleHub:

```text
size_class   in {1,2,4,8,16,32}
crypto_suite = 2
```

El borrador de la cápsula privada se mapea al cuerpo `PublishPrivateFromVault` de Vault -> CapsuleHub después de que Vault acepte la solicitud
externa firmada `PublishPrivateFromVaultBalance`:

```text
header_0_hash = Cell.hash(header_0_cell)
header_1_hash = Cell.hash(header_1_cell)
body_hash     = Cell.hash(body_cell)
header_0_cell = snake-cell(header0 bytes)
header_1_cell = snake-cell(header1 bytes)
body_cell     = snake-cell(compact encrypted body bytes)
```

Los mensajes de publicación del Vault llevan `protocol_fee_paid`, porque el Vault es la autoridad de descuento para los precios respaldados por ATH.

La capacidad de carga útil útil es la capacidad de los bytes del cuerpo cifrado que realmente se serializan en `body_cell` y son aceptados por `CapsuleHub`. Un hash sin el cuerpo de la transacción de publicación aceptada correspondiente no es un mensaje v1 legible. El historial local es solo caché; no define la entrega en la v1.

Para la firma de publicación externa del Vault, el orden de las referencias de hashes permanece compatible con el contrato:

```text
body_hash || header_0_hash || header_1_hash
```

El cuerpo compacto está vinculado a `header0Hash` y `header1Hash` mediante el AAD de AES-GCM. Reemplazar las cabeceras, los fragmentos del cuerpo, los metadatos de la suite, la firma del remitente, el contexto de la cápsula o las celdas de carga útil BOC hace que la verificación falle antes de que se acepte el mensaje.

## Fuente de verdad de la entrega

Los mensajes privados v1 aceptados son entradas compactas de CapsuleHub más las celdas de carga útil cifrada que lleva el cuerpo de la transacción de publicación aceptada. La PWA recupera esas celdas del historial de mensajes de TON y las verifica contra los hashes de CapsuleHub antes de descifrar. La PWA de producción no expone el intercambio manual de paquetes JSON de paquete público o de cápsula cifrada.

Las claves públicas de mensajería se registran en los registros de clave del `Vault`. Un remitente debe resolver y verificar el registro de clave del destinatario antes de cifrar una cápsula privada. El historial cifrado local es solo una caché del dispositivo; no define la entrega.

La autoridad del nombre de usuario `.ath` tiene dos partes. `UsernameRegistry.get_name_record` demuestra que un nombre existe y apunta al
`UsernameNFTItem` exacto de ese nombre. El propietario actual se lee luego a partir del estado de ese item. Las transferencias cambian el propietario
del item; el registro del registry permanece como el ancla de nombre a item. El item expone datos NFT estándar y metadatos en cadena TEP-64,
incluyendo `name = <username>.ath`, sin una URI de metadatos alojada en servidor. Los bytes de nombre de usuario de la v1 son deliberadamente
literales: los nombres iniciales, finales, consecutivos y todos con separadores son válidos cuando cada byte está en el conjunto permitido `a-z`,
`0-9`, `_`, `-` y la longitud está entre 4 y 16. Si un mint pendiente queda obsoleto tras
un ACK de item faltante, `PrunePendingUsernameMint` es no destructivo en la v1: demuestra la condición de obsolescencia pero no elimina
el estado pendiente ni crea reembolso debido. Un item desplegado se convierte en un nombre de usuario autoritativo solo después de que el registry finaliza
el registro de nombre correspondiente mediante un ACK tardío válido o `ResendDeployedAck`. Los clientes e indexadores deben ignorar las reclamaciones
de propiedad basadas solo en el item y no deben usar el propietario del registro del registry como propietario actual después de las transferencias.

La frase de recuperación GRAM de 24 palabras es el único secreto del usuario. La PWA deriva de forma determinista la clave de la billetera GRAM y las claves de cifrado/firma de mensajería a partir de esa frase. Por lo tanto, el flujo de exportación/importación de perfiles maneja solo la frase de recuperación; no hay una copia de seguridad separada de la clave de mensajería.

## Política de repetición y caducidad

Las cápsulas privadas usan por defecto un TTL de 24 horas y están limitadas a 30 días. La verificación de paquetes de cápsula en vivo/fuera de cadena rechaza:

- las cápsulas creadas demasiado lejos en el futuro;
- las cápsulas caducadas;
- los TTL por encima del tope de la política;
- los ids de cápsula duplicados en la caché de repetición proporcionada por el llamador.

La importación desde el historial de la cadena es diferente: cuando una entrada privada ya ha sido aceptada por CapsuleHub y el cuerpo se recupera del
historial de transacciones de TON aceptado o de la caché cifrada local, la PWA verifica los hashes de la entrada, las celdas de cuerpo/cabecera y el
descifrado, pero no rechaza únicamente porque la caducidad de la cabecera esté en el pasado. De lo contrario, el historial de cadena retenido
se volvería ilegible por diseño.

La caché de repetición es estado local; los clientes de producción pueden respaldarla con IndexedDB u otro almacén local del dispositivo. No se requiere ningún backend.

## Regla de sin backend

La capa de cifrado no requiere un backend de Platho. Un servidor puede alojar archivos estáticos, pero la entrega privada se ancla mediante el estado de cadena de `CapsuleHub` más los cuerpos de las transacciones de publicación aceptadas: la entrada compacta demuestra los hashes, y el cuerpo aún debe estar disponible en el historial de mensajes de TON o en la caché cifrada local del usuario. El servidor nunca recibe texto plano, claves privadas ni un secreto de sesión del lado del servidor.

## Borrador de registro en el Vault

El cliente puede derivar un borrador de `RegisterMessagingKeys` a partir de un paquete firmado verificado:

- `enc_pubkey`: clave pública X25519 de 32 bytes como uint256.
- `sign_pubkey`: clave pública de firma Ed25519 de 32 bytes como uint256.
- `auth_pubkey`: clave pública de autenticación del Vault Ed25519 independiente de 32 bytes como uint256.
- `pq_kem_pubkey_hash`: SHA-256 de la clave pública ML-KEM-768.
- `pq_kem_pubkey_len`: `1184`.
- `pq_kem_pubkey`: celda snake canónica que contiene exactamente 1184 bytes de clave pública ML-KEM-768.
- `crypto_suite_mask`: `2` para `hybrid-v1`.

Este borrador se envía mediante el flujo de activación de la billetera Platho incrustada. Una vez que la billetera se activa en el Vault, otros usuarios activados pueden resolver su registro de clave pública de mensajería y cifrar cápsulas privadas hacia ella.

## Vinculación del registro de clave del Vault

Después de que la billetera haya registrado claves en cadena, el cliente debe obtener:

- el `UserState.current_key_id` de la billetera;
- para la propia billetera desbloqueada del usuario, el `UserState.auth_pubkey` que coincida con la clave pública de autenticación del Vault derivada localmente;
- el `VaultKeyRecordView` para ese id de clave.

La PWA expone esto como un puente de proveedor de fallo cerrado en `web/vault-chain-provider.mjs`. El puente espera un proveedor con:

```js
{
  async getUser(ownerWallet) {},
  async getKeyRecord(currentKeyId) {},
}
```

Si no se configura ningún proveedor, la vinculación del Vault permanece no disponible en lugar de aceptar un borrador local o un marcador de posición de interfaz. Un despliegue de producción/estático puede instalar un proveedor en `globalThis.plathoVaultChainProvider` que lea el Vault desplegado a través de un mirror de la API de TON o un transporte compatible con cliente ligero.

El runtime estático incluye `web/vault-ton-rpc-provider.mjs` como esqueleto del proveedor de producción. Puede envolver endpoints compatibles con TON Center v3 o un `globalThis.plathoTonRpcTransport` personalizado instalado por el bundle anfitrión. La PWA actual no expone una pantalla incorporada de configuración de RPC de usuario; si la documentación afirma un RPC elegido por el usuario, esa interfaz debe existir. El proveedor:

- codifica las direcciones de propietario de `get_user(owner)` como elementos de pila BoC de tipo `slice`;
- llama a `get_key_record(current_key_id)` con un elemento de pila numérico;
- decodifica las pilas de los getters en `VaultUserView` y `VaultKeyRecordView`;
- falla de forma cerrada si el transporte RPC, la dirección del Vault, la respuesta del getter o la vinculación del registro de clave no están disponibles.

El verificador del lado del cliente comprueba que el registro activo del Vault coincide con el paquete firmado verificado:

- `owner_wallet` coincide con la dirección de la billetera Platho incrustada;
- `enc_pubkey` coincide con la clave pública X25519;
- `sign_pubkey` coincide con la clave pública de firma del paquete;
- `pq_kem_pubkey`, `pq_kem_pubkey_hash` y `pq_kem_pubkey_len` coinciden con el material ML-KEM-768;
- `crypto_suite_mask` coincide con la suite;
- `revoked_lt` es cero;
- el `current_key_id` opcional apunta al id del registro obtenido.

El cliente no inventa el id de clave en cadena. El Vault lo calcula a partir de la dirección del propietario, la generación de la clave, los campos de la clave, la longitud PQ y la suite. El cliente verifica el registro obtenido en su lugar.

## Almacén de repetición duradero

La PWA usa IndexedDB para la protección de repetición de cápsulas privadas cuando está disponible, con un respaldo en memoria. El almacén conserva los ids de cápsula hasta su caducidad y poda localmente las entradas caducadas. Este es estado local del dispositivo y no requiere un servidor.

## Historial de mensajes cifrado local

La PWA también tiene un almacén de historial de mensajes cifrado local del dispositivo. Usa una clave AES-GCM-256 de WebCrypto no extraíble guardada en IndexedDB y almacena cada cuerpo de mensaje como texto cifrado autenticado. La cabecera del registro conserva solo metadatos de consulta locales: id, id de hilo, marca de tiempo, dirección y id de cápsula opcional.

La cabecera está vinculada como datos autenticados adicionales de AES-GCM. Cambiar el id de hilo, la marca de tiempo, la dirección, el id de cápsula, el nonce o el texto cifrado impide que el registro se abra. Si IndexedDB no está disponible, la aplicación recurre a un historial cifrado en memoria para esa sesión y evita escribir texto plano en el almacenamiento persistente del navegador.

## Estado de producción

La ruta de lanzamiento en mainnet usa derivación de billetera GRAM incrustada, claves de mensajería ancladas en el Vault, validación de paquetes firmados, vinculación de cadena del Vault con fallo cerrado, hashing de celdas de cápsulas privadas, firmas del remitente, almacenamiento de repetición duradero, historial de mensajes cifrado local y exportación/importación de frase de recuperación. El despliegue de producción debe mantener la configuración de la PWA fijada al manifiesto de mainnet verificado y a los proveedores de RPC de TON aprobados; se sigue recomendando una revisión criptográfica independiente para garantía a largo plazo.
