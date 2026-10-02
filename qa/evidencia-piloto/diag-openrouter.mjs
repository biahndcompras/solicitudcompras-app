import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);
const key = env.OPENROUTER_API_KEY;
console.log("key presente:", !!key, key ? `${key.slice(0, 12)}…(${key.length} chars)` : "");
console.log("IA_MODEL:", env.IA_MODEL ?? "(default google/gemini-2.5-flash-lite)");
console.log("IA_MODEL_FALLBACK:", env.IA_MODEL_FALLBACK ?? "(default openai/gpt-4o-mini)");

const modelos = [
  env.IA_MODEL || "google/gemini-2.5-flash-lite",
  env.IA_MODEL_FALLBACK || "openai/gpt-4o-mini",
  "google/gemini-2.5-flash",
  "openai/gpt-4o-mini",
];

for (const model of [...new Set(modelos)]) {
  try {
    const t0 = Date.now();
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": "https://compras.bia.hn",
        "X-Title": "Portal de Compras BIA",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "Responde JSON estricto." },
          { role: "user", content: 'Devolvé {"ok": true}' },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 50,
      }),
    });
    const body = await res.text();
    console.log(`\n=== ${model} → HTTP ${res.status} en ${Date.now() - t0}ms`);
    console.log(body.slice(0, 400));
  } catch (e) {
    console.log(`\n=== ${model} → ERROR ${e.message}`);
  }
}
