const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('printers',{get:()=>ipcRenderer.invoke('santa:printers:get'),save:value=>ipcRenderer.invoke('santa:printers:save',value)});
