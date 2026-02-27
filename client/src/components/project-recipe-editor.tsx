import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Scale, Save, ArrowRight, RotateCcw, Info, Copy, FileText, Download, GitBranch } from "lucide-react";
import { IngredientPicker } from "@/components/data-management";
import { MeatOptimizer } from "@/components/meat-optimizer";
import { calculateQuid, Ingredient, QuidResult } from "@/lib/quid-calculator";
import { SavedRecipe, saveLibraryRecipe } from "@/lib/recipe-db";
import { LibraryIngredient } from "@/lib/ingredient-db";
import { useToast } from "@/hooks/use-toast";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

interface ProjectRecipeEditorProps {
    initialRecipe?: SavedRecipe;
    onSave: (recipe: SavedRecipe, result: QuidResult | null, createSnapshot?: boolean) => void;
    autoSave?: boolean;
    readOnly?: boolean;
    onResultChange?: (result: QuidResult | null) => void;
    mode?: 'project' | 'sandbox';
}

export function ProjectRecipeEditor({ initialRecipe, onSave, autoSave = false, readOnly = false, onResultChange, mode = 'project' }: ProjectRecipeEditorProps) {
    const { toast } = useToast();
    
    // State
    const [ingredients, setIngredients] = useState<Ingredient[]>(initialRecipe?.ingredients || []);
    const [cookingLoss, setCookingLoss] = useState<number>(initialRecipe?.cookingLoss || 0);
    const [fatLoss, setFatLoss] = useState<number>(initialRecipe?.fatLoss || 0);
    const [lossType, setLossType] = useState<'drying' | 'cooking' | 'none'>(initialRecipe?.lossType || 'drying');
    
    // Recipe Metadata State (Name & Article Number)
    const [recipeName, setRecipeName] = useState(initialRecipe?.name || "");
    const [articleNumber, setArticleNumber] = useState(initialRecipe?.articleNumber || "");

    // Save to Library Dialog State
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [saveName, setSaveName] = useState("");
    const [saveArticleNumber, setSaveArticleNumber] = useState("");

    // Keep track of internal ID to force refresh when prop changes completely
    const [currentRecipeId, setCurrentRecipeId] = useState(initialRecipe?.id);

    const [result, setResult] = useState<QuidResult | null>(null);

    // Reset state if initialRecipe changes (e.g. switching projects)
    useEffect(() => {
        if (initialRecipe && initialRecipe.id !== currentRecipeId) {
            setIngredients(initialRecipe.ingredients);
            setCookingLoss(initialRecipe.cookingLoss);
            setFatLoss(initialRecipe.fatLoss || 0);
            setLossType(initialRecipe.lossType || 'drying');
            setCurrentRecipeId(initialRecipe.id);
            setSaveName(initialRecipe.name);
            setSaveArticleNumber(initialRecipe.articleNumber || "");
            setRecipeName(initialRecipe.name);
            setArticleNumber(initialRecipe.articleNumber || "");
        } else if (initialRecipe && !saveName) {
             setSaveName(initialRecipe.name);
             setSaveArticleNumber(initialRecipe.articleNumber || "");
             setRecipeName(initialRecipe.name);
             setArticleNumber(initialRecipe.articleNumber || "");
        }
    }, [initialRecipe, currentRecipeId]);

    // Calculate
    useEffect(() => {
        if (ingredients.length > 0) {
            const res = calculateQuid(ingredients, cookingLoss, fatLoss, lossType);
            setResult(res);
            
            // Auto-propagate changes up if desired, or just keep local until save
            if (autoSave || onResultChange) {
                 if (autoSave) {
                     onSave({
                         id: initialRecipe?.id || "temp",
                         name: recipeName || initialRecipe?.name || "Draft",
                         articleNumber: articleNumber,
                         updatedAt: new Date().toISOString(),
                         ingredients,
                         cookingLoss,
                         fatLoss,
                         lossType
                     }, res);
                 } else if (onResultChange) {
                     // Just notify about the result for preview, don't save persistence
                     onResultChange(res);
                 }
            }
        } else {
            setResult(null);
            // Also notify parent of empty state if needed
            if (autoSave && ingredients.length === 0) {
                onSave({
                     id: initialRecipe?.id || "temp",
                     name: recipeName || initialRecipe?.name || "Draft",
                     articleNumber: articleNumber,
                     updatedAt: new Date().toISOString(),
                     ingredients: [],
                     cookingLoss,
                     fatLoss,
                     lossType
                }, null);
            } else if (onResultChange) {
                onResultChange(null);
            }
        }
    }, [ingredients, cookingLoss, fatLoss, lossType, recipeName, articleNumber]);

    // Handlers
    const handleAddIngredient = (selection: any) => {
        // Unwrap selection from IngredientPicker (wrapper { isRecipe: boolean, item: ... } or direct object)
        let item = selection;
        let explicitRecipe = false;
        
        if (selection && typeof selection === 'object' && 'isRecipe' in selection) {
            item = selection.item;
            explicitRecipe = selection.isRecipe;
        }

        if (explicitRecipe || ('ingredients' in item && Array.isArray(item.ingredients))) {
            // Recipe (Sub-recipe) - Compound Ingredient Mode
            const recipeItem = item as SavedRecipe;
            
            // 1. Calculate Nutrition for the Sub-Recipe
            const subIngredientsForCalc: Ingredient[] = recipeItem.ingredients.map(ri => ({
                ...ri,
                id: crypto.randomUUID(),
                // Fix: Preserve original labelName if available, otherwise fallback to name
                labelName: ri.labelName || ri.name,
                articleNumber: "",
                subIngredients: ri.subIngredients || "",
                meatSpecies: ri.meatSpecies,
                nutrition: ri.nutrition || {},
                processingAids: ri.processingAids,
                allergens: ri.allergens
            }));

            const subResult = calculateQuid(
                subIngredientsForCalc, 
                recipeItem.cookingLoss || 0, 
                recipeItem.fatLoss || 0, 
                recipeItem.lossType || 'drying'
            );
            
            // 2. Generate Label Text
            const subLabelText = subResult.labelText;

            // 3. Create Compound Ingredient
            const compoundIng: Ingredient = {
                id: crypto.randomUUID(),
                name: recipeItem.name,
                labelName: recipeItem.name,
                articleNumber: recipeItem.articleNumber,
                rawWeight: 0,
                quidRequired: true,
                isMeat: false,
                isWater: false,
                
                nutrition: subResult.nutritionPer100g,
                subIngredients: subLabelText,
                allergens: subResult.allAllergens,
                processingAids: subResult.allProcessingAids.join(", "),
                isRecipe: true,
                
                // Store original data for recursive flattening (Label Generation)
                originalSubIngredients: subIngredientsForCalc,
                originalEndWeight: subResult.totalEndWeight,
                
                // New: Store the cooking loss of the sub-recipe
                processLoss: recipeItem.cookingLoss || 0
            };

            setIngredients(prev => [...prev, compoundIng]);
            toast({ title: "Unterrezeptur eingefügt", description: `"${item.name}" wurde als zusammengesetzte Zutat hinzugefügt.` });
        } else {
            // Regular Ingredient
            const ing: Ingredient = {
                id: crypto.randomUUID(),
                name: item.name,
                labelName: item.labelName,
                articleNumber: item.articleNumber,
                rawWeight: 0,
                quidRequired: item.quidRequiredDefault,
                isMeat: item.isMeat,
                isWater: item.isWater,
                meatSpecies: item.meatSpecies,
                connectiveTissuePercent: item.connectiveTissuePercent,
                meatProteinLimit: item.meatProteinLimit,
                nutrition: item.nutrition,
                subIngredients: item.subIngredients,
                processingAids: item.processingAids,
                allergens: item.allergens
            };
            setIngredients(prev => [...prev, ing]);
        }
    };

    const updateIngredient = (id: string, field: keyof Ingredient, value: any) => {
        setIngredients(prev => prev.map(ing => {
            if (ing.id === id) {
                return { ...ing, [field]: value };
            }
            return ing;
        }));
    };

    const removeIngredient = (id: string) => {
        setIngredients(prev => prev.filter(i => i.id !== id));
    };

    const handleClear = () => {
        if(confirm("Möchten Sie wirklich alle Zutaten entfernen?")) {
            setIngredients([]);
        }
    };

    const handleManualSave = (createSnapshot: boolean = false) => {
         onSave({
             id: initialRecipe?.id || "temp",
             name: recipeName || initialRecipe?.name || "Draft",
             articleNumber: articleNumber,
             updatedAt: new Date().toISOString(),
             ingredients,
             cookingLoss,
             fatLoss,
             lossType
         }, result, createSnapshot);
         
         if (createSnapshot) {
             toast({ title: "Neue Version erstellt", description: "Rezeptur wurde als neuer Stand in der Historie gespeichert." });
         } else {
             toast({ title: "Gespeichert", description: "Rezeptur wurde im Projekt aktualisiert." });
         }
    };

    const handleSaveToLibrary = () => {
        if (!saveName.trim()) {
            toast({ title: "Fehler", description: "Bitte geben Sie einen Namen ein.", variant: "destructive" });
            return;
        }

        // Check for duplicates
        const existingRecipes = JSON.parse(localStorage.getItem("quid-recipe-db-clean") || "[]") as SavedRecipe[];
        const duplicate = existingRecipes.find(r => 
            (r.articleNumber && saveArticleNumber && r.articleNumber.trim() === saveArticleNumber.trim()) &&
            r.id !== initialRecipe?.id
        );

        if (duplicate) {
            if (!confirm(`Eine Rezeptur mit der Artikelnummer "${saveArticleNumber}" (${duplicate.name}) existiert bereits. Möchten Sie diese überschreiben?`)) {
                return;
            }
            // Use existing ID to overwrite
            const newRecipe: SavedRecipe = {
                id: duplicate.id, // OVERWRITE
                name: saveName,
                articleNumber: saveArticleNumber,
                updatedAt: new Date().toISOString(),
                ingredients: ingredients,
                cookingLoss: cookingLoss,
                fatLoss: fatLoss,
                lossType: lossType,
                description: "Aus Projekt gespeichert (Überschrieben)"
            };
            saveLibraryRecipe(newRecipe);
            setShowSaveDialog(false);
            toast({ title: "Bibliothek aktualisiert", description: `Rezept "${saveName}" wurde aktualisiert.` });
            return;
        }

        const newRecipe: SavedRecipe = {
            id: crypto.randomUUID(),
            name: saveName,
            articleNumber: saveArticleNumber,
            updatedAt: new Date().toISOString(),
            ingredients: ingredients,
            cookingLoss: cookingLoss,
            fatLoss: fatLoss,
            lossType: lossType,
            description: "Aus Projekt gespeichert"
        };

        saveLibraryRecipe(newRecipe);
        setShowSaveDialog(false);
        toast({ title: "In Bibliothek gespeichert", description: `Rezept "${saveName}" wurde angelegt.` });
    };

    const copyLabelText = () => {
        if (result?.labelText) {
            navigator.clipboard.writeText(result.labelText);
            toast({ title: "Kopiert", description: "Etikett-Text in Zwischenablage." });
        }
    };

    return (
        <div className="space-y-6">
            {/* Top Stats Cards like in Screenshot */}
            <div className="grid grid-cols-2 gap-4">
                <Card className="bg-red-50/50 border-red-100 shadow-sm">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                        <div className="text-3xl font-bold text-red-900 font-mono">
                            {result ? result.totalRawMass.toLocaleString('de-DE', {minimumFractionDigits: 3}) : "0,000"} <span className="text-lg text-red-700">kg</span>
                        </div>
                        <div className="text-xs font-bold text-red-400 uppercase tracking-wider mt-1">Gesamt-Rohmasse</div>
                    </CardContent>
                </Card>
                <Card className="bg-primary text-primary-foreground shadow-sm">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                         <div className="text-3xl font-bold font-mono text-white">
                            {result ? result.totalEndWeight.toLocaleString('de-DE', {minimumFractionDigits: 3}) : "0,000"} <span className="text-lg opacity-80">kg</span>
                        </div>
                        <div className="text-xs font-bold opacity-70 uppercase tracking-wider mt-1">Endgewicht</div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border shadow-sm bg-white">
                <CardHeader className="pb-4 border-b bg-slate-50/50 p-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                             <div className="h-8 w-1 bg-primary rounded-full"></div>
                             <h3 className="font-semibold text-lg">Zutatenliste</h3>
                        </div>
                        <div className="flex gap-2">
                             {/* Toolbar: Hidden in ReadOnly Mode */}
                             {!readOnly && (
                                <>
                                 <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground hover:text-destructive h-8">
                                    <RotateCcw className="w-3 h-3 mr-2" /> Reset
                                 </Button>
                                 <MeatOptimizer 
                                    ingredients={ingredients} 
                                    cookingLoss={lossType === 'none' ? 0 : cookingLoss} 
                                    onApply={setIngredients} 
                                 />
                                 <IngredientPicker onSelect={handleAddIngredient} />
                                 
                                 {/* Save to Library / Template Button */}
                                 {(mode === 'project') && (
                                     <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                                            <DialogTrigger asChild>
                                                <Button variant="outline" size="sm" className="gap-2 h-8">
                                                    <Download className="w-4 h-4" /> In Bibliothek speichern
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>Rezeptur in Bibliothek speichern</DialogTitle>
                                                    <DialogDescription>
                                                        Speichern Sie die aktuelle Rezeptur als Vorlage, um sie in anderen Projekten wiederzuverwenden.
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <div className="space-y-4 py-4">
                                                    <div className="space-y-2">
                                                        <Label>Name der Rezeptur</Label>
                                                        <Input 
                                                            value={saveName} 
                                                            onChange={(e) => setSaveName(e.target.value)} 
                                                            placeholder="z.B. Salami Standard"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Artikelnummer (Optional)</Label>
                                                        <Input 
                                                            value={saveArticleNumber} 
                                                            onChange={(e) => setSaveArticleNumber(e.target.value)} 
                                                            placeholder="z.B. 10050"
                                                        />
                                                    </div>
                                                </div>
                                                <DialogFooter>
                                                    <Button onClick={handleSaveToLibrary}>Speichern</Button>
                                                </DialogFooter>
                                            </DialogContent>
                                     </Dialog>
                                 )}

                                 {/* Manual Save Buttons (Visible even if autoSave is true, to allow snapshots) */}
                                 {mode === 'project' && (
                                    <>
                                        {!autoSave && (
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="gap-2 h-8 border-green-200 text-green-700 hover:bg-green-50"
                                                onClick={() => handleManualSave(false)}
                                            >
                                                <Save className="w-4 h-4" /> Speichern
                                            </Button>
                                        )}
        
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="default" size="sm" className="gap-2 h-8 bg-green-600 hover:bg-green-700 text-white">
                                                    <GitBranch className="w-4 h-4" /> Neue Version
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>Rezepturänderung speichern?</DialogTitle>
                                                    <DialogDescription>
                                                        Möchten Sie die Änderungen speichern? <br/>
                                                        Dies erstellt automatisch eine neue Version in der Historie (z.B. 1.1, 1.2).
                                                    </DialogDescription>
                                                </DialogHeader>
                                                
                                                <div className="grid gap-4 py-4">
                                                    <div className="grid grid-cols-4 items-center gap-4">
                                                        <Label htmlFor="name" className="text-right">
                                                            Artikelbezeichnung
                                                        </Label>
                                                        <Input
                                                            id="name"
                                                            value={recipeName}
                                                            onChange={(e) => setRecipeName(e.target.value)}
                                                            className="col-span-3"
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-4 items-center gap-4">
                                                        <Label htmlFor="articleNumber" className="text-right">
                                                            Artikelnummer
                                                        </Label>
                                                        <Input
                                                            id="articleNumber"
                                                            value={articleNumber}
                                                            onChange={(e) => setArticleNumber(e.target.value)}
                                                            className="col-span-3"
                                                            placeholder="z.B. 10023"
                                                        />
                                                    </div>
                                                </div>
        
                                                <DialogFooter>
                                                    <Button onClick={() => handleManualSave(true)}>
                                                        Ja, Version speichern
                                                    </Button>
                                                </DialogFooter>
                                            </DialogContent>
                                        </Dialog>
                                    </>
                                 )}
                                </>
                             )}
                             
                             {readOnly && (
                                 <div className="text-sm text-muted-foreground italic flex items-center gap-2">
                                    <Info className="w-4 h-4" /> Schreibgeschützter Modus
                                 </div>
                             )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="max-h-[500px] overflow-y-auto">
                        <Table>
                            <TableHeader className="bg-slate-50 sticky top-0 z-10">
                                <TableRow className="border-b h-10">
                                    <TableHead className="w-[40px] pl-4"></TableHead>
                                    <TableHead className="w-[35%]">Zutat</TableHead>
                                    <TableHead className="w-[20%] text-right">Menge</TableHead>
                                    <TableHead className="w-[15%] text-right text-xs">Roh: %<br/>Gar: %</TableHead>
                                    <TableHead className="w-[10%] text-center text-xs">QUID</TableHead>
                                    {!readOnly && <TableHead className="w-[40px] pr-4"></TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {ingredients.map((ing) => {
                                    const rawPct = result && result.totalRawMass > 0 
                                            ? ((ing.rawWeight / result.totalRawMass) * 100)
                                            : 0;
                                    
                                    // Find result for gar % (quidRawValue)
                                    // Fix: Calculate directly based on totalEndWeight to support aggregated ingredients (meat)
                                    // The 'resIng' lookup fails for meat because they are aggregated/split in the result list.
                                    
                                    // Special handling for Water: The displayed QUID % must match the label logic (Remaining / End).
                                    // If we just use Raw/End, we show >100% relative or >Raw% which is wrong for water with loss.
                                    
                                    let garPct = 0;
                                    const resIng = result?.ingredients.find(i => i.id === ing.id);
                                    
                                    if (resIng) {
                                        // If we found the exact ingredient in result (e.g. Water, Spices), use its calculated QUID
                                        garPct = resIng.quidRawValue;
                                    } else {
                                        // Fallback for Meat (which is aggregated): Use Raw/End
                                        // This is correct for Meat because QUID is Raw/End.
                                        garPct = (result && result.totalEndWeight > 0) 
                                            ? ((ing.rawWeight / result.totalEndWeight) * 100)
                                            : 0;
                                    }

                                    return (
                                        <TableRow key={ing.id} className="hover:bg-slate-50/80 group border-b last:border-0 h-16">
                                            <TableCell className="py-2 pl-4 align-middle">
                                                {!readOnly && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-destructive transition-colors" onClick={() => removeIngredient(ing.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-medium align-middle py-2">
                                                <div className="flex flex-col">
                                                    <span className="text-base font-medium text-slate-700">{ing.name}</span>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {ing.articleNumber && <span className="text-[10px] text-slate-400 bg-slate-100 px-1 rounded border">#{ing.articleNumber}</span>}
                                                        {ing.isMeat && (
                                                            <Badge variant="outline" className="text-[9px] h-4 px-1 border-red-100 text-red-600 bg-red-50/50">
                                                                Fleisch ({ing.meatSpecies})
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right align-middle py-2">
                                                <div className="relative flex items-center justify-end">
                                                    <Input 
                                                        type="text" 
                                                        inputMode="decimal"
                                                        className="text-right h-9 font-mono text-base w-24 pr-8 border-slate-200 focus-visible:ring-1"
                                                        value={ing.rawWeight === 0 ? "" : ing.rawWeight}
                                                        onChange={e => {
                                                            const val = e.target.value.replace(',', '.');
                                                            if (val === "" || /^\d*\.?\d*$/.test(val)) {
                                                                const num = parseFloat(val);
                                                                updateIngredient(ing.id, "rawWeight", isNaN(num) ? 0 : val); 
                                                            }
                                                        }}
                                                        onBlur={(e) => {
                                                             const val = parseFloat(e.target.value.replace(',', '.'));
                                                             updateIngredient(ing.id, "rawWeight", isNaN(val) ? 0 : val);
                                                        }}
                                                        placeholder="0.00"
                                                        readOnly={readOnly}
                                                    />
                                                    <span className="absolute right-3 text-xs text-slate-400 pointer-events-none">kg</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right align-middle py-2">
                                                <div className="flex flex-col text-xs font-mono">
                                                     <span className="text-slate-500">Roh: {rawPct.toFixed(1)}%</span>
                                                     <span className="text-primary font-medium">Gar: {garPct.toFixed(1)}%</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="align-middle text-center py-2">
                                                <div className="flex justify-center">
                                                    <Checkbox 
                                                        checked={ing.quidRequired} 
                                                        onCheckedChange={(c) => updateIngredient(ing.id, "quidRequired", c === true)}
                                                        disabled={readOnly}
                                                    />
                                                </div>
                                            </TableCell>
                                            {!readOnly && (
                                                <TableCell className="align-middle py-2 pr-4 text-center">
                                                     <Info className="w-4 h-4 text-slate-300 hover:text-slate-600 cursor-help" />
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    );
                                })}
                                {ingredients.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground bg-slate-50/30 border-dashed border-b">
                                            <div className="flex flex-col items-center gap-2">
                                                <Scale className="w-8 h-8 opacity-20" />
                                                <p>Noch keine Zutaten in der Rezeptur.</p>
                                                <Button variant="link" className="text-primary" onClick={() => (document.querySelector('[data-trigger-ingredient-picker="true"]') as HTMLElement)?.click()}>
                                                    + Zutaten hinzufügen
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                
                {/* Process Parameters Footer */}
                <div className="bg-slate-50 border-t p-4">
                    <div className="flex items-center gap-2 mb-3 text-slate-700">
                        <Scale className="w-4 h-4 text-primary" />
                        <h3 className="font-semibold text-sm">Prozess-Parameter</h3>
                        <span className="text-xs text-muted-foreground ml-2">Verluste durch Kochen, Trocknen oder Räuchern.</span>
                    </div>
                    
                    <div className="flex items-end gap-6 bg-white p-3 rounded-md border shadow-sm">
                        
                         <div className="flex-1 space-y-1.5">
                            <Label className="text-xs text-slate-500">Verlustart</Label>
                            <Select value={lossType} onValueChange={(v: any) => setLossType(v)}>
                                <SelectTrigger className="h-9 bg-slate-50 border-slate-200">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="drying">Trocknung / Reifung</SelectItem>
                                    <SelectItem value="cooking">Garen / Braten</SelectItem>
                                    <SelectItem value="none">Kein Verlust</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className={`space-y-1.5 w-32 ${lossType === 'none' ? 'opacity-50 pointer-events-none' : ''}`}>
                            <Label className="text-xs text-slate-500 flex justify-between">
                                Garverlust %
                            </Label>
                            <div className="relative">
                                <Input 
                                    type="number" 
                                    className="h-9 bg-slate-50 text-right pr-8 font-mono border-slate-200" 
                                    value={cookingLoss}
                                    onChange={e => setCookingLoss(parseFloat(e.target.value))}
                                    readOnly={readOnly}
                                />
                                <span className="absolute right-3 top-2.5 text-xs text-slate-400 pointer-events-none">%</span>
                            </div>
                        </div>

                         <div className={`space-y-1.5 w-32 ${lossType === 'none' ? 'opacity-50 pointer-events-none' : ''}`}>
                            <Label className="text-xs text-slate-500 flex justify-between">
                                Fettverlust %
                            </Label>
                            <div className="relative">
                                <Input 
                                    type="number" 
                                    className="h-9 bg-slate-50 text-right pr-8 font-mono border-slate-200" 
                                    value={fatLoss}
                                    onChange={e => setFatLoss(parseFloat(e.target.value))}
                                    readOnly={readOnly}
                                />
                                <span className="absolute right-3 top-2.5 text-xs text-slate-400 pointer-events-none">%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Right Column Content moved here if layout allows, but based on request user wants THIS component adjusted.
                The Screenshot shows a Split View.
                The Project Page manages the Right Column. 
                We need to adjust the Project Page to match the Screenshot Right Side. 
            */}
        </div>
    );
}
