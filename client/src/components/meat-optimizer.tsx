import React, { useState, useEffect } from "react";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableRow,
  TableHead,
  TableHeader
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Wand2, Scale, Lock, RefreshCw, AlertTriangle } from "lucide-react";
import { Ingredient } from "@/lib/quid-calculator";

interface MeatOptimizerProps {
  ingredients: Ingredient[];
  cookingLoss: number;
  onApply: (newIngredients: Ingredient[]) => void;
}

type IngredientRole = 'target' | 'filler' | 'fixed';

interface OptimizerIngredient extends Ingredient {
  originalWeight: number;
  role: IngredientRole;
}

export function MeatOptimizer({ ingredients, cookingLoss, onApply }: MeatOptimizerProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'raw' | 'cooked'>('raw');
  const [targetPercent, setTargetPercent] = useState<number>(0);
  const [currentPercent, setCurrentPercent] = useState<number>(0);
  const [optIngredients, setOptIngredients] = useState<OptimizerIngredient[]>([]);
  
  // Initialize on open
  useEffect(() => {
    if (open) {
      const startPercent = calculateStats(ingredients, mode);
      setCurrentPercent(startPercent);
      setTargetPercent(startPercent);
      
      setOptIngredients(ingredients.map(i => {
        // Auto-detect role
        let role: IngredientRole = 'fixed';
        
        if (i.isMeat) {
          role = 'target';
        } else if (i.isWater) {
          role = 'filler';
        } else {
          // Check name for fat/speck if no water present? 
          // For safety, default everything else to fixed (spices, additives)
          const lower = i.name.toLowerCase();
          if (lower.includes('eis') || lower.includes('wasser') || lower.includes('schüttung')) {
             role = 'filler';
          }
        }

        return {
          ...i,
          originalWeight: i.rawWeight,
          role
        };
      }));
    }
  }, [open, ingredients]);

  // Recalculate current stats when mode changes
  useEffect(() => {
    if (open) {
      const stats = calculateStats(ingredients, mode);
      setTargetPercent(stats);
      setCurrentPercent(stats);
    }
  }, [mode]);

  const calculateStats = (ings: Ingredient[], calcMode: 'raw' | 'cooked') => {
    const totalWeight = ings.reduce((sum, i) => sum + i.rawWeight, 0);
    const meatWeight = ings.reduce((sum, i) => sum + (i.isMeat ? i.rawWeight : 0), 0);
    
    if (totalWeight <= 0) return 0;

    if (calcMode === 'raw') {
      return Number(((meatWeight / totalWeight) * 100).toFixed(1));
    } else {
      const finalWeight = totalWeight * (1 - cookingLoss / 100);
      return finalWeight > 0 ? Number(((meatWeight / finalWeight) * 100).toFixed(1)) : 0;
    }
  };

  const changeRole = (index: number) => {
    const newIngs = [...optIngredients];
    const current = newIngs[index].role;
    // Cycle: Fixed -> Target -> Filler -> Fixed
    // But limit logic: Spices shouldn't easily become Target.
    
    if (current === 'fixed') newIngs[index].role = 'target';
    else if (current === 'target') newIngs[index].role = 'filler';
    else newIngs[index].role = 'fixed';
    
    setOptIngredients(newIngs);
  };

  const calculateOptimization = () => {
    // Strategy: Constant Batch Weight
    // 1. Calculate Total Batch Weight
    // 2. Calculate Weight of Fixed Ingredients (Salt, Spices...)
    // 3. Available Weight for Meat + Filler = Total - Fixed
    // 4. Calculate Required Meat Weight for Target %
    
    // Total Batch Weight
    const totalBatchWeight = optIngredients.reduce((sum, i) => sum + i.originalWeight, 0);
    
    // Identify Fixed Weight
    const fixedWeight = optIngredients
      .filter(i => i.role === 'fixed')
      .reduce((sum, i) => sum + i.originalWeight, 0);
      
    const availableForBalancing = totalBatchWeight - fixedWeight;
    
    if (availableForBalancing <= 0) return null; // Should not happen unless 100% spices

    // Calculate Target Meat Weight
    let requiredMeatWeight = 0;
    
    if (mode === 'raw') {
      // Target % = Meat / Total
      // Meat = Target% * Total
      requiredMeatWeight = (targetPercent / 100) * totalBatchWeight;
    } else {
      // Cooked Mode
      // Target % = Meat / (Total * Yield)
      // Meat = Target% * Total * Yield
      const yieldFactor = 1 - (cookingLoss / 100);
      requiredMeatWeight = (targetPercent / 100) * totalBatchWeight * yieldFactor;
    }

    // Now we need to achieve `requiredMeatWeight` using "Target" ingredients.
    // AND fill the rest of `availableForBalancing` using "Filler" ingredients.
    
    const currentTargetGroupWeight = optIngredients
      .filter(i => i.role === 'target')
      .reduce((sum, i) => sum + i.originalWeight, 0);
      
    const currentFillerGroupWeight = optIngredients
      .filter(i => i.role === 'filler')
      .reduce((sum, i) => sum + i.originalWeight, 0);

    // If we have no meat ingredients selected as target, we can't adjust meat
    if (currentTargetGroupWeight <= 0 && requiredMeatWeight > 0) return null;

    // Scaling Factors
    // NewTargetGroupWeight = requiredMeatWeight
    // NewFillerGroupWeight = availableForBalancing - requiredMeatWeight
    
    const newFillerGroupWeight = availableForBalancing - requiredMeatWeight;
    
    if (newFillerGroupWeight < 0) {
      // Impossible: Meat requires more space than available (even if we remove all water)
      return { impossible: true, reason: "Zu viel Fleisch für diese Rezepturgröße" };
    }
    
    if (newFillerGroupWeight > 0 && currentFillerGroupWeight <= 0) {
       // We need filler but have none selected
       return { impossible: true, reason: "Keine Ausgleichs-Zutat (z.B. Wasser) gewählt" };
    }

    const targetScale = requiredMeatWeight / currentTargetGroupWeight;
    // If currentFiller is 0, we can't scale it. handled above.
    const fillerScale = currentFillerGroupWeight > 0 ? newFillerGroupWeight / currentFillerGroupWeight : 0;
    
    return {
      targetScale,
      fillerScale,
      impossible: false
    };
  };

  const result = calculateOptimization();
  const isValid = result && !result.impossible;

  // Preview values
  const previewIngredients = optIngredients.map(i => {
    if (!result || result.impossible || result.targetScale === undefined || result.fillerScale === undefined) return i;
    
    let newWeight = i.originalWeight;
    if (i.role === 'target') newWeight = i.originalWeight * result.targetScale;
    if (i.role === 'filler') newWeight = i.originalWeight * result.fillerScale;
    
    return {
      ...i,
      rawWeight: newWeight
    };
  });

  const previewTotal = previewIngredients.reduce((s, i) => s + i.rawWeight, 0);
  const previewMeat = previewIngredients.reduce((s, i) => s + (i.isMeat ? i.rawWeight : 0), 0);
  const previewFinal = previewTotal * (1 - cookingLoss / 100);
  
  const previewPercentRaw = previewTotal > 0 ? (previewMeat / previewTotal) * 100 : 0;
  const previewPercentCooked = previewFinal > 0 ? (previewMeat / previewFinal) * 100 : 0;

  const displayPreviewPercent = mode === 'raw' ? previewPercentRaw : previewPercentCooked;

  const handleApply = () => {
    if (!isValid) return;
    const finalResult = ingredients.map((ing, idx) => ({
      ...ing,
      rawWeight: previewIngredients[idx].rawWeight
    }));
    onApply(finalResult);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">
          <Wand2 className="w-4 h-4 text-indigo-500" />
          Fleischgehalt Optimierer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-indigo-600" />
            Fleischgehalt Optimierer
          </DialogTitle>
          <DialogDescription>
            Passt Fleisch- und Wassermenge an, um den Zielwert zu erreichen.
            <br/>
            <strong>Wichtig:</strong> Die Gesamtmenge und Gewürze bleiben konstant, damit der Geschmack (Salzgehalt) stabil bleibt.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
          {/* Controls */}
          <div className="md:col-span-1 space-y-6 bg-slate-50 p-4 rounded-lg border">
            
            {/* Mode Switcher */}
            <div className="space-y-2">
               <Label>Basis der Berechnung</Label>
               <Tabs value={mode} onValueChange={(v) => setMode(v as 'raw' | 'cooked')} className="w-full">
                  <TabsList className="w-full grid grid-cols-2">
                    <TabsTrigger value="raw">Rohmasse</TabsTrigger>
                    <TabsTrigger value="cooked">Endprodukt</TabsTrigger>
                  </TabsList>
               </Tabs>
               <p className="text-[10px] text-muted-foreground mt-2">
                 {mode === 'raw' 
                   ? "Berechnet Anteil an der ungegarten Rohmasse." 
                   : `Berechnet QUID (Anteil am Endprodukt) mit ${cookingLoss}% Garverlust.`}
               </p>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Aktueller Wert</Label>
              <div className="text-2xl font-bold font-mono">{currentPercent.toFixed(1)} %</div>
            </div>

            <div className="space-y-4">
              <Label>Ziel-Wert (%)</Label>
              <div className="flex items-center gap-4">
                <Slider 
                  value={[targetPercent]} 
                  onValueChange={(v) => setTargetPercent(v[0])} 
                  min={0} 
                  max={mode === 'cooked' ? 200 : 100} 
                  step={0.5}
                  className="flex-1"
                />
                <Input 
                  type="number" 
                  value={targetPercent} 
                  onChange={(e) => setTargetPercent(Number(e.target.value))}
                  className="w-20 font-bold" 
                />
              </div>
            </div>

            <div className="pt-4 border-t">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Ergebnis-Vorschau:</span>
                {isValid ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Machbar</Badge>
                ) : (
                  <Badge variant="destructive">
                     {result && result.reason ? "Fehler" : "Nicht möglich"}
                  </Badge>
                )}
              </div>
              
              {!isValid && result && result.reason && (
                 <div className="text-xs text-destructive mb-2 font-medium">
                    {result.reason}
                 </div>
              )}

              {isValid ? (
                <div className="space-y-1">
                   <div className="flex justify-between text-sm">
                     <span>{mode === 'raw' ? 'Fleisch (Roh):' : 'Fleisch (QUID):'}</span>
                     <span className="font-mono font-bold text-primary">{displayPreviewPercent.toFixed(1)} %</span>
                   </div>
                   <div className="flex justify-between text-sm border-t pt-1 mt-1">
                     <span>Gesamtmasse (Roh):</span>
                     <span className="font-mono">{previewTotal.toFixed(2)} kg</span>
                   </div>
                   {Math.abs(previewTotal - optIngredients.reduce((s,i)=>s+i.originalWeight,0)) > 0.01 && (
                      <div className="text-[10px] text-amber-600 flex items-center gap-1">
                         <AlertTriangle className="w-3 h-3" /> Masse geändert (Achtung Salz!)
                      </div>
                   )}
                </div>
              ) : null}
            </div>
          </div>

          {/* Ingredients Table */}
          <div className="md:col-span-2 border rounded-md overflow-hidden flex flex-col">
             <div className="bg-slate-100 px-3 py-2 text-xs font-semibold uppercase text-slate-500 border-b">
               Zutaten & Rollen
             </div>
             <div className="p-2 bg-blue-50/50 text-xs text-blue-800 border-b flex gap-4">
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> Ziel (Fleisch)</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Ausgleich (Wasser)</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-400"></div> Fix (Gewürz)</span>
             </div>
            <div className="overflow-y-auto max-h-[400px]">
              <Table>
                <TableHeader>
                   <TableRow>
                      <TableHead className="w-[40%]">Zutat</TableHead>
                      <TableHead>Rolle</TableHead>
                      <TableHead className="text-right">Neu (kg)</TableHead>
                   </TableRow>
                </TableHeader>
                <TableBody>
                  {optIngredients.map((ing, idx) => {
                    const previewWeight = isValid ? previewIngredients[idx].rawWeight : ing.originalWeight;
                    
                    let rowClass = "";
                    if (ing.role === 'target') rowClass = "bg-green-50/50";
                    if (ing.role === 'filler') rowClass = "bg-blue-50/50";
                    if (ing.role === 'fixed') rowClass = "bg-slate-50 opacity-80";

                    return (
                      <TableRow key={idx} className={rowClass}>
                        <TableCell className="font-medium py-2">
                          <div className="flex items-center gap-2">
                             {ing.isMeat && <Badge variant="secondary" className="text-[10px] px-1 h-4">Fleisch</Badge>}
                             <span className="truncate max-w-[150px]" title={ing.name}>{ing.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2">
                           <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 text-xs border bg-white/50 hover:bg-white"
                              onClick={() => changeRole(idx)}
                           >
                              {ing.role === 'target' && <span className="text-green-700 font-bold">Ziel (Variabel)</span>}
                              {ing.role === 'filler' && <span className="text-blue-700 font-bold">Ausgleich</span>}
                              {ing.role === 'fixed' && <span className="text-slate-500 flex items-center gap-1"><Lock className="w-3 h-3"/> Fix</span>}
                           </Button>
                        </TableCell>
                        <TableCell className="text-right font-mono py-2">
                            {previewWeight.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
          <Button onClick={handleApply} disabled={!isValid}>
            Übernehmen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
