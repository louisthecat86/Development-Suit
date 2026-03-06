#!/bin/bash

echo "---------------------------------------"
echo "QUiD Backup + FMEA Repair Patch"
echo "---------------------------------------"

########################################
# 1 FIX: Backup Import async machen
########################################

echo "Fixing backup import..."

sed -i 's/const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {/const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {/' client/src/pages/product-dashboard.tsx

########################################
# 2 FIX: ZIP Laden hinzufügen
########################################

echo "Injecting ZIP loader..."

awk '
/if \(!file\) return;/ {
print;
print "";
print "      const zip = await JSZip.loadAsync(file);";
print "";
next
}
1
' client/src/pages/product-dashboard.tsx > tmp && mv tmp client/src/pages/product-dashboard.tsx

########################################
# 3 FIX: DeepL API Key Restore
########################################

echo "Adding DeepL restore..."

awk '
/const zip = await JSZip.loadAsync\(file\);/ {
print;
print "";
print "      // Restore DeepL API Key";
print "      const deeplFile = zip.file(\"deepl-key.json\");";
print "      if (deeplFile) {";
print "          const key = await deeplFile.async(\"string\");";
print "          setDeepLApiKey(key.trim());";
print "      }";
print "";
next
}
1
' client/src/pages/product-dashboard.tsx > tmp && mv tmp client/src/pages/product-dashboard.tsx

########################################
# 4 FIX: FMEA Fragen sichtbar machen
########################################

echo "Repairing FMEA rendering..."

sed -i 's/{ccps.map((row) => (/{ccps.map((row) => {/' client/src/components/fmea-editor.tsx

awk '
/{ccps.map\(\(row\) => {/ {
print;
print "    const details = getDetailsForCcp(row);";
print "";
next
}
1
' client/src/components/fmea-editor.tsx > tmp && mv tmp client/src/components/fmea-editor.tsx

########################################
# 5 FIX: Kommentar-Feld aktivieren
########################################

echo "Adding comment support..."

awk '
/getDetailsForCcp/ {
print;
print "";
print "  const updateComment = (ccpId: string, questionId: string, comment: string) => {";
print "      setFmeaDetails((prev) => {";
print "          const updated = { ...prev };";
print "          if (!updated[ccpId]) return prev;";
print "          updated[ccpId] = updated[ccpId].map((q) =>";
print "              q.id === questionId ? { ...q, comment } : q";
print "          );";
print "          return updated;";
print "      });";
print "  };";
print "";
next
}
1
' client/src/components/fmea-editor.tsx > tmp && mv tmp client/src/components/fmea-editor.tsx

########################################
# Done
########################################

echo ""
echo "Patch applied successfully."
echo ""
echo "Next step:"
echo "npm run dev"
echo ""