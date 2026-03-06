#!/bin/bash
# ════════════════════════════════════════════════════════════
# install-all-changes.sh
#
# Installiert ALLE 6 Änderungen auf einen Schlag:
#   1. DeepL API-Key im Backup
#   2. Entscheidungsbaum-Bild
#   3. FMEA Fragen/Antworten + Kommentare
#   4. Prozess-Historie aufklappbar
#   5. Wiederherstellung → Pflichtkommentar + neue Version
#   6. Statistik: nur Entwicklung + Produktion
#
# Verwendung:
#   cd /pfad/zum/projekt-root
#   bash install-all-changes.sh
# ════════════════════════════════════════════════════════════
set -e

# Determine script directory (where the files are)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check we're in the right directory
if [ ! -f "client/src/App.tsx" ]; then
    echo "❌ Bitte im Projekt-Root ausführen (wo client/src/App.tsx liegt)"
    exit 1
fi

echo "═══════════════════════════════════════════════"
echo "  Development Suite - Patch v2.4.1"
echo "═══════════════════════════════════════════════"
echo ""

# ─── SCHRITT 1: Backups erstellen ──────────────────
echo "📦 Backups erstellen..."
for f in \
    client/src/components/data-management.tsx \
    client/src/components/fmea-editor.tsx \
    client/src/components/fmea-decision-tree-dialog.tsx \
    client/src/pages/statistics.tsx \
    client/src/pages/product-dashboard.tsx; do
    if [ -f "$f" ]; then
        cp "$f" "${f}.bak"
    fi
done
echo "  ✅ Backups erstellt (.bak)"

# ─── SCHRITT 2: Bild kopieren ─────────────────────
echo ""
echo "🖼️  Entscheidungsbaum-Bild..."
mkdir -p attached_assets
if [ -f "$SCRIPT_DIR/image_1771493134781.png" ]; then
    cp "$SCRIPT_DIR/image_1771493134781.png" attached_assets/image_1771493134781.png
    echo "  ✅ Bild nach attached_assets/ kopiert"
else
    echo "  ⚠️  Bild nicht im Script-Ordner gefunden."
    echo "     Bitte manuell nach attached_assets/image_1771493134781.png kopieren!"
fi

# ─── SCHRITT 3: Component-Dateien ersetzen ─────────
echo ""
echo "📄 Dateien ersetzen..."
for f in data-management.tsx fmea-editor.tsx fmea-decision-tree-dialog.tsx; do
    if [ -f "$SCRIPT_DIR/$f" ]; then
        cp "$SCRIPT_DIR/$f" "client/src/components/$f"
        echo "  ✅ components/$f"
    else
        echo "  ❌ $f nicht gefunden im Script-Ordner!"
    fi
done

if [ -f "$SCRIPT_DIR/statistics.tsx" ]; then
    cp "$SCRIPT_DIR/statistics.tsx" "client/src/pages/statistics.tsx"
    echo "  ✅ pages/statistics.tsx"
else
    echo "  ❌ statistics.tsx nicht gefunden!"
fi

# ─── SCHRITT 4+5: product-dashboard.tsx patchen ───
echo ""
echo "🔧 product-dashboard.tsx patchen (Punkt 4 + 5)..."

python3 << 'PYTHON_PATCH'
import sys

filepath = "client/src/pages/product-dashboard.tsx"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

changes = 0

# ─── A: State-Variablen ───
marker = 'const [activeTab, setActiveTab] = useState("timeline");'
if "showRestoreProcessDialog" not in content and marker in content:
    content = content.replace(marker, marker + '''

  // Restore Process Dialog State (Punkt 5)
  const [showRestoreProcessDialog, setShowRestoreProcessDialog] = useState(false);
  const [restoreProcessData, setRestoreProcessData] = useState<{ version: string; settings: ProcessSettings } | null>(null);
  const [restoreProcessComment, setRestoreProcessComment] = useState("");''', 1)
    changes += 1
    print("  ✅ A: State-Variablen eingefügt")
else:
    print("  ⏭️  A: Bereits vorhanden oder Marker fehlt")

# ─── B: pointer-events-none entfernen (2. Vorkommen = ProcessParametersEditor) ───
pe = "pointer-events-none opacity-90 select-none"
pe_count = content.count(pe)
if pe_count >= 2:
    first = content.index(pe)
    second = content.index(pe, first + 1)
    content = content[:second] + "opacity-90 select-none" + content[second + len(pe):]
    changes += 1
    print("  ✅ B: pointer-events-none entfernt (Prozess-Historie aufklappbar)")
elif pe_count == 1:
    pos = content.index(pe)
    if "ProcessParametersEditor" in content[pos:pos+300]:
        content = content.replace(pe, "opacity-90 select-none", 1)
        changes += 1
        print("  ✅ B: pointer-events-none entfernt")
    else:
        print("  ⏭️  B: Einziges Vorkommen gehört zu RecipeEditor")
else:
    print("  ⏭️  B: Kein pointer-events-none gefunden")

# ─── C: Restore-Button ersetzen ───
restore_text = 'Diesen alten Stand als aktuelle Prozessparameter wiederherstellen'
if restore_text in content:
    pos = content.index(restore_text)
    footer_start = content.rfind("<DialogFooter>", 0, pos)
    footer_end = content.find("</DialogFooter>", pos)
    if footer_start != -1 and footer_end != -1:
        footer_end += len("</DialogFooter>")
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
    print("  ⏭️  C: Restore-Text nicht gefunden")

# ─── D: Restore-Dialog einfügen ───
dialog_marker = "{/* Label Checklist Dialog */}"
if dialog_marker in content and '<Dialog open={showRestoreProcessDialog}' not in content:
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
{indent}                        von Version {{restoreProcessData?.version || "?"}} ersetzt.
{indent}                    </div>
{indent}                </div>
{indent}            </div>
{indent}            <div className="space-y-2">
{indent}                <Label>
{indent}                    Begründung <span className="text-red-500">*</span>
{indent}                </Label>
{indent}                <Textarea
{indent}                    placeholder="Warum wird dieser alte Stand wiederhergestellt?"
{indent}                    value={{restoreProcessComment}}
{indent}                    onChange={{(e) => setRestoreProcessComment(e.target.value)}}
{indent}                    className="min-h-[100px]"
{indent}                />
{indent}                {{restoreProcessComment.trim().length === 0 && (
{indent}                    <p className="text-xs text-red-500">Pflichtfeld</p>
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
{indent}                    const currentV = parseFloat(activeProject.processSettings?.version || "1.0");
{indent}                    const newV = (currentV + 0.1).toFixed(1);
{indent}                    const restored = {{
{indent}                        ...restoreProcessData.settings,
{indent}                        version: newV,
{indent}                        updatedAt: new Date().toISOString()
{indent}                    }};
{indent}                    handleProcessSettingsSave(restored,
{indent}                        `[WIEDERHERSTELLUNG] Von v${{restoreProcessData.version}} → v${{newV}}. Begründung: ${{restoreProcessComment.trim()}}`
{indent}                    );
{indent}                    setShowRestoreProcessDialog(false);
{indent}                    setRestoreProcessData(null);
{indent}                    setRestoreProcessComment("");
{indent}                    toast({{
{indent}                        title: "Neue Version erstellt",
{indent}                        description: `v${{newV}} aus v${{restoreProcessData.version}} wiederhergestellt.`,
{indent}                    }});
{indent}                }}}}
{indent}            >
{indent}                <Save className="w-4 h-4 mr-2" />
{indent}                Wiederherstellen (neue Version)
{indent}            </Button>
{indent}        </DialogFooter>
{indent}    </DialogContent>
{indent}</Dialog>

'''
    content = content.replace(dialog_marker, restore_dialog + indent + dialog_marker, 1)
    changes += 1
    print("  ✅ D: Restore-Dialog eingefügt")
else:
    if '<Dialog open={showRestoreProcessDialog}' in content:
        print("  ⏭️  D: Dialog bereits vorhanden")
    else:
        print("  ❌ D: Label-Checklist-Marker nicht gefunden")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\n  Dashboard: {changes} Änderung(en) angewendet")
PYTHON_PATCH

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✅ Installation abgeschlossen!"
echo ""
echo "  Backups liegen als .bak neben den Originalen."
echo "  Bitte neu bauen: npm run build:web"
echo "═══════════════════════════════════════════════"
