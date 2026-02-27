import { getData, setData } from "@/lib/electron-storage";
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
          const parsed = JSON.parse(storedIng);
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
                                     onSelect({ isRecipe: true, item: rec });
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
          return data ? JSON.parse(data) : [];
      } catch (e) { return []; }
  };

  const handleExportBackup = async (options = { includeArchived: true, onlyArchived: false }) => {
      const zip = new JSZip();
      
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
      const ingredientsData = JSON.stringify(getData("quid-ingredient-db-clean") || []);
      if (ingredientsData) zip.file("ingredients.json", ingredientsData);

      const recipesData = JSON.stringify(getData("quid-recipe-db-clean") || []);
      if (recipesData) zip.file("recipes.json", recipesData);

      // 3. Readable Folder Structure (Customers -> Projects)
      const customersFolder = zip.folder("Kunden");
      
      projectsToBackup.forEach((project: any) => {
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
              project.timeline?.forEach((event: any) => {
                  if (event.attachment && event.attachmentContent) {
                      let content: string | Blob = event.attachmentContent;
                      
                      // Convert base64 to blob
                      if (typeof content === 'string' && content.startsWith('data:')) {
                          try {
                              const arr = content.split(',');
                              const mimeMatch = arr[0].match(/:(.*?);/);
                              if (mimeMatch) {
                                  const bstr = atob(arr[1]);
                                  let n = bstr.length;
                                  const u8arr = new Uint8Array(n);
                                  while(n--){
                                      u8arr[n] = bstr.charCodeAt(n);
                                  }
                                  content = new Blob([u8arr], {type: mimeMatch[1]});
                              }
                          } catch (e) {
                              console.error("Failed to convert base64 to blob for backup", e);
                          }
                      }
                      
                      filesFolder?.file(event.attachment, content);
                  }
              });
          }
      });

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
                      setData("quid-projects-db-clean", JSON.parse(content));
                      restoredCount++;
                  }

                  // Restore Ingredients
                  const ingredientsFile = zip.file("ingredients.json");
                  if (ingredientsFile) {
                      const content = await ingredientsFile.async("string");
                      setData("quid-ingredient-db-clean", JSON.parse(content));
                      window.dispatchEvent(new Event("storage-update"));
                      restoredCount++;
                  }

                  // Restore Recipes
                  const recipesFile = zip.file("recipes.json");
                  if (recipesFile) {
                      const content = await recipesFile.async("string");
                      setData("quid-recipe-db-clean", JSON.parse(content));
                      window.dispatchEvent(new Event("recipe-storage-update"));
                      restoredCount++;
                  }

                  if (restoredCount > 0) {
                       toast({ title: "Backup wiederhergestellt", description: "System wird aktualisiert..." });
                       setTimeout(() => window.location.reload(), 1000);
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
          reader.onload = (evt) => {
              try {
                  const json = JSON.parse(evt.target?.result as string);
                  
                  // Detect Type
                  if (Array.isArray(json)) {
                      // Heuristic check
                      if (json.length > 0 && json[0].isMeat !== undefined) {
                          // Ingredients
                          if(confirm(`Möchten Sie ${json.length} Zutaten importieren?`)) {
                              setData("quid-ingredient-db-clean", json);
                              window.dispatchEvent(new Event("storage-update"));
                              toast({ title: "Zutaten importiert" });
                          }
                      } else if (json.length > 0 && json[0].cookingLoss !== undefined) {
                          // Recipes
                          if(confirm(`Möchten Sie ${json.length} Rezepte importieren?`)) {
                              setData("quid-recipe-db-clean", json);
                              window.dispatchEvent(new Event("recipe-storage-update"));
                              toast({ title: "Rezepte importiert" });
                          }
                      } else {
                          // Assume Projects
                          if(confirm(`Möchten Sie ${json.length} Projekte importieren?`)) {
                              setData("quid-projects-db-clean", json);
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
