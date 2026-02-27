/**
 * Storage abstraction that works both in Electron (file system) and browser (localStorage).
 * 
 * In Electron: Data is saved as JSON files in the "Daten" folder next to the .exe.
 *              File attachments are saved as real files in Kunden/ subfolders.
 * In Browser:  Falls back to localStorage (for development/testing).
 */

// Type declaration for the Electron API exposed via preload
declare global {
  interface Window {
    electronAPI?: {
      readJSON: (filename: string) => Promise<any>;
      writeJSON: (filename: string, data: any) => Promise<boolean>;
      saveProjectFile: (customer: string, projectName: string, fileName: string, base64Data: string) => Promise<string | null>;
      loadProjectFile: (relativePath: string) => Promise<{ data: string; mime: string; size: number; name: string } | null>;
      listProjectFiles: (customer: string, projectName: string) => Promise<Array<{ name: string; size: number; modified: string; relativePath: string }>>;
      deleteProjectFile: (relativePath: string) => Promise<boolean>;
      openFileExternal: (relativePath: string) => Promise<boolean>;
      openFolder: (customer: string, projectName?: string) => Promise<boolean>;
      renameProjectFolder: (oldCust: string, oldName: string, newCust: string, newName: string) => Promise<boolean>;
      listAllDataFiles: () => Promise<Array<{ absolutePath: string; relativePath: string; size: number }>>;
      readFileBase64: (absolutePath: string) => Promise<string | null>;
      writeFileBase64: (relativePath: string, base64: string) => Promise<boolean>;
      showSaveDialog: (defaultName: string) => Promise<string | null>;
      showOpenDialog: () => Promise<string | null>;
      writeZipToDisk: (filePath: string, base64: string) => Promise<boolean>;
      getDataPath: () => Promise<string>;
    };
  }
}

export function isElectron(): boolean {
  return !!window.electronAPI;
}

// --- JSON Data Storage ---

const JSON_FILE_MAP: Record<string, string> = {
  "quid-projects-db-clean": "projects.json",
  "quid-ingredient-db-clean": "ingredients.json",
  "quid-recipe-db-clean": "recipes.json",
  "quid-custom-flows": "custom-flows.json",
  "quid-first-visit-done": "settings.json",
};

// Write-through cache to avoid async issues with synchronous localStorage API
const memoryCache: Record<string, any> = {};
let cacheLoaded = false;

/** Load all data files into memory cache on app start */
export async function initStorage(): Promise<void> {
  if (!isElectron()) return;

  for (const [storageKey, filename] of Object.entries(JSON_FILE_MAP)) {
    try {
      const data = await window.electronAPI!.readJSON(filename);
      if (data !== null) {
        memoryCache[storageKey] = data;
      }
    } catch (e) {
      console.error(`Failed to load ${filename}:`, e);
    }
  }
  cacheLoaded = true;
}

/** Get data - synchronous (from cache) */
export function getData(key: string): any {
  if (isElectron()) {
    return memoryCache[key] ?? null;
  }
  // Browser fallback
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/** Set data - writes to cache immediately, persists to disk async */
export function setData(key: string, data: any): void {
  if (isElectron()) {
    memoryCache[key] = data;
    const filename = JSON_FILE_MAP[key];
    if (filename) {
      // Fire and forget - async write to disk
      window.electronAPI!.writeJSON(filename, data).catch(err =>
        console.error(`Failed to persist ${filename}:`, err)
      );
    }
  } else {
    // Browser fallback
    localStorage.setItem(key, JSON.stringify(data));
  }
}

/** Get string value (for simple flags like first-visit) */
export function getItem(key: string): string | null {
  if (isElectron()) {
    const val = memoryCache[key];
    return val !== undefined && val !== null ? String(val) : null;
  }
  return localStorage.getItem(key);
}

/** Set string value */
export function setItem(key: string, value: string): void {
  if (isElectron()) {
    memoryCache[key] = value;
    const filename = JSON_FILE_MAP[key];
    if (filename) {
      window.electronAPI!.writeJSON(filename, value).catch(() => {});
    }
  } else {
    localStorage.setItem(key, value);
  }
}

// --- File Attachments ---

/** Save a file attachment to project folder. Returns relative path (no base64 in JSON!) */
export async function saveProjectFile(
  customer: string,
  projectName: string,
  fileName: string,
  base64Data: string
): Promise<string | null> {
  if (!isElectron()) {
    // Browser fallback: return base64 directly (old behavior)
    return base64Data;
  }
  return window.electronAPI!.saveProjectFile(customer, projectName, fileName, base64Data);
}

/** Load a file on demand. Returns data URL or null. */
export async function loadProjectFile(
  pathOrBase64: string
): Promise<{ data: string; mime: string; size: number; name: string } | null> {
  if (!isElectron() || !pathOrBase64) return null;

  // If it's already a data URL (legacy/browser mode), return as-is
  if (pathOrBase64.startsWith("data:")) {
    return { data: pathOrBase64, mime: "application/octet-stream", size: 0, name: "file" };
  }

  return window.electronAPI!.loadProjectFile(pathOrBase64);
}

/** List files in project folder */
export async function listProjectFiles(customer: string, projectName: string) {
  if (!isElectron()) return [];
  return window.electronAPI!.listProjectFiles(customer, projectName);
}

/** Delete a project file */
export async function deleteProjectFile(relativePath: string): Promise<boolean> {
  if (!isElectron()) return false;
  return window.electronAPI!.deleteProjectFile(relativePath);
}

/** Open file in system default app */
export async function openFileExternal(relativePath: string): Promise<boolean> {
  if (!isElectron()) return false;
  return window.electronAPI!.openFileExternal(relativePath);
}

/** Open project folder in Explorer */
export async function openFolder(customer: string, projectName?: string): Promise<boolean> {
  if (!isElectron()) return false;
  return window.electronAPI!.openFolder(customer, projectName);
}

/** Rename project folder when customer/name changes */
export async function renameProjectFolder(
  oldCust: string, oldName: string, newCust: string, newName: string
): Promise<boolean> {
  if (!isElectron()) return true;
  return window.electronAPI!.renameProjectFolder(oldCust, oldName, newCust, newName);
}

// --- Dispatch custom events for component reactivity ---

export function dispatchStorageEvent(key: string) {
  window.dispatchEvent(new CustomEvent("storage-update", { detail: { key } }));
}
