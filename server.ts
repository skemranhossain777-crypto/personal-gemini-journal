import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

// Top-Level Request Deserialization (Ordering Guarantee)
app.use(express.json({ limit: '2mb' }));

// Lazy GoogleGenAI client accessor
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not configured');
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// Model Fallback Ladder
const MODEL_FALLBACK_LADDER = [
  'gemini-flash-latest',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
];

/**
 * Standard Helper: generateContentWithFallback
 * Sequentially attempts models across the resilience ladder when encountering recoverable errors
 * (503 UNAVAILABLE, 429 RESOURCE_EXHAUSTED, 404 NOT_FOUND, 500 INTERNAL, high demand, timeouts).
 */
async function generateContentWithFallback(
  contents: any,
  systemInstruction: string,
  temperature = 0.7
): Promise<{ text: string; modelUsed: string }> {
  const ai = getGenAI();
  let lastError: any = null;

  for (const model of MODEL_FALLBACK_LADDER) {
    try {
      console.log(`[Gemini Engine] Attempting generation with model: ${model}`);
      // Guard against hanging calls with an 18-second timeout per model
      const generatePromise = ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          temperature,
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Model ${model} request timed out after 18s`)), 18000)
      );

      const response = await Promise.race([generatePromise, timeoutPromise]);
      const text = response.text || '';
      if (text.trim()) {
        console.log(`[Gemini Engine] Generation successful with model: ${model}`);
        return { text, modelUsed: model };
      }
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || String(err);
      const errStatus = err?.status || err?.error?.status || '';
      const errCode = err?.statusCode || err?.error?.code || '';
      console.warn(
        `[Gemini Engine] Model ${model} encountered error (status: ${errStatus}, code: ${errCode}): ${errMsg.slice(0, 150)}`
      );

      // Check if fatal auth error (e.g. invalid API key)
      const isFatalAuth =
        errMsg.includes('API_KEY_INVALID') ||
        errMsg.includes('apiKey is invalid') ||
        errMsg.includes('API key not valid');

      if (isFatalAuth) {
        throw err;
      }

      // For all recoverable conditions (503, 429, 404, 500, UNAVAILABLE, high demand, timeouts), proceed to next model in ladder
      console.log(`[Gemini Engine] Falling back to next available model in resilience ladder...`);
    }
  }

  throw new Error(`All Gemini models in fallback ladder exhausted. Last error: ${lastError?.message || lastError}`);
}

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Gemini Reflection Endpoint
app.post('/api/gemini/reflect', async (req: Request, res: Response): Promise<void> => {
  try {
    // Defensive Payload Ingestion (Null-Safe Destructuring)
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const {
      prompt = '',
      mode = 'reflect',
      history = [],
      title = 'Journal Reflection',
    } = body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({
        success: false,
        error: 'A non-empty prompt or reflection content is required.',
      });
      return;
    }

    // Indirect Prompt Injection Defense: treat user prompt and history strictly as passive data
    const safeMode = ['reflect', 'summarize', 'brainstorm', 'chat'].includes(mode) ? mode : 'reflect';

    let modeInstruction = '';
    switch (safeMode) {
      case 'summarize':
        modeInstruction = 'You are an insightful summarizer. Provide a crisp, empathetic executive summary of the user’s journal entry, highlighting key emotions, core themes, and actionable lessons.';
        break;
      case 'brainstorm':
        modeInstruction = 'You are a creative brainstorming thought partner. Offer fresh perspectives, alternative approaches, innovative ideas, and actionable next steps based on the user’s reflection.';
        break;
      case 'chat':
        modeInstruction = 'You are a warm, conversational journaling companion. Engage in supportive, thoughtful multi-turn dialogue, asking probing questions that facilitate self-discovery.';
        break;
      case 'reflect':
      default:
        modeInstruction = 'You are a compassionate, thoughtful reflection coach. Help the user unpack their experiences, validate their feelings, identify cognitive patterns, and offer grounded, constructive wisdom.';
        break;
    }

    const systemInstruction = `
${modeInstruction}

IMPORTANT OPERATIONAL RULES:
- Ground your response deeply in the user's thoughts and emotions.
- Structure your response cleanly using markdown (paragraphs, bullet points, headers if helpful).
- At the very end of your response, output a structured metadata block formatted EXACTLY like this:
---METADATA---
SUMMARY: <A concise 1-sentence synopsis of this reflection>
TAGS: <3 to 5 comma-separated tags, e.g., Mindfulness, Career, Growth, Resilience>
---END_METADATA---
Do not include any text after ---END_METADATA---.
`.trim();

    // Prepare contents array for multi-turn conversation context
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    if (Array.isArray(history) && history.length > 0) {
      for (const item of history) {
        if (item && typeof item === 'object' && item.content && (item.role === 'user' || item.role === 'model')) {
          contents.push({
            role: item.role,
            parts: [{ text: String(item.content) }],
          });
        }
      }
    }

    // Add current user prompt
    contents.push({
      role: 'user',
      parts: [{ text: `Entry Title: ${String(title || 'Untitled')}\n\nUser Input:\n${prompt}` }],
    });

    const { text, modelUsed } = await generateContentWithFallback(contents, systemInstruction, 0.7);

    // Parse out the structured metadata if present
    let reply = text;
    let summary = 'A thoughtful reflection on personal experiences and insights.';
    let tags: string[] = ['Reflection', 'Personal Growth'];

    const metadataMatch = text.match(/---METADATA---([\s\S]*?)---END_METADATA---/);
    if (metadataMatch) {
      reply = text.replace(/---METADATA---[\s\S]*?---END_METADATA---/, '').trim();
      const metaContent = metadataMatch[1];
      const summaryMatch = metaContent.match(/SUMMARY:\s*(.+)/i);
      if (summaryMatch && summaryMatch[1]) {
        summary = summaryMatch[1].trim();
      }
      const tagsMatch = metaContent.match(/TAGS:\s*(.+)/i);
      if (tagsMatch && tagsMatch[1]) {
        tags = tagsMatch[1]
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0);
      }
    }

    res.json({
      success: true,
      reply,
      summary,
      tags,
      modelUsed,
    });
  } catch (error: any) {
    console.error('Gemini Reflection API error:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to generate reflection with Gemini',
    });
  }
});

// Vite middleware & Static Serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
