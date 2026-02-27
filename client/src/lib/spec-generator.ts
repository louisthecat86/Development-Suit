// @ts-ignore - no types for browser build
import XlsxPopulate from "xlsx-populate/browser/xlsx-populate";
import { QuidResult } from "./quid-calculator";
import { SavedRecipe } from "./recipe-db";

export async function generateSpecificationExcel(
  recipeName: string,
  result: QuidResult,
  recipe?: SavedRecipe
) {
  try {
    // 1. Fetch the template file
    const response = await fetch("/spec-template.xlsx");
    if (!response.ok) {
      throw new Error("Template file not found");
    }
    const arrayBuffer = await response.arrayBuffer();

    // 2. Load with XlsxPopulate (preserves everything)
    const workbook = await XlsxPopulate.fromDataAsync(arrayBuffer);
    const sheet = workbook.sheet(0);

    // Helper to set cell value
    const set = (addr: string, val: string | number) => {
        sheet.cell(addr).value(val);
    };

    // --- Header Data ---
    set("A10", `Spezifikation gültig ab ${new Date().toLocaleDateString("de-DE")}`);
    
    // --- Product Info ---
    // A5: "Artikelnummer:" (Merged A5:B5) -> Value in C5
    set("C5", recipe?.articleNumber ? recipe.articleNumber : (recipe?.id ? recipe.id.substring(0, 8) : "")); 
    
    // A6: "Artikelbezeichnung:" (Merged A6:B6) -> Value in C6
    set("C6", recipeName);
    
    // --- Ingredients ---
    // A8: "Zutaten:"
    // User identified Target as C8 (Merged Area C8:K12)
    let ingredientText = result.labelText;
    
    // NOTE: User requested processing aids in C15, not appended to ingredients anymore.
    // if (result.allProcessingAids && result.allProcessingAids.length > 0) {
    //    ingredientText += "\n\nVerarbeitungshilfsstoffe: " + result.allProcessingAids.join(", ");
    // }
    
    set("C8", ingredientText);

    // --- Processing Aids ---
    // C15-C18: Name of Aids (One per row if possible)
    // H15-H18: Origin/Source
    
    // Clear rows 15-18 first to be safe (though template might be empty)
    for (let r = 15; r <= 18; r++) {
         set(`C${r}`, r === 15 ? "Keine" : ""); 
         set(`H${r}`, r === 15 ? "-" : "");
    }

    if (result.processingAidDetails && result.processingAidDetails.length > 0) {
        // We have slots C15, C16, C17, C18 (4 slots)
        const maxSlots = 4;
        
        result.processingAidDetails.forEach((detail, index) => {
            if (index < maxSlots) {
                const row = 15 + index;
                set(`C${row}`, detail.name);
                // User requested ONLY the label text (source), not "Aid aus Source"
                set(`H${row}`, detail.sources.join(", "));
            } else {
                // If more than 4, append to the last slot (C18)
                const lastRow = 15 + maxSlots - 1; // 18
                const currentName = sheet.cell(`C${lastRow}`).value();
                const currentSource = sheet.cell(`H${lastRow}`).value();
                
                set(`C${lastRow}`, `${currentName}, ${detail.name}`);
                set(`H${lastRow}`, `${currentSource}; ${detail.sources.join(", ")}`);
            }
        });
        
        // If we filled at least one, clear the "Keine" / "-" default in row 15 if it was overwritten? 
        // Actually our loop overwrites it if index 0 exists.
        // But if we have valid aids, we should ensure C15 is not "Keine" if it was set by default loop above.
        // Wait, the loop sets default "Keine" for C15. Then forEach overwrites it immediately if list > 0.
        // So this logic is fine.
    }
    
    // Ensure text wrapping is on for the ingredients cell
    // (Note: xlsx-populate might not expose easy style API in browser build without types, 
    // but usually the template already has the style set. We just fill the value.)
    
    // --- Nutrition ---
    // Values in Column H, starting Row 25
    // H25: kJ
    // H26: kcal
    // H27: Fett
    // H28: Ges. Fett
    // H29: KH
    // H30: Zucker
    // H31: Eiweiß
    // H32: Salz
    
    // Format as string with comma to match German Excel style perfectly
    const fmt = (n: number, d: number = 1) => n.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });
    
    set("H25", Math.round(result.nutritionPer100g.energyKj));
    set("H26", Math.round(result.nutritionPer100g.energyKcal));
    set("H27", fmt(result.nutritionPer100g.fat));
    set("H28", fmt(result.nutritionPer100g.saturatedFat));
    set("H29", fmt(result.nutritionPer100g.carbohydrates));
    set("H30", fmt(result.nutritionPer100g.sugar));
    set("H31", fmt(result.nutritionPer100g.protein));
    set("H32", fmt(result.nutritionPer100g.salt, 2));


    // --- Allergens ---
    // Rows 48-56
    // Col F = Ja (X), Col G = Nein (X)
    
    // Extended map to ensure we catch everything
    const allergenMap: Record<string, number> = {
        "gluten": 48,
        "glutenhaltiges getreide": 48,
        "ei": 49,
        "eier": 49,
        "soja": 50,
        "sojabohnen": 50,
        "milch": 51,
        "laktose": 51, 
        "schalenfrüchte": 52,
        "nüsse": 52,
        "pistazien": 52,
        "mandeln": 52,
        "haselnüsse": 52,
        "walnüsse": 52,
        "cashewnüsse": 52,
        "pecannüsse": 52,
        "paranüsse": 52,
        "macadamianüsse": 52,
        "sellerie": 53,
        "senf": 54,
        "sesam": 55,
        "sesamsamen": 55,
        "sulfit": 56,
        "sulfite": 56,
        "so2": 56,
        "schwefel": 56,
        "schwefeldioxid": 56,
        
        // Missing in standard template range (48-56) but mapped just in case template is larger or user modifies it
        "lupine": 57, 
        "weichtiere": 58,
        "erdnuesse": 59,
        "erdnüsse": 59,
        "fisch": 60,
        "krebstiere": 61
    };

    // Reset rows 48-61 (covering extended range just in case)
    for (let r = 48; r <= 61; r++) {
         set(`F${r}`, "");
         set(`G${r}`, r <= 56 ? "X" : ""); // Only default Nein for visible range 48-56
         set(`I${r}`, ""); 
    }

    // Check presence using the explicit list from ingredients
    if (result.allergenDetails && result.allergenDetails.length > 0) {
        result.allergenDetails.forEach(detail => {
            const row = allergenMap[detail.id];
            if (row) {
                set(`F${row}`, "X"); // Ja
                set(`G${row}`, "");  // Nein remove
                
                // Origin/Source in Column I
                // User requested "Allergenursprung wieder der ausgangsartikel" in "I48" (etc)
                const currentSource = sheet.cell(`I${row}`).value();
                const newSource = detail.sources.join(", ");
                // Append if something is already there
                set(`I${row}`, currentSource ? `${currentSource}, ${newSource}` : newSource);
            }
        });
    } else if (result.allAllergens && result.allAllergens.length > 0) {
         // Fallback
         result.allAllergens.forEach(allergenKey => {
            const row = allergenMap[allergenKey];
            if (row) {
                set(`F${row}`, "X"); 
                set(`G${row}`, "");  
            }
        });
    } else {
        // Fallback to text search
        const lowerIngs = result.labelText.toLowerCase();
        Object.entries(allergenMap).forEach(([key, row]) => {
             if (lowerIngs.includes(key)) {
                set(`F${row}`, "X"); 
                set(`G${row}`, ""); 
            }
        });
    }

    // 3. Write file
    const blob = await workbook.outputAsync();
    
    // Download
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const filename = `${recipeName.replace(/[^a-z0-9äöüß]/gi, '_')}_Spezifikation.xlsx`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

  } catch (e) {
    console.error("Error generating spec from template:", e);
    throw e;
  }
}
