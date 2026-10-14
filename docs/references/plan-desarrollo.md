---
estado: vigente
actualizado: 2026-10-14
fuente-de-estado: .harness/TASKS.md §4 (los números de acá apuntan ahí)
---

# Plan para terminar el desarrollo

Falta cerrar el desarrollo **antes** de migrar a Supabase. Son ~40 tareas abiertas en
`TASKS.md` §4 más una docena de higiene documental en §6. No todas valen lo mismo: acá están
ordenadas por lo que le pasa a una persona real si no se hace.

**Regla de esta lista:** el estado de cada tarea vive en `TASKS.md` §4. Acá se dice el orden y
el porqué, no el estado.

---

## Grupo 1 — Privacidad y datos mal mostrados

Lo que un usuario sufre hoy, con el sistema usado de verdad.

| # | Qué | Por qué primero |
|---|---|---|
| **4.8.7** | `/mis-solicitudes/[id]` muestra los precios de los proveedores | **La pantalla se abre solo con el correo.** Cualquiera que sepa el correo de un compañero ve los precios de todos sus proveedores. El listado los oculta a propósito (`user-flows.md:181`) y el detalle no: es la misma información con dos criterios. El enlace de decisión al menos pide token; este no |
| **4.10.6** | El Excel de comparativa sale siempre "—" en pros/contras | Bug con test que lo tapa: el fixture usa claves por nombre y el dato real se guarda por id. El coordinador descarga un análisis vacío y cree que no hay análisis |
| **4.10.7** | La fusión de pros y contras descarta los deterministas | Cuando la IA responde, se pierden todos los contras y casi todos los pros que el motor había calculado. RN-06 queda apoyado solo en lo que diga el modelo |
| **4.2.1** | El ahorro potencial en los pros | Revisar: la afirmación original estaba mal (el ahorro sí se reinyecta), pero la fusión es parcial. Se resuelve junto con 4.10.7 |
| **4.7.8** | El enlace público no se revoca al decidir | Al recargarlo vuelve a mostrar las tarjetas. El servidor rechaza con 409, pero la pantalla miente hasta que la persona intenta |

## Grupo 2 — Requisitos aprobados que no están

Comprometido en el PRD y no entregado.

| # | Qué | Nota |
|---|---|---|
| **4.1.1** | Número de referencia real (`{TIPO}-{AÑO}-{SECUENCIA}`) | Hoy el panel usa un `SOL-XXXXXXXX` derivado del id. **El admin y el coordinador muestran referencias distintas** para la misma solicitud |
| **4.4.1 + 4.4.2** | Versionado de plantillas y CRUD de coordinadores (RF-54/55/56) | Es el Sprint 4 residual. El CRUD hoy es solo lectura |
| **4.4.4 + 4.10.9** | Dashboard: distribución por subtipo, tiempo por etapa, rango, y el umbral de "sin decisión" que hoy está cableado en 5 e incluye borradores | RF-51/52 |
| **4.3.1** | Re-cotización del solicitante | Hoy solo el coordinador puede. Decidir si se quiere |
| **4.10.2** | La alerta de inactividad no puede dispararse nunca | La condición es imposible por diseño. La promesa no se cumple |
| **4.5.2 + 4.5.3** | Fecha requerida sin `min` (se aceptan fechas pasadas) y descripción no obligatoria | La doc pide ambas |

## Grupo 3 — Calidad del dato y trazabilidad

| # | Qué |
|---|---|
| **4.10.3 + 4.10.4** | La línea de tiempo renderiza 5 tipos de evento que nunca se insertan, y 4 tipos no tienen descripción. Es un esqueleto, no una auditoría |
| **4.10.5** | `transicionarEstado` del repo no valida la máquina de estados: la validación vive solo en la ruta HTTP |
| **4.7.7** | `clasificacion_corregida` nunca se persiste → la métrica de precisión del clasificador no se puede calcular |
| **4.9.3 + 4.9.4** | El correo 3 sin trazabilidad y el correo 5 sin el coordinador afectado |
| **4.10.8** | La detección determinística de discrepancias está inerte: recibe un objeto vacío |

## Grupo 4 — Administración

| # | Qué |
|---|---|
| **4.4.7 + 4.4.8 + 4.4.9** | Editar un campo de catálogo (hoy el handler borraría atributos), 409 al duplicar, y borrar campos |
| **4.4.10** | Alertas: selección por tipo y preview. Hoy un botón dispara todo y `discrepancia` nunca se emite |
| **4.8.5** | `guardApi` inconsistente en 6 rutas de `/api/admin`. Dependen solo del middleware |
| **4.4.5 + 4.4.6** | Indicador de inactividad en la bandeja y áreas como catálogo |

## Grupo 5 — Bloqueantes de producción (esperan al cliente)

| # | Qué | De quién |
|---|---|---|
| **B1** | Migrar a Supabase Cloud y resetear la contraseña | vos — **decidido esperar** |
| **4.5.1** | OCR en serverless: `/api/convertir` necesita Python y en Vercel no existe → degrada a carga manual | decisión técnica, se puede encarar |
| **B3** | Riesgo del enlace público | ✅ aceptado por Ladi |
| **B4** | Las 6 decisiones del piloto | Ladi — preguntas listas en `docs/product/preguntas-para-ladi.md` |

## Grupo 6 — Higiene (no bloquea, pero hace ruido)

`TASKS.md` §6: 132 casillas sin marcar en specs viejos, 5 `verification.md` que dicen
"implementación prohibida", `003` sin plan ni verificación, `009` sin Spec Kit, credenciales en
4 archivos de QA, y `docs/guias` que usaba "comprador". Además 4.10.13 (los tests ensucian la
base) y 4.7.5 (los tests del assessment dependen de que no haya env cargado).

---

## Orden recomendado

1. **Grupo 1 completo.** Es lo que le pasa a una persona real, y 4.8.7 es lo más grave de toda
   la lista abierta.
2. **Grupo 2**, empezando por 4.1.1 (la referencia inconsistente entre roles se ve en cada
   pantalla) y 4.5.2/4.5.3 (validaciones que la doc ya pide).
3. **Grupo 3**, que es lo que hace que el sistema sea auditable.
4. **Grupo 4**, administración: se usa menos.
5. **Grupo 6** al final o cuando moleste.
6. **Grupo 5**: B1 cuando decidas migrar; 4.5.1 es el único bloqueante técnico que puedo
   resolver sin el cliente.

## Cómo se trabaja cada uno

El proceso que usamos y funcionó — en 010 encontró un crítico que ninguna lista tenía:

1. **Un bloque por vez**, con su commit.
2. **Test que falle primero** contra el código anterior. Un test que nunca se vio fallar no
   demuestra nada.
3. **Verificación en navegador** cuando toca UI, con sesión real.
4. **Actualizar `TASKS.md` en el mismo commit** — la regla que faltaba y por la que el
   documento se desincronizó tres veces.
5. **QA adversarial** antes de cerrar un grupo.

## Lo que NO está en esta lista

- **Migrar los datos:** decidido hacerlo en limpio, después del desarrollo.
- **Cambiar el modelo de IA o el proveedor:** no hay motivo.
- **Reescribir el motor de comparativa:** funciona.
- **RLS:** Q2 dijo que los coordinadores se ven entre ellos; no hace falta.
