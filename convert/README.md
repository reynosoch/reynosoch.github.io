# Convert · Reynoso Toolchain

**LISTO (implementación standalone)** · [Abrir Convert](https://reynosoch.github.io/convert/) · [Volver al Toolchain](https://reynosoch.github.io/)

Convert es el conversor de archivos de Reynoso Toolchain: documentos, hojas, imágenes y texto entran en una misma cola y pueden salir como PDF, DOCX, XLSX, CSV, TXT, HTML, JSON, PNG, JPG o WebP según el contenido disponible.

## Flujo

1. Arrastra, selecciona o pega archivos.
2. Elige un formato de salida.
3. Convierte uno o varios archivos.
4. Descarga cada resultado o un ZIP con todos.

## Entradas

- PDF
- DOCX
- XLSX y XLS moderno basado en XML (XLS binario antiguo requiere guardarse como XLSX o CSV)
- CSV y TSV
- TXT, Markdown, HTML, JSON, XML, YAML, LOG y RTF básico
- ODT, ODS y PPTX mediante lectura de su XML interno
- PNG, JPG/JPEG, WebP, GIF y BMP

## Salidas

- PDF
- DOCX
- XLSX
- CSV
- TXT
- HTML
- JSON
- PNG
- JPG
- WebP

## Privacidad y motores

El procesamiento principal ocurre en el navegador. Los archivos no se suben a Reynoso Toolchain ni se guardan en GitHub. DOCX/XLSX/ODT/ODS/PPTX usan ZIP/XML local y JSZip vendorizado desde Shot. Las conversiones que necesitan leer el contenido interno de un PDF usan PDF.js desde jsDelivr; si una red corporativa bloquea ese CDN, esas conversiones muestran un error explícito sin afectar el resto del motor.

## Límites actuales

- La lectura XLSX toma la primera hoja.
- Los formatos Office complejos se convierten priorizando contenido y estructura básica, no fidelidad pixel-perfect.
- XLS binario antiguo (`.xls`) no se interpreta todavía.
- PDF → contenido editable depende de PDF.js.
- Convert no reemplaza LibreOffice/Word/Excel para macros, fórmulas avanzadas, SmartArt, fuentes embebidas o layouts complejos.

## Arquitectura

- `index.html`: interfaz y selector de formatos.
- `styles.css`: layout Liquid Glass responsive.
- `app.mjs`: cola, parsers y generadores locales.
- `../shot/vendor/jszip-3.10.2.mjs`: ZIP local reutilizado para Office y descargas batch.

Convert se conserva fuera del generador de placeholders mediante `standaloneReady` en `scripts/generate-toolchain.mjs` y `scripts/build-site.mjs`; así `npm run generate` no pisa la implementación real mientras el catálogo histórico todavía conserva la entrada `convert`.
