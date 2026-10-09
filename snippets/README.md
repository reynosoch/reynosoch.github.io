# Snippets · Reynoso Toolchain

**LISTO** · [Abrir Snippets](https://reynosoch.github.io/snippets/) · [Volver al Toolchain](https://reynosoch.github.io/)

Comandos que no vale la pena memorizar. Una biblioteca de consulta rápida: **buscar → entender → copiar → seguir trabajando**. HTML, CSS y módulos JavaScript nativos; sin backend, cuenta, API ni IA remota.

## Funcionalidades

- Búsqueda local por nombre, comando, explicación, casos de uso, tags, plataforma y tecnología; ignora mayúsculas y acentos, y usa equivalencias sencillas como traer/pull y levantar/iniciar.
- Combobox nativo de tecnología, filtros Todos/Favoritos/Recientes/Más usados y seis accesos de uso frecuente que aprenden de tus copias.
- Cards compactas, detalle en drawer derecho, modal inferior en móvil y diseño Liquid Glass con contraste alto, targets táctiles, focus visible y movimiento reducido.
- Crear, editar y eliminar personalizados; personalizar un incluido crea una copia editable. Eliminar cualquier entrada pide confirmación.
- Comandos multilínea y recetas con un paso por línea. Copiar una receta completa o un paso individual.
- Toast de copia, favoritos persistentes, importación/exportación JSON y restauración de incluidos.
- Ctrl/Cmd + K enfoca la búsqueda. Ctrl/Cmd + Shift + S abre Nuevo snippet si el navegador entrega el atajo a la página; el botón siempre está disponible. Escape cierra el modal activo; los dialogs nativos retienen y devuelven el foco.

## Biblioteca inicial

56 entradas: Git/GitHub (incluidos status, pull, push, diff, staged, log, add, commit, branch, remote, restore, reset y clean), npm/Node, React/Vite, Python, C#/.NET, Java, PowerShell, Windows, Networking, SQL y VS Code. Tres recetas: actualizar después de un push, preparar Python en Windows y revisar antes de un commit. Supabase está disponible como categoría para tus entradas personales; no hay integración con el servicio.

Cada entrada tiene `id`, `name`, `technology`, `type`, `command`, `description`, `useCases`, `tags`, `platform`, `safety`, `favorite`, `usageCount`, `lastUsed`, `createdAt`, `updatedAt` y `custom`. `type` distingue `command`/`recipe`. Los incluidos usan IDs estables `default:*`; los personales, `custom:<UUID>`.

Para agregar defaults, edita `data/default-snippets.mjs`: usa un ID estable y único, explica qué hace y cuándo usarlo, clasifica seguridad/plataforma y añade tags útiles para búsquedas por tarea. `npm run check` valida las definiciones. Las instalaciones existentes pueden incorporar la versión nueva con **Biblioteca → Restaurar snippets incluidos**; no se reponen borrados en cada recarga.

## Almacenamiento y uso

IndexedDB `reynoso-snippets`, versión 1; stores `snippets` (clave `id`) y `meta` (inicialización). Se precarga una sola vez. Cada modificación termina su transacción antes de comunicar éxito. Favoritos y copias usan lectura/modificación en una misma transacción para conservar actualizaciones simultáneas. Al volver a una pestaña se recarga la biblioteca.

Una copia exitosa aumenta `usageCount` en uno y guarda `lastUsed`, también para un paso de receta. Cancelar un destructivo o fallar el clipboard no cuenta. Recientes se deriva de `lastUsed` sin duplicar registros y muestra hasta 20, del más nuevo al más viejo. Más usados muestra entradas copiadas, por contador descendente. Uso frecuente mezcla los más usados con los defaults iniciales hasta seis; al inicio aparecen status, pull, dev, build, code y python app.

Si IndexedDB falla, se muestra el motivo y se permite consultar/copiar los incluidos, con historial temporal; no se simula que los cambios estén guardados. El navegador puede borrar su almacenamiento, y modo privado/políticas corporativas pueden limitarlo: exportar es el respaldo portable. No hay sincronización entre equipos.

## Importar / exportar

Biblioteca → Exportar descarga `reynoso-snippets-YYYY-MM-DD.json`: envoltura `app: "reynoso-snippets"`, `version: 1`, `exportedAt`, `snippets`. Incluye comandos, recetas, favoritos e historial de uso. Importar valida todo antes de guardar: máximo 4 MB/2000 entradas, longitudes limitadas, enums válidos, IDs únicos y recetas con dos o más pasos.

La vista previa muestra cuántas entradas se agregarán, cuántos IDs se reasignarán y cuántos duplicados idénticos se omitirán. No reemplaza datos existentes: una colisión conserva ambas variantes bajo un UUID nuevo. Los incluidos importados distintos se guardan como personalizados para que restaurar no los borre. La escritura es atómica; si otra pestaña introduce una colisión durante el proceso, falla la importación completa en vez de sobrescribir.

**Restaurar snippets incluidos** repone las definiciones iniciales y sus borrados, conservando favoritos/uso de los incluidos que aún existen y todos los personalizados. No hay opción de borrar toda la biblioteca.

## Seguridad

Snippets **no ejecuta comandos**. `safe`, `caution` y `destructive` indican el riesgo del texto incluido. `git clean -fd`, `git restore .`, `git reset --hard HEAD` y detener procesos se marcan destructivos por pérdida potencial; `git clean -nd` solo previsualiza. Pull/push/install tienen precaución por modificar el proyecto o el remoto. El efecto real de scripts dev/build/run depende de tu proyecto.

Antes de copiar cualquier entrada destructiva (incluido un paso de receta), un dialog explica que puede borrar cambios, archivos o datos. Cancelar no copia ni aumenta el contador. Una comprobación conservadora evita bajar a Seguro ciertos patrones conocidos al crear/importar; **no es un analizador universal de shell**. Clasifica tus scripts según sus efectos. Texto personal/importado siempre se escapa al renderizar; no se interpreta como HTML.

## Offline y navegación

Todos los recursos de la app viven dentro de `/snippets/`. El service worker tiene scope `/snippets/` y prefijo de caché `reynoso-snippets-*`. Solo intercepta recursos de su shell y elimina versiones anteriores de su propio prefijo. No toca `/`, Drop, Transcribe ni sus cachés. Una vez completada la instalación, Snippets puede abrirse offline. El worker nuevo espera a que se cierren las pestañas para activar una versión coherente del shell; al cambiar recursos, incrementar la versión de caché.

El header siempre regresa a `../` (Toolchain). La raíz no está cacheada por Snippets y necesita red si no la conserva el navegador. Título estable: `Snippets · Reynoso Toolchain`.

## Estructura

```text
snippets/
  index.html                  Shell accesible, dialogs y formularios
  snippets.css                Liquid Glass y responsive
  app.mjs                     Eventos, clipboard y coordinación de UI
  service-worker.js           Shell offline aislado
  favicon.svg                 Identidad local para offline
  data/default-snippets.mjs   Biblioteca, tecnologías y defaults frecuentes
  lib/model.mjs               Validación, recetas y seguridad
  lib/storage.mjs             IndexedDB y transacciones
  lib/search.mjs              Búsqueda, filtros y ranking
  lib/import-export.mjs       JSON y resolución de colisiones
  lib/ui.mjs                  Cards y detalle con escape de texto
```

## Desarrollo y pruebas

Desde la raíz del repo, con Node 22+:

```sh
npm ci
npm run generate
npm run check
npm run build
python -m http.server 8080
# Abrir http://localhost:8080/snippets/
```

Las dependencias de npm son **solo de pruebas**: fake-indexeddb prueba persistencia/atomicidad y Playwright prueba el navegador; ninguna se descarga en la app. Para la suite de navegador:

```sh
npx playwright install chromium
npm run check:browser
```

`BROWSER_EXECUTABLE_PATH` permite usar un Chromium ya instalado. La suite levanta su servidor temporal y cubre búsqueda, filtros, clipboard, destructivos (cancelar/aceptar), favoritos, recientes, CRUD, recetas, import/export/restauración, atajos, offline, retorno al Toolchain y cuatro tamaños de pantalla; también abre `/`, `/drop/`, `/transcribe/`. Pruebas unitarias están en `tests/snippets.test.mjs`. `check-site` verifica referencias y sintaxis de los módulos locales; `build` incluye la carpeta completa sin README ni tests. El catálogo marca solo Drop, Transcribe y Snippets como LISTO.
