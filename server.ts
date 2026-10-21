import express from "express";
import path from "path";
import { readFileSync } from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = 'gemini-3.8-flash';
const ALLOWED_MODELS = new Set([DEFAULT_MODEL, 'gemini-flash-latest', 'gemini-3.1-flash-lite']);
const ALLOWED_EMAIL_DOMAIN = '@tce.pr.gov.br';
const ALLOWED_EXTRA_EMAILS = new Set(['danilomgontijo@gmail.com']);

const firebaseWebApiKey: string | undefined = (() => {
  try {
    return JSON.parse(readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8')).apiKey;
  } catch {
    return undefined;
  }
})();

// Short-lived cache of validated Firebase ID tokens -> expiry timestamp
const verifiedTokens = new Map<string, number>();
const TOKEN_CACHE_MS = 5 * 60 * 1000;

/**
 * Validates a Firebase ID token through the Identity Toolkit REST API (no admin SDK needed)
 * and checks the account e-mail against the same rule enforced on the sign-up screen.
 */
async function isAuthorizedRequest(authHeader: string | undefined): Promise<boolean> {
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!idToken || !firebaseWebApiKey) return false;

  const cachedUntil = verifiedTokens.get(idToken);
  if (cachedUntil && cachedUntil > Date.now()) return true;

  try {
    const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseWebApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    if (!resp.ok) return false;
    const data: any = await resp.json();
    const email = String(data?.users?.[0]?.email || '').toLowerCase();
    if (!email || (!email.endsWith(ALLOWED_EMAIL_DOMAIN) && !ALLOWED_EXTRA_EMAILS.has(email))) return false;

    verifiedTokens.set(idToken, Date.now() + TOKEN_CACHE_MS);
    return true;
  } catch (err) {
    console.warn('Token verification failed:', err);
    return false;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Same-origin only: the SPA is served by this server, so no CORS is enabled.
  app.use(express.json({ limit: '50mb' }));

  // API route for Gemini
  app.post("/api/gemini", async (req, res) => {
    try {
      if (!(await isAuthorizedRequest(req.headers.authorization))) {
        return res.status(401).json({ error: "Sessão inválida ou usuário não autorizado. Faça login novamente." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is missing." });
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
      const { model, contents, config } = req.body;

      // Model priority list: requested model (if allowed), with fast reliable fallbacks if 503/high-demand occurs
      const requestedModel = ALLOWED_MODELS.has(model) ? model : DEFAULT_MODEL;
      const candidateModels = [
        requestedModel,
        ...(requestedModel !== 'gemini-flash-latest' ? ['gemini-flash-latest'] : []),
        ...(requestedModel !== 'gemini-3.1-flash-lite' ? ['gemini-3.1-flash-lite'] : [])
      ];

      let lastError: any = null;
      let response: any = null;

      for (const m of candidateModels) {
        try {
          response = await ai.models.generateContent({
            model: m,
            contents,
            config
          });
          if (response && response.text !== undefined) {
            break;
          }
        } catch (err: any) {
          lastError = err;
          const errMsg = String(err?.message || '').toLowerCase();
          const isHighDemandOrUnavailable = errMsg.includes('503') || 
                                           errMsg.includes('unavailable') || 
                                           errMsg.includes('high demand') ||
                                           errMsg.includes('overloaded') ||
                                           errMsg.includes('resource_exhausted');
          // If spending cap or non-transient, don't try other models
          if (errMsg.includes('spending cap') || errMsg.includes('ai.studio/spend') || errMsg.includes('spend cap')) {
            throw err;
          }
          if (isHighDemandOrUnavailable) {
            console.warn(`Model ${m} encountered high demand/unavailable. Attempting fallback...`);
            // Brief wait before fallback
            await new Promise(r => setTimeout(r, 800));
            continue;
          }
          // If other error, throw directly
          throw err;
        }
      }

      if (!response && lastError) {
        throw lastError;
      }

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Error in /api/gemini:", error);
      let errorMessage = error?.message || "Erro desconhecido na API do Gemini.";
      let isSpendingCap = false;
      let isRateLimit = false;

      // Extract JSON message if error.message is an ApiError JSON string
      try {
        const jsonMatch = errorMessage.match(/\{[\s\S]*"error"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed?.error?.message) {
            errorMessage = parsed.error.message;
          }
        }
      } catch {
        // retain original errorMessage
      }

      const lowerMsg = errorMessage.toLowerCase();
      if (lowerMsg.includes("spending cap") || lowerMsg.includes("ai.studio/spend") || lowerMsg.includes("spend cap")) {
        isSpendingCap = true;
        errorMessage = "O projeto atingiu o limite mensal de gastos (Spending Cap) da API do Google Gemini. Para continuar utilizando os recursos de IA, acesse https://ai.studio/spend para aumentar ou gerenciar o limite de gastos do seu projeto.";
      } else if (lowerMsg.includes("resource_exhausted") || lowerMsg.includes("rate limit") || lowerMsg.includes("quota exceeded")) {
        isRateLimit = true;
        errorMessage = "Limite temporário de requisições por minuto da API atingido. Aguarde alguns instantes e tente novamente.";
      }

      const statusCode = isSpendingCap || isRateLimit ? 429 : 500;
      res.status(statusCode).json({ 
        error: errorMessage, 
        isSpendingCap,
        isRateLimit,
        spendUrl: isSpendingCap ? "https://ai.studio/spend" : undefined
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
