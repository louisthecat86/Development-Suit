import { getData, setData } from "@/lib/electron-storage";
import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { 
  ArrowLeft, Search, Save, Trash2, FileText, 
  Calendar, ChefHat, Edit, ArrowRight, Download, Upload,
  Share2, Play, Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { useRecipeLibrary, SavedRecipe } from "@/lib/recipe-db";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ProjectRecipeEditor } from "@/components/project-recipe-editor";
import { QuidResult } from "@/lib/quid-calculator";

export default function RecipeDatabase() {
  const { recipes, remove, save } = useRecipeLibrary();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [, setLocation] = useLocation();
  const [editingRecipe, setEditingRecipe] = useState<SavedRecipe | null>(null);
  
  // Sandbox State
  const [sandboxRecipe, setSandboxRecipe] = useState<SavedRecipe | null>(null);
  const [sandboxResult, setSandboxResult] = useState<QuidResult | null>(null);
  const [showSandbox, setShowSandbox] = useState(false);
  
  // Save to Project State
  const [showSaveToProjectDialog, setShowSaveToProjectDialog] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [activeProjects, setActiveProjects] = useState<any[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredRecipes = recipes.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.articleNumber && r.articleNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Load projects for the dropdown
  useEffect(() => {
      if (showSaveToProjectDialog) {
          try {
              const data = getData("quid-projects-db-clean");
              if (data) {
                  const projects = data;
                  setActiveProjects((projects || []).filter((p: any) => p.status !== 'archived'));
              }
          } catch (e) { console.error(e); }
      }
  }, [showSaveToProjectDialog]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Möchten Sie dieses Rezept wirklich löschen?")) {
      remove(id);
      toast({
        title: "Gelöscht",
        description: "Rezept wurde entfernt.",
        variant: "destructive"
      });
    }
  };

  // Save to Library (Sandbox) State
  const [showSaveToLibraryDialog, setShowSaveToLibraryDialog] = useState(false);
  const [saveToLibraryName, setSaveToLibraryName] = useState("");
  const [saveToLibraryArticleNumber, setSaveToLibraryArticleNumber] = useState("");

  const handleOpenSandbox = (recipe: SavedRecipe) => {
      setSandboxRecipe({ ...recipe }); // Clone to avoid direct mutation
      setShowSandbox(true);
      // Pre-fill save dialog state
      setSaveToLibraryName(recipe.name);
      setSaveToLibraryArticleNumber(recipe.articleNumber || "");
  };

  const handleSandboxSaveToLibrary = () => {
        if (!sandboxRecipe || !saveToLibraryName.trim()) {
            toast({ title: "Fehler", description: "Bitte geben Sie einen Namen ein.", variant: "destructive" });
            return;
        }

        // Check for duplicates
        const existingRecipes = recipes; // from hook
        const duplicate = existingRecipes.find(r => 
            (r.articleNumber && saveToLibraryArticleNumber && r.articleNumber.trim() === saveToLibraryArticleNumber.trim()) &&
            r.id !== sandboxRecipe.id // Exclude self if we are editing the same ID
        );

        // If we are editing an existing recipe, check if the user wants to save as a NEW recipe or overwrite the CURRENT one.
        // But the dialog acts as a "Save As" if the ID is different?
        // Actually, let's always treat this as a potential "Save As" if the user changed the article number to something new.
        
        if (duplicate) {
            if (!confirm(`Eine Rezeptur mit der Artikelnummer "${saveToLibraryArticleNumber}" (${duplicate.name}) existiert bereits. Möchten Sie diese überschreiben?`)) {
                return;
            }
            // Overwrite logic - we need to make sure we use the DUPLICATE's ID
            const toSave = { 
                ...sandboxRecipe, 
                name: saveToLibraryName,
                articleNumber: saveToLibraryArticleNumber,
                id: duplicate.id, 
                updatedAt: new Date().toISOString() 
            };
            save(toSave);
            setSandboxRecipe(toSave); // Update current view to match
            toast({ title: "Bibliothek aktualisiert", description: `Rezept "${saveToLibraryName}" wurde aktualisiert.` });
        } else {
            // No duplicate found.
            // Check if we are modifying the current recipe (same Article Number/Name) or creating a new one?
            // If the article number is different from the original sandbox recipe, we should probably ask if they want to create a new one or rename the current one?
            // Simplification: If no duplicate exists, we just update the current one if ID matches, or create new if ID is new.
            
            // However, the user said: "er überschreibt aber einfach die rezeptur in der datenbank".
            // If I change the name/article number in the dialog, and it's NOT a duplicate, it currently updates the existing recipe (because I used sandboxRecipe.id below).
            
            // FIX: If the user changed the name or article number, we should arguably create a NEW recipe (Save Copy) OR ask.
            // But standard "Save" behavior usually updates the current document.
            // If the user wants to "Save As", we might need a separate button?
            // OR: We interpret "In Bibliothek speichern" as "Save" (Update).
            
            // Wait, if I opened Recipe A (ID 1). Changed it. Clicked Save.
            // Dialog shows "Recipe A". I change it to "Recipe B".
            // It updates ID 1 to be "Recipe B".
            // The user might have wanted to keep "Recipe A" and create "Recipe B".
            
            // Let's change the logic: Always ask if we should Overwrite or Create New if the name/article number changed?
            // Or simpler: Just treat it as an update unless the user specifically clicked a "Save as Copy" button?
            // The user complaint "er überschreibt einfach" suggests they wanted a choice or a copy.
            
            // Let's ADD a check: If name or article number CHANGED from the original, ask "Create Copy" or "Rename"?
            // But we don't have the *original* state easily here (sandboxRecipe is already updated in memory potentially?). 
            // Actually sandboxRecipe is the current state.
            
            // Let's look at the implementation below.
            // const toSave = { ...sandboxRecipe, ... } uses sandboxRecipe.id.
            // This means it UPDATES.
            
            // The user wants to "create a new one" effectively if they change the data.
            // "ich ändere ja effektiv etwas an dieser rezeptur und erstelle eine neue"
            
            // Let's give the user a choice in the dialog: "Speichern" (Update) vs "Als Kopie speichern" (New)?
            // Or better: If I change the data, just create a new one? No, that spams DB.
            
            // Let's stick to the current logic BUT ensure the user realizes what they are doing.
            // The "Overwrite" confirmation only happens on conflict.
            
            // Maybe the issue is that "In Bibliothek speichern" implies "Save changes to THIS recipe".
            // If they want a new one, they should change the Article Number to something unique.
            // If they change Article Number to unique, my code updates the current ID with new Article Number.
            // User might have expected: Old Recipe stays as is, New Recipe created.
            
            // SOLUTION: When saving, if the Name or Article Number is different from the loaded recipe, ask: "Als neue Rezeptur anlegen?" vs "Bestehende ändern?".
            // But that's complex UI.
            
            // Pragmantic approach:
            // Always create a NEW recipe if the name/article number doesn't match the ID's current stored data?
            // Let's try:
            
            const currentStored = recipes.find(r => r.id === sandboxRecipe.id);
            const isRenaming = currentStored && (currentStored.name !== saveToLibraryName || currentStored.articleNumber !== saveToLibraryArticleNumber);
            
            if (isRenaming) {
                 if (confirm(`Möchten Sie eine NEUE Rezeptur "${saveToLibraryName}" anlegen? \n(Klicken Sie 'Abbrechen', um die bestehende Rezeptur umzubenennen)`)) {
                     // Create NEW
                     const newRecipe = {
                        ...sandboxRecipe,
                        id: crypto.randomUUID(),
                        name: saveToLibraryName,
                        articleNumber: saveToLibraryArticleNumber,
                        updatedAt: new Date().toISOString()
                     };
                     save(newRecipe);
                     // Keep editing the NEW one? or the old one?
                     // Usually we switch to the new one.
                     setSandboxRecipe(newRecipe);
                     toast({ title: "Neue Rezeptur erstellt", description: `"${saveToLibraryName}" wurde als Kopie gespeichert.` });
                     setShowSaveToLibraryDialog(false);
                     return;
                 }
            }

            const toSave = {
                ...sandboxRecipe,
                name: saveToLibraryName,
                articleNumber: saveToLibraryArticleNumber,
                updatedAt: new Date().toISOString()
            };
            
            save(toSave);
            setSandboxRecipe(toSave);
            toast({ title: "Bibliothek aktualisiert", description: `Rezept "${saveToLibraryName}" gespeichert.` });
        }
        setShowSaveToLibraryDialog(false);
  };

  const handleSandboxUpdate = (updatedRecipe: SavedRecipe, result: QuidResult | null) => {
      setSandboxRecipe(updatedRecipe);
      setSandboxResult(result);
  };

  const handleSaveToProject = () => {
      if (!selectedProjectId || !sandboxRecipe) return;

      try {
          const data = getData("quid-projects-db-clean");
          if (!data) return;
          
          const projects = data;
          const projectIndex = projects.findIndex((p: any) => p.id === selectedProjectId);
          
          if (projectIndex >= 0) {
              const project = projects[projectIndex];
              
              // Calculate correct version number based on target project's timeline
              const recipeEvents = project.timeline.filter((e: any) => e.type === 'recipe');
              const nextVersionIndex = recipeEvents.length;
              const nextVersionString = `1.${nextVersionIndex}`;

              // Create Timeline Event with Diff/Snapshot
              const newEvent = {
                  id: Date.now(),
                  type: 'recipe',
                  title: `Rezeptur Version ${nextVersionString}`,
                  date: new Date().toISOString().split('T')[0],
                  user: 'User',
                  description: `Rezeptur "${sandboxRecipe.name}" aus Datenbank übernommen.`,
                  status: 'completed',
                  // Store the snapshot of the recipe at this point for hierarchy/history
                  value: JSON.stringify(sandboxRecipe),
                  changes: [
                      `Übernahme aus DB: ${sandboxRecipe.name}`,
                      `Neues Endgewicht: ${sandboxResult?.totalEndWeight.toFixed(3) || "?"} kg`
                  ]
              };

              // Update Project
              project.timeline = [newEvent, ...project.timeline];
              project.currentRecipe = sandboxRecipe;
              project.updatedAt = new Date().toISOString();
              project.latestResult = sandboxResult;

              projects[projectIndex] = project;
              setData("quid-projects-db-clean", projects);
              
              toast({ title: "Gespeichert", description: `Rezeptur wurde in Projekt "${project.name}" übernommen.` });
              setShowSaveToProjectDialog(false);
              setShowSandbox(false);
          }
      } catch (e) {
          console.error(e);
          toast({ title: "Fehler", description: "Konnte nicht gespeichert werden.", variant: "destructive" });
      }
  };

  const handleRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRecipe) {
      save(editingRecipe);
      setEditingRecipe(null);
      toast({ title: "Gespeichert", description: "Rezept wurde aktualisiert." });
    }
  };

  const handleExport = (recipe: SavedRecipe, e: React.MouseEvent) => {
    e.stopPropagation();
    const data = JSON.stringify(recipe, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${recipe.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        // Basic validation
        if (!json.name || !json.ingredients) {
            throw new Error("Ungültiges Rezept-Format");
        }
        
        // Ensure new ID to avoid collisions unless overwrite
        const existingRecipes = recipes; // from hook
        const duplicate = existingRecipes.find(r => 
            (r.articleNumber && json.articleNumber && r.articleNumber.trim() === json.articleNumber.trim())
        );
        
        if (duplicate) {
             if (!confirm(`Importkonflikt: Artikelnummer "${json.articleNumber}" existiert bereits (${duplicate.name}). Überschreiben?`)) {
                 toast({ title: "Import abgebrochen", description: "Vorgang vom Benutzer beendet." });
                 if (fileInputRef.current) fileInputRef.current.value = "";
                 return;
             }
             // Overwrite
             const newRecipe = {
                ...json,
                id: duplicate.id, // Maintain ID
                name: `${json.name} (Importiert)`,
                updatedAt: new Date().toISOString()
            };
            save(newRecipe);
            toast({ title: "Import erfolgreich", description: `Rezept "${newRecipe.name}" wurde aktualisiert.` });
        } else {
            const newRecipe = {
                ...json,
                id: crypto.randomUUID(),
                name: `${json.name} (Importiert)`
            };
            
            save(newRecipe);
            toast({ title: "Import erfolgreich", description: `Rezept "${newRecipe.name}" wurde importiert.` });
        }
        
      } catch (err) {
        toast({ title: "Import Fehler", description: "Datei konnte nicht gelesen werden.", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="h-full flex flex-col font-sans">
      <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between items-center">
        <div>
           <h1 className="text-2xl font-bold tracking-tight">Rezept-Datenbank</h1>
           <p className="text-muted-foreground">Verwalten und simulieren Sie Ihre Rezepturen</p>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rezepte suchen..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2">
             <Button variant="default" size="sm" onClick={() => {
                 setSandboxRecipe({
                     id: crypto.randomUUID(),
                     name: "Neue Rezeptur",
                     updatedAt: new Date().toISOString(),
                     cookingLoss: 0,
                     ingredients: [],
                     lossType: 'drying'
                 });
                 setSandboxResult(null);
                 setShowSandbox(true);
                 // Reset save dialogs
                 setSaveToLibraryName("Neue Rezeptur");
                 setSaveToLibraryArticleNumber("");
             }}>
                <Plus className="w-4 h-4 mr-2" />
                Neu
             </Button>

              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" />
                Importieren
              </Button>
          </div>
          <input 
             type="file" 
             ref={fileInputRef} 
             className="hidden" 
             accept=".json" 
             onChange={handleImport} 
          />
        </div>
      </div>

        <div className="flex flex-col gap-3">
            {filteredRecipes.map((recipe) => (
                <div key={recipe.id} 
                    className="group flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 border rounded-lg bg-card hover:border-primary/50 transition-all cursor-pointer shadow-sm hover:shadow-md"
                    onClick={() => handleOpenSandbox(recipe)}
                >
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                            {recipe.articleNumber && (
                                <Badge variant="secondary" className="text-xs font-mono bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200">
                                    #{recipe.articleNumber}
                                </Badge>
                            )}
                            <h3 className="text-lg font-semibold truncate group-hover:text-primary transition-colors">{recipe.name}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                            {recipe.description || "Keine Beschreibung"}
                        </p>
                        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                                <span className="font-medium text-foreground">{recipe.ingredients.length}</span> Zutaten
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="font-medium text-foreground">{recipe.cookingLoss}%</span> Garverlust
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Calendar className="w-3 h-3" />
                                {new Date(recipe.updatedAt).toLocaleDateString()}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                        <Button 
                            size="sm" 
                            variant="secondary" 
                            className="flex-1 sm:flex-none gap-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                        >
                            <Play className="w-3.5 h-3.5" />
                            <span className="sm:hidden lg:inline">Öffnen</span>
                        </Button>
                        
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={(e) => handleExport(recipe, e)} title="Exportieren">
                                <Share2 className="w-4 h-4" />
                            </Button>

                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); setEditingRecipe(recipe); }}>
                                        <Edit className="w-4 h-4" />
                                    </Button>
                                </DialogTrigger>
                                <DialogContent onClick={e => e.stopPropagation()}>
                                    <DialogHeader>
                                        <DialogTitle>Rezept umbenennen</DialogTitle>
                                    </DialogHeader>
                                    {editingRecipe && (
                                        <form onSubmit={handleRename} className="space-y-4">
                                            <div className="space-y-2">
                                                <Label>Name</Label>
                                                <Input 
                                                    value={editingRecipe.name} 
                                                    onChange={e => setEditingRecipe({...editingRecipe, name: e.target.value})} 
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Beschreibung</Label>
                                                <Input 
                                                    value={editingRecipe.description || ""} 
                                                    onChange={e => setEditingRecipe({...editingRecipe, description: e.target.value})} 
                                                />
                                            </div>
                                            <DialogFooter>
                                                <Button type="submit">Speichern</Button>
                                            </DialogFooter>
                                        </form>
                                    )}
                                </DialogContent>
                            </Dialog>

                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={(e) => handleDelete(recipe.id, e)}>
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            ))}
            
            {filteredRecipes.length === 0 && (
                <div className="py-12 text-center text-muted-foreground border-2 border-dashed rounded-lg bg-slate-50/50">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>Keine Rezepte gefunden.</p>
                    <p className="text-sm mt-2">Speichern Sie Rezepte direkt aus dem Rechner.</p>
                </div>
            )}
        </div>

      {/* SANDBOX DIALOG */}
      <Dialog open={showSandbox} onOpenChange={setShowSandbox}>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 gap-0">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50/50">
                <div>
                    <DialogTitle className="text-xl">Rezeptur-Simulation</DialogTitle>
                    <DialogDescription>
                        Bearbeiten Sie "{sandboxRecipe?.name}" ohne Auswirkungen auf Projekte.
                    </DialogDescription>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowSaveToProjectDialog(true)}>
                        <Upload className="w-4 h-4 mr-2" />
                        In Projekt übernehmen
                    </Button>
                    <Dialog open={showSaveToLibraryDialog} onOpenChange={setShowSaveToLibraryDialog}>
                        <DialogTrigger asChild>
                            <Button>
                                <Save className="w-4 h-4 mr-2" />
                                In Bibliothek speichern
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Rezeptur speichern</DialogTitle>
                                <DialogDescription>
                                    Speichern Sie die Änderungen an der Rezeptur in der Datenbank.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Name der Rezeptur</Label>
                                    <Input 
                                        value={saveToLibraryName} 
                                        onChange={(e) => setSaveToLibraryName(e.target.value)} 
                                        placeholder="z.B. Salami Standard"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Artikelnummer (Optional)</Label>
                                    <Input 
                                        value={saveToLibraryArticleNumber} 
                                        onChange={(e) => setSaveToLibraryArticleNumber(e.target.value)} 
                                        placeholder="z.B. 10050"
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleSandboxSaveToLibrary}>Speichern</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
            
            <div className="flex-1 overflow-auto p-6 bg-slate-50/30">
                {sandboxRecipe && (
                    <ProjectRecipeEditor 
                        initialRecipe={sandboxRecipe} 
                        onSave={handleSandboxUpdate} 
                        autoSave={true}
                        mode="sandbox" 
                    />
                )}
            </div>
        </DialogContent>
      </Dialog>

      {/* SAVE TO PROJECT DIALOG */}
      <Dialog open={showSaveToProjectDialog} onOpenChange={setShowSaveToProjectDialog}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>In Projekt übernehmen</DialogTitle>
                  <DialogDescription>
                      Wählen Sie das Projekt, in das diese Rezeptur übernommen werden soll. 
                      Dies wird als neue Version in der Projekt-Timeline gespeichert.
                  </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                  <Label>Ziel-Projekt</Label>
                  <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                      <SelectTrigger className="w-full mt-2">
                          <SelectValue placeholder="Projekt auswählen..." />
                      </SelectTrigger>
                      <SelectContent>
                          {activeProjects.length === 0 ? (
                              <div className="p-2 text-sm text-muted-foreground text-center">Keine aktiven Projekte gefunden</div>
                          ) : (
                              activeProjects.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                      {p.customer ? `${p.customer}: ` : ""}{p.name}
                                  </SelectItem>
                              ))
                          )}
                      </SelectContent>
                  </Select>
              </div>
              <DialogFooter>
                  <Button variant="ghost" onClick={() => setShowSaveToProjectDialog(false)}>Abbrechen</Button>
                  <Button onClick={handleSaveToProject} disabled={!selectedProjectId}>Übernehmen</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}
