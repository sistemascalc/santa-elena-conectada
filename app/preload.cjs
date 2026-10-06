'use strict';
// Narrow, origin-checked bridges; no filesystem or arbitrary IPC exposed.
if (process.isMainFrame && location.protocol === 'file:' && location.pathname.endsWith('/offline.html')) {
  const {contextBridge, ipcRenderer} = require('electron');
  contextBridge.exposeInMainWorld('santaConnection', Object.freeze({retry: () => ipcRenderer.invoke('santa:retry')}));
}
if(process.isMainFrame&&location.origin==='https://santa-elena-de-la-cruz.sistemascacl.chatgpt.site'){
 const {contextBridge,ipcRenderer}=require('electron');
 let busy=false;
 contextBridge.exposeInMainWorld('santaPrinting',Object.freeze({
  settings:()=>ipcRenderer.invoke('santa:printers:open'),
  print:async()=>{
   if(busy)return;busy=true;
   try{
    const source=document.querySelector('.print');if(!source||!source.textContent.trim())throw Error('Abre primero el recibo o documento que deseas imprimir.');
    const clone=source.cloneNode(true);clone.removeAttribute('style');
    clone.querySelectorAll('script,iframe,object,embed,link,style,form,input,button,video,audio,svg').forEach(n=>n.remove());
    for(const n of [clone,...clone.querySelectorAll('*')]){
     if(n.tagName==='IMG'){const src=new URL(n.getAttribute('src')||'',location.href);if(src.origin===location.origin||src.protocol==='data:')n.setAttribute('src',src.href);else n.remove();}
     for(const a of [...n.attributes])if(a.name.startsWith('on')||['srcdoc','href','srcset'].includes(a.name))n.removeAttribute(a.name);
    }
    const css=[...document.styleSheets].map(s=>{try{return [...s.cssRules].map(r=>r.cssText).join('\n');}catch{return '';}}).join('\n');
    await ipcRenderer.invoke('santa:print',{html:clone.outerHTML,css});
   }catch(e){alert(e.message);}finally{busy=false;}
  }
 }));
 const addButton=()=>{
  const host=document.querySelector('#app .heading');
  if(!/^#(?:ventas|agenda|intenciones)(?:-|$)/.test(location.hash)||!host||host.querySelector('[data-native-printers]'))return;
  const button=document.createElement('button');button.type='button';button.className='secondary';button.dataset.nativePrinters='true';button.textContent='Seleccionar impresora';button.onclick=()=>ipcRenderer.invoke('santa:printers:open');host.append(button);
 };
 window.addEventListener('DOMContentLoaded',()=>{new MutationObserver(addButton).observe(document.body,{childList:true,subtree:true});addButton();});
}
