# Acerca de Platho

Platho es una aplicación de comunicación para personas que están cansadas de depender de la infraestructura de otros para su vida digital básica: mensajes, identidad, perfil, historial y acceso a sus propios fondos.

La internet común está construida de forma demasiado cómoda para quienes la controlan. Una cuenta puede cerrarse. El acceso puede limitarse. El historial puede borrarse. Las reglas pueden cambiarse después de que los usuarios ya han trasladado parte de sus vidas a una plataforma. Allí el usuario no es propietario. El usuario es un inquilino que existe mientras la plataforma se lo permita.

Platho está construido en contra de ese modelo.

Las acciones centrales en Platho están ancladas por la wallet del usuario y se ejecutan a través de contratos inteligentes abiertos. La wallet sigue siendo la raíz del control, mientras que la actividad rutinaria de la app puede ejecutarse a través del Vault y de comandos firmados en lugar de exponer la wallet directamente cada vez. Eso no hace que el sistema sea perfecto. Elimina el defecto central de las plataformas comunes: la capacidad oculta de reescribir las reglas, cortar el acceso o tomar el control de lo que debería pertenecer al usuario.

Los mensajes privados se anclan on-chain como entradas de cápsula cifradas. El cuerpo cifrado pesado se transporta en el cuerpo de la transacción TON aceptada, se recupera del historial de transacciones TON aceptadas y se verifica contra los hashes de CapsuleHub, de modo que la disponibilidad depende de la cobertura del historial del proveedor y de la caché cifrada local del usuario. Los mensajes públicos, los perfiles y los nombres usan un estado de contrato verificable en lugar de una base de datos cerrada. Eso reduce la dependencia de un servidor, de un operador y de la política que resulte conveniente esta semana.

Platho no oculta el costo de esta arquitectura. La blockchain es pública. Las operaciones cuestan dinero. Los errores del usuario pueden ser irreversibles. Una frase semilla perdida no puede recuperarse a través de soporte, y Platho no es un archivo permanente: las entradas de cápsula compactas pueden podarse después de la ventana de retención, mientras que la recuperación de cuerpos antiguos depende del historial del proveedor o de la caché local del usuario. Este es un modelo duro.

La wallet personal y el Vault están separados. La wallet sigue siendo la raíz del control: deposita y retira fondos, y controla las claves. El Vault es una capa de contrato protectora entre la wallet y la red pública. El usuario mueve una cantidad limitada de GRAM/ATH al Vault, y la publicación, los pagos de protocolo y otras operaciones de la app se ejecutan a través de saldos internos y comandos firmados. Esto reduce la exposición directa de la wallet on-chain y limita cuánto valor queda expuesto a la actividad rutinaria de la app.

ATH es el token de utilidad del protocolo. Se usa para nombres de usuario, actualizaciones de avatar y descuentos en las tarifas de protocolo posteriores al airdrop. Su función está ligada al uso real dentro de la app.

ATH está diseñado para los participantes del sistema. Una parte significativa del suministro se distribuye a través de la actividad del usuario en lugar de mediante una asignación cerrada a direcciones tempranas. Eso hace que la economía dependa menos de un conjunto reducido de poseedores y esté más conectada con el uso real de la red.

Platho no tiene ningún control administrativo oculto sobre los saldos de los usuarios. Los contratos no le dan a nadie un interruptor de administrador arbitrario para incautar los fondos de otras personas, reescribir saldos, pausar las operaciones de los usuarios ni actualizar las reglas del protocolo. V1 aún tiene autoridades de lanzamiento documentadas y acotadas: el enlace y sellado del génesis, el congelamiento de la ruta de BuybackBurn posterior al pool, el congelamiento de precios de MarketStabilitySeller posterior al pool, y la activación unidireccional de la división de recompra de FeeAccumulator tras la verificación previa.

El punto es simple: la vida digital no debería depender del permiso de una plataforma. Los mensajes, el nombre de usuario, el perfil y los fondos deberían pertenecer al usuario en la medida en que un sistema real pueda hacer que eso sea cierto.

Platho no intenta ser una jaula cómoda. Intenta ser una herramienta donde el control sobre las cosas digitales básicas regresa a la persona que la usa, no a quien controla el servidor, la base de datos o las reglas de acceso.
