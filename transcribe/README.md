# Reynoso Transcribe

Forma parte de **Reynoso Toolchain**. La pestaña se titula **Transcribe · Reynoso Toolchain** y el header **← Toolchain** regresa siempre a [la portada](https://reynosoch.github.io/). El estilo del header usa `../shared/toolchain-nav.css` y no modifica el motor, sus controles, límites ni workers de procesamiento.

Página estática publicada en **https://reynosoch.github.io/transcribe/**. Vive en `transcribe/` dentro del repositorio `reynosoch/reynosoch.github.io`, junto con Drop en `drop/`. La raíz ahora es el [centro de herramientas](https://reynosoch.github.io/). El despliegue de Pages ya configurado publica los cambios de `main`.

## Uso

1. Arrastra o selecciona audio / video o una imagen. También acepta archivos e imágenes pegados con Ctrl+V, grabación por micrófono y enlaces HTTPS directos que permitan CORS.
2. Selecciona idioma y modelo. Ejecuta Transcribir o Extraer texto.
3. Revisa y edita el resultado, copia o descarga TXT. Audio permite marcas de tiempo reproducibles y SRT. Si editas el texto, se ocultan SRT y marcas de tiempo porque ya no representan la versión editada.

## Motores y privacidad

- Whisper multilingüe mediante **Transformers.js 3.8.1**, en un Web Worker WASM de un hilo; modelos `Xenova/whisper-tiny`, `base` (predeterminado) y `small`, cuantizados a q8. Sin API de pago ni claves expuestas. La primera carga descarga decenas / cientos de MB de Hugging Face; el navegador guarda los modelos en su caché cuando está disponible.
- OCR mediante **Tesseract.js 6.0.1**. Idiomas español e inglés predeterminados; admite francés y portugués. Mejora opcional de escala, contraste e inversión para capturas oscuras; distribución automática, bloque o texto disperso.
- Archivos e inferencia permanecen en el navegador. Se solicitan dependencias a jsDelivr, modelos a Hugging Face y tipografías a Google Fonts; estas solicitudes requieren conexión, pero no suben archivos. El usuario puede cargar un archivo desde otro servidor con URL, lo que solicita ese archivo a dicho servidor.
- Sin historial persistente de archivos ni textos. Recargar descarta los resultados; descarga antes de cerrar.

## Audio bajo

Web Audio decodifica el archivo, conserva canales seleccionables y evita cancelar señales estéreo en contrafase. OfflineAudioContext remuestrea a 16 kHz con el remuestreador del navegador. El procesamiento opcional elimina graves bajo 65 Hz y aplica ganancia adaptativa suave, hasta +30 dB, con límite de amplitud. **No se usa puerta de ruido ni se recortan fragmentos por volumen**. Whisper analiza todo el audio en ventanas de 30 segundos con solapamiento de 5 segundos, administrado por el motor.

La amplificación también sube el ruido. No garantiza recuperar palabras inaudibles, separar voces superpuestas, transcribir música o identificar todos los sonidos; esta herramienta reconoce habla y texto visible. Whisper puede producir errores o texto inventado en ruido y silencio. Solo se omite inferencia si el archivo entero contiene silencio digital. El usuario puede desactivar la mejora y comparar otro modelo o canal.

## Límites

- Formatos de audio: M4A / AAC, MP3, WAV, OGG / Opus, FLAC, WebM y video MP4 / MOV cuando el navegador puede decodificar su pista. El soporte real depende del códec y navegador. Un archivo no compatible presenta un error y pide WAV / MP3; no se simula conversión.
- Imágenes: PNG, JPG, WebP, BMP y otros formatos que el navegador decodifique. HEIC / TIFF pueden necesitar convertir a PNG / JPG. No acepta PDF ni describe objetos.
- Hasta 300 MB por archivo y una hora de audio; dispositivos con poca memoria pueden necesitar dividir grabaciones mucho antes. La decodificación inicial requiere cargar el audio completo en memoria.
- Un archivo a la vez. Modelo Más preciso requiere más memoria y tiempo. CPU WASM permite usarlo sin WebGPU ni cabeceras especiales, incluido GitHub Pages.
- Cancelar termina los motores y conserva el archivo; la decodificación en curso finaliza internamente antes de descartar su resultado. Mantén la pestaña abierta para evitar suspensión del navegador.
- URLs requieren CORS. No se intenta eludir restricciones ni cargar páginas de YouTube / Spotify como si fueran archivos.

## Desarrollo y validación

Sin instalación para publicar. Archivos HTML, CSS y módulos JS con rutas relativas a `transcribe/`. CDN y versiones fijados en los módulos de los motores. El build conjunto de la raíz empaqueta ambas herramientas; el service worker de Drop está aislado a `/drop/` y no toca las cachés de modelos.

```sh
node --test transcribe/tests/audio.test.mjs
node --check transcribe/app.mjs
node --check transcribe/asr-worker.mjs
```

Fuentes: [Transformers.js ASR](https://huggingface.co/docs/transformers.js/api/pipelines), [Whisper](https://github.com/openai/whisper), [Tesseract.js API](https://github.com/naptha/tesseract.js/blob/master/docs/api.md).

Validación de la versión inicial: siete pruebas DSP / SRT aprobadas; comprobaciones DOM de carga, pestañas, limpieza, tipos admitidos, contador y rutas relativas; prueba real de Whisper base q8 con audio de ejemplo reducido al 1% de amplitud y recuperación de la frase completa; prueba real de OCR `spa+eng` con extracción de “Reynoso prueba 67. Texto de captura.” y confianza orientativa 96%. Estos últimos motores se ejecutaron en Node; no equivalen a validar integración de códecs, micrófono y renderizado en todos los navegadores. QA visual y ejecución integral en navegador no disponibles en el entorno de creación.
