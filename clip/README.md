# Clip · Reynoso Toolchain

**LISTO** · [Abrir Clip](https://reynosoch.github.io/clip/) · [Volver al Toolchain](https://reynosoch.github.io/)

Editor de video ligero y extractor de fotogramas clave en el navegador. Diseñado para recortar segmentos, ajustar velocidad, orientar tomas y obtener de inmediato el primer y último fotograma en alta resolución para flujos continuos de generación y extensión de secuencias.

## Funcionalidades principales

- **Extracción de fotogramas clave de continuidad**:
  - **Primer fotograma**: visualización, copia directa al portapapeles y descarga individual en PNG nativo.
  - **Último fotograma**: visualización, copia y descarga individual en PNG de alta resolución.
  - **Pack de continuidad**: descarga combinada de inicio y fin en un solo clic para suministrar a modelos generadores de video y herramientas de interpolación.
  - **Fotograma en cualquier posición**: copia al portapapeles o descarga de cualquier instante del video con el cabezal de reproducción.
- **Recorte preciso (Trim)**:
  - Fijación de puntos de inicio (`[`) y fin (`]`) con previsualización del rango en la línea de tiempo.
  - Campos numéricos editables en segundos con cálculo de duración del segmento seleccionado.
- **Transporte y control fino**:
  - Paso fotograma por fotograma hacia adelante y hacia atrás (precisión de ~1/30 s).
  - Selector de velocidad de reproducción (0.25x, 0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x).
  - Repetición en bucle (loop) dentro del rango de corte delimitado.
  - Silenciado de audio y control de volumen.
- **Orientación y encuadre**:
  - Rotación en pasos de 90° (0°, 90°, 180°, 270°).
  - Volteo horizontal (modo espejo).
- **Exportación local de video**:
  - Grabación y descarga del segmento recortado y transformado en formato WebM directamente en el navegador, sin subir archivos a ningún servidor.

## Atajos de teclado

| Atajo | Acción |
| --- | --- |
| `Espacio` | Reproducir / Pausar video |
| `←` / `→` | Retroceder / Avanzar 1 fotograma |
| `[` | Fijar punto de inicio de corte en la posición actual |
| `]` | Fijar punto de fin de corte en la posición actual |
| `C` | Copiar fotograma actual al portapapeles |
| `1` | Saltar al primer fotograma |
| `2` | Saltar al último fotograma |

## Privacidad y procesamiento client-side

Clip opera al 100% en el dispositivo del usuario mediante las APIs nativas de HTML5 Video, Canvas 2D, MediaStream y MediaRecorder. Ningún archivo de video ni fotograma se envía a redes externas ni servidores.
