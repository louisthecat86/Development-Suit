import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeftRight, Check, X, ArrowRight, Settings } from "lucide-react";
import { ProcessSettings, ProcessSection } from "./process-parameters-editor";

interface ProcessComparisonProps {
    oldProcess: ProcessSettings;
    newProcess: ProcessSettings;
    onClose: () => void;
}

export function ProcessComparison({ oldProcess, newProcess, onClose }: ProcessComparisonProps) {
    
    // Helper to find diffs
    const getProcessDiffs = () => {
        const diffs: {
            sectionTitle: string;
            fieldLabel: string;
            oldValue: string;
            newValue: string;
            status: 'changed' | 'same' | 'added' | 'removed';
        }[] = [];

        // Map sections for easier access
        const oldSectionsMap = new Map(oldProcess.sections.map(s => [s.id, s]));
        const newSectionsMap = new Map(newProcess.sections.map(s => [s.id, s]));

        // Check all sections in new process
        newProcess.sections.forEach(newSection => {
            const oldSection = oldSectionsMap.get(newSection.id);
            
            if (!oldSection) {
                // Entire section added
                newSection.fields.forEach(field => {
                    diffs.push({
                        sectionTitle: newSection.title,
                        fieldLabel: field.label,
                        oldValue: "-",
                        newValue: field.value,
                        status: 'added'
                    });
                });
                return;
            }

            // Check fields in this section
            const oldFieldsMap = new Map(oldSection.fields.map(f => [f.id, f]));
            
            newSection.fields.forEach(newField => {
                const oldField = oldFieldsMap.get(newField.id);
                
                if (!oldField) {
                    diffs.push({
                        sectionTitle: newSection.title,
                        fieldLabel: newField.label,
                        oldValue: "-",
                        newValue: newField.value,
                        status: 'added'
                    });
                } else if (oldField.value !== newField.value) {
                    diffs.push({
                        sectionTitle: newSection.title,
                        fieldLabel: newField.label,
                        oldValue: oldField.value,
                        newValue: newField.value,
                        status: 'changed'
                    });
                } else {
                    // Same
                    // We can include same if we want to show everything, but usually we filter for diffs
                    // or show them if "show all" is toggled. For now, let's skip 'same' to focus on changes
                    // unless the user specifically wants to see everything.
                }
            });
        });
        
        // Check for removed sections/fields (exist in old but not in new)
        oldProcess.sections.forEach(oldSection => {
            const newSection = newSectionsMap.get(oldSection.id);
             if (!newSection) {
                // Entire section removed
                oldSection.fields.forEach(field => {
                    diffs.push({
                        sectionTitle: oldSection.title,
                        fieldLabel: field.label,
                        oldValue: field.value,
                        newValue: "-",
                        status: 'removed'
                    });
                });
                return;
             }
             
             const newFieldsMap = new Map(newSection.fields.map(f => [f.id, f]));
             oldSection.fields.forEach(oldField => {
                 if (!newFieldsMap.has(oldField.id)) {
                     diffs.push({
                        sectionTitle: oldSection.title,
                        fieldLabel: oldField.label,
                        oldValue: oldField.value,
                        newValue: "-",
                        status: 'removed'
                    });
                 }
             });
        });

        return diffs;
    };

    const diffs = getProcessDiffs();

    return (
        <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ArrowLeftRight className="w-5 h-5" /> Prozess-Vergleich
                    </DialogTitle>
                    <DialogDescription>
                        Vergleich zwischen Version {oldProcess.version} und {newProcess.version}.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div className="p-3 bg-muted/30 rounded border">
                        <div className="font-semibold text-muted-foreground mb-1">Referenz (v{oldProcess.version})</div>
                        <div className="text-xs text-muted-foreground">{new Date(oldProcess.updatedAt).toLocaleDateString()}</div>
                    </div>
                    <div className="p-3 bg-primary/5 rounded border border-primary/20">
                        <div className="font-semibold text-primary mb-1">Vergleich (v{newProcess.version})</div>
                        <div className="text-xs text-muted-foreground">{new Date(newProcess.updatedAt).toLocaleDateString()}</div>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden border rounded-md">
                    <ScrollArea className="h-full">
                        {diffs.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">
                                Keine Unterschiede gefunden. Die Parameter sind identisch.
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[200px]">Bereich</TableHead>
                                        <TableHead className="w-[200px]">Parameter</TableHead>
                                        <TableHead>Wert (Alt)</TableHead>
                                        <TableHead>Wert (Neu)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {diffs.map((diff, idx) => {
                                        let rowClass = "";
                                        if (diff.status === 'added') rowClass = "bg-green-50 text-green-700";
                                        if (diff.status === 'removed') rowClass = "bg-red-50 text-red-700 opacity-60";
                                        if (diff.status === 'changed') rowClass = "bg-yellow-50";

                                        return (
                                            <TableRow key={idx} className={rowClass}>
                                                <TableCell className="font-medium text-muted-foreground">
                                                    {diff.sectionTitle}
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    {diff.fieldLabel}
                                                    {diff.status === 'added' && <Badge variant="outline" className="ml-2 bg-green-100 text-green-700 border-green-200 text-[10px] h-5">NEU</Badge>}
                                                    {diff.status === 'removed' && <Badge variant="outline" className="ml-2 bg-red-100 text-red-700 border-red-200 text-[10px] h-5">GELÖSCHT</Badge>}
                                                </TableCell>
                                                <TableCell className="font-mono text-muted-foreground">
                                                    {diff.oldValue}
                                                </TableCell>
                                                <TableCell className="font-mono font-medium">
                                                    {diff.newValue}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
}
