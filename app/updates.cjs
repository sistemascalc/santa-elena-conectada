'use strict';
const fs = require('node:fs');
const path = require('node:path');
const RELEASES = 'https://github.com/sistemascalc/santa-elena-conectada/releases/latest';
const API = 'https://api.github.com/repos/sistemascalc/santa-elena-conectada/releases/latest';

function newerVersion(tag, current) {
  const parse = v => /^v?(\d+)\.(\d+)\.(\d+)$/.exec(v || '')?.slice(1).map(Number);
  const next = parse(tag), before = parse(current);
  if (!next || !before) return false;
  for (let i=0;i<3;i++) { if (next[i] !== before[i]) return next[i] > before[i]; }
  return false;
}

function startUpdates(app, options = {}) {
  const platform = options.platform || process.platform;
  let state = {status:'idle', version:app.getVersion(), message:'Sin comprobaciones todavía.'};
  let updater, checking = false, disposed = false;
  const logFile = path.join(app.getPath('userData'), 'updates.log');
  const changed = () => options.onState?.({...state});
  const set = (status, message, version=state.version) => { state={status,message,version}; changed(); };
  const log = message => {
    try {
      if (fs.existsSync(logFile) && fs.statSync(logFile).size > 512*1024) fs.renameSync(logFile, logFile+'.previous');
      fs.appendFileSync(logFile, new Date().toISOString()+' '+String(message).slice(0,1200)+'\n', {mode:0o600});
    } catch { /* Logging must never prevent a sale. */ }
  };
  const supported = app.isPackaged && ['win32','darwin'].includes(platform);
  const autoInstall = supported && (platform === 'win32' || options.macSigned === true);
  if (autoInstall) {
    try {
      updater = options.updater || require('electron-updater').autoUpdater;
      // electron-builder supplies the fixed GitHub provider in app-update.yml.
      updater.autoDownload = true;
      updater.autoInstallOnAppQuit = true;
      updater.allowPrerelease = false;
      updater.allowDowngrade = false;
      updater.logger = {info:log, warn:log, error:log, debug:()=>{}};
      updater.on('update-available', info => set('downloading', 'Descargando la versión '+info.version+' en segundo plano.', info.version));
      updater.on('download-progress', progress => set('downloading', 'Descargando actualización: '+Math.floor(progress.percent)+' %.'));
      updater.on('update-not-available', () => set('current', 'Ya tienes la versión más reciente.', app.getVersion()));
      updater.on('update-downloaded', info => {
        log('Versión '+info.version+' lista para instalar al salir.');
        set('ready', 'Versión '+info.version+' lista. Se instalará cuando cierres la aplicación; no se reiniciará durante una venta.', info.version);
      });
      updater.on('error', error => { log(error.message); set('error', 'No se pudo comprobar o descargar la actualización. Puedes seguir trabajando; se reintentará más tarde.'); });
    } catch (error) { log(error.message); set('error', 'El actualizador no pudo iniciar. Reinstala la versión de GitHub para activar las actualizaciones.'); }
  }
  async function check() {
    if (disposed || checking || state.status === 'ready' || state.status === 'downloading') return {...state};
    if (!supported) { set('development', 'Las actualizaciones se comprueban en la aplicación instalada.'); return {...state}; }
    checking = true; set('checking', 'Buscando actualizaciones…');
    try {
      if (autoInstall) {
        if (!updater) throw Error('Actualizador no disponible');
        await updater.checkForUpdates();
      } else {
        // Unsigned Mac builds must not attempt to bypass Squirrel/Apple signature checks.
        const response = await (options.fetch || fetch)(API, {headers:{Accept:'application/vnd.github+json','User-Agent':'Santa-Elena-Conectada'}, signal:AbortSignal.timeout(15000)});
        if (response.status === 404) set('current', 'Todavía no hay una versión publicada para descargar.');
        else {
          if (!response.ok) throw Error('GitHub respondió '+response.status);
          const release = await response.json();
          if (!release.draft && !release.prerelease && newerVersion(release.tag_name, app.getVersion()))
            set('manual', 'Hay una versión nueva para Mac. Descárgala desde GitHub. La instalación automática requiere una versión firmada por Apple.', release.tag_name.replace(/^v/,''));
          else set('current', 'Ya tienes la versión más reciente.', app.getVersion());
        }
      }
    } catch (error) { log(error.message); set('error', 'No se pudo conectar con las actualizaciones. Puedes seguir trabajando; se reintentará más tarde.'); }
    finally { checking = false; }
    return {...state};
  }
  const initial = setTimeout(check, options.initialDelay ?? 15000);
  const interval = setInterval(check, options.interval ?? 4*60*60*1000);
  initial.unref?.(); interval.unref?.();
  const dispose = () => {disposed=true;clearTimeout(initial);clearInterval(interval);};
  app.once('before-quit', dispose);
  return {check, dispose, getState:()=>({...state}), releaseURL:RELEASES};
}
module.exports = {startUpdates, newerVersion, RELEASES};
