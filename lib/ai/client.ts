const OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions";

export type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenRouterRequest = {
  model: string;
  messages: OpenRouterMessage[];
  response_format?: { type: "json_object" };
  temperature?: number;
  max_tokens?: number;
};

export type OpenRouterResponse = {
  choices: { message: { content: string } }[];
  error?: { message: string };
};

export function getApiKey(): string | undefined {
  return process.env.OPENROUTER_API_KEY;
}

// Modelo primario: google/gemini-2.5-flash (el "lite" quedó rate-limited upstream de
// Google vía OpenRouter y devolvía HTTP 200 con error embebido — diagnóstico 22-sept).
// Por función se puede afinar con IA_MODEL_ASSESSMENT, IA_MODEL_CLASIFICAR, etc.
export function getModel(funcion?: string): string {
  const porFuncion = funcion
    ? process.env[`IA_MODEL_${funcion.toUpperCase()}` as keyof NodeJS.ProcessEnv]
    : undefined;
  return porFuncion || process.env.IA_MODEL || "google/gemini-2.5-flash";
}

export function getFallbackModel(): string {
  return process.env.IA_MODEL_FALLBACK || "openai/gpt-4o-mini";
}

export function getTimeout(us: string): number {
  const key = `IA_TIMEOUT_${us.toUpperCase()}` as keyof NodeJS.ProcessEnv;
  return Number(process.env[key]) || 15000;
}

export async function llamarOpenRouter(
  body: OpenRouterRequest,
  signal?: AbortSignal
): Promise<OpenRouterResponse> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY no configurada");
  }

  const res = await fetch(OPENROUTER_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://compras.bia.hn",
      "X-Title": "Portal de Compras BIA",
    },
    body: JSON.stringify({
      ...body,
      response_format: body.response_format ?? { type: "json_object" },
      temperature: body.temperature ?? 0.1,
      max_tokens: body.max_tokens ?? 2000,
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenRouter HTTP ${res.status}: ${text}`);
  }

  const data = (await res.json()) as OpenRouterResponse & {
    choices?: { finish_reason?: string; error?: { code?: number; message?: string }; message?: { content?: string } }[];
    error?: { message?: string };
  };
  // OpenRouter devuelve HTTP 200 con el error EMbebido (p. ej. 429 rate-limit del
  // proveedor) en choices[0].error o finish_reason:"error". Sin detectarlo, la app
  // tragaba el fallo y caía al fallback determinístico sin diagnóstico.
  if (data.error?.message) {
    throw new Error(`OpenRouter error: ${data.error.message}`);
  }
  const choice = data.choices?.[0];
  if (choice?.error?.message || choice?.finish_reason === "error") {
    throw new Error(
      `OpenRouter modelo ${body.model} falló: ${choice?.error?.message ?? "finish_reason=error"}`
    );
  }
  return data;
}