# Convert · Reynoso Toolchain

**LISTO (implementación standalone)** · [Abrir Convert](https://reynosoch.github.io/convert/) · [Volver al Toolchain](https://reynosoch.github.io/)

Convert es el conversor general de archivos y centro de herramientas PDF de Reynoso Toolchain. La interfaz conserva Liquid Glass y el uploader tipo macOS, permite cargar archivos sueltos, varias selecciones, carpetas completas y capturas pegadas, y procesa tandas de forma secuencial para mantener el uso de memoria bajo control.

## Conversor general

1. Arrastra archivos a la ventana, selecciónalos o abre una carpeta.
2. Elige el formato de salida.
3. Convert normaliza el contenido a texto, tabla, documento, PDF o imagen.
4. Genera el formato elegido.
5. Descarga el resultado individual o un ZIP con toda la tanda.

### Entradas

- Documentos: PDF, DOCX, PPTX, ODT, EPUB.
- Hojas: XLSX, XLS, XLSB, ODS.
- Datos: CSV, TSV, JSON, JSONL, NDJSON, YAML, YML, XML.
- Texto y código: TXT, Markdown, HTML, RTF, LOG, SQL, JavaScript, TypeScript, JSX, TSX, CSS, SCSS, Sass, Less, Python, Java, C/C++, C#, Go, Rust, PHP, Ruby, Shell, PowerShell, BAT/CMD, LaTeX, INI, CFG, CONF, ICS, VCF y otros formatos de texto.
- Imágenes: PNG, JPG/JPEG, WebP, GIF, BMP, SVG, AVIF, HEIC y HEIF.

### Salidas

PDF, DOCX, XLSX, ZIP (empaquetado de carpetas y lotes con soporte ZIP64), PPTX, ODT, ODS, EPUB, CSV, TSV, TXT, Markdown, HTML, JSON, XML, YAML, RTF, PNG, JPG, WebP y SVG.

No todas las conversiones conservan exactamente el mismo aspecto. Office complejo, macros, SmartArt, fórmulas avanzadas, fuentes embebidas o diseños especiales pueden perder información al cruzar formatos. Convert transforma contenido real; nunca simula una conversión cambiando solamente la extensión.

## PDF Studio

La misma ruta `/convert/` incluye un panel con 30 herramientas PDF, todas con iconografía SVG y filtros por categoría.

### Páginas

- **Unir PDF**: combina varios PDFs respetando el orden de selección.
- **Dividir PDF**: crea un PDF por página o extrae un rango; varias salidas se empacan en ZIP.
- **Rotar PDF**: 90°, 180° o 270° sobre todo el documento o páginas seleccionadas.
- **Organizar PDF**: reordena, repite y elimina páginas mediante una secuencia como `3,1,2,4-6`.
- **Recortar PDF**: aplica márgenes en milímetros por página o rango.

### Conversión

- **PDF a Word**, **PDF a PowerPoint**, **PDF a Excel**, **PDF a JPG** y **PDF a Markdown** reutilizan el motor general.
- **Word a PDF**, **PowerPoint a PDF**, **Excel a PDF** y **HTML a PDF** reutilizan el motor general.
- **JPG a PDF** prepara imágenes como documento.
- **Escanear a PDF** acepta fotos y, en móviles compatibles, acceso directo a cámara.
- **OCR PDF** renderiza cada página y agrega una capa de texto seleccionable mediante Tesseract.js.

### Edición

- **Editar PDF**: agrega texto, una imagen, rectángulo/elipse y dibujo libre sobre una página.
- **Firmar PDF**: firma dibujada con pointer/touch, página, posición y tamaño configurables.
- **Marca de agua**: texto, posición, opacidad y rango de páginas.
- **Números de página**: posición, número inicial y plantilla con `{n}` y `{total}`.
- **Formularios PDF**: detecta y rellena campos interactivos existentes y permite agregar un campo de texto nuevo.

### Seguridad

- **Desbloquear PDF**: con la contraseña correcta, renderiza una copia nueva sin contraseña de apertura.
- **Proteger PDF**: cifra el documento con contraseña usando `pdf-lib-plus-encrypt`.
- **Censurar PDF**: selecciona rectángulos sobre una vista previa y genera una copia rasterizada donde el contenido bajo esas zonas ya no queda oculto detrás de una capa, sino eliminado de la salida visual.

### Optimización y recuperación

- **Comprimir PDF**: niveles Calidad, Equilibrada y Fuerte. Rasteriza páginas para reducir peso, por lo que puede perder enlaces, formularios o texto seleccionable.
- **Reparar PDF**: intenta reescribir la estructura; si falla, recupera visualmente las páginas que el lector pueda renderizar.
- **PDF para archivo**: genera una copia normalizada, sin cifrado y con metadatos consistentes. Es una ayuda práctica para conservación; no se presenta como validación normativa certificada de PDF/A.

### Revisión y automatización

- **Comparar PDF**: compara la misma página de dos PDFs, muestra A/B/diferencia y descarga una imagen de cambios.
- **Flujos**: guarda localmente una secuencia reutilizable de rotación, marca de agua, numeración y compresión. Los presets viven en `localStorage` de este navegador.

## Motores

El núcleo conserva generación local propia para PDF, DOCX, XLSX, ODT, ODS, EPUB, texto, datos e imágenes. Los motores más pesados se cargan únicamente cuando una operación los necesita:

- **pdf-lib**: manipulación, páginas, edición, marcas, firmas, formularios y metadatos.
- **pdf-lib-plus-encrypt**: cifrado con contraseña.
- **PDF.js**: lectura, renderizado, desbloqueo, comparación, recuperación y compresión rasterizada.
- **Tesseract.js**: reconocimiento de texto en OCR PDF.
- **SheetJS**: XLS y XLSB antiguos/binarios.
- **js-yaml**: YAML estructurado.
- **Marked**: Markdown a HTML.
- **docx**: generación Word avanzada e imágenes.
- **PptxGenJS**: generación PPTX.
- **heic2any**: HEIC/HEIF a imagen web.
- **JSZip** vendorizado desde Shot: contenedores Office/OpenDocument/EPUB y ZIP batch.

`convert/engines.mjs` centraliza estas cargas para que abrir la página no descargue todos los motores de una vez.

## Privacidad

Los archivos no se suben a Reynoso Toolchain ni se guardan en GitHub. Las operaciones se ejecutan en el navegador. Los motores bajo demanda son código de librería descargado desde CDN y reciben los datos dentro del proceso local del navegador; Convert no tiene un backend que almacene documentos.

## Límites

- Hasta **100 archivos** por tanda del conversor general.
- Hasta **250 MB por archivo** y **1 GB** agregado en la cola general.
- El procesamiento general es secuencial.
- Operaciones que rasterizan pueden consumir bastante memoria en PDFs enormes.
- El OCR depende del idioma seleccionado y de la calidad del escaneo.
- PDF complejo puede perder enlaces, capas o elementos interactivos al pasar por una operación rasterizada.
- La comparación actual es visual por píxeles de una página a la vez.
- El editor PDF agrega contenido sobre páginas existentes; no intenta reconstruir párrafos originales de un PDF como si fuera un procesador de texto.
- Si una red bloquea un CDN, solo las operaciones que necesitan ese motor muestran error; el resto sigue disponible.

## Arquitectura

- `index.html`: conversor, PDF Studio y diálogo compartido.
- `styles.css`: Liquid Glass y uploader tipo macOS.
- `pdf-tools.css`: tarjetas, filtros, diálogo, firma, comparación, formularios y vista de censura.
- `app.mjs`: cola, normalización, parsers, generadores y descargas del conversor general.
- `pdf-tools.mjs`: registro de 30 herramientas y operaciones PDF.
- `engines.mjs`: librerías cargadas bajo demanda.
- `../shot/vendor/jszip-3.10.2.mjs`: ZIP local compartido.
- `tests/convert-browser.mjs`: regresión real del conversor, PDF Studio e iconografía.

Convert se conserva fuera del generador de placeholders mediante `standaloneReady` en `scripts/generate-toolchain.mjs` y `scripts/build-site.mjs`; así `npm run generate` no pisa la implementación real mientras el catálogo histórico conserva la entrada `convert`.

## Texto a columnas

TXT y LOG detectan tablas separadas por `|`, tabuladores, punto y coma o comas cuando todas las filas tienen el mismo ancho. CSV también reconoce esos separadores. Admite campos entre comillas y conserva las comas dentro de las descripciones al usar `|`. No divide texto común por espacios.

Antes de generar una hoja desde texto, un panel indica el separador detectado y muestra una vista previa. Puede elegir `|`, coma, punto y coma, tabulación, otro carácter o conservar una sola columna. En lotes se revisa cada archivo por separado. Cancelar cierra la revisión sin generar ese archivo.

El XLSX solo organiza las columnas y ajusta sus anchos: no agrega colores, estilos decorativos, filtros ni encabezados fijos. El resultado muestra filas y columnas. Códigos con ceros iniciales, números largos, fechas y fórmulas aparentes se conservan como texto; cantidades simples quedan como números.

También repara XLSX con tablas delimitadas en una sola columna al elegir XLSX como salida. Utiliza la primera hoja; no reconstruye diseños ni hojas adicionales. No divide automáticamente tablas de ancho irregular para evitar desplazar datos.
