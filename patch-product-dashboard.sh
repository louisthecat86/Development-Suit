#!/bin/bash
# ============================================================
# patch-product-dashboard.sh
# 
# Wendet Änderungen 4 + 5 auf product-dashboard.tsx an:
#   4. Prozess-Historie aufklappbar (pointer-events-none entfernen)
#   5. Wiederherstellung → neue Version + Pflichtkommentar
# 
# Verwendung:
#   cd /pfad/zum/projekt-root
#   bash patch-product-dashboard.sh
# ============================================================

set -e

TARGET="client/src/pages/product-dashboard.tsx"

if [ ! -f "$TARGET" ]; then
    echo "❌ Datei nicht gefunden: $TARGET"
    echo "   Bitte im Projekt-Root-Verzeichnis ausführen!"
    exit 1
fi

cp "$TARGET" "${TARGET}.bak"
echo "✅ Backup: ${TARGET}.bak"

python3 << 'PYTHON_PATCH'
import sys

filepath = "client/src/pages/product-dashboard.tsx"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

changes = 0

# ─── ÄNDERUNG A: State-Variablen einfügen ───────────────────
marker_a = 'const [activeTab, setActiveTab] = useState("timeline");'
insert_a = '''const [activeTab, setActiveTab] = useState("timeline");

  // Restore Process Dialog State (Punkt 5: Pflichtkommentar bei Wiederherstellung)
  const [showRestoreProcessDialog, setShowRestoreProcessDialog] = useState(false);
  const [restoreProcessData, setRestoreProcessData] = useState<{ version: string; settings: ProcessSettings } | null>(null);
  const [restoreProcessComment, setRestoreProcessComment] = useState("");'''

if "showRestoreProcessDialog" in content:
    print("  ⚠️  A: showRestoreProcessDialog existiert bereits → übersprungen")
elif marker_a in content:
    content = content.replace(marker_a, insert_a, 1)
    changes += 1
    print("  ✅ A: State-Variablen eingefügt")
else:
    print("  ❌ A: Marker nicht gefunden!")
    sys.exit(1)


# ─── ÄNDERUNG B: pointer-events-none entfernen (nur ProcessParametersEditor) ──
pe_marker = "pointer-events-none opacity-90 select-none"
pe_count = content.count(pe_marker)

if pe_count == 0:
    print("  ⚠️  B: Kein pointer-events-none gefunden → übersprungen")
elif pe_count >= 2:
    # 2. Vorkommen ersetzen (= ProcessParametersEditor)
    first_pos = content.index(pe_marker)
    second_pos = content.index(pe_marker, first_pos + 1)
    content = content[:second_pos] + "opacity-90 select-none" + content[second_pos + len(pe_marker):]
    changes += 1
    print("  ✅ B: pointer-events-none entfernt (2. Vorkommen = Prozess-Historie)")
elif pe_count == 1:
    # Prüfe ob es die Process-Stelle ist
    pos = content.index(pe_marker)
    nearby = content[pos:pos+300]
    if "ProcessParametersEditor" in nearby:
        content = content.replace(pe_marker, "opacity-90 select-none", 1)
        changes += 1
        print("  ✅ B: pointer-events-none entfernt (ProcessParametersEditor)")
    else:
        print("  ⚠️  B: Einziges Vorkommen gehört zum RecipeEditor → übersprungen")


# ─── ÄNDERUNG C: Wiederherstellungs-Button durch Dialog ersetzen ──
restore_marker = 'Diesen alten Stand als aktuelle Prozessparameter wiederherstellen'

if restore_marker in content:
    # Finde den umgebenden DialogFooter-Block
    pos = content.index(restore_marker)
    
    # Suche rückwärts nach <DialogFooter>
    footer_start = content.rfind("<DialogFooter>", 0, pos)
    # Suche vorwärts nach </DialogFooter>
    footer_end = content.find("</DialogFooter>", pos)
    
    if footer_start != -1 and footer_end != -1:
        footer_end += len("</DialogFooter>")
        
        # Einrückung beibehalten (die Zeile mit <DialogFooter>)
        line_start = content.rfind("\n", 0, footer_start) + 1
        indent = content[line_start:footer_start]
        
        new_footer = f'''{indent}<DialogFooter>
{indent}     <Button 
{indent}         variant="outline"
{indent}         onClick={{() => {{
{indent}             setRestoreProcessData({{ version, settings }});
{indent}             setRestoreProcessComment("");
{indent}             setShowRestoreProcessDialog(true);
{indent}         }}}}
{indent}     >
{indent}        <History className="w-4 h-4 mr-2" />
{indent}        Als Aktuell wiederherstellen
{indent}     </Button>
{indent}</DialogFooter>'''
        
        content = content[:footer_start] + new_footer + content[footer_end:]
        changes += 1
        print("  ✅ C: Restore-Button durch Dialog-Aufruf ersetzt")
    else:
        print("  ❌ C: DialogFooter-Grenzen nicht gefunden!")
else:
    print("  ⚠️  C: Restore-Marker nicht gefunden → übersprungen")


# ─── ÄNDERUNG D: Restore-Dialog einfügen ──────────────────────
dialog_marker = "{/* Label Checklist Dialog */}"
dialog_already = "Prozessparameter wiederherstellen"

if dialog_already in content and "showRestoreProcessDialog" in content and dialog_marker in content:
    # Schon eingefügt? Prüfen ob der Dialog BLOCK da ist
    if '<Dialog open={showRestoreProcessDialog}' in content:
        print("  ⚠️  D: Restore-Dialog existiert bereits → übersprungen")
    else:
        # Dialog einfügen
        pass  # Fall through to insertion below

if dialog_marker in content and '<Dialog open={showRestoreProcessDialog}' not in content:
    pos = content.index(dialog_marker)
    line_start = content.rfind("\n", 0, pos) + 1
    indent = "            "
    
    restore_dialog = f'''
{indent}{{/* Restore Process Version Dialog (Punkt 5) */}}
{indent}<Dialog open={{showRestoreProcessDialog}} onOpenChange={{setShowRestoreProcessDialog}}>
{indent}    <DialogContent className="max-w-md">
{indent}        <DialogHeader>
{indent}            <DialogTitle className="flex items-center gap-2">
{indent}                <History className="w-5 h-5 text-orange-500" />
{indent}                Prozessparameter wiederherstellen
{indent}            </DialogTitle>
{indent}            <DialogDescription>
{indent}                Sie stellen Version {{restoreProcessData?.version || "?"}} als aktuelle Parameter wieder her.
{indent}                Dies erzeugt automatisch eine neue Version.
{indent}            </DialogDescription>
{indent}        </DialogHeader>
{indent}        <div className="space-y-4 py-4">
{indent}            <div className="bg-amber-50 p-3 rounded-md border border-amber-200 text-sm text-amber-800">
{indent}                <div className="flex items-start gap-2">
{indent}                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
{indent}                    <div>
{indent}                        <strong>Achtung:</strong> Die aktuellen Prozessparameter werden durch den Stand
{indent}                        von Version {{restoreProcessData?.version || "?"}} ersetzt. Der aktuelle Stand bleibt
{indent}                        in der Historie erhalten.
{indent}                    </div>
{indent}                </div>
{indent}            </div>
{indent}            <div className="space-y-2">
{indent}                <Label>
{indent}                    Begründung für die Wiederherstellung <span className="text-red-500">*</span>
{indent}                </Label>
{indent}                <Textarea
{indent}                    placeholder="Bitte begründen Sie, warum dieser alte Stand wiederhergestellt wird..."
{indent}                    value={{restoreProcessComment}}
{indent}                    onChange={{(e) => setRestoreProcessComment(e.target.value)}}
{indent}                    className="min-h-[100px]"
{indent}                />
{indent}                {{restoreProcessComment.trim().length === 0 && (
{indent}                    <p className="text-xs text-red-500">
{indent}                        Ein Kommentar ist Pflicht um die Änderung nachvollziehbar zu dokumentieren.
{indent}                    </p>
{indent}                )}}
{indent}            </div>
{indent}        </div>
{indent}        <DialogFooter className="gap-2">
{indent}            <Button variant="outline" onClick={{() => setShowRestoreProcessDialog(false)}}>
{indent}                Abbrechen
{indent}            </Button>
{indent}            <Button
{indent}                disabled={{restoreProcessComment.trim().length === 0}}
{indent}                onClick={{() => {{
{indent}                    if (!restoreProcessData || !activeProject) return;
{indent}
{indent}                    const currentVersion = parseFloat(activeProject.processSettings?.version || "1.0");
{indent}                    const newVersion = (currentVersion + 0.1).toFixed(1);
{indent}
{indent}                    const restoredSettings = {{
{indent}                        ...restoreProcessData.settings,
{indent}                        version: newVersion,
{indent}                        updatedAt: new Date().toISOString()
{indent}                    }};
{indent}
{indent}                    const note = `[WIEDERHERSTELLUNG] Von v${{restoreProcessData.version}} wiederhergestellt → v${{newVersion}}. Begründung: ${{restoreProcessComment.trim()}}`;
{indent}
{indent}                    handleProcessSettingsSave(restoredSettings, note);
{indent}
{indent}                    setShowRestoreProcessDialog(false);
{indent}                    setRestoreProcessData(null);
{indent}                    setRestoreProcessComment("");
{indent}
{indent}                    toast({{
{indent}                        title: "Neue Version erstellt",
{indent}                        description: `Prozessparameter v${{newVersion}} wurde aus v${{restoreProcessData.version}} wiederhergestellt.`,
{indent}                    }});
{indent}                }}}}
{indent}            >
{indent}                <Save className="w-4 h-4 mr-2" />
{indent}                Wiederherstellen (neue Version erstellen)
{indent}            </Button>
{indent}        </DialogFooter>
{indent}    </DialogContent>
{indent}</Dialog>

'''
    content = content.replace(dialog_marker, restore_dialog + indent + dialog_marker, 1)
    changes += 1
    print("  ✅ D: Restore-Dialog eingefügt")


# ─── SPEICHERN ────────────────────────────────────────────────
with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\n  Fertig: {changes} Änderung(en) angewendet.")
PYTHON_PATCH

echo ""
echo "════════════════════════════════════════════════"
echo "  Patch abgeschlossen!"
echo "  Backup: ${TARGET}.bak"
echo ""
echo "  Bitte neu bauen:  npm run build:web"
echo "════════════════════════════════════════════════"