import * as XLSX from "xlsx";
import { QuidResult } from "./quid-calculator";
import { SavedRecipe } from "./recipe-db";

type SpecLanguage = "de" | "en";

const LABELS: Record<SpecLanguage, Record<string, string>> = {
  de: {
    title: "Produktspezifikation",
    articleNumber: "Artikelnummer",
    articleName: "Artikelbezeichnung",
    validFrom: "Gültig ab",
    ingredients: "Zutaten",
    processingAids: "Verarbeitungshilfsstoffe",
    aidName: "Bezeichnung",
    aidSource: "Herkunft/Quelle",
    none: "Keine",
    nutrition: "Nährwertdeklaration pro 100 g",
    parameter: "Parameter",
    per100g: "pro 100 g",
    energy: "Energie",
    fat: "Fett",
    saturatedFat: "davon gesättigte Fettsäuren",
    carbs: "Kohlenhydrate",
    sugar: "davon Zucker",
    protein: "Eiweiß",
    salt: "Salz",
    meatContent: "Fleischanteil (berechnet)",
    water: "Wasser (kalkulatorisch)",
    allergens: "Allergen-Management",
    allergenName: "Allergen",
    present: "Enthalten",
    notPresent: "Nicht enthalten",
    source: "Quelle/Zutat",
    yes: "Ja",
    no: "Nein",
    gluten: "Glutenhaltiges Getreide",
    eggs: "Eier",
    soy: "Soja",
    milk: "Milch/Laktose",
    nuts: "Schalenfrüchte",
    celery: "Sellerie",
    mustard: "Senf",
    sesame: "Sesam",
    sulfites: "Sulfite/SO₂",
    lupin: "Lupine",
    molluscs: "Weichtiere",
    peanuts: "Erdnüsse",
    fish: "Fisch",
    crustaceans: "Krebstiere",
    rawMass: "Gesamt-Rohmasse",
    endWeight: "Endgewicht",
    cookingLoss: "Garverlust",
    recipeDetails: "Rezepturdetails",
    sheetName: "Spezifikation",
  },
  en: {
    title: "Product Specification",
    articleNumber: "Article Number",
    articleName: "Article Name",
    validFrom: "Valid from",
    ingredients: "Ingredients",
    processingAids: "Processing Aids",
    aidName: "Name",
    aidSource: "Origin/Source",
    none: "None",
    nutrition: "Nutrition Declaration per 100 g",
    parameter: "Parameter",
    per100g: "per 100 g",
    energy: "Energy",
    fat: "Fat",
    saturatedFat: "of which saturated fatty acids",
    carbs: "Carbohydrates",
    sugar: "of which sugars",
    protein: "Protein",
    salt: "Salt",
    meatContent: "Meat content (calculated)",
    water: "Water (calculated)",
    allergens: "Allergen Management",
    allergenName: "Allergen",
    present: "Present",
    notPresent: "Not present",
    source: "Source/Ingredient",
    yes: "Yes",
    no: "No",
    gluten: "Cereals containing gluten",
    eggs: "Eggs",
    soy: "Soya",
    milk: "Milk/Lactose",
    nuts: "Tree nuts",
    celery: "Celery",
    mustard: "Mustard",
    sesame: "Sesame",
    sulfites: "Sulphites/SO₂",
    lupin: "Lupin",
    molluscs: "Molluscs",
    peanuts: "Peanuts",
    fish: "Fish",
    crustaceans: "Crustaceans",
    rawMass: "Total raw mass",
    endWeight: "End weight",
    cookingLoss: "Cooking loss",
    recipeDetails: "Recipe Details",
    sheetName: "Specification",
  },
};

// Allergen detection keys (German, as used in ingredient data)
const ALLERGEN_KEYS: { id: string; deKey: string }[] = [
  { id: "gluten", deKey: "gluten" },
  { id: "eggs", deKey: "ei" },
  { id: "soy", deKey: "soja" },
  { id: "milk", deKey: "milch" },
  { id: "nuts", deKey: "schalenfrüchte" },
  { id: "celery", deKey: "sellerie" },
  { id: "mustard", deKey: "senf" },
  { id: "sesame", deKey: "sesam" },
  { id: "sulfites", deKey: "sulfit" },
  { id: "lupin", deKey: "lupine" },
  { id: "molluscs", deKey: "weichtiere" },
  { id: "peanuts", deKey: "erdnüsse" },
  { id: "fish", deKey: "fisch" },
  { id: "crustaceans", deKey: "krebstiere" },
];

function detectAllergens(result: QuidResult): Set<string> {
  const found = new Set<string>();

  // Use explicit allergen data if available
  if (result.allergenDetails && result.allergenDetails.length > 0) {
    result.allergenDetails.forEach((d: any) => {
      ALLERGEN_KEYS.forEach((ak) => {
        if (d.id === ak.deKey || d.id === ak.id) found.add(ak.id);
      });
    });
  } else if (result.allAllergens && result.allAllergens.length > 0) {
    result.allAllergens.forEach((a: string) => {
      ALLERGEN_KEYS.forEach((ak) => {
        if (a.toLowerCase().includes(ak.deKey)) found.add(ak.id);
      });
    });
  } else {
    // Fallback: text search in label
    const lower = result.labelText.toLowerCase();
    ALLERGEN_KEYS.forEach((ak) => {
      if (lower.includes(ak.deKey)) found.add(ak.id);
    });
  }
  return found;
}

export async function generateSpecificationExcel(
  recipeName: string,
  result: QuidResult,
  recipe?: SavedRecipe,
  lang: SpecLanguage = "de"
) {
  const L = LABELS[lang];
  const fmt = (n: number, d: number = 1) =>
    n.toLocaleString(lang === "de" ? "de-DE" : "en-US", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    });

  const rows: any[][] = [];
  const push = (...cells: any[]) => rows.push(cells);
  const blank = () => rows.push([]);

  // === HEADER ===
  push(L.title);
  blank();
  push(L.validFrom, new Date().toLocaleDateString(lang === "de" ? "de-DE" : "en-GB"));
  blank();
  push(L.articleNumber, recipe?.articleNumber || "-");
  push(L.articleName, recipeName);
  blank();

  // === RECIPE DETAILS ===
  push(L.recipeDetails);
  push(L.rawMass, `${fmt(result.totalRawMass, 3)} kg`);
  push(L.endWeight, `${fmt(result.totalEndWeight, 3)} kg`);
  if (recipe?.cookingLoss && recipe.cookingLoss > 0) {
    push(L.cookingLoss, `${fmt(recipe.cookingLoss)} %`);
  }
  push(L.meatContent, `${fmt(result.meatPercentage)} %`);
  blank();

  // === INGREDIENTS ===
  push(L.ingredients);
  push(result.labelText);
  blank();

  // === PROCESSING AIDS ===
  push(L.processingAids);
  if (result.processingAidDetails && result.processingAidDetails.length > 0) {
    push(L.aidName, L.aidSource);
    result.processingAidDetails.forEach((d: any) => {
      push(d.name, d.sources.join(", "));
    });
  } else {
    push(L.none);
  }
  blank();

  // === NUTRITION ===
  push(L.nutrition);
  push(L.parameter, L.per100g);
  push(L.energy, `${Math.round(result.nutritionPer100g.energyKj)} kJ / ${Math.round(result.nutritionPer100g.energyKcal)} kcal`);
  push(L.fat, `${fmt(result.nutritionPer100g.fat)} g`);
  push(`  ${L.saturatedFat}`, `${fmt(result.nutritionPer100g.saturatedFat)} g`);
  push(L.carbs, `${fmt(result.nutritionPer100g.carbohydrates)} g`);
  push(`  ${L.sugar}`, `${fmt(result.nutritionPer100g.sugar)} g`);
  push(L.protein, `${fmt(result.nutritionPer100g.protein)} g`);
  push(L.salt, `${fmt(result.nutritionPer100g.salt, 2)} g`);
  blank();
  push(L.meatContent, `${fmt(result.meatPercentage)} %`);
  push(L.water, `${fmt(result.nutritionPer100g.water || 0)} g`);
  blank();

  // === ALLERGENS ===
  const detected = detectAllergens(result);
  push(L.allergens);
  push(L.allergenName, L.present, L.source);

  ALLERGEN_KEYS.forEach((ak) => {
    const isPresent = detected.has(ak.id);
    let source = "";
    if (isPresent && result.allergenDetails) {
      const detail = result.allergenDetails.find(
        (d: any) => d.id === ak.deKey || d.id === ak.id
      );
      if (detail) source = detail.sources.join(", ");
    }
    push(L[ak.id as keyof typeof L] || ak.id, isPresent ? L.yes : L.no, source);
  });

  // === BUILD WORKBOOK ===
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  ws["!cols"] = [{ wch: 38 }, { wch: 45 }, { wch: 30 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, L.sheetName);

  // Generate and download
  const safeName = recipeName.replace(/[^a-z0-9äöüß ]/gi, "_");
  const suffix = lang === "en" ? "Specification" : "Spezifikation";
  XLSX.writeFile(wb, `${safeName}_${suffix}.xlsx`);
}

// Re-export type for use in UI
export type { SpecLanguage };
