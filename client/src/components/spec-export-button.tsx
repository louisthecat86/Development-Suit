import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { FileSpreadsheet, ChevronDown, Settings, Key } from "lucide-react";
import {
  generateSpecificationExcel,
  getDeepLApiKey,
  setDeepLApiKey,
  SpecLanguage,
} from "@/lib/spec-generator";
import { QuidResult } from "@/lib/quid-calculator";
import { SavedRecipe } from "@/lib/recipe-db";
import { useToast } from "@/hooks/use-toast";

interface SpecExportButtonProps {
  recipeName: string;
  articleNumber?: string;
  result: QuidResult | null | undefined;
  recipe?: SavedRecipe;
  sensory?: {
    appearance?: string;
    texture?: string;
    odor?: string;
    taste?: string;
  };
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function SpecExportButton({
  recipeName, articleNumber, result, recipe, sensory,
  variant = "default", size = "sm", className = "",
}: SpecExportButtonProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(getDeepLApiKey() || "");

  const handleExport = async (lang: SpecLanguage) => {
    if (!result) {
      toast({ title: "Keine Berechnung", description: "Bitte erst die Rezeptur berechnen.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const deeplApiKey = lang === "en" ? (getDeepLApiKey() || undefined) : undefined;
      
      if (lang === "en" && !deeplApiKey) {
        toast({ title: "Hinweis", description: "Kein DeepL API-Key hinterlegt. Etikettentext wird nicht übersetzt." });
      }
      
      await generateSpecificationExcel(recipeName, result, recipe, lang, {
        articleNumber,
        deeplApiKey,
        sensory,
      });

      const msg = lang === "en" && deeplApiKey
        ? "Englische Spezifikation mit DeepL-Übersetzung erstellt."
        : lang === "en"
          ? "Englische Spezifikation erstellt (Etikettentext nicht übersetzt)."
          : "Deutsche Spezifikation erstellt.";
      toast({ title: "Export erfolgreich", description: msg });
    } catch (e) {
      console.error(e);
      toast({ title: "Export Fehler", description: "Spezifikation konnte nicht erstellt werden.", variant: "destructive" });
    }
    setLoading(false);
  };

  const handleSaveKey = () => {
    if (apiKeyInput.trim()) {
      setDeepLApiKey(apiKeyInput.trim());
      toast({ title: "Gespeichert", description: "DeepL API-Key wurde hinterlegt." });
    }
    setShowKeyDialog(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={variant} size={size} className={`gap-1 ${className}`} disabled={!result || loading}>
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Spezifikation
            <ChevronDown className="w-3 h-3 ml-0.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Spezifikation erstellen</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleExport("de")} className="cursor-pointer">
            <span className="mr-2">🇩🇪</span> Deutsche Spezifikation
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport("en")} className="cursor-pointer">
            <span className="mr-2">🇬🇧</span> English Specification
            {getDeepLApiKey() && <span className="ml-auto text-[10px] text-green-600 bg-green-50 px-1.5 rounded">+ DeepL</span>}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => { setApiKeyInput(getDeepLApiKey() || ""); setShowKeyDialog(true); }} className="cursor-pointer text-muted-foreground">
            <Key className="w-3.5 h-3.5 mr-2" />
            DeepL API-Key {getDeepLApiKey() ? "ändern" : "hinterlegen"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>DeepL API-Key</DialogTitle>
            <DialogDescription>
              Mit einem DeepL API-Key wird der Etikettentext automatisch ins Englische übersetzt und in die Spezifikation eingetragen.
              Ohne Key wird der deutsche Originaltext verwendet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>API-Key (DeepL Free oder Pro)</Label>
              <Input
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="z.B. 1234abcd-5678-efgh:fx"
                type="password"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Kostenlos registrieren auf <a href="https://www.deepl.com/pro-api" target="_blank" rel="noopener" className="text-primary underline">deepl.com/pro-api</a> (500.000 Zeichen/Monat gratis).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowKeyDialog(false)}>Abbrechen</Button>
            <Button onClick={handleSaveKey}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
