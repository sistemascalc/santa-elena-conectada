const {test} = require('node:test');
const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const {startUpdates, newerVersion} = require('../app/updates.cjs');
const os = require('node:os'), fs = require('node:fs'), path = require('node:path');

function fixture(t, platform='win32', extra={}) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'santa-update-'));
  const app=Object.assign(new EventEmitter(),{isPackaged:true,getVersion:()=> '1.1.0',getPath:()=>dir});
  const updater=Object.assign(new EventEmitter(),{checkForUpdates:async()=>updater.emit('update-not-available')});
  const manager=startUpdates(app,{platform,updater,initialDelay:600000,interval:600000,...extra});
  t.after(()=>{manager.dispose();fs.rmSync(dir,{recursive:true,force:true});});
  return {app,updater,manager};
}
test('stable versions reject downgrades and prereleases',()=>{
  assert.ok(newerVersion('v1.2.0','1.1.0'));
  for(const v of ['v1.0.0','v1.1.0','v2.0.0-beta','untrusted'])assert.equal(newerVersion(v,'1.1.0'),false);
});
test('Windows downloads automatically and waits for normal quit',async t=>{
  const {manager,updater}=fixture(t);
  assert.equal(updater.autoDownload,true);assert.equal(updater.autoInstallOnAppQuit,true);
  assert.equal(updater.allowDowngrade,false);assert.equal(updater.allowPrerelease,false);
  assert.equal((await manager.check()).status,'current');
  updater.emit('update-available',{version:'1.2.0'});assert.equal(manager.getState().status,'downloading');
  updater.emit('update-downloaded',{version:'1.2.0'});assert.equal(manager.getState().status,'ready');
  assert.equal((await manager.check()).status,'ready');
});
test('offline checks fail softly and allow later retry',async t=>{
  const {manager,updater}=fixture(t);updater.checkForUpdates=async()=>{throw Error('offline')};
  assert.equal((await manager.check()).status,'error');
  updater.checkForUpdates=async()=>updater.emit('update-not-available');
  assert.equal((await manager.check()).status,'current');
});
test('unsigned Mac never starts an automatic installer',async t=>{
  let calls=0;
  const {manager,updater}=fixture(t,'darwin',{macSigned:false,fetch:async url=>{calls++;assert.ok(url.startsWith('https://api.github.com/repos/sistemascalc/santa-elena-conectada/'));return {ok:true,json:async()=>({tag_name:'v1.2.0',draft:false,prerelease:false})}}});
  assert.equal(updater.autoDownload,undefined);
  assert.equal((await manager.check()).status,'manual');assert.equal(calls,1);
});
test('signed Mac enables the supported updater',t=>{
  const {updater}=fixture(t,'darwin',{macSigned:true});assert.equal(updater.autoDownload,true);
});
test('checking requests do not overlap',async t=>{
  const {manager,updater}=fixture(t);let resolve,calls=0;
  updater.checkForUpdates=()=>{calls++;return new Promise(r=>resolve=r)};
  const a=manager.check();await manager.check();assert.equal(calls,1);resolve();await a;
});
