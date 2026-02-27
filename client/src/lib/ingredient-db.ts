import { getData, setData } from "./electron-storage";
import { MeatSpecies, NutritionalValues } from "./quid-calculator";

export interface LibraryIngredient {
  id: string;
  name: string;
  articleNumber?: string; // NEW: Article Number for search
  labelName?: string; // Optional name for label
  isMeat: boolean;
  isWater?: boolean; // NEW
  meatSpecies?: MeatSpecies;
  connectiveTissuePercent?: number;
  meatProteinLimit?: number;
  nutrition: Partial<NutritionalValues>;
  quidRequiredDefault: boolean;
  subIngredients?: string; // e.g. "Salz, Gewürze"
  processingAids?: string; // NEW: Verarbeitungshilfsstoffe
  allergens?: string[]; // NEW: List of allergen keys
}

const STORAGE_KEY = "quid-ingredient-db-clean";

// Default initial data if empty
const INITIAL_DATA: LibraryIngredient[] = [];

export function getLibraryIngredients(): LibraryIngredient[] {
  if (typeof window === "undefined") return [];
  try {
    const data = getData(STORAGE_KEY);
    if (data === null) {
      // Initialize with defaults if empty
      setData(STORAGE_KEY, INITIAL_DATA);
      return INITIAL_DATA;
    }
    return data;
  } catch (e) {
    console.error("Failed to load ingredients", e);
    return [];
  }
}

export function saveLibraryIngredient(ing: LibraryIngredient) {
  const current = getLibraryIngredients();
  const existingIndex = current.findIndex(i => i.id === ing.id);
  
  if (existingIndex >= 0) {
    current[existingIndex] = ing;
  } else {
    current.push(ing);
  }
  
  setData(STORAGE_KEY, current);
  // Dispatch event for live updates across components
  window.dispatchEvent(new Event("storage-update"));
}

export function deleteLibraryIngredient(id: string) {
  const current = getLibraryIngredients();
  const next = current.filter(i => i.id !== id);
  setData(STORAGE_KEY, next);
  window.dispatchEvent(new Event("storage-update"));
}

// Hook to subscribe to changes
import { useState, useEffect } from "react";

export function useIngredientLibrary() {
  const [ingredients, setIngredients] = useState<LibraryIngredient[]>([]);

  useEffect(() => {
    setIngredients(getLibraryIngredients());

    const handleStorageChange = () => {
      setIngredients(getLibraryIngredients());
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("storage-update", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("storage-update", handleStorageChange);
    };
  }, []);

  return { 
    ingredients, 
    save: saveLibraryIngredient, 
    remove: deleteLibraryIngredient 
  };
}
