# Cutout · Reynoso Toolchain

**LISTO** · [Abrir Cutout](https://reynosoch.github.io/cutout/) · [Toolchain](https://reynosoch.github.io/)

Elimina fondos y genera archivos PNG transparentes para logotipos, stickers, tipografía y sujetos definidos.

## Uso

1. Arrastra, elige varias imágenes o pega una imagen con Ctrl/Cmd + V.
2. Elige Logo clean (bordes firmes y letras), Sticker clean (bordes suaves sin quitar partículas por defecto) o Fotos / sujetos.
3. Pulsa Quitar fondo. El lote se procesa en secuencia en un worker; puedes cancelarlo sin perder los resultados terminados.
4. Revisa Original, Resultado o Comparar con deslizador. Alterna transparencia, fondo claro u oscuro. Zoom y scroll permiten revisar bordes.
5. Ajusta sensibilidad, suavizado/feather (0–3 píxeles), partículas y reducción de halo. Tolerancia, perfil y método requieren Reintentar. Los otros ajustes reutilizan la máscara, sin repetir la inferencia.
6. Borrar restos / Restaurar zonas retocan la máscara; un Deshacer pincel recupera la pasada anterior. Cambiar ajustes reinicia estos retoques.
7. Copia PNG, descarga PNG/WebP o descarga los resultados terminados en ZIP. Los archivos conservan el tamaño de trabajo y transparencia.

## Motor y calidad

- `@imgly/background-removal` **1.7.0**, ONNX Runtime Web **1.21.0**, modelo ISNet FP16. Bundle local generado con esbuild. Inferencia WASM de un hilo en worker, compatible con Pages sin COOP/COEP ni backend.
- El modo Automático ejecuta segmentación real. En Logo/Sticker, si más del 90% del perímetro corresponde a un fondo uniforme, combina el pipeline con una máscara de contraste que conserva letras separadas y huecos internos. Los gráficos Logo/Sticker que ya tienen un perímetro transparente conservan su alfa sin descargar recursos innecesarios. En Fotos usa la máscara del sujeto. No se pinta un fondo de otro color.
- Color sólido es un complemento explícito que evita descargar el modelo; se elige el color. Puede quitar partes del sujeto del mismo color: restaura con pincel o vuelve al modo Automático/Fotos.
- Suavizado, eliminación de componentes pequeños y reducción de contaminación de color se ejecutan fuera del hilo de UI. Las transparencias originales se multiplican por la máscara, nunca se vuelven opacas al refinar.
- ISNet es una segmentación general, no garantiza cabello, vidrio, humo, sombras o letras sobre fondos complejos. Los logos sobre fondo plano reciben el complemento especializado; sujetos del mismo color que el fondo requieren retoque. Revisa ambos fondos antes de usar el asset.

## Formatos y límites

Entrada: PNG, JPEG, WebP, SVG rasterizado y AVIF si el navegador lo decodifica. SVG elimina scripts, elementos externos y referencias antes de rasterizar; no conserva la edición vectorial. No HEIC, GIF animado ni SVG de salida ficticio.

Hasta 20 imágenes, 20 MB por archivo y 24 megapíxeles en total. Cada imagen se limita a 4096 px por lado / 8 megapíxeles, conservando proporción; la UI indica “ajustada” cuando se reduce. PNG es sin pérdida; WebP usa calidad máxima del encoder del navegador. El ZIP contiene resultados terminados, con prefijos para evitar nombres duplicados. Portapapeles requiere HTTPS, permiso y soporte para PNG; descarga permanece disponible.

## Privacidad y recursos

Imágenes y retoques permanecen en memoria de esta pestaña: no se envían, no se guardan en IndexedDB ni se recuperan tras recargar. Limpiar libera las imágenes y termina el worker. No registra service worker.

Los recursos de ISNet/ONNX (~95 MB) se descargan bajo demanda desde `staticimgly.com`, versión fijada 1.7.0; el navegador y la librería pueden cachearlos. Una red corporativa puede bloquear ese dominio; el complemento de color sólido funciona con recursos locales. La primera ejecución tarda más y la velocidad depende de CPU/memoria. Cancelar termina el worker y la inferencia actual.

JSZip **3.10.2** reutiliza el bundle local de Shot para exportación. Iconos SVG locales del Toolchain (Lucide). Código de CUTOUT y motor IMG.LY bajo **AGPL-3.0**; licencia incluida en `LICENSE` y `vendor/imgly.LICENSE`, fuente disponible en el enlace de la interfaz. ONNX es MIT; licencias de terceros junto al bundle. Esta licencia aplica a CUTOUT, sin cambiar la licencia de otras herramientas.

## Verificación

`npm run check`, `npm run build`, `npm run check:cutout:browser`. Tests de máscaras: fondo blanco/negro, letras, transparencia existente y partículas. Smoke browser: carga, dos PNG transparentes, ZIP, antes/después, pincel, layouts y recientes entre Shot→Cutout→Convert y recarga. `CUTOUT_REAL=1 npm run check:cutout:browser` verifica el pipeline con ISNet real y descargas externas; se ejecuta aparte para no depender del CDN en cada CI.

La prueba opcional `CUTOUT_PHOTO_PATH=/ruta/foto.png CUTOUT_REAL=1 npm run check:cutout:browser` comprueba además segmentación de una foto; las capturas de QA van a una carpeta temporal o `CUTOUT_QA_ARTIFACT_DIR`.
