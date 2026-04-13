import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface NutritionalInfo {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  servingSize: string;
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
            text: "Analyze this food image and provide nutritional information. Be as accurate as possible with estimations.",
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
        },
        required: ["name", "calories", "protein", "carbs", "fats", "servingSize"],
      },
    },
  });

  return JSON.parse(response.text);
}

export async function getNutritionByName(name: string): Promise<NutritionalInfo> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Provide nutritional information for "${name}". Be as accurate as possible with estimations for a standard serving.`,
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
        },
        required: ["name", "calories", "protein", "carbs", "fats", "servingSize"],
      },
    },
  });

  return JSON.parse(response.text);
}
