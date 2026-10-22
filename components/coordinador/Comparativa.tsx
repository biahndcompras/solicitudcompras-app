"use client";

import type { Comparativa, SubtipoSolicitud } from "@/lib/domain/types";
import { etiquetaSubtipo, formato } from "@/lib/domain/comparativa";
import { Button, Panel } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";

type CotizacionVista = {
  id: string;
  proveedorNombre: string;
  valorNeto?: number;
  montoIsv?: number;
  valorTotal?: number;
  moneda?: string;
  plazoEntrega?: string;
  formaPago?: string;
  garantia?: string;
  vigenciaOferta?: string;
  impuestosDesglosados?: boolean;
  observacionesFiscales?: string;
};

type ComparativaViewProps = {
  solicitudId: string;
  /** El ítem que se está comparando (4.2.2). Sin esto la tabla de precios flota sin decir de qué. */
  solicitud: { titulo: string; descripcion?: string; subtipo?: SubtipoSolicitud };
  comparativa: Comparativa;
  cotizaciones: CotizacionVista[];
  onContinuar: () => void;
};

export function ComparativaView({ solicitudId, solicitud, comparativa, cotizaciones, onContinuar }: ComparativaViewProps) {
  const hayDiscrepancia = comparativa.discrepanciasDetectadas.length > 0;
  const urlExcel = `/api/solicitudes/${solicitudId}/comparativa/excel`;

  return (
    <Panel
      title="Comparativa"
      subtitle="Moneda original por proveedor. Si no desglosa impuestos: «no especifica» (RN-06)."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={urlExcel}
            className="mono-label inline-flex h-7 items-center gap-2 rounded-sm px-3.5 text-ink shadow-[inset_0_0_0_1px_var(--color-border-hairline)] transition-colors hover:bg-surface-soft"
          >
            <Icon name="download" size={14} />
            Excel
          </a>
          <Button onClick={onContinuar} icon="arrow-up-right">
            Ver recomendación
          </Button>
        </div>
      }
    >
      {/* 4.2.2 — el glosario define la comparativa como "el producto/servicio a la izquierda y
          un proveedor por columna". Sin este bloque, quien la abre ve precios sin saber de qué. */}
      <div className="rounded-sm bg-surface-soft px-4 py-3">
        <p className="eyebrow text-body">{etiquetaSubtipo(solicitud.subtipo)}</p>
        <p className="mt-1 text-body-md text-ink">{solicitud.titulo}</p>
        {solicitud.descripcion ? (
          <p className="mt-1 whitespace-pre-line text-caption text-body">{solicitud.descripcion}</p>
        ) : null}
      </div>

      {hayDiscrepancia ? (
        <div className="rounded-sm px-4 py-3 shadow-[inset_0_0_0_1px_var(--color-text-critical)]">
          <p className="eyebrow text-critical">Observación de especificación</p>
          <p className="mt-1 text-caption text-ink">{comparativa.discrepanciasDetectadas[0]?.explicacion}</p>
        </div>
      ) : null}

      <div className="-mx-6 overflow-x-auto px-6">
        <table className="w-full min-w-[680px] border-collapse">
          <thead>
            <tr className="bg-surface-soft text-left">
              <th scope="col" className="eyebrow px-3 py-3 font-medium text-ink">
                Concepto
              </th>
              {cotizaciones.map((c) => (
                <th key={c.id} scope="col" className="eyebrow px-3 py-3 font-medium text-ink">
                  {c.proveedorNombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              {
                label: "Valor neto",
                render: (c: CotizacionVista) =>
                  c.valorNeto !== undefined ? `${c.moneda ?? "L"} ${formato(c.valorNeto)}` : "no especificado",
              },
              {
                label: "Impuestos (ISV)",
                render: (c: CotizacionVista) =>
                  c.impuestosDesglosados === true && c.montoIsv !== undefined ? (
                    `${c.moneda ?? "L"} ${formato(c.montoIsv)}`
                  ) : (
                    <span className="font-medium text-critical">⚠ no especifica</span>
                  ),
              },
              {
                label: "Total",
                render: (c: CotizacionVista) =>
                  c.valorTotal !== undefined ? `${c.moneda ?? "L"} ${formato(c.valorTotal)}` : "no especificado",
              },
              { label: "Entrega", render: (c: CotizacionVista) => c.plazoEntrega ?? "—" },
              { label: "Forma de pago", render: (c: CotizacionVista) => c.formaPago ?? "no especificado" },
              { label: "Garantía", render: (c: CotizacionVista) => c.garantia ?? "no especificado" },
              { label: "Vigencia", render: (c: CotizacionVista) => c.vigenciaOferta ?? "no especificado" },
            ].map((fila) => (
              <tr key={fila.label} className="border-b border-hairline">
                <td className="px-3 py-3 text-caption font-medium text-ink">{fila.label}</td>
                {cotizaciones.map((c) => (
                  <td key={c.id} className="px-3 py-3 text-caption text-ink">
                    {fila.render(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
