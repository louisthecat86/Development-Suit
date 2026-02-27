import { getData, setData } from "./electron-storage";
import { MeatSpecies, NutritionalValues } from "./quid-calculator";
import { useState, useEffect } from "react";

export interface RecipeIngredient {
  name: string;
  rawWeight: number;
  quidRequired: boolean;
  isMeat: boolean;
  isWater?: boolean; // NEW
  meatSpecies?: MeatSpecies;
  connectiveTissuePercent?: number;
  meatProteinLimit?: number;
  nutrition?: Partial<NutritionalValues>;
  processingAids?: string; // NEW
  allergens?: string[]; // NEW
}

export interface SavedRecipe {
  id: string;
  name: string;
  articleNumber?: string; // NEW
  description?: string;
  updatedAt: string;
  cookingLoss: number;
  fatLoss?: number;
  lossType?: 'drying' | 'cooking' | 'none'; // Added field
  ingredients: RecipeIngredient[];
}

const STORAGE_KEY = "quid-recipe-db-clean";

const INITIAL_DATA: SavedRecipe[] = [];

export function getLibraryRecipes(): SavedRecipe[] {
  if (typeof window === "undefined") return [];
  try {
    const data = getData(STORAGE_KEY);
    if (data === null) {
      setData(STORAGE_KEY, INITIAL_DATA);
      return INITIAL_DATA;
    }
    return data;
  } catch (e) {
    console.error("Failed to load recipes", e);
    return [];
  }
}

export function saveLibraryRecipe(recipe: SavedRecipe) {
  const current = getLibraryRecipes();
  const existingIndex = current.findIndex(r => r.id === recipe.id);
  
  if (existingIndex >= 0) {
    current[existingIndex] = { ...recipe, updatedAt: new Date().toISOString() };
  } else {
    current.push({ ...recipe, updatedAt: new Date().toISOString() });
  }
  
  setData(STORAGE_KEY, current);
  window.dispatchEvent(new Event("recipe-storage-update"));
}

export function deleteLibraryRecipe(id: string) {
  const current = getLibraryRecipes();
  const next = current.filter(r => r.id !== id);
  setData(STORAGE_KEY, next);
  window.dispatchEvent(new Event("recipe-storage-update"));
}

export function useRecipeLibrary() {
  const [recipes, setRecipes] = useState<SavedRecipe[]>(getLibraryRecipes());

  useEffect(() => {
    // Initial load not strictly needed due to useState init, but good for updates
    setRecipes(getLibraryRecipes());

    const handleStorageChange = () => {
      setRecipes(getLibraryRecipes());
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("recipe-storage-update", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("recipe-storage-update", handleStorageChange);
    };
  }, []);

  return { 
    recipes, 
    save: saveLibraryRecipe, 
    remove: deleteLibraryRecipe 
  };
}
