#!/usr/bin/env python3
"""
patch-v2.4.3.py - Fix text overflow in Restore Process Dialog
"""

filepath = "client/src/pages/product-dashboard.tsx"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

changes = 0

# 1. Dialog breiter
old1 = '<Dialog open={showRestoreProcessDialog} onOpenChange={setShowRestoreProcessDialog}>\n                <DialogContent className="max-w-md">'
new1 = '<Dialog open={showRestoreProcessDialog} onOpenChange={setShowRestoreProcessDialog}>\n                <DialogContent className="max-w-lg">'
if old1 in content:
    content = content.replace(old1, new1, 1)
    changes += 1
    print("  ✅ Dialog breiter (max-w-lg)")
else:
    print("  ⏭️  1: max-w-md nicht gefunden")

# 2. Beschreibung kürzer
old2 = 'Sie stellen Version {restoreProcessData?.version || "?"} als aktuelle Parameter wieder her.\n                            Dies erzeugt automatisch eine neue Version.'
new2 = 'Version <strong>{restoreProcessData?.version || "?"}</strong> wird wiederhergestellt. Es wird automatisch eine neue Version erzeugt.'
if old2 in content:
    content = content.replace(old2, new2, 1)
    changes += 1
    print("  ✅ Beschreibungstext kompakter")
else:
    print("  ⏭️  2: Description weicht ab")

# 3. Footer responsive
old3 = '<DialogFooter className="gap-2">'
# Only replace the one inside the restore dialog (check it's near showRestoreProcessDialog)
pos = content.find('Restore Process Version Dialog')
if pos != -1:
    footer_pos = content.find(old3, pos)
    if footer_pos != -1 and footer_pos < pos + 3000:
        content = content[:footer_pos] + '<DialogFooter className="flex-col sm:flex-row gap-2">' + content[footer_pos + len(old3):]
        changes += 1
        print("  ✅ Footer responsive (flex-col sm:flex-row)")
    else:
        print("  ⏭️  3: DialogFooter nicht im Restore-Dialog gefunden")
else:
    print("  ⏭️  3: Restore Dialog Marker fehlt")

# 4. Abbrechen-Button volle Breite auf mobil
old4 = '<Button variant="outline" onClick={() => setShowRestoreProcessDialog(false)}>\n                            Abbrechen\n                        </Button>'
new4 = '<Button variant="outline" onClick={() => setShowRestoreProcessDialog(false)} className="w-full sm:w-auto">\n                            Abbrechen\n                        </Button>'
if old4 in content:
    content = content.replace(old4, new4, 1)
    changes += 1
    print("  ✅ Abbrechen-Button responsive")
else:
    print("  ⏭️  4: Abbrechen-Button weicht ab")

# 5. Wiederherstellen-Button: Text kürzen + responsive
old5 = '''                            <Save className="w-4 h-4 mr-2" />\n                            Wiederherstellen (neue Version erstellen)'''
new5 = '''                            <Save className="w-4 h-4 mr-2 shrink-0" />\n                            Wiederherstellen'''
# Use the raw text approach instead
if 'Wiederherstellen (neue Version erstellen)' in content:
    content = content.replace('Wiederherstellen (neue Version erstellen)', 'Wiederherstellen', 1)
    content = content.replace('<Save className="w-4 h-4 mr-2" />', '<Save className="w-4 h-4 mr-2 shrink-0" />', 1)
    changes += 1
    print("  ✅ Button-Text gekürzt")
else:
    print("  ⏭️  5: Button-Text weicht ab")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\n  {changes} Änderung(en) angewendet.")
