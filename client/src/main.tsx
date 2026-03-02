import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initStorage, isElectron, getData, setData } from "./lib/electron-storage";

/**
 * Patch sessionStorage and localStorage for Electron compatibility.
 * The original Replit code uses sessionStorage/localStorage directly.
 * In Electron, we redirect these to file-based storage transparently.
 */
function patchStorageForElectron() {
  if (!isElectron()) return;

  const createCompat = (): Storage => ({
    getItem(key: string): string | null {
      const val = getData(key);
      if (val === null || val === undefined) return null;
      return typeof val === "string" ? val : JSON.stringify(val);
    },
    setItem(key: string, value: string): void {
      try { setData(key, JSON.parse(value)); } catch { setData(key, value); }
    },
    removeItem(key: string): void { setData(key, null); },
    clear(): void { /* no-op in Electron */ },
    get length(): number { return 0; },
    key(_i: number): string | null { return null; },
  });

  try {
    Object.defineProperty(window, "sessionStorage", {
      value: createCompat(), writable: true, configurable: true,
    });
    Object.defineProperty(window, "localStorage", {
      value: createCompat(), writable: true, configurable: true,
    });
  } catch (e) {
    console.warn("Could not patch storage for Electron:", e);
  }
}

async function boot() {
  if (isElectron()) {
    await initStorage();
    patchStorageForElectron();
  }
  createRoot(document.getElementById("root")!).render(<App />);
}

boot();
