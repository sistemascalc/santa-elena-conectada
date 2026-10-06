'use strict';
const fs=require('node:fs');
const path=require('node:path');
function groupFor(url){const h=new URL(url).hash;return /^#ventas(?:-|$)/.test(h)?'sales':/^#(?:agenda|intenciones)(?:-|$)/.test(h)?'sheets':null;}
function validate(value,printers){
 const names=new Set(printers.map(p=>p.name));
 for(const key of ['sales','sheets'])if(value[key]&&!names.has(value[key]))throw Error('La impresora seleccionada ya no está disponible.');
 if(![58,80].includes(Number(value.width)))throw Error('Selecciona papel de 58 u 80 mm.');
 if(!['Letter','A4'].includes(value.paper))throw Error('Selecciona Carta o A4.');
 return {sales:value.sales||'',sheets:value.sheets||'',width:Number(value.width),paper:value.paper};
}
function printOptions(settings,group,height){
 const deviceName=settings[group];if(!deviceName)throw Error('Selecciona primero la impresora de este apartado.');
 return {silent:true,deviceName,printBackground:true,color:false,copies:1,landscape:false,scaleFactor:100,margins:{marginType:'none'},pageSize:group==='sales'?{width:settings.width*1000,height:Math.max(20000,Math.ceil(height)*1000)}:settings.paper};
}
function createPrinting({app,BrowserWindow,dialog,win,origin}){
 const file=path.join(app.getPath('userData'),'printers.json');
 let settings={sales:'',sheets:'',width:80,paper:'Letter'},busy=false,settingsWindow;
 try{settings={...settings,...JSON.parse(fs.readFileSync(file,'utf8'))};}catch{}
 const printers=()=>win.webContents.getPrintersAsync();
 function openSettings(){
  if(settingsWindow&&!settingsWindow.isDestroyed()){settingsWindow.focus();return;}
  settingsWindow=new BrowserWindow({parent:win,modal:true,width:650,height:620,resizable:false,title:'Impresoras · Santa Elena',icon:path.join(__dirname,'logo.png'),webPreferences:{preload:path.join(__dirname,'printer-preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}});
  settingsWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  settingsWindow.webContents.on('will-navigate',e=>e.preventDefault());
  settingsWindow.loadFile(path.join(__dirname,'printers.html'));
  return settingsWindow;
 }
 function allowedSettings(event){return settingsWindow&&!settingsWindow.isDestroyed()&&event.sender===settingsWindow.webContents&&event.senderFrame===settingsWindow.webContents.mainFrame;}
 async function getSettings(event){if(!allowedSettings(event))throw Error('Solicitud no permitida');return {settings,printers:await printers()};}
 async function saveSettings(event,value){if(!allowedSettings(event))throw Error('Solicitud no permitida');settings=validate(value,await printers());fs.writeFileSync(file+'.tmp',JSON.stringify(settings),{mode:0o600});fs.renameSync(file+'.tmp',file);return true;}
 async function print(event,payload){
  if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||new URL(event.senderFrame.url).origin!==origin)throw Error('Solicitud no permitida');
  const group=groupFor(event.senderFrame.url);if(!group)throw Error('Imprime desde Ventas, Agenda o Intenciones.');
  if(busy)return;busy=true;let job;
  try{
   if(!settings[group]){openSettings();throw Error('Selecciona y guarda la impresora; después vuelve a pulsar Imprimir.');}
   if(!(await printers()).some(p=>p.name===settings[group]))throw Error('La impresora seleccionada no está disponible. Revisa su conexión o cambia la selección en Impresión.');
   if(!payload||typeof payload.html!=='string'||payload.html.length>4000000||typeof payload.css!=='string'||payload.css.length>1000000)throw Error('Documento no válido.');
   const ticket=group==='sales';const contentWidth=settings.width===58?48:72;
   const css=`@page{size:${ticket?settings.width+'mm auto':settings.paper};margin:0}html,body{margin:0!important;padding:0!important;background:white!important;min-width:0!important}.print{display:block!important;position:static!important;margin:0!important;padding:${ticket?'0':'8mm'}!important;width:${ticket?settings.width+'mm':'100%'}!important;max-width:none!important;box-sizing:border-box}.receipt-ticket{box-sizing:border-box!important;width:${contentWidth}mm!important;max-width:${contentWidth}mm!important;padding:0!important;margin:0 auto!important;box-shadow:none!important;break-inside:auto!important;page-break-after:auto!important}.receipt-brand{margin-bottom:2mm!important}.receipt-brand img{width:24mm!important;height:20mm!important;object-fit:contain!important}.receipt-ticket p{margin-bottom:1px!important}.receipt-footer{margin-top:2mm!important}body .print{page:auto!important}table{max-width:100%}body{width:${ticket?settings.width+'mm':'auto'}}`;
   job=new BrowserWindow({show:false,width:ticket?Math.ceil(settings.width*96/25.4):820,height:800,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,javascript:true}});
   job.webContents.setWindowOpenHandler(()=>({action:'deny'}));
   job.webContents.on('will-navigate',event=>event.preventDefault());
   const html='<!doctype html><html><head><meta charset="utf-8"><title>Santa Elena · Documento</title><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src '+origin+' data:; style-src \'unsafe-inline\'; font-src '+origin+'"><style>'+payload.css.replace(/<\/style/gi,'')+'\n'+css+'</style></head><body>'+payload.html+'</body></html>';
   await job.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));
   const logo='data:image/png;base64,'+fs.readFileSync(path.join(__dirname,'logo.png')).toString('base64');
   const height=await job.webContents.executeJavaScript(`(async()=>{for(const img of document.querySelectorAll('.receipt-brand img'))img.src=${JSON.stringify(logo)};await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));return Math.ceil(document.querySelector('.print').getBoundingClientRect().height*25.4/96)+2})()`);
   if(!Number.isFinite(height)||height>3000)throw Error('El documento es demasiado largo para un solo ticket. Reduce la cantidad de conceptos.');
   if(ticket)await job.webContents.insertCSS('@page{size:'+settings.width+'mm '+Math.max(20,height)+'mm;margin:0}');
   await new Promise((resolve,reject)=>job.webContents.print(printOptions(settings,group,height),(ok,error)=>ok?resolve():reject(Error(error||'La impresora no aceptó el documento.'))));
  }catch(error){await dialog.showMessageBox(win,{type:'error',message:'No se imprimió el documento',detail:error.message});}
  finally{job?.destroy();busy=false;}
 }
 return {openSettings,getSettings,saveSettings,print};
}
module.exports={createPrinting,groupFor,validate,printOptions};
