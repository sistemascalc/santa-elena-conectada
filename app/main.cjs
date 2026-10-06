'use strict';
const {app, BrowserWindow, Menu, dialog, session, nativeImage, ipcMain, shell} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const config = require('./config.cjs');
const {sameOrigin, allowedRequest, safeFilename} = require('./policy.cjs');
const {startUpdates, RELEASES} = require('./updates.cjs');
const buildInfo = require('./build-info.json');

app.setName(config.name);
app.setAppUserModelId('org.santaelena.conectada');
// Stable and distinct from both the old demo and the browser's profile.
const profile = path.join(app.getPath('appData'), config.profile);
fs.mkdirSync(profile, {recursive: true, mode: 0o700});
app.setPath('userData', profile);
app.enableSandbox();
const fallback = pathToFileURL(path.join(__dirname, 'offline.html')).href;
let win, loading = false, updates;

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
  app.whenReady().then(start).catch(error => { dialog.showErrorBox('Santa Elena no pudo iniciar', error.message); app.quit(); });
}

async function loadSystem() {
  if (loading || !win || win.isDestroyed()) return;
  loading = true;
  try { await win.loadURL(config.origin + '/'); }
  catch { if (!win.isDestroyed()) await win.loadFile(path.join(__dirname, 'offline.html')); }
  finally { loading = false; }
}

function website() { return win && !win.isDestroyed() && sameOrigin(win.webContents.getURL(), config.origin); }
async function route(hash) {
  if (!website()) await loadSystem();
  if (website()) await win.webContents.executeJavaScript('location.hash=' + JSON.stringify(hash));
}
async function refreshData() {
  if (!website()) return loadSystem();
  // Use the application's own refresh action, preserving its cart and avoiding an open form.
  const updated = await win.webContents.executeJavaScript(`(() => {
    if (document.querySelector('dialog[open]')) return 'form';
    const control = document.querySelector('[data-action="refresh"]');
    if (!control) return 'none'; control.click(); return 'done';
  })()`);
  if (updated === 'form') dialog.showMessageBox(win, {type:'info', message:'Termina o cierra la captura abierta antes de actualizar los datos.'});
  else if (updated === 'none') await loadSystem();
}

async function start() {
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((contents, permission, callback) => {
    callback(contents === win?.webContents && sameOrigin(contents.getURL(), config.origin) && permission === 'persistent-storage');
  });
  ses.setPermissionCheckHandler((contents, permission, origin) =>
    contents === win?.webContents && sameOrigin(origin, config.origin) && permission === 'persistent-storage');
  ses.webRequest.onBeforeRequest((details, callback) => {
    const bundled = details.url.startsWith(pathToFileURL(__dirname + path.sep).href);
    callback({cancel: !(allowedRequest(details.url, config.origin) || bundled || details.url.startsWith('data:'))});
  });
  ses.on('will-download', (event, item, contents) => {
    if (contents !== win?.webContents || !website() || !allowedRequest(item.getURL(), config.origin)) { event.preventDefault(); return; }
    item.setSaveDialogOptions({title:'Guardar archivo de Santa Elena', defaultPath:path.join(app.getPath('downloads'), safeFilename(item.getFilename()))});
    item.once('done', (_event, state) => {
      if (state === 'interrupted' && win && !win.isDestroyed()) dialog.showMessageBox(win, {type:'error', message:'No se completó la descarga.', detail:'Comprueba la conexión y el espacio disponible. Puedes volver a descargar el respaldo o archivo.'});
    });
  });
  win = new BrowserWindow({
    width:1320, height:900, minWidth:860, minHeight:600, show:false,
    title:config.name, backgroundColor:'#f0f5f9', icon:path.join(__dirname,'logo.png'),
    webPreferences:{preload:path.join(__dirname,'preload.cjs'), nodeIntegration:false,
      nodeIntegrationInWorker:false, contextIsolation:true, sandbox:true, webSecurity:true,
      allowRunningInsecureContent:false, webviewTag:false, devTools:false, spellcheck:true},
  });
  if (process.platform === 'darwin') app.dock.setIcon(nativeImage.createFromPath(path.join(__dirname,'logo.png')));
  win.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  for (const eventName of ['will-navigate', 'will-redirect']) win.webContents.on(eventName, (event, url) => {
    if (!sameOrigin(url, config.origin)) event.preventDefault();
  });
  win.webContents.on('will-attach-webview', event => event.preventDefault());
  win.webContents.on('dom-ready', () => {
    if (website()) win.webContents.insertCSS('#install-app{display:none!important}').catch(() => {});
  });
  win.webContents.on('page-title-updated', event => { event.preventDefault(); win.setTitle(config.name); });
  win.webContents.on('render-process-gone', () => {
    dialog.showMessageBox(win, {type:'error', message:'La pantalla se cerró inesperadamente.', detail:'Vuelve a abrir el sistema desde el menú Sistema. Las ventas guardadas en este equipo se conservan.'});
  });
  ipcMain.handle('santa:retry', event => {
    if (event.sender !== win?.webContents || event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url !== fallback) throw Error('Solicitud no permitida');
    return loadSystem();
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate(menu()));
  win.once('ready-to-show', () => win.show());
  await loadSystem();
  win.show();
  updates = startUpdates(app, {macSigned:buildInfo.macSigned, onState:state => {
    const item=Menu.getApplicationMenu()?.getMenuItemById('update-state');
    if(item)item.label=state.status==='ready'?'Actualización lista para instalar al salir':state.status==='manual'?'Nueva versión disponible para Mac':'Estado de las actualizaciones';
  }});
}

async function showUpdates(check=false) {
  if(!updates)return info('Actualizaciones','El sistema está iniciando. Intenta nuevamente en unos segundos.');
  const state=check?await updates.check():updates.getState();
  const result=await dialog.showMessageBox(win,{type:'info',message:'Santa Elena · '+app.getVersion(),detail:state.message,buttons:state.status==='manual'?['Abrir descargas','Cerrar']:['Cerrar'],cancelId:state.status==='manual'?1:0});
  if(state.status==='manual'&&result.response===0)await shell.openExternal(RELEASES);
}

function info(message, detail) { return dialog.showMessageBox(win, {type:'info', message, detail}); }
function menu() {
  const about = () => info(config.name + ' · ' + config.version,
    'Conectada al sistema parroquial:\n' + config.origin + '\n\nUsa tus usuarios y permisos habituales. Los equipos consultan la misma base de datos. Para ver cambios recientes, pulsa Actualizar datos.\n\nLas mejoras del sitio llegan al volver a abrir la aplicación. Windows descarga versiones nuevas desde GitHub y las instala al salir. En Mac, la instalación automática requiere firma de Apple.');
  return [
    ...(process.platform === 'darwin' ? [{label:'Santa Elena', submenu:[{label:'Acerca de Santa Elena', click:about}, {type:'separator'}, {role:'quit', label:'Salir de Santa Elena'}]}] : []),
    {label:'Sistema', submenu:[
      {label:'Inicio', click:() => route('inicio')},
      {label:'Ventas', accelerator:'CmdOrCtrl+1', click:() => route('ventas')},
      {label:'Agenda', accelerator:'CmdOrCtrl+2', click:() => route('agenda')},
      {label:'Intenciones', accelerator:'CmdOrCtrl+3', click:() => route('intenciones')},
      {label:'Cuotas', click:() => route('ventas-cuotas')},
      {label:'Ventas pendientes de este equipo', click:() => route('ventas-pendientes')},
      {label:'Respaldo general', click:() => route('respaldos')},
      {type:'separator'},
      {label:'Actualizar datos', accelerator:'CmdOrCtrl+R', click:refreshData},
      {label:'Reintentar conexión', click:loadSystem},
      {type:'separator'}, {role:'quit', label:'Salir'},
    ]},
    {label:'Edición', submenu:[{role:'undo',label:'Deshacer'}, {role:'redo',label:'Rehacer'}, {type:'separator'}, {role:'cut',label:'Cortar'}, {role:'copy',label:'Copiar'}, {role:'paste',label:'Pegar'}, {role:'selectAll',label:'Seleccionar todo'}]},
    {label:'Vista', submenu:[{role:'resetZoom',label:'Tamaño original'}, {role:'zoomIn',label:'Acercar'}, {role:'zoomOut',label:'Alejar'}, {role:'togglefullscreen',label:'Pantalla completa'}]},
    {label:'Impresión', submenu:[{label:'Impresoras disponibles', click:async () => {
      const printers = await win.webContents.getPrintersAsync();
      info('Impresoras de esta computadora', printers.length ? printers.map(p => (p.displayName || p.name) + (p.isDefault ? ' (predeterminada)' : '')).join('\n') + '\n\nSelecciona Imprimir recibo en la venta. El cuadro del sistema permite elegir la impresora.' : 'No se encontraron impresoras. Instala la impresora desde la configuración de Windows o Mac.');
    }}, {label:'Formato del recibo', click:() => info('Recibos de Santa Elena', 'Papel de 80 mm, recibo de 72 mm y margen interior de 1 mm. Usa escala 100 % y verifica el resultado con tu impresora. Para imprimir, abre el recibo y pulsa Imprimir recibo.')} ]},
    {label:'Ayuda', submenu:[{label:'Buscar actualizaciones',click:()=>showUpdates(true)},
      {id:'update-state',label:'Estado de las actualizaciones',click:()=>showUpdates(false)},
      {type:'separator'},
      {label:'Conectar una tablet', click:() => info('El mismo sistema en tu tablet', config.origin + '\n\nAndroid: abre el enlace en Chrome y elige Instalar o Agregar a pantalla principal.\niPad: abre el enlace en Safari y elige Compartir → Agregar a inicio.\n\nInicia sesión con un usuario autorizado de la parroquia. No se necesita mantener esta computadora encendida.')},
      {label:'Trabajo sin internet', click:() => info('Ventas sin conexión', 'Abre la aplicación con internet, inicia sesión y abre tu caja. Espera a que indique que el dispositivo está preparado.\n\nLas ventas pendientes se guardan en este equipo y se envían al recuperar la conexión. Revisa Ventas pendientes antes de cerrar caja o cambiar de equipo. Los conflictos de horarios, cupos o saldos requieren revisión.\n\nUna sesión vencida necesita internet. No se sincronizan equipos mientras todos están sin conexión. No borres los datos de la aplicación si hay ventas pendientes.')},
      {label:'Acerca de Santa Elena', click:about}]},
  ];
}
app.on('certificate-error', (event, _contents, _url, _error, _certificate, callback) => { event.preventDefault(); callback(false); });
app.on('window-all-closed', () => app.quit());
