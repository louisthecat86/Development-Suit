import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, AlertTriangle, ArrowRight, Save, GitBranch, CheckCircle2, XCircle, HelpCircle, FileText, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { FmeaDecisionTreeDialog } from "./fmea-decision-tree-dialog";

// Types
export interface FmeaRow {
    id: string;
    hazard: string;
    category: 'Physikalisch' | 'Mikrobiologisch' | 'Chemisch' | 'Allergene';
    severity: number; // 1-3
    occurrence: number; // 1-3
    measures: string;
}

export interface CcpRow {
    id: string;
    step: string;
    description: string;
    hazardType: 'Physikalisch' | 'Mikrobiologisch' | 'Chemisch' | 'Allergene';
    q1: boolean | null;
    q2: boolean | null;
    q3: boolean | null;
    q4: boolean | null;
    result: 'CCP' | 'CP' | 'KP';
    controlMeasures: string;
    decisionPath?: string; // To store the path taken (e.g., "Y-N-Y")
}

export interface FmeaData {
    hazards: FmeaRow[];
    ccps: CcpRow[];
    updatedAt: string;
}

interface FmeaEditorProps {
    initialData?: FmeaData;
    onSave: (data: FmeaData) => void;
    productName?: string;
    articleNumber?: string;
}

// Decision Tree Logic
const DECISION_TREE = {
    q1: {
        text: "Existieren Maßnahmen zur Beherrschung der Gefahr?",
        yes: "q2",
        no: "modification_check"
    },
    modification_check: {
        text: "Ist eine Beherrschung an diesem Schritt notwendig für die Sicherheit?",
        yes: "modify_step", // End: Modify step/process product
        no: "not_ccp" // End: Not a CCP
    },
    q2: {
        text: "Ist der Schritt speziell dazu bestimmt, die Gefahr zu eliminieren oder auf ein akzeptables Maß zu reduzieren?",
        yes: "is_ccp", // End: CCP
        no: "q3"
    },
    q3: {
        text: "Könnte eine Kontamination mit der identifizierten Gefahr inakzeptable Werte erreichen oder auf solche ansteigen?",
        yes: "q4",
        no: "not_ccp" // End: Not a CCP
    },
    q4: {
        text: "Wird ein nachfolgender Schritt die Gefahr eliminieren oder auf ein akzeptables Maß reduzieren?",
        yes: "not_ccp", // End: Not a CCP (Subsequent step will handle it)
        no: "is_ccp" // End: CCP
    }
};

export function FmeaEditor({ initialData, onSave, productName, articleNumber }: FmeaEditorProps) {
    const { toast } = useToast();
    const [hazards, setHazards] = useState<FmeaRow[]>(initialData?.hazards || []);
    const [ccps, setCcps] = useState<CcpRow[]>(initialData?.ccps || []);
    
    // Wizard State
    const [showWizard, setShowWizard] = useState(false);
    const [currentWizardStep, setCurrentWizardStep] = useState<string>("q1");
    const [wizardData, setWizardData] = useState<{
        hazardId?: string;
        hazardName?: string;
        category?: string;
        stepName?: string;
        answers: Record<string, boolean>;
        measures?: string;
    }>({ answers: {} });

    const addHazardRow = () => {
        const newRow: FmeaRow = {
            id: Date.now().toString(),
            hazard: "",
            category: "Physikalisch",
            severity: 1,
            occurrence: 1,
            measures: ""
        };
        setHazards([...hazards, newRow]);
    };

    const removeHazardRow = (id: string) => {
        setHazards(hazards.filter(row => row.id !== id));
    };

    const updateHazardRow = (id: string, field: keyof FmeaRow, value: any) => {
        setHazards(hazards.map(row => {
            if (row.id === id) {
                return { ...row, [field]: value };
            }
            return row;
        }));
    };

    const addCcpRow = () => {
        const newRow: CcpRow = {
            id: Date.now().toString(),
            step: "",
            description: "",
            hazardType: "Physikalisch",
            q1: null,
            q2: null,
            q3: null,
            q4: null,
            result: "KP",
            controlMeasures: ""
        };
        setCcps([...ccps, newRow]);
    };

    const removeCcpRow = (id: string) => {
        setCcps(ccps.filter(row => row.id !== id));
    };

    const updateCcpRow = (id: string, field: keyof CcpRow, value: any) => {
        setCcps(ccps.map(row => {
            if (row.id === id) {
                return { ...row, [field]: value };
            }
            return row;
        }));
    };

    const calculateRisk = (severity: number, occurrence: number) => {
        return severity * occurrence;
    };

    const getRiskLevel = (risk: number) => {
        if (risk >= 6) return { label: "HOCH (CCP/CP)", color: "text-red-600 font-bold", bg: "bg-red-50", isHigh: true };
        return { label: "Gering (GHP)", color: "text-green-600", bg: "bg-green-50", isHigh: false };
    };

    const handleSave = () => {
        onSave({
            hazards,
            ccps,
            updatedAt: new Date().toISOString()
        });
    };

    // Wizard Functions
    const startWizard = (isFullProcess: boolean = true) => {
        setWizardData({
            hazardId: undefined,
            hazardName: "",
            category: "Physikalisch",
            stepName: "", 
            answers: {},
            measures: "",
            severity: 1,
            occurrence: 1,
            isFullProcess: isFullProcess 
        });
        
        setCurrentWizardStep(isFullProcess ? "risk_assessment" : "setup"); 
        setShowWizard(true);
    };

    const handleRiskAssessmentNext = () => {
         // Check if risk is high enough to warrant CCP check
         const risk = calculateRisk(wizardData.severity || 1, wizardData.occurrence || 1);
         if (risk >= 6) {
             setCurrentWizardStep("q1"); // Go directly to first question, setup is done in risk assessment
         } else {
             setCurrentWizardStep("ghp_measures"); // Go to GHP measures only
         }
    };

    const handleWizardSetup = () => {
        if (wizardData.stepName) {
             setCurrentWizardStep("q1");
        }
    };

    const handleWizardAnswer = (answer: boolean) => {
        const currentLogic = DECISION_TREE[currentWizardStep as keyof typeof DECISION_TREE];
        // @ts-ignore
        const nextStep = answer ? currentLogic.yes : currentLogic.no;
        
        setWizardData(prev => ({
            ...prev,
            answers: { ...prev.answers, [currentWizardStep]: answer }
        }));

        setCurrentWizardStep(nextStep);
    };

    const finishWizard = (result: 'CCP' | 'CP' | 'KP', measures: string) => {
        // 1. Create Hazard Row
        const newHazard: FmeaRow = {
            id: Date.now().toString(),
            hazard: wizardData.hazardName || "Unbenannte Gefahr",
            // @ts-ignore
            category: wizardData.category || "Physikalisch",
            severity: wizardData.severity || 1,
            occurrence: wizardData.occurrence || 1,
            measures: measures
        };
        
        // Add to hazards table
        setHazards(prev => [...prev, newHazard]);

        // 2. If it's a CCP/CP (High Risk), also add to CCP table
        if (result !== 'KP') {
             const newCcp: CcpRow = {
                id: (Date.now() + 1).toString(),
                step: wizardData.stepName || "Neuer Prozessschritt",
                description: wizardData.hazardName || "Gefahrenanalyse",
                // @ts-ignore
                hazardType: wizardData.category || "Physikalisch",
                q1: wizardData.answers['q1'] ?? null,
                q2: wizardData.answers['q2'] ?? null,
                q3: wizardData.answers['q3'] ?? null,
                q4: wizardData.answers['q4'] ?? null,
                result: result,
                controlMeasures: measures
            };
            setCcps(prev => [...prev, newCcp]);
        }

        setShowWizard(false);
    };

    const sendReportToQS = () => {
        const subject = encodeURIComponent(`FMEA Entscheidung: ${productName || "Produkt"} - ${wizardData.stepName} - ${currentWizardStep === 'is_ccp' ? 'CCP' : 'CP'}`);
        const body = encodeURIComponent(
`Sehr geehrte Qualitätssicherung,

Im Rahmen der FMEA für das Produkt "${productName || "Unbekannt"}" (Art.Nr.: ${articleNumber || "k.A."}) wurde folgende Entscheidung getroffen:

Prozessschritt: ${wizardData.stepName}
Gefahr: ${wizardData.hazardName}
Ergebnis: ${currentWizardStep === 'is_ccp' ? 'KRITISCHER LENKUNGSPUNKT (CCP)' : 'CP (Kontrollpunkt)'}

Maßnahmen:
${wizardData.measures}

Bitte um Prüfung und Freigabe.
`
        );
        window.location.href = `mailto:qs@example.com?subject=${subject}&body=${body}`;
        toast({ title: "E-Mail geöffnet", description: "Entwurf für QS wurde erstellt." });
    };

    return (
        <div className="space-y-8">
            <Card className="border-l-4 border-l-orange-500">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 w-full">
                        <AlertTriangle className="w-5 h-5 text-orange-500" />
                        4.0 Fehlermöglichkeit- und Einflussanalyse (FMEA)
                        <FmeaDecisionTreeDialog />
                    </CardTitle>
                    <CardDescription>
                        Die FMEA ist nur für neue Produktarten, neue kritische Rohstoffe oder bedeutsame Änderungen im Produktionsablauf durchzuführen.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        {/* Hazard Analysis Table */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                             <div 
                                className="border-2 border-dashed border-slate-200 rounded-lg p-6 hover:bg-slate-50 cursor-pointer transition-colors flex flex-col items-center justify-center text-center gap-3 group"
                                onClick={() => startWizard(true)}
                             >
                                <div className="bg-blue-100 p-3 rounded-full text-blue-600 group-hover:bg-blue-200 transition-colors">
                                    <GitBranch className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900">FMEA Assistent starten</h3>
                                    <p className="text-sm text-slate-500 mt-1">Geführte Risikoanalyse & CCP-Ermittlung</p>
                                </div>
                             </div>

                             <div 
                                className="border-2 border-dashed border-slate-200 rounded-lg p-6 hover:bg-slate-50 cursor-pointer transition-colors flex flex-col items-center justify-center text-center gap-3 group"
                                onClick={addHazardRow}
                             >
                                <div className="bg-slate-100 p-3 rounded-full text-slate-600 group-hover:bg-slate-200 transition-colors">
                                    <FileText className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900">Manuelle Erfassung</h3>
                                    <p className="text-sm text-slate-500 mt-1">Direkte Eingabe in die Tabelle</p>
                                </div>
                             </div>
                        </div>

                        <div className="rounded-md border">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead className="w-[20%]">Gefährdung</TableHead>
                                        <TableHead className="w-[15%]">Kategorie</TableHead>
                                        <TableHead className="w-[10%] text-center" title="1=leicht, 2=mittel, 3=schwer">Bedeutung (B)</TableHead>
                                        <TableHead className="w-[10%] text-center" title="1=unwahrscheinlich, 2=möglich, 3=wahrscheinlich">Vorkommen (V)</TableHead>
                                        <TableHead className="w-[10%] text-center">Risiko (B x V)</TableHead>
                                        <TableHead className="w-[25%]">Maßnahmen</TableHead>
                                        <TableHead className="w-[10%]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {hazards.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                                                Noch keine Risiken erfasst. Wählen Sie oben eine Methode.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {hazards.map((row) => {
                                        const risk = calculateRisk(row.severity, row.occurrence);
                                        const riskInfo = getRiskLevel(risk);
                                        
                                        return (
                                            <TableRow key={row.id} className={risk >= 6 ? "bg-red-50/30" : ""}>
                                                <TableCell>
                                                    <Input 
                                                        value={row.hazard} 
                                                        onChange={(e) => updateHazardRow(row.id, "hazard", e.target.value)}
                                                        placeholder="Beschreiben..." 
                                                        className="border-0 shadow-none focus-visible:ring-0 px-0 h-auto"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Select value={row.category} onValueChange={(val) => updateHazardRow(row.id, "category", val)}>
                                                        <SelectTrigger className="h-8 border-0 shadow-none bg-transparent p-0">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Physikalisch">Physikalisch</SelectItem>
                                                            <SelectItem value="Mikrobiologisch">Mikrobiologisch</SelectItem>
                                                            <SelectItem value="Chemisch">Chemisch</SelectItem>
                                                            <SelectItem value="Allergene">Allergene</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <select 
                                                        className="bg-transparent text-center w-full cursor-pointer focus:outline-none"
                                                        value={row.severity}
                                                        onChange={(e) => updateHazardRow(row.id, "severity", parseInt(e.target.value))}
                                                    >
                                                        <option value={1}>1 (leicht)</option>
                                                        <option value={2}>2 (mittel)</option>
                                                        <option value={3}>3 (schwer)</option>
                                                    </select>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <select 
                                                        className="bg-transparent text-center w-full cursor-pointer focus:outline-none"
                                                        value={row.occurrence}
                                                        onChange={(e) => updateHazardRow(row.id, "occurrence", parseInt(e.target.value))}
                                                    >
                                                        <option value={1}>1 (selten)</option>
                                                        <option value={2}>2 (möglich)</option>
                                                        <option value={3}>3 (häufig)</option>
                                                    </select>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className={`font-bold ${riskInfo.color}`}>
                                                        {risk}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Input 
                                                        value={row.measures} 
                                                        onChange={(e) => updateHazardRow(row.id, "measures", e.target.value)}
                                                        placeholder="GHP Maßnahmen..." 
                                                        className="border-0 shadow-none focus-visible:ring-0 px-0 h-auto"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        {riskInfo.isHigh && (
                                                            <Button 
                                                                variant="outline" 
                                                                size="sm" 
                                                                className="h-7 text-xs bg-red-100 text-red-700 border-red-200 hover:bg-red-200"
                                                                onClick={() => {
                                                                    // Start wizard manually for existing row
                                                                    setWizardData({
                                                                        hazardId: row.id,
                                                                        hazardName: row.hazard,
                                                                        category: row.category,
                                                                        stepName: "", // We don't have this in row data yet, user adds it
                                                                        answers: {},
                                                                        measures: row.measures,
                                                                        severity: row.severity,
                                                                        occurrence: row.occurrence,
                                                                        isFullProcess: false
                                                                    });
                                                                    setCurrentWizardStep("setup");
                                                                    setShowWizard(true);
                                                                }}
                                                                title="CCP-Entscheidungsbaum starten"
                                                            >
                                                                <GitBranch className="w-3.5 h-3.5 mr-1" /> CCP Check
                                                            </Button>
                                                        )}
                                                        <Button variant="ghost" size="icon" onClick={() => removeHazardRow(row.id)} className="h-6 w-6 text-slate-400 hover:text-red-500">
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                            <div className="p-2 bg-slate-50 border-t flex justify-between items-center">
                                <Button variant="ghost" size="sm" onClick={addHazardRow} className="text-blue-600 hover:text-blue-800 hover:bg-blue-50">
                                    <Plus className="w-4 h-4 mr-2" /> Zeile hinzufügen
                                </Button>
                                <div className="text-xs text-slate-500 flex gap-4">
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> 1-4: GHP (Gute Herstellungspraxis)</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> 6-9: CCP Prüfung erforderlich</span>
                                </div>
                            </div>
                        </div>

                        {/* CCP Decision Tree - Only shown if high risks exist or manually added */}
                        <div className="space-y-4 pt-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    Entscheidungsbaum für Lenkungspunkte (CCP/CP)
                                </h3>
                            </div>
                            
                            <div className="rounded-md border overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="w-[15%]">Prozessstufe</TableHead>
                                            <TableHead className="w-[20%]">Mögliche Gefahr</TableHead>
                                            <TableHead className="w-[5%] text-center" title="Gesteuerte Gefahr?">F1</TableHead>
                                            <TableHead className="w-[5%] text-center" title="Gefahr eliminiert?">F2</TableHead>
                                            <TableHead className="w-[5%] text-center" title="Risikoüberschreitung möglich?">F3</TableHead>
                                            <TableHead className="w-[5%] text-center" title="Spätere Stufe eliminiert Gefahr?">F4</TableHead>
                                            <TableHead className="w-[10%] text-center">Ergebnis</TableHead>
                                            <TableHead className="w-[30%]">Lenkungsbedingungen</TableHead>
                                            <TableHead className="w-[5%]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {ccps.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                                                    Keine CCP-Prüfungen. Nur notwendig bei Risiko &ge; 6.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {ccps.map((row) => (
                                            <TableRow key={row.id}>
                                                <TableCell>
                                                    <Input 
                                                        value={row.step} 
                                                        onChange={(e) => updateCcpRow(row.id, "step", e.target.value)}
                                                        placeholder="z.B. Erhitzung..." 
                                                        className="border-0 shadow-none focus-visible:ring-0 px-0 h-auto font-medium"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Select value={row.hazardType} onValueChange={(val) => updateCcpRow(row.id, "hazardType", val)}>
                                                        <SelectTrigger className="h-8 border-0 shadow-none bg-transparent p-0">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Physikalisch">Physikalisch</SelectItem>
                                                            <SelectItem value="Mikrobiologisch">Mikrobiologisch</SelectItem>
                                                            <SelectItem value="Chemisch">Chemisch</SelectItem>
                                                            <SelectItem value="Allergene">Allergene</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                {/* Decision Tree Questions - Simplified as Yes/No Toggles */}
                                                <TableCell className="text-center p-1">
                                                     <input type="checkbox" checked={row.q1 === true} onChange={(e) => updateCcpRow(row.id, "q1", e.target.checked)} />
                                                </TableCell>
                                                <TableCell className="text-center p-1">
                                                     <input type="checkbox" checked={row.q2 === true} onChange={(e) => updateCcpRow(row.id, "q2", e.target.checked)} />
                                                </TableCell>
                                                <TableCell className="text-center p-1">
                                                     <input type="checkbox" checked={row.q3 === true} onChange={(e) => updateCcpRow(row.id, "q3", e.target.checked)} />
                                                </TableCell>
                                                <TableCell className="text-center p-1">
                                                     <input type="checkbox" checked={row.q4 === true} onChange={(e) => updateCcpRow(row.id, "q4", e.target.checked)} />
                                                </TableCell>
                                                
                                                <TableCell className="text-center">
                                                     <Select value={row.result} onValueChange={(val) => updateCcpRow(row.id, "result", val)}>
                                                        <SelectTrigger className={`h-8 border-0 shadow-none p-0 font-bold ${row.result === 'CCP' ? 'text-red-600' : 'text-slate-600'}`}>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="KP">KP (GHP)</SelectItem>
                                                            <SelectItem value="CP">CP</SelectItem>
                                                            <SelectItem value="CCP">CCP</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell>
                                                    <Textarea 
                                                        value={row.controlMeasures} 
                                                        onChange={(e) => updateCcpRow(row.id, "controlMeasures", e.target.value)}
                                                        placeholder="Maßnahmen..." 
                                                        className="min-h-[40px] border-0 shadow-none focus-visible:ring-0 px-0 py-1 resize-y bg-transparent"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" onClick={() => removeCcpRow(row.id)} className="h-6 w-6 text-slate-400 hover:text-red-500">
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                <div className="p-2 bg-slate-50 border-t">
                                    <Button variant="ghost" size="sm" onClick={addCcpRow} className="text-blue-600 hover:text-blue-800 hover:bg-blue-50">
                                        <Plus className="w-4 h-4 mr-2" /> Prozessschritt hinzufügen
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="bg-slate-50 border-t flex justify-end p-4">
                    <Button onClick={handleSave} className="gap-2 bg-orange-600 hover:bg-orange-700 text-white">
                        <Save className="w-4 h-4" /> FMEA Speichern
                    </Button>
                </CardFooter>
            </Card>

            {/* Decision Tree Wizard Dialog */}
            <Dialog open={showWizard} onOpenChange={setShowWizard}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <GitBranch className="w-5 h-5 text-blue-600" />
                            CCP Entscheidungsbaum
                        </DialogTitle>
                        <DialogDescription>
                            Beantworten Sie die Fragen, um den Status des Lenkungspunktes zu ermitteln.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Risk Assessment Step (New) */}
                    {currentWizardStep === 'risk_assessment' && (
                        <div className="py-4 space-y-4 animate-in fade-in slide-in-from-right-4">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Prozessschritt</Label>
                                    <Input 
                                        placeholder="z.B. Erhitzung, Metalldetektor..." 
                                        value={wizardData.stepName} 
                                        onChange={(e) => setWizardData({...wizardData, stepName: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Gefahr</Label>
                                    <Input 
                                        placeholder="Beschreiben Sie die Gefahr..." 
                                        value={wizardData.hazardName} 
                                        onChange={(e) => setWizardData({...wizardData, hazardName: e.target.value})}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Bedeutung (Schwere)</Label>
                                        <Select 
                                            value={wizardData.severity?.toString()} 
                                            onValueChange={(v) => setWizardData({...wizardData, severity: parseInt(v)})}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1">1 - Leicht</SelectItem>
                                                <SelectItem value="2">2 - Mittel</SelectItem>
                                                <SelectItem value="3">3 - Schwer</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Auftretenswahrscheinlichkeit</Label>
                                        <Select 
                                            value={wizardData.occurrence?.toString()} 
                                            onValueChange={(v) => setWizardData({...wizardData, occurrence: parseInt(v)})}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1">1 - Selten</SelectItem>
                                                <SelectItem value="2">2 - Möglich</SelectItem>
                                                <SelectItem value="3">3 - Häufig</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                
                                <div className="p-4 bg-slate-50 rounded-lg flex justify-between items-center">
                                    <span className="text-sm font-medium">Risikozahl (B x A):</span>
                                    {(() => {
                                        const risk = calculateRisk(wizardData.severity || 1, wizardData.occurrence || 1);
                                        const level = getRiskLevel(risk);
                                        return (
                                            <Badge className={`${level.isHigh ? 'bg-red-100 text-red-800 hover:bg-red-100' : 'bg-green-100 text-green-800 hover:bg-green-100'} border-0`}>
                                                {risk} - {level.label}
                                            </Badge>
                                        );
                                    })()}
                                </div>
                            </div>
                            <Button onClick={handleRiskAssessmentNext} disabled={!wizardData.stepName || !wizardData.hazardName}>
                                Weiter
                            </Button>
                        </div>
                    )}

                    {/* Step Name Input (if in setup mode - only if NOT full process) */}
                    {currentWizardStep === 'setup' && !wizardData.isFullProcess && (
                        <div className="py-4 space-y-4">
                            <div className="space-y-2">
                                <Label>Prozessschritt</Label>
                                <Input 
                                    placeholder="z.B. Erhitzung, Metalldetektor..." 
                                    value={wizardData.stepName} 
                                    onChange={(e) => setWizardData({...wizardData, stepName: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Gefahr</Label>
                                <Input 
                                    placeholder="Beschreiben Sie die Gefahr..." 
                                    value={wizardData.hazardName} 
                                    onChange={(e) => setWizardData({...wizardData, hazardName: e.target.value})}
                                />
                            </div>
                            <Button onClick={handleWizardSetup} disabled={!wizardData.stepName}>
                                Weiter zur Analyse
                            </Button>
                        </div>
                    )}

                    {/* GHP Measures Only (Low Risk) */}
                    {currentWizardStep === 'ghp_measures' && (
                         <div className="py-6 space-y-6 animate-in fade-in slide-in-from-right-4">
                            <div className="bg-green-50 p-6 rounded-lg text-center border-2 border-green-200 flex flex-col items-center gap-4">
                                <CheckCircle2 className="w-16 h-16 text-green-600" />
                                <h2 className="text-2xl font-bold text-green-800">Geringes Risiko (GHP)</h2>
                                <p className="text-sm opacity-90 max-w-md mx-auto text-green-800">
                                    Das Risiko ist niedrig (&lt; 6). Es sind keine CCP-Maßnahmen erforderlich. Bitte definieren Sie die Maßnahmen der Guten Herstellungspraxis (GHP).
                                </p>
                            </div>

                            <div className="space-y-3">
                                <Label>GHP Maßnahmen</Label>
                                <Textarea 
                                    placeholder="Beschreiben Sie die Basishygiene-Maßnahmen..." 
                                    value={wizardData.measures}
                                    onChange={(e) => setWizardData({...wizardData, measures: e.target.value})}
                                    className="min-h-[100px]"
                                />
                            </div>
                         </div>
                    )}

                    {/* Decision Questions */}
                    {currentWizardStep !== 'setup' && currentWizardStep !== 'risk_assessment' && currentWizardStep !== 'ghp_measures' && !['is_ccp', 'not_ccp', 'modify_step'].includes(currentWizardStep) && (
                        <div className="py-6 space-y-6 animate-in fade-in slide-in-from-right-4">
                            <div className="space-y-2">
                                <Badge variant="outline" className="text-slate-500 mb-2">
                                    Frage {currentWizardStep.toUpperCase()}
                                </Badge>
                                <h3 className="text-xl font-semibold text-slate-900 leading-tight">
                                    {/* @ts-ignore */}
                                    {DECISION_TREE[currentWizardStep]?.text}
                                </h3>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4">
                                <Button 
                                    size="lg" 
                                    variant="outline" 
                                    className="h-24 text-lg border-2 hover:border-green-500 hover:bg-green-50 hover:text-green-700 transition-all flex flex-col gap-2"
                                    onClick={() => handleWizardAnswer(true)}
                                >
                                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                                    JA
                                </Button>
                                <Button 
                                    size="lg" 
                                    variant="outline" 
                                    className="h-24 text-lg border-2 hover:border-red-500 hover:bg-red-50 hover:text-red-700 transition-all flex flex-col gap-2"
                                    onClick={() => handleWizardAnswer(false)}
                                >
                                    <XCircle className="w-8 h-8 text-red-600" />
                                    NEIN
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Results */}
                    {['is_ccp', 'not_ccp', 'modify_step', 'ghp_measures'].includes(currentWizardStep) && (
                         <div className="py-6 space-y-6 animate-in zoom-in-95 duration-300">
                            {currentWizardStep !== 'ghp_measures' && (
                                <div className={`p-6 rounded-lg text-center border-2 flex flex-col items-center gap-4
                                    ${currentWizardStep === 'is_ccp' ? 'bg-red-50 border-red-200 text-red-800' : 
                                      currentWizardStep === 'modify_step' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                                      'bg-green-50 border-green-200 text-green-800'}`}>
                                    
                                    {currentWizardStep === 'is_ccp' && <AlertTriangle className="w-16 h-16 text-red-600" />}
                                    {currentWizardStep === 'not_ccp' && <CheckCircle2 className="w-16 h-16 text-green-600" />}
                                    {currentWizardStep === 'modify_step' && <HelpCircle className="w-16 h-16 text-amber-600" />}

                                    <h2 className="text-2xl font-bold">
                                        {currentWizardStep === 'is_ccp' ? 'KRITISCHER LENKUNGSPUNKT (CCP)' : 
                                         currentWizardStep === 'modify_step' ? 'PROZESS ANPASSEN' :
                                         'KEIN CCP (GHP/CP)'}
                                    </h2>
                                    <p className="text-sm opacity-90 max-w-md mx-auto">
                                        {currentWizardStep === 'is_ccp' ? 'Dieser Schritt ist essenziell zur Beherrschung der Gefahr. Legen Sie Grenzwerte und Überwachungsmaßnahmen fest.' : 
                                         currentWizardStep === 'modify_step' ? 'Modifizieren Sie den Prozessschritt, das Produkt oder das Verfahren, um die Gefahr zu beherrschen.' :
                                         'Die Gefahr wird durch GHP (Gute Herstellungspraxis) oder nachfolgende Schritte beherrscht.'}
                                    </p>
                                </div>
                            )}

                            {currentWizardStep !== 'modify_step' && (
                                <div className="space-y-3">
                                    <Label>Festgelegte Maßnahmen & Begründung</Label>
                                    <Textarea 
                                        placeholder="Dokumentieren Sie hier Ihre Entscheidung..." 
                                        value={wizardData.measures}
                                        onChange={(e) => setWizardData({...wizardData, measures: e.target.value})}
                                        className="min-h-[100px]"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        {['is_ccp', 'not_ccp', 'modify_step', 'ghp_measures'].includes(currentWizardStep) && (
                            <div className="flex w-full gap-2 items-center">
                                <Button variant="ghost" onClick={() => startWizard()} className="mr-auto">
                                    Neu starten
                                </Button>
                                
                                <Button 
                                    variant="outline" 
                                    className="gap-2 text-slate-600"
                                    onClick={sendReportToQS}
                                    title="Entscheidung per E-Mail an QS senden"
                                >
                                    <Mail className="w-4 h-4" /> Meldung an QS
                                </Button>

                                {currentWizardStep !== 'modify_step' && (
                                    <Button onClick={() => finishWizard(currentWizardStep === 'is_ccp' ? 'CCP' : (currentWizardStep === 'not_ccp' ? 'CP' : 'KP'), wizardData.measures || "")}>
                                        In Tabelle übernehmen
                                    </Button>
                                )}
                            </div>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
