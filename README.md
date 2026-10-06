# Santa Elena de la Cruz

Aplicación Electron para Windows y Mac conectada al sistema parroquial existente.

- [Descargar la última versión](https://github.com/sistemascalc/santa-elena-conectada/releases/latest)
- [Abrir el sistema en una tablet](https://santa-elena-de-la-cruz.sistemascacl.chatgpt.site/)

Este repositorio contiene solamente el cliente, su logotipo y la compilación. No contiene usuarios, contraseñas, ventas, intenciones ni bases de datos. Inicia sesión con tu cuenta habitual.

## Actualizaciones

Windows busca nuevas versiones 15 segundos después de abrir y cada 4 horas. Descarga en segundo plano e instala al salir, sin reiniciar mientras se atiende una venta. También existe **Ayuda → Buscar actualizaciones**.

La versión anterior 1.0.0 no contenía un actualizador: instala una vez el nuevo `.exe` publicado aquí. Desde esta versión se conservan sesión y ventas pendientes en `%APPDATA%\Santa Elena Conectada`.

En Mac sin firma de Apple se comprueban versiones y se ofrece abrir la descarga. La instalación automática se habilita únicamente al compilar con certificado y notarización válidos. El perfil sigue en `~/Library/Application Support/Santa Elena Conectada`.

Las tablets usan la aplicación web instalable. Las mejoras de los módulos proceden del sitio; las nuevas versiones de Electron proceden de este repositorio.

## Publicar una nueva versión

1. Cambia el código del cliente.
2. Incrementa la versión en `package.json`, `package-lock.json`, `app/package.json` y `app/config.cjs`.
3. Ejecuta `npm test`.
4. Sube el cambio a `main`.

GitHub Actions compila Windows y ambas arquitecturas de Mac y publica una Release únicamente si ambas compilaciones terminan correctamente. Incluye los instaladores, `latest.yml`, `latest-mac.yml`, mapas de bloques y sumas SHA-256. Si esa versión ya existe, no reemplaza sus archivos: incrementa la versión para otra publicación.

Para una nueva publicación después de modificar solo los certificados, incrementa también la versión. No subas certificados al repositorio.

## Firma opcional mediante GitHub Secrets

- Windows: `WIN_CSC_LINK` y `WIN_CSC_KEY_PASSWORD`.
- Mac: `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` y `APPLE_TEAM_ID`.

Los enlaces de certificado aceptan la codificación que admite electron-builder. Guarda los secretos en GitHub, nunca en el código ni en la aplicación. Sin ellos se generan paquetes sin firma reconocida y pueden aparecer avisos del sistema operativo. Las cuentas y certificados del titular son necesarios para firmar la distribución.

## Desarrollo

Requiere Node.js 24 y npm.

```sh
npm ci
npm test
npm start
```

```sh
npm run build:win
npm run build:mac
```

Compila Windows en Windows y Mac en macOS, como hace el flujo de GitHub Actions. El paquete incluye únicamente `app/` y sus dependencias de producción.

## Datos y operación sin internet

Los equipos consultan el mismo servidor por HTTPS. Usa **Actualizar datos** para ver cambios de otros equipos. Antes de trabajar sin internet, inicia sesión y abre caja con conexión, y espera el aviso de preparación del dispositivo. Las ventas pendientes se envían al reconectar; los conflictos de cupo, horario, precio o saldo requieren revisión. No borres el perfil si hay ventas pendientes.

Actualizar la aplicación no ejecuta migraciones ni reemplaza el servidor de la parroquia.

## Impresoras por apartado (1.2.0)

En Ventas, Agenda o Intenciones pulsa **Seleccionar impresora**, o abre **Impresión → Seleccionar impresoras por apartado**. Guarda la impresora de tickets y otra para las hojas de Agenda e Intenciones. La elección se guarda en `printers.json` dentro del perfil local de cada computadora. Se usan los nombres de dispositivo del sistema; si falta la impresora elegida, se avisa y no se envía a otra.

Tickets: rollos de 80 o 58 mm, contenido de 76 mm en rollo de 80 mm (2 mm por lado), o 48 mm en rollo de 58 mm centrado para respetar el área física de impresión, sin márgenes de página, con alto ajustado al contenido y logotipo compacto. Hojas: Carta o A4, con 8 mm interiores. El controlador debe tener instalado el tamaño correcto del rollo y la opción de corte automático si la impresora lo admite. No se ha probado físicamente cada modelo. Las preferencias son de la app de escritorio; las tablets usan la impresión del navegador.

Los documentos se copian a una ventana de impresión aislada, sin controles de la aplicación. Solo el origen autorizado y el marco principal pueden solicitar impresión. Las ventanas de ajustes tienen un puente separado.
