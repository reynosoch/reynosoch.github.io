# SQL Lab · Reynoso Toolchain

**EN DESARROLLO** · [Abrir página](https://reynosoch.github.io/sql/) · [Volver al Toolchain](https://reynosoch.github.io/)

Analizar datasets localmente con SQLite o DuckDB WASM, sin montar un servidor.

## Alcance previsto

- Importar CSV y Excel
- SELECT, GROUP BY, JOIN y filtros
- Exportar resultados de consultas

## Ejemplos

- SELECT localidad, SUM(cantidad) FROM inventario GROUP BY localidad;
- Cruzar dos archivos por número de parte.

## Desarrollo

Este es un placeholder; todavía no realiza procesamiento. No cargar librerías ni guardar datos de esta herramienta antes de implementarla. El HTML y este README se generan desde `shared/catalog.mjs` con `npm run generate`. Leer el README raíz y AGENT_CONTEXT antes de modificar. Mantener URL `/sql/`, título de favoritos, navegación al landing y aislamiento de cualquier futuro service worker.
