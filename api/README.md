# API Lab · Reynoso Toolchain

**EN DESARROLLO** · [Abrir página](https://reynosoch.github.io/api/) · [Volver al Toolchain](https://reynosoch.github.io/)

Preparar y ejecutar peticiones HTTP desde una interfaz pequeña en el navegador.

## Alcance previsto

- GET, POST, PUT, PATCH y DELETE
- Headers, cuerpo JSON e historial
- Respuesta legible y copiar cURL

## Ejemplos

- Probar un endpoint GET y revisar su respuesta.
- Preparar headers y JSON para una petición POST.

Al implementarse, las peticiones desde navegador dependerán de los permisos CORS del servidor. No podrán saltarse esas restricciones.

## Desarrollo

Este es un placeholder; todavía no realiza procesamiento. No cargar librerías ni guardar datos de esta herramienta antes de implementarla. El HTML y este README se generan desde `shared/catalog.mjs` con `npm run generate`. Leer el README raíz y AGENT_CONTEXT antes de modificar. Mantener URL `/api/`, título de favoritos, navegación al landing y aislamiento de cualquier futuro service worker.
