const { contextBridge, ipcRenderer } = require('electron');
const path = require('path'); // path module is available in preload

// Expose a limited set of IPC methods to the renderer process (frontend)
// This is a secure way to allow the frontend to call Node.js functions
contextBridge.exposeInMainWorld('electronAPI', {
  loadData: (fileType) => ipcRenderer.invoke('load-data', fileType),
  saveData: (fileType, data) => ipcRenderer.invoke('save-data', fileType, data),
  selectImage: () => ipcRenderer.invoke('select-image'), // Expose new handler
  copyImageToData: (originalPath) => ipcRenderer.invoke('copy-image-to-data', originalPath), // Expose new handler
  getImsDataPath: () => ipcRenderer.invoke('get-ims-data-path') // Expose new handler
  // deleteFile: (relativePath) => ipcRenderer.invoke('delete-file', relativePath) // Expose delete handler if implemented
});
