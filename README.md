# QUID Rechner - Desktop Standalone

Standalone Desktop-Anwendung für QUID-Berechnungen nach EU LMIV.

## .exe über GitHub herunterladen

1. Pushe dieses Repository auf GitHub
2. Gehe zu **Actions** → **Build Desktop App**
3. Der Build startet automatisch (oder manuell über "Run workflow")
4. Nach ~5 Minuten: Klicke auf den fertigen Run → **Artifacts**
5. Lade `QUID-Rechner-Windows-Portable` herunter → fertige `.exe` drin

Die `.exe` ist komplett standalone – kein Node.js, kein Browser, keine Installation nötig.

## Projektstruktur

```
├── .github/workflows/build.yml   ← GitHub Actions Build-Script
├── client/src/                    ← React Frontend (TypeScript)
├── electron/main.js               ← Electron Desktop-Wrapper
├── shared/                        ← Geteilte Types
├── vite.config.electron.ts        ← Vite Build-Config
└── package.json                   ← Abhängigkeiten & Build-Scripts
```

## Datenspeicherung

Alle Daten liegen im `localStorage` – lokal auf dem Rechner, kein Server, kein Internet nötig. Die eingebaute Backup-Funktion (Export/Import als ZIP) sichert die Daten.
