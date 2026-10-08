# Reynoso Drop

[Abrir Drop](https://reynosoch.github.io/drop/) · [Centro de herramientas](https://reynosoch.github.io/) · [Repositorio principal](https://github.com/reynosoch/reynosoch.github.io)

Pasa texto, código, capturas y archivos entre dos dispositivos mediante WebRTC. Funciona como sitio estático en **GitHub Pages**, sin Supabase, sin cuentas y sin base de datos remota. La versión 1.7 hace la conexión desplegable (se minimiza sola al conectar), añade un **escáner de QR con la cámara**, unifica el envío de texto/fotos/archivos en una sola sección y muestra qué dispositivo envió cada elemento y a qué hora.

## Uso rápido

1. Abre la app en ambos dispositivos.
2. En uno pulsa **Crear sala**. Se genera un código de 4 números y un QR.
3. En el otro escribe los 4 números o pulsa **Abrir escáner** para leer el QR con la cámara. La conexión se intenta automáticamente, sin autorización adicional del anfitrión.
4. Escribe o pega texto. **Enter envía inmediatamente**. **Shift+Enter** inserta una nueva línea. El botón Enviar sigue disponible.
5. Para archivos usa **Archivos**, **Fotos**, arrastra y suelta sobre el cuadro de texto o pega. Texto y archivos salen juntos con un único botón **Enviar**.
6. Los textos muy grandes se preparan como `.txt`; los archivos se transfieren por bloques y se validan con SHA-256.

## iPad / PWA

En Safari abre la app y usa **Compartir → Agregar a pantalla de inicio**. La PWA usa `manifest.webmanifest`, iconos propios y un service worker que guarda en caché la interfaz estática. Puede abrir el cascarón de la app sin red, pero para conectar dos dispositivos sigue siendo necesaria una red que permita PeerJS/WebRTC.

## Sesión persistente local

La app guarda en `localStorage` únicamente información pequeña de sesión: rol (host/invitado), código de sala, nombre del dispositivo, preferencia de recepción automática y un borrador de texto razonable. No existe una base de datos de servidor.

- Si haces **F5**, Safari mata la pestaña o pierdes internet, la app intenta levantar la misma sala y reconectar cuando vuelve a ser posible.
- El anfitrión intenta reutilizar el mismo código de 4 dígitos. Si ese identificador todavía está ocupado, el flujo normal de colisión puede generar uno nuevo.
- El reintento local ocurre cada pocos segundos cuando la interfaz está ociosa y hay red.
- **Cerrar sala** borra intencionalmente la sesión guardada en ese navegador.
- El nombre del dispositivo y la preferencia de recepción automática también se conservan localmente.

La bandeja de archivos recibidos y los blobs **siguen siendo temporales en memoria**: no se guardan tras recargar para evitar convertir el navegador en almacenamiento de documentos. Descarga lo que quieras conservar.

## Privacidad y red

- GitHub Pages publica únicamente el código de la app.
- Los archivos y textos transferidos no se escriben en GitHub, Supabase ni otra base de datos.
- PeerJS Cloud se usa para señalización. El contenido viaja por WebRTC cifrado, directo cuando es posible o mediante TURN cuando la red lo requiere.
- El código/QR permite conectar directamente a la segunda pantalla. Solo se admite una conexión remota a la vez.
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
