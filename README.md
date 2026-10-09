# Reynoso Toolchain

**[Abrir Reynoso Toolchain](https://reynosoch.github.io/)**

Herramientas pequeñas para quitar pasos grandes. Una colección personal para desarrollo, universidad, Visteon y uso diario, con este flujo:

**Abrir → hacer una tarea → copiar, descargar o enviar → continuar trabajando.**

La portada es un acceso de trabajo, con estilo Liquid Glass sobrio, texto de alto contraste y búsqueda por tarea. No es un portfolio. **Drop, Transcribe, Audio Lab y Snippets están LISTO**; las otras **18 herramientas están EN DESARROLLO** y presentan un alcance futuro, sin simular acciones ni cargar librerías de procesamiento.

## Accesos directos para favoritos

La raíz es `https://reynosoch.github.io/`. Cada herramienta tiene una carpeta con `index.html` y una URL estable; no depende de query strings ni de routing SPA. El título de cada pestaña es **`<Herramienta> · Reynoso Toolchain`**. Drop, Transcribe, Audio Lab y Snippets, todos los placeholders, sus headers y sus accesos de regreso llevan al landing.

<!-- TOOLCHAIN_CATALOG_START -->
| Herramienta | Estado | URL | Propósito |
| --- | --- | --- | --- |
| Drop | LISTO | [Abrir Drop](https://reynosoch.github.io/drop/) | Texto y archivos, de una pantalla a otra. |
| Transcribe | LISTO | [Abrir Transcribe](https://reynosoch.github.io/transcribe/) | De audio o captura a texto editable. |
| Inspect | EN DESARROLLO | [Abrir Inspect](https://reynosoch.github.io/inspect/) | Conoce tus archivos antes de usarlos. |
| Diff | EN DESARROLLO | [Abrir Diff](https://reynosoch.github.io/diff/) | Qué cambió entre el archivo A y el B. |
| Clean | EN DESARROLLO | [Abrir Clean](https://reynosoch.github.io/clean/) | Menos ruido en tus Excel y CSV. |
| SQL Lab | EN DESARROLLO | [Abrir SQL Lab](https://reynosoch.github.io/sql/) | Pregúntale a tus archivos con SQL. |
| Context | EN DESARROLLO | [Abrir Context](https://reynosoch.github.io/context/) | Todo el proyecto, listo para otra IA. |
| Prompt | EN DESARROLLO | [Abrir Prompt](https://reynosoch.github.io/prompt/) | Un objetivo claro. Un prompt completo. |
| JSON Lab | EN DESARROLLO | [Abrir JSON Lab](https://reynosoch.github.io/json/) | Valida, ordena y transforma JSON. |
| API Lab | EN DESARROLLO | [Abrir API Lab](https://reynosoch.github.io/api/) | Una petición rápida, sin abrir Postman. |
| Regex | EN DESARROLLO | [Abrir Regex](https://reynosoch.github.io/regex/) | Comprueba el patrón antes de usarlo. |
| Code Lab | EN DESARROLLO | [Abrir Code Lab](https://reynosoch.github.io/code/) | Código listo para copiar o compartir. |
| Image Lab | EN DESARROLLO | [Abrir Image Lab](https://reynosoch.github.io/image/) | Ajusta una imagen y sigue trabajando. |
| Audio Lab | LISTO | [Abrir Audio Lab](https://reynosoch.github.io/audio/) | Limpia una grabación y déjala lista para Transcribe. |
| PDF Lab | EN DESARROLLO | [Abrir PDF Lab](https://reynosoch.github.io/pdf/) | Las páginas que necesitas, en orden. |
| Shot | EN DESARROLLO | [Abrir Shot](https://reynosoch.github.io/shot/) | Una captura que explica el problema. |
| Encode | EN DESARROLLO | [Abrir Encode](https://reynosoch.github.io/encode/) | Codifica, decodifica y verifica. |
| QR | EN DESARROLLO | [Abrir QR](https://reynosoch.github.io/qr/) | De un enlace a un QR. Y de regreso. |
| Convert | EN DESARROLLO | [Abrir Convert](https://reynosoch.github.io/convert/) | Cambia el formato, conserva la idea. |
| Error Vault | EN DESARROLLO | [Abrir Error Vault](https://reynosoch.github.io/errors/) | No resuelvas el mismo error dos veces. |
| Snippets | LISTO | [Abrir Snippets](https://reynosoch.github.io/snippets/) | Comandos útiles, explicados y listos para copiar. |
| Projects | EN DESARROLLO | [Abrir Projects](https://reynosoch.github.io/projects/) | Tus proyectos y accesos, en un lugar. |
<!-- TOOLCHAIN_CATALOG_END -->

### Uso diario

Arriba aparecen **Drop, Transcribe, Inspect, Diff y Context**. En estos cinco accesos, Drop y Transcribe están disponibles. Snippets está listo en Personal y Audio Lab en Archivos. Las tres futuras llevan a sus páginas de alcance y ejemplos. Cada herramienta se presenta **una vez**, sin duplicar tarjetas en otra categoría.

### Categorías

| Categoría | Herramientas |
| --- | --- |
| Uso diario | Drop, Transcribe; accesos destacados a Inspect, Diff y Context |
| Datos | Inspect, Diff, Clean, SQL Lab |
| Desarrollo | Context, Prompt, JSON Lab, API Lab, Regex, Code Lab |
| Archivos | Image Lab, Audio Lab, PDF Lab, Shot |
| Utilidades | Encode, QR, Convert |
| Personal | Error Vault, Snippets, Projects |

Inspect, Diff y Context se muestran en Uso diario; las secciones Datos y Desarrollo indican dónde están sin crear otra tarjeta. La búsqueda y los filtros de estado incluyen las 22 herramientas.

## Herramientas listas

- **[Snippets](https://reynosoch.github.io/snippets/)**: biblioteca local de 56 comandos y recetas, búsqueda por tarea, detalle, favoritos, recientes, CRUD, import/export JSON y copia protegida de destructivos. [Documentación de Snippets](snippets/README.md).

- **[Drop](https://reynosoch.github.io/drop/)**: transferencia entre dispositivos de texto, código, capturas, fotos, Excel y documentos. Conserva salas de cuatro números, QR/escáner de cámara, WebRTC/PeerJS, Ctrl+V, bloques grandes como TXT, SHA-256, límites, PWA y sesión local. [Documentación de Drop](drop/README.md).
- **[Transcribe](https://reynosoch.github.io/transcribe/)**: voz de audio/micrófono e imágenes/capturas a texto con Whisper y Tesseract. Conserva mejora para voz baja, selección de canal, procesamiento local, edición, TXT y SRT. [Documentación de Transcribe](transcribe/README.md).

- **[Audio Lab](https://reynosoch.github.io/audio/)**: limpieza local de juntas largas: Silero VAD, RNNoise, canal, nivelado, pausas con contexto, waveform/A-B, WAV y mapa de tiempos. Envío directo a Transcribe con autorización. [Documentación de Audio Lab](audio/README.md).

Drop se migró desde `reynosoch/reynoso-drop` (`d74c31e`). El repositorio antiguo es respaldo; el código vigente se desarrolla aquí. La versión **1.7.2** actualiza título, navegación de regreso y caché PWA, manteniendo protocolo, sesiones y motores. Transcribe conserva OCR y controles de audio y ahora incorpora lectura por ventanas, texto parcial, pausa/reanudación, modelos según duración y recuperación local con permiso. [Audio largo · v2.0.1](transcribe/README.md). Los lectores de audio, MP3 y hash se alojan en Pages para que un bloqueo de jsDelivr no impida abrir el archivo; los motores y modelos conservan sus descargas externas autorizadas.

## Estructura y generación

```text
index.html, hub.css, hub.mjs    Landing, diseño y filtros ligeros
favicon.svg                    Identidad Reynoso
shared/catalog.mjs             Nombres, rutas, estados, briefs y relaciones
shared/icons.mjs               Iconos SVG ligeros
shared/search.mjs              Búsqueda de texto sin dependencias
shared/toolchain-nav.css        Header compartido de apps
drop/, transcribe/, audio/, snippets/  Apps funcionales, pruebas y documentación
inspect/, diff/, clean/, sql/   Datos
context/, prompt/, json/        Desarrollo
api/, regex/, code/            Desarrollo
image/, pdf/, shot/            Archivos futuros
encode/, qr/, convert/          Utilidades
errors/, projects/             Personal (futuras)
scripts/                       Generación, rutas, validación y build
tests/                         Contratos del catálogo y filtros
.github/workflows/             Verify main
```

Los placeholders son HTML estático con descripción, alcance, ejemplos, estado, enlaces relacionados y botón para volver. Comparten `hub.css`; no tienen workers, dependencias, bases de datos ni controles de procesamiento falsos. Cada carpeta también tiene su README.

`shared/catalog.mjs` es la fuente de datos para nombres, estados y planes. `npm run generate` genera la portada, las 18 páginas/README de futuro y la tabla anterior. Los templates viven en `scripts/generate-toolchain.mjs`; editar allí la estructura de páginas generadas. **El generador nunca modifica los motores ni el HTML de las herramientas listas.** Solo copia el CSS de header a `drop/toolchain-nav.css` para mantenerlo disponible offline dentro del scope PWA.

## Agregar o implementar una herramienta

1. Registrar nombre, `id` (carpeta), categoría, resumen, propósito, features, ejemplos y relaciones en `shared/catalog.mjs`.
2. Mientras sea placeholder, dejar `ready` falso/ausente y ejecutar `npm run generate`; se crean ruta, README y entrada en portada y tabla.
3. Al implementar, marcar `ready: true` y crear la app en su carpeta. Ajustar el build para empaquetarla como se hace con Drop, Transcribe, Audio Lab y Snippets. Mantener el título, favicon, retorno al Toolchain y URL.
4. Cargar librerías solo desde la app correspondiente; nada de futuros modelos, DuckDB, editores o conversiones en el landing.
5. Documentar uso, límites, tratamiento de datos y validación. Ejecutar check/build, push a main y verificar CI/Pages.

## Navegación y conexiones futuras

El catálogo declara herramientas relacionadas por `id`, sin dependencias entre sus motores. **Audio Lab → Transcribe entrega WAV y mapa por postMessage local autorizado, origen/source exactos y nonce.** Los demás enlaces solo navegan. Esta base permite agregar luego los flujos Inspect → Clean → Diff → Drop, Audio → Transcribe → Drop y Shot → Transcribe → Context sin cambiar URLs.

Cada intercambio debe definirse como contrato explícito de payload/versionado, con consentimiento de selección del usuario, límites de memoria y almacenamiento separado por herramienta. No introducir un service worker global ni persistir archivos personales de forma implícita.

## Service workers y privacidad

- No hay service worker global. Los workers de caché actuales pertenecen a Drop (**scope `/drop/`**) y Snippets (**scope `/snippets/`**), cada uno con su propio prefijo y recursos.
- Drop intercepta solo su scope y elimina únicamente cachés antiguas de su propio prefijo/scope. Transcribe y sus modelos no se tocan.
- El header offline de Drop vive en `drop/toolchain-nav.css`, generado desde `shared/toolchain-nav.css`. Sus iconos, manifest y librerías siguen dentro de Drop. Transcribe enlaza el header común sin registrar un worker de caché.
- Conservar claves de sesión y prefijo PeerJS de Drop para que la navegación no rompa las salas.
- Transcribe puede guardar una recuperación de texto generado/avance en su propio IndexedDB solo con autorización; no almacena audio y ofrece borrar la recuperación.
- Snippets guarda comandos personalizados, favoritos y uso en IndexedDB propio (`reynoso-snippets`); exportación JSON manual para moverlos entre equipos. Su worker solo cachea su shell local.
- Audio Lab guarda análisis/ajustes/hash optativos en su IndexedDB separado. El WAV preparado usa un temporal OPFS autorizado o Blob acotado; se limpia al retirar/cancelar/cerrar y tras recargar la misma pestaña. Un cierre abrupto puede dejar temporales propios que se limpian a las 24 horas. No archiva la fuente ni registra service worker.
- No se suben archivos transferidos, transcritos ni datasets a GitHub. Las futuras herramientas no procesan ni guardan datos todavía.
- Los motores actuales mantienen sus condiciones de red/códecs y límites documentados; “LISTO” indica disponibilidad de la app, no compatibilidad garantizada con cualquier archivo o red corporativa.

## Diseño, rendimiento y dispositivos

UI HTML/CSS/JS nativos, sin frameworks. Audio Lab tiene motores locales vendorizados/fijados y carga autorizada por herramienta (Silero/ONNX/RNNoise). Las dependencias de desarrollo fake-indexeddb y Playwright solo validan persistencia e interfaz de Snippets. Glass con fondo denso, reflejo/borde sutil, blur real y fallback opaco; fondos sin animación y transiciones de 150–160 ms. Layouts para laptop, desktop, iPad horizontal/vertical y móvil con targets táctiles, navegación sin hover obligatorio, `prefers-reduced-motion` y `prefers-reduced-transparency`.

Validación: suites funcionales de Drop/Transcribe/Toolchain, pruebas adicionales de Snippets sobre búsqueda, tecnología, IndexedDB, favoritos, contadores concurrentes, import/export atómico, seguridad, recetas y aislamiento del worker; títulos/enlaces de las 23 páginas. `npm run check:browser` verifica las interacciones de Snippets y layouts desktop/iPad/móvil en Chromium. Audio Lab se verifica además con motores reales en Chromium, voz y archivos sintéticos de 30 s, 6 min y 60 min; detalles en su README. No sustituye iPad físico, Safari, redes WebRTC ni la junta corporativa real.

## Check, build y GitHub Pages

```sh
npm ci
npm run generate
npm run check
npm run build
```

`npm ci` instala solo las dependencias de pruebas. La app publicada no carga paquetes npm. `check` conserva suites de Drop y Transcribe y agrega validación de catálogo/búsqueda, todas las rutas y títulos, enlaces de regreso, recursos de cada página y shell/manifest PWA. También comprueba que la generación está sincronizada con lo que se publica. `build` produce `dist/` con el landing, estilos compartidos, las cuatro apps y las 18 rutas futuras; `dist/` no se sube.

GitHub Pages continúa publicando **`main / (root)`** con `.nojekyll`. **Verify main** ejecuta `npm ci`, `npm run check`, `npm run build` y las suites de navegador de Snippets y Audio Lab con motores reales en cada push. El despliegue Pages existente publica `main`. El contenido generado se versiona para que las rutas también funcionen al publicarse desde la raíz.

Los archivos antiguos de SmartFit/.NET ya se retiraron en la migración anterior y siguen recuperables en el historial.

## AGENT_CONTEXT

- Este repositorio es **Reynoso Toolchain**, centro de herramientas personales. Trabajar directamente en `main`, sin PR ni repositorios extra cuando el usuario lo indique. Leer este README completo y el README de la herramienta; revisar commits antes de editar.
- Drop, Transcribe, Audio Lab y Snippets están disponibles actualmente. Las 18 futuras son briefs/placeholder; no implementar sus motores sin una solicitud específica ni marcarlas LISTO antes de verificar su funcionalidad.
- Una carpeta/URL estable por herramienta, título de favoritos `<Nombre> · Reynoso Toolchain`, favicon y retorno claro al landing. No routing SPA ni URLs de herramienta basadas en queries.
- Mantener catálogo, generador, portada, READMEs y build sincronizados. Nuevas herramientas deben tener acceso directo Pages en la tabla.
- No borrar ni simplificar funciones, tests, PWA, sesión, QR, WebRTC, motores, dependencias o licencias de Drop/Transcribe para rediseñar el landing.
- Service workers aislados por herramienta y cachés por scope. Nunca registrar un worker global ni limpiar cachés de otros programas.
- Preparar interacciones futuras mediante contratos explícitos; Audio Lab → Transcribe usa un contrato local versionado; los demás enlaces son navegación.
- Mantener contraste alto con brillo bajo, targets táctiles, fallbacks de glass, motion reducido y carga de librerías por herramienta.
- Ejecutar generate/check/build, revisar Verify main y Pages, verificar rutas y documentar límites de QA al cerrar.
