# Reynoso Transcribe

Forma parte de **Reynoso Toolchain**. La pestaña se titula **Transcribe · Reynoso Toolchain** y el header **← Toolchain** regresa siempre a [la portada](https://reynosoch.github.io/). El estilo del header usa `../shared/toolchain-nav.css` y solo da estilo a la navegación compartida. Esta versión 2.0.1 incorpora el flujo de audio largo descrito abajo.

Página estática publicada en **https://reynosoch.github.io/transcribe/**. Vive en `transcribe/` dentro del repositorio `reynosoch/reynosoch.github.io`, junto con Drop en `drop/`. La raíz ahora es el [centro de herramientas](https://reynosoch.github.io/). El despliegue de Pages ya configurado publica los cambios de `main`.

## Uso

1. Arrastra o selecciona audio / video o una imagen. También acepta archivos e imágenes pegados con Ctrl+V, grabación por micrófono y enlaces HTTPS directos que permitan CORS.
2. Selecciona idioma y modelo. Para una junta importante, usa **Español + Junta · mayor precisión** si tu equipo tiene memoria suficiente. CPU es la ruta compatible; GPU acelerada es opcional y experimental.
3. Pulsa Transcribir / Extraer texto y revisa la autorización antes de descargar motores o empezar. Para audio puedes autorizar recuperación local y mantener la pantalla activa.
4. El texto aparece por fragmentos. Pausar termina el actual; Detener interrumpe inmediatamente y conserva lo ya terminado. Continuar utiliza el mismo modelo/idioma/canal del proceso anterior. Usa Transcribir para empezar de nuevo con otros ajustes.
5. Revisa y edita el resultado, copia o descarga TXT. Audio permite marcas de tiempo reproducibles y SRT. Si editas el texto, se ocultan SRT y marcas de tiempo porque ya no representan la versión editada.

## Motores y privacidad

- Whisper multilingüe mediante **Transformers.js 3.8.1**, en un Web Worker. CPU WASM de un hilo usa `Xenova/whisper-tiny`, `base` y `small`, q8. GPU opcional usa `onnx-community/whisper-*` con encoder fp32 y decoder merged q4; requiere WebGPU compatible y descarga modelos distintos. No cambia a CPU silenciosamente si GPU falla: el usuario elige y autoriza otro proceso.
- **Mediabunny 1.61.3** lee la pista con `BlobSource` (caché de lectura 4 MiB) y `AudioSampleSink`. MP4/M4A/AAC, MP3, WAV, OGG, WebM/MOV y FLAC dependen del códec nativo de WebCodecs; PCM tiene lector propio. Si MP3 no es nativo, se pide autorización adicional para **mpg123-decoder 1.0.3** WASM.
- **Hash WASM 4.12.0** verifica SHA-256 del archivo completo en bloques de 2 MiB, sin cargarlo entero, para evitar reanudar con otra grabación.
- No hay API de pago ni claves. Descarga inicial aproximada de los modelos CPU: tiny ~45 MB, base ~80 MB, small ~250 MB; GPU: ~120 / ~210 / ~600 MB, más runtime y librerías. La memoria de ejecución es mayor. El navegador puede reutilizar caché; no se garantiza que conserve modelos entre sesiones.
- OCR mediante **Tesseract.js 6.0.1**. Idiomas español e inglés predeterminados; admite francés y portugués. Mejora opcional de escala, contraste e inversión para capturas oscuras; distribución automática, bloque o texto disperso.
- Archivos e inferencia permanecen en el navegador. Mediabunny, Hash WASM y el lector MP3 se cargan desde esta misma página. Transformers/ONNX y OCR aún solicitan dependencias a jsDelivr, modelos a Hugging Face y tipografías a Google Fonts; estas solicitudes requieren conexión, pero no suben archivos. El usuario puede cargar un archivo desde otro servidor con URL, lo que solicita ese archivo a dicho servidor.
- Sin recuperación de texto persistente por defecto. **Con autorización expresa** se guarda una única recuperación en IndexedDB `reynoso-transcribe`: texto generado, tokens, marcas, ajustes, hash, nombre y siguiente fragmento. Nunca guarda el audio. Se puede recuperar o borrar desde la página. Al recargar hay que seleccionar el mismo archivo; al continuar se compara el SHA-256 completo. La recuperación se actualiza al terminar cada ventana; si falla el guardado se informa y se recomienda descargar. Los cambios manuales requieren descargar tu versión y deshabilitan Continuar/SRT.
- La autorización aparece antes de cada inicio/reanudación y OCR. Si la duración real es desconocida o difiere del plan mostrado, se pide otra autorización antes de descargar el modelo. Lectores adicionales y lectura de compatibilidad requieren otra autorización. Mantener pantalla activa solicita Screen Wake Lock solo si se marcó esa opción; es opcional y puede ser revocado/no soportado por el navegador.

## Audio bajo

Se decodifica únicamente la ventana actual, conserva canales seleccionables y evita cancelar señales estéreo en contrafase. OfflineAudioContext remuestrea a 16 kHz con el remuestreador del navegador. El procesamiento opcional elimina graves bajo 65 Hz y aplica ganancia adaptativa suave, hasta +30 dB, con límite de amplitud. **No se usa puerta de ruido ni se recortan fragmentos por volumen**. Whisper analiza todo el audio en ventanas de 30 segundos, con 5 segundos de contexto a cada lado y salto de 20 segundos. El plan cubre cada muestra hasta el final; no recorta audio por volumen. Solo evita inferencia para silencio digital exacto (muestras cero), cerrando el contexto para no unir frases separadas por pausas largas. Los límites digitales exactos también acotan marcas de tiempo; no son un detector de voz.

El modo **Automático** elige tiny para hasta 60 segundos y base para grabaciones mayores. Un clip de 30 s requiere una ventana; una hora exacta, 180. La UI muestra progreso real por ventana, texto parcial, tiempos reproducibles, duración analizada y una estimación restante basada en trabajo completado (sin prometer velocidad fija). No calcula todos los espectrogramas de una hora a la vez. Al detener/pausar libera decodificador, modelo y worker; los tokens permiten reconstruir la fusión al continuar.

La amplificación también sube el ruido. No garantiza recuperar palabras inaudibles, separar voces superpuestas, transcribir música o identificar todos los sonidos; esta herramienta reconoce habla y texto visible. Whisper puede producir errores o texto inventado en ruido y silencio. Solo se omite la inferencia de ventanas con silencio digital exacto; se conserva su duración en el plan. El usuario puede desactivar la mejora y comparar otro modelo o canal.

## Límites

- Formatos de audio: M4A / AAC, MP3, WAV, OGG / Opus, FLAC, WebM y video MP4 / MOV cuando el navegador puede decodificar su pista. El soporte real depende del códec y navegador. Un archivo no compatible presenta un error y pide WAV / MP3; no se simula conversión.
- Imágenes: PNG, JPG, WebP, BMP y otros formatos que el navegador decodifique. HEIC / TIFF pueden necesitar convertir a PNG / JPG. No acepta PDF ni describe objetos.
- Hasta 2 GiB de audio/video local y 4 horas por pista; imágenes y carga desde URL, 300 MiB. Desde URL el límite también se comprueba mientras se descarga, aunque el servidor no envíe tamaño. El modelo sigue necesitando bastante memoria y CPU/GPU; evitar PCM completo reduce el gasto de audio, pero no elimina los límites del modelo. Una junta de una hora con voz continua aún puede tardar mucho en WASM.
- Si el códec/entorno no admite lectura por partes, solo se ofrece lectura Web Audio completa **con permiso** hasta 3 minutos y 50 MiB. Para grabaciones largas no hay fallback completo que arriesgue descomprimir una hora: usar un navegador de escritorio con códec compatible o convertir a WAV PCM. AIFF corto puede usar esa compatibilidad si el navegador informa su duración.
- Un archivo a la vez. El modelo Junta · mayor precisión requiere más memoria y tiempo. CPU WASM permite usarlo sin WebGPU ni cabeceras especiales, incluido GitHub Pages. GPU experimental depende del dispositivo/browser; no se ha validado una sesión continua de una hora con GPU.
- Detener termina el worker, cancela la lectura y conserva el archivo y el texto parcial. La ventana interrumpida se repite al continuar; solo se confirma una ventana después de generar y fusionar sus tokens. La reanudación conserva los ajustes originales. Pausar espera a terminar la ventana actual. Mantén la pestaña abierta para evitar suspensión del navegador.
- URLs requieren CORS. No se intenta eludir restricciones ni cargar páginas de YouTube / Spotify como si fueran archivos.

## Desarrollo y validación

Sin instalación para publicar. Archivos HTML, CSS y módulos JS con rutas relativas a `transcribe/`. Lectores en `vendor/` y motores externos con versiones fijadas. El build conjunto de la raíz empaqueta ambas herramientas; el service worker de Drop está aislado a `/drop/` y no toca las cachés de modelos.

```sh
node --test transcribe/tests/*.test.mjs
node --check transcribe/app.mjs
node --check transcribe/asr-worker.mjs
```

Fuentes: [Transformers.js ASR](https://huggingface.co/docs/transformers.js/api/pipelines), [Whisper](https://github.com/openai/whisper), [Tesseract.js API](https://github.com/naptha/tesseract.js/blob/master/docs/api.md).

Validación de la versión inicial: siete pruebas DSP / SRT aprobadas; comprobaciones DOM de carga, pestañas, limpieza, tipos admitidos, contador y rutas relativas; prueba real de Whisper base q8 con audio de ejemplo reducido al 1% de amplitud y recuperación de la frase completa; prueba real de OCR `spa+eng` con extracción de “Reynoso prueba 67. Texto de captura.” y confianza orientativa 96%. Estos últimos motores se ejecutaron en Node; no equivalen a validar integración de códecs, micrófono y renderizado en todos los navegadores. QA visual y ejecución integral en navegador no disponibles en el entorno de creación.

## Arquitectura de audio largo · v2.0

- `session.mjs`: plan, ventanas, ETA, hash completo por bloques y validación del checkpoint versionado.
- `media.mjs`: importación diferida, lectura acotada, cierre de muestras/decodificador, compatibilidad limitada y remuestreo nativo por ventana.
- `mp3.mjs`: decodificador MP3 opcional, sin leer PCM de toda la grabación.
- `asr-engine.mjs`: espectrograma/inferencia de una ventana, liberación de tensores y fusión de tokens con strides. `_decode_asr` es una API interna de **3.8.1**; no actualizar la librería sin pruebas reales de cortes, pausas, repeticiones y reanudación.
- `asr-worker.mjs`: protocolo `init` → `ready`, `window` → `partial`, errores y descargas observables.
- `storage.mjs`: recuperación optativa en una transacción de IndexedDB; no toca sesiones de Drop ni otras herramientas.
- `app.mjs`: permisos, operación/cancelación, texto parcial, exportación, pausa/reanudación y Wake Lock optativo. Los controles OCR siguen funcionando.

Validación v2.0: 55 pruebas automáticas del repositorio, DOM del flujo real (autorización/rechazo, descarga diferida, pausa, texto parcial, reanudación, IndexedDB y detener; inferencia worker simulada), lector WAV y hash reales. Prueba real en Node con un WAV sintético de **una hora**, voz al inicio/minuto 30/final, 180 ventanas y reanudación: conserva las tres frases y marcas globales, sin solicitar `arrayBuffer()` del archivo entero; cada ventana a 16 kHz tiene como máximo 480,000 muestras. Esto usa largos tramos de silencio digital y **no mide una hora de junta con habla continua**. Decodificación real por rangos de M4A/AAC de una hora con Mediabunny + decodificador nativo de servidor en Node; lector MP3 WASM real, incluyendo búsqueda a mitad de pista. Pruebas de cortes/reanudación frente al pipeline Whisper fijado y recuperación de voz al 1% de amplitud. Prueba de 61 ventanas consecutivas con inferencia CPU nativa en Node: la memoria residente se estabiliza tras calentamiento (~1.37 GiB); no es una medición del runtime WASM/GPU del navegador.

Estas pruebas no equivalen a QA integral en Chrome/Safari/iPad, códecs WebCodecs del dispositivo, WebGPU ni micrófono. No se validó visualmente en navegador. Whisper puede omitir/repetir palabras y sus tiempos son aproximados; las mejoras de memoria/recuperación no convierten la salida en una minuta verificada. Revisar nombres, cifras, decisiones y voces superpuestas antes de avanzar con el proyecto.

Fuentes adicionales: [Mediabunny](https://mediabunny.dev/guide/reading-media-files), [AudioSampleSink](https://mediabunny.dev/api/AudioSampleSink), [MPG123](https://github.com/eshaz/wasm-audio-decoders), [Hash WASM](https://github.com/Daninet/hash-wasm), [WebGPU en Transformers.js](https://huggingface.co/docs/transformers.js/v3.8.1/en/guides/webgpu). Dependencias locales y remotas fijadas e importadas solo tras autorizar el proceso.


## Corrección de carga · v2.0.1

El lector de audio ya no importa Mediabunny directamente desde jsDelivr. Mediabunny 1.61.3, Hash WASM 4.12.0 y mpg123-decoder 1.0.3 viven en `vendor/`, se publican junto con Transcribe y se importan solo después de autorizar el procesamiento. Esto elimina esa dependencia del CDN al abrir, verificar y decodificar el audio. No elimina la conexión necesaria para descargar Whisper/Transformers/ONNX ni OCR. No se cambian los límites, ventanas, permisos ni recuperación. HTML, app, lector y sesión usan la versión 2.0.1 para evitar reutilizar imports anteriores tras el despliegue.

`vendor/manifest.json` fija SHA-256 y licencias de cada bundle. Git conserva los bytes de los bundles mediante `.gitattributes` (el WASM MP3 contiene datos yEnc en strings; no reformatearlos ni convertir saltos de línea). El check comprueba integridad, licencias y sintaxis; el build copia `vendor/` sin instalación. Mediabunny y Hash WASM son copias sin cambios de sus distribuciones npm. MP3 es un bundle ESM del lector síncrono y su WASM integrado, sin el worker opcional ni imports de otros servidores; conserva la API pública `errors`, `channelData` y `samplesDecoded`.

Fuentes y avisos de terceros:

- [Mediabunny 1.61.3](https://www.npmjs.com/package/mediabunny/v/1.61.3), [código fuente](https://github.com/Vanilagy/mediabunny): MPL-2.0, `vendor/mediabunny.LICENSE`.
- [Hash WASM 4.12.0](https://www.npmjs.com/package/hash-wasm/v/4.12.0), [código fuente](https://github.com/Daninet/hash-wasm): MIT, `vendor/hash-wasm.LICENSE`.
- [mpg123-decoder 1.0.3](https://www.npmjs.com/package/mpg123-decoder/v/1.0.3), [fuentes y build WASM](https://github.com/eshaz/wasm-audio-decoders): MIT, `vendor/wasm-audio-decoders.LICENSE`; incluye `@wasm-audio-decoders/common@9.0.7` y `simple-yenc@1.0.4`. El [mpg123 integrado](https://github.com/madebr/mpg123) es LGPL-2.1, `vendor/mpg123.LICENSE`. Puff de Mark Adler conserva su aviso en `vendor/puff.LICENSE`; upstream lo adapta para incorporarlo al WASM.

Para reconstruir el bundle MP3 en una carpeta temporal (no es requisito para publicar): instalar las versiones anteriores y `esbuild@0.25.12`, crear un entry `export { default as MPEGDecoder } from './node_modules/mpg123-decoder/src/MPEGDecoder.js';`, compilar con `--bundle --format=esm --platform=browser --target=es2020 --minify --legal-comments=inline`, conservar los avisos y actualizar el hash del manifest tras probar el lector real. No usar el bundle UMD minificado upstream: su resultado renombra `errors`, lo que rompe el contrato del adaptador.

Validación de este arreglo: 58 pruebas del repositorio. Las tres nuevas ejecutan los bundles locales sin CDN: lectura y búsqueda de WAV por ventanas (prohibiendo lectura completa), hash WASM real en varios bloques y contrato/init del WASM MP3. Prueba adicional de MP3 real al inicio, mitad y final con el bundle local. Flujo DOM de la app con imports HTTPS bloqueados: autorización antes de cargar los lectores, rechazo sin descargas, texto parcial, pausa/reanudación, IndexedDB y cancelación; inferencia del worker simulada. Mantiene las limitaciones de QA de navegador/GPU descritas arriba.


## Audio Lab → Transcribe · UI v2.0.2

Audio Lab puede entregar un WAV preparado y su mapa de tiempos localmente entre pestañas, con autorización del usuario y contrato `reynoso.audio-lab` v1. El receptor comprueba origen, ventana, nonce, tamaño WAV y mapa monotónico. Recibir no inicia Whisper: conservamos selección de idioma/modelo y autorización. No modifica motor, ventanas, recuperación, OCR ni SRT. Para el WAV ya limpio desmarca inicialmente el rescate de voz/high-pass; se pueden volver a activar.

La nota de procedencia permite descargar el mapa. Marcas y SRT usan el tiempo del audio procesado; los tooltips de las marcas muestran el tiempo original cuando existe el mapa. Este metadata vive en la sesión de la pestaña, no se agrega al checkpoint Whisper: descarga el mapa para conservarlo tras recargar. Cargar una fuente normal limpia la nota/mapa anterior. Audio Lab conserva el resultado para descarga si el navegador bloquea la transferencia. Los módulos compartidos agregan validación de timeline, mensajes y copia local por bloques en un Worker, sin VAD/RNNoise ni acceso a IndexedDB de Audio Lab. Antes de confirmar recepción se materializa una copia temporal independiente en OPFS (o Blob acotado hasta 160 MiB), comprobando cuota. Así borrar/cerrar Audio Lab no invalida el WAV recibido. Requiere espacio local adicional autorizado. La copia se limpia al retirar/cambiar fuente/cerrar; un cierre abrupto puede dejar un temporal propio hasta su limpieza después de 24 horas. No se archiva permanentemente la grabación.
