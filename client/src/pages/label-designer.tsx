import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Languages, 
  ArrowRightLeft, 
  Save, 
  Download,
  Copy,
  CheckCircle2,
  RefreshCw,
  Globe2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

// Mock Translation Service (Frontend Simulation)
const mockTranslate = async (text: string, targetLang: string) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Simple dictionary based replacement for demo purposes
    // In a real app, this would call an API like DeepL or Google Translate
    const dictionary: Record<string, Record<string, string>> = {
        "en": {
            "Schweinefleisch": "Pork",
            "Rindfleisch": "Beef",
            "Speck": "Bacon",
            "Salz": "Salt",
            "Pfeffer": "Pepper",
            "Gewürze": "Spices",
            "Zutaten": "Ingredients",
            "Haltbarkeit": "Shelf life",
            "Salami": "Salami",
            "Premium": "Premium",
            "Traditionell": "Traditional",
            "Wasser": "Water",
            "Rauch": "Smoke",
            "Konservierungsstoff": "Preservative",
            "Antioxidationsmittel": "Antioxidant",
            "Unter Schutzatmosphäre verpackt": "Packaged in a protective atmosphere",
            "Bei +7°C lagern": "Store at +7°C"
        },
        "fr": {
            "Schweinefleisch": "Viande de porc",
            "Rindfleisch": "Viande de bœuf",
            "Speck": "Lard",
            "Salz": "Sel",
            "Pfeffer": "Poivre",
            "Gewürze": "Épices",
            "Zutaten": "Ingrédients",
            "Haltbarkeit": "Durée de conservation",
            "Salami": "Salami",
            "Premium": "Premium",
            "Traditionell": "Traditionnel",
            "Wasser": "Eau",
            "Rauch": "Fumée",
            "Konservierungsstoff": "Conservateur",
            "Antioxidationsmittel": "Antioxydant",
            "Unter Schutzatmosphäre verpackt": "Conditionné sous atmosphère protectrice",
            "Bei +7°C lagern": "Conserver à +7°C"
        },
        "es": {
            "Schweinefleisch": "Carne de cerdo",
            "Rindfleisch": "Carne de res",
            "Speck": "Tocino",
            "Salz": "Sal",
            "Pfeffer": "Pimienta",
            "Gewürze": "Especias",
            "Zutaten": "Ingredientes",
            "Haltbarkeit": "Vida útil",
            "Salami": "Salami",
            "Premium": "Premium",
            "Traditionell": "Tradicional",
            "Wasser": "Agua",
            "Rauch": "Humo",
            "Konservierungsstoff": "Conservante",
            "Antioxidationsmittel": "Antioxidante",
            "Unter Schutzatmosphäre verpackt": "Envasado en atmósfera protectora",
            "Bei +7°C lagern": "Conservar a +7°C"
        },
        "it": {
             "Schweinefleisch": "Carne di maiale",
             "Rindfleisch": "Manzo",
             "Speck": "Pancetta",
             "Salz": "Sale",
             "Pfeffer": "Pepe",
             "Gewürze": "Spezie",
             "Zutaten": "Ingredienti",
             "Haltbarkeit": "Durata",
             "Salami": "Salame",
             "Premium": "Premium",
             "Traditionell": "Tradizionale",
             "Wasser": "Acqua",
             "Rauch": "Fumo",
             "Konservierungsstoff": "Conservante",
             "Antioxidationsmittel": "Antiossidante",
             "Unter Schutzatmosphäre verpackt": "Confezionato in atmosfera protettiva",
             "Bei +7°C lagern": "Conservare a +7°C"
        }
    };

    const targetDict = dictionary[targetLang] || {};
    
    // Replace known words (case insensitive for keys, but keep case if possible)
    let translated = text;
    Object.keys(targetDict).forEach(key => {
        const regex = new RegExp(`\\b${key}\\b`, 'gi');
        translated = translated.replace(regex, (match) => {
             // Preserve capitalization
             const replacement = targetDict[key];
             if (match[0] === match[0].toUpperCase()) {
                 return replacement.charAt(0).toUpperCase() + replacement.slice(1);
             }
             return replacement.toLowerCase();
        });
    });

    // Fallback heuristic for unknown words (just for demo effect)
    if (targetLang === 'en' && text.includes("Wurst")) translated = translated.replace("Wurst", "Sausage");
    
    return translated;
};

export default function LabelTranslator() {
  const { toast } = useToast();
  const [sourceLang, setSourceLang] = useState("de");
  const [targetLang, setTargetLang] = useState("en");
  const [isTranslating, setIsTranslating] = useState(false);
  
  // Fields
  const [productName, setProductName] = useState("Premium Salami");
  const [ingredients, setIngredients] = useState("Schweinefleisch, Rindfleisch, Speck, Nitritpökelsalz (Salz, Konservierungsstoff: Natriumnitrit), Gewürze (Pfeffer, Knoblauch), Dextrose, Antioxidationsmittel: Natriumascorbat, Reifekulturen, Rauch.");
  const [storageInfo, setStorageInfo] = useState("Bei +7°C lagern. Unter Schutzatmosphäre verpackt.");
  
  // Translated Results
  const [translatedName, setTranslatedName] = useState("");
  const [translatedIngredients, setTranslatedIngredients] = useState("");
  const [translatedStorage, setTranslatedStorage] = useState("");

  const handleTranslate = async () => {
      setIsTranslating(true);
      try {
          const tName = await mockTranslate(productName, targetLang);
          const tIngredients = await mockTranslate(ingredients, targetLang);
          const tStorage = await mockTranslate(storageInfo, targetLang);
          
          setTranslatedName(tName);
          setTranslatedIngredients(tIngredients);
          setTranslatedStorage(tStorage);
          
          toast({
              title: "Übersetzung abgeschlossen",
              description: `Text wurde erfolgreich ins ${getLangName(targetLang)} übersetzt.`,
          });
      } catch (e) {
          toast({
              title: "Fehler",
              description: "Übersetzung fehlgeschlagen.",
              variant: "destructive"
          });
      } finally {
          setIsTranslating(false);
      }
  };

  const getLangName = (code: string) => {
      const names: Record<string, string> = {
          "de": "Deutsch",
          "en": "Englisch",
          "fr": "Französisch",
          "es": "Spanisch",
          "it": "Italienisch",
          "pl": "Polnisch"
      };
      return names[code] || code;
  };
  
  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      toast({ title: "Kopiert", description: "Text in Zwischenablage kopiert." });
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col font-sans space-y-6 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Globe2 className="w-8 h-8 text-primary" />
            Etiketten-Übersetzer
          </h1>
          <p className="text-muted-foreground">Automatisierte Übersetzung von Produktdeklarationen</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" /> Reset
           </Button>
           <Button onClick={handleTranslate} disabled={isTranslating}>
              {isTranslating ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                  <Languages className="mr-2 h-4 w-4" />
              )}
              {isTranslating ? "Übersetze..." : "Jetzt Übersetzen"}
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
         
         {/* SOURCE COLUMN */}
         <Card className="flex flex-col h-full border-muted-foreground/20 shadow-md">
            <CardHeader className="bg-muted/30 pb-4 border-b">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">Quelldaten</CardTitle>
                    <Select value={sourceLang} onValueChange={setSourceLang}>
                        <SelectTrigger className="w-[140px] bg-background">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="de">Deutsch</SelectItem>
                            <SelectItem value="en">Englisch</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-6 p-6 overflow-y-auto">
                <div className="space-y-2">
                    <Label htmlFor="prod-name">Produktname (Verkehrsbezeichnung)</Label>
                    <Input 
                        id="prod-name" 
                        value={productName} 
                        onChange={(e) => setProductName(e.target.value)} 
                        className="text-lg font-medium"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="ingredients">Zutatenverzeichnis</Label>
                    <Textarea 
                        id="ingredients" 
                        value={ingredients} 
                        onChange={(e) => setIngredients(e.target.value)} 
                        className="min-h-[150px] leading-relaxed resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                        Tipp: QUID-Prozentangaben werden automatisch übernommen.
                    </p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="storage">Lagerung & Hinweise</Label>
                    <Textarea 
                        id="storage" 
                        value={storageInfo} 
                        onChange={(e) => setStorageInfo(e.target.value)} 
                        className="min-h-[80px] resize-none"
                    />
                </div>
            </CardContent>
         </Card>

         {/* TARGET COLUMN */}
         <Card className={`flex flex-col h-full border-primary/20 shadow-lg transition-colors ${isTranslating ? 'opacity-70' : ''}`}>
            <CardHeader className="bg-primary/5 pb-4 border-b border-primary/10">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-lg text-primary">Übersetzung</CardTitle>
                        {translatedName && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                    </div>
                    <Select value={targetLang} onValueChange={setTargetLang}>
                        <SelectTrigger className="w-[140px] bg-background border-primary/20">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="en">Englisch</SelectItem>
                            <SelectItem value="fr">Französisch</SelectItem>
                            <SelectItem value="es">Spanisch</SelectItem>
                            <SelectItem value="it">Italienisch</SelectItem>
                            <SelectItem value="pl">Polnisch</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-6 p-6 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/20">
                <div className="space-y-2">
                    <div className="flex justify-between">
                        <Label className="text-primary/80">Produktname</Label>
                        <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => copyToClipboard(translatedName)}>
                            <Copy className="h-3 w-3" />
                        </Button>
                    </div>
                    <div className="p-3 bg-background border rounded-md min-h-[40px] font-medium text-lg">
                        {translatedName || <span className="text-muted-foreground italic text-sm">Warte auf Übersetzung...</span>}
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between">
                        <Label className="text-primary/80">Zutatenverzeichnis</Label>
                        <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => copyToClipboard(translatedIngredients)}>
                            <Copy className="h-3 w-3" />
                        </Button>
                    </div>
                    <div className="p-3 bg-background border rounded-md min-h-[150px] leading-relaxed whitespace-pre-wrap">
                        {translatedIngredients || <span className="text-muted-foreground italic text-sm">Warte auf Übersetzung...</span>}
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between">
                        <Label className="text-primary/80">Lagerung & Hinweise</Label>
                        <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => copyToClipboard(translatedStorage)}>
                            <Copy className="h-3 w-3" />
                        </Button>
                    </div>
                    <div className="p-3 bg-background border rounded-md min-h-[80px] whitespace-pre-wrap">
                         {translatedStorage || <span className="text-muted-foreground italic text-sm">Warte auf Übersetzung...</span>}
                    </div>
                </div>
            </CardContent>
            <CardFooter className="bg-primary/5 border-t border-primary/10 py-4">
                <Button className="w-full gap-2" disabled={!translatedName}>
                    <Download className="w-4 h-4" /> Als PDF Exportieren
                </Button>
            </CardFooter>
         </Card>

      </div>
    </div>
  );
}
