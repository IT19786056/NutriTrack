import { GoogleGenAI, Type } from "@google/genai";
import { FoodItem } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
    name: { type: Type.STRING, description: "Name of the food item or component (e.g., 'Rice', 'Chicken Curry', 'Ice Cream')" },
    portion: { type: Type.STRING, description: "Portion size or measurement (e.g., '1 cup', '100g', '2 scoops', '1 slice')" }
  },
  required: ["name", "portion"]
};

export async function analyzeFoodImage(base64Image: string): Promise<NutritionalInfo> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
          {
            text: "Analyze this food image and provide nutritional information. Identify the distinct food items/components in the dish (e.g., if it's rice and curry, list 'Rice', 'Chicken Curry', etc.) and their estimated portions (e.g., '1 cup', '100g', '2 scoops'). Be as accurate as possible with estimations.",
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Common name of the food" },
          calories: { type: Type.NUMBER, description: "Estimated calories" },
          protein: { type: Type.NUMBER, description: "Estimated protein in grams" },
          carbs: { type: Type.NUMBER, description: "Estimated carbohydrates in grams" },
          fats: { type: Type.NUMBER, description: "Estimated fats in grams" },
          servingSize: { type: Type.STRING, description: "Estimated serving size" },
          items: { 
            type: Type.ARRAY, 
            items: foodItemSchema,
            description: "List of distinct food items/components with portions"
          },
        },
        required: ["name", "calories", "protein", "carbs", "fats", "servingSize", "items"],
      },
    },
  });

  return JSON.parse(response.text);
}

export async function getNutritionByName(name: string): Promise<NutritionalInfo> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Provide nutritional information for "${name}". Identify the distinct food items/components that make up this dish and their estimated portions for a standard serving. Be as accurate as possible with estimations.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          calories: { type: Type.NUMBER },
          protein: { type: Type.NUMBER },
          carbs: { type: Type.NUMBER },
          fats: { type: Type.NUMBER },
          servingSize: { type: Type.STRING },
          items: { 
            type: Type.ARRAY, 
            items: foodItemSchema
          },
        },
        required: ["name", "calories", "protein", "carbs", "fats", "servingSize", "items"],
      },
    },
  });

  return JSON.parse(response.text);
}

export async function recalculateNutrition(items: FoodItem[], foodName: string): Promise<NutritionalInfo> {
  const itemsStr = items.map(i => `${i.portion} of ${i.name}`).join(', ');
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Recalculate the nutritional information for "${foodName}" based on this specific list of food items/components and their portions: ${itemsStr}. 
    CRITICAL: Provide the total nutritional facts for the WHOLE dish based on these specific portions. 
    Ensure the values are realistic (e.g., 100g of chicken is ~31g protein, not 200g).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          calories: { type: Type.NUMBER },
          protein: { type: Type.NUMBER },
          carbs: { type: Type.NUMBER },
          fats: { type: Type.NUMBER },
          servingSize: { type: Type.STRING },
          items: { 
            type: Type.ARRAY, 
            items: foodItemSchema
          },
        },
        required: ["name", "calories", "protein", "carbs", "fats", "servingSize", "items"],
      },
    },
  });

  return JSON.parse(response.text);
}
