"use client";

// Badge de semáforo de estado (a tiempo / en riesgo / retrasado) para solicitudes.
import { calcularSemaforo, SEMAFORO_CLASES, SEMAFORO_DOT } from "@/lib/domain/semaforo";

type SemSolicitud = {
  estado: string;
  fechaRequerida?: string;
  fechaCreacion?: string;
};

export function SemParoBadge({ solicitud, compact = false }: { solicitud: SemSolicitud; compact?: boolean }) {
  const s = calcularSemaforo({
    estado: solicitud.estado as Parameters<typeof calcularSemaforo>[0]["estado"],
    fechaRequerida: solicitud.fechaRequerida,
    fechaCreacion: solicitud.fechaCreacion,
  });
  if (s.diasRestantes === null && s.texto === "Cerrada") return null;

  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full border " +
        SEMAFORO_CLASES[s.nivel] +
        (compact ? " px-2 py-0.5 text-[9px] font-bold" : " px-2.5 py-1 text-[10px] font-bold")
      }
      title={s.texto}
    >
      <span className={"w-2 h-2 rounded-full " + SEMAFORO_DOT[s.nivel]} />
      <span className={compact ? "" : "uppercase tracking-wider"}>{s.texto}</span>
    </span>
  );
}