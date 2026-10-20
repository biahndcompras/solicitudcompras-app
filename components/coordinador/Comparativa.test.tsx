// 4.2.2 — la comparativa debe decir QUÉ se está comparando. El glosario la define como "el
// producto/servicio a la izquierda y un proveedor por columna"; antes solo mostraba precios.
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComparativaView } from "./Comparativa";
import type { Comparativa } from "@/lib/domain/types";

const comparativa: Comparativa = {
  id: "cmp-1",
  solicitudId: "s1",
  prosContras: {},
  discrepanciasDetectadas: [],
  sugerenciaIA: "",
  fechaGeneracion: "2026-10-19",
};

function montar(solicitud: { titulo: string; descripcion?: string; subtipo?: "producto" | "servicio" | "mixto" }) {
  return render(
    <ComparativaView
      solicitudId="s1"
      solicitud={solicitud}
      comparativa={comparativa}
      cotizaciones={[
        { id: "c1", proveedorNombre: "CostaPrint", valorNeto: 100, moneda: "HNL", valorTotal: 100 },
        { id: "c2", proveedorNombre: "PlayaPromo", valorNeto: 90, moneda: "HNL", valorTotal: 90 },
      ]}
      onContinuar={() => {}}
    />
  );
}

describe("ComparativaView · producto/servicio y detalle (4.2.2)", () => {
  it("muestra el tipo, el título y el detalle del ítem comparado", () => {
    montar({ titulo: "Sombrillas corporativas", descripcion: "500 sombrillas con logo", subtipo: "producto" });
    expect(screen.getByText("Producto")).toBeInTheDocument();
    expect(screen.getByText("Sombrillas corporativas")).toBeInTheDocument();
    expect(screen.getByText("500 sombrillas con logo")).toBeInTheDocument();
  });

  it("etiqueta un servicio como tal", () => {
    montar({ titulo: "Limpieza de oficinas", subtipo: "servicio" });
    expect(screen.getByText("Servicio")).toBeInTheDocument();
  });

  it("sin subtipo no inventa: dice 'No especificado'", () => {
    montar({ titulo: "Algo" });
    expect(screen.getByText("No especificado")).toBeInTheDocument();
  });
});
