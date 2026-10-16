# Reynoso Drop

## Salas con varios dispositivos · 1.9

Conecta tu PC personal, PC Ethernet, laptop corporativa, iPhone e iPad a **una
misma sala**. Admite hasta **8 dispositivos**, incluido quien la crea.

1. Crea la sala en un equipo que puedas mantener abierto.
2. En los otros dispositivos usa el mismo código de cuatro números o QR.
3. En **Enviar a**, elige un dispositivo o **Todos los dispositivos conectados**.
4. Envía texto, capturas o archivos. La lista indica quién está conectado.

Cada enlace se recupera por separado. Salir de un invitado no cierra la sala;
**Cerrar sala**, en el anfitrión, avisa a todos. El anfitrión coordina las entradas
y debe permanecer abierto. No hay elección automática de reemplazo. Una recarga
intenta recuperar el código, pero la bandeja sigue siendo temporal.

**Importante:** estar en la misma sala no garantiza una ruta de red entre cada
par. Ethernet y Wi-Fi corporativos pueden estar separados por políticas de red.
Esta primera fase usa WebRTC; aún no incluye un servidor relay WSS. Actualiza
Drop en todos los dispositivos/PWA para tener soporte de varios participantes.
Los clientes anteriores siguen limitados al enlace con el anfitrión.

## Continuidad de conexión

- Al volver de otra app, recuperar red o regresar desde la caché de navegación, Drop revisa el enlace sin pedir recargar ambas pantallas.
- Los equipos actualizados intercambian comprobaciones de actividad. Si el canal deja de responder, reconstruyen la conexión con el mismo código, con reintentos de enlace independientes y recuperación del servicio de salas con espera progresiva de hasta 15 segundos.
- La señalización se recupera sin cerrar un canal de datos que aún funciona. Una reconexión no genera otro código por una colisión transitoria.
- **Revisar conexión** permite solicitar la recuperación manual sin recargar. **Cerrar sala** sí detiene los reintentos y elimina la sesión guardada.
- Los archivos todavía no confirmados permanecen en la cola. Una transferencia interrumpida debe reenviarse desde el inicio; no se afirma reanudación por bytes ni se reenvía automáticamente. El reintento de un envío conserva qué destinatarios ya confirmaron la entrega. Las confirmaciones se separan por dispositivo y se descartan repeticiones durante diez minutos (hasta 512 identificadores).
- **Volver a Toolchain** muestra el catálogo en la misma pestaña conservando el documento de Drop y su bandeja en memoria. La barra superior muestra la sala y permite volver. Abrir Drop desde ese catálogo reutiliza la sesión existente. El enlace conserva su destino normal al usar Ctrl/Cmd o abrir otra pestaña.

**Límites reales:** cada sala admite ocho dispositivos. Los envíos a todos recorren secuencialmente los conectados al pulsar Enviar; no se envía el historial a quien entra después. iOS puede suspender o cerrar una página al bloquear el equipo o usar otra app: ningún código web puede garantizar una conexión permanente en ese estado. Al regresar, Drop intenta recuperarla. Cambiar manualmente la dirección de la pestaña, cerrarla o recargarla destruye su documento; los archivos recibidos no se guardan tras esa destrucción. El catálogo necesita red o su propia caché. Las restricciones corporativas de WebRTC no se eluden.

[Abrir Drop](https://reynosoch.github.io/drop/) · [Centro de herramientas](https://reynosoch.github.io/) · [Repositorio principal](https://github.com/reynosoch/reynosoch.github.io)

Drop forma parte de **Reynoso Toolchain**. Su pestaña se titula **Drop · Reynoso Toolchain** y el header tiene un enlace **Volver a Toolchain** que vuelve a la portada. v1.7.2 conserva el motor y agrega este header Liquid Glass; su CSS se copia desde `shared/toolchain-nav.css` a `drop/toolchain-nav.css` mediante `npm run generate` en la raíz y se incluye en la caché PWA para funcionar offline. El worker sigue limitado a `/drop/` y conserva sesiones, QR y protocolo.

Pasa texto, código, capturas y archivos entre hasta ocho dispositivos mediante WebRTC. Funciona como sitio estático en **GitHub Pages**, sin Supabase, sin cuentas y sin base de datos remota. La versión 1.7 hace la conexión desplegable (se minimiza sola al conectar), añade un **escáner de QR con la cámara**, unifica el envío de texto/fotos/archivos en una sola sección y muestra qué dispositivo envió cada elemento y a qué hora.

## Uso rápido

1. Abre la app en los dispositivos que quieras unir.
2. En uno pulsa **Crear sala**. Se genera un código de 4 números y un QR.
3. En los otros escribe los 4 números o pulsa **Abrir escáner** para leer el QR con la cámara. La conexión se intenta automáticamente, sin autorización adicional del anfitrión.
4. Elige el destinatario en **Enviar a** y escribe o pega texto. **Enter envía inmediatamente**. **Shift+Enter** inserta una nueva línea. El botón Enviar sigue disponible.
5. Para archivos usa **Archivos**, **Fotos**, arrastra y suelta sobre el cuadro de texto o pega. Texto y archivos salen juntos con un único botón **Enviar**.
6. Los textos muy grandes se preparan como `.txt`; los archivos se transfieren por bloques y se validan con SHA-256.

## iPad / PWA

En Safari abre la app y usa **Compartir → Agregar a pantalla de inicio**. La PWA usa `manifest.webmanifest`, iconos propios y un service worker que guarda en caché la interfaz estática. Puede abrir el cascarón de la app sin red, pero para conectar dispositivos sigue siendo necesaria una red que permita PeerJS/WebRTC.

## Sesión persistente local

La app guarda en `localStorage` únicamente información pequeña de sesión: rol (host/invitado), código de sala, nombre del dispositivo, preferencia de recepción automática y un borrador de texto razonable. No existe una base de datos de servidor.

- Si haces **F5**, Safari mata la pestaña o pierdes internet, la app intenta levantar la misma sala y reconectar cuando vuelve a ser posible.
- El anfitrión intenta reutilizar el mismo código de 4 dígitos. Durante la recuperación, si ese identificador todavía está ocupado, espera y vuelve a intentar con el mismo código. Una sala nueva creada manualmente sí puede elegir otro código ante una colisión.
- El reintento local ocurre cada pocos segundos cuando la interfaz está ociosa y hay red.
- **Cerrar sala** borra intencionalmente la sesión guardada en ese navegador.
- El nombre del dispositivo y la preferencia de recepción automática también se conservan localmente.

La bandeja de archivos recibidos y los blobs **siguen siendo temporales en memoria**: no se guardan tras recargar para evitar convertir el navegador en almacenamiento de documentos. Descarga lo que quieras conservar.

## Privacidad y red

- GitHub Pages publica únicamente el código de la app.
- Los archivos y textos transferidos no se escriben en GitHub, Supabase ni otra base de datos.
- PeerJS Cloud se usa para señalización. El contenido viaja por WebRTC cifrado, directo cuando es posible. TURN solo se utiliza si se configura un servicio propio válido; no hay TURN público de respaldo ni relay WSS habilitado por defecto.
- El código/QR permite entrar directamente a la sala. Compártelo solo con los dispositivos autorizados; no autentica personas. Los clientes actualizados crean enlaces entre miembros y el contenido va únicamente a los destinatarios elegidos.
- La app no descubre equipos arbitrarios de la LAN, no escanea rangos IP y no puede saltarse restricciones de una VPN o red corporativa.
- Si WebRTC, WebSocket, STUN o TURN están bloqueados, la app puede abrir pero no completar la conexión.

## Límites de transferencia

- Archivo individual: **50 MB**.
- Selección/bandeja en memoria: **100 MB**.
- Texto directo: **512 KB**; texto muy largo se prepara como `.txt`.
- Hasta 30 elementos en la bandeja.
- Bloques de 64 KB con confirmación e integridad SHA-256.

## Desarrollo

HTML, CSS y JavaScript nativos. PeerJS 1.5.5, qrcode-generator 1.4.4 y jsQR 1.4.0 (Apache-2.0, lector de QR de respaldo) están fijados dentro de `vendor/`.

```sh
npm run check
npm run build
```

`check` valida sintaxis y la suite de pruebas existente. `build` genera `dist/` e incluye la PWA (`session.js`, `service-worker.js`, manifiesto e iconos).

## Despliegue

Drop vive en `drop/` de **`reynosoch/reynosoch.github.io`**. GitHub Pages publica directamente **main / (root)** del repositorio principal. Las rutas, QR, iconos, manifiesto y service worker usan esta carpeta; la PWA tiene scope `/drop/`. `.nojekyll` permanece en la raíz y en la salida de build de Drop. El workflow **Verify main** del repositorio principal ejecuta checks y build de ambas herramientas en cada push.

La migración v1.7.1 conserva el prefijo de PeerJS y las claves de sesión para mantener compatibilidad con salas de la versión anterior. Los nuevos QR y enlaces apuntan a `/drop/`. El service worker solo almacena e intercepta recursos bajo su propio scope y solo limpia versiones anteriores de su propia caché; las cachés de otros programas, incluidos los modelos de Transcribe, permanecen intactas.

Origen: `reynosoch/reynoso-drop`, commit `d74c31e`. Ese repositorio se conserva como respaldo; los siguientes cambios se hacen aquí. No se migran archivos ni contenido de la bandeja porque eran temporales en memoria.

## AGENT_CONTEXT

Herramienta del repositorio central `reynosoch/reynosoch.github.io`, carpeta `drop/`, independiente del reconciliador Visteon. Leer también el README de la raíz. Cambios directos en `main`, sin PR cuando el usuario lo pida así. Mantener transferencia dispositivo-a-dispositivo, sin Supabase ni almacenamiento remoto de contenido. No eliminar carga de archivos, QR, recepción automática/manual, SHA-256, límites de memoria ni compatibilidad con iPad. No eliminar cachés de otras herramientas.

v1.6 cambia deliberadamente una decisión anterior: la **sesión sí se conserva localmente** para sobrevivir F5/cortes, mientras que la bandeja y los archivos recibidos continúan solo en memoria. `localStorage` se usa para metadatos pequeños y preferencias; no se usa una base de datos remota. Enter envía texto y Shift+Enter crea salto de línea. La PWA es instalable en iPad y cachea únicamente recursos estáticos de la app.

La cabecera permanece visible al desplazarse y ofrece **Volver a Toolchain** en la misma pestaña, sin depender del selector ni de la conexión de la sala. Hay otro acceso en el pie de página.


## Connection strategy y arquitectura

`app.js` conserva la UI y el protocolo de transferencia. `transport-manager.js`
administra la sala, lista de miembros y recuperación por enlace;
`webrtc-transport.js` encapsula PeerJS/DataChannel. La configuración está reunida
en `transport-config.js`; se retiraron los TURN antiguos. Señalización HTTPS/WSS
por 443, timeout de ocho segundos y canal de doce segundos. WebRTC ya aprovecha
rutas locales permitidas; no se escanean IPs.

El orden objetivo es **Direct → TURN configurado → relay WSS configurado →
Failure**. Esta fase implementa el transporte WebRTC y deja el relay WSS para
la siguiente fase; `relayUrl` es un campo reservado, no una capacidad activa.
Consulta [la auditoría, diagramas, interfaz, riesgos y migración](ARCHITECTURE.md).

## Diagnostics

Abre **Conecta tus dispositivos → Diagnóstico de conexión**. Muestra red,
señalización, estado de enlaces, tipos de candidatos observados e intentos
acotados. No incluye direcciones IP, credenciales, archivos, texto ni hashes.
La interfaz principal no pide escoger tecnología de conexión.

## Deployment modes

- **Personal:** GitHub Pages, mismo código, `relayUrl: null`, STUN por defecto.
- **Office:** mismo código con señalización/ICE configurados y autorizados por
  TI. Los TURN necesitan credenciales acotadas; no publicar secretos permanentes
  en JavaScript. Un futuro relay WSS requiere un servicio separado y habilitar su
  destino exacto en CSP; añadir una URL ahora no lo crea.

El servidor futuro será temporal, sin DB ni historial, con RAM, TTL y límites;
no se ha desplegado ninguno en esta entrega. Windows/IIS con WebSocket o un
proxy HTTPS son opciones a evaluar con TI, sin asumir infraestructura.

## Validación y matriz manual

Desde la raíz: `npm run check`, `npm run build`, `node tests/drop-browser.mjs`.
La prueba de navegador cubre cinco contextos, envío privado y a todos, archivo
binario con SHA-256 y descarga, salida, regreso, F5, pantallas móvil/tablet y
handshake con host anterior. Si la política administrada del navegador bloquea
WebRTC, `DROP_TEST_TRANSPORT=memory node tests/drop-browser.mjs` usa el adaptador
de prueba explícito: valida UI/protocolo, **no conectividad WebRTC real**.

Queda la matriz manual en redes reales: personal Wi-Fi↔Wi-Fi, corporativa
Wi-Fi↔Wi-Fi, Ethernet↔Wi-Fi corporativos, iPhone↔PC, iPad↔laptop, redes distintas,
sin red/regreso y suspensión. No sustituir estas comprobaciones por los tests
cloud. Ver [matriz y alcance](ARCHITECTURE.md#plan-de-pruebas).
