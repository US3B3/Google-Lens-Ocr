
import { GoogleGenAI, Type } from "@google/genai";
import { OcrResult } from "../types";

// Token-optimized prompt: Concise and direct
const OCR_PROMPT = `
Extract text from the image with high accuracy. 
Maintain original layout, paragraph breaks, and indentations.
Correct OCR errors while preserving meaning. 
Return strictly JSON.
`;

export const processOcr = async (base64Data: string, mimeType: string): Promise<OcrResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    // Changed to Lite model for maximum token efficiency
    model: "gemini-flash-lite-latest",
    contents: [
      {
        parts: [
          { text: OCR_PROMPT },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data.split(',')[1] || base64Data,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          rawText: {
            type: Type.STRING,
            description: "Initial raw extraction.",
          },
          correctedText: {
            type: Type.STRING,
            description: "Corrected text with preserved structure.",
          },
          corrections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                original: { type: Type.STRING },
                fixed: { type: Type.STRING },
                reason: { type: Type.STRING },
              },
              required: ["original", "fixed", "reason"],
            },
          },
          language: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
        },
        required: ["rawText", "correctedText", "corrections", "language"],
      },
    },
  });

  const jsonStr = response.text;
  if (!jsonStr) {
    throw new Error("No response from Gemini");
  }

  return JSON.parse(jsonStr) as OcrResult;
};
