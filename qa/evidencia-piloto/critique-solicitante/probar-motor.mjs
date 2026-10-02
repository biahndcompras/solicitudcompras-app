import { readFileSync } from "node:fs";

// Prueba directa del motor de assessment con el ejemplo de pintura epóxica.
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const BASE = "http://localhost:3001";
const MODELOS = ["google/gemini-2.5-flash", "openai/gpt-4o-mini"];

const CATALOGO = [
  { campoKey: "cantidad", label: "Cantidad", ayuda: "Cuánto se necesita", tipoDato: "texto", obligatorio: true, origen: "assessment", seccionPdf: "Detalle", orden: 1, activo: true },
  { campoKey: "color_acabado", label: "Color y acabado", ayuda: "Color o acabado del producto", tipoDato: "texto", obligatorio: true, origen: "assessment", seccionPdf: "Detalle", orden: 2, activo: true },
  { campoKey: "materiales", label: "Materiales", ayuda: "Composición", tipoDato: "texto", obligatorio: false, origen: "assessment", seccionPdf: "Detalle", orden: 3, activo: true },
  { campoKey: "dimensiones", label: "Dimensiones", ayuda: "Medidas", tipoDato: "texto", obligatorio: false, origen: "assessment", seccionPdf: "Detalle", orden: 4, activo: true },
  { campoKey: "resistencia", label: "Resistencia", ayuda: "Nivel de resistencia y durabilidad", tipoDato: "texto", obligatorio: false, origen: "assessment", seccionPdf: "Detalle", orden: 5, activo: true },
  { campoKey: "plazo_entrega", label: "Plazo de entrega", ayuda: "Cuándo se necesita", tipoDato: "fecha", obligatorio: true, origen: "assessment", seccionPdf: "Detalle", orden: 6, activo: true },
  { campoKey: "forma_pago", label: "Forma de pago", ayuda: "Condiciones de pago", tipoDato: "texto", obligatorio: false, origen: "assessment", seccionPdf: "Detalle", orden: 7, activo: true },
  { campoKey: "garantias", label: "Garantías", ayuda: "Garantía del proveedor", tipoDato: "texto", obligatorio: false, origen: "assessment", seccionPdf: "Detalle", orden: 8, activo: true },
  { campoKey: "visita_sitio", label: "Visita a sitio", ayuda: "Si el proveedor debe visitar", tipoDato: "booleano", obligatorio: false, origen: "assessment", seccionPdf: "Detalle", orden: 9, activo: true },
  { campoKey: "lugar_prestacion", label: "Lugar", ayuda: "Dónde se entrega", tipoDato: "texto", obligatorio: false, origen: "assessment", seccionPdf: "Detalle", orden: 10, activo: true },
];

const body = {
  titulo: "Pintura epóxica para fachada de almacén",
  descripcion:
    "Necesitamos pintar la fachada de nuestro almacén en San Pedro Sula con pintura epóxica resistente a la intemperie. Superficie exterior de aproximadamente 800 m2.",
  tipo: "RFQ",
  subtipo: "producto",
  categoria: "materia_prima",
  camposCapturados: [],
  catalogo: CATALOGO,
};

const post = async (model) => {
  const t0 = Date.now();
  const r = await fetch(`${BASE}/api/ia/assessment`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return { ms: Date.now() - t0, status: r.status, j };
};

for (const m of MODELOS) {
  const { ms, status, j } = await post(m);
  const preguntas = j?.preguntas || j?.resultado?.preguntas || [];
  console.log(`\n=== ${m} -> HTTP ${status} en ${ms}ms ===`);
  console.log("  contexto_investigado:", JSON.stringify(j?.contexto_investigado ?? j?.resultado?.contexto_investigado));
  console.log("  NUMERO DE PREGUNTAS:", preguntas.length);
  preguntas.forEach((p, i) => console.log(`   ${i + 1}. [${p.campoKey}] ${p.pregunta}`));
  if (status !== 200) console.log("  cuerpo:", JSON.stringify(j).slice(0, 400));
}

// Repetir 3 veces el modelo por defecto para medir la varianza del conteo
console.log("\n=== VARIANZA (3 corridas, modelo por defecto) ===");
for (let i = 0; i < 3; i++) {
  const { ms, j } = await post(undefined);
  const preguntas = j?.preguntas || j?.resultado?.preguntas || [];
  console.log(`  corrida ${i + 1}: ${preguntas.length} preguntas en ${ms}ms | contexto: ${String(j?.contexto_investigado ?? "").slice(0, 60)}`);
}
