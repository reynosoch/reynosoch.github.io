# Convert · Reynoso Toolchain

**LISTO (implementación standalone)** · [Abrir Convert](https://reynosoch.github.io/convert/) · [Volver al Toolchain](https://reynosoch.github.io/)

Convert es el conversor general de archivos de Reynoso Toolchain. La interfaz usa una ventana tipo macOS inspirada en Reynoso LAB y permite cargar archivos sueltos, varias selecciones, carpetas completas y capturas pegadas. La cola procesa los elementos de forma secuencial para mantener el uso de memoria bajo control.

## Flujo

1. Arrastra archivos a la ventana, selecciónalos o abre una carpeta.
2. Elige el formato de salida.
3. Convert normaliza el contenido a texto, tabla, documento, PDF o imagen.
4. Genera el formato elegido.
5. Descarga el resultado individual o un ZIP con toda la tanda.

## Entradas

### Documentos y Office

- PDF
- DOCX
- XLSX
- XLS y XLSB mediante SheetJS bajo demanda
- PPTX
- ODT
- ODS
- EPUB

### Datos

- CSV
- TSV
- JSON
- JSONL / NDJSON
- YAML / YML
- XML
- TOML y archivos de configuración como texto

### Texto y código

TXT, Markdown, HTML, RTF, LOG, SQL, JavaScript, TypeScript, JSX, TSX, CSS, SCSS, Sass, Less, Python, Java, C/C++, headers, C#, Go, Rust, PHP, Ruby, Shell, PowerShell, BAT/CMD, LaTeX, INI, CFG, CONF, ICS y VCF.

### Imágenes

- PNG
- JPG / JPEG
- WebP
- GIF
- BMP
- SVG
- AVIF
- HEIC / HEIF mediante heic2any bajo demanda

## Salidas

- PDF
- DOCX
- XLSX
- PPTX
- ODT
- ODS
- EPUB
- CSV
- TSV
- TXT
- Markdown
- HTML
- JSON
- XML
- YAML
- RTF
- PNG
- JPG
- WebP
- SVG

No todas las conversiones pueden conservar exactamente el mismo significado visual. Por ejemplo, una hoja de cálculo convertida a Word se representa como tabla y un PDF convertido a imagen renderiza su contenido; Convert nunca finge una conversión cambiando únicamente la extensión.

## Motores

El núcleo conserva generación local propia para PDF, DOCX, XLSX, ODT, ODS, EPUB, texto, datos e imágenes. Los motores pesados se cargan únicamente cuando una ruta los necesita:

- **PDF.js**: leer y renderizar PDFs.
- **SheetJS**: XLS y XLSB antiguos/bi­narios.
- **js-yaml**: YAML estructurado.
- **Marked**: Markdown → HTML.
- **docx**: incrustar imágenes en documentos Word.
- **PptxGenJS**: generar presentaciones PPTX.
- **heic2any**: HEIC/HEIF → imagen web.
- **pdf-lib**: disponible para operaciones PDF avanzadas posteriores.
- **JSZip** vendorizado desde Shot: contenedores Office/OpenDocument/EPUB y ZIP batch.

`convert/engines.mjs` centraliza estas cargas para que la página no descargue librerías grandes al abrirse.

## Privacidad

Los archivos no se suben a Reynoso Toolchain ni se guardan en GitHub. Las conversiones base ocurren en el navegador. Los motores bajo demanda son código de librería descargado desde CDN; reciben el archivo únicamente dentro del navegador y no existe un backend de Convert que almacene documentos.

## Límites

- Hasta **100 archivos** por tanda.
- Hasta **250 MB por archivo**.
- Hasta **1 GB** agregado en la cola.
- El procesamiento es secuencial.
- Office complejo prioriza contenido y estructura sobre fidelidad pixel-perfect.
- PDF → imagen actualmente renderiza la primera página por resultado individual.
- Macros, SmartArt, fórmulas avanzadas, fuentes embebidas y diseños complejos pueden perderse al pasar a otro formato.
- Si una red corporativa bloquea un CDN, solo las rutas que necesitan ese motor muestran error; las conversiones base siguen funcionando.

## Arquitectura

- `index.html`: interfaz, ventana de carga y selector de salidas.
- `styles.css`: Liquid Glass + uploader tipo macOS inspirado en LAB.
- `app.mjs`: cola, normalización, parsers, generadores y descargas.
- `engines.mjs`: librerías de conversión cargadas bajo demanda.
- `../shot/vendor/jszip-3.10.2.mjs`: ZIP local compartido.
- `tests/convert-browser.mjs`: regresión real de navegador para interfaz y archivos generados.

Convert se conserva fuera del generador de placeholders mediante `standaloneReady` en `scripts/generate-toolchain.mjs` y `scripts/build-site.mjs`; así `npm run generate` no pisa la implementación real mientras el catálogo histórico conserva la entrada `convert`.
