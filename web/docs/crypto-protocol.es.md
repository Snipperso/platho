# Protocolo criptográfico de mensajes de Platho

Este documento describe el cifrado de mensajes del lado del cliente implementado por la PWA de Platho.

## Cifrado

Los mensajes privados usan X25519 + ML-KEM-768 + AES-GCM, la única suite de mensajería privada (`hybrid-v1`, valor de contrato `2`).

## Paquetes de claves

Cada frase de recuperación GRAM de 24 palabras creada o importada por la PWA deriva de forma determinista una identidad de mensajería con un par de claves de cifrado y una clave de firma Ed25519. El material de la clave pública de cifrado se exporta como un paquete de clave pública:

- `keyId`: identificador basado en SHA-256 sobre el material de la clave pública.
- `x25519PublicKey`: clave pública ECDH clásica de 32 bytes.
- `mlKem768PublicKey`: clave pública ML-KEM-768 de 1184 bytes para `hybrid-v1`.
- `mlKem768PublicKeyHash`: SHA-256 de la clave pública ML-KEM-768.
- `mlKem768PublicKeyLen`: siempre `1184` para `hybrid-v1`.

La PWA vuelve a calcular `keyId`, `mlKem768PublicKeyHash` y `mlKem768PublicKeyLen` antes de cifrar. Se rechaza cualquier paquete que declare un id, una suite, una suite de contrato, un hash o una longitud que no coincidan.

La búsqueda del destinatario se define por las claves `enc_pubkey`, `sign_pubkey` on-chain y la celda `pq_kem_pubkey` on-chain completa almacenada en el registro de claves activo del Vault. El hash y la longitud permanecen en el registro como campos de vinculación compactos, pero es la clave pública ML-KEM-768 completa lo que permite a otro cliente cifrar realmente una cápsula `hybrid-v1`.

## Paquetes firmados

La PWA puede exportar un paquete de clave pública firmado. La carga útil firmada incluye:

- el dominio de protocolo `PLATHO.MESSAGING.KEY_BUNDLE.SIGNATURE.V1`;
- las marcas de tiempo de emisión y de caducidad opcional;
- marcadores opcionales de la billetera del propietario y de la dirección del Vault;
- el paquete de cifrado público;
- la clave pública de firma Ed25519 de 32 bytes.

La firma cubre la carga útil JSON estable y se verifica antes de confiar en el paquete. Esto evita la manipulación local silenciosa del paquete y proporciona al cliente exactamente la `sign_pubkey` que el Vault almacena en `KeyRecord`.

El `keyId` de la PWA es un identificador de paquete del cliente. No reemplaza al `current_key_id` del contrato Vault, que se calcula on-chain a partir de la dirección del propietario, la generación de la clave, la clave de firma, la clave de cifrado, el hash PQ, la longitud PQ y la suite criptográfica. Un cliente de producción debe verificar el paquete contra el registro de claves del Vault antes de confiar en él para una identidad de billetera.

El paquete firmado es una autofirma de la clave de mensajería. La propiedad de la billetera se ancla mediante la activación del Vault: la billetera Platho integrada envía `RegisterMessagingKeys`, las posteriores rotaciones `ReplaceMessagingKeys` son mensajes externos firmados con la autorización del Vault, y los destinatarios verifican el paquete firmado contra el registro de claves on-chain activo de esa billetera.

## Propiedad de la billetera

La PWA de producción no usa un conector de billetera externo. El usuario crea o importa una frase de recuperación GRAM normal de 24 palabras, y la PWA
deriva de forma determinista la clave de la billetera GRAM, una clave de autorización del Vault separada y las claves de cifrado/firma de mensajería a partir de esa frase. La activación
del Vault es el ancla de propiedad: la billetera integrada firma y envía `RegisterMessagingKeys` desde la misma billetera que posee el registro de claves on-chain.
`ReplaceMessagingKeys` rota únicamente el registro de la clave pública de recepción/mensajería; no rota la clave de autorización del Vault.

Los destinatarios solo confían en un paquete de mensajería después de comprobarlo contra el registro de claves activo del Vault para esa billetera:

- el propietario del registro es la billetera esperada;
- `enc_pubkey` y `sign_pubkey` coinciden con el paquete firmado;
- los registros híbridos exponen la celda `pq_kem_pubkey` completa, no solo su hash;
- los bytes decodificados de la clave ML-KEM-768 tienen como hash `pq_kem_pubkey_hash`;
- el `current_key_id` activo apunta al registro de claves verificado.

El flujo de exportación/importación de perfil gestiona la frase de recuperación GRAM de 24 palabras. No hay una copia de seguridad de la clave de mensajería separada ni
un modo de conexión de billetera externa.

## Diseño de bytes compacto

Las celdas on-chain de las cápsulas privadas usan el diseño binario final `platho.byte-layout.v1`. La PWA puede envolver las cápsulas en JSON para la interfaz de exportación/compartir, pero la carga útil del protocolo son bytes binarios, no JSON ni un puntero off-chain. `CapsuleHub` almacena encabezados/índices autenticados compactos más el hash del cuerpo; la celda del cuerpo cifrado permanece en el cuerpo de la transacción de publicación aceptada y se reconstruye a partir del historial de mensajes de TON, y luego se verifica contra los hashes almacenados.

Cada publicación pasa por el Vault como un mensaje externo firmado financiado con el saldo del Vault. El usuario primero financia su saldo GRAM
interno del Vault, luego la PWA firma una solicitud de publicación con la `auth_pubkey` activa; un retransmisor puede enviar el
mensaje externo sin poseer la clave de la billetera ni la clave de firma de mensajería. La carga útil firmada está separada por dominio con `VPB1`,
`deployment_manifest_hash`, la dirección del Vault de destino y el tipo de publicación, antes del propietario, el nonce, el cargo máximo y la carga útil.
El valor GRAM que CapsuleHub realmente devuelve en un ACK o rebote se acredita al saldo GRAM interno
del Vault del usuario, con un tope del importe de reembolso de publicación pendiente rastreado. Si el saldo del Vault o el acceso a la cadena no están disponibles, la
PWA falla de forma cerrada y no debe exponer acciones de publicación.

Dado que `auth_pubkey` autoriza el gasto del saldo del Vault, comprometer únicamente la clave local de firma de mensajería no autoriza
acciones del Vault de publicación, verificación de pagos, nombre de usuario o avatar. El compromiso de una clave de firma de mensajería aún puede afectar a las firmas de identidad
a nivel de mensaje, por lo que la sustitución de la clave revoca el antiguo registro de la clave pública de recepción para las futuras comprobaciones de cifrado entrante.

El precio de los mensajes de la PWA es por cápsula. Con las reservas actuales y sin descuento ATH, ejemplos canónicos exactos son entradas públicas de 1 KiB desde `0.0337 GRAM` y cápsulas privadas
`hybrid-v1` de 1 KiB desde `0.0347 GRAM`; las clases de tamaño públicas o privadas mayores cuestan más según la clase canónica. Esto incluye la
tarifa completa del protocolo Platho de `0.01 GRAM`, la dotación de almacenamiento del índice compacto de CapsuleHub, la reserva de ejecución local del Vault y el
reembolso ACK esperado. Por separado, si la estimación conservadora de tarifas de la PWA es superior a la asignación de tarifa de red incluida
de `0.005 GRAM`, añade
el exceso redondeado como recargo. Las llamadas al contrato aún parten de sus valores
canónicos requeridos: las publicaciones del Vault envían `maxCharge = canonical_max_charge + surcharge`. CapsuleHub no tiene una ABI de publicación
directa del usuario; cada publicación es Vault -> CapsuleHub. Los descuentos ATH solo se aplican después de que el airdrop de actividad del Vault
haya distribuido 15,000,000 ATH; antes de esa condición, las tarifas del protocolo de mensajes usan la tarifa completa de `0.01 GRAM`. La PWA debe mostrar la retención
final y el coste neto para el tamaño de contenido seleccionado antes de firmar.

El recargo es un margen de seguridad de red/almacenamiento firmado, no un depósito de tarifas reembolsable. CapsuleHub acepta las publicaciones del Vault
cuando el valor adjunto es al menos el valor canónico requerido, pero un ACK de publicación exitoso devuelve solo la reserva fija
de ACK de publicación de `30,000,000` nanotons (`0.030 GRAM`). Después de que el Vault procese ese ACK, se acreditan al usuario aproximadamente
`25,800,000` nanotons en el saldo GRAM interno del Vault. Cualquier recargo firmado por encima del valor canónico requerido permanece en
CapsuleHub como exceso de reserva de red/almacenamiento; no se devuelve al Vault y no se cuenta como
`accrued_plato_fee_ton`.

CapsuleHub protege una reserva GRAM bruta igual a `accrued_plato_fee_ton + max(100 GRAM, 1.25 * live_index_1y_storage_reserve)`.
La reserva en vivo usa los contadores de entradas privadas/públicas no podados en lugar de los contadores históricos `latest_id`. Una llamada
`SweepExcessReserve` separada y sin permisos puede mover solo el excedente por encima de ese importe protegido a FeeAccumulator como
`DepositProtocolFee`, donde sigue la división normal de tesorería/recompra. El envío ordinario de mensajes no realiza este
barrido. Si ese depósito de barrido rebota, el importe devuelto se reclasifica intencionadamente como `accrued_plato_fee_ton` respaldado
para que pueda reintentarse a través de la ruta normal de descarga de tarifas.
Las llamadas parciales normales `FlushFees` deben ser al menos la tarifa pública actual del protocolo (`0.010 GRAM`); un importe menor es
válido solo cuando es la totalidad del depósito acumulado restante, de modo que el polvo con descuento aún pueda finalizarse.

CapsuleHub registra `created_at = now()` para cada entrada privada y pública. La PWA usa esa marca de tiempo del contrato para el ordenamiento y para la búsqueda acotada en el historial de transacciones; las marcas de tiempo de los encabezados del cliente siguen siendo metadatos autenticados de la carga útil, no una autoridad de descubrimiento. Los metadatos compactos de las entradas pueden podarse sin permisos tras la ventana de retención de un año configurada, mientras que la disponibilidad del cuerpo depende de la cobertura del historial de mensajes del proveedor de TON elegido y de la caché cifrada local del usuario.

El saldo ATH del Vault se acredita mediante una contabilidad explícita de flujo de notificación, no escaneando el saldo bruto de la billetera oficial.
La ruta de depósito compatible es la `ATHTransferRequestWithNotify` de la ATHWallet del usuario hacia el Vault. La transferencia ATH ordinaria
manual a la ATHWallet oficial del Vault no está soportada y no debe mostrarse como una dirección de depósito ni tratarse como un
crédito del libro mayor del Vault. La retirada de ATH del Vault es un comando externo firmado del Vault. Su reserva descendente de
despliegue/transferencia/ACK de la ATHWallet se paga desde el saldo GRAM interno del Vault del usuario, y el Vault solo devuelve como crédito
el valor de ACK/fallo/rebote autenticado que recibe, menos la reserva de reembolso local y con un tope del valor interno reservado.

Las publicaciones y comentarios públicos son un perfil abierto separado, no cápsulas privadas sin cifrado. Almacenan una celda de encabezado público
`PPH1` compacta más una celda de cuerpo público bruto. El texto del cuerpo público y los bytes de imagen/avatar públicos usan las mismas
clases de tamaño de cápsula pública de 1, 2, 4, 8, 16 o 32 KiB que el presupuesto del cuerpo visible para el usuario. Los metadatos del encabezado nunca reducen
ese presupuesto del cuerpo. Las publicaciones públicas no tienen opción poscuántica; los mensajes públicos parten de `0.0337 GRAM`,
mientras que el ejemplo base público exacto actual es `0.0337 GRAM` más la misma
regla de recargo de tarifa de red. `kind = 1` es una publicación pública; el bit 0 de `flags` de la publicación cierra los comentarios de esa publicación. `kind = 2` es
un comentario público de un nivel con `parent_entry_id:uint64` y `parent_body_hash:uint256` en el encabezado. `kind = 3` es
una publicación pública de imagen, `kind = 4` es un comentario público de imagen y `kind = 5` es media de avatar de billetera pública. Los encabezados públicos también llevan `stream_id:uint128`,
`part_index:uint16`, `part_count:uint16` y `media_format:u8`; los encabezados públicos usan `media_format = 0` para texto y
`media_format = 1` para las partes de imagen/avatar WebP. Los encabezados de publicación pública, publicación de imagen y avatar también llevan
`profile_version:uint32` y `avatar_hash:uint256`; cero significa que no hay puntero de avatar. El texto público largo o los datos de imagen se reconstruyen a partir de múltiples entradas
solo después de que cada entrada haya usado la clase de tamaño público más pequeña que encaje, hasta 32 KiB. La PWA oficial comprime las imágenes seleccionadas a objetivos WebP de 8 KiB
(`low`), 16 KiB (`medium`), 32 KiB (`good`, predeterminado) o 64 KiB (`maximum`) antes de dividirlas. No hay ninguna capa de edición/eliminación/reacción/moderación ni de contadores.

Los avatares de billetera son actualizaciones de perfil pagadas, no activos off-chain. Los bytes del avatar se publican como entradas públicas
`kind = 5` de CapsuleHub, y luego `ProfileRegistry` registra el puntero de billetera autenticado:
`version`, `avatar_hash`, primer `avatar_entry_id`, `avatar_stream_id`, `avatar_part_count` y `media_format`. Los lectores
resuelven el puntero de perfil a partir del encabezado privado firmado o del encabezado de la publicación pública, verifican el registro coincidente de ProfileRegistry,
obtienen las entradas públicas del avatar de CapsuleHub, concatenan las partes en orden de índice y exigen que los bytes WebP reconstruidos
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
momento del envío y están cubiertos por el hash del encabezado más la firma del remitente. `recipient_sign_pubkey` y los hashes de hilo
intencionadamente no se almacenan en las celdas de encabezado público. Los datos de hilo/agrupación pertenecen al interior de los metadatos cifrados de la cápsula.

Cada cuerpo cifrado se ensambla como:

```text
PLB1 || version:u8 || suite:u8 || flags:u8 || reserved:u8
     || message_id:u128
     || aes_gcm_nonce:12 bytes
     || x25519_ephemeral_public:32 bytes
     || ml_kem_768_ciphertext:1088 bytes, only for hybrid-v1
     || aes_gcm_ciphertext_and_tag
```

El texto plano de AES-GCM es un único espacio de cápsula fijo seleccionado por `size_class`:

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

El área de contenido útil se rellena hasta la clase de cápsula privada seleccionada de 1, 2, 4, 8, 16 o 32 KiB. Un mensaje con 1 byte, 500 bytes o 1024 bytes de texto útil tiene el mismo tamaño de texto plano cifrado en la clase de 1 KiB. Los mensajes que superan la clase seleccionada se dividen en cápsulas independientes con metadatos cifrados `stream_id`, `part_index` y `part_count`. Una cápsula nunca mezcla unidades de texto/imagen no relacionadas; el receptor reensambla las cápsulas independientes para recomponer el mensaje original.

Tipos de contenido:

- `1` texto: bytes UTF-8, hasta el tamaño útil de la cápsula privada seleccionada.
- `2` imagen: bytes de imagen WebP comprimida, hasta el tamaño útil de la cápsula privada seleccionada (`media_format = 1`).
- `3` verificación de pago: `asset:u8 || reserved:u8 || amount:u128 || intent_id:uint256 || secret32:uint256`.

Los cuerpos de verificación de pago intencionadamente no incluyen `tx`, hora de activación ni caducidad. El receptor reclama mediante `intent_id + secret32`; si el remitente ya canceló la verificación o esta ya fue reclamada, la interfaz indica que la verificación ya fue reclamada o cancelada por el remitente.

El cuerpo cifrado puede envolverse para exportar/compartir como:

```text
PLC1 || version:u8 || suite:u8 || chunk_index:u8 || chunk_total:u8 || message_id:u128 || body_slice
```

Para el cuerpo de la cápsula final, `chunk_total` siempre es `1`. `PLC1` es únicamente encuadre de paquete/exportación. La transacción de publicación aceptada Vault -> CapsuleHub lleva los bytes del cuerpo `PLB1` ensamblado en una celda snake; CapsuleHub persiste únicamente los metadatos y hashes autenticados compactos.

Límites privados finales:

| Suite | Tope útil por cápsula | Bytes del cuerpo | Bytes del fragmento de exportación |
| --- | ---: | ---: | ---: |
| `hybrid-v1` | 1 KiB | 2,228 bytes | 2,252 bytes |
| `hybrid-v1` | 2 KiB | 3,252 bytes | 3,276 bytes |
| `hybrid-v1` | 4 KiB | 5,300 bytes | 5,324 bytes |
| `hybrid-v1` | 8 KiB | 9,396 bytes | 9,420 bytes |
| `hybrid-v1` | 16 KiB | 17,588 bytes | 17,612 bytes |
| `hybrid-v1` | 32 KiB | 33,972 bytes | 33,996 bytes |

La fuente canónica de este diseño es `artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md`.

AES-GCM usa un nonce de 12 bytes y una etiqueta de 16 bytes. La longitud del texto cifrado es igual a la longitud del texto plano más la etiqueta.

El prefijo compacto del cuerpo, `header0Hash` y `header1Hash` se pasan como datos autenticados adicionales de AES-GCM. Cambiar los encabezados binarios de enrutamiento, la suite, el nonce, el texto cifrado KEM, los bytes del fragmento o la firma del remitente hace que la verificación o el descifrado fallen.

Antes de descifrar, el cliente también comprueba:

- que la suite del cuerpo compacto coincida con `header0`;
- que el id de clave del destinatario coincida con `header0.recipientKeyId`;
- que los cuerpos `hybrid-v1` sí lleven un texto cifrado ML-KEM de 1088 bytes;
- que cada fragmento tenga la misma suite, el mismo id de mensaje y el mismo total de fragmentos.

## Derivación de claves

Para `hybrid-v1`:

```text
x25519_secret = X25519(sender_ephemeral_secret, recipient_x25519_public)
mlkem_secret  = ML-KEM-768.Encapsulate(recipient_mlkem_public)
message_key   = HKDF-SHA-256(x25519_secret || mlkem_secret, compact_aad_hash)
```

El texto plano se cifra con AES-256-GCM.

La implementación rechaza los secretos compartidos X25519 con todos los bytes en cero para evitar aceptar claves públicas de orden bajo.

## Cápsulas privadas cifradas

El cliente envuelve los cuerpos cifrados compactos en una cápsula privada antes de la publicación. Una cápsula privada tiene:

- `header0`: el encabezado binario de enrutamiento `PH0B` de 140 bytes descrito anteriormente.
- `header1`: el encabezado binario de repetición `PH1B` de 30 bytes descrito anteriormente.
- `body`: metadatos de fragmentos `platho.byte-layout.v1` más fragmentos binarios codificados en base64url.
- `hashes`: valores `Cell.hash()` de TON de las celdas on-chain exactas que contienen `header0`, `header1` y los bytes del cuerpo cifrado.
- `chainCells`: cargas útiles BOC en base64 que usan `ton-snake-byte-cell.v1`; estas son las celdas aceptadas en la transacción de publicación Vault -> CapsuleHub y autenticadas por `CapsuleHub`, no un puntero off-chain.
- `senderSignature`: firma Ed25519 sobre el id de la cápsula y los tres hashes.

Para `hybrid-v1`, la cápsula usa el perfil híbrido de CapsuleHub:

```text
size_class   in {1,2,4,8,16,32}
crypto_suite = 2
```

El borrador de la cápsula privada se asigna al cuerpo `PublishPrivateFromVault` de Vault -> CapsuleHub después de que el Vault acepte la solicitud
externa firmada `PublishPrivateFromVaultBalance`:

```text
header_0_hash = Cell.hash(header_0_cell)
header_1_hash = Cell.hash(header_1_cell)
body_hash     = Cell.hash(body_cell)
header_0_cell = snake-cell(header0 bytes)
header_1_cell = snake-cell(header1 bytes)
body_cell     = snake-cell(compact encrypted body bytes)
```

Los mensajes de publicación del Vault llevan `protocol_fee_paid`, porque el Vault es la autoridad de descuento para el precio respaldado por ATH.

La capacidad de carga útil útil es la capacidad de los bytes del cuerpo cifrado que realmente se serializan en `body_cell` y que `CapsuleHub` acepta. Un hash sin el cuerpo de transacción de publicación aceptado correspondiente no es un mensaje legible. El historial local es solo caché; no define la entrega.

Para la firma de la publicación externa del Vault, el orden de las referencias de hashes sigue siendo compatible con el contrato:

```text
body_hash || header_0_hash || header_1_hash
```

El cuerpo compacto se vincula a `header0Hash` y `header1Hash` mediante el AAD de AES-GCM. Reemplazar los encabezados, los fragmentos del cuerpo, los metadatos de la suite, la firma del remitente, el contexto de la cápsula o las celdas de la carga útil BOC hace que la verificación falle antes de que se acepte el mensaje.

## Fuente de verdad de la entrega

Los mensajes privados aceptados son entradas compactas de CapsuleHub más las celdas de carga útil cifrada que lleva el cuerpo de la transacción de publicación aceptada. La PWA recupera esas celdas del historial de mensajes de TON y las verifica contra los hashes de CapsuleHub antes de descifrar. La PWA de producción no expone el intercambio manual de paquetes JSON de paquete público o de cápsula cifrada.

Las claves públicas de mensajería se registran en los registros de claves del `Vault`. Un remitente debe resolver y verificar el registro de claves del destinatario antes de cifrar una cápsula privada. El historial cifrado local es solo una caché del dispositivo; no define la entrega.

La autoridad del nombre de usuario `.ath` tiene dos partes. `UsernameRegistry.get_name_record` demuestra que un nombre existe y apunta al
`UsernameNFTItem` exacto de ese nombre. El propietario actual se lee entonces del estado de ese item. Las transferencias cambian el propietario
del item; el registro de la registry sigue siendo el ancla nombre-a-item. El item expone datos NFT estándar y metadatos on-chain TEP-64,
incluido `name = <username>.ath`, sin un URI de metadatos alojado en un servidor. Los bytes del nombre de usuario son deliberadamente
literales: los nombres con caracteres al inicio, al final, consecutivos y de solo separadores son válidos cuando cada byte está en el conjunto permitido `a-z`,
`0-9`, `_`, `-` y la longitud es 4..16. Si un mint pendiente queda obsoleto tras
un ACK de item ausente, `PrunePendingUsernameMint` no es destructivo: demuestra la condición obsoleta pero no elimina
el estado pendiente ni crea un reembolso debido. Un item desplegado se convierte en un nombre de usuario autoritativo solo después de que la registry finalice
el registro de nombre coincidente mediante un ACK tardío válido o `ResendDeployedAck`. Los clientes e indexadores deben ignorar las reclamaciones
de propiedad basadas solo en el item y no deben usar el propietario del registro de la registry como el propietario actual tras las transferencias.

La frase de recuperación GRAM de 24 palabras es el único secreto del usuario. La PWA deriva de forma determinista la clave de la billetera GRAM y las claves de cifrado/firma de mensajería a partir de esa frase. Por lo tanto, el flujo de exportación/importación de perfil gestiona únicamente la frase de recuperación; no hay una copia de seguridad de la clave de mensajería separada.

## Política de repetición y caducidad

Las cápsulas privadas tienen un TTL predeterminado de 24 horas y un tope de 30 días. La verificación de paquetes de cápsula en vivo/off-chain rechaza:

- las cápsulas creadas demasiado lejos en el futuro;
- las cápsulas caducadas;
- los TTL por encima del tope de la política;
- los ids de cápsula duplicados en la caché de repetición proporcionada por el llamador.

La importación del historial de la cadena es diferente: cuando una entrada privada ya está aceptada por CapsuleHub y el cuerpo se recupera del
historial de transacciones TON aceptadas o de la caché cifrada local, la PWA verifica los hashes de la entrada, las celdas de cuerpo/encabezado y el
descifrado, pero no la rechaza únicamente porque la caducidad del encabezado esté en el pasado. De lo contrario, el historial de cadena retenido
quedaría ilegible por diseño.

La caché de repetición es estado local; los clientes de producción pueden respaldarla con IndexedDB u otro almacén local del dispositivo. No se requiere ningún backend.

## Regla sin backend

La capa de cifrado no requiere un backend de Platho. Un servidor puede alojar archivos estáticos, pero la entrega privada se ancla en el estado de la cadena de `CapsuleHub` más los cuerpos de las transacciones de publicación aceptadas: la entrada compacta demuestra los hashes, y el cuerpo aún debe estar disponible desde el historial de mensajes de TON o desde la caché cifrada local del usuario. El servidor nunca recibe texto plano, claves privadas ni un secreto de sesión del lado del servidor.

## Borrador de registro en el Vault

El cliente puede derivar un borrador `RegisterMessagingKeys` a partir de un paquete firmado verificado:

- `enc_pubkey`: clave pública X25519 de 32 bytes como uint256.
- `sign_pubkey`: clave pública de firma Ed25519 de 32 bytes como uint256.
- `auth_pubkey`: clave pública de autorización del Vault Ed25519 separada de 32 bytes como uint256.
- `pq_kem_pubkey_hash`: SHA-256 de la clave pública ML-KEM-768.
- `pq_kem_pubkey_len`: `1184`.
- `pq_kem_pubkey`: celda snake canónica que contiene exactamente 1184 bytes de la clave pública ML-KEM-768.
- `crypto_suite_mask`: `2` para `hybrid-v1`.

Este borrador se envía mediante el flujo de activación de la billetera Platho integrada. Una vez que la billetera está activada en el Vault, otros usuarios activados pueden resolver su registro de clave pública de mensajería y cifrar cápsulas privadas dirigidas a ella.

## Vinculación del registro de claves del Vault

Después de que la billetera haya registrado las claves on-chain, el cliente debe obtener:

- el `UserState.current_key_id` de la billetera;
- para la propia billetera desbloqueada del usuario, el `UserState.auth_pubkey` que coincida con la clave pública de autorización del Vault derivada localmente;
- el `VaultKeyRecordView` para ese id de clave.

> **clean-17.** El contrato Vault descrito en este capítulo pertenece a clean-15. En clean-17 el mismo vínculo se lee del contrato KeyShard PROPIO de la billetera (`web/key-shard-ton-rpc-provider.mjs`), cuya dirección se deriva de la billetera, por lo que un registro solo puede contener claves que esa billetera registró. El puente de proveedor `web/vault-chain-provider.mjs` se eliminó junto con el Vault.

```js
{
  async getUser(ownerWallet) {},
  async getKeyRecord(currentKeyId) {},
}
```

Si no hay ningún proveedor configurado, la vinculación del Vault permanece no disponible en lugar de aceptar un borrador local o un marcador de posición de la interfaz. Un despliegue de producción/estático puede instalar un proveedor en `globalThis.plathoVaultChainProvider` que lea el Vault desplegado a través de un mirror de la API de TON o un transporte compatible con cliente ligero.

El runtime estático incluye `web/vault-ton-rpc-provider.mjs` como el esqueleto del proveedor de producción. Puede envolver endpoints compatibles con TON Center v3 o un `globalThis.plathoTonRpcTransport` personalizado instalado por el bundle anfitrión. La PWA actual no expone una pantalla de configuración de RPC de usuario integrada. El proveedor:

- codifica las direcciones de propietario de `get_user(owner)` como elementos de pila BoC `slice`;
- llama a `get_key_record(current_key_id)` con un elemento de pila numérico;
- decodifica las pilas de getters en `VaultUserView` y `VaultKeyRecordView`;
- falla de forma cerrada si el transporte RPC, la dirección del Vault, la respuesta del getter o la vinculación del registro de claves no están disponibles.

El verificador del lado del cliente comprueba que el registro activo del Vault coincida con el paquete firmado verificado:

- `owner_wallet` coincide con la dirección de la billetera Platho integrada;
- `enc_pubkey` coincide con la clave pública X25519;
- `sign_pubkey` coincide con la clave pública de firma del paquete;
- `pq_kem_pubkey`, `pq_kem_pubkey_hash` y `pq_kem_pubkey_len` coinciden con el material ML-KEM-768;
- `crypto_suite_mask` coincide con la suite;
- `revoked_lt` es cero;
- el `current_key_id` opcional apunta al id del registro obtenido.

El cliente no inventa el id de clave on-chain. El Vault lo calcula a partir de la dirección del propietario, la generación de la clave, los campos de la clave, la longitud PQ y la suite. En su lugar, el cliente verifica el registro obtenido.

## Almacén de repetición duradero

La PWA usa IndexedDB para la protección contra repetición de cápsulas privadas cuando está disponible, con un respaldo en memoria. El almacén conserva los ids de cápsula hasta la caducidad de su cápsula y poda las entradas caducadas localmente. Este es estado local del dispositivo y no requiere un servidor.

## Historial de mensajes local cifrado

La PWA también tiene un almacén de historial de mensajes cifrado local del dispositivo. Usa una clave AES-GCM-256 de WebCrypto no extraíble guardada en IndexedDB y almacena cada cuerpo de mensaje como texto cifrado autenticado. El encabezado del registro conserva solo metadatos de consulta locales: id, id de hilo, marca de tiempo, dirección e id de cápsula opcional.

El encabezado se vincula como datos autenticados adicionales de AES-GCM. Cambiar el id de hilo, la marca de tiempo, la dirección, el id de cápsula, el nonce o el texto cifrado impide que el registro se abra. Si IndexedDB no está disponible, la aplicación recurre a un historial cifrado en memoria para esa sesión y evita escribir texto plano en el almacenamiento persistente del navegador.
