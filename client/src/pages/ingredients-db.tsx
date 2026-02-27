import React, { useState, useRef } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import * as XLSX from "xlsx";
import { 
  ArrowLeft, Plus, Save, Trash2, Search, Database, 
  Upload, Download, FileSpreadsheet, FolderOpen
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

import { useIngredientLibrary, LibraryIngredient } from "@/lib/ingredient-db";

const nutritionSchema = z.object({
  energyKcal: z.number().optional(),
  energyKj: z.number().optional(),
  fat: z.number().optional(),
  saturatedFat: z.number().optional(),
  carbohydrates: z.number().optional(),
  sugar: z.number().optional(),
  protein: z.number().optional(),
  salt: z.number().optional(),
  water: z.number().optional(),
  ash: z.number().optional(),
});

const formSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name ist erforderlich"),
  articleNumber: z.string().optional(),
  labelName: z.string().optional(),
  subIngredients: z.string().optional(),
  quidRequiredDefault: z.boolean().default(false),
  isMeat: z.boolean().default(false),
  isWater: z.boolean().default(false),
  meatSpecies: z.enum([
    'pork', 'beef', 'lamb', 'veal', 'mammal',
    'chicken', 'turkey', 'duck', 'rabbit', 'poultry'
  ]).optional(),
  connectiveTissuePercent: z.number().optional(),
  meatProteinLimit: z.number().default(15),
  nutrition: nutritionSchema.optional(),
  processingAids: z.string().optional(),
  allergens: z.array(z.string()).optional(),
});

type FormValues = z.infer<typeof formSchema>;

const ALLERGEN_OPTIONS = [
  { id: "gluten", label: "Glutenhaltiges Getreide" },
  { id: "ei", label: "Eier" },
  { id: "soja", label: "Soja" },
  { id: "milch", label: "Milch (inkl. Laktose)" },
  { id: "schalenfrüchte", label: "Schalenfrüchte (Nüsse)" },
  { id: "sellerie", label: "Sellerie" },
  { id: "senf", label: "Senf" },
  { id: "sesam", label: "Sesamsamen" },
  { id: "sulfit", label: "Schwefeldioxid / Sulfite" },
  { id: "lupine", label: "Lupinen" },
  { id: "weichtiere", label: "Weichtiere" },
  { id: "erdnuesse", label: "Erdnüsse" },
  { id: "fisch", label: "Fisch" },
  { id: "krebstiere", label: "Krebstiere" },
];

export default function IngredientDatabase() {
  const { ingredients, save, remove } = useIngredientLibrary();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: "",
      name: "",
      articleNumber: "",
      labelName: "",
      subIngredients: "",
      quidRequiredDefault: false,
      isMeat: false,
      isWater: false,
      meatProteinLimit: 15,
      nutrition: {},
      processingAids: "",
      allergens: []
    },
  });

  const filteredIngredients = ingredients.filter(ing => 
    ing.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ing.articleNumber && ing.articleNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  const handleSelect = (ing: LibraryIngredient) => {
    setSelectedId(ing.id);
    form.reset({
      ...ing,
      articleNumber: ing.articleNumber || "",
      labelName: ing.labelName || "",
      subIngredients: ing.subIngredients || "",
      meatSpecies: ing.meatSpecies || undefined,
      connectiveTissuePercent: ing.connectiveTissuePercent,
      processingAids: ing.processingAids || "",
      allergens: ing.allergens || [],
    });
    
    if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = 0;
    }
  };

  const handleNew = () => {
    setSelectedId(null);
    form.reset({
      id: crypto.randomUUID(),
      name: "",
      articleNumber: "",
      labelName: "",
      subIngredients: "",
      quidRequiredDefault: false,
      isMeat: false,
      isWater: false,
      meatProteinLimit: 15,
      nutrition: {},
      processingAids: "",
      allergens: []
    });
    if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = 0;
    }
  };

  const onSubmit = (values: FormValues) => {
    const isNew = !selectedId;
    const id = selectedId || crypto.randomUUID();
    
    save({
      ...values,
      id,
    } as LibraryIngredient);

    toast({
      title: "Gespeichert",
      description: `Zutat "${values.name}" wurde ${isNew ? 'angelegt' : 'aktualisiert'}.`,
    });

    if (isNew) {
      setSelectedId(id);
    }
  };

  const handleDelete = () => {
    if (selectedId) {
      remove(selectedId);
      handleNew();
      toast({
        title: "Gelöscht",
        description: "Zutat wurde aus der Datenbank entfernt.",
        variant: "destructive"
      });
    }
  };

  // Import Handler for Excel/CSV
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        let count = 0;
        
        // Helper to clean strings
        const clean = (val: any) => {
            if (!val) return "";
            return String(val).trim();
        };

        // Helper to parse number
        const num = (val: any) => {
            if (!val) return 0;
            const n = parseFloat(String(val).replace(',', '.'));
            return isNaN(n) ? 0 : n;
        };
        
        // Heuristic for Meat
        const detectMeat = (name: string, label: string) => {
            const text = (name + " " + label).toLowerCase();
            const meatTerms = ['fleisch', 'rind', 'schwein', 'pute', 'hähnchen', 'kalb', 'lamm', 'speck', 'wurst', 'schinken'];
            return meatTerms.some(term => text.includes(term));
        };

        const detectSpecies = (name: string, label: string) => {
            const text = (name + " " + label).toLowerCase();
            if (text.includes('rind')) return 'Rind';
            if (text.includes('schwein')) return 'Schwein';
            if (text.includes('pute')) return 'Pute';
            if (text.includes('hähnchen') || text.includes('hahn')) return 'Hähnchen';
            if (text.includes('kalb')) return 'Kalb';
            if (text.includes('lamm')) return 'Lamm';
            return undefined;
        };

        // Helper to parse allergens
        const parseAllergens = (allergenStr: string) => {
            if (!allergenStr) return [];
            const lower = allergenStr.toLowerCase();
            const result = new Set<string>();

            // Map common German terms to IDs
            if (lower.includes('gluten') || lower.includes('weizen') || lower.includes('roggen') || lower.includes('gerste') || lower.includes('hafer') || lower.includes('dinkel')) result.add('gluten');
            if (lower.includes('ei') || lower.includes('eier')) result.add('ei');
            if (lower.includes('soja')) result.add('soja');
            if (lower.includes('milch') || lower.includes('laktose') || lower.includes('lactose')) result.add('milch');
            if (lower.includes('schalenfrüchte') || lower.includes('nüsse') || lower.includes('mandel') || lower.includes('haselnuss') || lower.includes('walnuss')) result.add('schalenfrüchte');
            if (lower.includes('sellerie')) result.add('sellerie');
            if (lower.includes('senf')) result.add('senf');
            if (lower.includes('sesam')) result.add('sesam');
            if (lower.includes('sulfit') || lower.includes('schwefeldioxid')) result.add('sulfit');
            if (lower.includes('lupine')) result.add('lupine');
            if (lower.includes('weichtiere')) result.add('weichtiere');
            if (lower.includes('erdnüsse') || lower.includes('erdnuss')) result.add('erdnuesse');
            if (lower.includes('fisch')) result.add('fisch');
            if (lower.includes('krebstiere')) result.add('krebstiere');

            return Array.from(result);
        };

        data.forEach((row: any) => {
          // Detect columns dynamically if possible, or fallback to known names from user's file
          const name = clean(row['Name'] || row['Bezeichnung'] || 'Unbenannt');
          const labelName = clean(row['Etikettenname'] || row['Etikett'] || row['Deklaration'] || '');
          const isMeat = detectMeat(name, labelName);
          const articleNumber = clean(row['Artikelnummer'] || row['ArtNr'] || row['Art. Nr.'] || '');

          const newIng: LibraryIngredient = {
            id: articleNumber || crypto.randomUUID(),
            name: name,
            articleNumber: articleNumber,
            labelName: labelName,
            subIngredients: clean(row['Zutatenverzeichnis'] || row['Zutaten'] || ''),
            processingAids: clean(row['Verarbeitungshilfstoff'] || row['Verarbeitungshilfsstoffe'] || ''),
            allergens: parseAllergens(clean(row['Allergen'] || row['Allergene'])),
            isMeat: isMeat,
            meatSpecies: isMeat ? detectSpecies(name, labelName) : undefined,
            nutrition: {
              fat: num(row['Fett'] || row['Fat']),
              saturatedFat: num(row['ges. Fettsäure'] || row['gesättigte Fettsäuren'] || row['Saturated']),
              protein: num(row['Eiweiß'] || row['Protein']),
              carbohydrates: num(row['Kohlenhydrate'] || row['Carbs']),
              sugar: num(row['davon Zucker'] || row['Zucker'] || row['Sugar']),
              salt: num(row['Salz'] || row['Salt']),
              energyKcal: num(row['Kcal'] || row['kcal']),
              energyKj: num(row['Kj'] || row['KJ']),
            },
            quidRequiredDefault: false,
            meatProteinLimit: 15
          };
          
          save(newIng);
          count++;
        });

        toast({
          title: "Import erfolgreich",
          description: `${count} Zutaten wurden importiert.`,
        });

      } catch (error) {
        console.error("Import failed:", error);
        toast({
          title: "Import Fehler",
          description: "Die Datei konnte nicht gelesen werden. Bitte prüfen Sie das Format.",
          variant: "destructive"
        });
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Import Handler for JSON Backups
  const handleJsonImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        
        let ingredientsToImport = [];
        // Support both direct array and wrapped object format { ingredients: [...] }
        if (Array.isArray(json)) {
            ingredientsToImport = json;
        } else if (json.ingredients && Array.isArray(json.ingredients)) {
            ingredientsToImport = json.ingredients;
        } else {
            throw new Error("Ungültiges Format: Keine Zutatenliste gefunden");
        }

        let count = 0;
        ingredientsToImport.forEach((ing: any) => {
            // Ensure ID exists
            const ingredient = {
                ...ing,
                id: ing.id || crypto.randomUUID()
            };
            save(ingredient);
            count++;
        });

        toast({
          title: "Backup erfolgreich importiert",
          description: `${count} Zutaten wurden in die Datenbank geladen.`,
        });

      } catch (err) {
        console.error("JSON Import Error", err);
        toast({ 
            title: "Import Fehler", 
            description: "Die JSON-Datei konnte nicht verarbeitet werden.", 
            variant: "destructive" 
        });
      }
    };
    reader.readAsText(file);
    if (jsonInputRef.current) jsonInputRef.current.value = "";
  };

  // Export JSON Backup
  const handleExportJson = () => {
      const data = JSON.stringify({ ingredients }, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zutaten_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({ title: "Export erfolgreich", description: "Zutaten-Datenbank wurde exportiert." });
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col font-sans">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Zutaten-Datenbank</h1>
          <p className="text-muted-foreground">Verwaltung aller Rohstoffe und Zutaten</p>
        </div>
        <div className="flex gap-2">
            {/* Hidden Inputs */}
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleExcelImport}
            />
            
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel Import
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full overflow-hidden">
        
        {/* Left: Sidebar List */}
        <div className="lg:col-span-4 flex flex-col h-full gap-4 min-h-0">
          <div className="flex gap-2 shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suchen..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button onClick={handleNew} className="gap-2">
              <Plus className="w-4 h-4" /> Neu
            </Button>
          </div>

          <Card className="flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredIngredients.map((ing) => (
                  <button
                    key={ing.id}
                    onClick={() => handleSelect(ing)}
                    className={`w-full text-left p-3 rounded-md hover:bg-muted transition-colors flex items-center justify-between group ${selectedId === ing.id ? 'bg-muted/80 ring-1 ring-primary' : ''}`}
                  >
                    <div>
                      <div className="font-medium text-sm">{ing.name}</div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-2 mt-1">
                         {ing.articleNumber && <span className="font-mono bg-background border px-1 rounded">{ing.articleNumber}</span>}
                         {ing.isMeat && <Badge variant="outline" className="h-4 px-1 text-[10px]">Fleisch</Badge>}
                         {!ing.isMeat && !ing.isWater && <Badge variant="secondary" className="h-4 px-1 text-[10px]">Sonstiges</Badge>}
                         {ing.isWater && <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">Wasser</Badge>}
                      </div>
                    </div>
                  </button>
                ))}
                {filteredIngredients.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    Keine Zutaten gefunden.
                  </div>
                )}
            </div>
          </Card>
        </div>

        {/* Right: Edit Form */}
        <div className="lg:col-span-8 h-full overflow-y-auto pb-20" ref={scrollAreaRef}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>{selectedId ? "Zutat bearbeiten" : "Neue Zutat anlegen"}</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" type="submit" form="ingredient-form" className="gap-2">
                   <Save className="w-4 h-4" /> Speichern
                </Button>
                {selectedId && (
                    <Button variant="destructive" size="sm" onClick={handleDelete} className="gap-2">
                    <Trash2 className="w-4 h-4" /> Löschen
                    </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <Form {...form}>
                <form id="ingredient-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name der Zutat (Intern)</FormLabel>
                          <FormControl>
                            <Input placeholder="z.B. Schweinebauch S3" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="articleNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Artikelnummer</FormLabel>
                          <FormControl>
                            <Input placeholder="z.B. A-1234" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="labelName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bezeichnung Etikett (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="z.B. Schweinefleisch" {...field} />
                          </FormControl>
                          <FormDescription>
                             Erscheint so auf dem Etikett. Leer lassen = Interner Name.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="subIngredients"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Zutatenverzeichnis (für zusammengesetzte Zutaten)</FormLabel>
                          <FormControl>
                            <Textarea 
                               placeholder="z.B. Salz, Gewürze, Dextrose..." 
                               className="resize-none h-20 text-sm"
                               {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            Wird bei der Kennzeichnung in Klammern ergänzt.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-4 rounded-lg border p-4">
                       <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                          Zusatzinformationen
                       </h3>
                       <FormField
                        control={form.control}
                        name="processingAids"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Verarbeitungshilfsstoffe</FormLabel>
                            <FormControl>
                              <Input placeholder="z.B. Trennmittel, Rauch..." {...field} />
                            </FormControl>
                            <FormDescription>
                              Werden in der Spezifikation gelistet, aber nicht auf dem Etikett.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="allergens"
                        render={() => (
                          <FormItem>
                            <div className="mb-4">
                              <FormLabel className="text-base">Allergene</FormLabel>
                              <FormDescription>
                                Wählen Sie alle Allergene aus, die in dieser Zutat enthalten sind.
                              </FormDescription>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {ALLERGEN_OPTIONS.map((item) => (
                                <FormField
                                  key={item.id}
                                  control={form.control}
                                  name="allergens"
                                  render={({ field }) => {
                                    return (
                                      <FormItem
                                        key={item.id}
                                        className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-2 bg-card hover:bg-muted/50"
                                      >
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value?.includes(item.id)}
                                            onCheckedChange={(checked) => {
                                              return checked
                                                ? field.onChange([...(field.value || []), item.id])
                                                : field.onChange(
                                                    field.value?.filter(
                                                      (value) => value !== item.id
                                                    )
                                                  )
                                            }}
                                          />
                                        </FormControl>
                                        <FormLabel className="font-normal cursor-pointer w-full text-xs">
                                          {item.label}
                                        </FormLabel>
                                      </FormItem>
                                    )
                                  }}
                                />
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="space-y-4 pt-8">
                       <FormField
                        control={form.control}
                        name="quidRequiredDefault"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              QUID standardmäßig erforderlich?
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="isWater"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              Ist Wasser / Eis?
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="isMeat"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              Ist Fleisch?
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>

                  {form.watch('isMeat') && (
                    <div className="p-4 bg-muted/50 rounded-lg border space-y-4">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Fleisch-Parameter</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="meatSpecies"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tierart</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Wähle Art" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="pork">Schwein</SelectItem>
                                  <SelectItem value="beef">Rind</SelectItem>
                                  <SelectItem value="veal">Kalb</SelectItem>
                                  <SelectItem value="lamb">Lamm</SelectItem>
                                  <SelectItem value="chicken">Huhn</SelectItem>
                                  <SelectItem value="turkey">Pute</SelectItem>
                                  <SelectItem value="duck">Ente</SelectItem>
                                  <SelectItem value="rabbit">Kaninchen</SelectItem>
                                  <Separator className="my-1" />
                                  <SelectItem value="mammal">Säugetier (Sonst.)</SelectItem>
                                  <SelectItem value="poultry">Geflügel (Sonst.)</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="connectiveTissuePercent"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Bindegewebe (BEFFE) %</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  placeholder="z.B. 10"
                                  {...field}
                                  onChange={e => field.onChange(e.target.valueAsNumber)}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Database className="w-4 h-4" /> Nährwerte (pro 100g)
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                       {[
                         { name: "energyKj", label: "Energie (kJ)" },
                         { name: "energyKcal", label: "Energie (kcal)" },
                         { name: "fat", label: "Fett (g)" },
                         { name: "saturatedFat", label: "Ges. Fett (g)" },
                         { name: "carbohydrates", label: "Kohlenh. (g)" },
                         { name: "sugar", label: "Zucker (g)" },
                         { name: "protein", label: "Eiweiß (g)" },
                         { name: "salt", label: "Salz (g)" },
                         { name: "water", label: "Wasser (g)" },
                         { name: "ash", label: "Asche (g)" },
                       ].map((n) => (
                         <FormField
                          key={n.name}
                          control={form.control}
                          name={`nutrition.${n.name}` as any}
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormLabel className="text-xs text-muted-foreground">{n.label}</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  className="h-8"
                                  placeholder="0"
                                  {...field}
                                  onChange={e => field.onChange(e.target.valueAsNumber)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                       ))}
                    </div>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
