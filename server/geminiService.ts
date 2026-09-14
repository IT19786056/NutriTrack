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

const foodItemSchema = {
  type: Type.OBJECT,
  properties: {
    name: {
      type: Type.STRING,
      description: "Name of the food item or component (e.g., 'Rice', 'Chicken Curry', 'Ice Cream')",
    },
    portion: {
      type: Type.STRING,
      description: "Portion size or measurement (e.g., '1 cup', '100g', '2 scoops', '1 slice')",
    },
  },
  required: ["name", "portion"],
};

const nutritionalInfoSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Name of the dish or food" },
    calories: { type: Type.NUMBER, description: "Estimated total calories" },
    protein: { type: Type.NUMBER, description: "Estimated protein in grams" },
    carbs: { type: Type.NUMBER, description: "Estimated carbohydrates in grams" },
    fats: { type: Type.NUMBER, description: "Estimated fats in grams" },
    servingSize: { type: Type.STRING, description: "Estimated serving size" },
    items: {
      type: Type.ARRAY,
      items: foodItemSchema,
      description: "List of distinct food items/components with portions",
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

  const imagePart = {
    inlineData: {
      data: rawData,
      mimeType,
    },
  };

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      imagePart,
      {
        text: "Analyze this food image and provide nutritional information. Identify the distinct food items/components in the dish (e.g., if it's rice and curry, list 'Rice', 'Chicken Curry', etc.) and their estimated portions (e.g., '1 cup', '100g', '2 scoops'). Be as accurate as possible with estimations.",
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: nutritionalInfoSchema,
    },
  });

  if (!response.text) {
    throw new Error("AI returned empty response.");
  }

  return JSON.parse(response.text) as NutritionalInfo;
}

export async function getNutritionByNameServer(name: string): Promise<NutritionalInfo> {
  const validatedName = validateDishName(name);
  const ai = getGenAI();

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Provide nutritional information for "${validatedName}". Identify the distinct food items/components that make up this dish and their estimated portions for a standard serving. Be as accurate as possible with estimations.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: nutritionalInfoSchema,
    },
  });

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
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Recalculate the nutritional information for "${validatedName}" based on this specific list of food items/components and their portions: ${itemsStr}. 
CRITICAL: Provide the total nutritional facts for the WHOLE dish based on these specific portions. 
Ensure the values are realistic (e.g., 100g of chicken is ~31g protein, not 200g).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: nutritionalInfoSchema,
    },
  });

  if (!response.text) {
    throw new Error("AI returned empty response.");
  }

  return JSON.parse(response.text) as NutritionalInfo;
}
