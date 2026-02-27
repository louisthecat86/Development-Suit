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
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      // Initialize with defaults if empty
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DATA));
      return INITIAL_DATA;
    }
    return JSON.parse(data);
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
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  // Dispatch event for live updates across components
  window.dispatchEvent(new Event("storage-update"));
}

export function deleteLibraryIngredient(id: string) {
  const current = getLibraryIngredients();
  const next = current.filter(i => i.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
