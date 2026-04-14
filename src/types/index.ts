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

export interface Ingredient {
  name: string;
  portion: string;
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
  ingredients?: Ingredient[];
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
