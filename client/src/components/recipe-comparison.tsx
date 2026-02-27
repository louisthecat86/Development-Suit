import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeftRight, Check, X, ArrowRight } from "lucide-react";
import { SavedRecipe } from "@/lib/recipe-db";

interface RecipeComparisonProps {
    oldRecipe: SavedRecipe;
    newRecipe: SavedRecipe;
    onClose: () => void;
}

export function RecipeComparison({ oldRecipe, newRecipe, onClose }: RecipeComparisonProps) {
    
    // Helper to find diffs
    const getIngredientDiff = () => {
        const allIds = new Set([
            ...oldRecipe.ingredients.map(i => i.name), // Using name as key for simplicity in visualization if IDs changed
            ...newRecipe.ingredients.map(i => i.name)
        ]);
        
        return Array.from(allIds).map(name => {
            const oldIng = oldRecipe.ingredients.find(i => i.name === name);
            const newIng = newRecipe.ingredients.find(i => i.name === name);
            
            let status: 'added' | 'removed' | 'changed' | 'same' = 'same';
            if (!oldIng && newIng) status = 'added';
            else if (oldIng && !newIng) status = 'removed';
            else if (oldIng && newIng && oldIng.rawWeight !== newIng.rawWeight) status = 'changed';
            
            return {
                name,
                oldWeight: oldIng?.rawWeight || 0,
                newWeight: newIng?.rawWeight || 0,
                status
            };
        }).sort((a, b) => {
            // Sort: Changed/Added/Removed first, then same
            if (a.status !== 'same' && b.status === 'same') return -1;
            if (a.status === 'same' && b.status !== 'same') return 1;
            return a.name.localeCompare(b.name);
        });
    };

    const diffs = getIngredientDiff();

    return (
        <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ArrowLeftRight className="w-5 h-5" /> Rezeptur-Vergleich
                    </DialogTitle>
                    <DialogDescription>
                        Vergleich zwischen zwei Versionen.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div className="p-3 bg-muted/30 rounded border">
                        <div className="font-semibold text-muted-foreground mb-1">Referenz (Alt)</div>
                        <div className="font-medium">{oldRecipe.name}</div>
                        <div className="text-xs text-muted-foreground">{new Date(oldRecipe.updatedAt).toLocaleDateString()}</div>
                    </div>
                    <div className="p-3 bg-primary/5 rounded border border-primary/20">
                        <div className="font-semibold text-primary mb-1">Vergleich (Neu)</div>
                        <div className="font-medium">{newRecipe.name}</div>
                        <div className="text-xs text-muted-foreground">{new Date(newRecipe.updatedAt).toLocaleDateString()}</div>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden border rounded-md">
                    <ScrollArea className="h-full">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Zutat</TableHead>
                                    <TableHead className="text-right">Menge (Alt)</TableHead>
                                    <TableHead className="text-right">Menge (Neu)</TableHead>
                                    <TableHead className="text-right">Diff</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {diffs.map((diff) => {
                                    const diffVal = diff.newWeight - diff.oldWeight;
                                    let rowClass = "";
                                    if (diff.status === 'added') rowClass = "bg-green-50 text-green-700";
                                    if (diff.status === 'removed') rowClass = "bg-red-50 text-red-700 opacity-60";
                                    if (diff.status === 'changed') rowClass = "bg-yellow-50";

                                    return (
                                        <TableRow key={diff.name} className={rowClass}>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    {diff.status === 'added' && <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 text-[10px] h-5">NEU</Badge>}
                                                    {diff.status === 'removed' && <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-[10px] h-5">GELÖSCHT</Badge>}
                                                    {diff.name}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-muted-foreground">
                                                {diff.oldWeight > 0 ? diff.oldWeight.toFixed(3) : "-"}
                                            </TableCell>
                                            <TableCell className="text-right font-mono font-medium">
                                                {diff.newWeight > 0 ? diff.newWeight.toFixed(3) : "-"}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                                {diffVal !== 0 && (
                                                    <span className={diffVal > 0 ? "text-green-600" : "text-red-600"}>
                                                        {diffVal > 0 ? "+" : ""}{diffVal.toFixed(3)}
                                                    </span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                        
                        <div className="p-4 border-t bg-slate-50 mt-4">
                            <h4 className="font-semibold text-sm mb-2">Parameter Vergleich</h4>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Garverlust:</span>
                                    <div className="flex gap-2">
                                        <span className="line-through text-muted-foreground">{oldRecipe.cookingLoss}%</span>
                                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                                        <span className={oldRecipe.cookingLoss !== newRecipe.cookingLoss ? "text-primary font-bold" : ""}>{newRecipe.cookingLoss}%</span>
                                    </div>
                                </div>
                                {/* Add more params if needed */}
                            </div>
                        </div>
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
}
