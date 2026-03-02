// @ts-ignore - no types for browser build
import XlsxPopulate from "xlsx-populate/browser/xlsx-populate";
import { QuidResult } from "./quid-calculator";
import { SavedRecipe } from "./recipe-db";

export type SpecLanguage = "de" | "en";

// DeepL Free API endpoint
const DEEPL_API_URL = "https://api-free.deepl.com/v2/translate";

// Cell mappings per language (based on actual template analysis)
const CELL_MAP = {
  de: {
    validDate: "J1",        // "Spezifikation gültig ab ..."
    articleNumber: "C5",
    articleName: "C6",
    unitWeight: "C7",
    tolerance: "H7",
    ingredients: "C8",       // merged C8:K12
    // Processing aids: C15-C18 (name), H15-H18 (source)
    aidStartRow: 15,
    aidNameCol: "C",
    aidSourceCol: "H",
    // Sensory
    sensoryAppearance: "C20",
    sensoryTexture: "C21",
    sensoryOdor: "C22",
    sensoryTaste: "C23",
    // Nutrition (values in column H)
    nutritionEnergyKj: "H25",
    nutritionEnergyKcal: "H26",
    nutritionFat: "H27",
    nutritionSatFat: "H28",
    nutritionCarbs: "H29",
    nutritionSugar: "H30",
    nutritionProtein: "H31",
    nutritionSalt: "H32",
    // Allergens rows 48-56, columns F(ja) G(nein) I(source)
    allergenStartRow: 48,
    allergenYesCol: "F",
    allergenNoCol: "G",
    allergenSourceCol: "I",
    allergenEndRow: 56,
  },
  en: {
    validDate: "J1",
    articleNumber: "D5",     // EN: label A5:C5, value D5:K5
    articleName: "D6",       // EN: label A6:C6, value D6:K6
    unitWeight: "D7",
    tolerance: "H7",
    ingredients: "D8",       // EN: label A8:C11, value D8:K11
    // Processing aids: C17-C20 (name), H17-H20 (source)
    aidStartRow: 17,
    aidNameCol: "C",
    aidSourceCol: "H",
    // Sensory
    sensoryAppearance: "C22",
    sensoryTexture: "C23",
    sensoryOdor: "C24",
    sensoryTaste: "C25",
    // Nutrition (values in column H)
    nutritionEnergyKj: "H27",
    nutritionEnergyKcal: "H28",
    nutritionFat: "H29",
    nutritionSatFat: "H30",
    nutritionCarbs: "H31",
    nutritionSugar: "H32",
    nutritionProtein: "H33",
    nutritionSalt: "H34",
    // Allergens rows 53-61, columns F(yes) G(no) I(source)
    allergenStartRow: 53,
    allergenYesCol: "F",
    allergenNoCol: "G",
    allergenSourceCol: "I",
    allergenEndRow: 61,
  },
};

// Allergen detection keys mapped to row offsets (0-8)
const ALLERGEN_KEYS = [
  { offset: 0, keys: ["gluten", "glutenhaltiges getreide", "cereals"] },
  { offset: 1, keys: ["ei", "eier", "eggs"] },
  { offset: 2, keys: ["soja", "sojabohnen", "soy", "soybeans"] },
  { offset: 3, keys: ["milch", "laktose", "milk", "lactose"] },
  { offset: 4, keys: ["schalenfrüchte", "nüsse", "pistazien", "nuts", "pistachio"] },
  { offset: 5, keys: ["sellerie", "celery"] },
  { offset: 6, keys: ["senf", "mustard"] },
  { offset: 7, keys: ["sesam", "sesamsamen", "sesame"] },
  { offset: 8, keys: ["sulfit", "sulfite", "so2", "schwefeldioxid", "sulphur"] },
];

// --- DeepL Translation ---
async function translateWithDeepL(
  text: string,
  targetLang: string,
  apiKey: string
): Promise<string | null> {
  try {
    const response = await fetch(DEEPL_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        auth_key: apiKey,
        text: text,
        source_lang: "DE",
        target_lang: targetLang.toUpperCase(),
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.translations?.[0]?.text || null;
  } catch (e) {
    console.error("DeepL translation failed:", e);
    return null;
  }
}

// --- Load Template ---
async function loadTemplate(lang: SpecLanguage): Promise<ArrayBuffer> {
  const filename = `spec-template-${lang}.xlsx`;

  // Electron: load via IPC
  if (window.electronAPI?.loadTemplate) {
    const base64 = await window.electronAPI.loadTemplate(filename);
    if (base64) {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes.buffer;
    }
  }

  // Browser fallback: fetch from public/templates/
  const response = await fetch(`/templates/${filename}`);
  if (!response.ok) throw new Error(`Template ${filename} not found`);
  return response.arrayBuffer();
}

// --- Save Result ---
async function saveResult(blob: Blob, filename: string): Promise<void> {
  // Electron: use native save dialog
  if (window.electronAPI?.saveXlsxToDisk) {
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve) => {
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.readAsDataURL(blob);
    });
    await window.electronAPI.saveXlsxToDisk(base64, filename);
    return;
  }

  // Browser fallback: download
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// --- Main Export Function ---
export async function generateSpecificationExcel(
  recipeName: string,
  result: QuidResult,
  recipe?: SavedRecipe,
  lang: SpecLanguage = "de",
  options?: {
    articleNumber?: string;
    deeplApiKey?: string;
    sensory?: {
      appearance?: string;
      texture?: string;
      odor?: string;
      taste?: string;
    };
  }
) {
  const map = CELL_MAP[lang];
  const arrayBuffer = await loadTemplate(lang);
  const workbook = await XlsxPopulate.fromDataAsync(arrayBuffer);
  const sheet = workbook.sheet(0);

  const set = (addr: string, val: string | number) => {
    try { sheet.cell(addr).value(val); } catch (e) { console.warn(`Cell ${addr}:`, e); }
  };

  const fmt = (n: number, d: number = 1) =>
    n.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });

  // --- Valid Date ---
  const dateStr = new Date().toLocaleDateString(lang === "de" ? "de-DE" : "en-GB");
  const validLabel = lang === "de"
    ? `Spezifikation gültig ab ${dateStr}`
    : `specification valid from ${dateStr}`;
  set(map.validDate, validLabel);

  // --- Article Info ---
  set(map.articleNumber, options?.articleNumber || recipe?.articleNumber || "");
  set(map.articleName, recipeName);

  // --- Ingredients / Label Text ---
  let ingredientText = result.labelText;

  // If English and DeepL key provided, translate the ingredient text
  if (lang === "en" && options?.deeplApiKey && ingredientText) {
    const translated = await translateWithDeepL(ingredientText, "EN", options.deeplApiKey);
    if (translated) ingredientText = translated;
  }

  set(map.ingredients, ingredientText);

  // --- Processing Aids ---
  const maxAidSlots = 4;
  for (let i = 0; i < maxAidSlots; i++) {
    const row = map.aidStartRow + i;
    set(`${map.aidNameCol}${row}`, i === 0 ? (lang === "de" ? "Keine" : "None") : "");
    set(`${map.aidSourceCol}${row}`, i === 0 ? "-" : "");
  }

  if (result.processingAidDetails && result.processingAidDetails.length > 0) {
    result.processingAidDetails.forEach((detail: any, index: number) => {
      if (index < maxAidSlots) {
        const row = map.aidStartRow + index;
        set(`${map.aidNameCol}${row}`, detail.name);
        set(`${map.aidSourceCol}${row}`, detail.sources.join(", "));
      }
    });
  }

  // --- Sensory (if provided) ---
  if (options?.sensory) {
    if (options.sensory.appearance) set(map.sensoryAppearance, options.sensory.appearance);
    if (options.sensory.texture) set(map.sensoryTexture, options.sensory.texture);
    if (options.sensory.odor) set(map.sensoryOdor, options.sensory.odor);
    if (options.sensory.taste) set(map.sensoryTaste, options.sensory.taste);
  }

  // --- Nutrition ---
  set(map.nutritionEnergyKj, Math.round(result.nutritionPer100g.energyKj));
  set(map.nutritionEnergyKcal, Math.round(result.nutritionPer100g.energyKcal));
  set(map.nutritionFat, fmt(result.nutritionPer100g.fat));
  set(map.nutritionSatFat, fmt(result.nutritionPer100g.saturatedFat));
  set(map.nutritionCarbs, fmt(result.nutritionPer100g.carbohydrates));
  set(map.nutritionSugar, fmt(result.nutritionPer100g.sugar));
  set(map.nutritionProtein, fmt(result.nutritionPer100g.protein));
  set(map.nutritionSalt, fmt(result.nutritionPer100g.salt, 2));

  // --- Allergens ---
  // Reset all allergen rows
  for (let i = 0; i <= map.allergenEndRow - map.allergenStartRow; i++) {
    const row = map.allergenStartRow + i;
    set(`${map.allergenYesCol}${row}`, "");
    set(`${map.allergenNoCol}${row}`, "X");
    set(`${map.allergenSourceCol}${row}`, "");
  }

  // Detect and mark present allergens
  const lowerLabel = result.labelText.toLowerCase();

  if (result.allergenDetails && result.allergenDetails.length > 0) {
    // Use explicit allergen data
    result.allergenDetails.forEach((detail: any) => {
      ALLERGEN_KEYS.forEach((ak) => {
        if (ak.keys.some((k) => detail.id?.toLowerCase().includes(k))) {
          const row = map.allergenStartRow + ak.offset;
          set(`${map.allergenYesCol}${row}`, "X");
          set(`${map.allergenNoCol}${row}`, "");
          const current = sheet.cell(`${map.allergenSourceCol}${row}`).value();
          const src = detail.sources.join(", ");
          set(`${map.allergenSourceCol}${row}`, current ? `${current}, ${src}` : src);
        }
      });
    });
  } else if (result.allAllergens && result.allAllergens.length > 0) {
    result.allAllergens.forEach((allergenKey: string) => {
      ALLERGEN_KEYS.forEach((ak) => {
        if (ak.keys.some((k) => allergenKey.toLowerCase().includes(k))) {
          const row = map.allergenStartRow + ak.offset;
          set(`${map.allergenYesCol}${row}`, "X");
          set(`${map.allergenNoCol}${row}`, "");
        }
      });
    });
  } else {
    // Fallback: text search in label
    ALLERGEN_KEYS.forEach((ak) => {
      if (ak.keys.some((k) => lowerLabel.includes(k))) {
        const row = map.allergenStartRow + ak.offset;
        set(`${map.allergenYesCol}${row}`, "X");
        set(`${map.allergenNoCol}${row}`, "");
      }
    });
  }

  // --- Generate output ---
  const blob = await workbook.outputAsync();
  const safeName = recipeName.replace(/[^a-z0-9äöüß ]/gi, "_");
  const suffix = lang === "en" ? "Specification" : "Spezifikation";
  const filename = `${safeName}_${suffix}.xlsx`;

  await saveResult(blob instanceof Blob ? blob : new Blob([blob]), filename);
}

// --- DeepL API Key Management ---
const DEEPL_KEY_STORAGE = "quid-deepl-api-key";

export function getDeepLApiKey(): string | null {
  try {
    return sessionStorage.getItem(DEEPL_KEY_STORAGE) || localStorage.getItem(DEEPL_KEY_STORAGE);
  } catch { return null; }
}

export function setDeepLApiKey(key: string): void {
  try {
    sessionStorage.setItem(DEEPL_KEY_STORAGE, key);
    localStorage.setItem(DEEPL_KEY_STORAGE, key);
  } catch { /* ignore */ }
}
