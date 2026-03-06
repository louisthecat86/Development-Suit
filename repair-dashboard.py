#!/usr/bin/env python3
"""
Reparatur-Script für product-dashboard.tsx
Analysiert den aktuellen Zustand und repariert gezielt.
"""
import sys

filepath = "client/src/pages/product-dashboard.tsx"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

print("═══ Zustandsanalyse ═══")
checks = {
    "A (State-Vars)": content.count("showRestoreProcessDialog"),
    "B (pointer-events)": content.count("pointer-events-none opacity-90 select-none"),
    "C (alter Restore-Text)": content.count("Diesen alten Stand als aktuelle Prozessparameter"),
    "C (neuer Dialog-Aufruf)": content.count("setShowRestoreProcessDialog(true)"),
    "D (Restore-Dialog)": content.count('<Dialog open={showRestoreProcessDialog}'),
}
for k, v in checks.items():
    print(f"  {k}: {v}x")

changes = 0

# ─── A: Sollte genau vorhanden sein (3 Zeilen) ───
# Bereits 2x gefunden = OK (useState + setShow...)
if checks["A (State-Vars)"] >= 2:
    print("\n✅ A: State-Variablen bereits vorhanden")
else:
    marker = 'const [activeTab, setActiveTab] = useState("timeline");'
    if marker in content:
        content = content.replace(marker, marker + '''

  // Restore Process Dialog State (Punkt 5)
  const [showRestoreProcessDialog, setShowRestoreProcessDialog] = useState(false);
  const [restoreProcessData, setRestoreProcessData] = useState<{ version: string; settings: ProcessSettings } | null>(null);
  const [restoreProcessComment, setRestoreProcessComment] = useState("");''', 1)
        changes += 1
        print("\n✅ A: State-Variablen eingefügt")
    else:
        print("\n❌ A: Marker nicht gefunden!")

# ─── B: pointer-events-none beim ProcessParametersEditor entfernen ───
pe = "pointer-events-none opacity-90 select-none"
if checks["B (pointer-events)"] == 0:
    print("✅ B: Bereits entfernt")
elif checks["B (pointer-events)"] == 1:
    # Prüfe ob das verbliebene zum RecipeEditor gehört
    pos = content.index(pe)
    context = content[pos:pos+300]
    if "ProjectRecipeEditor" in context:
        print("✅ B: Korrekt - nur RecipeEditor hat noch pointer-events-none")
    elif "ProcessParametersEditor" in context:
        content = content.replace(pe, "opacity-90 select-none", 1)
        changes += 1
        print("✅ B: pointer-events-none vom ProcessEditor entfernt")
    else:
        print("⚠️  B: Kontext unklar, überspringe")
elif checks["B (pointer-events)"] >= 2:
    # Zweites Vorkommen entfernen
    first = content.index(pe)
    second = content.index(pe, first + 1)
    content = content[:second] + "opacity-90 select-none" + content[second + len(pe):]
    changes += 1
    print("✅ B: Zweites pointer-events-none entfernt")

# ─── C: Restore-Button durch Dialog-Aufruf ersetzen ───
if checks["C (alter Restore-Text)"] > 0:
    # Original noch da → ersetzen
    pos = content.index("Diesen alten Stand als aktuelle Prozessparameter")
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
        print("✅ C: Restore-Button ersetzt")
elif checks["C (neuer Dialog-Aufruf)"] > 0:
    print("✅ C: Dialog-Aufruf bereits vorhanden")
else:
    print("⚠️  C: Weder alter noch neuer Text gefunden - manuell prüfen!")

# ─── D: Restore-Dialog einfügen ───
if checks["D (Restore-Dialog)"] > 0:
    print("✅ D: Restore-Dialog bereits vorhanden")
else:
    dialog_marker = "{/* Label Checklist Dialog */}"
    if dialog_marker in content:
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
        print("✅ D: Restore-Dialog eingefügt")
    else:
        print("❌ D: Label-Checklist-Marker nicht gefunden!")

# ─── Speichern ───
with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\n═══ Ergebnis: {changes} Änderung(en) angewendet ═══")

# ─── Verifikation ───
with open(filepath, "r") as f:
    final = f.read()
print("\n═══ Verifikation ═══")
print(f"  showRestoreProcessDialog: {final.count('showRestoreProcessDialog')}x (erwartet: >5)")
print(f"  pointer-events-none: {final.count('pointer-events-none opacity-90 select-none')}x (erwartet: 1, nur RecipeEditor)")
print(f"  Alter Restore-Text: {final.count('Diesen alten Stand als aktuelle Prozessparameter')}x (erwartet: 0)")
print(f"  Restore-Dialog: {final.count('<Dialog open={showRestoreProcessDialog}')}x (erwartet: 1)")
