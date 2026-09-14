import { auth } from "./firebase";
import { FoodItem } from "../types";

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

export async function analyzeFoodImage(base64Image: string): Promise<NutritionalInfo> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/nutrition/analyze", {
    method: "POST",
    headers,
    body: JSON.stringify({ image: base64Image }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to analyze food image.");
  }

  const result = await response.json();
  return result.data;
}

export async function getNutritionByName(name: string): Promise<NutritionalInfo> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/nutrition/name", {
    method: "POST",
    headers,
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to fetch nutrition information.");
  }

  const result = await response.json();
  return result.data;
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
