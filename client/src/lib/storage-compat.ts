/**
 * Storage Compatibility Layer
 * 
 * Provides sessionStorage/localStorage-compatible synchronous API
 * backed by Electron file storage. This allows the original Replit code
 * to work unchanged in Electron by simply shadowing the global variables.
 * 
 * Usage in any file:
 *   import { electronStorage } from "@/lib/storage-compat";
 *   const sessionStorage = electronStorage;
 *   const localStorage = electronStorage;
 *   // ... rest of code works unchanged
 */

import { getData, setData, isElectron } from "./electron-storage";

class ElectronStorageCompat {
  getItem(key: string): string | null {
    if (!isElectron()) {
      // In browser, delegate to real sessionStorage
      try { return window.sessionStorage.getItem(key); } catch { return null; }
    }
    const val = getData(key);
    if (val === null || val === undefined) return null;
    // getData returns parsed objects; callers expect strings from getItem
    return typeof val === "string" ? val : JSON.stringify(val);
  }

  setItem(key: string, value: string): void {
    if (!isElectron()) {
      try { window.sessionStorage.setItem(key, value); } catch { /* ignore */ }
      return;
    }
    // setData expects objects; value coming in is a JSON string
    try {
      setData(key, JSON.parse(value));
    } catch {
      setData(key, value);
    }
  }

  removeItem(key: string): void {
    if (!isElectron()) {
      try { window.sessionStorage.removeItem(key); } catch { /* ignore */ }
      return;
    }
    setData(key, null);
  }

  clear(): void {
    if (!isElectron()) {
      try { window.sessionStorage.clear(); } catch { /* ignore */ }
    }
  }

  get length(): number { return 0; }
  key(_index: number): string | null { return null; }
}

export const electronStorage = new ElectronStorageCompat();
