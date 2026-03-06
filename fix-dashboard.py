#!/usr/bin/env python3
"""
fix-dashboard.py — Fixes three bugs in product-dashboard.tsx:
  1. Missing import: setDeepLApiKey
  2. Landing page backup: leere Seite (async flow broken)
  3. productImage disappears (consequence of #2)

Usage:
  cd /workspaces/Development-Suit
  python3 fix-dashboard.py
"""

filepath = "client/src/pages/product-dashboard.tsx"

file_encoding = "utf-8"
try:
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
except UnicodeDecodeError:
    file_encoding = "latin-1"
    with open(filepath, "r", encoding="latin-1") as f:
        content = f.read()

changes = 0

# ═══════════════════════════════════════════════════
# FIX 1: Missing import for setDeepLApiKey
# ═══════════════════════════════════════════════════
print("═══ Fix 1: setDeepLApiKey Import ═══")

old_import = 'import { generateSpecificationExcel } from "@/lib/spec-generator";'
new_import = 'import { generateSpecificationExcel, setDeepLApiKey } from "@/lib/spec-generator";'

if 'setDeepLApiKey' not in content.split('import')[0:20] and old_import in content:
    # Check if import already exists elsewhere
    if new_import in content:
        print("  ⏭️  Bereits vorhanden")
    else:
        content = content.replace(old_import, new_import, 1)
        changes += 1
        print("  ✅ Import hinzugefügt: setDeepLApiKey")
elif 'import.*setDeepLApiKey' in content:
    print("  ⏭️  Bereits importiert")
else:
    # Fallback: search for any spec-generator import and extend it
    if 'generateSpecificationExcel, setDeepLApiKey' in content:
        print("  ⏭️  Bereits vorhanden")
    elif old_import in content:
        content = content.replace(old_import, new_import, 1)
        changes += 1
        print("  ✅ Import hinzugefügt")
    else:
        print("  ❌ spec-generator Import nicht gefunden!")


# ═══════════════════════════════════════════════════
# FIX 2: handleImportBackup - Eliminate FileReader,
#        make fully async so landing page can await it
# ═══════════════════════════════════════════════════
print("\n═══ Fix 2: handleImportBackup async flow ═══")

# The old function reads the file TWICE:
# 1. JSZip.loadAsync(file) for DeepL key
# 2. FileReader callback for everything else
# The FileReader is NOT awaitable → caller can't wait for it
#
# Fix: Use JSZip.loadAsync(file) for EVERYTHING, drop the FileReader

# Find the old function: from "const handleImportBackup" to the next "const fileImportRef"
fn_start_marker = '  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {'
fn_end_marker = '  const fileImportRef = useRef<HTMLInputElement>(null);'

if fn_start_marker in content and fn_end_marker in content:
    fn_start = content.index(fn_start_marker)
    fn_end = content.index(fn_end_marker)
    
    old_fn = content[fn_start:fn_end]
    
    new_fn = '''  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
          const zip = await JSZip.loadAsync(file);
          let restoredCount = 0;

          // Restore DeepL API Key
          const deeplFile = zip.file("deepl-key.json");
          if (deeplFile) {
              try {
                  const keyContent = await deeplFile.async("string");
                  const parsed = JSON.parse(keyContent);
                  if (parsed.apiKey) {
                      setDeepLApiKey(parsed.apiKey);
                  } else if (typeof parsed === "string") {
                      setDeepLApiKey(parsed.trim());
                  }
              } catch {
                  // Legacy format: plain string
                  const raw = await deeplFile.async("string");
                  if (raw.trim()) setDeepLApiKey(raw.trim());
              }
          }

          // Helper functions for ingredient normalization
          const parseBool = (value: any): boolean => {
              if (typeof value === "boolean") return value;
              const v = String(value ?? "").trim().toLowerCase();
              return ["ja", "true", "1", "x", "yes"].includes(v);
          };
          const parseNum = (value: any): number | undefined => {
              if (value === null || value === undefined || value === "") return undefined;
              const normalized = String(value).replace(",", ".");
              const n = Number(normalized);
              return Number.isFinite(n) ? n : undefined;
          };
          const parseList = (value: any): string[] | undefined => {
              const raw = String(value ?? "").trim();
              if (!raw) return undefined;
              const items = raw.split(",").map((s) => s.trim()).filter(Boolean);
              return items.length > 0 ? items : undefined;
          };
          const toText = (value: any): string | undefined => {
              const s = String(value ?? "").trim();
              return s ? s : undefined;
          };
          const normalizeIngredientsFromExcelRows = (rows: any[]) => {
              return rows.map((row) => {
                  const name = toText(row["Name"] ?? row["name"]);
                  if (!name) return null;
                  const nutrition: any = {};
                  const fat = parseNum(row["Fett (%)"] ?? row["Fett"]); if (fat !== undefined) nutrition.fat = fat;
                  const protein = parseNum(row["Protein (%)"] ?? row["Protein"]); if (protein !== undefined) nutrition.protein = protein;
                  const water = parseNum(row["Wasser (%)"] ?? row["Wasser"]); if (water !== undefined) nutrition.water = water;
                  const salt = parseNum(row["Salz (%)"] ?? row["Salz"]); if (salt !== undefined) nutrition.salt = salt;
                  const beffe = parseNum(row["BEFFE (%)"] ?? row["BEFFE"]); if (beffe !== undefined) nutrition.beffe = beffe;
                  const energyKj = parseNum(row["Energie (kJ)"] ?? row["Energy (kJ)"]); if (energyKj !== undefined) nutrition.energyKj = energyKj;
                  const energyKcal = parseNum(row["Energie (kcal)"] ?? row["Energy (kcal)"]); if (energyKcal !== undefined) nutrition.energyKcal = energyKcal;
                  const saturatedFat = parseNum(row["Ges. Fettsäuren (%)"] ?? row["Saturated fat (%)"]); if (saturatedFat !== undefined) nutrition.saturatedFat = saturatedFat;
                  const carbohydrates = parseNum(row["Kohlenhydrate (%)"] ?? row["Carbohydrates (%)"]); if (carbohydrates !== undefined) nutrition.carbohydrates = carbohydrates;
                  const sugar = parseNum(row["Zucker (%)"] ?? row["Sugar (%)"]); if (sugar !== undefined) nutrition.sugar = sugar;
                  return {
                      id: toText(row["ID"] ?? row["Id"] ?? row["id"]) || crypto.randomUUID(),
                      name,
                      articleNumber: toText(row["Artikelnummer"] ?? row["articleNumber"]),
                      labelName: toText(row["Etikettentext"] ?? row["Labelname"] ?? row["labelName"]),
                      isMeat: parseBool(row["Ist Fleisch"] ?? row["isMeat"]),
                      isWater: parseBool(row["Ist Wasser"] ?? row["isWater"]),
                      meatSpecies: toText(row["Fleischart"] ?? row["meatSpecies"]),
                      connectiveTissuePercent: parseNum(row["Bindegewebe (%)"] ?? row["connectiveTissuePercent"]),
                      meatProteinLimit: parseNum(row["Fleischeiweißgrenze (%)"] ?? row["meatProteinLimit"]),
                      quidRequiredDefault: parseBool(row["QUID Pflicht"] ?? row["quidRequiredDefault"]),
                      subIngredients: toText(row["Unterzutaten"] ?? row["subIngredients"]),
                      processingAids: toText(row["Verarbeitungshilfsstoffe"] ?? row["processingAids"]),
                      allergens: parseList(row["Allergene"] ?? row["allergens"]),
                      nutrition,
                  };
              }).filter(Boolean);
          };

          // 1. Restore Ingredients (prefer Excel if present)
          const ingredientsExcelFile = zip.file("ingredients.xlsx");
          if (ingredientsExcelFile) {
              const buf = await ingredientsExcelFile.async("arraybuffer");
              const wb = XLSX.read(buf, { type: "array" });
              const firstSheet = wb.SheetNames[0];
              if (firstSheet) {
                  const rows = XLSX.utils.sheet_to_json(wb.Sheets[firstSheet], { defval: "" });
                  const normalized = normalizeIngredientsFromExcelRows(rows as any[]);
                  sessionStorage.setItem("quid-ingredient-db-clean", JSON.stringify(normalized));
                  window.dispatchEvent(new Event("storage-update"));
                  restoredCount++;
              }
          } else {
              const ingredientsFile = zip.file("ingredients.json");
              if (ingredientsFile) {
                  const content = await ingredientsFile.async("string");
                  sessionStorage.setItem("quid-ingredient-db-clean", content);
                  window.dispatchEvent(new Event("storage-update"));
                  restoredCount++;
              }
          }

          // 2. Restore Recipes
          const recipesFile = zip.file("recipes.json");
          if (recipesFile) {
              const content = await recipesFile.async("string");
              sessionStorage.setItem("quid-recipe-db-clean", content);
              window.dispatchEvent(new Event("recipe-storage-update"));
              restoredCount++;
          }

          // 3. Restore Projects and re-hydrate attachments
          const projectsFile = zip.file("projects.json");
          if (projectsFile) {
              const content = await projectsFile.async("string");
              const importedProjects: Project[] = JSON.parse(content);
              
              const hydratedProjects = await Promise.all(importedProjects.map(async (p) => {
                  const customerName = p.customer || "Allgemein";
                  const safeCustomerName = customerName.replace(/[^a-z0-9äöüß \\-]/gi, '_');
                  const safeProjectName = p.name.replace(/[^a-z0-9äöüß \\-]/gi, '_');
                  
                  // Re-hydrate timeline attachments from ZIP
                  const hydratedTimeline = await Promise.all(p.timeline.map(async (event) => {
                      if (event.attachment && !event.attachmentContent) {
                          const filePath = `Kunden/${safeCustomerName}/${safeProjectName}/Dateien/${event.attachment}`;
                          let fileInZip = zip.file(filePath);
                          if (!fileInZip && event.attachmentRef) {
                              fileInZip = zip.file(event.attachmentRef);
                          }
                          if (fileInZip) {
                              const blob = await fileInZip.async("blob");
                              return new Promise<TimelineEvent>((resolve) => {
                                  const r = new FileReader();
                                  r.onload = (re) => resolve({ ...event, attachmentContent: re.target?.result as string });
                                  r.readAsDataURL(blob);
                              });
                          }
                      }
                      return event;
                  }));
                  
                  return { ...p, timeline: hydratedTimeline };
              }));

              setProjects(hydratedProjects);
              saveProjects(hydratedProjects);
              restoredCount++;
          }

          if (restoredCount > 0) {
              toast({ title: "System wiederhergestellt", description: "Daten wurden erfolgreich importiert." });
          } else {
              toast({ title: "Warnung", description: "Keine bekannten Daten in diesem Backup gefunden.", variant: "destructive" });
          }

      } catch (err) {
          console.error(err);
          toast({ title: "Fehler", description: "Backup konnte nicht gelesen werden.", variant: "destructive" });
      }
      
      // Reset input
      if (e.target) e.target.value = "";
  };
  
'''
    
    content = content[:fn_start] + new_fn + content[fn_end:]
    changes += 1
    print("  ✅ handleImportBackup komplett neu geschrieben (vollständig async)")
    print("     → Kein FileReader mehr, nur noch async/await")
    print("     → Landing Page kann await nutzen")
else:
    print("  ❌ Funktionsgrenzen nicht gefunden!")
    if fn_start_marker not in content:
        print(f"     Start-Marker fehlt")
    if fn_end_marker not in content:
        print(f"     End-Marker fehlt")


# ═══════════════════════════════════════════════════
# FIX 3: Landing page callback - await the import
# ═══════════════════════════════════════════════════
print("\n═══ Fix 3: Landing Page await ═══")

old_callback = '''onImportBackup={(e) => {
                  handleImportBackup(e);
                  handleStartLanding();
              }}'''

new_callback = '''onImportBackup={async (e) => {
                  await handleImportBackup(e);
                  handleStartLanding();
              }}'''

if old_callback in content:
    content = content.replace(old_callback, new_callback, 1)
    changes += 1
    print("  ✅ Landing Page: await handleImportBackup(e)")
else:
    print("  ⏭️  Callback nicht gefunden oder bereits gefixt")


# ═══════════════════════════════════════════════════
# SAVE
# ═══════════════════════════════════════════════════
with open(filepath, "w", encoding=file_encoding) as f:
    f.write(content)

print(f"\n═══ {changes} Änderung(en) angewendet ═══")

# Verify
with open(filepath, "r", encoding=file_encoding) as f:
    v = f.read()
print("\n═══ Verifikation ═══")
print(f"  setDeepLApiKey Import: {'✅' if 'import.*setDeepLApiKey' in v or 'setDeepLApiKey } from' in v or ', setDeepLApiKey' in v.split('\\n')[0:50].__repr__() else '❌'}")
# Simpler check
has_import = any('setDeepLApiKey' in line and 'import' in line for line in v.split('\\n')[:50])
print(f"  setDeepLApiKey in imports: {'✅' if has_import else '❌'}")
print(f"  FileReader in handleImportBackup: {'❌ NOCH DA' if 'reader.readAsArrayBuffer' in v.split('handleImportBackup')[1].split('fileImportRef')[0] else '✅ Entfernt'}")
print(f"  async onImportBackup: {'✅' if 'onImportBackup={async' in v else '❌'}")
print(f"  await handleImportBackup: {'✅' if 'await handleImportBackup' in v else '❌'}")