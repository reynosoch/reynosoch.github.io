# Drop Relay · desplegar Drop con conexión alternativa

Servidor Node 22 + `ws`, sin base de datos ni almacenamiento permanente. Sirve
**la misma app Drop** en `/drop/` y el relay en `/relay`. Los dispositivos prueban
WebRTC primero y usan WSS cuando hace falta. El registro de presencia funciona
independientemente de PeerJS. Salud: `/healthz`.

## Opción para quien no tiene servidor: Render

1. En tu cuenta de Render, selecciona **New → Blueprint** y conecta el repositorio
   `reynosoch/reynosoch.github.io`, rama `main`.
2. Render lee `render.yaml`: servicio Docker `reynoso-drop`, puerto 8080 y health
   check `/healthz`. La plantilla solicita el plan gratuito; revisa las condiciones
   vigentes del proveedor antes de crear el servicio.
3. Cuando indique que el despliegue está activo, abre **la URL HTTPS asignada por
   Render seguida de `/drop/`**. No uses una URL de ejemplo ni inventes el dominio.
4. Crea una sala allí y usa su enlace/QR para abrir **esa misma dirección** en PC,
   laptop, iPad y celular. No mezcles los cuatro números con la instalación Pages,
   que permanece sin relay configurado.
5. Prueba un PDF pequeño de ida y vuelta entre dos redes. Luego prueba Ethernet
   corporativo, Wi-Fi corporativo y universidad/celular. Si alguna red bloquea
   WSS al dominio, solicita a TI acceso autorizado o usa una red permitida.

El plan gratuito puede suspenderse cuando no se usa y tardar en arrancar; la
página inicial puede esperar mientras despierta. Para disponibilidad continua,
revisa un plan o servidor que permanezca activo. No se ha creado una cuenta ni
un servicio del proveedor desde este repositorio. Hacer push no equivale a
publicar el relay; necesitas completar estos pasos en tu cuenta.

Una vez desplegado, también se puede añadir su URL real a
`drop/deployment-config.js` y su origen WSS exacto a `connect-src` en
`drop/index.html` para que GitHub Pages use el mismo relay. Haz ese cambio solo
con una dirección existente y validada; nunca añadas `*` ni rebajes CSP.

## Uso local

Desde la raíz del repositorio:

```sh
npm --prefix drop-relay ci
npm --prefix drop-relay start
```

El servidor escucha solo en loopback, puerto 8787, de forma predeterminada.
Abre su ruta `/drop/` para desarrollo; HTTP/WS se admite únicamente en loopback.
El código desplegado en un hostname real necesita HTTPS/WSS.

Pruebas desde la raíz:

```sh
npm ci
npm --prefix drop-relay test
npm run check:drop:relay
```

La prueba de navegador usa WebSocket real, incluido un cambio de ruta durante un
PDF. El enlace WebRTC inicial de esa prueba está simulado explícitamente.

## Docker / VPS

Construye desde la raíz, porque la imagen comparte el codec y los recursos de
Drop. No necesita instalar dependencias de Audio Lab, Cutout u otras apps.

```sh
docker build -f drop-relay/Dockerfile -t reynoso-drop-relay .
docker run --rm --name reynoso-drop --read-only --cap-drop=ALL \
  --security-opt=no-new-privileges -p 127.0.0.1:8080:8080 reynoso-drop-relay
```

La imagen usa un usuario sin privilegios, no declara volúmenes y no escribe
archivos. Para Internet coloca un proxy con certificado válido delante, publica
HTTPS/WSS por 443, conserva el encabezado Host y permite WebSocket en `/relay`.
No expongas el puerto HTTP de Node a Internet como sustituto de TLS. No desactives
verificación de certificados en navegadores, proxy o instalación.

Variables de proceso:

| Nombre | Predeterminado | Uso |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Docker/Render usan `0.0.0.0` dentro de su red |
| `PORT` | `8787` | Docker/Render usan `8080` |
| `DROP_ALLOWED_ORIGINS` | `https://reynosoch.github.io` | Orígenes adicionales exactos, separados por comas |

El propio origen web del servicio se admite automáticamente; no hay wildcard.
Las cuotas usan la IP TCP real, no confían en X-Forwarded-For arbitrario. Añade
rate limiting del usuario real en el proxy; detrás de él las cuotas de Node
pueden compartirse entre varios usuarios. Configura límites de conexiones,
HTTPS, actualización de Node y librerías, y disponibilidad del proceso.

Windows/IIS puede actuar como proxy con soporte WebSocket y certificado
corporativo hacia Node en loopback. Un dominio únicamente interno requiere
acceso autorizado desde cada red; no resolverá por sí solo la universidad o
los datos móviles. No se instala VPN ni se escanean equipos.

## Privacidad y operación

- Sin cuentas de usuario, DB, historial, analytics ni logs de archivos/texto.
- El servidor reenvía bytes y mantiene solo metadatos acotados en RAM; no permite
  descargar documentos de una sesión previa. El operador puede ver datos en
  tránsito: HTTPS/WSS **no es E2EE de aplicación**.
- Las salas vencen a los diez minutos sin actividad real. Los archivos no quedan
  esperando a un dispositivo desconectado. Ambos extremos deben estar abiertos.
- Los metadatos de un envío se eliminan al ACK final, rechazo, desconexión o TTL
  de dos minutos. Reconexión breve reserva el puesto ocho segundos, sin bloques.
- 50 MB por archivo; ocho participantes. El proxy y proveedor pueden añadir
  límites. El diagnóstico de la app no incluye IP, credenciales, texto ni hashes.
- Reiniciar o escalar horizontalmente el proceso pierde/divide las salas, porque
  no hay DB compartida. Usa **una instancia** para esta implementación. No actives
  varias réplicas ni balanceo entre procesos independientes.
- La suspensión de Safari/Chrome en iOS puede interrumpir conexiones. Al volver
  se intenta recuperar; no existe garantía de ejecución en segundo plano.

Ver [arquitectura, límites y matriz de validación](../drop/ARCHITECTURE.md).
