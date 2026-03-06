import { getData, setData, setDataAsync, isElectron } from "@/lib/electron-storage";
import React, { useRef, useState } from "react";
import { Download, Upload, Database, Settings, FileSpreadsheet, Lock, Unlock, Search, ChefHat, Archive, FolderOpen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import CryptoJS from "crypto-js";
import { LibraryIngredient, getLibraryIngredients } from "@/lib/ingredient-db";
import { SavedRecipe, getLibraryRecipes } from "@/lib/recipe-db";
import { getDeepLApiKey, setDeepLApiKey } from "@/lib/spec-generator";

// ... (IngredientPicker component remains unchanged)
export function IngredientPicker({ onSelect }: { onSelect: (ing: LibraryIngredient | SavedRecipe) => void }) {
  const [open, setOpen] = React.useState(false);
  const [ingredients, setIngredients] = React.useState<LibraryIngredient[]>([]);
  const [recipes, setRecipes] = React.useState<SavedRecipe[]>([]);
  const [searchTerm, setSearchTerm] = React.useState("");

  React.useEffect(() => {
    const load = () => {
      const storedIng = getData("quid-ingredient-db-clean");
      if (storedIng) {
        try {
          const parsed = Array.isArray(storedIng) ? storedIng : JSON.parse(storedIng);
          setIngredients(parsed.sort((a: any, b: any) => a.name.localeCompare(b.name)));
        } catch (e) { console.error(e); }
      }
      
      const storedRec = getLibraryRecipes();
      setRecipes(storedRec.sort((a, b) => a.name.localeCompare(b.name)));
    };
    load();
    window.addEventListener("storage-update", load);
    window.addEventListener("recipe-storage-update", load);
    return () => {
        window.removeEventListener("storage-update", load);
        window.removeEventListener("recipe-storage-update", load);
    };
  }, []);

  const filteredIngredients = ingredients.filter(ing => 
    ing.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ing.articleNumber && ing.articleNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredRecipes = recipes.filter(rec => 
    rec.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (rec.articleNumber && rec.articleNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" data-trigger-ingredient-picker="true">
           <Database className="w-4 h-4" />
           + Zutat hinzufügen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
         <DialogHeader>
            <DialogTitle>Zutat aus Bibliothek wählen</DialogTitle>
            <DialogDescription>Wählen Sie eine Zutat oder ein Rezept aus der Datenbank.</DialogDescription>
         </DialogHeader>
         
         <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suchen nach Name oder Artikelnummer..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
         </div>

         <Tabs defaultValue="ingredients" className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="ingredients">Zutaten ({filteredIngredients.length})</TabsTrigger>
              <TabsTrigger value="recipes">Rezepte ({filteredRecipes.length})</TabsTrigger>
            </TabsList>
            
            <TabsContent value="ingredients" className="flex-1 overflow-auto border rounded-md mt-2">
                <div className="p-4 space-y-2">
                    {filteredIngredients.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                            Keine passenden Zutaten gefunden.
                        </div>
                    ) : (
                        filteredIngredients.map(ing => (
                            <div key={ing.id} 
                                 className="flex items-center justify-between p-3 hover:bg-muted cursor-pointer rounded border"
                                 onClick={() => {
                                     onSelect(ing);
                                     setOpen(false);
                                     setSearchTerm(""); // Reset search
                                 }}
                            >
                                <div className="flex flex-col">
                                    <span className="font-medium">{ing.name}</span>
                                    <div className="text-xs text-muted-foreground flex gap-2">
                                        {ing.articleNumber && <span className="bg-muted px-1 rounded">#{ing.articleNumber}</span>}
                                        {ing.isMeat && <span className="text-red-600">Fleisch ({ing.meatSpecies || "?"})</span>}
                                        <span>Fett: {ing.nutrition?.fat || 0}%</span>
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm">Wählen</Button>
                            </div>
                        ))
                    )}
                </div>
            </TabsContent>
            
            <TabsContent value="recipes" className="flex-1 overflow-auto border rounded-md mt-2">
                <div className="p-4 space-y-2">
                    {filteredRecipes.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                            Keine passenden Rezepte gefunden.
                        </div>
                    ) : (
                        filteredRecipes.map(rec => (
                            <div key={rec.id} 
                                 className="flex items-center justify-between p-3 hover:bg-muted cursor-pointer rounded border bg-purple-50/50 border-purple-100"
                                 onClick={() => {
                                     onSelect({ isRecipe: true, item: rec } as any);
                                     setOpen(false);
                                     setSearchTerm(""); // Reset search
                                 }}
                            >
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <ChefHat className="w-4 h-4 text-purple-600" />
                                        <span className="font-medium">{rec.name}</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground flex gap-2 pl-6">
                                        {rec.articleNumber && <span className="bg-muted px-1 rounded">#{rec.articleNumber}</span>}
                                        <span>{rec.ingredients.length} Zutaten</span>
                                        <span>Verlust: {rec.cookingLoss}%</span>
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm" className="text-purple-700 hover:text-purple-900 hover:bg-purple-100">Als Unterrezeptur einfügen</Button>
                            </div>
                        ))
                    )}
                </div>
            </TabsContent>
         </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export function DataManagement() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State for Export Password Dialog
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportPassword, setExportPassword] = useState("");
  const [exportHint, setExportHint] = useState("");
  
  // State for Import Password Dialog
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importPassword, setImportPassword] = useState("");
  const [importHint, setImportHint] = useState<string | null>(null);
  const [pendingImportData, setPendingImportData] = useState<string | null>(null);

  // --- EXPORT FUNCTIONS ---

  const getProjects = () => {
      try {
          const data = getData("quid-projects-db-clean");
          return data ? data : [];
      } catch (e) { return []; }
  };

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

  const normalizeIngredientsFromExcelRows = (rows: any[]): LibraryIngredient[] => {
      return rows
          .map((row) => {
              const name = toText(row["Name"] ?? row["name"]);
              if (!name) return null;

              const fat = parseNum(row["Fett (%)"] ?? row["Fett"]);
              const protein = parseNum(row["Protein (%)"] ?? row["Protein"]);
              const water = parseNum(row["Wasser (%)"] ?? row["Wasser"]);
              const salt = parseNum(row["Salz (%)"] ?? row["Salz"]);
              const beffe = parseNum(row["BEFFE (%)"] ?? row["BEFFE"]);
              const energyKj = parseNum(row["Energie (kJ)"] ?? row["Energy (kJ)"]);
              const energyKcal = parseNum(row["Energie (kcal)"] ?? row["Energy (kcal)"]);
              const saturatedFat = parseNum(row["Ges. Fettsäuren (%)"] ?? row["Saturated fat (%)"]);
              const carbohydrates = parseNum(row["Kohlenhydrate (%)"] ?? row["Carbohydrates (%)"]);
              const sugar = parseNum(row["Zucker (%)"] ?? row["Sugar (%)"]);

              const nutrition: any = {};
              if (fat !== undefined) nutrition.fat = fat;
              if (protein !== undefined) nutrition.protein = protein;
              if (water !== undefined) nutrition.water = water;
              if (salt !== undefined) nutrition.salt = salt;
              if (beffe !== undefined) nutrition.beffe = beffe;
              if (energyKj !== undefined) nutrition.energyKj = energyKj;
              if (energyKcal !== undefined) nutrition.energyKcal = energyKcal;
              if (saturatedFat !== undefined) nutrition.saturatedFat = saturatedFat;
              if (carbohydrates !== undefined) nutrition.carbohydrates = carbohydrates;
              if (sugar !== undefined) nutrition.sugar = sugar;

              return {
                  id: toText(row["ID"] ?? row["Id"] ?? row["id"]) || crypto.randomUUID(),
                  name,
                  articleNumber: toText(row["Artikelnummer"] ?? row["articleNumber"]),
                  labelName: toText(row["Etikettentext"] ?? row["Labelname"] ?? row["labelName"]),
                  isMeat: parseBool(row["Ist Fleisch"] ?? row["isMeat"]),
                  isWater: parseBool(row["Ist Wasser"] ?? row["isWater"]),
                  meatSpecies: toText(row["Fleischart"] ?? row["meatSpecies"]) as any,
                  connectiveTissuePercent: parseNum(row["Bindegewebe (%)"] ?? row["connectiveTissuePercent"]),
                  meatProteinLimit: parseNum(row["Fleischeiweißgrenze (%)"] ?? row["meatProteinLimit"]),
                  quidRequiredDefault: parseBool(row["QUID Pflicht"] ?? row["quidRequiredDefault"]),
                  subIngredients: toText(row["Unterzutaten"] ?? row["subIngredients"]),
                  processingAids: toText(row["Verarbeitungshilfsstoffe"] ?? row["processingAids"]),
                  allergens: parseList(row["Allergene"] ?? row["allergens"]),
                  nutrition,
              } as LibraryIngredient;
          })
          .filter(Boolean) as LibraryIngredient[];
  };

  const handleExportBackup = async (options = { includeArchived: true, onlyArchived: false }) => {
      const zip = new JSZip();
      const attachmentHashToZipPath = new Map<string, string>();

      const hashAttachmentContent = (dataUrlOrRaw: string, fallbackName: string) => {
          try {
              const source = dataUrlOrRaw.startsWith("data:")
                  ? (dataUrlOrRaw.split(",")[1] || dataUrlOrRaw)
                  : dataUrlOrRaw;
              return CryptoJS.SHA256(source).toString(CryptoJS.enc.Hex);
          } catch {
              return `fallback_${fallbackName}_${dataUrlOrRaw.length}`;
          }
      };
      
      let projects = getProjects();
      let projectsToBackup = projects;

      // Filter projects based on backup options
      if (options.onlyArchived) {
          projectsToBackup = projects.filter((p: any) => p.status === 'archived');
      } else if (!options.includeArchived) {
          projectsToBackup = projects.filter((p: any) => p.status !== 'archived');
      }

      if (projectsToBackup.length === 0) {
          toast({ title: "Keine Projekte", description: "Es wurden keine Projekte für das Backup gefunden.", variant: "destructive" });
          return;
      }

      // Optimize: Create a lean version of projects for the JSON file (without base64 content)
      const leanProjects = projectsToBackup.map((p: any) => ({
          ...p,
          timeline: p.timeline.map((e: any) => {
              if (e.attachmentContent) {
                  const { attachmentContent, ...rest } = e;
                  return rest;
              }
              return e;
          })
      }));

      // 1. Projects (Lean Version)
      zip.file("projects.json", JSON.stringify(leanProjects, null, 2));

      // 2. Global Ingredients & Recipes
      const ingredientList = getData("quid-ingredient-db-clean") || [];
      const ingredientsData = JSON.stringify(ingredientList);
      if (ingredientsData) zip.file("ingredients.json", ingredientsData);

      const ingredientRows = (ingredientList as LibraryIngredient[]).map((ing) => ({
          ID: ing.id,
          Name: ing.name,
          Artikelnummer: ing.articleNumber || "",
          Etikettentext: ing.labelName || "",
          "Ist Fleisch": ing.isMeat ? "Ja" : "Nein",
          "Ist Wasser": ing.isWater ? "Ja" : "Nein",
          Fleischart: ing.meatSpecies || "",
          "Bindegewebe (%)": ing.connectiveTissuePercent ?? "",
          "Fleischeiweißgrenze (%)": ing.meatProteinLimit ?? "",
          "QUID Pflicht": ing.quidRequiredDefault ? "Ja" : "Nein",
          Unterzutaten: ing.subIngredients || "",
          Verarbeitungshilfsstoffe: ing.processingAids || "",
          Allergene: ing.allergens?.join(", ") || "",
          "Fett (%)": ing.nutrition?.fat ?? "",
          "Protein (%)": ing.nutrition?.protein ?? "",
          "Wasser (%)": ing.nutrition?.water ?? "",
          "Salz (%)": ing.nutrition?.salt ?? "",
          "BEFFE (%)": (ing.nutrition as any)?.beffe ?? "",
          "Energie (kJ)": (ing.nutrition as any)?.energyKj ?? "",
          "Energie (kcal)": (ing.nutrition as any)?.energyKcal ?? "",
          "Ges. Fettsäuren (%)": (ing.nutrition as any)?.saturatedFat ?? "",
          "Kohlenhydrate (%)": (ing.nutrition as any)?.carbohydrates ?? "",
          "Zucker (%)": (ing.nutrition as any)?.sugar ?? "",
      }));
      const wsIngredients = XLSX.utils.json_to_sheet(ingredientRows);
      const wbIngredients = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wbIngredients, wsIngredients, "Zutaten");
      zip.file("ingredients.xlsx", XLSX.write(wbIngredients, { type: "array", bookType: "xlsx" }));

      const recipesData = JSON.stringify(getData("quid-recipe-db-clean") || []);
      if (recipesData) zip.file("recipes.json", recipesData);

      // 2b. DeepL API Key
      const deeplKey = getDeepLApiKey();
      if (deeplKey) {
          zip.file("deepl-key.json", JSON.stringify({ apiKey: deeplKey }));
      }

      // 3. Readable Folder Structure (Customers -> Projects)
      const customersFolder = zip.folder("Kunden");
      
      for (let projectIndex = 0; projectIndex < projectsToBackup.length; projectIndex++) {
          const project = projectsToBackup[projectIndex];
          const customerName = project.customer || "Allgemein";
          const safeCustomerName = customerName.replace(/[^a-z0-9äöüß \-]/gi, '_');
          const safeProjectName = project.name.replace(/[^a-z0-9äöüß \-]/gi, '_');

          const projectFolder = customersFolder?.folder(safeCustomerName)?.folder(safeProjectName);
          
          if (projectFolder) {
              projectFolder.file("README.txt", `Projekt: ${project.name}\nKunde: ${project.customer}\nStatus: ${project.status}\nErstellt: ${project.createdAt}\nID: ${project.id}\n`);
              
              if (project.currentRecipe) {
                  projectFolder.file("rezeptur.json", JSON.stringify(project.currentRecipe, null, 2));
              }

              // Timeline Attachments
              const filesFolder = projectFolder.folder("Dateien");
              for (let eventIndex = 0; eventIndex < (project.timeline || []).length; eventIndex++) {
                  const event = project.timeline[eventIndex];
                  if (event.attachment) {
                      const zipFilePath = `Kunden/${safeCustomerName}/${safeProjectName}/Dateien/${event.attachment}`;
                      let contentDataForHash: string | null = null;

                      // Electron: load from file system via path
                      if (isElectron() && window.electronAPI && event.attachmentPath) {
                          try {
                              const fileInfo = await window.electronAPI.loadProjectFile(event.attachmentPath);
                              if (fileInfo?.data) {
                                  contentDataForHash = fileInfo.data;
                                  const hash = hashAttachmentContent(contentDataForHash!, event.attachment || "unknown");
                                  const existingPath = attachmentHashToZipPath.get(hash);
                                  if (existingPath) {
                                      leanProjects[projectIndex].timeline[eventIndex].attachmentRef = existingPath;
                                      continue;
                                  }

                                  // Convert data URL to binary
                                  const arr = fileInfo.data.split(',');
                                  const bstr = atob(arr[1]);
                                  let n = bstr.length;
                                  const u8arr = new Uint8Array(n);
                                  while(n--){ u8arr[n] = bstr.charCodeAt(n); }
                                  filesFolder?.file(event.attachment, u8arr);
                                  attachmentHashToZipPath.set(hash, zipFilePath);
                              }
                          } catch (e) {
                              console.error("Failed to load file for backup:", event.attachment, e);
                          }
                      }
                      // Browser/legacy: base64 content inline
                      else if (event.attachmentContent) {
                          contentDataForHash = event.attachmentContent;
                          const hash = hashAttachmentContent(contentDataForHash!, event.attachment || "unknown");
                          const existingPath = attachmentHashToZipPath.get(hash);
                          if (existingPath) {
                              leanProjects[projectIndex].timeline[eventIndex].attachmentRef = existingPath;
                              continue;
                          }

                          let content: string | Blob = event.attachmentContent;
                          if (typeof content === 'string' && content.startsWith('data:')) {
                              try {
                                  const arr = content.split(',');
                                  const mimeMatch = arr[0].match(/:(.*?);/);
                                  if (mimeMatch) {
                                      const bstr = atob(arr[1]);
                                      let n = bstr.length;
                                      const u8arr = new Uint8Array(n);
                                      while(n--){ u8arr[n] = bstr.charCodeAt(n); }
                                      content = new Blob([u8arr], {type: mimeMatch[1]});
                                  }
                              } catch (e) {
                                  console.error("Failed to convert base64 to blob for backup", e);
                              }
                          }
                          filesFolder?.file(event.attachment, content);
                          attachmentHashToZipPath.set(hash, zipFilePath);
                      }
                  }
              }
          }
      }

      const content = await zip.generateAsync({ 
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: { level: 9 }
      });
      
      const filename = options.onlyArchived 
          ? `quid_archive_backup_${new Date().toISOString().split('T')[0]}.zip`
          : `quid_full_backup_${new Date().toISOString().split('T')[0]}.zip`;

      saveAs(content, filename);
      toast({ title: "Backup erstellt", description: options.onlyArchived ? "Archiv erfolgreich exportiert." : "Datensicherung erfolgreich erstellt." });
  };

  const handleExportIndividual = (type: 'ingredients' | 'recipes' | 'projects') => {
      let data: any;
      let filename = "";

      if (type === 'ingredients') {
          data = getLibraryIngredients();
          filename = `zutaten_export_${new Date().toISOString().split('T')[0]}.xlsx`;
          
          // Flatten data for Excel
          const excelData = data.map((ing: any) => ({
              Name: ing.name,
              Artikelnummer: ing.articleNumber || "",
              "Fleischart": ing.meatSpecies || "",
              "Ist Fleisch": ing.isMeat ? "Ja" : "Nein",
              "Fett (%)": ing.nutrition?.fat || 0,
              "Protein (%)": ing.nutrition?.protein || 0,
              "Wasser (%)": ing.nutrition?.water || 0,
              "Salz (%)": ing.nutrition?.salt || 0,
              "BEFFE (%)": ing.nutrition?.beffe || 0,
              "Zusatzstoffe": ing.additives?.join(", ") || "",
              "Allergene": ing.allergens?.join(", ") || ""
          }));

          const ws = XLSX.utils.json_to_sheet(excelData);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Zutaten");
          XLSX.writeFile(wb, filename);
          toast({ title: "Export erfolgreich", description: `${filename} wurde erstellt.` });
          return;

      } else if (type === 'recipes') {
          data = getLibraryRecipes();
          filename = `rezepte_backup_${new Date().toISOString().split('T')[0]}.json`;
      } else if (type === 'projects') {
          data = getProjects();
          filename = `projekte_backup_${new Date().toISOString().split('T')[0]}.json`;
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      saveAs(blob, filename);
      toast({ title: "Export erfolgreich", description: `${filename} wurde erstellt.` });
  };

  // --- IMPORT FUNCTIONS ---

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      
      // Handle ZIP
      if (file.name.endsWith('.zip')) {
          reader.onload = async (evt) => {
              try {
                  const zip = await JSZip.loadAsync(evt.target?.result as ArrayBuffer);
                  let restoredCount = 0;

                  // Restore Projects
                  const projectsFile = zip.file("projects.json");
                  if (projectsFile) {
                      const content = await projectsFile.async("string");
                      let projects = JSON.parse(content);

                      // Re-hydrate attachment content from ZIP (supports deduplicated attachmentRef)
                      for (const project of projects) {
                          const customer = (project.customer || "Allgemein").replace(/[^a-z0-9äöüß \-]/gi, '_');
                          const projectName = (project.name || "Unbenannt").replace(/[^a-z0-9äöüß \-]/gi, '_');
                          if (!project.timeline) continue;
                          for (const event of project.timeline) {
                              if (event.attachment && !event.attachmentContent) {
                                  const ownPath = `Kunden/${customer}/${projectName}/Dateien/${event.attachment}`;
                                  const fileInZip = zip.file(ownPath) || (event.attachmentRef ? zip.file(event.attachmentRef) : null);
                                  if (fileInZip) {
                                      const b64 = await fileInZip.async("base64");
                                      event.attachmentContent = `data:application/octet-stream;base64,${b64}`;
                                  }
                              }
                          }
                      }

                      // In Electron: check if projects have base64 attachmentContent
                      // and save those files to disk, replacing with file paths
                      if (isElectron() && window.electronAPI) {
                          for (const project of projects) {
                              const customer = project.customer || "Allgemein";
                              const projectName = project.name || "Unbenannt";
                              
                              if (project.timeline) {
                                  for (const event of project.timeline) {
                                      if (event.attachmentContent && event.attachment) {
                                          // Save base64 content as file
                                          const relPath = await window.electronAPI.saveProjectFile(
                                              customer, projectName, event.attachment, event.attachmentContent
                                          );
                                          if (relPath) {
                                              // Replace base64 with file path
                                              event.attachmentPath = relPath;
                                              delete event.attachmentContent;
                                          }
                                      }
                                  }
                              }
                          }
                      }

                      await setDataAsync("quid-projects-db-clean", projects);
                      restoredCount++;
                  }

                  // Restore Ingredients (prefer editable Excel if present)
                  const ingredientsExcelFile = zip.file("ingredients.xlsx");
                  if (ingredientsExcelFile) {
                      const content = await ingredientsExcelFile.async("arraybuffer");
                      const wb = XLSX.read(content, { type: "array" });
                      const firstSheet = wb.SheetNames[0];
                      if (firstSheet) {
                          const rows = XLSX.utils.sheet_to_json(wb.Sheets[firstSheet], { defval: "" });
                          const normalized = normalizeIngredientsFromExcelRows(rows as any[]);
                          await setDataAsync("quid-ingredient-db-clean", normalized);
                          window.dispatchEvent(new Event("storage-update"));
                          restoredCount++;
                      }
                  } else {
                      const ingredientsFile = zip.file("ingredients.json");
                      if (ingredientsFile) {
                          const content = await ingredientsFile.async("string");
                          await setDataAsync("quid-ingredient-db-clean", JSON.parse(content));
                          window.dispatchEvent(new Event("storage-update"));
                          restoredCount++;
                      }
                  }

                  // Restore Recipes
                  const recipesFile = zip.file("recipes.json");
                  if (recipesFile) {
                      const content = await recipesFile.async("string");
                      await setDataAsync("quid-recipe-db-clean", JSON.parse(content));
                      window.dispatchEvent(new Event("recipe-storage-update"));
                      restoredCount++;
                  }

                  // Restore DeepL API Key
                  const deeplFile = zip.file("deepl-key.json");
                  if (deeplFile) {
                      try {
                          const content = await deeplFile.async("string");
                          const parsed = JSON.parse(content);
                          if (parsed.apiKey) {
                              setDeepLApiKey(parsed.apiKey);
                          }
                      } catch (err) {
                          console.error("Failed to restore DeepL API key:", err);
                      }
                  }

                  // In Electron: also restore files from Kunden/ folder
                  if (isElectron() && window.electronAPI) {
                      const kundenFiles = Object.keys(zip.files).filter(
                          f => f.startsWith("Kunden/") && !zip.files[f].dir
                      );
                      for (const filePath of kundenFiles) {
                          try {
                              const fileData = await zip.files[filePath].async("base64");
                              await window.electronAPI.writeFileBase64(filePath, fileData);
                          } catch (err) {
                              console.error("Failed to restore file:", filePath, err);
                          }
                      }
                      if (kundenFiles.length > 0) {
                          console.log(`Restored ${kundenFiles.length} files from Kunden/ folder`);
                      }
                  }

                  if (restoredCount > 0) {
                       toast({ title: "Backup wiederhergestellt", description: `${restoredCount} Datensätze importiert. System wird aktualisiert...` });
                       setTimeout(() => window.location.reload(), 500);
                  } else {
                      toast({ title: "Fehler", description: "Keine gültigen Daten im ZIP gefunden.", variant: "destructive" });
                  }
              } catch (err) {
                  console.error(err);
                  toast({ title: "Import Fehler", description: "ZIP konnte nicht gelesen werden.", variant: "destructive" });
              }
          };
          reader.readAsArrayBuffer(file);
      } 
      // Handle JSON (Legacy or Single File)
      else {
          reader.onload = async (evt) => {
              try {
                  const json = JSON.parse(evt.target?.result as string);
                  
                  // Detect Type
                  if (Array.isArray(json)) {
                      // Heuristic check
                      if (json.length > 0 && json[0].isMeat !== undefined) {
                          // Ingredients
                          if(confirm(`Möchten Sie ${json.length} Zutaten importieren?`)) {
                              await setDataAsync("quid-ingredient-db-clean", json);
                              window.dispatchEvent(new Event("storage-update"));
                              toast({ title: "Zutaten importiert" });
                          }
                      } else if (json.length > 0 && json[0].cookingLoss !== undefined) {
                          // Recipes
                          if(confirm(`Möchten Sie ${json.length} Rezepte importieren?`)) {
                              await setDataAsync("quid-recipe-db-clean", json);
                              window.dispatchEvent(new Event("recipe-storage-update"));
                              toast({ title: "Rezepte importiert" });
                          }
                      } else {
                          // Assume Projects
                          if(confirm(`Möchten Sie ${json.length} Projekte importieren?`)) {
                              await setDataAsync("quid-projects-db-clean", json);
                              window.location.reload();
                          }
                      }
                  } else if (json.ingredients || json.recipes) {
                      // Mixed JSON (old format or custom)
                      toast({ title: "Format erkannt", description: "Bitte nutzen Sie ZIP für Komplett-Backups." });
                  }
              } catch (e) {
                  toast({ title: "Fehler", description: "Ungültiges JSON Format.", variant: "destructive" });
              }
          };
          reader.readAsText(file);
      }
      
      // Reset
      if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept=".zip,.json" 
        onChange={handleImport} 
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
             <Database className="w-4 h-4" />
             Backup & Daten
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>System Datensicherung</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={() => handleExportBackup({ includeArchived: true, onlyArchived: false })} className="cursor-pointer font-medium">
             <Download className="w-4 h-4 mr-2" />
             Alles sichern (inkl. Archiv)
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => handleExportBackup({ includeArchived: false, onlyArchived: false })} className="cursor-pointer">
             <Download className="w-4 h-4 mr-2" />
             Nur aktive Projekte
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => handleExportBackup({ includeArchived: true, onlyArchived: true })} className="cursor-pointer">
             <Archive className="w-4 h-4 mr-2" />
             Nur Archiv sichern
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="cursor-pointer font-medium">
             <Upload className="w-4 h-4 mr-2" />
             Backup Wiederherstellen
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Einzel-Exporte</DropdownMenuLabel>
          
          <DropdownMenuItem onClick={() => handleExportIndividual('ingredients')} className="cursor-pointer">
             <FileSpreadsheet className="w-4 h-4 mr-2" />
             Nur Zutaten (Excel)
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => handleExportIndividual('recipes')} className="cursor-pointer">
             <ChefHat className="w-4 h-4 mr-2" />
             Nur Rezepte (JSON)
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={() => {
              if (confirm("WARNUNG: Möchten Sie wirklich ALLE Daten löschen und die App zurücksetzen? Dies kann nicht rückgängig gemacht werden.")) {
                  setData("quid-projects-db-clean", []); setData("quid-ingredient-db-clean", []); setData("quid-recipe-db-clean", []);
                  window.location.reload();
              }
          }} className="cursor-pointer text-red-600 focus:text-red-600">
             <Trash2 className="w-4 h-4 mr-2" />
             App zurücksetzen (Alles löschen)
          </DropdownMenuItem>

        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
