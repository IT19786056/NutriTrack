import { auth } from "./firebase";
import { FoodHint, FoodItem } from "../types";
import { withGrams } from "./nutrition";

export interface NutritionalInfo {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  servingSize: string;
  items: FoodItem[];
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("You must be signed in to analyze nutrition.");
  }
  const token = await user.getIdToken();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function requestAnalysis(
  body: { image?: string; name?: string },
  hints: FoodHint[],
  failureMessage: string
): Promise<NutritionalInfo> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/nutrition/analyze", {
    method: "POST",
    headers,
    body: JSON.stringify({ ...body, hints }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || failureMessage);
  }

  const result = await response.json();
  return result.data;
}

export function analyzeFoodImage(base64Image: string, hints: FoodHint[] = []): Promise<NutritionalInfo> {
  return requestAnalysis({ image: base64Image }, hints, "Failed to analyze food image.");
}

export function getNutritionByName(name: string, hints: FoodHint[] = []): Promise<NutritionalInfo> {
  return requestAnalysis({ name }, hints, "Failed to fetch nutrition information.");
}

/** Look up one extra component at a stated weight; returns it as a gram-based item. */
export async function lookupComponent(name: string, grams: number, hints: FoodHint[] = []): Promise<FoodItem> {
  const result = await requestAnalysis({ name: `${grams} g ${name}` }, hints, "Failed to look up component.");
  const first = result.items[0];
  if (!first?.per100g) throw new Error("Could not find nutrition for that component.");
  // Keep the user's own wording and weight; only the nutrient profile comes from the lookup.
  return withGrams({ ...first, name }, grams);
}

export async function recalculateNutrition(items: FoodItem[], foodName: string): Promise<NutritionalInfo> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/nutrition/recalculate", {
    method: "POST",
    headers,
    body: JSON.stringify({ items, foodName }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to recalculate nutrition.");
  }

  const result = await response.json();
  return result.data;
}
