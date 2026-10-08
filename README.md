# Reynoso · Herramientas

Todas las herramientas nuevas vivirán en este repositorio, cada una en su carpeta. La raíz es la portada con accesos directos.

## Abrir en GitHub Pages

| Página | Acceso directo | Código / documentación |
| --- | --- | --- |
| **Centro de herramientas** | **[Abrir portada](https://reynosoch.github.io/)** | [`index.html`](index.html) |
| **Reynoso Drop** | **[Abrir Drop](https://reynosoch.github.io/drop/)** | [`drop/`](drop/) · [README](drop/README.md) |
| **Reynoso Transcribe** | **[Abrir Transcribe](https://reynosoch.github.io/transcribe/)** | [`transcribe/`](transcribe/) · [README](transcribe/README.md) |

### Drop

Transfiere texto, código, fotos y archivos entre dispositivos. Código de cuatro números, QR, escáner con cámara, pegado desde el portapapeles, envío de textos grandes como TXT y validación SHA-256. Se puede instalar en iPad; conserva metadatos de sesión localmente y la bandeja permanece temporal. WebRTC con PeerJS; sin base de datos de archivos.

### Transcribe

Convierte audio y voz de micrófono en texto con Whisper; extrae texto de fotos y capturas con Tesseract. Mejora opcional para voz baja, selección de canal, texto editable, copia, TXT y SRT. Procesa archivos localmente y descarga los modelos la primera vez.

## Organización

```text
index.html          Portada de herramientas
hub.css             Estilos de la portada
drop/               Drop completo: app, PWA, librerías, pruebas y documentación
transcribe/         Transcripción de audio y OCR de imágenes
scripts/            Validación de rutas y build conjunto
.github/workflows/  Verify main
```

Los archivos antiguos de SmartFit y los artefactos .NET se retiraron de la versión actual. Permanecen recuperables en el historial de Git.

Drop se trasladó desde `reynosoch/reynoso-drop`, commit `d74c31e`, versión 1.7. La versión 1.7.1 en este repositorio conserva su funcionalidad y limita la caché PWA a su propia carpeta para no borrar ni interceptar recursos de Transcribe u otras herramientas. El repositorio anterior se conserva como respaldo; **las siguientes mejoras de Drop se hacen aquí, en `drop/`**.

## Validación y publicación

No requiere instalar paquetes: ambas herramientas y la portada son estáticas.

```sh
npm run check
npm run build
```

`check` ejecuta la suite de Drop (incluida separación de cachés y scope del service worker), pruebas de audio / SRT de Transcribe, sintaxis y rutas de ambas herramientas. `build` produce `dist/` con la portada, `drop/` y `transcribe/`.

**GitHub Pages publica `main / (root)`**, con `.nojekyll` para servir archivos estáticos. `dist/` es una salida de validación y no se sube al repositorio. El workflow **Verify main** valida y compila en cada push; el despliegue Pages existente publica el código de `main`.

## AGENT_CONTEXT

- Este repositorio es el centro de herramientas personales de Reynoso. Trabajar en `main` y hacer commit/push cuando se soliciten cambios. Leer este README y el de la herramienta antes de modificarla.
- Una carpeta por herramienta: URLs `https://reynosoch.github.io/<herramienta>/`. Mantener rutas relativas, QR, manifiestos y PWA dentro de la carpeta correspondiente.
- Toda herramienta nueva debe incluir su README, acceso directo a Pages en esta tabla y enlace en la portada. No crear un repositorio adicional salvo petición explícita.
- Conservar funciones de Drop y Transcribe; no simplificar eliminando flujos, pruebas, dependencias vendorizadas ni licencias.
- Service workers y cachés deben estar aislados por herramienta y scope. Nunca borrar cachés ajenas ni registrar un service worker con scope global.
- No subir archivos personales, transferidos o transcritos. Drop no usa base de datos remota; Transcribe no necesita claves ni cuentas.
- Ejecutar `npm run check` y `npm run build`, revisar Verify main y Pages al publicar, y documentar los cambios en el README correspondiente.
