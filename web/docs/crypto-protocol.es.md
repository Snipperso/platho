# Criptografía de Platho

## Claves e identidad

Todo se deriva de una única frase semilla: la clave de la wallet, la de firma, la de cifrado y la de escaneo. Las mitades secretas nunca salen de tu dispositivo: no las conoce ningún servidor, porque no hay servidor, ni la red.

A la cadena solo llegan las mitades públicas, guardadas en tu KeyShard, cuya dirección está ligada a la de tu wallet. El fragmento solo puede contener lo que esa wallet registró: ese vínculo por dirección es toda la autorización. Se almacenan cuatro campos: la clave de cifrado, la de firma, la de escaneo y el número de generación de claves.

El identificador de clave no se asigna, se **calcula**: `keyId = H(clave de cifrado, hash de la clave ML-KEM)`. Para presentar el keyId de otra persona haría falta su clave de cifrado.

La activación es la primera publicación de tus propias claves públicas. Cuesta 0,06 GRAM, pagados desde tu wallet.

## Primer contacto

Una primera carta a un desconocido no puede apoyarse en un secreto compartido: todavía no existe. Por eso viaja por un carril propio.

**Cómo la encuentra el destinatario.** La parte pública de la cápsula ocupa 42 bytes: un punto aleatorio `R` y una etiqueta `view_tag` de dos bytes. La etiqueta se calcula a partir de `R` y de la clave de **escaneo** del destinatario. Este recorre las entradas recientes y comprueba la etiqueta con su propia clave; quien mire desde fuera solo ve bytes aleatorios y no puede saber a quién va dirigida la carta. La dirección del destinatario no aparece en la parte pública.

**Cómo sabe el destinatario quién escribe.** El cuerpo cifrado lleva un saludo criptográfico: la firma del remitente sobre una transcripción que vincula ambos keyId, la clave estática de cifrado del remitente, el hash de su clave ML-KEM, los dos textos cifrados KEM, `R`, el `view_tag` y un número de un solo uso. La firma se verifica **antes** de dar por buena cualquier información: de otro modo, un atacante podría injertar la firma ajena sobre su propio material de claves.

Bastan dos comprobaciones, y ninguna necesita leer la cadena:

1. el `keyId` se recalcula a partir de las claves presentadas y debe coincidir con el declarado;
2. una etiqueta de confirmación demuestra que el remitente **derivó la misma clave raíz**, lo que exige el secreto que hay detrás de la clave de cifrado.

La primera obliga al falsificador a usar la clave de la víctima; la segunda lo atrapa justo ahí: no podrá derivar la raíz, la etiqueta no cuadrará y la carta será rechazada.

Una repetición byte a byte queda detectada por el número de un solo uso del saludo.

Las entradas de primer contacto viven una semana en la cadena: lo bastante para que se lean, no lo bastante para convertirse en archivo.

## Una conversación establecida

Tras el primer contacto ambas partes comparten una clave raíz, y toda la correspondencia posterior pasa a un segundo carril que no dice absolutamente nada de quienes participan en ella.

```
K_root  = HKDF( X25519(a,B) ‖ secreto compartido ML-KEM-768,  info = ROOT ‖ keyId menor ‖ keyId mayor )
K_epoch = HKDF( K_root,  info = RATCHET ‖ número de época )
bucket  = HKDF( K_epoch, info = BUCKET ‖ dirección ‖ número de época )
```

La raíz es híbrida: entran en ella tanto el X25519 clásico como una encapsulación ML-KEM-768 auténtica y aleatorizada. En eso consiste la resistencia poscuántica: la raíz no cae ante un ordenador cuántico dirigido solo contra X25519.

Una época es un día UTC. Cada sentido de la conversación escribe en **su propio** `bucket` opaco, que solo puede calcular quien conozca la raíz. La parte pública de la cápsula son 40 bytes y contiene ese `bucket` y nada más: ni remitente, ni destinatario, ni referencia al mensaje anterior. Quien intente construir un índice verá 32 bytes uniformemente aleatorios, imposibles de atribuir a nadie.

## La cápsula

El cuerpo se cifra con un híbrido de X25519 y ML-KEM-768, bajo cifrado autenticado. La identidad del remitente (clave de firma, versión del perfil, huella del avatar) va **dentro** del texto cifrado, no en la parte pública.

Cada cápsula tiene una clase de tamaño fija, de 1 a 32 KB. El tamaño se redondea hacia arriba, así que la longitud de una entrada no revela la del mensaje. Lo que exceda se reparte entre varias cápsulas.

## El muro público

Las publicaciones y los comentarios públicos **no se cifran**: para eso están. Residen en un PublicShard en texto claro, y el contrato considera autor a quien envía la transacción, de modo que la wallet del autor queda a la vista.

Los comentarios viven en un fragmento aparte, cuya dirección se deriva de las coordenadas de la publicación.

## Pagos

No hay intermediario: el cliente firma él mismo el mensaje externo y paga desde su propia wallet. Ni retransmisor, ni saldos internos, ni un tercero de confianza capaz de negarte la publicación.

La comisión de protocolo es de 0,01 GRAM por cápsula, igual para un primer contacto que para una conversación. El resto del precio de una publicación es lo que cobra la red por gas y almacenamiento.

## Recuperación

Las claves de conversación se guardan en el dispositivo bajo una clave que jamás sale de él. Eso basta para sobrevivir a una recarga y no sirve de nada tras una reinstalación, así que existe una segunda copia: el mapa de claves raíz se sella **con una clave derivada de la frase semilla** y se deposita en tu ranura de RecoveryShard. Un dispositivo nuevo que solo tenga la semilla localiza la ranura, la lee y la descifra, y las conversaciones vuelven.

En la ranura se guarda únicamente aquello que no puede volver a derivarse.

## Qué está protegido y qué se ve

Una lista honesta: sin ella, cualquier promesa vale poco.

**Protegido:**

- el contenido de la correspondencia privada: solo pueden leerlo tú y la persona a la que escribes;
- a quién va dirigido un mensaje privado: el destinatario queda oculto por el direccionamiento sigiloso y por el `bucket` opaco;
- el grafo de quién se comunica con quién: sin la clave raíz, los dos sentidos no pueden enlazarse entre sí.

**Visible para todos:**

- que una wallet publicó una cápsula privada, cuándo y de qué clase de tamaño;
- todo lo público: texto, imágenes, comentarios y la wallet del autor.

## Permanencia en la cadena

| Qué | Cuánto |
|---|---|
| Primer contacto | 1 semana |
| Correspondencia privada | 1 año |
| Publicaciones y comentarios públicos | 1 año |

Cumplido el plazo, la entrada se barre de su fragmento. La transacción que la publicó permanece en el historial de la cadena de forma indefinida: borrar datos en una blockchain no es posible.
