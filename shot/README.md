# Shot · Reynoso Toolchain

**LISTO · USO DIARIO** · [Abrir Shot](https://reynosoch.github.io/shot/) · [Toolchain](https://reynosoch.github.io/)

Pega una captura, señala exactamente qué cambiar y devuelve la imagen y las instrucciones a tu agente de IA. No requiere proyectos, cuentas, backend ni APIs de IA.

## Camino rápido

Windows + Shift + S → Shot → Ctrl+V → A para flecha → N para numerar → escribir cada nota → Copiar imagen → pegar en IA → Copiar feedback → pegar instrucciones.

Abrir capturas permite selección múltiple. También acepta arrastrar PNG, JPG, WebP, GIF, AVIF y BMP según el decoder del navegador; imágenes animadas se importan como un fotograma. Los nombres se muestran como texto, nunca como HTML. SVG externo queda fuera para evitar fuentes remotas y contenido activo.

## Editor

Fabric.js ofrece selección, movimiento, escalado, rotación, edición de texto, dibujo y serialización. Flecha, línea, subrayado, rectángulo, elipse, dibujo, resaltador, texto y marcador numerado son objetos editables. El texto se edita con doble clic/toque; admite tamaño, negrita, alineación y fondo. El panel Objetos permite seleccionar sin acertar un trazo fino. Las propiedades se aplican a la selección y quedan listas para los objetos nuevos.

Los marcadores tienen notas separadas por ID; borrar/duplicar renumera los puntos. Copiar feedback genera texto plano con introducción editable e instrucciones acotadas. Preparar para IA ofrece copia de imagen e instrucciones en acciones separadas, PNG, Markdown y ZIP.

Blur, Pixelar y Redactar son regiones editables. Redactar usa siempre un bloque opaco. Blur reduce detalle; no garantiza que texto o datos sean irreconocibles. Al exportar PNG/JPG/WebP o ZIP se rasterizan los efectos: el archivo no contiene objetos editables ni fuentes ocultas. La sesión local conserva el original hasta borrarla. La lupa ×2 conserva el fragmento elegido al moverla; Spotlight oscurece el entorno. Las regiones de efecto no rotan para mantener coherencia con los píxeles fuente; pueden moverse/escalarse.

Recortar: arrastra una zona, ajusta sus controles y pulsa Aplicar recorte. El recorte no modifica la fuente; la exportación limita la salida a esa área. Deshacer/Rehacer cubre objetos, transformaciones, propiedades, texto, notas y recorte, con ramificación y límite de 80 estados o 3 MB de JSON por captura. No duplica bitmaps en cada estado. El historial se reinicia al recuperar la sesión; las anotaciones finales sí sobreviven F5.

## Varias capturas y exportación

Cada captura mantiene anotaciones e historial independientes. La tira permite seleccionar, renombrar, duplicar, reordenar y eliminar (con confirmación si tiene cambios). En móvil conserva estas acciones al seleccionar una captura y usar las opciones de la tira. Hasta 30 capturas / 128 MB de archivos fuente; el límite de fuente es conservador y cuenta duplicados.

PNG es el formato predeterminado y conserva la resolución original. JPG/WebP permiten calidad; 2× amplía sin inventar detalle. Se conserva transparencia en PNG/WebP cuando la fuente la tiene; JPG se compone sobre blanco. Nombres basados en la captura, sin sobrescritura silenciosa. Copiar imagen usa `ClipboardItem` con PNG y una promesa para conservar la activación del usuario. Si el navegador o sus permisos lo bloquean, ofrece Descargar PNG. El botón Pegar puede requerir permiso de lectura; Ctrl+V recibe el evento normal.

Exportar todas crea un ZIP con PNG planos y `feedback.md` mediante JSZip, con límite de 128 MB de PNG preparados por paquete. Combinar admite vertical, horizontal y cuadrícula, con máximo de 24 MP y 12 000 px por lado (reduce escala si es necesario). Antes/Después muestra dos capturas anotadas lado a lado como acción secundaria. Cada imagen individual tiene límite de 40 MP / 16 384 px por lado, incluido export a 2×. Un dispositivo con poca memoria puede necesitar capturas menores.

## Carpeta y recuperación

Abrir carpeta usa File System Access API si está disponible. Solo accede después de selección/permiso explícitos. Guarda el handle en IndexedDB si el navegador lo admite y consulta/solicita permiso en cada escaneo manual. Muestra thumbnails de hasta 150 imágenes, ordenadas por fecha reciente; no hace polling ni navega subcarpetas. Volver a escanear actualiza la lista. Olvidar carpeta elimina el handle, conservando la sesión.

Safari/iPad/Firefox y navegadores sin esta API muestran Seleccionar capturas y usan un `<input type=file multiple>`. No se simula acceso a una ruta Windows ni se promete un selector abierto directamente en Screenshots: el usuario elige la carpeta.

La sesión reciente se guarda en IndexedDB `reynoso-shot`, stores `assets`, `state`, `folder`. Blobs y estado estructural separados, guardado de metadata con debounce de 600 ms y operaciones serializadas. Caduca tras 7 días desde el último guardado; se elimina al volver a abrir si caducó. El quota check ofrece aviso cuando el espacio es insuficiente. Un error de IndexedDB deja edición en memoria con aviso de que debe descargarse antes de cerrar. Borrar sesión limpia solo esta herramienta, revoca thumbnails y libera referencias de canvas. No es sincronización ni respaldo permanente.

## Teclado / touch

| Acción | Atajo |
| --- | --- |
| Seleccionar / flecha / rectángulo / elipse | V / A / R / E |
| Dibujar / resaltar / texto / número | P / H / T / N |
| Deshacer / rehacer | Ctrl/Cmd+Z / Shift+Z o Y |
| Duplicar / borrar | Ctrl/Cmd+D / Delete o Backspace |
| Encajar / cancelar | Ctrl/Cmd+0 / Escape |
| Copiar imagen sin selección | Ctrl/Cmd+C |
| Copiar objeto seleccionado | Ctrl/Cmd+C; Ctrl/Cmd+V dentro de Shot |
| Zoom / pan | Ctrl/Cmd+rueda; Mover vista + arrastrar |

Una imagen externa en Ctrl+V tiene prioridad; los objetos copiados por Shot se pegan solo cuando el portapapeles mantiene su token exacto, evitando pegar objetos viejos en lugar de texto externo. No intercepta atajos en inputs ni mientras se edita texto. Las acciones principales tienen botones táctiles; Fabric entrega controles de selección ampliados para touch. Dos dedos mueven/zoomean la vista sin dibujar; Apple Pencil usa el pointer del navegador. No hay garantías de presión ni validación en iPad físico todavía.

## Arquitectura y dependencias

- `app.mjs`: coordinación, sesión, eventos y atajos.
- `editor/canvas.mjs`: Fabric, herramientas y viewport.
- `editor/regions.mjs`: censura/spotlight/lupa sobre fuente local.
- `editor/history.mjs`: historial estructural, feedback y límites.
- `editor/export.mjs`: render plano, ZIP y combinación.
- `media/`: archivos, thumbnails, carpeta, clipboard e IndexedDB.
- `ui/panels.mjs`: galería y notas con DOM/textContent seguro.
- `vendor/`: Fabric.js 7.4.0 MIT (~286 KB), JSZip 3.10.2 MIT (~99 KB, cargado al exportar ZIP), manifiesto SHA-256/licencias.

Se evaluaron Fabric y Konva: Fabric incluye edición de texto y controles/serialización de objetos que requiere este editor; Konva obligaría a gestionar más piezas de ese flujo. Se usa un solo motor. Bundles locales con esbuild 0.28.2, versiones exactas en package-lock. `npm run vendor:shot` reconstruye dependencias; `check` verifica bytes/licencias. El landing carga únicamente su búsqueda. Shot no registra service worker ni modifica cachés de Drop/Snippets.

Prompt, Context, Drop, Image Lab y Transcribe son enlaces de navegación. No existe un contrato seguro de recepción de imágenes en Drop; no se añadió un protocolo nuevo ni OCR duplicado.

## Verificación

`npm run generate` conserva Shot porque `ready: true`; build copia la app completa a `dist/shot/`. `npm run check` valida catálogo/orden, rutas, hashes, historial, límites, feedback y persistencia con fake-indexeddb. `npm run check:shot:browser` valida portapapeles nativo, import múltiple, herramientas, historial, notas, PNG, recovery, censura/efectos, ZIP, combinación, carpeta fallback y layouts. El workflow Verify main incluye esta suite junto a Audio Lab y Snippets.

QA de imágenes sintéticas 1920×1080, 2560×1440, 700×7000 y varias simultáneas; layouts 1920×1080, 1366×768, iPad 1180×820 / 820×1180 y 390×844. Chromium automatizado no reemplaza Safari, permisos nativos de carpeta ni iPad/Apple Pencil físico.
