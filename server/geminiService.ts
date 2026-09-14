import { GoogleGenAI, Type } from "@google/genai";

export interface FoodItem {
  name: string;
  portion: string;
}

export interface NutritionalInfo {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  servingSize: string;
  items: FoodItem[];
}

const FALLBACK_MODELS = [
  "gemini-3.8-flash",
  "gemini-2.5-pro",
  "gemini-3.7-flash",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
];

const foodItemSchema = {
  type: Type.OBJECT,
  properties: {
    name: {
      type: Type.STRING,
      description: "Precise name of the food item or component (e.g., 'Grilled Chicken Breast', 'Steamed Jasmine Rice', 'Olive Oil dressing')",
    },
    portion: {
      type: Type.STRING,
      description: "Portion size with estimated metric and standard units (e.g., '150g (1 medium breast)', '1 cup (180g)', '1 tbsp (15ml)')",
    },
  },
  required: ["name", "portion"],
};

const nutritionalInfoSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Accurate, descriptive name of the dish or meal" },
    calories: { type: Type.NUMBER, description: "Total estimated calories (kcal) matching the sum of components" },
    protein: { type: Type.NUMBER, description: "Total estimated protein in grams (g)" },
    carbs: { type: Type.NUMBER, description: "Total estimated carbohydrates in grams (g)" },
    fats: { type: Type.NUMBER, description: "Total estimated dietary fats in grams (g)" },
    servingSize: { type: Type.STRING, description: "Estimated total serving weight or volume (e.g., '1 bowl (~380g)')" },
    items: {
      type: Type.ARRAY,
      items: foodItemSchema,
      description: "Exhaustive list of identified distinct food components, sides, sauces, and cooking oils",
    },
  },
  required: ["name", "calories", "protein", "carbs", "fats", "servingSize", "items"],
};

function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }
  return new GoogleGenAI({ apiKey });
}

async function generateWithFallback(ai: GoogleGenAI, contents: any) {
  let lastError: any = null;

  for (let i = 0; i < FALLBACK_MODELS.length; i++) {
    const model = FALLBACK_MODELS[i];
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          responseMimeType: "application/json",
          responseSchema: nutritionalInfoSchema,
        },
      });

      if (response && response.text) {
        return response;
      }
    } catch (err: any) {
      lastError = err;
      const errMsg = err.message || JSON.stringify(err);
      console.warn(`Model ${model} failed, trying fallback to next model... Error: ${errMsg}`);
    }
  }

  throw lastError || new Error("All AI models are currently experiencing high demand. Please try again.");
}

export function validateDishName(name: unknown): string {
  if (typeof name !== "string" || !name.trim()) {
    throw new Error("Valid food name is required.");
  }
  const clean = name.trim();
  if (clean.length > 200) {
    throw new Error("Food name is too long (maximum 200 characters).");
  }
  return clean;
}

export function validateBase64Image(base64Image: unknown): string {
  if (typeof base64Image !== "string" || !base64Image.trim()) {
    throw new Error("Valid base64 image data is required.");
  }
  if (base64Image.length > 20 * 1024 * 1024) {
    throw new Error("Image size exceeds maximum limit (20MB).");
  }
  return base64Image;
}

export function validateFoodItems(items: unknown): FoodItem[] {
  if (!Array.isArray(items)) {
    throw new Error("Food items must be an array.");
  }
  if (items.length > 50) {
    throw new Error("Too many food items (maximum 50 items allowed).");
  }
  return items.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Invalid item at position ${index}.`);
    }
    const name = String(item.name || "").trim().slice(0, 100);
    const portion = String(item.portion || "").trim().slice(0, 100);
    if (!name || !portion) {
      throw new Error(`Item at position ${index} must have both name and portion.`);
    }
    return { name, portion };
  });
}

export async function analyzeFoodImageServer(base64Image: string): Promise<NutritionalInfo> {
  const validatedImage = validateBase64Image(base64Image);
  const ai = getGenAI();

  const mimeMatch = validatedImage.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const rawData = validatedImage.includes(",") ? validatedImage.split(",")[1] : validatedImage;

  const contents = [
    {
      inlineData: {
        data: rawData,
        mimeType,
      },
    },
    {
      text: `You are an expert clinical dietitian and computer vision nutritionist. Analyze this food photo with the highest possible precision (target 99% accuracy):
1. DECONSTRUCT: Identify every distinct food component, ingredient, side, sauce, cooking oil, and dressing visible or inferred from preparation style (e.g. deep-fried vs grilled vs steamed).
2. ESTIMATE PORTIONS: Use visual cues (plate/bowl proportions, utensil scale, food thickness) to determine realistic gram/ounce portions.
3. COMPUTE ACCURATE MACROS: Calculate realistic calories, protein, carbs, and fats using verified USDA nutritional reference standards. Account for absorbed cooking fats and hidden sauces.
4. SUM INTEGRITY: Ensure the total calories, protein, carbs, and fats strictly equal the sum of all itemized components.`,
    },
  ];

  const response = await generateWithFallback(ai, contents);

  if (!response.text) {
    throw new Error("AI returned empty response.");
  }

  return JSON.parse(response.text) as NutritionalInfo;
}

export async function getNutritionByNameServer(name: string): Promise<NutritionalInfo> {
  const validatedName = validateDishName(name);
  const ai = getGenAI();

  const contents = `You are an expert clinical dietitian. Provide accurate nutritional information for a standard single serving of "${validatedName}":
1. Break down the dish into its authentic component ingredients and typical portions.
2. Use verified USDA/dietary database standards for caloric and macronutrient density.
3. Account for standard preparation methods (cooking oils, seasonings, sauces).
4. Ensure the total calories and macronutrients strictly match the sum of its components.`;

  const response = await generateWithFallback(ai, contents);

  if (!response.text) {
    throw new Error("AI returned empty response.");
  }

  return JSON.parse(response.text) as NutritionalInfo;
}

export async function recalculateNutritionServer(
  items: FoodItem[],
  foodName: string
): Promise<NutritionalInfo> {
  const validatedItems = validateFoodItems(items);
  const validatedName = validateDishName(foodName);
  const ai = getGenAI();

  const itemsStr = validatedItems.map((i) => `${i.portion} of ${i.name}`).join(", ");
  const contents = `You are an expert clinical dietitian. Recalculate the exact nutritional information for "${validatedName}" based on this specific itemized breakdown and portions: ${itemsStr}.
CRITICAL ACCURACY GUIDELINES:
1. Provide the true total nutritional facts for the ENTIRE dish combining these specific portions.
2. Validate each item against standard USDA nutritional benchmarks (e.g., 100g cooked chicken breast = ~165 kcal, 31g protein, 3.6g fat; 1 cup cooked rice = ~200 kcal, 4.3g protein, 45g carbs; 1 tbsp olive oil = ~120 kcal, 14g fat).
3. Ensure the macro totals strictly equal the sum of each ingredient's contribution.`;

  const response = await generateWithFallback(ai, contents);

  if (!response.text) {
    throw new Error("AI returned empty response.");
  }

  return JSON.parse(response.text) as NutritionalInfo;
}
