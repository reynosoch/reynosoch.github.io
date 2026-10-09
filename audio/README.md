# Audio Lab · Reynoso Toolchain

**LISTO** · [Abrir Audio Lab](https://reynosoch.github.io/audio/) · [Toolchain](https://reynosoch.github.io/) · [Transcribe](https://reynosoch.github.io/transcribe/)

**Audio Lab no transcribe. Prepara audio para Transcribe.** Pensado para juntas de 57–60 minutos con voces bajas, diferentes niveles, ruido constante y pausas largas. Todo el procesamiento ocurre en el dispositivo, sin cuentas, API keys, backend ni subida de audio.

## Uso

1. Arrastra, selecciona o pega una grabación. Autoriza el análisis local: revisa todos los canales por bloques, detecta habla con Silero y dibuja peaks resumidos.
2. Revisa duración, formato/códec, canales, frecuencia, RMS/pico dBFS, clipping, voz, no voz y canal recomendado. El piso de ruido usa el percentil 15 del RMS de bloques de 100 ms; puede incluir voz suave cuando el habla es continua. El score combina este piso orientativo con actividad hablada del modelo. No es una medición certificada de SNR ni LUFS.
3. Prueba 10, 20 o 30 segundos. Toca la waveform para buscar, arrastra para seleccionar; usa zoom y desplazamiento. A/B alterna el mismo punto del original y del fragmento limpio, sin recortar pausas en la prueba.
4. Pulsa **Preparar junta**, autoriza los motores y el WAV temporal. Escucha el resultado. Descarga WAV, mapa de tiempos, análisis o segmentos CSV.
5. **Enviar a Transcribe** abre otra pestaña con autorización y entrega el WAV y su mapa localmente. Allí elige idioma/modelo y autoriza Whisper. Si se bloquea la ventana o no llega confirmación, el WAV sigue disponible para descargar y abrir manualmente.

El original permanece intacto. Una voz inaudible, varios hablantes superpuestos, golpes o música fuerte pueden seguir sin ser comprensibles. La limpieza no garantiza mayor precisión de Whisper: prueba el fragmento antes y reduce intensidad o desactiva ruido/filtros si empeoran la voz.

## Pipeline y modelos

- **Lectura incremental:** Mediabunny **1.61.3** con BlobSource, caché de 4 MiB y AudioSampleSink, reutilizando los bundles locales de Transcribe. Decoder independiente dentro de un Worker de Audio Lab; cada AudioSample se cierra al copiarlo. No se usa `file.arrayBuffer()` ni Web Audio completo para una junta larga.
- **Análisis:** slabs de 10 s, todos los canales individualmente, remuestreo con filtro windowed-sinc anti-aliasing a 16 kHz. Estadísticas acumuladas y peaks cada 100 ms; no dibuja millones de samples. La waveform distingue habla Silero, silencio/señal baja, señal sin habla detectada y cortes. El color de señal sin voz es orientativo (RMS > .0005, no un clasificador de ruido); puede incluir ruido o voz no reconocida.
- **VAD real:** Silero **V5**, ONNX suministrado por `@ricky0123/vad-web@0.0.29`, con **ONNX Runtime Web 1.22.0** CPU/WASM de un hilo. Frames de 512 muestras con 64 de contexto anterior y estado recurrente por canal. Ganancia limitada para el detector, constante por bloque; no es una puerta RMS. Histeresis .35/.20, espera de 480 ms y mínimo 96 ms para conservar palabras breves. Confianza es salida del modelo, no probabilidad calibrada de exactitud.
- **Selección:** actividad hablada, estimación de nivel voz/no voz y penalización de clipping. Automático elige un canal; izquierdo, derecho y mono combinado están disponibles. La mezcla comprueba contrafase y conserva un canal antes de cancelar las voces. En grabaciones con voces distintas en cada canal, selecciona mono combinado y revisa A/B.
- **Ruido:** RNNoise local **@shiguredo/rnnoise-wasm 2025.1.5**, 48 kHz, frames de 480 y escala PCM de 16 bits. Cada bloque incluye 250 ms de contexto anterior y 40 ms posterior; se compensa la latencia de un frame antes de recortar ese contexto. Mezcla original/limpio con intensidad .65 por defecto (.85 en Máxima calidad). Se destruye cada estado al terminar su bloque. No separa conversaciones superpuestas. Si el motor no carga, avisa y continúa con filtros/nivelado/silencios, sin afirmar que hubo reducción.
- **Voz:** high-pass de 70 Hz opcional, nivelado orientativo hacia RMS .115 por frames de 100 ms, hasta +22 dB, con suavizado de ganancia; se evita amplificar automáticamente segmentos fuera del habla protegida. Compresión de envolvente para voces fuertes; limitador de amplitud a −1 dBFS, siempre activo. **No calculamos LUFS ni EBU R128** y no se presentan métricas falsas de loudness.
- **Salida:** segunda pasada por bloques, corte según mapa, fades de 5 ms en discontinuidades, PCM mono de 16 bits / 16 kHz con cabecera WAV exacta. No genera chunks adicionales porque Transcribe ya gestiona ventanas y contexto.

| Preset | Qué hace |
| --- | --- |
| Rápido | Silero, selección de canal, silencios, nivelado y limitador; sin RNNoise, high-pass ni compresor por defecto. |
| Balanceado | Todo lo anterior más RNNoise moderado, high-pass y compresor. Default para juntas. |
| Máxima calidad | Mismo motor validado, mayor mezcla de reducción de ruido. Más intensidad puede empeorar voz lejana; no descarga diarización ni promete precisión adicional. |

Ajustes avanzados colapsados: canal, cuatro modos de pausas, RNNoise/intensidad, high-pass, nivelado y compresor. WAV es la salida estable; M4A/Opus export no está disponible, no se simula un códec alternativo.

## Pausas y mapa de tiempo

Se agregan **350 ms antes y 650 ms después** de cada segmento VAD, se unen intervalos solapados y se preservan pausas pequeñas. Reglas iniciales verificadas con fixtures de voz/ruido; cada grabación requiere escuchar A/B:

| Modo | Pausa sin voz protegida recortable | Pausa que queda |
| --- | --- | --- |
| Conservador | > 3 s | .8 s |
| Balanceado | > 1.5 s | .5 s |
| Agresivo | > .9 s | .3 s |
| Off | Nunca | Toda |

La pausa conservada se toma de ambos extremos del intervalo, preservando audio real. **Si no se encuentra voz, se conserva toda la fuente.** Esto evita borrar una junta que el modelo no entiende. Un VAD puede perder palabras incluso con padding: el mapa no convierte un detector en infalible.

Sidecar exportado:

```json
{"version":1,"originalDuration":3600,"outputDuration":2400,"timeMap":[{"outputStart":0,"outputEnd":23.4,"originalStart":8.2,"originalEnd":31.6,"type":"speech"}]}
```

El ejemplo describe el formato, no es una medición. El mapa real cubre la salida de forma contigua, es monotónico en origen y mantiene longitud por span; se valida antes de entregar. `outputToOriginal` y `originalToOutput` convierten tiempos. Un timestamp exactamente en un corte corresponde al comienzo del siguiente span; los tiempos originales descartados se fijan al borde retenido. Fades no cambian la longitud.

Exporta `*-clean.wav`, `*-time-map.json`, `*-analysis.json` y `*-segments.csv` (start/end/type/speaker/confidence). Speaker queda vacío porque no hay diarización.

## Formatos y dispositivos

Acepta M4A/AAC, MP3, WAV PCM, FLAC, OGG/Opus, WebM y MP4/MOV con pista de audio, **cuando WebCodecs/Mediabunny puede decodificar su códec**. En videos solo lee la pista de audio. MP3 tiene lector WASM adicional local ya autorizado en el diálogo. Hasta 2 GiB, 4 horas, 8 canales y 8–192 kHz. No presupone que extensión equivale a códec compatible.

Si no hay decoder incremental compatible, muestra error humano y recomienda escritorio actualizado o convertir a WAV PCM. No existe fallback de descompresión completa de una hora. No se incorporó ffmpeg.wasm: no aportaba una ruta de memoria más segura para este flujo.

Detecta WASM, Worker, WebCodecs/códecs, AudioWorklet, WebGPU, SharedArrayBuffer, hilos, RAM informada, OfflineAudioContext y OPFS. **No exige WebGPU ni SharedArrayBuffer**. iPad puede usar CPU/WASM y Rápido; Safari/códecs/suspensión y un iPad físico no se consideran validados por una emulación táctil de Chromium. Wake Lock se solicita solo al marcar la opción y durante proceso; se reacquire al volver a una pestaña visible cuando el usuario sigue autorizándolo.

## Memoria, temporales, cancelación y recuperación

Mantiene únicamente el bloque nativo actual, sus canales, buffers DSP/remuestreo acotados, estados de modelos y pequeños metadatos de análisis/mapa. Nunca conserva original PCM completo, limpio completo y normalizado completo simultáneamente. Los peaks y segmentos crecen con duración, no con cantidad de samples.

El WAV **resultante**, con autorización explícita, se escribe incrementalmente a OPFS mediante un SyncAccessHandle en el Worker cuando está disponible. La cabecera se actualiza al finalizar; no necesita un Float32Array de una hora. Se comprueba cuota. Si OPFS no funciona, utiliza chunks de PCM16/Blob con un límite de **160 MiB** (una hora mono = ~110 MiB); rechaza una salida más grande con recomendación de otro navegador/fragmento. El fallback requiere más memoria que OPFS.

Temporales `reynoso-audio-*` se eliminan al reemplazar/quitar resultado, cancelar y en `pagehide`. Si la pestaña se cierra abruptamente puede quedar un WAV local; al recargar elimina los temporales de esa misma pestaña (identificador de sesión sin audio en sessionStorage y prueba BroadcastChannel para no borrar una pestaña duplicada activa); al reabrir desde otra pestaña elimina solo los temporales de más de 24 horas, sin borrar sesiones activas recientes de otras pestañas ni datos de otras apps. No es un archivo permanente ni una copia de la fuente. Descarga el resultado antes de cerrar; el resultado sin transferir no se conserva después de abandonar Audio Lab. Después de recepción confirmada, Transcribe tiene su copia independiente.

Cancelar termina el Worker (incluido WASM/modelos), su decoder y buffers, libera Wake Lock y elimina el temporal conocido. Conserva fuente y último resultado terminado; la siguiente operación abre/verifica de nuevo la fuente. Errores técnicos van a un detalle colapsado, con recomendación visible.

**Recuperación optativa**: IndexedDB `reynoso-audio-lab`, sin audio. Guarda análisis final, nombre, ajustes y SHA-256 completo por chunks de 2 MiB. Tras recargar se selecciona el original y se verifica hash antes de usar el análisis. No reanuda un DSP a medio bloque ni recupera el WAV temporal de un cierre abrupto. Puede borrar el checkpoint. Hash/lectores son los bundles existentes de Transcribe, sin usar su base de datos.

## Handoff local y privacidad

Contrato `reynoso.audio-lab`, versión 1, `File/Blob` WAV, nombre, duración original y `timeMap`. `shared/audio-handoff.mjs` implementa `postMessage` con ventana creada por el usuario, origen exacto, source exacto y nonce de sesión aleatorio. El receiver valida versión, tamaño, timeline y duración derivada del WAV; responde accepted/rejected. Sin IndexedDB de audio compartido ni samples gigantes en JSON. Structured clone transporta Blob/File, pero una snapshot OPFS pierde legibilidad al eliminar su backing file. Por eso, **antes de confirmar recepción**, un Worker copia el WAV por bloques de 2 MiB a un temporal propio de Transcribe (`reynoso-transcribe-handoff-*`). Comprueba quota y permite cerrar Audio Lab después del ACK. Sin OPFS usa Blob por partes hasta 160 MiB; si no hay espacio, rechaza y conserva el resultado en Audio Lab para descarga. La copia requiere espacio local adicional, autorizado en el diálogo; nunca crea un Float32Array completo. Transcribe limpia su copia al quitar/cambiar fuente/cerrar, y temporales propios de más de 24 horas al volver después de un cierre abrupto.

Transcribe recibe la fuente y muestra su procedencia. Desactiva sus filtros de rescate de voz por defecto para no volver a procesar el WAV (el usuario puede activarlos), conserva permiso de Whisper y no cambia motor, ventanas, OCR, pausa/reanudación ni SRT. Las marcas/SRT siguen siendo **tiempos procesados**; el tooltip de cada marca permite consultar el original y se puede descargar el mapa. El mapa no se añade al checkpoint de Whisper en esta versión: descárgalo para conservarlo después de recargar.

Cierre/popup bloqueado/timeout deja el resultado en Audio Lab y ofrece descargar + abrir manualmente. No hay backend, upload, analytics, login ni servicio de inferencia. Descargar código/modelos desde Pages consume conexión, **no envía la grabación**. Audio Lab no registra service worker y no toca cachés/sesiones de Drop.

## Speakers experimental

Deshabilitado de forma explícita, con contrato `speakers: {available:false, reason:...}`. Se investigaron Silero/RNNoise (no identifican personas), speaker embeddings/segmentation y pyannote. No se validó una integración completa con modelos, clustering y overlap local estable en Safari/Pages. No se descarga un modelo de cientos de MB ni se asigna una persona por pausa. Speaker renaming y overlap requieren un motor real futuro; no están simulados.

## Dependencias y licencias

Assets fijos servidos desde Pages, sin dependencia de jsDelivr para Audio Lab. Carga lazy solo después de autorización. `vendor/manifest.json` registra origen npm, versión, bytes, SHA-256 y avisos; `npm run check` comprueba integridad. Los bundles/modelos no se modifican. `.gitattributes` conserva bytes.

| Asset | Tamaño de archivo aproximado | Licencia |
| --- | --- | --- |
| ONNX Runtime Web 1.22.0 JS + WASM de un hilo | 10.8 MiB | MIT, `onnxruntime.LICENSE` |
| Silero V5 ONNX de vad-web 0.0.29 | 2.2 MiB | MIT, `silero.LICENSE` |
| RNNoise WASM 2025.1.5 integrado | 4.6 MiB | wrapper Apache-2.0; RNNoise BSD-3-Clause, avisos adjuntos |
| Mediabunny / Hash WASM / MP3 | En `transcribe/vendor/manifest.json` | MPL-2.0 / MIT / MIT + LGPL-2.1, avisos existentes |

La memoria de ejecución y descarga real dependen del navegador/caché; los tamaños anteriores no son estimaciones de RAM. Fuentes: [Silero](https://github.com/snakers4/silero-vad), [wrapper ONNX/contexto](https://github.com/snakers4/silero-vad/blob/master/src/silero_vad/utils_vad.py), [vad-web](https://github.com/ricky0123/vad), [ONNX Runtime Web](https://onnxruntime.ai/docs/get-started/with-javascript/web.html), [RNNoise WASM](https://github.com/shiguredo/rnnoise-wasm), [Mediabunny](https://mediabunny.dev/guide/reading-media-files), [pyannote](https://huggingface.co/pyannote/speaker-diarization-community-1).

## Desarrollo y validación

`core.mjs`: DSP/timeline puros; `reader.mjs`: bloques; `engines.mjs`: Silero/RNNoise; `worker.mjs`: dos pasadas; `output.mjs`: OPFS/Blob; `recovery.mjs`: metadata optativa; `app.mjs`: autorización, waveform y controles. El generador excluye apps `ready`: nunca sobrescribe `audio/index.html` ni este README. Build copia la app completa y sus assets.

```sh
npm run generate
npm run check
npm run build
node --test audio/tests/*.test.mjs
```

Pruebas automáticas: contexto/merge, VAD hysteresis, pausas, mapas y conversiones, clipping, canales/contrafase, ganancia/compresión/limitador, resampler anti-alias, duración WAV/fades, plan de una hora, lectura PCM estéreo real por partes, recuperación versionada y handoff/nonce/origin/source/fallback. No se mockea el DSP puro.

QA real en Chromium 138 headless (CPU/WASM, sin aislamiento cross-origin): Silero y RNNoise, WAV estéreo de **30 s**, **6 min** y **60 min** con voz pública repetida, pausas, voces a niveles distintos y ruido sintético; dos ejecuciones completas de una hora. En el fixture de una hora: **3600 s → 1438.484 s (23:58)**, 798 spans, WAV ~43.9 MiB, pico −1.4 dBFS. Estos valores describen ese fixture con canal izquierdo; no predicen el ahorro o la calidad de una junta real. En corto se verificó recomendación de canal derecho cuando su señal era superior.

Se comprobó exactitud de longitud WAV/mapa, picos sin clipping y que los cortes de los fixtures corto/medio conservaban prácticamente toda la energía de sus regiones habladas (>99.99%). Esto no garantiza conservar cada palabra en otras grabaciones. Cancelación/reinicio real de la pista de una hora, A/B, handoff con recepción y lectura válida tras eliminar el temporal de Audio Lab, cargar después una fuente normal en Transcribe, autorización rechazada sin modelos, recuperación/hash tras recargar, limpieza de temporales, ausencia de POST/upload y layouts desktop/iPad/móvil en emulación. No se midió una junta real de habla continua ni un pico RSS específico de Safari.

`npm run check:browser` ejecuta Snippets y una prueba de Audio Lab con motores reales, de 30 s, que usa el clip **público** de Whisper en `audio/tests/fixtures/` (sin grabaciones del usuario). Para repetir la prueba larga reproducible:

```sh
AUDIO_QA_LONG=1 npm run check:audio:browser
```

Requiere el Chromium de Playwright instalado (`npx playwright install chromium`); puede usar `BROWSER_EXECUTABLE_PATH` en entornos con navegador propio. Fixtures y outputs del test se escriben temporalmente por slabs fuera del repositorio y se eliminan. La prueba larga tarda según CPU; no mantiene una hora de PCM flotante en memoria. No equivalen a la junta real del usuario ni a una prueba física de iPad. Revisar nombres, cifras y decisiones en Transcribe antes de usar el texto con agentes.
