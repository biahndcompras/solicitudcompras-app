"use client";

import type { Comparativa } from "@/lib/domain/types";
import { formato } from "@/lib/domain/comparativa";

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
  comparativa: Comparativa;
  cotizaciones: CotizacionVista[];
  onContinuar: () => void;
};

export function ComparativaView({ solicitudId, comparativa, cotizaciones, onContinuar }: ComparativaViewProps) {
  const hayDiscrepancia = comparativa.discrepanciasDetectadas.length > 0;
  const urlExcel = `/api/solicitudes/${solicitudId}/comparativa/excel`;

  return (
    <div className="step-enter">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-slate-900">08 · Comparativa generada</h3>
          <p className="text-xs text-slate-500 mt-1">Moneda original por proveedor. Si no desglosa impuestos: «⚠ no especifica» (RN-06).</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={urlExcel}
            className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-xs px-5 py-3 rounded-full font-medium hover:bg-slate-50 transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>
            Descargar Excel
          </a>
          <button type="button" onClick={onContinuar} className="bg-sky-500 text-white text-xs px-6 py-3 rounded-full font-medium hover:bg-sky-600 transition-all flex items-center gap-2 shadow-lg shadow-sky-500/20">
            Ver recomendación →
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </button>
        </div>
      </div>

      {hayDiscrepancia ? (
        <div className="bg-amber-50 border border-amber-200/70 rounded-2xl p-4 mb-4">
          <div className="text-xs font-semibold text-amber-900 flex items-center gap-2">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 20V9M10 20V4M16 20v-9M22 20H2"/></svg>
            Observación de especificación
          </div>
          <div className="text-xs text-amber-800 mt-1">{comparativa.discrepanciasDetectadas[0]?.explicacion}</div>
        </div>
      ) : null}

      <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200/60 shadow-sm">
        <table className="min-w-full text-left">
          <thead className="bg-slate-50/70">
            <tr className="text-[10px] uppercase tracking-wider text-slate-500">
              <th className="px-5 py-3 font-semibold">Concepto</th>
              {cotizaciones.map((c) => (
                <th key={c.id} className="px-5 py-3 font-semibold">{c.proveedorNombre}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            <tr>
              <td className="px-5 py-4 font-semibold text-slate-900">Valor neto</td>
              {cotizaciones.map((c) => (
                <td key={c.id} className="px-5 py-4">{c.valorNeto !== undefined ? `${c.moneda ?? "L"} ${formato(c.valorNeto)}` : "no especificado"}</td>
              ))}
            </tr>
            <tr>
              <td className="px-5 py-4 font-semibold text-slate-900">Impuestos (ISV)</td>
              {cotizaciones.map((c) => (
                <td key={c.id} className="px-5 py-4">
                  {c.impuestosDesglosados === true && c.montoIsv !== undefined ? (
                    `${c.moneda ?? "L"} ${formato(c.montoIsv)}`
                  ) : (
                    <span className="text-amber-700 font-semibold">⚠ no especifica</span>
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-5 py-4 font-semibold text-slate-900">Total</td>
              {cotizaciones.map((c) => (
                <td key={c.id} className="px-5 py-4 font-semibold">{c.valorTotal !== undefined ? `${c.moneda ?? "L"} ${formato(c.valorTotal)}` : "no especificado"}</td>
              ))}
            </tr>
            <tr>
              <td className="px-5 py-4 font-semibold text-slate-900">Entrega</td>
              {cotizaciones.map((c) => (
                <td key={c.id} className="px-5 py-4">{c.plazoEntrega ?? "—"}</td>
              ))}
            </tr>
            <tr>
              <td className="px-5 py-4 font-semibold text-slate-900">Forma de pago</td>
              {cotizaciones.map((c) => (
                <td key={c.id} className="px-5 py-4">{c.formaPago ?? "no especificado"}</td>
              ))}
            </tr>
            <tr>
              <td className="px-5 py-4 font-semibold text-slate-900">Garantía</td>
              {cotizaciones.map((c) => (
                <td key={c.id} className="px-5 py-4">{c.garantia ?? "no especificado"}</td>
              ))}
            </tr>
            <tr>
              <td className="px-5 py-4 font-semibold text-slate-900">Vigencia</td>
              {cotizaciones.map((c) => (
                <td key={c.id} className="px-5 py-4">{c.vigenciaOferta ?? "no especificado"}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}