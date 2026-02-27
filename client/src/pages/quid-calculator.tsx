import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  Plus, 
  Trash2, 
  Calculator, 
  Info, 
  Save, 
  FileText, 
  Database,
  ArrowRight,
  Scale,
  Wand2,
  AlertTriangle,
  CheckCircle2,
  ChefHat
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger 
} from "@/components/ui/dialog";

// Logic Libraries
import { calculateQuid, Ingredient, QuidResult, NutritionalValues } from "@/lib/quid-calculator";
import { useRecipeLibrary, SavedRecipe } from "@/lib/recipe-db";
import { useIngredientLibrary, LibraryIngredient } from "@/lib/ingredient-db";
import { IngredientPicker } from "@/components/data-management";
import { MeatOptimizer } from "@/components/meat-optimizer";
import { generateSpecificationExcel } from "@/lib/spec-generator";

export default function QuidCalculator() {
  const { toast } = useToast();
  const { save: saveRecipe, recipes } = useRecipeLibrary();
  
  // State
  const [recipeName, setRecipeName] = useState("");
  const [articleNumber, setArticleNumber] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [cookingLoss, setCookingLoss] = useState<number>(0);
  const [fatLoss, setFatLoss] = useState<number>(0);
  const [lossType, setLossType] = useState<'drying' | 'cooking' | 'none'>('drying');
  
  const [result, setResult] = useState<QuidResult | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Load Recipe from Session (if redirected from DB)
  useEffect(() => {
    const loadId = localStorage.getItem("load-recipe-id");
    if (loadId) {
      localStorage.removeItem("load-recipe-id");
      const recipe = recipes.find(r => r.id === loadId);
      if (recipe) {
        loadRecipe(recipe);
        toast({ title: "Rezept geladen", description: `"${recipe.name}" wurde geöffnet.` });
      }
    }
  }, [recipes]);

  // Recalculate whenever inputs change
  useEffect(() => {
    if (ingredients.length > 0) {
      const res = calculateQuid(ingredients, cookingLoss, fatLoss, lossType);
      setResult(res);
    } else {
      setResult(null);
    }
  }, [ingredients, cookingLoss, fatLoss, lossType]);

  const loadRecipe = (recipe: SavedRecipe) => {
    setRecipeName(recipe.name);
    setArticleNumber(recipe.articleNumber || "");
    setIngredients(recipe.ingredients.map(ing => ({
        ...ing,
        // Ensure legacy compatibility or defaults
        id: ing.id || crypto.randomUUID(),
        rawWeight: ing.rawWeight || 0,
        quidRequired: ing.quidRequired ?? true,
        isMeat: ing.isMeat ?? false,
        isWater: ing.isWater ?? false
    })));
    setCookingLoss(recipe.cookingLoss || 0);
    setFatLoss(recipe.fatLoss || 0);
    setLossType(recipe.lossType || 'drying');
  };

  const handleAddIngredient = (selection: any) => {
    // Unwrap selection from IngredientPicker (wrapper { isRecipe: boolean, item: ... } or direct object)
    let item = selection;
    let explicitRecipe = false;
    
    if (selection && typeof selection === 'object' && 'isRecipe' in selection) {
        item = selection.item;
        explicitRecipe = selection.isRecipe;
    }

    // Force check for Recipe (Compound Ingredient)
    // We check if 'ingredients' array exists and has items
    const isRecipe = explicitRecipe || ('ingredients' in item && Array.isArray((item as any).ingredients));
    
    if (isRecipe) {
        // User Request: "Unterrezepturen" (Sub-recipes)
        const recipeItem = item as SavedRecipe;
        
        toast({ title: "Verarbeite Unterrezeptur...", description: `Füge "${recipeItem.name}" als Block hinzu.` });
        
        // 1. Calculate Nutrition for the Sub-Recipe
        const subIngredientsForCalc: Ingredient[] = recipeItem.ingredients.map(ri => ({
            ...ri,
            id: crypto.randomUUID(),
            // Fix: Preserve original labelName if available
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
        
        // 2. Generate the "Sub-Ingredients" string for the label
        const subLabelText = subResult.labelText;

        // 3. Create the Compound Ingredient
        const compoundIng: Ingredient = {
            id: crypto.randomUUID(),
            name: recipeItem.name, 
            labelName: recipeItem.name,
            articleNumber: recipeItem.articleNumber,
            rawWeight: 0, // User must enter how much of this sub-recipe they use
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
        toast({ title: "Unterrezeptur eingefügt", description: `"${item.name}" wurde als zusammengesetzte Zutat (Block) hinzugefügt.` });

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

  const handleSave = () => {
      if (!recipeName.trim()) {
          toast({ title: "Fehler", description: "Bitte geben Sie einen Rezeptnamen ein.", variant: "destructive" });
          return;
      }
      
      saveRecipe({
          id: crypto.randomUUID(),
          name: recipeName,
          articleNumber,
          updatedAt: new Date().toISOString(),
          cookingLoss,
          fatLoss,
          lossType,
          ingredients
      });
      
      toast({ title: "Gespeichert", description: "Rezept wurde in der Datenbank abgelegt." });
      setShowSaveDialog(false);
  };

  const handleSpecExport = async () => {
      if (!result) return;
      try {
          await generateSpecificationExcel(recipeName || "Unbenannt", result, {
              id: "temp",
              name: recipeName,
              articleNumber,
              ingredients,
              cookingLoss,
              fatLoss,
              lossType,
              updatedAt: new Date().toISOString()
          });
          toast({ title: "Export erfolgreich", description: "Spezifikation wurde erstellt." });
      } catch (e) {
          toast({ title: "Export Fehler", description: "Spezifikation konnte nicht erstellt werden.", variant: "destructive" });
      }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-20 font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rezeptur Entwicklung</h1>
          <p className="text-muted-foreground mt-1">LMIV-konforme Berechnung, Optimierung & Spezifikation</p>
        </div>
        <div className="flex gap-2">
           <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
              <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Save className="w-4 h-4" /> Speichern
                  </Button>
              </DialogTrigger>
              <DialogContent>
                 <DialogHeader>
                    <DialogTitle>Rezept speichern</DialogTitle>
                 </DialogHeader>
                 <div className="space-y-4 py-4">
                    <div className="space-y-2">
                       <Label>Rezept Name</Label>
                       <Input value={recipeName} onChange={e => setRecipeName(e.target.value)} placeholder="z.B. Premium Salami" />
                    </div>
                    <div className="space-y-2">
                       <Label>Artikelnummer</Label>
                       <Input value={articleNumber} onChange={e => setArticleNumber(e.target.value)} placeholder="Optional" />
                    </div>
                 </div>
                 <DialogFooter>
                    <Button onClick={handleSave}>Speichern</Button>
                 </DialogFooter>
              </DialogContent>
           </Dialog>

           <Button variant="default" onClick={handleSpecExport} disabled={!result} className="gap-2">
              <FileText className="w-4 h-4" /> Spezifikation (Excel)
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Ingredients & Process */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="border-t-4 border-t-primary shadow-sm">
            <CardHeader className="pb-4">
               <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Zutaten & Mengen</CardTitle>
                    <CardDescription>Basis für die Berechnung (Rohmasse)</CardDescription>
                  </div>
                  <div className="flex gap-2">
                     <MeatOptimizer 
                        ingredients={ingredients} 
                        cookingLoss={lossType === 'none' ? 0 : cookingLoss} 
                        onApply={setIngredients} 
                     />
                     <IngredientPicker onSelect={handleAddIngredient} />
                  </div>
               </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-[40%]">Zutat</TableHead>
                    <TableHead className="w-[25%] text-right">Menge (kg)</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ingredients.map((ing, idx) => (
                    <TableRow key={ing.id} className="hover:bg-muted/30 group">
                      <TableCell className="font-medium align-top py-3">
                         <div className="flex flex-col">
                            <span>{ing.name}</span>
                            {ing.isMeat && (
                                <Badge variant="outline" className="w-fit mt-1 text-[10px] h-4 px-1 border-red-200 text-red-700 bg-red-50">
                                   Fleisch ({ing.meatSpecies || "?"})
                                </Badge>
                            )}
                            {ing.isWater && (
                                <Badge variant="outline" className="w-fit mt-1 text-[10px] h-4 px-1 border-blue-200 text-blue-700 bg-blue-50">
                                   Zugabewasser
                                </Badge>
                            )}
                            {ing.isRecipe && (
                                <Badge variant="outline" className="w-fit mt-1 text-[10px] h-4 px-1 border-purple-200 text-purple-700 bg-purple-50">
                                   Unterrezeptur
                                </Badge>
                            )}
                         </div>
                      </TableCell>
                      <TableCell className="text-right align-top py-3">
                         <Input 
                            type="number" 
                            step="0.001"
                            className="text-right h-8 font-mono"
                            value={ing.rawWeight || ""}
                            onChange={e => updateIngredient(ing.id, "rawWeight", parseFloat(e.target.value))}
                            placeholder="0.00"
                         />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground align-top py-3 pt-4 text-xs">
                         {result && result.totalRawMass > 0 
                            ? ((ing.rawWeight / result.totalRawMass) * 100).toFixed(1) + "%" 
                            : "-"}
                      </TableCell>
                      <TableCell className="align-top py-3">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeIngredient(ing.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {ingredients.length === 0 && (
                      <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                             Noch keine Zutaten. Klicken Sie auf <span className="font-semibold">"Aus Bibliothek"</span>.
                          </TableCell>
                      </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
            
            {/* Process Parameters Footer */}
            <div className="bg-slate-50 border-t p-4 space-y-4">
               <div className="flex items-center gap-2 mb-2">
                  <Scale className="w-4 h-4 text-slate-500" />
                  <h3 className="text-sm font-semibold">Prozessverluste</h3>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                     <Label className="text-xs">Verfahren</Label>
                     <Select value={lossType} onValueChange={(v: any) => setLossType(v)}>
                        <SelectTrigger className="h-8 bg-white">
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="drying">Trocknung / Reifung (Salami, Schinken)</SelectItem>
                           <SelectItem value="cooking">Garen / Braten (Kochschinken, Braten)</SelectItem>
                           <SelectItem value="none">Kein Verlust (Frischfleisch, Mischen)</SelectItem>
                        </SelectContent>
                     </Select>
                  </div>
                  
                  {lossType !== 'none' && (
                      <>
                        <div className="space-y-2">
                            <Label className="text-xs flex justify-between">
                                Gewichtsverlust (Gesamt)
                                <span className="text-muted-foreground">{cookingLoss}%</span>
                            </Label>
                            <div className="flex items-center gap-2">
                                <Input 
                                    type="number" 
                                    className="h-8 bg-white w-20 text-right" 
                                    value={cookingLoss}
                                    onChange={e => setCookingLoss(parseFloat(e.target.value))}
                                />
                                <span className="text-xs text-muted-foreground">%</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs flex justify-between">
                                Fettverlust (Ausbratung)
                                <span className="text-muted-foreground">{fatLoss}%</span>
                            </Label>
                            <div className="flex items-center gap-2">
                                <Input 
                                    type="number" 
                                    className="h-8 bg-white w-20 text-right" 
                                    value={fatLoss}
                                    onChange={e => setFatLoss(parseFloat(e.target.value))}
                                />
                                <span className="text-xs text-muted-foreground">%</span>
                            </div>
                        </div>
                      </>
                  )}
               </div>
               
               {result && (
                   <div className="flex justify-between items-center pt-2 border-t mt-2 text-sm">
                      <span className="text-muted-foreground">Rohmasse: <strong>{result.totalRawMass.toFixed(2)} kg</strong></span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      <span className="font-semibold text-primary">Endgewicht: {result.totalEndWeight.toFixed(2)} kg</span>
                   </div>
               )}
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN: Results & LMIV */}
        <div className="lg:col-span-5 space-y-6">
           
           <Tabs defaultValue="label" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                 <TabsTrigger value="label">Etikett</TabsTrigger>
                 <TabsTrigger value="nutrition">Nährwerte</TabsTrigger>
                 <TabsTrigger value="check">LMIV-Check</TabsTrigger>
              </TabsList>
              
              <TabsContent value="label" className="space-y-4 mt-4">
                 <Card>
                    <CardHeader className="pb-3">
                       <CardTitle className="text-base flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          Zutatenliste (QUID)
                       </CardTitle>
                       <CardDescription>Automatisch generierter Vorschlag</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <div className="bg-slate-100 p-4 rounded-md text-sm leading-relaxed border shadow-inner font-serif">
                          {result ? result.labelText : <span className="text-muted-foreground italic">Berechnung ausstehend...</span>}
                       </div>
                       
                       {result && result.allAllergens.length > 0 && (
                           <div className="mt-4 pt-4 border-t">
                              <span className="text-xs font-bold uppercase text-muted-foreground">Enthaltene Allergene:</span>
                              <div className="flex flex-wrap gap-1 mt-2">
                                 {result.allAllergens.map(a => (
                                     <Badge key={a} variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200">
                                        {a.toUpperCase()}
                                     </Badge>
                                 ))}
                              </div>
                           </div>
                       )}
                    </CardContent>
                 </Card>
                 
                 {result && result.warnings.length > 0 && (
                     <Card className="border-amber-200 bg-amber-50">
                        <CardHeader className="pb-2">
                           <CardTitle className="text-sm text-amber-800 flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4" /> Hinweise
                           </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-amber-700 space-y-1">
                           {result.warnings.map((w, i) => <p key={i}>• {w}</p>)}
                        </CardContent>
                     </Card>
                 )}
              </TabsContent>
              
              <TabsContent value="nutrition" className="mt-4">
                 <Card>
                    <CardHeader className="pb-3">
                       <CardTitle className="text-base">Nährwerte (pro 100g)</CardTitle>
                       <CardDescription>Berechnet für Endprodukt</CardDescription>
                    </CardHeader>
                    <CardContent>
                       {result ? (
                           <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4 pb-4 border-b">
                                 <div>
                                    <div className="text-2xl font-bold">{Math.round(result.nutritionPer100g.energyKcal)}</div>
                                    <div className="text-xs text-muted-foreground">kcal</div>
                                 </div>
                                 <div>
                                    <div className="text-2xl font-bold">{Math.round(result.nutritionPer100g.energyKj)}</div>
                                    <div className="text-xs text-muted-foreground">kJ</div>
                                 </div>
                              </div>
                              
                              <div className="space-y-3 text-sm">
                                 <NutriRow label="Fett" value={result.nutritionPer100g.fat} unit="g" />
                                 <NutriRow label="davon ges. Fettsäuren" value={result.nutritionPer100g.saturatedFat} unit="g" indent />
                                 <NutriRow label="Kohlenhydrate" value={result.nutritionPer100g.carbohydrates} unit="g" />
                                 <NutriRow label="davon Zucker" value={result.nutritionPer100g.sugar} unit="g" indent />
                                 <NutriRow label="Eiweiß" value={result.nutritionPer100g.protein} unit="g" />
                                 <NutriRow label="Salz" value={result.nutritionPer100g.salt} unit="g" />
                                 
                                 <div className="pt-2 mt-2 border-t border-dashed">
                                    <NutriRow label="Wasser (kalk.)" value={result.nutritionPer100g.water || 0} unit="g" color="text-blue-600" />
                                 </div>
                              </div>
                           </div>
                       ) : (
                           <div className="text-center py-8 text-muted-foreground">Keine Daten</div>
                       )}
                    </CardContent>
                 </Card>
              </TabsContent>
              
              <TabsContent value="check" className="mt-4">
                 <Card>
                    <CardHeader>
                       <CardTitle className="text-base">LMIV Check</CardTitle>
                       <CardDescription>Fleisch-Standards</CardDescription>
                    </CardHeader>
                    <CardContent>
                       {/* Placeholder for detailed BEFFE checks if needed */}
                       <div className="text-sm text-muted-foreground">
                          Die Überprüfung der Fett/Fleischeiweiß-Verhältnisse erfolgt automatisch bei der QUID-Berechnung. 
                          Überschreitungen werden als Warnung im Tab "Etikett" angezeigt.
                       </div>
                    </CardContent>
                 </Card>
              </TabsContent>
           </Tabs>
        </div>
      </div>
    </div>
  );
}

function NutriRow({ label, value, unit, indent, color }: any) {
    return (
        <div className={`flex justify-between items-center ${indent ? 'pl-4 text-muted-foreground' : ''} ${color || ''}`}>
            <span>{label}</span>
            <span className="font-mono font-medium">{value.toFixed(1)} {unit}</span>
        </div>
    );
}
