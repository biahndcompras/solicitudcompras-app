import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const r = await fetch("http://localhost:3001/api/ia/assessment", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    titulo: "Pintura epóxica para fachada de almacén",
    descripcion:
      "Necesitamos pintar la fachada de nuestro almacén en San Pedro Sula con pintura epóxica resistente a la intemperie. Superficie exterior de aproximadamente 800 m2.",
    tipo: "RFP",
    subtipo: "mixto",
    categoria: "materia_prima",
    camposCapturados: [],
    catalogo: [],
  }),
});
const j = await r.json();
const plantilla = new Set((j.camposPlantilla ?? []).map((c) => c.campoKey));
console.log(`HTTP ${r.status}`);
console.log(`plantilla (${plantilla.size}): ${[...plantilla].join(", ")}`);
console.log(`preguntas (${j.preguntas?.length ?? 0}):`);
for (const p of j.preguntas ?? []) {
  const enPlantilla = plantilla.has(p.campoKey) ? "  ⚠ DUPLICADO con Información comercial" : "";
  console.log(`  [${p.campoKey}] critica=${p.critica} oblig=${(j.camposPlantilla ?? []).some((c) => c.campoKey === p.campoKey && c.obligatorio)}${enPlantilla}`);
}
console.log(`contexto_investigado: ${JSON.stringify(j.contexto_investigado)}`);
