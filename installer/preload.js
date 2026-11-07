'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const call = (ch, arg) => ipcRenderer.invoke(ch, arg);

contextBridge.exposeInMainWorld('gs', {
  info: () => call('gs:info'),
  detect: () => call('gs:detect'),
  installMillennium: (phase) => call('gs:installMillennium', phase),
  closeSteam: () => call('gs:closeSteam'),
  installTheme: (choice) => call('gs:installTheme', choice),
  startSteam: () => call('gs:startSteam'),
  uninstall: () => call('gs:uninstall'),
  openExternal: (url) => call('gs:openExternal', url),
  window: (action) => call('gs:window', action),
  onEvent: (cb) => {
    const fn = (_e, data) => cb(data);
    ipcRenderer.on('gs:event', fn);
    return () => ipcRenderer.removeListener('gs:event', fn);
  },
});
