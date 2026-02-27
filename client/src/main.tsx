import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initStorage, isElectron } from "./lib/electron-storage";

async function boot() {
  if (isElectron()) {
    await initStorage();
  }
  createRoot(document.getElementById("root")!).render(<App />);
}

boot();
