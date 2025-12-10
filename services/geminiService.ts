
import { GoogleGenAI } from "@google/genai";
import { ErrorLog, Environment } from "../types";

// Helper to get API key from Vite or Node environment
const getApiKey = () => {
    // @ts-ignore
    return import.meta.env?.VITE_API_KEY || process.env.VITE_API_KEY || '';
};

// Initialize the client.
const ai = new GoogleGenAI({ apiKey: getApiKey() });

export const analyzeErrorWithGemini = async (error: ErrorLog): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    return "API Key missing. Please create a .env file with VITE_API_KEY=your_key";
  }

  const prompt = `
    You are FixPilot AI, an advanced debugging assistant.
    Analyze the following ${error.environment} environment error and explain it concisely to a developer.
    
    Error Message: ${error.message}
    File: ${error.file}
    Language: ${error.language}
    Stack Trace Summary: ${error.stackTrace.map(f => `${f.functionName} (${f.file}:${f.line})`).join(' -> ')}

    Provide a brief explanation (max 2 sentences) of why this happened.
    If this is a PRODUCTION error, emphasize impact on users or traffic.
    If this is a LOCAL error, emphasize code logic.
    Do not provide code blocks, just the explanation text.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "No explanation generated.";
  } catch (err) {
    console.error("Gemini API Error:", err);
    return "Failed to contact FixPilot AI Cloud. Please check your internet connection.";
  }
};

export const generatePatchWithGemini = async (error: ErrorLog, codeSnippet: string): Promise<string> => {
    if (!getApiKey()) return "API Key missing";

    const prompt = `
      You are FixPilot AI. Your task is to FIX the broken code provided below.
      
      Error: ${error.message}
      File: ${error.file}
      
      BROKEN CODE:
      ${codeSnippet}
      
      INSTRUCTIONS:
      1. Return the FULL CORRECTED FILE content. Do not just return the changed lines.
      2. Fix the specific error described.
      3. Keep the rest of the code exactly as is.
      4. Do NOT output markdown formatting (like \`\`\`javascript). Just output raw code.
      5. Do NOT include any explanations or text before/after the code.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });
        let cleanCode = response.text || "";
        
        // Cleanup: Remove markdown backticks if the model ignores instruction
        cleanCode = cleanCode.replace(/^```[a-z]*\n/i, '').replace(/```$/i, '').trim();
        
        return cleanCode;
    } catch (err) {
        console.error("Gemini Patch Error:", err);
        return "// Error generating fix. Please check logs.";
    }
}

// FOR MVP DEMO ONLY: Simulates the Daemon finding a random error
export const generateSimulatedError = async (env: Environment): Promise<Partial<ErrorLog>> => {
    // If no key, fallback to hardcoded
    if (!getApiKey()) return generateFallbackError(env) as unknown as Partial<ErrorLog>;

    const productionPrompt = `
        Generate a realistic PRODUCTION runtime error JSON for a high-traffic web application.
        Focus on: Database Timeouts, Memory Leaks, 503 Service Unavailable, Rate Limiting, or API Connection Failures.
        
        The JSON should have this structure:
        {
            "message": "String (e.g. ConnectionTimeoutError...)",
            "file": "String (path like src/db/connector.ts)",
            "language": "String (typescript, python, or javascript)",
            "stackTrace": [ { "file": "...", "line": 10, "column": 5, "functionName": "..." } ],
            "codeSnippet": "The broken code corresponding to the error"
        }
    `;

    const localPrompt = `
        Generate a realistic LOCAL DEVELOPMENT runtime error JSON.
        Focus on: Undefined variables, Syntax Errors, React Rendering bugs, Logic errors.
        
        The JSON should have this structure:
        {
            "message": "String (e.g. TypeError...)",
            "file": "String (path)",
            "language": "String (typescript, python, or javascript)",
            "stackTrace": [ { "file": "...", "line": 10, "column": 5, "functionName": "..." } ],
            "codeSnippet": "The broken code corresponding to the error"
        }
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: env === 'PRODUCTION' ? productionPrompt : localPrompt,
            config: { responseMimeType: 'application/json' }
        });
        
        const text = response.text || "{}";
        return JSON.parse(text);
    } catch (e) {
        return generateFallbackError(env) as unknown as Partial<ErrorLog>;
    }
}

const generateFallbackError = (env: Environment) => {
    if (env === 'PRODUCTION') {
        return {
            message: "ConnectionTimeoutError: Database pool connection limit reached",
            file: "src/infrastructure/db.ts",
            language: "typescript" as const,
            stackTrace: [{ file: "src/infrastructure/db.ts", line: 45, column: 12, functionName: "acquireConnection" }],
            codeSnippet: "const pool = new Pool({ max: 10, idleTimeoutMillis: 1000 });\n// High traffic caused pool exhaustion"
        };
    }
    return {
        message: "ReferenceError: process is not defined",
        file: "src/utils/config.ts",
        language: "typescript" as const,
        stackTrace: [{ file: "src/utils/config.ts", line: 5, column: 12, functionName: "getConfig" }],
        codeSnippet: "export const getConfig = () => {\n  return process.env.API_URL;\n}"
    };
};
