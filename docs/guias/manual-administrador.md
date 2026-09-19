# Manual de uso — Administrador
**Portal de Compras BIA · Guía breve para supervisión y trazabilidad**

> Objetivo: dar visibilidad total del ciclo de compras, monitorear SLA y configurar la operación.

## 1. Ingreso
- Entra a `/admin` con tu cuenta de administrador.
- El dashboard resume: tasa de conversión, tiempo promedio, procesos activos, alertas sin decisión,
  **volumen por comprador** y **distribución por tipo** (RFQ/RFI/RFP).

## 2. Seguimiento por fila
- La tabla de procesos muestra por solicitud: referencia, solicitante, comprador, **estado + semáforo**,
  **tiempo de atención** (SLA) y fecha de creación.
- Filtra por **rango** (hoy/semana/mes/todo) y por **comprador**. El dashboard se recalcula.

## 3. Detalle de una solicitud
- Entra a cualquier solicitud para ver la **línea de tiempo (trazabilidad)** completa: creación, cambios de
  estado, cotizaciones, comparativa, envío, decisión.
- El panel derecho muestra: solicitante, comprador, tipo/categoría, **semáforo** y **tiempo de atención**.

### Reasignación (3.4)
- Si un comprador está saturado (ej. Lester), elige otro en **"Reasignar comprador"** y pulsa **Reasignar**.
  El cambio queda registrado en la trazabilidad.

### Cancelación
- Si corresponde, cancela una solicitud no cerrada con **"Cancelar solicitud"** (queda como CANCELADA).

## 4. Configuración
- **Campos (`/admin/campos`)**: catálogo de campos del formulario (activo/inactivo).
- **Configuración (`/admin/configuracion`)**: ISV, expiración de enlaces, formato de referencia,
  umbral de inactividad, dominio institucional.
- **Coordinadores (`/admin/coordinadores`)**: vista de carga por comprador (activas y promedio de días de cierre).

## 5. Alertas
- El botón **"Ejecutar alertas"** escanea solicitudes inactivas según el umbral configurado y envía recordatorios
  al destinatario definido. (Requiere correos habilitados con dominio verificado.)

## 6. Exportar
- **"Exportar"** genera el Excel con las métricas/procesos del rango y filtros actuales para análisis externo.

## Dudas frecuentes
- **¿Qué es el SLA?** El tiempo entre la creación y el cierre (o el acumulado actual de una solicitud abierta).
- **¿Puedo ver todo?** Sí: como administrador ves todas las solicitudes, de todos los compradores.