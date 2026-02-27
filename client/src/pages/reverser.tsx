import { useState, useEffect } from "react";
import { Link } from "wouter";
import { 
  ArrowLeft, 
  Calculator, 
  Plus, 
  RefreshCw, 
  Trash2, 
  FlaskConical,
  Scale,
  BrainCircuit,
  AlertTriangle,
  Info,
  Save,
  Flame,
  Droplets,
  Ban,
  Wrench,
  Lock,
  Unlock,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Ingredient, NutritionalValues, calculateQuid } from "@/lib/quid-calculator";
import { IngredientPicker } from "@/components/data-management";
import { useIngredientLibrary, LibraryIngredient } from "@/lib/ingredient-db";
import { useRecipeLibrary } from "@/lib/recipe-db";
import { Lightbulb } from "lucide-react";

// Type for the solver
interface ReverserIngredient extends Ingredient {
  estimatedWeight: number; // The calculated weight (0-100)
  minWeight?: number; // Optional constraints
  maxWeight?: number;
  fixedQuid?: number; // The user-defined QUID target (End Product %)
}

// Helper component for correct decimal display
function DecimalInput({ value, onChange, placeholder }: { value: number, onChange: (v: number) => void, placeholder?: string }) {
  // We use local state to handle the text input behavior
  const [text, setText] = useState("");
  
  // Sync text with external value when not focused or initially
  useEffect(() => {
     // If value is 0 and text is empty, keep empty (user experience)
     if (value === 0 && text === "") return;
     
     // Only update if significantly different to avoid cursor jumps
     // We convert text to number to compare
     const currentParsed = parseFloat(text.replace(',', '.'));
     if (isNaN(currentParsed) || Math.abs(currentParsed - value) > 0.0001) {
         setText(value === 0 ? "" : value.toLocaleString("de-DE"));
     }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let newVal = e.target.value;
      
      // Allow valid partial inputs: "", "0", "0,", "12", "12,5"
      if (!/^[\d,]*$/.test(newVal)) return;

      setText(newVal);
      
      // Parse for parent
      const parsed = parseFloat(newVal.replace(',', '.'));
      if (!isNaN(parsed)) {
          onChange(parsed);
      } else {
          // Don't reset to 0 immediately in parent if text is invalid/empty, 
          // but we might need to handle empty string as 0
          if (newVal === "") onChange(0);
      }
  };

  const handleBlur = () => {
      // Format on blur
      const parsed = parseFloat(text.replace(',', '.'));
      if (!isNaN(parsed) && parsed !== 0) {
          setText(parsed.toLocaleString("de-DE"));
      } else if (parsed === 0 || text === "") {
          setText(""); 
      }
  }

  return (
    <Input 
        type="text" 
        inputMode="decimal"
        value={text} 
        onChange={handleChange} 
        onBlur={handleBlur}
        placeholder={placeholder}
    />
  );
}

export default function RecipeReverser() {
  const { toast } = useToast();
  const { save: saveRecipe } = useRecipeLibrary();
  const { ingredients: libraryIngredients } = useIngredientLibrary();
  
  // Target Values (from Label)
  const [targetNutrition, setTargetNutrition] = useState<NutritionalValues>({
    energyKcal: 0,
    energyKj: 0,
    fat: 0,
    saturatedFat: 0,
    carbohydrates: 0,
    sugar: 0,
    protein: 0,
    salt: 0,
    water: 0,
    ash: 0
  });

  // Selected Ingredients (Ordered)
  const [ingredients, setIngredients] = useState<ReverserIngredient[]>([]);

  // Result State
  const [isSolving, setIsSolving] = useState(false);
  const [solved, setSolved] = useState(false);
  const [errorScore, setErrorScore] = useState(0);
  const [suggestions, setSuggestions] = useState<{from: string, to: LibraryIngredient, reason: string}[]>([]);

  // Process Parameters
  const [cookingLoss, setCookingLoss] = useState<number>(0);
  const [fatLoss, setFatLoss] = useState<number>(0);
  const [lossType, setLossType] = useState<'none' | 'cooking' | 'drying'>('drying');
  
  // Save Dialog
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newRecipeName, setNewRecipeName] = useState("");
  const [newRecipeArticleNumber, setNewRecipeArticleNumber] = useState("");

  const handleSaveRecipe = () => {
    if(!newRecipeName.trim()) return;
    
    // Convert ReverserIngredients to RecipeIngredients
    // We need to map our "estimatedWeight" to "rawWeight"
    // Since estimatedWeight is %, we can treat it as kg for a 100kg batch
    const newIngredients = ingredients.map(ing => ({
       name: ing.name,
       rawWeight: ing.estimatedWeight, // 100kg batch
       quidRequired: ing.quidRequired,
       isMeat: ing.isMeat,
       isWater: ing.isWater,
       meatSpecies: ing.meatSpecies,
       connectiveTissuePercent: ing.connectiveTissuePercent,
       meatProteinLimit: ing.meatProteinLimit,
       nutrition: ing.nutrition,
       processingAids: ing.processingAids,
       allergens: ing.allergens,
       articleNumber: ing.articleNumber,
       labelName: ing.labelName
    }));

    saveRecipe({
       id: crypto.randomUUID(),
       name: newRecipeName,
       articleNumber: newRecipeArticleNumber,
       updatedAt: new Date().toISOString(),
       cookingLoss: lossType === 'none' ? 0 : cookingLoss,
       fatLoss: lossType === 'none' ? 0 : fatLoss,
       lossType: lossType,
       ingredients: newIngredients
    });

    toast({
       title: "Rezept gespeichert",
       description: `"${newRecipeName}" wurde in der Rezept-Datenbank abgelegt.`
    });

    setShowSaveDialog(false);
    setNewRecipeName("");
    setNewRecipeArticleNumber("");
  };

  // Add ingredient from picker
  const handleAddIngredient = (ing: any) => {
    // Adapt LibraryIngredient to ReverserIngredient
    const newIng: ReverserIngredient = {
      ...ing,
      id: ing.id || crypto.randomUUID(),
      rawWeight: 0, // Placeholder
      quidRequired: false, // Placeholder
      estimatedWeight: 0, // Start with 0
    };

    setIngredients(prev => [...prev, newIng]);
  };

  const removeIngredient = (index: number) => {
    setIngredients(prev => prev.filter((_, i) => i !== index));
  };

  const moveIngredient = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === ingredients.length - 1) return;
    
    const newIngredients = [...ingredients];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newIngredients[index], newIngredients[swapIndex]] = [newIngredients[swapIndex], newIngredients[index]];
    setIngredients(newIngredients);
  };

  // The SOLVER Core
  const solveRecipe = async () => {
    if (ingredients.length < 2) {
      toast({ title: "Zu wenig Zutaten", description: "Mindestens 2 Zutaten benötigt.", variant: "destructive" });
      return;
    }

    setIsSolving(true);
    setSolved(false);

    // Allow UI to update
    await new Promise(r => setTimeout(r, 100));

    try {
      // 1. Initialize weights
      // Identify Fixed Ingredients
      const count = ingredients.length;
      let currentWeights = [...ingredients].map(i => i.estimatedWeight);
      
      // Calculate Fixed Weights (Raw %)
      // Formula: Raw% = QUID% * (1 - TotalLoss%) / 1
      // Note: If lossType is 'none', loss is 0.
      const lossFactor = lossType === 'none' ? 1 : (1 - cookingLoss/100);
      
      const fixedIndices: number[] = [];
      let fixedSum = 0;

      ingredients.forEach((ing, idx) => {
          if (ing.fixedQuid && ing.fixedQuid > 0) {
              // Calculate required raw weight %
              // Since QUID = (Raw / End) * 100
              // And End = RawTotal * lossFactor
              // QUID = (RawIng / (RawTotal * lossFactor)) * 100
              // RawIng_Percent = (RawIng / RawTotal) * 100 = QUID * lossFactor
              
              const rawPct = ing.fixedQuid * lossFactor;
              currentWeights[idx] = rawPct;
              fixedIndices.push(idx);
              fixedSum += rawPct;
          }
      });

      if (fixedSum > 100.1) {
          toast({ title: "Fehler", description: "Fixierte QUID-Werte ergeben über 100% Rohmasse.", variant: "destructive" });
          setIsSolving(false);
          return;
      }
      
      const variableIndices = ingredients.map((_, i) => i).filter(i => !fixedIndices.includes(i));
      const remainingRaw = Math.max(0, 100 - fixedSum);

      // Initialize variable weights
      if (variableIndices.length > 0) {
          // Distribute remainder initially with heuristic
          let subSum = 0;
          variableIndices.forEach((idx, i) => {
             const w = 100 / Math.pow(2, i+1);
             currentWeights[idx] = w;
             subSum += w;
          });
          
          // Normalize variable part to remainingRaw
          if (subSum > 0) {
              variableIndices.forEach(idx => {
                  currentWeights[idx] = (currentWeights[idx] / subSum) * remainingRaw;
              });
          } else {
              // Even split if heuristic failed (shouldn't happen)
              variableIndices.forEach(idx => {
                  currentWeights[idx] = remainingRaw / variableIndices.length;
              });
          }
      } else if (remainingRaw > 0.1) {
         // All fixed but sum < 100
         toast({ title: "Warnung", description: "Fixierte Werte ergeben nicht 100%. Rest wird ignoriert.", variant: "default" });
      }

      // 2. Iterative Optimization
      let bestWeights = [...currentWeights];
      let bestError = calculateError(currentWeights);

      const iterations = 5000;
      const learningRate = 0.5;

      // Only optimize if we have at least 2 variable ingredients to shift between
      if (variableIndices.length >= 2) {
          for (let i = 0; i < iterations; i++) {
             const candidateWeights = [...bestWeights];
             
             // Pick two random variable indices
             const r1 = Math.floor(Math.random() * variableIndices.length);
             const r2 = Math.floor(Math.random() * variableIndices.length);
             
             if (r1 === r2) continue;
             
             const idxA = variableIndices[r1];
             const idxB = variableIndices[r2];

             const shift = (Math.random() - 0.5) * learningRate * (1 - i/iterations);
             
             candidateWeights[idxA] += shift;
             candidateWeights[idxB] -= shift;

             if (candidateWeights[idxA] < 0 || candidateWeights[idxB] < 0) continue;
             
             // Order Constraint (Soft check, skip fixed ones in check?)
             // User requested strict order.
             // We check order for ALL ingredients (fixed + variable)
             let orderViolated = false;
             for (let k = 0; k < count - 1; k++) {
                 if (candidateWeights[k] < candidateWeights[k+1] - 0.1) {
                     orderViolated = true;
                     break;
                 }
             }
             if (orderViolated) continue;

             const error = calculateError(candidateWeights);
             if (error < bestError) {
                 bestError = error;
                 bestWeights = candidateWeights;
             }
          }
      } else {
          // No optimization possible (0 or 1 variable ingredient)
          // Just calculate error for the fixed configuration
          bestError = calculateError(bestWeights);
      }

      // Update State
      const finalIngredients = ingredients.map((ing, i) => ({
          ...ing,
          estimatedWeight: bestWeights[i]
      }));

      setIngredients(finalIngredients);
      setErrorScore(bestError);
      setSolved(true);
      
      // Analyze for Suggestions
      analyzeForSuggestions(finalIngredients, bestError);
      
      toast({ title: "Berechnung abgeschlossen", description: `Beste Annäherung gefunden (Abweichung: ${bestError.toFixed(2)})` });

    } catch (e) {
      console.error(e);
      toast({ title: "Fehler", description: "Berechnung fehlgeschlagen.", variant: "destructive" });
    } finally {
      setIsSolving(false);
    }
  };

  const analyzeForSuggestions = (currentIngredients: ReverserIngredient[], error: number) => {
      console.log("Analyzing for suggestions...");
      // Calculate current totals to see direction of error
      const totalRaw = currentIngredients.reduce((s, i) => s + i.estimatedWeight, 0);
      if (totalRaw === 0) return;

      // Check Fat Gap vs Target
      const res = calculateFinalValues(currentIngredients.map(i => i.estimatedWeight));
      if (!res) return;

      console.log(`Target Fat: ${targetNutrition.fat}, Result Fat: ${res.fat}`);

      const newSuggestions: {from: string, to: LibraryIngredient, reason: string}[] = [];
      const FAT_TOLERANCE = 1.0; 

      const fatDiff = targetNutrition.fat - res.fat; // + means we need MORE fat
      console.log(`Fat Diff: ${fatDiff}`);
      
      if (Math.abs(fatDiff) > FAT_TOLERANCE) {
          const lookingForMoreFat = fatDiff > 0;
          
          currentIngredients.forEach(ing => {
              if (!ing.isMeat) return;
              
              // Fallback: If no species set, try to guess from name or skip?
              // For now, we need species to be safe we don't swap Beef with Chicken (unless user wants?)
              // But let's log if species is missing
              if (!ing.meatSpecies) {
                  console.log(`Ingredient ${ing.name} has no species set, skipping suggestion.`);
                  return;
              }
              
              const currentIngFat = ing.nutrition?.fat || 0;
              
              const candidates = libraryIngredients.filter(libIng => 
                  libIng.isMeat && 
                  libIng.meatSpecies === ing.meatSpecies && 
                  libIng.id !== ing.id
              );
              
              console.log(`Found ${candidates.length} candidates for ${ing.name} (${ing.meatSpecies})`);

              let bestCandidate: LibraryIngredient | null = null;
              
              if (lookingForMoreFat) {
                  // Need more fat -> Find fatter ingredient
                  // Lower threshold to +2% to catch more options
                  const betterFatCandidates = candidates.filter(c => (c.nutrition?.fat || 0) > currentIngFat + 2);
                  if (betterFatCandidates.length > 0) {
                      // Sort by fat descending (get the fattest to fix the problem best?)
                      // Or get the one that is closest to what we need?
                      // If we are missing 7%, maybe we don't need the pure fat (90%), but just a fatter meat (30%)?
                      // Let's pick the one with the highest fat for now as a "strong" suggestion
                      betterFatCandidates.sort((a, b) => (b.nutrition?.fat || 0) - (a.nutrition?.fat || 0));
                      bestCandidate = betterFatCandidates[0];
                  }
              } else {
                  // Need less fat -> Find leaner ingredient
                   const leanerCandidates = candidates.filter(c => (c.nutrition?.fat || 0) < currentIngFat - 2);
                   if (leanerCandidates.length > 0) {
                       leanerCandidates.sort((a, b) => (a.nutrition?.fat || 0) - (b.nutrition?.fat || 0)); // lowest fat first
                       bestCandidate = leanerCandidates[0];
                   }
              }

              if (bestCandidate) {
                  newSuggestions.push({
                      from: ing.name,
                      to: bestCandidate,
                      reason: lookingForMoreFat 
                          ? `Fettgehalt zu niedrig (Zielabweichung ${fatDiff.toFixed(1)}%).` 
                          : `Fettgehalt zu hoch (Zielabweichung ${Math.abs(fatDiff).toFixed(1)}%).`
                  });
              }
          });
      }
      
      console.log("Suggestions generated:", newSuggestions);
      setSuggestions(newSuggestions.slice(0, 3));
  };
  
  const applySuggestion = (index: number) => {
      const sugg = suggestions[index];
      const ingIndex = ingredients.findIndex(i => i.name === sugg.from);
      if (ingIndex === -1) return;
      
      const newIng: ReverserIngredient = {
          ...sugg.to,
          id: crypto.randomUUID(),
          estimatedWeight: ingredients[ingIndex].estimatedWeight,
          minWeight: ingredients[ingIndex].minWeight,
          maxWeight: ingredients[ingIndex].maxWeight,
          fixedQuid: ingredients[ingIndex].fixedQuid,
          rawWeight: 0, // Placeholder
          quidRequired: sugg.to.quidRequiredDefault || false
      };
      
      const newIngredients = [...ingredients];
      newIngredients[ingIndex] = newIng;
      setIngredients(newIngredients);
      setSuggestions(prev => prev.filter((_, i) => i !== index));
      toast({ title: "Zutat ersetzt", description: `${sugg.from} wurde durch ${sugg.to.name} ersetzt.` });
  };

  // Shared Logic for calculating final values from weights + process params
  const calculateFinalValues = (weights: number[]) => {
      let rawFat = 0, rawSatFat = 0, rawProt = 0, rawSalt = 0, rawCarb = 0, rawSugar = 0;

      weights.forEach((w, i) => {
        const ing = ingredients[i];
        if (!ing.nutrition) return;
        rawFat += w * (ing.nutrition.fat || 0) / 100;
        rawSatFat += w * (ing.nutrition.saturatedFat || 0) / 100;
        rawProt += w * (ing.nutrition.protein || 0) / 100;
        rawSalt += w * (ing.nutrition.salt || 0) / 100;
        rawCarb += w * (ing.nutrition.carbohydrates || 0) / 100;
        rawSugar += w * (ing.nutrition.sugar || 0) / 100;
     });

     if (lossType === 'none') {
         // Energy Calc
         const kJ = (rawFat * 37) + (rawProt * 17) + (rawCarb * 17);
         const kcal = (rawFat * 9) + (rawProt * 4) + (rawCarb * 4);
         
         return { 
             fat: rawFat, 
             saturatedFat: rawSatFat,
             protein: rawProt, 
             salt: rawSalt, 
             carbohydrates: rawCarb,
             sugar: rawSugar,
             energyKj: kJ,
             energyKcal: kcal
         };
     }

     // Apply losses
     const totalRawMass = 100; // Weights sum to 100
     const fatLost = totalRawMass * (fatLoss / 100);
     const totalWeightLost = totalRawMass * (cookingLoss / 100);
     
     // Correct for negative mass if parameters are wild
     const finalEndWeight = Math.max(0.1, totalRawMass - totalWeightLost);
     
     // Fat Balance
     const finalFatMass = Math.max(0, rawFat - fatLost);
     // Assuming Sat Fat loss is proportional to Total Fat Loss
     const finalSatFatMass = rawFat > 0 ? Math.max(0, rawSatFat * (finalFatMass / rawFat)) : 0;
     
     // Other Losses
     let protLost = 0;
     let saltLost = 0;
     let sugarLost = 0; // assuming carbs ~ sugar loss for simplicity or just general loss
     
     const nonFatLoss = Math.max(0, totalWeightLost - fatLost);

     if (lossType === 'cooking') {
         // Juice loss factors
         const JUICE_PROTEIN_FACTOR = 0.05;
         const JUICE_SALT_FACTOR = 0.01;
         const JUICE_CARB_FACTOR = 0.01;

         protLost = nonFatLoss * JUICE_PROTEIN_FACTOR;
         saltLost = nonFatLoss * JUICE_SALT_FACTOR;
         sugarLost = nonFatLoss * JUICE_CARB_FACTOR;
     }

     const finalProtMass = Math.max(0, rawProt - protLost);
     const finalSaltMass = Math.max(0, rawSalt - saltLost);
     const finalCarbMass = Math.max(0, rawCarb - sugarLost);
     const finalSugarMass = Math.max(0, rawSugar - sugarLost); // Simplified: Sugar loss same as Carb loss

     // Convert to per 100g
     const per100g = (val: number) => (val / finalEndWeight) * 100;
     
     const resFat = per100g(finalFatMass);
     const resProt = per100g(finalProtMass);
     const resCarb = per100g(finalCarbMass);
     
     // Energy Calc
     const kJ = (resFat * 37) + (resProt * 17) + (resCarb * 17);
     const kcal = (resFat * 9) + (resProt * 4) + (resCarb * 4);

     return {
         fat: resFat,
         saturatedFat: per100g(finalSatFatMass),
         protein: resProt,
         salt: per100g(finalSaltMass),
         carbohydrates: resCarb,
         sugar: per100g(finalSugarMass),
         energyKj: kJ,
         energyKcal: kcal
     };
  };

  const calculateError = (weights: number[]) => {
     const calc = calculateFinalValues(weights);

     // Weighted error function
     const errFat = Math.abs(calc.fat - targetNutrition.fat);
     const errProt = Math.abs(calc.protein - targetNutrition.protein);
     const errSalt = Math.abs(calc.salt - targetNutrition.salt);
     const errCarb = Math.abs(calc.carbohydrates - targetNutrition.carbohydrates);

     return (errFat * 1.0) + (errProt * 2.0) + (errSalt * 10.0) + (errCarb * 0.5);
  };

  // Render Helpers
  const calculated = calculateFinalValues(ingredients.map(i => i.estimatedWeight));

  // Full QUID result for accurate "End Product" percentages
  const fullQuidResult = solved ? calculateQuid(
    ingredients.map(ing => ({
       ...ing,
       id: ing.id || "temp",
       rawWeight: ing.estimatedWeight, // Using estimated % as kg for 100kg batch
       quidRequired: true, 
       isWater: ing.isWater || ing.name.toLowerCase().includes("wasser") // Heuristic if not set
    })),
    lossType === 'none' ? 0 : cookingLoss,
    lossType === 'none' ? 0 : fatLoss,
    lossType
  ) : null;

  // Tools Logic
  const lockSpices = () => {
      let count = 0;
      setIngredients(prev => prev.map(ing => {
          // Heuristic: If weight is low (< 3%) or it's not meat/water, lock it
          if (ing.estimatedWeight < 3 && !ing.isMeat && !ing.isWater) {
             count++;
             // Fix it to its CURRENT estimated value (converted to QUID approx)
             const currentQuid = lossType === 'none' ? ing.estimatedWeight : (ing.estimatedWeight * (100 / (100 - cookingLoss)));
             return { ...ing, fixedQuid: parseFloat(currentQuid.toFixed(2)) };
          }
          return ing;
      }));
      if (count > 0) {
        toast({ title: "Kleinkomponenten fixiert", description: `${count} Zutaten wurden fixiert.` });
      } else {
        toast({ title: "Keine Änderungen", description: "Keine passenden Klein-Zutaten gefunden." });
      }
  };
  
  const unlockAll = () => {
      setIngredients(prev => prev.map(ing => ({ ...ing, fixedQuid: undefined })));
      toast({ title: "Fixierungen aufgehoben", description: "Alle Zutaten sind wieder variabel." });
  };

  return (
    <div className="space-y-6">
        <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BrainCircuit className="w-8 h-8 text-primary" />
              Rezept-Rekonstruktion
            </h1>
            <p className="text-muted-foreground">
              Berechnen Sie die Rezeptur basierend auf Nährwert-Spezifikationen und Zutatenliste.
            </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT: TARGETS */}
          <div className="lg:col-span-1 space-y-6">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="w-5 h-5" />
                Ziel-Vorgaben
              </CardTitle>
              <CardDescription>
                Werte aus der Nährwerttabelle (pro 100g)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               {/* Process Parameters Section */}
               <div className="space-y-4 pb-4 border-b">
                  <Label className="text-base font-semibold">Prozess & Verluste</Label>
                  
                  <RadioGroup value={lossType} onValueChange={(v: any) => setLossType(v)} className="grid grid-cols-3 gap-2">
                    <div>
                      <RadioGroupItem value="none" id="lt-none" className="peer sr-only" />
                      <Label
                        htmlFor="lt-none"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                      >
                        <Ban className="mb-2 h-4 w-4" />
                        <span className="text-[10px]">Keine</span>
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem value="drying" id="lt-drying" className="peer sr-only" />
                      <Label
                        htmlFor="lt-drying"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                      >
                        <Droplets className="mb-2 h-4 w-4" />
                        <span className="text-[10px]">Trocknen</span>
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem value="cooking" id="lt-cooking" className="peer sr-only" />
                      <Label
                        htmlFor="lt-cooking"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                      >
                        <Flame className="mb-2 h-4 w-4" />
                        <span className="text-[10px]">Garen</span>
                      </Label>
                    </div>
                  </RadioGroup>

                  {lossType !== 'none' && (
                    <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2">
                        <div className="space-y-2">
                           <Label className="flex items-center justify-between text-xs">
                              Gewichtsverlust (Gesamt)
                              <span className="text-muted-foreground font-mono">{cookingLoss}%</span>
                           </Label>
                           <Slider 
                              value={[cookingLoss]} 
                              onValueChange={(v) => setCookingLoss(v[0])} 
                              max={50} 
                              step={1}
                           />
                        </div>
                        
                        <div className="space-y-2">
                           <Label className="flex items-center justify-between text-xs">
                              Fettverlust
                              <span className="text-muted-foreground font-mono">{fatLoss}%</span>
                           </Label>
                           <Slider 
                              value={[fatLoss]} 
                              onValueChange={(v) => setFatLoss(v[0])} 
                              max={30} 
                              step={0.5}
                           />
                           <p className="text-[10px] text-muted-foreground">
                              Reduziert Fettgehalt und Gesamtgewicht.
                           </p>
                        </div>
                    </div>
                  )}
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Energie (kcal)</Label>
                    <DecimalInput 
                      value={targetNutrition.energyKcal || 0} 
                      onChange={v => setTargetNutrition(p => ({...p, energyKcal: v}))} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Energie (kJ)</Label>
                    <DecimalInput 
                      value={targetNutrition.energyKj || 0} 
                      onChange={v => setTargetNutrition(p => ({...p, energyKj: v}))} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fett (g)</Label>
                    <DecimalInput 
                      value={targetNutrition.fat || 0} 
                      onChange={v => setTargetNutrition(p => ({...p, fat: v}))} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gesättigte (g)</Label>
                    <DecimalInput 
                      value={targetNutrition.saturatedFat || 0} 
                      onChange={v => setTargetNutrition(p => ({...p, saturatedFat: v}))} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Eiweiß (g)</Label>
                    <DecimalInput 
                      value={targetNutrition.protein || 0} 
                      onChange={v => setTargetNutrition(p => ({...p, protein: v}))} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Salz (g)</Label>
                    <DecimalInput 
                      value={targetNutrition.salt || 0} 
                      onChange={v => setTargetNutrition(p => ({...p, salt: v}))} 
                    />
                  </div>
                   <div className="space-y-2">
                    <Label>Kohlenhydrate (g)</Label>
                    <DecimalInput 
                      value={targetNutrition.carbohydrates || 0} 
                      onChange={v => setTargetNutrition(p => ({...p, carbohydrates: v}))} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Zucker (g)</Label>
                    <DecimalInput 
                      value={targetNutrition.sugar || 0} 
                      onChange={v => setTargetNutrition(p => ({...p, sugar: v}))} 
                    />
                  </div>
               </div>
            </CardContent>
          </Card>

          {/* New Tools Card */}
          <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Wrench className="w-5 h-5" />
                    Werkzeuge
                </CardTitle>
                <CardDescription>Intelligente Helfer für die Berechnung</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start gap-2" onClick={lockSpices}>
                    <Lock className="w-4 h-4 text-blue-500" />
                    Kleinkomponenten fixieren (&lt;3%)
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2" onClick={unlockAll}>
                    <Unlock className="w-4 h-4 text-green-500" />
                    Alle Fixierungen lösen
                </Button>
            </CardContent>
          </Card>
          
          {/* SUGGESTIONS CARD */}
          {suggestions.length > 0 && (
             <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 animate-in fade-in slide-in-from-top-4">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-base">
                        <Lightbulb className="w-5 h-5" />
                        Vorschläge zur Optimierung
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {suggestions.map((sugg, idx) => (
                        <div key={idx} className="flex flex-col gap-2 p-3 rounded-lg bg-white dark:bg-slate-900 border border-amber-100 dark:border-amber-900/50 shadow-sm">
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                                {sugg.reason}
                            </div>
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex flex-col">
                                    <span className="text-xs text-muted-foreground line-through">{sugg.from}</span>
                                    <span className="font-medium text-sm text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                        <ArrowLeft className="w-3 h-3 rotate-180" /> {sugg.to.name}
                                    </span>
                                </div>
                                <Button size="sm" variant="secondary" onClick={() => applySuggestion(idx)}>
                                    Ersetzen
                                </Button>
                            </div>
                        </div>
                    ))}
                </CardContent>
             </Card>
          )}

          </div>

          {/* MIDDLE: INGREDIENTS */}
          <Card className="lg:col-span-2 flex flex-col min-h-[500px]">
            <CardHeader className="flex flex-row items-center justify-between">
               <div>
                  <CardTitle>Zutatenliste</CardTitle>
                  <CardDescription>
                    In absteigender Reihenfolge (wie auf Etikett)
                  </CardDescription>
               </div>
               <IngredientPicker onSelect={handleAddIngredient} />
            </CardHeader>
            <CardContent className="flex-1">
               {ingredients.length === 0 ? (
                 <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                    <FlaskConical className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Fügen Sie Zutaten aus der Bibliothek hinzu.</p>
                 </div>
               ) : (
                 <div className="space-y-2">
                    {ingredients.map((ing, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-card border rounded-md shadow-sm transition-all group hover:border-primary/50">
                          <div className="flex flex-col items-center gap-1 text-muted-foreground">
                             <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveIngredient(idx, 'up')} disabled={idx === 0}>▲</Button>
                             <span className="text-xs font-mono font-bold">{idx + 1}.</span>
                             <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveIngredient(idx, 'down')} disabled={idx === ingredients.length-1}>▼</Button>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                             <div className="font-medium truncate">{ing.name}</div>
                             <div className="text-xs text-muted-foreground flex gap-2">
                                <span>Fett: {ing.nutrition?.fat || 0}%</span>
                                <span>Eiw: {ing.nutrition?.protein || 0}%</span>
                                <span>Salz: {ing.nutrition?.salt || 0}%</span>
                             </div>
                             {/* Fixed QUID Input */}
                             <div className="mt-2 flex items-center gap-2">
                                <Label htmlFor={`fix-quid-${idx}`} className="text-xs text-muted-foreground whitespace-nowrap">Fix QUID (%):</Label>
                                <div className="w-20">
                                    <DecimalInput 
                                        value={ing.fixedQuid || 0} 
                                        onChange={(v) => {
                                            setIngredients(prev => {
                                                const copy = [...prev];
                                                copy[idx] = { ...copy[idx], fixedQuid: v };
                                                return copy;
                                            });
                                        }}
                                        placeholder="-" 
                                    />
                                </div>
                             </div>
                          </div>

                          {solved && (
                             <div className="text-right px-2">
                                <div className="text-lg font-bold text-primary">
                                   {ing.estimatedWeight.toLocaleString('de-DE', {maximumFractionDigits: 1})} %
                                </div>
                                <div className="text-xs text-muted-foreground">in Rohmasse</div>
                                
                                {lossType !== 'none' && cookingLoss > 0 && (
                                   <div className="mt-1 pt-1 border-t border-dashed">
                                      <div className="font-medium text-emerald-600">
                                         {fullQuidResult?.ingredients.find(i => i.id === ing.id)?.quidRawValue.toLocaleString('de-DE', {maximumFractionDigits: 1})} %
                                      </div>
                                      <div className="text-[10px] text-muted-foreground">im Endprodukt</div>
                                   </div>
                                )}
                             </div>
                          )}

                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => removeIngredient(idx)}>
                             <Trash2 className="w-4 h-4" />
                          </Button>
                      </div>
                    ))}
                 </div>
               )}
            </CardContent>
            <CardFooter className="border-t bg-muted/20 p-4 flex justify-between items-center">
               <div className="text-sm text-muted-foreground">
                  {ingredients.length} Zutaten
               </div>
               <Button onClick={solveRecipe} disabled={isSolving || ingredients.length < 2} className="min-w-[150px]">
                  {isSolving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Calculator className="w-4 h-4 mr-2" />}
                  {isSolving ? "Berechne..." : "Rezeptur berechnen"}
               </Button>
            </CardFooter>
          </Card>
        </div>

          {/* RESULTS COMPARISON */}
        {solved && (
           <Card className="border-primary/50 bg-primary/5">
              <CardHeader className="flex flex-row items-center justify-between">
                 <div>
                    <CardTitle>Ergebnis Analyse</CardTitle>
                    <CardDescription>Vergleich der berechneten Werte mit den Zielvorgaben</CardDescription>
                 </div>
                 <Button onClick={() => setShowSaveDialog(true)} className="gap-2">
                    <Save className="w-4 h-4" />
                    Als Rezept speichern
                 </Button>
              </CardHeader>
              <CardContent>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <ResultMetric label="Energie (kJ)" target={targetNutrition.energyKj} current={calculated.energyKj} unit="kJ" />
                    <ResultMetric label="Energie (kcal)" target={targetNutrition.energyKcal} current={calculated.energyKcal} unit="kcal" />
                    <ResultMetric label="Fett" target={targetNutrition.fat} current={calculated.fat} unit="g" />
                    <ResultMetric label="davon gesättigte" target={targetNutrition.saturatedFat} current={calculated.saturatedFat} unit="g" />
                    <ResultMetric label="Kohlenhydrate" target={targetNutrition.carbohydrates} current={calculated.carbohydrates} unit="g" />
                    <ResultMetric label="davon Zucker" target={targetNutrition.sugar} current={calculated.sugar} unit="g" />
                    <ResultMetric label="Eiweiß" target={targetNutrition.protein} current={calculated.protein} unit="g" />
                    <ResultMetric label="Salz" target={targetNutrition.salt} current={calculated.salt} unit="g" />
                 </div>
                 
                 {errorScore > 5 && (
                    <div className="mt-6 flex items-start gap-2 text-amber-600 bg-amber-50 p-3 rounded border border-amber-200">
                       <AlertTriangle className="w-5 h-5 shrink-0" />
                       <div className="text-sm">
                          <strong>Hohe Abweichung erkannt:</strong> Die gefundenen Zutaten passen rechnerisch nicht perfekt zu den Zielwerten. Möglicherweise fehlen Zutaten (z.B. Wasser, Fettzugabe) oder die Nährwerte der Rohwaren weichen ab.
                       </div>
                    </div>
                 )}

                 {solved && lossType !== 'none' && cookingLoss < 5 && (
                    <div className="mt-4 flex items-start gap-2 text-blue-600 bg-blue-50 p-3 rounded border border-blue-200">
                       <Info className="w-5 h-5 shrink-0" />
                       <div className="text-sm">
                          <strong>Tipp:</strong> Der Garverlust ist sehr niedrig eingestellt ({cookingLoss}%). 
                          Wenn Sie ein gegartes Produkt rekonstruieren (z.B. Frikadelle), stellen Sie sicher, dass der Garverlust korrekt eingetragen ist (typisch 15-25%), da sonst der Wasseranteil zu niedrig berechnet wird.
                       </div>
                    </div>
                 )}
              </CardContent>
           </Card>
        )}

        <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
           <DialogContent>
              <DialogHeader>
                 <DialogTitle>Rezept speichern</DialogTitle>
                 <DialogDescription>
                    Geben Sie einen Namen für das rekonstruierte Rezept ein. Es wird als 100kg Charge angelegt.
                 </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                 <div className="space-y-2">
                    <Label htmlFor="recipe-name">Rezeptname</Label>
                    <Input 
                        id="recipe-name" 
                        value={newRecipeName} 
                        onChange={e => setNewRecipeName(e.target.value)} 
                        placeholder="z.B. Rekonstruktion Salami"
                        autoFocus
                    />
                 </div>
                 <div className="space-y-2">
                    <Label htmlFor="recipe-artnr">Artikelnummer (Optional)</Label>
                    <Input 
                        id="recipe-artnr" 
                        value={newRecipeArticleNumber} 
                        onChange={e => setNewRecipeArticleNumber(e.target.value)} 
                        placeholder="z.B. 12345"
                    />
                 </div>
              </div>
              <DialogFooter>
                 <Button variant="outline" onClick={() => setShowSaveDialog(false)}>Abbrechen</Button>
                 <Button onClick={handleSaveRecipe} disabled={!newRecipeName.trim()}>Speichern</Button>
              </DialogFooter>
           </DialogContent>
        </Dialog>
      </div>
  );
}

function ResultMetric({ label, target, current, unit }: { label: string, target: number, current: number, unit: string }) {
   const diff = current - target;
   const isClose = Math.abs(diff) < 0.5;
   const colorClass = isClose ? "text-green-600" : (Math.abs(diff) < 2 ? "text-amber-600" : "text-red-600");
   
   return (
      <div className="space-y-1">
         <span className="text-sm text-muted-foreground font-medium uppercase">{label}</span>
         <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">{current.toLocaleString('de-DE', {minimumFractionDigits: 1, maximumFractionDigits: 1})}</span>
            <span className="text-sm text-muted-foreground">/ {target.toLocaleString('de-DE', {minimumFractionDigits: 1, maximumFractionDigits: 1})} {unit}</span>
         </div>
         <div className={`text-xs font-mono ${colorClass}`}>
            Diff: {diff > 0 ? '+' : ''}{diff.toLocaleString('de-DE', {minimumFractionDigits: 1, maximumFractionDigits: 1})}
         </div>
      </div>
   );
}
