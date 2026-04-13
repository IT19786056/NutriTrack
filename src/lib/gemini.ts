import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface NutritionalInfo {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  servingSize: string;
  ingredients: string[];
}

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
            text: "Analyze this food image and provide nutritional information. Also list the main ingredients used in this dish. Be as accurate as possible with estimations.",
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
          ingredients: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "List of main ingredients"
          },
        },
        required: ["name", "calories", "protein", "carbs", "fats", "servingSize", "ingredients"],
      },
    },
  });

  return JSON.parse(response.text);
}

export async function getNutritionByName(name: string): Promise<NutritionalInfo> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Provide nutritional information for "${name}". Also list the main ingredients. Be as accurate as possible with estimations for a standard serving.`,
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
          ingredients: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING }
          },
        },
        required: ["name", "calories", "protein", "carbs", "fats", "servingSize", "ingredients"],
      },
    },
  });

  return JSON.parse(response.text);
}

export async function recalculateNutrition(ingredients: string[], foodName: string): Promise<NutritionalInfo> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Recalculate the nutritional information for "${foodName}" based on this specific list of ingredients: ${ingredients.join(', ')}. Provide the total nutritional facts for the whole dish.`,
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
          ingredients: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING }
          },
        },
        required: ["name", "calories", "protein", "carbs", "fats", "servingSize", "ingredients"],
      },
    },
  });

  return JSON.parse(response.text);
}
