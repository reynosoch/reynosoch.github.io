# Brief · Reynoso Toolchain

[Abrir Brief](https://reynosoch.github.io/brief/) · [Toolchain](https://reynosoch.github.io/)

Transforma notas de reuniones y revisiones visuales en un encargo de trabajo: objetivo, situación actual, cambios, restricciones, evidencia, criterios de aceptación y entrega.

## Uso

1. Cree un borrador y escriba el objetivo.
2. Complete los cambios; puede pegar las notas copiadas de Shot. Referencie las capturas por su nombre y adjúntelas por separado al compartir.
3. Seleccione una plantilla opcional: mejora visual, problema, reunión o entrega. Una confirmación protege los campos existentes.
4. Revise la vista previa, copie el encargo o descargue Markdown.

Hasta 30 borradores; duplicación, eliminación confirmada y respaldo JSON de hasta 1 MB. Importar agrega copias independientes sin sobrescribir los borradores existentes. El objetivo es necesario para exportar el encargo. Los demás campos vacíos se omiten, sin inventar requisitos. Los criterios se exportan como una lista verificable.

## Privacidad y límites

Los borradores se guardan automáticamente como texto **sin cifrar** en localStorage `reynoso-brief:v1`. No se envían a un servidor. Evite contraseñas y datos sensibles en equipos compartidos. No es un almacenamiento permanente: exporte un respaldo. Si el navegador bloquea el almacenamiento, los cambios quedan en la sesión y se informa que requieren descarga. El respaldo contiene todo el texto; revise dónde se conserva o comparte.

No interpreta notas ni procesa imágenes; construye el texto con los campos suministrados. No ejecuta instrucciones, tareas o comandos. Una modificación de otra pestaña sincroniza los borradores; evite editar el mismo encargo simultáneamente. No hay dependencias externas ni recursos descargados bajo demanda.

`model.mjs` valida el respaldo y genera el encargo. `app.mjs` mantiene edición, almacenamiento, importación y exportación. `styles.css` adapta el sistema visual a una mesa de redacción con lista de borradores y vista previa.
