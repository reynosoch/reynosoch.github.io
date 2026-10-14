# Reynoso Toolchain

**[Abrir Reynoso Toolchain](https://reynosoch.github.io/)**

Herramientas pequeñas para quitar pasos grandes. Una colección personal para desarrollo, universidad, Visteon y uso diario, con este flujo:

**Abrir → hacer una tarea → copiar, descargar o enviar → continuar trabajando.**

**[Brief](https://reynosoch.github.io/brief/)** organiza las notas de Shot, reuniones y proyectos en un encargo con objetivo, cambios, restricciones, evidencia y criterios de aceptación. Incluye cuatro plantillas editables, borradores locales, copia, Markdown y respaldo JSON. No ejecuta las instrucciones ni adjunta las imágenes; el texto se guarda sin cifrar en este navegador. [Documentación](brief/README.md).

## Toolchain y LAB

**Toolchain contiene herramientas adoptadas:** utilidades que ya forman parte del flujo cotidiano y deben mantenerse estables. **[Reynoso LAB](https://reynosoch.github.io/reynoso-lab/) contiene experimentos:** repositorios por descubrir, inspeccionar, probar, documentar y, quizá, promover.

Uso diario conserva naranja (`--accent`); las tarjetas de herramientas con nombre LAB reutilizan verde (`--lab`) mediante `data-family`, sin colores individuales inventados.

Ambos sitios comparten el mismo recorrido y se distinguen por intención: **LAB usa verde** para descubrir y experimentar; **Toolchain usa naranja** para lo adoptado, mantenido y listo para volver a usar.

```text
LAB → probar → aprender → descartar o adoptar → Toolchain / proyecto / fork
```

Los proyectos externos no se copian aquí. LAB conserva su registro y sus notas; Toolchain recibe únicamente una herramienta cuando ya demostró ser útil y merece mantenimiento propio.

La portada es un acceso de trabajo, con el mismo sistema Liquid Glass de LAB: superficies translúcidas, brillo interno, profundidad, radios y navegación compartidos. Toolchain conserva el acento naranja y usa iconos locales seleccionados de Lucide 1.55.0; su licencia vive en `shared/LUCIDE_LICENSE.txt`. No es un portfolio. **Brief, Drop, Transcribe, Audio Lab, Snippets, Shot, Convert, Cutout y Jot están LISTO**; las otras **16 herramientas están EN DESARROLLO** y presentan un alcance futuro, sin simular acciones ni cargar librerías de procesamiento.

## Accesos directos para favoritos

La raíz es `https://reynosoch.github.io/`. Cada herramienta tiene una carpeta con `index.html` y una URL estable; no depende de query strings ni de routing SPA. El título de cada pestaña es **`<Herramienta> · Reynoso Toolchain`**. Drop, Transcribe, Audio Lab, Snippets, Shot, Convert y Cutout, todos los placeholders, sus headers y sus accesos de regreso llevan al landing.

<!-- TOOLCHAIN_CATALOG_START -->
| Herramienta | Estado | URL | Propósito |
| --- | --- | --- | --- |
| Brief | LISTO | [Abrir Brief](https://reynosoch.github.io/brief/) | Objetivo, evidencia y condiciones en un encargo completo. |
| Drop | LISTO | [Abrir Drop](https://reynosoch.github.io/drop/) | Texto y archivos, de una pantalla a otra. |
| Transcribe | LISTO | [Abrir Transcribe](https://reynosoch.github.io/transcribe/) | De audio o captura a texto editable. |
| Inspect | EN DESARROLLO | [Abrir Inspect](https://reynosoch.github.io/inspect/) | Conoce tus archivos antes de usarlos. |
| Diff | EN DESARROLLO | [Abrir Diff](https://reynosoch.github.io/diff/) | Qué cambió entre el archivo A y el B. |
| Clean | EN DESARROLLO | [Abrir Clean](https://reynosoch.github.io/clean/) | Menos ruido en tus Excel y CSV. |
| SQL Lab | EN DESARROLLO | [Abrir SQL Lab](https://reynosoch.github.io/sql/) | Consulta archivos mediante SQL. |
| Context | EN DESARROLLO | [Abrir Context](https://reynosoch.github.io/context/) | Contexto del proyecto en un paquete. |
| Prompt | EN DESARROLLO | [Abrir Prompt](https://reynosoch.github.io/prompt/) | Un objetivo claro. Un prompt completo. |
| JSON Lab | EN DESARROLLO | [Abrir JSON Lab](https://reynosoch.github.io/json/) | Valida, ordena y transforma JSON. |
| API Lab | EN DESARROLLO | [Abrir API Lab](https://reynosoch.github.io/api/) | Una petición rápida, sin abrir Postman. |
| Regex | EN DESARROLLO | [Abrir Regex](https://reynosoch.github.io/regex/) | Comprueba el patrón antes de usarlo. |
| Code Lab | EN DESARROLLO | [Abrir Code Lab](https://reynosoch.github.io/code/) | Código listo para copiar o compartir. |
| Cutout | LISTO | [Abrir Cutout](https://reynosoch.github.io/cutout/) | Elimina fondos y genera un PNG transparente. |
| Image Lab | EN DESARROLLO | [Abrir Image Lab](https://reynosoch.github.io/image/) | Edita y prepara imágenes para distintos usos. |
| Audio Lab | LISTO | [Abrir Audio Lab](https://reynosoch.github.io/audio/) | Prepara grabaciones para su uso en Transcribe. |
| PDF Lab | EN DESARROLLO | [Abrir PDF Lab](https://reynosoch.github.io/pdf/) | Las páginas que necesitas, en orden. |
| Shot | LISTO | [Abrir Shot](https://reynosoch.github.io/shot/) | Anota capturas y genera instrucciones de revisión. |
| Encode | EN DESARROLLO | [Abrir Encode](https://reynosoch.github.io/encode/) | Codifica, decodifica y verifica. |
| QR | EN DESARROLLO | [Abrir QR](https://reynosoch.github.io/qr/) | De un enlace a un QR. Y de regreso. |
| Convert | LISTO | [Abrir Convert](https://reynosoch.github.io/convert/) | PDF, Word, Excel, imágenes y texto entre formatos. |
| Error Vault | EN DESARROLLO | [Abrir Error Vault](https://reynosoch.github.io/errors/) | Registra soluciones para reutilizarlas. |
| Snippets | LISTO | [Abrir Snippets](https://reynosoch.github.io/snippets/) | Comandos útiles, explicados y listos para copiar. |
| Projects | EN DESARROLLO | [Abrir Projects](https://reynosoch.github.io/projects/) | Proyectos, accesos y notas en un solo lugar. |
<!-- TOOLCHAIN_CATALOG_END -->

### Uso diario

Recientes aparece al usar herramientas y conserva el orden entre sesiones. Debajo, los accesos que aún no hayas usado mantienen su lugar. En el catálogo base aparecen **Drop, Transcribe, Inspect, Diff, Context y Shot**, con 3×2 en laptop/iPad, seis columnas solo en pantallas amplias y una columna en móvil pequeño. En estos seis accesos, Drop, Transcribe y Shot están disponibles. Snippets está listo en Personal y Audio Lab en Archivos. Las tres futuras llevan a sus páginas de alcance y ejemplos. Cada herramienta se presenta **una vez**, sin duplicar tarjetas en otra categoría.

### Categorías

| Categoría | Herramientas |
| --- | --- |
| Uso diario | Drop, Transcribe, Shot; accesos destacados a Inspect, Diff y Context |
| Datos | Inspect, Diff, Clean, SQL Lab |
| Desarrollo | Context, Prompt, JSON Lab, API Lab, Regex, Code Lab |
| Archivos | Cutout, Convert, Image Lab, Audio Lab, PDF Lab |
| Utilidades | Encode, QR |
| Personal | Error Vault, Snippets, Projects |

Inspect, Diff y Context se muestran en Uso diario; las secciones Datos y Desarrollo indican dónde están sin crear otra tarjeta. La búsqueda y los filtros de estado incluyen las 23 herramientas.

## Recientes reales

La portada mueve las tarjetas usadas a **Recientes**, por último uso (más reciente primero), sin duplicar accesos. Abrir una herramienta desde favorito, desde el catálogo o interactuar con ella registra uso; regresar a una pestaña también actualiza el orden. Se persiste únicamente `id` y fecha en localStorage (`reynoso-toolchain:recent:v1`), compartido por las herramientas del origen. El orden se actualiza entre pestañas, al volver y tras recargar; los filtros siguen funcionando. Si el almacenamiento está bloqueado, las herramientas siguen funcionando. No guarda archivos ni cambia el catálogo base.

## Herramientas listas

- **[Cutout](https://reynosoch.github.io/cutout/)**: recorte local de fondos con ISNet FP16, complemento para logos/letras, antes/después, bordes/halos/partículas, pincel de máscara, PNG/WebP, copia y lotes ZIP. Modelo bajo demanda, sin subir imágenes. [Documentación y límites](cutout/README.md).
- **[Convert](https://reynosoch.github.io/convert/)**: conversión de documentos, imágenes y texto y PDF Studio. [Documentación](convert/README.md).


- **[Shot](https://reynosoch.github.io/shot/)**: anota capturas para revisiones de desarrollo. Admite Ctrl+V, varias capturas, flechas, texto, marcadores con notas, historial, censura plana, recorte, borrador de anotaciones, zoom táctil y navegación con trackpad o Ctrl + arrastrar. También permite copiar PNG e instrucciones, generar una lámina con todas las imágenes, conservar la numeración entre capturas y exportar ZIP o comparativas. [Documentación de Shot](shot/README.md).

- **[Snippets](https://reynosoch.github.io/snippets/)**: biblioteca local de 56 comandos y recetas, búsqueda por tarea, detalle, favoritos, recientes, CRUD, import/export JSON y copia protegida de destructivos. [Documentación de Snippets](snippets/README.md).

- **[Drop](https://reynosoch.github.io/drop/)**: transferencia entre dispositivos de texto, código, capturas, fotos, Excel y documentos. Conserva salas de cuatro números, QR/escáner de cámara, WebRTC/PeerJS, Ctrl+V, bloques grandes como TXT, SHA-256, límites, PWA y sesión local. [Documentación de Drop](drop/README.md).
- **[Transcribe](https://reynosoch.github.io/transcribe/)**: voz de audio/micrófono e imágenes/capturas a texto con Whisper y Tesseract. Conserva mejora para voz baja, selección de canal, procesamiento local, edición, TXT y SRT. [Documentación de Transcribe](transcribe/README.md).

- **[Audio Lab](https://reynosoch.github.io/audio/)**: limpieza local de reuniones largas: Silero VAD, RNNoise, canal, nivelado, pausas con contexto, waveform/A-B, WAV y mapa de tiempos. División visual por duración con los mismos filtros en todas las partes; escucha y descarga individual, completa o selectiva en ZIP. Envío directo a Transcribe con autorización. [Documentación de Audio Lab](audio/README.md).

Drop se migró desde `reynosoch/reynoso-drop` (`d74c31e`). El repositorio antiguo es respaldo; el código vigente se desarrolla aquí. La versión **1.7.2** actualiza título, navegación de regreso y caché PWA, manteniendo protocolo, sesiones y motores. Transcribe conserva OCR y controles de audio y ahora incorpora lectura por ventanas, texto parcial, pausa/reanudación, modelos según duración y recuperación local con permiso. [Audio largo · v2.0.1](transcribe/README.md). Los lectores de audio, MP3 y hash se alojan en Pages para que un bloqueo de jsDelivr no impida abrir el archivo; los motores y modelos conservan sus descargas externas autorizadas.

## Estructura y generación

```text
index.html, hub.css, hub.mjs    Landing, diseño y filtros ligeros
favicon.svg                    Identidad Reynoso
shared/catalog.mjs             Nombres, rutas, estados, briefs y relaciones
shared/icons.mjs               Iconos SVG Lucide locales y glifos de herramientas
shared/search.mjs              Búsqueda de texto sin dependencias
shared/toolchain-nav.css        Header compartido de apps
drop/, transcribe/, audio/, snippets/, shot/, cutout/, convert/  Apps funcionales, pruebas y documentación
inspect/, diff/, clean/, sql/   Datos
context/, prompt/, json/        Desarrollo
api/, regex/, code/            Desarrollo
image/, pdf/                   Archivos futuros
encode/, qr/                    Utilidades futuras
errors/, projects/             Personal (futuras)
scripts/                       Generación, rutas, validación y build
tests/                         Contratos del catálogo y filtros
.github/workflows/             Verify main
```

Los placeholders son HTML estático con descripción, alcance, ejemplos, estado, enlaces relacionados y botón para volver. Comparten `hub.css`; no tienen workers, dependencias, bases de datos ni controles de procesamiento falsos. Cada carpeta también tiene su README.

`shared/catalog.mjs` es la fuente de datos para nombres, estados y planes. `npm run generate` genera la portada, las 16 páginas/README de futuro y la tabla anterior. Los templates viven en `scripts/generate-toolchain.mjs`; editar allí la estructura de páginas generadas. **El generador nunca modifica los motores ni el HTML de las herramientas listas.** Solo copia el CSS de header a `drop/toolchain-nav.css` para mantenerlo disponible offline dentro del scope PWA.

## Agregar o implementar una herramienta

1. Registrar nombre, `id` (carpeta), categoría, resumen, propósito, features, ejemplos y relaciones en `shared/catalog.mjs`.
2. Mientras sea placeholder, dejar `ready` falso/ausente y ejecutar `npm run generate`; se crean ruta, README y entrada en portada y tabla.
3. Al implementar, marcar `ready: true` y crear la app en su carpeta. Ajustar el build para empaquetarla como se hace con Drop, Transcribe, Audio Lab, Snippets, Shot, Convert y Cutout. Mantener el título, favicon, retorno al Toolchain y URL.
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
- Shot guarda una sesión reciente en IndexedDB propio (`reynoso-shot`), hasta 7 días desde el último cambio, 30 capturas y 128 MB de fuentes comprimidas. Imágenes y objetos se guardan separados; historial estructural de hasta 80 estados / 3 MB por captura. La carpeta recordada requiere permiso al reabrir/escanear; no se sondea automáticamente. Borrar sesión libera sus capturas; no toca otras herramientas.
- No se suben archivos transferidos, transcritos ni datasets a GitHub. Las futuras herramientas no procesan ni guardan datos todavía.
- Los motores actuales mantienen sus condiciones de red/códecs y límites documentados; “LISTO” indica disponibilidad de la app, no compatibilidad garantizada con cualquier archivo o red corporativa.

## Diseño, rendimiento y dispositivos

UI HTML/CSS/JS nativos, sin frameworks. Audio Lab tiene motores locales vendorizados/fijados y carga autorizada por herramienta (Silero/ONNX/RNNoise). fake-indexeddb y Playwright validan persistencia e interfaces; Shot usa el bundle local de Fabric para el editor y JSZip para paquetes. Glass con fondo denso, reflejo/borde sutil, blur real y fallback opaco; fondos sin animación y transiciones de 150–160 ms. Layouts para laptop, desktop, iPad horizontal/vertical y móvil con targets táctiles, navegación sin hover obligatorio, `prefers-reduced-motion` y `prefers-reduced-transparency`.

Validación: suites funcionales de Drop/Transcribe/Toolchain, pruebas adicionales de Snippets sobre búsqueda, tecnología, IndexedDB, favoritos, contadores concurrentes, import/export atómico, seguridad, recetas y aislamiento del worker; títulos/enlaces de las 23 páginas. `npm run check:browser` verifica las interacciones de Snippets y layouts desktop/iPad/móvil en Chromium. Audio Lab se verifica además con motores reales en Chromium, voz y archivos sintéticos de 30 s, 6 min y 60 min; detalles en su README. No sustituye iPad físico, Safari, redes WebRTC ni la junta corporativa real.

## Check, build y GitHub Pages

```sh
npm ci
npm run generate
npm run check
npm run build
```

`npm ci` instala las dependencias de pruebas y build. Shot distribuye bundles locales fijados de Fabric.js 7.4.0 (MIT, 286 KB) y JSZip 3.10.2 (MIT, 99 KB); no carga CDN en runtime. `npm run vendor:shot` los reconstruye con esbuild 0.28.2. `check` conserva suites de Drop y Transcribe y agrega validación de catálogo/búsqueda, todas las rutas y títulos, enlaces de regreso, recursos de cada página y shell/manifest PWA. También comprueba que la generación está sincronizada con lo que se publica. `build` produce `dist/` con el landing, estilos compartidos, las siete apps y las 16 rutas futuras; `dist/` no se sube.

GitHub Pages continúa publicando **`main / (root)`** con `.nojekyll`. **Verify main** ejecuta `npm ci`, `npm run check`, `npm run build` y las suites de navegador de Snippets, Audio Lab con motores reales y Shot en cada push. El despliegue Pages existente publica `main`. El contenido generado se versiona para que las rutas también funcionen al publicarse desde la raíz.

Los archivos antiguos de SmartFit/.NET ya se retiraron en la migración anterior y siguen recuperables en el historial.

CUTOUT usa IMG.LY 1.7.0 + ONNX Runtime Web 1.21.0, en bundle local verificado, y descarga ISNet FP16/recursos desde staticimgly.com al recortar. Su código y motor tienen AGPL-3.0; no altera la licencia de otras apps. Ver `cutout/README.md`.

## AGENT_CONTEXT

- Este repositorio es **Reynoso Toolchain**, centro de herramientas personales. Trabajar directamente en `main`, sin PR ni repositorios extra cuando el usuario lo indique. Leer este README completo y el README de la herramienta; revisar commits antes de editar.
- Drop, Transcribe, Audio Lab, Snippets, Shot, Convert y Cutout están disponibles actualmente. Las 16 futuras son briefs/placeholder; no implementar sus motores sin una solicitud específica ni marcarlas LISTO antes de verificar su funcionalidad.
- Una carpeta/URL estable por herramienta, título de favoritos `<Nombre> · Reynoso Toolchain`, favicon y retorno claro al landing. No routing SPA ni URLs de herramienta basadas en queries.
- Mantener catálogo, generador, portada, READMEs y build sincronizados. Nuevas herramientas deben tener acceso directo Pages en la tabla.
- No borrar ni simplificar funciones, tests, PWA, sesión, QR, WebRTC, motores, dependencias o licencias de Drop/Transcribe para rediseñar el landing.
- Service workers aislados por herramienta y cachés por scope. Nunca registrar un worker global ni limpiar cachés de otros programas.
- Preparar interacciones futuras mediante contratos explícitos; Audio Lab → Transcribe usa un contrato local versionado; los demás enlaces son navegación.
- Mantener contraste alto con brillo bajo, targets táctiles, fallbacks de glass, motion reducido y carga de librerías por herramienta.
- Ejecutar generate/check/build, revisar Verify main y Pages, verificar rutas y documentar límites de QA al cerrar.

## Arquitectura visual de los portales

El sistema compartido está en `shared/portal.css`: grafito, texto de alto contraste, acento naranja para herramientas y verde para páginas LAB. Usa fuentes del sistema sin descargas externas. Navegación y diálogos conservan glass moderado; los espacios de trabajo usan superficies sólidas.

La portada prioriza buscar y abrir herramientas; el recorrido LAB queda en un desplegable secundario. Drop es una estación de transferencia; Transcribe, un escritorio de lectura; Shot, un editor; Convert, una mesa de conversión; Cutout, una mesa de inspección; Audio Lab, un espacio de señal; Snippets, una biblioteca de comandos; Jot, un cuaderno privado. Las páginas previstas adaptan su composición según datos, desarrollo, archivos, utilidades o contenido personal. URLs, IDs, motores y persistencia se conservan.

Drop y Snippets incluyen copias locales generadas del CSS para seguir funcionando sin conexión, con versiones de caché separadas. `npm run generate` sincroniza estas copias. La interfaz, los atributos accesibles y los mensajes no deben mencionar IA ni agentes; las librerías y sus licencias siguen documentadas con exactitud.

La revisión utilizó UI/UX Pro Max de `nextlevelbuilder/ui-ux-pro-max-skill`, revisión `7246805992a42b7bba37d4cac83b01416f0c6c44`, para jerarquía, contraste, estados, targets y adaptación. Conserva los colores de marca en lugar de adoptar la paleta sugerida automáticamente.
