const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // JSON data files
  readJSON: (filename) => ipcRenderer.invoke("read-json", filename),
  writeJSON: (filename, data) => ipcRenderer.invoke("write-json", filename, data),

  // Project file attachments
  saveProjectFile: (customer, projectName, fileName, base64Data) =>
    ipcRenderer.invoke("save-project-file", customer, projectName, fileName, base64Data),
  loadProjectFile: (relativePath) =>
    ipcRenderer.invoke("load-project-file", relativePath),
  listProjectFiles: (customer, projectName) =>
    ipcRenderer.invoke("list-project-files", customer, projectName),
  deleteProjectFile: (relativePath) =>
    ipcRenderer.invoke("delete-project-file", relativePath),

  // System integration
  openFileExternal: (relativePath) =>
    ipcRenderer.invoke("open-file-external", relativePath),
  openFolder: (customer, projectName) =>
    ipcRenderer.invoke("open-folder", customer, projectName),
  renameProjectFolder: (oldCust, oldName, newCust, newName) =>
    ipcRenderer.invoke("rename-project-folder", oldCust, oldName, newCust, newName),

  // Backup
  listAllDataFiles: () => ipcRenderer.invoke("list-all-data-files"),
  readFileBase64: (absolutePath) => ipcRenderer.invoke("read-file-base64", absolutePath),
  writeFileBase64: (relativePath, base64) => ipcRenderer.invoke("write-file-base64", relativePath, base64),
  showSaveDialog: (defaultName) => ipcRenderer.invoke("show-save-dialog", defaultName),
  showOpenDialog: () => ipcRenderer.invoke("show-open-dialog"),
  writeZipToDisk: (filePath, base64) => ipcRenderer.invoke("write-zip-to-disk", filePath, base64),

  // Info
  getDataPath: () => ipcRenderer.invoke("get-data-path"),
});
