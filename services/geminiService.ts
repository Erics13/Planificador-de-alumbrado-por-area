import { GoogleGenAI } from "@google/genai";

if (!process.env.API_KEY) {
  // This check is kept in case other AI features are added in the future.
  console.warn("La clave de API de Google AI no está configurada. Las funciones de IA no estarán disponibles.");
}

// The AI instance can be initialized for potential future use.
const ai = process.env.API_KEY ? new GoogleGenAI({ apiKey: process.env.API_KEY }) : null;

// The function for generating luminaria coordinates has been removed from this file.
// The logic is now handled with deterministic geometric calculations on the client-side
// in App.tsx for significantly better performance and reliability.