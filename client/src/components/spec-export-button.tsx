import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileSpreadsheet, ChevronDown, Languages } from "lucide-react";
import { generateSpecificationExcel, SpecLanguage } from "@/lib/spec-generator";
import { QuidResult } from "@/lib/quid-calculator";
import { SavedRecipe } from "@/lib/recipe-db";
import { useToast } from "@/hooks/use-toast";

interface SpecExportButtonProps {
  recipeName: string;
  result: QuidResult | null | undefined;
  recipe?: SavedRecipe;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function SpecExportButton({
  recipeName,
  result,
  recipe,
  variant = "default",
  size = "sm",
  className = "",
}: SpecExportButtonProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleExport = async (lang: SpecLanguage) => {
    if (!result) {
      toast({
        title: "Keine Berechnung",
        description: "Bitte erst die Rezeptur berechnen.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      await generateSpecificationExcel(recipeName, result, recipe, lang);
      toast({
        title: lang === "de" ? "Spezifikation erstellt" : "Specification created",
        description: lang === "de"
          ? "Excel-Datei wurde heruntergeladen."
          : "Excel file has been downloaded.",
      });
    } catch (e) {
      console.error(e);
      toast({
        title: "Export Fehler",
        description: "Spezifikation konnte nicht erstellt werden.",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={`gap-1 ${className}`}
          disabled={!result || loading}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          Spezifikation
          <ChevronDown className="w-3 h-3 ml-0.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("de")} className="cursor-pointer">
          <span className="mr-2">🇩🇪</span> Deutsch
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("en")} className="cursor-pointer">
          <span className="mr-2">🇬🇧</span> English
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
