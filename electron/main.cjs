const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow;

// --- Data Directory ---
// Portable: "Daten" folder next to the .exe
// Dev: "Daten" folder in project root
function getDataDir() {
  if (app.isPackaged) {
    return path.join(path.dirname(process.execPath), "Daten");
  } else {
    return path.join(__dirname, "..", "Daten");
  }
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*]/g, "_").replace(/\s+/g, " ").trim();
}

function getProjectDir(customer, projectName) {
  const custDir = sanitizeFilename(customer || "Allgemein");
  const projDir = sanitizeFilename(projectName);
  return path.join(getDataDir(), "Kunden", custDir, projDir);
}

// ===================== IPC HANDLERS =====================

// Get data directory path
ipcMain.handle("get-data-path", () => getDataDir());

// Read JSON file (projects.json, ingredients.json, recipes.json)
ipcMain.handle("read-json", (event, filename) => {
  try {
    const filePath = path.join(getDataDir(), filename);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
    return null;
  } catch (err) {
    console.error("read-json error:", err);
    return null;
  }
});

// Write JSON file
ipcMain.handle("write-json", (event, filename, data) => {
  try {
    ensureDir(getDataDir());
    fs.writeFileSync(path.join(getDataDir(), filename), JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("write-json error:", err);
    return false;
  }
});

// Save file attachment to project Kunden folder - returns relative path
ipcMain.handle("save-project-file", (event, customer, projectName, fileName, base64Data) => {
  try {
    const filesDir = path.join(getProjectDir(customer, projectName), "Dateien");
    ensureDir(filesDir);
    const safeName = sanitizeFilename(fileName);
    const filePath = path.join(filesDir, safeName);
    let raw = base64Data;
    if (raw.includes(",")) raw = raw.split(",")[1];
    fs.writeFileSync(filePath, Buffer.from(raw, "base64"));
    return path.relative(path.join(getDataDir(), "Kunden"), filePath).replace(/\\/g, "/");
  } catch (err) {
    console.error("save-project-file error:", err);
    return null;
  }
});

// Load file from Kunden folder ON DEMAND as data URL
ipcMain.handle("load-project-file", (event, relativePath) => {
  try {
    const filePath = path.join(getDataDir(), "Kunden", relativePath);
    if (!fs.existsSync(filePath)) return null;
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = {
      ".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",
      ".gif":"image/gif",".webp":"image/webp",".bmp":"image/bmp",
      ".pdf":"application/pdf",".msg":"application/vnd.ms-outlook",
      ".eml":"message/rfc822",
      ".xlsx":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".xls":"application/vnd.ms-excel",
      ".docx":"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".doc":"application/msword",".txt":"text/plain",
    };
    const mime = mimeMap[ext] || "application/octet-stream";
    return {
      data: `data:${mime};base64,${buffer.toString("base64")}`,
      mime, size: buffer.length, name: path.basename(filePath),
    };
  } catch (err) {
    console.error("load-project-file error:", err);
    return null;
  }
});

// List files in a project's Dateien folder
ipcMain.handle("list-project-files", (event, customer, projectName) => {
  try {
    const filesDir = path.join(getProjectDir(customer, projectName), "Dateien");
    if (!fs.existsSync(filesDir)) return [];
    return fs.readdirSync(filesDir).map(name => {
      const fp = path.join(filesDir, name);
      const stats = fs.statSync(fp);
      return {
        name, size: stats.size, modified: stats.mtime.toISOString(),
        relativePath: path.relative(path.join(getDataDir(), "Kunden"), fp).replace(/\\/g, "/"),
      };
    });
  } catch (err) { return []; }
});

// Delete file
ipcMain.handle("delete-project-file", (event, relativePath) => {
  try {
    const fp = path.join(getDataDir(), "Kunden", relativePath);
    if (fs.existsSync(fp)) { fs.unlinkSync(fp); return true; }
    return false;
  } catch (err) { return false; }
});

// Open file in system default app (double click on attachment)
ipcMain.handle("open-file-external", (event, relativePath) => {
  try {
    const fp = path.join(getDataDir(), "Kunden", relativePath);
    if (fs.existsSync(fp)) { shell.openPath(fp); return true; }
    return false;
  } catch (err) { return false; }
});

// Open project folder in Explorer
ipcMain.handle("open-folder", (event, customer, projectName) => {
  try {
    const dir = projectName
      ? path.join(getProjectDir(customer, projectName), "Dateien")
      : path.join(getDataDir(), "Kunden", sanitizeFilename(customer || "Allgemein"));
    ensureDir(dir);
    shell.openPath(dir);
    return true;
  } catch (err) { return false; }
});

// Rename project folder when customer or name changes
ipcMain.handle("rename-project-folder", (event, oldCust, oldName, newCust, newName) => {
  try {
    const oldDir = getProjectDir(oldCust, oldName);
    const newDir = getProjectDir(newCust, newName);
    if (fs.existsSync(oldDir) && oldDir !== newDir) {
      ensureDir(path.dirname(newDir));
      fs.renameSync(oldDir, newDir);
    }
    return true;
  } catch (err) { return false; }
});

// List ALL files in data dir (for backup export)
ipcMain.handle("list-all-data-files", () => {
  const dataDir = getDataDir();
  if (!fs.existsSync(dataDir)) return [];
  const results = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else results.push({
        absolutePath: full,
        relativePath: path.relative(dataDir, full).replace(/\\/g, "/"),
        size: fs.statSync(full).size,
      });
    }
  }
  walk(dataDir);
  return results;
});

// Read raw file as base64 (for backup export)
ipcMain.handle("read-file-base64", (event, absolutePath) => {
  try {
    if (!fs.existsSync(absolutePath)) return null;
    return fs.readFileSync(absolutePath).toString("base64");
  } catch (err) { return null; }
});

// Write raw base64 to file (for backup import)
ipcMain.handle("write-file-base64", (event, relativePath, base64) => {
  try {
    const fp = path.join(getDataDir(), relativePath);
    ensureDir(path.dirname(fp));
    fs.writeFileSync(fp, Buffer.from(base64, "base64"));
    return true;
  } catch (err) { return false; }
});

// Show save dialog (for backup export)
ipcMain.handle("show-save-dialog", async (event, defaultName) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: "Backup speichern",
    defaultPath: defaultName,
    filters: [{ name: "ZIP Archiv", extensions: ["zip"] }],
  });
  return canceled ? null : filePath;
});

// Show open dialog (for backup import)
ipcMain.handle("show-open-dialog", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: "Backup importieren",
    filters: [{ name: "ZIP Archiv", extensions: ["zip"] }],
    properties: ["openFile"],
  });
  return canceled ? null : filePaths[0];
});

// Write zip buffer directly to disk (bypass renderer memory)
ipcMain.handle("write-zip-to-disk", (event, filePath, base64) => {
  try {
    fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
    return true;
  } catch (err) { return false; }
});

// ===================== WINDOW =====================

function createWindow() {
  const publicPath = path.join(__dirname, "..", "dist", "public");

  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600,
    title: "QUID Rechner - Development Suite",
    icon: path.join(publicPath, "favicon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
    show: false,
  });

  mainWindow.loadFile(path.join(publicPath, "index.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => { mainWindow = null; });

  // Ensure data directory exists
  ensureDir(getDataDir());

  // Menu
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: "Datei",
      submenu: [
        { label: "Datenordner öffnen", click: () => shell.openPath(getDataDir()) },
        { type: "separator" },
        { role: "reload", label: "Neu laden" },
        { role: "forceReload", label: "Erzwungen neuladen" },
        { type: "separator" },
        { role: "quit", label: "Beenden" },
      ],
    },
    {
      label: "Bearbeiten",
      submenu: [
        { role: "undo" }, { role: "redo" }, { type: "separator" },
        { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" },
      ],
    },
    {
      label: "Ansicht",
      submenu: [
        { role: "zoomIn" }, { role: "zoomOut" }, { role: "resetZoom" },
        { type: "separator" }, { role: "togglefullscreen" },
        { type: "separator" }, { role: "toggleDevTools", label: "Entwicklertools" },
      ],
    },
  ]));
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
