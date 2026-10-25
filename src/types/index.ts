export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  dailyCalorieGoal: number;
  dailyWaterGoal: number;
  weight?: number;
  height?: number;
  createdAt: string;
  role?: 'admin' | 'user';
}

export interface Per100g {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

// Where an item's nutrient values came from. 'user' means the person corrected them by hand.
export type NutrientSource = 'memory' | 'usda' | 'ai' | 'user';

export interface FoodItem {
  name: string;
  portion: string;
  // Fields below are absent on logs saved before gram-based tracking and on hand-typed items.
  grams?: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  per100g?: Per100g;
  source?: NutrientSource;
  confidence?: number;
}

export interface FoodMemoryEntry {
  uid: string;
  key: string;
  name: string;
  gramsTypical: number;
  per100g: Per100g;
  source: NutrientSource;
  useCount: number;
  updatedAt: string;
}

export interface FoodHint {
  name: string;
  typicalGrams: number;
  source: NutrientSource;
  per100g: Per100g;
}

export interface FoodLog {
  id?: string;
  uid: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  timestamp: string;
  imageUrl?: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  items?: FoodItem[];
}

export interface WorkoutLog {
  id?: string;
  uid: string;
  exercise: string;
  duration: number;
  caloriesBurned: number;
  timestamp: string;
}

export interface WaterLog {
  id?: string;
  uid: string;
  amount: number;
  timestamp: string;
}
