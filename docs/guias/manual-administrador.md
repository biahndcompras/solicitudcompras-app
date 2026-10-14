# Manual de uso — Administrador
**Portal de Compras BIA · Guía breve para supervisión y trazabilidad**

> Objetivo: dar visibilidad total del ciclo de compras, monitorear tiempos y configurar la operación.

## 1. Ingreso
- Entre a `/admin` con su cuenta de administrador.
- El dashboard resume: tasa de conversión, tiempo promedio, procesos activos, alertas sin decisión,
  **volumen por coordinador** y **distribución por tipo** (RFQ/RFI/RFP).

## 2. Seguimiento por fila
- La tabla de procesos muestra por solicitud: referencia, solicitante, coordinador, **estado + semáforo**,
  **tiempo de atención** y fecha de creación.
- Filtre por **rango** (hoy/semana/mes/todo) y por **coordinador**. El dashboard se recalcula.

## 3. Detalle de una solicitud
- Entre a cualquier solicitud para ver la **línea de tiempo (trazabilidad)**: cambios de estado,
  cotizaciones, comparativa, envío, decisión y las **preguntas al solicitante** con sus respuestas.
- El panel derecho muestra: solicitante, coordinador, tipo/categoría, **semáforo** y **tiempo de atención**.

### Reasignación
- Si un coordinador está saturado, elija otro en **"Reasignar coordinador"** y confirme.
  El cambio queda registrado en la trazabilidad.

### Cancelación
- Si corresponde, cancele una solicitud no cerrada con **"Cancelar solicitud"** (queda como CANCELADA).
  Las cotizaciones ya cargadas se conservan.

## 4. Configuración
- **Campos (`/admin/campos`)**: catálogo de campos del formulario (activo/inactivo).
- **Configuración (`/admin/configuracion`)**: expiración de enlaces, umbral de inactividad y
  destinatario de alertas.
- **Coordinadores (`/admin/coordinadores`)**: vista de carga por coordinador (activas y promedio de
  días de cierre). **Es solo lectura**: el alta y la edición todavía no están en la interfaz.

## 5. Alertas
- El botón **"Ejecutar alertas"** escanea solicitudes inactivas según el umbral configurado y envía
  recordatorios; además envía el **recordatorio a los solicitantes que no respondieron una pregunta
  en 3 días**.
- También está disponible una ruta de cron (`/api/cron/recordatorios`) para que el recordatorio salga
  solo, sin apretar el botón. Se activa configurando `CRON_SECRET`.

## 6. Exportar
- **"Exportar"** genera el Excel con las métricas/procesos del rango y filtros actuales para análisis externo.

## Dudas frecuentes
- **¿Qué es el tiempo de atención?** El tiempo entre el envío y el cierre (o el acumulado actual de una
  solicitud abierta).
- **¿Puedo ver todo?** Sí: como administrador ve todas las solicitudes, de todos los coordinadores.
- **¿Los coordinadores se ven entre ellos?** Sí.
