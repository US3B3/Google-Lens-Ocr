
import { GoogleGenAI, Type } from "@google/genai";
import { OcrResult } from "../types";

const OCR_PROMPT = `
You are an expert OCR and document analysis engine.
1. Perform high-accuracy OCR on the provided document/image to extract all text.
2. **CRITICAL**: Maintain the original formatting, including paragraph breaks, line spacing, and especially paragraph indentations (paragraf başları). Ensure the output mirrors the structural layout of the source.
3. Analyze the extracted text for common OCR errors (e.g., '1' vs 'l', '0' vs 'O', spelling mistakes, formatting breaks).
4. Provide a corrected version of the text that fixes these errors while STRICTLY maintaining the original meaning and paragraph structure.
5. Identify the specific corrections you made.

Your response MUST be in JSON format matching the provided schema.
`;

export const processOcr = async (base64Data: string, mimeType: string): Promise<OcrResult> => {
  // Use process.env.API_KEY directly as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
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
            description: "The initial raw text extracted from the image before correction.",
          },
          correctedText: {
            type: Type.STRING,
            description: "The polished and error-corrected version of the extracted text with preserved paragraph starts.",
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
          language: {
            type: Type.STRING,
            description: "The primary detected language of the text.",
          },
          confidence: {
            type: Type.NUMBER,
            description: "Confidence score from 0 to 1.",
          },
        },
        required: ["rawText", "correctedText", "corrections", "language"],
      },
    },
  });

  const jsonStr = response.text;
  if (!jsonStr) {
    throw new Error("No response received from Gemini");
  }

  return JSON.parse(jsonStr) as OcrResult;
};
