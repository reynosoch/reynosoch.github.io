# Jot · Reynoso Toolchain

**LISTO** · [Abrir Jot](https://reynosoch.github.io/jot/) · [Volver al Toolchain](https://reynosoch.github.io/)

Jot es una libreta diaria inspirada en el flujo de notas rápidas: notas de texto, listas, etiquetas, colores, fijadas, archivo, papelera, búsqueda y vista en cuadrícula o lista. La interfaz usa el lenguaje Liquid Glass del Toolchain con una ventana de escritorio tipo macOS.

## Acceso y privacidad

Jot no contiene una contraseña en el repositorio. En el primer uso del navegador se crea una bóveda local: el campo de usuario propone `admin`, pero la contraseña se escribe en ese momento y nunca se guarda como texto ni se publica en GitHub.

La contraseña deriva una clave AES-GCM de 256 bits mediante PBKDF2/SHA-256 con salt aleatorio y 220,000 iteraciones. El verificador y cada nota se cifran por separado con IV aleatorio. La clave descifrada vive únicamente en memoria mientras Jot está desbloqueado.

Los datos se guardan en IndexedDB `reynoso-jot` del navegador. No existe backend, cuenta remota ni sincronización automática entre dispositivos. Si se pierde la contraseña no existe recuperación automática.

## Funciones

- notas de texto y checklists;
- autosave local cifrado;
- fijar, archivar, restaurar, papelera y borrado definitivo;
- etiquetas separadas por coma;
- seis tonos discretos para diferenciar tarjetas;
- búsqueda por título, contenido, checklist y etiquetas;
- cuadrícula tipo notas rápidas o vista de lista;
- exportación de bóveda cifrada en JSON;
- importación de respaldo para mover la bóveda manualmente a otro navegador;
- bloqueo manual que elimina la clave de la sesión y vuelve a pedir acceso;
- atajos: `Ctrl/Cmd + N` crea nota y `Ctrl/Cmd + Shift + N` crea checklist.

## Primer uso

1. Abre `/jot/`.
2. Deja `admin` como usuario si quieres conservar ese acceso.
3. Escribe tu contraseña local y confírmala. La clave elegida existe únicamente en tu dispositivo y no forma parte del código del sitio.
4. Crea notas normalmente. Jot pide al navegador almacenamiento persistente cuando es posible.
5. Usa **Exportar** para conservar un respaldo cifrado si vas a cambiar de equipo o navegador.

## Límites

Jot es almacenamiento local del navegador, no un servicio de sincronización. Borrar los datos del sitio, usar limpieza corporativa del navegador o perder el perfil puede borrar la bóveda si no existe un respaldo. El cifrado protege el contenido almacenado, pero no sustituye un gestor de contraseñas ni un sistema empresarial para secretos críticos.

No guardar credenciales corporativas, llaves privadas, tokens, información regulada o secretos de alto impacto. El objetivo es notas cotidianas, pendientes, recordatorios personales, escuela y trabajo no sensible.

## Archivos

- `index.html`: shell, acceso local y workspace.
- `styles.css`: ventana tipo macOS y responsive móvil/tablet.
- `crypto.mjs`: derivación de clave, cifrado y descifrado.
- `store.mjs`: IndexedDB, respaldo e importación.
- `app.mjs`: notas, listas, filtros, autosave y UI.
- `tests/jot-browser.mjs`: prueba de configuración, cifrado, persistencia, bloqueo y respaldo.
