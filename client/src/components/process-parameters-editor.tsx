import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
    Save, History, Clock, FileText, ChevronDown, ChevronRight, 
    Plus, Trash2, Printer, Settings, Mail, AlertTriangle, ArrowLeftRight
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface ProcessSection {
    id: string;
    title: string;
    fields: {
        id: string;
        label: string;
        value: string; // For checkboxes, value can be "true"/"false" or comma separated for multiple
        type: 'text' | 'textarea' | 'number' | 'checkbox' | 'radio' | 'select';
        options?: string[]; // For radio/select
    }[];
}

export interface ProcessSettings {
    version: string;
    updatedAt: string;
    sections: ProcessSection[];
}

// Default Template
export const DEFAULT_PROCESS_SETTINGS: ProcessSettings = {
    version: "1.0",
    updatedAt: new Date().toISOString(),
    sections: [
        {
            id: "raw-material",
            title: "Vorbehandlung / Rohware",
            fields: [
                { id: "cutting", label: "Schneidekorridor / Wolfung", value: "", type: "textarea" },
                { id: "temp", label: "Temperatur Rohware (°C)", value: "", type: "text" },
            ]
        },
        {
            id: "processing",
            title: "Verarbeitung / Kutter",
            fields: [
                { id: "machine", label: "Maschine / Kutter", value: "", type: "text" },
                { id: "program", label: "Programm / Ablauf", value: "", type: "textarea" },
                { id: "end_temp", label: "Brät-Endtemperatur (°C)", value: "", type: "text" },
            ]
        },
        {
            id: "filling",
            title: "Füllerei / Clippen",
            fields: [
                { id: "casing", label: "Darm / Hülle", value: "", type: "text" },
                { id: "clip", label: "Clip / Verschluss", value: "", type: "text" },
                { id: "calibre", label: "Kaliber", value: "", type: "text" },
            ]
        },
        {
            id: "frying-line",
            title: "Bratstraßeneinstellung",
            fields: [
                { id: "frying-temp", label: "Plattentemperaturen (°C)", value: "", type: "text" },
                { id: "frying-height", label: "Höhe (mm)", value: "", type: "text" },
                { id: "frying-speed", label: "Geschwindigkeit (m/min)", value: "", type: "text" },
            ]
        },
        {
            id: "hot-air-tunnel",
            title: "Heißluft- / Dampftunnel",
            fields: [
                { id: "tunnel-plate-temp", label: "Plattentemperatur (°C)", value: "", type: "text" },
                { id: "fan-hz", label: "Heizlüfter (Hz)", value: "", type: "text" },
                { id: "air-temp", label: "Lufttemperatur (°C)", value: "", type: "text" },
                { id: "water-steam", label: "Wasser / Dampfzugabe", value: "", type: "text" },
            ]
        },
        {
            id: "freezer",
            title: "Tunnelfroster",
            fields: [
                { id: "freezer-speed", label: "Bandgeschwindigkeit", value: "", type: "text" },
                { id: "freezer-temp", label: "Temperaturzonen", value: "", type: "textarea" },
                { id: "freezer-dwell", label: "Verweildauer", value: "", type: "text" },
            ]
        },
        {
            id: "packaging-line",
            title: "Mehrkopfwaage / Verpackung",
            fields: [
                { id: "weigher-prog", label: "Waagen-Programm", value: "", type: "text" },
                { id: "pack-machine", label: "Verpackungsmaschine", value: "", type: "text" },
                { id: "pack-settings", label: "Spezifische Einstellungen", value: "", type: "textarea" },
            ]
        },
        {
            id: "heat",
            title: "Hitzebehandlung / Rauch (Alternative)",
            fields: [
                { id: "program_smoke", label: "Rauchprogramm", value: "", type: "text" },
                { id: "core_temp", label: "Kerntemperatur Ziel (°C)", value: "", type: "text" },
                { id: "chamber", label: "Kammer / Anlage", value: "", type: "text" },
            ]
        },
        {
            id: "packaging-primary",
            title: "Primärverpackung",
            fields: [
                { 
                    id: "pack-type", 
                    label: "Verpackungsart", 
                    value: "", 
                    type: "radio",
                    options: ["Vakuum", "Leichtes Vakuum mit Atmosphäre", "N2", "Offen in E2"]
                },
                { 
                    id: "bag-type", 
                    label: "Seitenfaltbeutel", 
                    value: "", 
                    type: "radio",
                    options: ["transparent", "blau", "keiner"]
                },
                { 
                    id: "content-mode", 
                    label: "Packungsinhalt", 
                    value: "", 
                    type: "radio",
                    options: ["egalisiert", "gewogen"]
                },
                { id: "weight-target", label: "Zielgewicht (g/kg)", value: "", type: "text" },
            ]
        },
        {
            id: "packaging-secondary",
            title: "Sekundärverpackung",
            fields: [
                { 
                    id: "outer-pack", 
                    label: "Umverpackung", 
                    value: "", 
                    type: "radio",
                    options: ["neutral", "Aulbach"]
                },
                { 
                    id: "box-type", 
                    label: "Kartonage / Kiste", 
                    value: "", 
                    type: "radio",
                    options: ["Karton gr.", "Karton kl.", "E2-Kiste"]
                },
                { id: "units-per-box", label: "Anzahl Einzelverpackungen je Umverpackung", value: "", type: "text" },
            ]
        },
        {
            id: "packaging-check",
            title: "Verpackungs-Check",
            fields: [
                { 
                    id: "new-packaging", 
                    label: "Neue Verpackungsform für Fa. Aulbach? (Wenn JA: Punkt 4.0 beachten)", 
                    value: "Nein", 
                    type: "radio",
                    options: ["Ja", "Nein"]
                },
                { 
                    id: "compliance", 
                    label: "Migrationstests / Konformität vorhanden? (Wenn NEIN: Info an QS)", 
                    value: "Ja", 
                    type: "radio",
                    options: ["Ja", "Nein"]
                },
            ]
        },
    ]
};

interface ProcessParametersEditorProps {
    initialSettings?: ProcessSettings;
    onSave: (settings: ProcessSettings, note: string) => void;
    productName?: string;
    articleNumber?: string;
    // History prop made optional as it's not used for sidebar anymore, but keeps compatibility if needed
    history?: {
        version: string;
        date: string;
        user: string;
        note: string;
        settings: ProcessSettings;
    }[];
    readOnly?: boolean;
}

export function ProcessParametersEditor({ initialSettings, onSave, productName, articleNumber, readOnly = false }: ProcessParametersEditorProps) {
    const { toast } = useToast();
    const [settings, setSettings] = useState<ProcessSettings>(initialSettings || DEFAULT_PROCESS_SETTINGS);
    const [saveNote, setSaveNote] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    
    // Reset if initialSettings change
    useEffect(() => {
        if (initialSettings) {
            // Merge initialSettings with DEFAULT_PROCESS_SETTINGS to ensure new fields are added
            const mergedSections = DEFAULT_PROCESS_SETTINGS.sections.map(defSection => {
                const initSection = initialSettings.sections.find(s => s.id === defSection.id);
                if (!initSection) return defSection;

                return {
                    ...defSection,
                    fields: defSection.fields.map(defField => {
                        const initField = initSection.fields.find(f => f.id === defField.id);
                        return initField ? { ...defField, value: initField.value } : defField;
                    })
                };
            });
            
            setSettings({
                ...initialSettings,
                sections: mergedSections
            });
        }
    }, [initialSettings]);

    const handleFieldChange = (sectionId: string, fieldId: string, newValue: string) => {
        setSettings(prev => ({
            ...prev,
            sections: prev.sections.map(section => {
                if (section.id === sectionId) {
                    return {
                        ...section,
                        fields: section.fields.map(field => {
                            if (field.id === fieldId) {
                                return { ...field, value: newValue };
                            }
                            return field;
                        })
                    };
                }
                return section;
            })
        }));
    };

    const handleSave = () => {
        setIsSaving(true);
        // Calculate new version
        const currentV = parseFloat(settings.version || "1.0");
        const newV = (currentV + 0.1).toFixed(1);
        
        const newSettings = {
            ...settings,
            version: newV,
            updatedAt: new Date().toISOString()
        };
        
        onSave(newSettings, saveNote || "Parameter aktualisiert");
        setSettings(newSettings);
        setSaveNote("");
        setIsSaving(false);
    };

    return (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-full">
            {/* Main Editor */}
            <div className="xl:col-span-8 space-y-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                        <div className="space-y-1">
                            <CardTitle>Prozess-Parameter</CardTitle>
                            <CardDescription>
                                Produktionsparameter, Maschineneinstellungen und Verarbeitungshinweise.
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono">v{settings.version}</Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Accordion type="multiple" defaultValue={["raw-material", "processing"]} className="w-full">
                            {settings.sections.map((section) => (
                                <AccordionItem key={section.id} value={section.id}>
                                    <AccordionTrigger className="hover:no-underline bg-slate-50/50 px-4 rounded-md mb-2">
                                        <div className="flex items-center gap-2">
                                            <Settings className="w-4 h-4 text-slate-500" />
                                            <span>{section.title}</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4 pt-2">
                                        <div className="grid gap-4">
                                            {section.fields.map((field) => (
                                                <div key={field.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                                                    <Label className="md:text-right pt-2 text-slate-500">
                                                        {field.label}
                                                    </Label>
                                                    <div className="md:col-span-3">
                                                        {field.type === 'textarea' ? (
                                                            <Textarea 
                                                                value={field.value} 
                                                                onChange={(e) => handleFieldChange(section.id, field.id, e.target.value)}
                                                                className="min-h-[80px]"
                                                                placeholder="..."
                                                                disabled={readOnly}
                                                            />
                                                        ) : field.type === 'radio' && field.options ? (
                                                            <RadioGroup 
                                                                value={field.value} 
                                                                onValueChange={(val) => handleFieldChange(section.id, field.id, val)}
                                                                className="flex flex-wrap gap-4 pt-2"
                                                                disabled={readOnly}
                                                            >
                                                                {field.options.map((opt) => (
                                                                    <div key={opt} className="flex items-center space-x-2">
                                                                        <RadioGroupItem value={opt} id={`${field.id}-${opt}`} />
                                                                        <Label htmlFor={`${field.id}-${opt}`} className="font-normal cursor-pointer">{opt}</Label>
                                                                    </div>
                                                                ))}
                                                            </RadioGroup>
                                                        ) : field.type === 'select' && field.options ? (
                                                            <Select value={field.value} onValueChange={(val) => handleFieldChange(section.id, field.id, val)} disabled={readOnly}>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Bitte wählen..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {field.options.map((opt) => (
                                                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        ) : field.type === 'checkbox' ? (
                                                            <div className="flex items-center space-x-2 pt-2">
                                                                <Checkbox 
                                                                    id={field.id} 
                                                                    checked={field.value === 'true'}
                                                                    onCheckedChange={(checked) => handleFieldChange(section.id, field.id, checked ? 'true' : 'false')}
                                                                    disabled={readOnly}
                                                                />
                                                                <label
                                                                    htmlFor={field.id}
                                                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                                >
                                                                    {field.label}
                                                                </label>
                                                            </div>
                                                        ) : (
                                                            <Input 
                                                                value={field.value} 
                                                                onChange={(e) => handleFieldChange(section.id, field.id, e.target.value)}
                                                                type={field.type === 'number' ? 'number' : 'text'}
                                                                placeholder="..."
                                                                disabled={readOnly}
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </CardContent>
                </Card>
            </div>

            {/* Sidebar / Save Actions - Kept Simple */}
            {!readOnly && (
                <div className="xl:col-span-4 space-y-6 relative">
                    <div className="sticky top-6 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Speichern</CardTitle>
                                <CardDescription>Änderungen als neue Version sichern</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Änderungskommentar</Label>
                                    <Textarea 
                                        placeholder="Was wurde geändert? z.B. Temperatur angepasst..." 
                                        value={saveNote}
                                        onChange={(e) => setSaveNote(e.target.value)}
                                    />
                                </div>
                                <Button className="w-full gap-2" onClick={handleSave} disabled={isSaving}>
                                    <Save className="w-4 h-4" /> Neue Version speichern
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}
