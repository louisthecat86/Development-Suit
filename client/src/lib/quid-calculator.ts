export type MeatSpecies = 
  | 'pork' 
  | 'beef' 
  | 'lamb' 
  | 'veal' 
  | 'chicken' 
  | 'turkey' 
  | 'duck' 
  | 'rabbit'
  | 'mammal' // Legacy/Generic
  | 'poultry'; // Legacy/Generic

export interface NutritionalValues {
  energyKcal: number;
  energyKj: number;
  fat: number;
  saturatedFat: number;
  carbohydrates: number;
  sugar: number;
  protein: number;
  salt: number;
  // Optional chemical data
  water?: number;
  ash?: number;
}

export interface Ingredient {
  id: string;
  name: string;
  articleNumber?: string; // NEW
  labelName?: string; // Specific name for the label
  rawWeight: number; // Now in kg
  quidRequired: boolean;
  isMeat: boolean;
  isWater?: boolean; // NEW: Explicitly mark as added water
  meatSpecies?: MeatSpecies;
  connectiveTissuePercent?: number; // This is the BEFFE/Ratio check value
  meatProteinLimit?: number; // e.g., 15 for beef
  nutrition?: Partial<NutritionalValues>;
  subIngredients?: string;
  processingAids?: string; // NEW
  allergens?: string[]; // NEW
  isRecipe?: boolean; // NEW: Mark as sub-recipe
  originalSubIngredients?: Ingredient[]; // NEW: For flattening
  originalEndWeight?: number; // NEW: For flattening scaling
  processLoss?: number; // NEW: Pre-processing loss for this ingredient (e.g. sub-recipe cooking loss)
}

export interface QuidResult {
  totalRawMass: number; // kg
  totalEndWeight: number; // kg
  ingredients: IngredientResult[];
  labelText: string;
  warnings: string[];
  nutritionPer100g: NutritionalValues;
  allAllergens: string[]; // NEW (Legacy simple list)
  allProcessingAids: string[]; // NEW (Legacy simple list)
  allergenDetails: { id: string, sources: string[] }[]; // Detailed for spec
  processingAidDetails: { name: string, sources: string[] }[]; // Detailed for spec
  meatPercentage: number; // NEW
}

export interface IngredientResult extends Ingredient {
  quidRawValue: number; // The calculated percentage relative to end weight
  labelText: string;
  isSplit?: boolean;
  splitFrom?: string; // Name of original ingredient
}

// LMIV Limits
// Updated based on User Input:
// - Mammals (except rabbit/pig) & Mixes: Fat 25%, CT/MP 25%
// - Pork: Fat 30%, CT/MP 25%
// - Birds & Rabbits: Fat 15%, CT/MP 10%
const SPECIES_LIMITS = {
  pork: { fat: 30, ct: 25 },
  beef: { fat: 25, ct: 25 },
  lamb: { fat: 25, ct: 25 },
  veal: { fat: 25, ct: 25 },
  mammal: { fat: 25, ct: 25 },
  
  chicken: { fat: 15, ct: 10 },
  turkey: { fat: 15, ct: 10 },
  duck: { fat: 15, ct: 10 },
  poultry: { fat: 15, ct: 10 },
  
  rabbit: { fat: 15, ct: 10 }, // User specifically mentioned Rabbit is in the 15/10 group
};

function getFatName(species: MeatSpecies): string {
  switch (species) {
    case 'pork': return 'Speck';
    case 'beef': return 'Rinderfett';
    case 'lamb': return 'Lammfett';
    case 'veal': return 'Kalbsfett';
    case 'chicken': return 'Hühnerfett';
    case 'turkey': return 'Putenfett';
    case 'duck': return 'Entenfett';
    case 'rabbit': return 'Kaninchenfett';
    case 'mammal': return 'Tierisches Fett'; 
    case 'poultry': return 'Geflügelfett';
    default: return 'Tierisches Fett';
  }
}

// Helper to normalize German input to MeatSpecies keys
function normalizeSpecies(input: string | undefined | null): MeatSpecies | undefined {
  if (!input) return undefined;
  const lower = input.toLowerCase().trim();
  
  // Direct matches
  if (['pork', 'beef', 'lamb', 'veal', 'chicken', 'turkey', 'duck', 'rabbit', 'poultry', 'mammal'].includes(lower)) {
      return lower as MeatSpecies;
  }

  // German mappings
  if (lower.includes('schwein')) return 'pork';
  if (lower.includes('rind')) return 'beef';
  if (lower.includes('lamm')) return 'lamb';
  if (lower.includes('kalb')) return 'veal';
  if (lower.includes('huhn') || lower.includes('hähnchen')) return 'chicken';
  if (lower.includes('pute') || lower.includes('truthahn')) return 'turkey';
  if (lower.includes('ente')) return 'duck';
  if (lower.includes('kaninchen') || lower.includes('hase')) return 'rabbit';
  if (lower.includes('geflügel')) return 'poultry';
  
  return undefined;
}

export function calculateQuid(
  ingredients: Ingredient[],
  cookingLossPercent: number,
  fatLossPercent: number = 0,
  lossType: 'drying' | 'cooking' | 'none' = 'drying'
): QuidResult {
  
  // Override inputs if loss type is none
  if (lossType === 'none') {
    cookingLossPercent = 0;
    fatLossPercent = 0;
  }

  // 0. Recursive Flattening Helper
  // The user wants Sub-Recipes to appear as "Mix" in the INPUT list, but "Flattened" in the OUTPUT Label.
  const flattenIngredients = (list: Ingredient[]): Ingredient[] => {
     let result: Ingredient[] = [];
     
     list.forEach(ing => {
        // If it's a sub-recipe that contains original ingredients, we flatten it
        if (ing.isRecipe && ing.originalSubIngredients && ing.originalSubIngredients.length > 0) {
            const subIngs = ing.originalSubIngredients;
            
            // Scaling Factor: How much of this sub-recipe is used relative to its definition?
            // ing.rawWeight is the amount entered by the user in the main recipe.
            // User confirmed: "ich trage die zutat immer im rohen zustand ein" (I always enter the ingredient in raw state).
            // BUT: "es könnte aber auch passieren das man mal ein unterrezept hat, das auch schon einen garverlust erlitten hat"
            
            // Interpretation:
            // The user enters the RAW Quantity of the Sub-Recipe ingredients.
            // If the Sub-Recipe has a cooking loss, the PHYSICAL mass added to the main recipe is LESS than the sum of raw ingredients.
            
            // Example:
            // Sub-Recipe: 10kg Potatoes, 20% Loss -> 8kg Cooked Potatoes.
            // Main Recipe Input: "10kg Potatoes" (via Sub-Recipe Block).
            // The QUID should be based on 10kg Raw Potatoes (because QUID is usually raw).
            // BUT the Total End Weight of the Main Recipe must account for the fact that only 8kg physically entered the process.
            
            // Wait, if `ing.rawWeight` is the user input (10kg), and we treat it as 10kg, 
            // then `totalRawMass` of Main Recipe will be 10kg + Other.
            // If the Main Recipe has 10% loss, Output = (10+Other)*0.9.
            
            // If the reality is that 8kg entered, and Other is 10kg. Total Physical = 18kg.
            // Main Loss 10% -> Output = 16.2kg.
            // QUID Potatoes = 10kg / 16.2kg = 61%.
            // Previous calc: 10kg / ((10+10)*0.9 = 18kg) = 55%.
            
            // So we MUST correct the `rawWeight` used for Total Mass calculation, 
            // BUT keep the `rawWeight` for QUID numerator?
            
            // `flattenIngredients` returns the list of ingredients used for QUID and Total Mass.
            // If I return the raw ingredients (10kg Potatoes), they sum up to 10kg.
            
            // To simulate the weight loss of the sub-recipe, we can treat the loss as "Water Evaporation" 
            // that happened BEFORE the main process.
            // But `calculateQuid` sums `rawWeight` of all items in the list to get `totalRawMass`.
            
            // Solution:
            // If a Sub-Recipe has cooking loss, we should perhaps introduce a negative "Water Loss" ingredient?
            // Or reduce the weight of water ingredients in the flattened list?
            // Or, simpler:
            // The user wants the Sub-Recipe loss to be "integrated".
            
            // If I have 10kg Potatoes -> 20% Loss.
            // I should effectively have: 8kg Potatoes (Cooked).
            // But QUID needs "Potatoes" (Raw).
            
            // If I change the `rawWeight` in the flattened list to 8kg, 
            // then QUID = 8kg / EndWeight. This is WRONG if we need to declare Raw Weight.
            // Unless "Cooked Potatoes" is the ingredient.
            
            // If the ingredient is "Potatoes", QUID is Raw Weight.
            // If the ingredient is "Potato Mix", and it consists of Potatoes, QUID is Raw Weight of Potatoes.
            
            // Let's look at `ing.cookingLoss` from the Sub-Recipe (SavedRecipe).
            // The `ing` object here comes from `project-recipe-editor.tsx` where I constructed it.
            // I did NOT pass `cookingLoss` to the `compoundIng`.
            
            // I need to:
            // 1. Pass `cookingLoss` from Sub-Recipe to the `compoundIng` object.
            // 2. Use this `cookingLoss` in `calculateQuid` to adjust the Total Mass Calculation, 
            //    without changing the QUID Numerator (Raw Weight).
            
            // Actually, `calculateQuid` takes `ingredients`.
            // It calculates `totalRawMass = sum(ing.rawWeight)`.
            // Then `totalEndWeight = totalRawMass * (1 - mainLoss)`.
            
            // If I want `totalEndWeight` to be lower (because sub-recipe lost weight),
            // I should adjust `totalRawMass`?
            // No, `totalRawMass` should be the sum of raw ingredients (for correct QUID reference).
            
            // BUT `totalEndWeight` should be:
            // (Sum(RawOthers) + Sum(SubRecipeCooked)) * (1 - MainLoss).
            
            // SubRecipeCooked = Sum(SubRecipeRaw) * (1 - SubLoss).
            
            // So TotalEndWeight = (Sum(RawOthers) + Sum(SubRecipeRaw) * (1 - SubLoss)) * (1 - MainLoss).
            
            // Currently: TotalEndWeight = (Sum(RawOthers) + Sum(SubRecipeRaw)) * (1 - MainLoss).
            
            // The difference is significant.
            
            // I need to detect this "Sub Loss" in `calculateQuid`.
            // I can modify step 4 "Calculate Total End Weight".
            
            // Instead of `totalRawMass * (1 - cookingLossPercent / 100)`,
            // I should calculate `effectiveMassBeforeMainCooking`.
            
            // `effectiveMassBeforeMainCooking` = Sum of all ingredients, 
            // where normal ingredients count 100%, 
            // and Sub-Recipes (if they have internal loss) count (1 - subLoss).
            
            // But `flattenIngredients` returns a flat list of basic ingredients. 
            // The Sub-Recipe structure is lost in `workingIngredients`!
            
            // Wait, `flattenIngredients` recursively expands.
            // If I have SubRecipe (Loss 20%) -> Potatoes.
            // I get "Potatoes" in the list.
            // I don't know they came from a 20% loss recipe anymore.
            
            // I need to apply the loss during flattening?
            // If I apply loss to `rawWeight` during flattening, I lose the Raw QUID reference.
            
            // Unless... I store `preCookingWeight` vs `rawWeight`?
            
            // Let's modify `Ingredient` interface to support a "weight correction" or "cooking loss" factor?
            // Or simpler:
            // In `flattenIngredients`, when we expand a Sub-Recipe that has a loss,
            // we calculate the "effective mass contribution" of these ingredients.
            
            // But `calculateQuid` is designed to take a list of ingredients and a MAIN loss.
            
            // If I want to support nested losses, I need to know about them.
            
            // Proposed Fix:
            // 1. Update `Ingredient` type (in schema/types) to include `processLoss` (optional).
            //    This would be the loss that happened to THIS ingredient BEFORE main processing.
            // 2. In `flattenIngredients`, if we expand a recipe with loss, 
            //    we propagate this loss to the children?
            //    No, the children are raw. The loss happens to the GROUP.
            
            // Let's assume the user enters "10kg" of the Sub-Recipe.
            // The Sub-Recipe definition says: 20% Loss.
            // So physically, 8kg of "Sub-Recipe Product" is added.
            
            // In `flattenIngredients`:
            // The `ing` is the Sub-Recipe Block.
            // `ing.rawWeight` = 10kg.
            // `ing.processLoss` = 20% (I need to ensure this is passed).
            
            // We expand it to [Potatoes 10kg].
            // We need to mark [Potatoes] as having contributed to a pre-loss.
            
            // Let's modify `calculateQuid` to iterate the TOP LEVEL ingredients first to calculate `effectiveInputMass`.
            // `ingredients` argument IS the top level list.
            
            // Step 4 "Calculate Total End Weight":
            // Calculate `effectiveInputMass` by summing `ing.rawWeight * (1 - (ing.processLoss || 0)/100)`.
            // Then `totalEndWeight = effectiveInputMass * (1 - cookingLossPercent / 100)`.
            
            // THIS IS IT.
            
            // Now I need to ensure `processLoss` is populated.
            // `ing` in `ingredients` comes from `ProjectRecipeEditor`.
            // `handleAddIngredient` creates the `compoundIng`.
            // I need to add `processLoss: recipeItem.cookingLoss` there.
            
            // And I need to add `processLoss` to `Ingredient` interface in `quid-calculator.ts`.
            
            const subRecipeEndWeight = ing.originalEndWeight || subIngs.reduce((s,i) => s + i.rawWeight, 0);
            const scaleFactor = subRecipeEndWeight > 0 ? (ing.rawWeight / subRecipeEndWeight) : 1;
            
            // Recursively flatten
            const scaledSubIngs = subIngs.map(si => ({
                ...si,
                rawWeight: si.rawWeight * scaleFactor,
            }));
            
            result = [...result, ...flattenIngredients(scaledSubIngs)];
        } else {
            result.push(ing);
        }
     });
     
     return result;
  };

  const workingIngredients = flattenIngredients(ingredients);

  // 1. Group Ingredients by Species & Others
  const speciesGroups: Record<MeatSpecies, { rawWeight: number, fatMass: number, ctMass: number, ingredients: Ingredient[] }> = {
    pork: { rawWeight: 0, fatMass: 0, ctMass: 0, ingredients: [] },
    beef: { rawWeight: 0, fatMass: 0, ctMass: 0, ingredients: [] },
    lamb: { rawWeight: 0, fatMass: 0, ctMass: 0, ingredients: [] },
    veal: { rawWeight: 0, fatMass: 0, ctMass: 0, ingredients: [] },
    mammal: { rawWeight: 0, fatMass: 0, ctMass: 0, ingredients: [] },
    chicken: { rawWeight: 0, fatMass: 0, ctMass: 0, ingredients: [] },
    turkey: { rawWeight: 0, fatMass: 0, ctMass: 0, ingredients: [] },
    duck: { rawWeight: 0, fatMass: 0, ctMass: 0, ingredients: [] },
    rabbit: { rawWeight: 0, fatMass: 0, ctMass: 0, ingredients: [] },
    poultry: { rawWeight: 0, fatMass: 0, ctMass: 0, ingredients: [] },
  };
  
  const otherIngredients: IngredientResult[] = [];
  const warnings: string[] = [];

  workingIngredients.forEach(ing => {
    let currentIng: IngredientResult = { ...ing, quidRawValue: 0, labelText: '' };

    if (ing.isMeat) {
        // Try to identify species
        const species = normalizeSpecies(ing.meatSpecies) || 
                        normalizeSpecies(ing.name) || // Fallback: Check name for species keywords
                        (ing.meatSpecies as MeatSpecies); // Use as is if set

        if (species && speciesGroups[species]) {
            const group = speciesGroups[species];
            group.rawWeight += ing.rawWeight;
            
            // Calculate absolute fat mass from this ingredient
            const fatPercent = ing.nutrition?.fat || 0;
            group.fatMass += ing.rawWeight * (fatPercent / 100);
            
            // Calculate absolute Connective Tissue mass
            const ctPercent = ing.connectiveTissuePercent || 0;
            group.ctMass += ing.rawWeight * (ctPercent / 100);

            group.ingredients.push(ing);
            return; // Handled in group
        }
    }
    
    // Non-meat or unspecified species
    otherIngredients.push(currentIng);
  });

  // 2. Process Species Groups (Check Limits & Split)
  const processedMeatList: IngredientResult[] = [];

  (Object.keys(speciesGroups) as MeatSpecies[]).forEach(species => {
    const group = speciesGroups[species];
    if (group.rawWeight <= 0) return;

    const limits = SPECIES_LIMITS[species];
    const avgFatPercent = (group.fatMass / group.rawWeight) * 100;

    if (avgFatPercent > limits.fat) {
      // Split the GROUP
      // Formula: Excess Fat = Total Mass * (Actual % - Limit %) / (100 - Limit %)
      // This calculates how much fat mass needs to be removed from the "Meat" to bring it down to the limit.
      const excessFatWeight = group.rawWeight * (avgFatPercent - limits.fat) / (100 - limits.fat);
      const legalMeatWeight = group.rawWeight - excessFatWeight;

      // Add "Species Meat" (Aggregated)
      processedMeatList.push({
        id: `agg-${species}-meat`,
        name: `${getSpeciesName(species)}fleisch`, // e.g. Schweinefleisch
        rawWeight: legalMeatWeight,
        quidRequired: true, // Usually required
        isMeat: true,
        meatSpecies: species,
      } as IngredientResult);

      // Add "Species Fat" (Aggregated) - This is the "Speck" part
      processedMeatList.push({
        id: `agg-${species}-fat`,
        name: getFatName(species), // e.g. Schweinespeck
        rawWeight: excessFatWeight,
        quidRequired: true,
        isMeat: false,
        isSplit: true,
        splitFrom: `${getSpeciesName(species)}fleisch (Gesamt)`,
      } as IngredientResult);

      warnings.push(
        `Hinweis: Der Gesamtfettgehalt für ${getSpeciesName(species)} (${avgFatPercent.toFixed(1)}%) überschreitet den Grenzwert (${limits.fat}%). Es wurden ${Math.round(excessFatWeight * 1000)}g als "${getFatName(species)}" separiert.`
      );

    } else if (group.ctMass && group.rawWeight > 0 && (group.ctMass / group.rawWeight * 100) > limits.ct) {
         // Connective Tissue Limit Check (BEFFE check is usually separate, but for QUID name correctness:)
         // If CT is too high, the excess must be declared as "Connective Tissue". 
         // BUT user said: "Excess Connective Tissue simply reduces the Meat QUID amount (standard rule)"
         
         // Let's implement the logic:
         // 1. Calculate Excess CT
         const avgCtPercent = (group.ctMass / group.rawWeight) * 100;
         // Formula similar to fat but for CT
         const excessCtWeight = group.rawWeight * (avgCtPercent - limits.ct) / (100 - limits.ct);
         const legalMeatWeight = group.rawWeight - excessCtWeight;

         // Add "Species Meat" (Reduced)
         processedMeatList.push({
            id: `agg-${species}-meat`,
            name: `${getSpeciesName(species)}fleisch`,
            rawWeight: legalMeatWeight,
            quidRequired: true,
            isMeat: true,
            meatSpecies: species,
         } as IngredientResult);
         
         // The excess CT is just "loss" for the Meat QUID calculation (legal meat content).
         // User Clarification: "nein Bindegewebe muss nicht deklariert werden"
         // This means we reduce the "Meat" QUID amount, but we do NOT add a separate "Connective Tissue" ingredient to the list.
         // The excess CT remains in the product physically, but it is not counted as "Meat" for the QUID percentage.
         // It effectively becomes a "hidden" ingredient or part of the general mass that isn't muscle meat.
         // Since it is not declared, we don't push `agg-${species}-ct`.
         
         // However, the `finalIngredients` list needs to account for the mass to calculate percentages correctly.
         // If we just drop it, the total weight sums might be off if we used them for checking.
         // But `calculateQuid` uses `totalEndWeight` (calculated from total raw mass) for the denominator.
         // The `quidRawValue` for the Meat will be `legalMeatWeight / totalEndWeight`.
         // The `excessCtWeight` will simply NOT be listed.
         // This results in a lower QUID % for meat, which is correct.
         // And since we don't list the CT, the consumer sees "Pork meat 85%" instead of "90%", 
         // and the missing 5% is just undeclared tissue (which is allowed if it's part of the meat raw material naturally, 
         // just not counted as 'meat' legally).

         warnings.push(
            `Hinweis: Der Bindegewebsanteil für ${getSpeciesName(species)} (${avgCtPercent.toFixed(1)}%) überschreitet den Grenzwert (${limits.ct}%). Der Fleischanteil wurde um ${Math.round(excessCtWeight * 1000)}g reduziert.`
         );

    } else {
      // No split needed - Use generic term or keep individual?
      // User implies "Zusammenstellung" -> usually implies generic term for QUID.
      // BUT if they didn't exceed limits, maybe they want "Pork Belly" listed?
      // Standard practice: if you say "Meat", it's the generic category.
      // If we aggregate, we lose the specific names.
      // Let's aggregate to "Species Meat" to be consistent with the logic "combination must be considered".
      
      processedMeatList.push({
        id: `agg-${species}-meat`,
        name: `${getSpeciesName(species)}fleisch`,
        rawWeight: group.rawWeight,
        quidRequired: true,
        isMeat: true,
        meatSpecies: species,
      } as IngredientResult);
    }
  });

  // Combine lists
  const finalProcessedList = [...processedMeatList, ...otherIngredients];

  // 3. Calculate Total Raw Mass (kg)
  // Re-sum from the final list to ensure consistency
  const totalRawMass = finalProcessedList.reduce((sum, ing) => sum + (ing.rawWeight || 0), 0);

  // 4. Calculate Total End Weight (kg)
  // We need to account for Pre-Processing Loss (Sub-Recipes) first.
  // The user inputs RAW equivalent weight for sub-recipes.
  // We must calculate the EFFECTIVE mass that enters the main process.
  
  const effectiveInputMass = ingredients.reduce((sum, ing) => {
      const weight = ing.rawWeight || 0;
      const loss = ing.processLoss || 0; // Loss that happened BEFORE main process (e.g. sub-recipe cooking)
      const effectiveWeight = weight * (1 - loss / 100);
      return sum + effectiveWeight;
  }, 0);

  // The Main Cooking Loss applies to this Effective Input Mass
  const totalEndWeight = effectiveInputMass * (1 - cookingLossPercent / 100);



  // 5. Calculate QUID percentages & Finalize List
  
  // Special Handling for Added Water (Volatile Ingredient)
  const isWaterIngredient = (ing: Ingredient) => {
     // Explicit override from checkbox
     if (ing.isWater) return true;
     
     // Fallback to name detection for backward compatibility
     const lower = ing.name.toLowerCase();
     if (lower.includes('fleisch') || lower.includes('eiweiß')) return false;
     const waterKeywords = ['wasser', 'trinkwasser', 'eis', 'schüttung', 'water', 'ice', 'brühe'];
     
     return waterKeywords.some(w => {
       if (w === 'eis') return /(^|[^a-zäöüß])eis($|[^a-zäöüß])/.test(lower);
       return lower.includes(w);
     });
  };

  const totalRawWaterWeight = finalProcessedList
    .filter(ing => isWaterIngredient(ing))
    .reduce((sum, ing) => sum + (ing.rawWeight || 0), 0);
  
  // --- New Logic: Proportional Water Loss ---
  // Instead of strict EU deduction (EndWeight - OtherIngredients), we calculate physically.
  // 1. Calculate Total Water in the System (Added + Natural)
  let totalNaturalWater = 0;
  finalProcessedList.forEach(ing => {
    if (!isWaterIngredient(ing)) {
        // Estimate natural water if not provided: 100 - (Fat + Protein + Ash + Salt + Carbs)
        // Or use the nutrition.water value if present
        let waterPct = ing.nutrition?.water;
        if (waterPct === undefined) {
             // Fallback estimation
             const n = ing.nutrition || {};
             const solids = (n.fat || 0) + (n.protein || 0) + (n.carbohydrates || 0) + (n.salt || 0) + (n.ash || 0);
             
             if (solids > 0) {
                waterPct = Math.max(0, 100 - solids);
             } else {
                // If no nutrition data at all, assume generic values to avoid "100% water" error
                if (ing.isMeat) waterPct = 75;
                else waterPct = 10; // Dry spices assumption
             }
        }
        totalNaturalWater += ing.rawWeight * (waterPct / 100);
    }
  });

  const totalSystemWater = totalRawWaterWeight + totalNaturalWater;
  
  // 2. Calculate Total Water Loss
  // We assume Cooking Loss is primarily water evaporation.
  // (Fat loss is accounted for separately in nutrition, but for mass balance here we treat 'cookingLoss' as the weight diff)
  const totalWeightLossMass = totalRawMass - totalEndWeight;
  
  // 3. Determine Remaining Added Water
  let remainingAddedWater = 0;
  let waterRetentionFactor = 0;

  if (totalSystemWater > 0) {
      // User Request: "Wasser hingegen muss in seiner wertigkeit sinken. das heißt wenn ich auf 100kg gesamtrohmasse 10ltr Wasser habe und 10% verlust dann gehe ich davon aus das nahezu erstmal das komplette zugesetzte wasser verloren geht"
      // Interpretation: Total Weight Loss (Cooking Loss) is subtracted from ADDED WATER first.
      
      if (totalRawWaterWeight > 0) {
          // Subtract loss from Added Water first
          remainingAddedWater = Math.max(0, totalRawWaterWeight - totalWeightLossMass);
          
          // Factor for individual water ingredients (e.g. if we had 5kg Ice + 5kg Water, and 8kg left, factor is 0.8)
          waterRetentionFactor = remainingAddedWater / totalRawWaterWeight;
      } else {
          remainingAddedWater = 0;
          waterRetentionFactor = 0;
      }
  }
  
  // ------------------------------------------

  // We must iterate over the ORIGINAL ingredients for nutrition calculation
  // But for the label list, we use `finalProcessedList`.
  
  // Calculate Nutrition (same as before, from original inputs)
  const totalNutrients = {
    energyKcal: 0, energyKj: 0, fat: 0, saturatedFat: 0, carbohydrates: 0, sugar: 0,
    protein: 0, salt: 0, water: 0, ash: 0
  };
  
  ingredients.forEach(ing => {
      const weightKg = ing.rawWeight || 0;
      const massInGrams = weightKg * 1000;
      if (ing.nutrition) {
        totalNutrients.energyKcal += (massInGrams / 100) * (ing.nutrition.energyKcal || 0);
        totalNutrients.energyKj += (massInGrams / 100) * (ing.nutrition.energyKj || 0);
        totalNutrients.fat += (massInGrams / 100) * (ing.nutrition.fat || 0);
        totalNutrients.saturatedFat += (massInGrams / 100) * (ing.nutrition.saturatedFat || 0);
        totalNutrients.carbohydrates += (massInGrams / 100) * (ing.nutrition.carbohydrates || 0);
        totalNutrients.sugar += (massInGrams / 100) * (ing.nutrition.sugar || 0);
        totalNutrients.protein += (massInGrams / 100) * (ing.nutrition.protein || 0);
        totalNutrients.salt += (massInGrams / 100) * (ing.nutrition.salt || 0);
        
        // Smart Water Calculation: Use provided water OR estimate it (100 - solids)
        let waterVal = ing.nutrition.water;
        if (waterVal === undefined || waterVal === null) {
           const solids = (ing.nutrition.fat || 0) + 
                          (ing.nutrition.carbohydrates || 0) + 
                          (ing.nutrition.protein || 0) + 
                          (ing.nutrition.salt || 0) + 
                          (ing.nutrition.ash || 0);
           waterVal = Math.max(0, 100 - solids);
        }
        totalNutrients.water += (massInGrams / 100) * waterVal;
        
        totalNutrients.ash += (massInGrams / 100) * (ing.nutrition.ash || 0);
      }
  });

  // Finalize Ingredient List for Display (Sorting & Text)
  const finalIngredients = finalProcessedList
    .map((ing) => {
      const weightKg = ing.rawWeight || 0;
      let quidRawValue = 0;
      
      const isWater = isWaterIngredient(ing);

      if (isWater) {
         // Special Water QUID Calculation
         // It's not (Raw / End), it's (Remaining / End)
         // We distribute the total remaining added water proportionally to the water ingredients used
         const remainingWeightForThisIng = weightKg * waterRetentionFactor;
         quidRawValue = totalEndWeight > 0 ? (remainingWeightForThisIng / totalEndWeight) * 100 : 0;
      } else {
         // Standard QUID for solids
         quidRawValue = totalEndWeight > 0 ? (weightKg / totalEndWeight) * 100 : 0;
      }
      
      // Use labelName if available, otherwise name
      const displayName = ing.labelName || ing.name;

      return {
        ...ing,
        quidRawValue,
        labelText: generateIngredientText(displayName, quidRawValue, ing.quidRequired, weightKg * 1000, ing.subIngredients, ing.allergens),
      };
    })
    .sort((a, b) => {
       // Sort by QUID percentage (descending) instead of raw weight
       // Because for water, the QUID % might be much lower than raw weight suggests
       return b.quidRawValue - a.quidRawValue;
    });


  // 6. Calculate Final Nutrition per 100g End Product

  const endWeightGrams = totalEndWeight * 1000;
  
  // Correction for Fat Loss
  // Fat Loss Percent is based on Total Raw Mass (like Cooking Loss)
  // Example: 100kg batch, 5% fat loss -> 5kg fat lost.
  const fatLostGrams = (totalRawMass * 1000) * (fatLossPercent / 100);
  const finalFatGrams = Math.max(0, totalNutrients.fat - fatLostGrams);
  
  // Calculate Energy Loss from Fat (Fat = 9 kcal/g, 37 kJ/g)
  // We subtract the energy of the lost fat from total energy
  const energyKcalLost = fatLostGrams * 9;
  const energyKjLost = fatLostGrams * 37;
  
  // const finalEnergyKcal = Math.max(0, totalNutrients.energyKcal - energyKcalLost);
  // const finalEnergyKj = Math.max(0, totalNutrients.energyKj - energyKjLost);

  // Correction for Water content
  // Water Loss = Total Weight Loss - Fat Loss
  // Example: 20% Total Loss, 5% Fat Loss -> 15% Water Loss
  // If Fat Loss > Total Loss, assume Total Loss = Fat Loss + Water Loss (User error? or just assume remainder is water)
  // Usually Cooking Loss is dominant.
  const totalWeightLostGrams = (totalRawMass * 1000) * (cookingLossPercent / 100);
  
  // The weight lost that is NOT fat (can be pure water or "juice")
  const nonFatLossGrams = Math.max(0, totalWeightLostGrams - fatLostGrams);
  
  // Calculate nutrient losses based on type
  let proteinLostGrams = 0;
  let saltLostGrams = 0;
  let sugarLostGrams = 0;
  let waterLostGrams = nonFatLossGrams; // Default to all water (drying)

  if (lossType === 'cooking') {
     // Cooking/Roasting (Tropfverlust):
     // The "juice" lost contains dissolved solids. 
     // Approximation: Meat juice is ~93-94% water, ~4-5% protein, ~1-2% salts/minerals.
     // We subtract these fractions from the totals.
     
     const JUICE_PROTEIN_FACTOR = 0.05; // 5% protein in juice
     const JUICE_SALT_FACTOR = 0.01;    // 1% salt in juice
     const JUICE_SUGAR_FACTOR = 0.01;   // 1% sugar/carbs (if marinade washed off)
     const JUICE_WATER_FACTOR = 0.93;   // 93% water

     proteinLostGrams = nonFatLossGrams * JUICE_PROTEIN_FACTOR;
     saltLostGrams = nonFatLossGrams * JUICE_SALT_FACTOR;
     sugarLostGrams = nonFatLossGrams * JUICE_SUGAR_FACTOR;
     waterLostGrams = nonFatLossGrams * JUICE_WATER_FACTOR;
  }

  const finalWaterGrams = Math.max(0, totalNutrients.water - waterLostGrams);
  const finalProteinGrams = Math.max(0, totalNutrients.protein - proteinLostGrams);
  const finalSaltGrams = Math.max(0, totalNutrients.salt - saltLostGrams);
  const finalSugarGrams = Math.max(0, totalNutrients.sugar - sugarLostGrams);
  const finalCarbsGrams = Math.max(0, totalNutrients.carbohydrates - sugarLostGrams); // Assume carbs loss is mostly sugar

  
  // Calculate Final Macronutrients per 100g
  const per100g = (val: number) => endWeightGrams > 0 ? (val / endWeightGrams) * 100 : 0;

  const finalProtein = per100g(finalProteinGrams);
  const finalFat = per100g(finalFatGrams);
  const finalCarbs = per100g(finalCarbsGrams);
  const finalSugar = per100g(finalSugarGrams);
  const finalSalt = per100g(finalSaltGrams);
  
  // Calculate Energy based on Final Macros (Standard LMIV Factors)
  // Fat: 37 kJ/9 kcal
  // Protein: 17 kJ/4 kcal
  // Carbs: 17 kJ/4 kcal
  const finalEnergyKjCalc = (finalFat * 37) + (finalProtein * 17) + (finalCarbs * 17);
  const finalEnergyKcalCalc = (finalFat * 9) + (finalProtein * 4) + (finalCarbs * 4);

  const nutritionPer100g: NutritionalValues = {
    energyKcal: finalEnergyKcalCalc,
    energyKj: finalEnergyKjCalc,
    fat: finalFat,
    // Assuming saturated fat is lost proportionally to total fat
    saturatedFat: per100g(totalNutrients.saturatedFat * (finalFatGrams / (totalNutrients.fat || 1))),
    
    carbohydrates: finalCarbs,
    sugar: finalSugar,
    protein: finalProtein,
    salt: finalSalt,
    water: per100g(finalWaterGrams),
    ash: per100g(totalNutrients.ash), // Ash effectively stays or is part of salt loss, keep simple
  };

  // 7. Generate Final Label Text
  const labelText = finalIngredients
    .filter(ing => {
       // User Request: If added water is < 5% in end product, do not declare it.
       const isWater = isWaterIngredient(ing);
       
       // Note: Technically EU rule applies to "appearance of cut/slice", but user requested this general rule.
       if (isWater && ing.quidRawValue <= 5) {
         return false; // Skip declaration
       }
       return true;
    })
    .map((ing) => ing.labelText)
    .join(", ");

  // 8. Calculate Total Meat Percentage (for QUID Check)
  const totalMeatRawWeight = finalProcessedList
      .filter(ing => ing.isMeat)
      .reduce((sum, ing) => sum + (ing.rawWeight || 0), 0);
  
  const meatPercentage = totalEndWeight > 0 ? (totalMeatRawWeight / totalEndWeight) * 100 : 0;

  // 9. Collect Aggregated Data for Spec
  
  // -- Processing Aids with Sources --
  const processingAidMap = new Map<string, Set<string>>();
  ingredients.forEach(ing => {
      if (ing.processingAids) {
          const aids = ing.processingAids.split(/[,;]/).map(s => s.trim()).filter(Boolean);
          aids.forEach(aid => {
             if (!processingAidMap.has(aid)) {
                 processingAidMap.set(aid, new Set());
             }
             // Use labelName if available, else name
             processingAidMap.get(aid)?.add(ing.labelName || ing.name);
          });
      }
  });

  const processingAidDetails = Array.from(processingAidMap.entries()).map(([name, sourcesSet]) => ({
      name,
      sources: Array.from(sourcesSet)
  }));
  
  const allProcessingAids = processingAidDetails.map(d => d.name);


  // -- Allergens with Sources --
  const allergenMap = new Map<string, Set<string>>();
  ingredients.forEach(ing => {
      if (ing.allergens && ing.allergens.length > 0) {
          ing.allergens.forEach(alg => {
             if (!allergenMap.has(alg)) {
                 allergenMap.set(alg, new Set());
             }
             // Use labelName if available, else name
             allergenMap.get(alg)?.add(ing.labelName || ing.name);
          });
      }
  });
  
  const allergenDetails = Array.from(allergenMap.entries()).map(([id, sourcesSet]) => ({
      id,
      sources: Array.from(sourcesSet)
  }));

  const allAllergens = allergenDetails.map(d => d.id).sort();


  return {
    totalRawMass,
    totalEndWeight,
    ingredients: finalIngredients,
    labelText,
    warnings,
    nutritionPer100g,
    allAllergens,
    allProcessingAids,
    allergenDetails,
    processingAidDetails,
    meatPercentage
  };
}


function getSpeciesName(species: MeatSpecies): string {
   switch (species) {
    case 'pork': return 'Schwein';
    case 'beef': return 'Rind';
    case 'lamb': return 'Lamm';
    case 'veal': return 'Kalb';
    case 'chicken': return 'Hühner';
    case 'turkey': return 'Puten';
    case 'duck': return 'Enten';
    case 'rabbit': return 'Kaninchen';
    case 'mammal': return 'Säugetier';
    case 'poultry': return 'Geflügel';
    default: return '';
  }
}

function generateIngredientText(
  name: string,
  quidValue: number,
  required: boolean,
  rawWeight: number,
  subIngredients?: string,
  allergens?: string[]
): string {
  let displayName = name;
  let displaySubIngredients = subIngredients;

  // Uppercase Allergens in Name
  if (allergens && allergens.length > 0) {
      // 1. Check if the name itself is an allergen or contains one
      // Simple heuristic: If allergen is found in name, uppercase it.
      // Better: Uppercase the whole name if it IS the allergen? Or just parts?
      // LMIV: Emphasize the allergen name.
      // If the user entered "Weizenmehl" and allergen is "gluten", we might not match.
      // But usually user enters "Weizenmehl" and tags it.
      // Let's iterate allergens and replace in name.
      
      // We need a mapping or just trust string matching?
      // User request: "in großbuchstaben auftauchen".
      // If the ingredient has allergens, we should try to highlight them.
      // If no match found, maybe append? "(ENTHÄLT ...)"?
      // Usually the name IS the declaration.
      
      // STRATEGY: 
      // 1. If allergen strings are found in the name (case-insensitive), uppercase them.
      // 2. If the ingredient name IS the allergen source (e.g. "Senf"), uppercase it.
      // 3. What if the allergen is "Gluten" but text is "Weizen"? 
      //    We rely on the user having entered the correct declaration name (e.g. "Weizenmehl").
      //    The allergen tag is metadata.
      //    Let's uppercase the entire name if it matches an allergen category widely?
      //    Or better: Assume the user wants the ALLERGEN NAMES uppercased.
      //    Let's try to find the allergen names in the text.
      
      // Simpler approach requested by users often: "If I tag it as allergen, UPPERCASE the name".
      // Let's try to match known allergen keywords.
      
      const allergenKeywords = allergens.flatMap(a => [a, ...getAllergenKeywords(a)]);
      
      // Helper to replace text with uppercase version
      const replaceWithUpper = (text: string) => {
          let newText = text;
          allergenKeywords.forEach(keyword => {
              if (!keyword) return;
              const regex = new RegExp(keyword, 'gi');
              newText = newText.replace(regex, (match) => match.toUpperCase());
          });
          return newText;
      };

      displayName = replaceWithUpper(displayName);
      if (displaySubIngredients) {
          displaySubIngredients = replaceWithUpper(displaySubIngredients);
      }
  }

  const baseName = displaySubIngredients ? `${displayName} (${displaySubIngredients})` : displayName;

  if (!required) {
    return baseName;
  }

  const formatNum = (n: number) =>
    n.toLocaleString("de-DE", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });

  if (quidValue <= 100) {
    return `${baseName} (${formatNum(quidValue)} %)`;
  } else {
    return `hergestellt aus ${formatNum(rawWeight)} g ${displayName} je 100 g des Enderzeugnisses${displaySubIngredients ? ` (${displaySubIngredients})` : ''}`;
  }
}

// Helper to expand allergen IDs to German keywords
function getAllergenKeywords(id: string): string[] {
    const map: Record<string, string[]> = {
        'gluten': ['gluten', 'weizen', 'roggen', 'gerste', 'hafer', 'dinkel', 'kamut'],
        'crustaceans': ['krebstier', 'krebs', 'garnele', 'hummer', 'scampi'],
        'eggs': ['ei', 'eier', 'hühnerei'],
        'fish': ['fisch', 'lachs', 'thunfisch', 'kabeljau'],
        'peanuts': ['erdnuss', 'erdnüsse'],
        'soy': ['soja', 'sojabohne', 'edamame'],
        'milk': ['milch', 'laktose', 'sahne', 'rahm', 'käse', 'quark', 'joghurt', 'molke'],
        'nuts': ['schalenfrucht', 'nuss', 'nüsse', 'mandel', 'haselnuss', 'walnuss', 'cashew', 'pecan', 'paranuss', 'pistazie', 'macadamia'],
        'celery': ['sellerie', 'knollensellerie', 'staudensellerie'],
        'mustard': ['senf', 'senfsaat', 'senfkorn'],
        'sesame': ['sesam', 'sesamsamen'],
        'sulphites': ['sulfit', 'schwefeldioxid', 'so2', 'e220', 'e221', 'e222', 'e223', 'e224', 'e225', 'e226', 'e227', 'e228'],
        'lupin': ['lupine'],
        'molluscs': ['weichtier', 'muschel', 'schnecke', 'tintenfisch', 'calamari']
    };
    return map[id.toLowerCase()] || [id];
}
