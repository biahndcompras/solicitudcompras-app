import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { AmbientBackground } from "@/components/ui-ext/AmbientBackground";

// P3-d — El manual del solicitante existía en docs/ pero ninguna pantalla lo enlazaba.
// Se sirve desde el mismo archivo (fuente única) con un render mínimo y seguro: sin HTML
// inyectado, solo nodos React a partir de un subconjunto acotado de Markdown.
export const dynamic = "force-dynamic";

const RUTA = path.join(process.cwd(), "docs", "guias", "manual-solicitante.md");

type Bloque =
  | { t: "h1" | "h2" | "h3"; texto: string }
  | { t: "p"; texto: string; cita: boolean }
  | { t: "ul" | "ol"; items: string[] };

function parsear(md: string): Bloque[] {
  const lineas = md.split(/\r?\n/);
  const bloques: Bloque[] = [];
  let lista: { tipo: "ul" | "ol"; items: string[] } | null = null;
  const cerrarLista = () => {
    if (lista) bloques.push({ t: lista.tipo, items: lista.items });
    lista = null;
  };
  for (const linea of lineas) {
    const l = linea.trim();
    if (!l) {
      cerrarLista();
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(l);
    if (h) {
      cerrarLista();
      bloques.push({ t: `h${h[1].length}` as "h1" | "h2" | "h3", texto: h[2] });
      continue;
    }
    if (l.startsWith(">")) {
      cerrarLista();
      bloques.push({ t: "p", texto: l.replace(/^>\s?/, ""), cita: true });
      continue;
    }
    const ol = /^(\d+)[.)]\s+(.*)$/.exec(l);
    if (ol) {
      if (!lista || lista.tipo !== "ol") {
        cerrarLista();
        lista = { tipo: "ol", items: [] };
      }
      lista.items.push(ol[2]);
      continue;
    }
    const ul = /^[-*]\s+(.*)$/.exec(l);
    if (ul) {
      if (!lista || lista.tipo !== "ul") {
        cerrarLista();
        lista = { tipo: "ul", items: [] };
      }
      lista.items.push(ul[1]);
      continue;
    }
    cerrarLista();
    bloques.push({ t: "p", texto: l, cita: false });
  }
  cerrarLista();
  return bloques;
}

/** Negrita y `código` en línea, sin interpretar HTML. */
function inline(texto: string): React.ReactNode[] {
  const partes = texto.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return partes.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-slate-900">
          {p.slice(2, -2)}
        </strong>
      );
    }
    if (p.startsWith("`") && p.endsWith("`")) {
      return (
        <code key={i} className="font-mono text-[13px] bg-slate-100 text-slate-700 rounded px-1 py-0.5">
          {p.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

export default async function GuiaSolicitantePage() {
  let md = "";
  try {
    md = await readFile(RUTA, "utf8");
  } catch {
    md = "# Manual de uso — Solicitante\n\nLa guía no está disponible en este momento.";
  }
  const bloques = parsear(md);

  return (
    <main className="min-h-screen flex items-start justify-center p-3 md:p-8 relative overflow-x-hidden">
      <AmbientBackground />
      <div className="w-full max-w-[760px] bg-white/70 backdrop-blur-3xl rounded-3xl border border-white shadow-[0_8px_40px_rgb(0,0,0,0.06)] relative z-10 p-5 md:p-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center">
            <span className="text-white text-[11px] font-bold tracking-tighter">BIA</span>
          </div>
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Portal de Compras</span>
            <span className="block text-sm font-medium text-slate-900">Guía del solicitante</span>
          </div>
        </div>

        <article className="space-y-4">
          {bloques.map((b, i) => {
            switch (b.t) {
              case "h1":
                return (
                  <h1 key={i} className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">
                    {inline(b.texto)}
                  </h1>
                );
              case "h2":
                return (
                  <h2 key={i} className="text-lg font-semibold tracking-tight text-slate-900 pt-3 border-t border-slate-100">
                    {inline(b.texto)}
                  </h2>
                );
              case "h3":
                return (
                  <h3 key={i} className="text-base font-semibold text-slate-900">
                    {inline(b.texto)}
                  </h3>
                );
              case "ul":
              case "ol": {
                const Tag = b.t === "ol" ? "ol" : "ul";
                return (
                  <Tag key={i} className="space-y-2 pl-5 text-sm text-slate-700 marker:text-slate-400">
                    {b.items.map((it, j) => (
                      <li key={j} className="leading-relaxed">
                        {inline(it)}
                      </li>
                    ))}
                  </Tag>
                );
              }
              default:
                return (
                  <p
                    key={i}
                    className={
                      "text-sm leading-relaxed " +
                      (b.cita
                        ? "text-slate-600 bg-slate-50 border-l-2 border-sky-300 rounded-r-lg px-4 py-3"
                        : "text-slate-700")
                    }
                  >
                    {inline(b.texto)}
                  </p>
                );
            }
          })}
        </article>

        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center min-h-[44px] px-5 text-sm font-medium text-slate-700 border border-slate-200 rounded-full hover:bg-slate-50"
          >
            Crear una solicitud
          </Link>
          <Link
            href="/mis-solicitudes"
            className="inline-flex items-center justify-center min-h-[44px] px-5 text-sm font-medium text-white bg-slate-900 rounded-full hover:bg-slate-800"
          >
            Ver mis solicitudes
          </Link>
        </div>
      </div>
    </main>
  );
}
