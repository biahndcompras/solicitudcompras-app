---
title: Product Requirements Document — Portal de Compras BIA
status: review
authority: product
owner: Lady Matute (process owner), Intelia (build)
last_reviewed: 2026-08-12
---

# Product Requirements Document — Portal de Compras BIA

> **Autoridad:** este es el documento autoritativo de producto. Ante discrepancia con otra fuente canónica, este prevalece.
> **Fuentes base:** documento 18 (PRD) + 20 (flujos por rol) + 24 (flujos exhaustivos) + 12 §3 (alcance v2.0 aprobado).
> **Código interno:** COM-1 v2.0 · **Fase 1**.

## Purpose

Digitalizar el ciclo completo de una solicitud de compra en BIA Honduras: desde que **cualquier colaborador** necesita comprar algo, hasta que **selecciona una cotización** y el proceso se cierra con métricas. Sustituye el canal disperso actual (correo, WhatsApp, chats) por uno único, guiado, que produce documentos estandarizados y deja un rastro medible de cada paso.

Tres problemas que resuelve (verificados con Lady Matute, Jefa de Compras):

1. **El requisante no sabe especificar.** "Tazas de cerámica con logo" sin dimensiones, material ni arte → Compras repregunta o el proveedor interpreta.
2. **Las cotizaciones no son comparables.** Caso real de mobiliario: un proveedor cotizó melamina y otro madera con superficie de aluminio; diferencia de 50,000 a 150,000 USD. Sin documento estándar, cada proveedor responde a una pregunta distinta.
3. **El proceso no se mide.** Nadie sabe cuánto tarda una compra ni cuántas terminan en compra. Un desarrollo de empaque de enero llevó +4 meses invisible. Un módulo de tickets del sistema actual se cotizó en +$12,000 y se descartó.

Costo silencioso adicional: se produjeron gorras con el logotipo antiguo por no capturar el arte oficial → justifica el bloqueo duro de producto con marca sin arte.

## Roles

| Rol | Quién es | Volumen | Autenticación |
|---|---|---|---|
| **Solicitante** | Cualquier colaborador de BIA que necesita una compra | Toda la empresa | Solo correo, sin contraseña; cookie de continuidad |
| **Coordinador de compras** | Miembro del equipo de Lady, asignado por categoría | 4 personas | Sesión con credenciales |
| **Administrador** | Lady Matute, dueña del proceso | 1 persona | Sesión con credenciales, rol admin |
| **Agente de IA** | Servicio interno del sistema | — | No aplica |
| **Intelia** | Mantenimiento y evolución | — | Acceso a infraestructura |

**Terminología crítica (ver glossary.md):** "coordinador" = el individuo que gestiona la solicitud (4 personas). "Solicitante" = quien pide. **No** confundir con las 4 categorías de compra del discovery original.

## Functional requirements

Requerimientos numerados (RF-xx), trazables con el backlog (17) y las historias (24/20). Prioridad Debe/Debería.

### Intake y clasificación
| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-01 | El solicitante se identifica con correo, nombre y área, sin crear cuenta | Debe |
| RF-02 | Si el correo ya existe en el histórico, se autocompletan nombre y área, editables | Debería |
| RF-03 | Un correo con dominio no institucional advierte y marca para revisión, sin bloquear | Debería |
| RF-04 | El solicitante captura 5 campos base más el tipo de necesidad | Debe |
| RF-05 | La fecha requerida no admite fechas pasadas | Debe |
| RF-06 | Un plazo menor a 5 días hábiles genera advertencia no bloqueante | Debería |
| RF-07 | El sistema clasifica la solicitud como RFI, RFQ o RFP y determina producto o servicio | Debe |
| RF-08 | El solicitante puede corregir la clasificación; la corrección se registra | Debe |
| RF-09 | Con confianza de clasificación baja (<0.70), las opciones se muestran sin preselección | Debe |
| RF-10 | El formulario se genera dinámicamente desde el catálogo de campos, sin campos en código | Debe |
| RF-11 | El solicitante puede guardar y retomar una solicitud incompleta | Debería |

### Assessment del agente
| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-12 | El agente analiza lo capturado y pide únicamente la información faltante | Debe |
| RF-13 | El agente solo puede pedir campos que existan en el catálogo vigente | Debe |
| RF-14 | El assessment se presenta como formulario, no como conversación obligatoria | Debe |
| RF-15 | Máximo 6 preguntas por assessment (aplicado también en servidor) | Debe |
| RF-16 | Cada pregunta admite "no lo sé" sin bloquear el avance | Debe |
| RF-17 | Existe una alternativa de texto libre que el agente procesa | Debería |
| RF-18 | Si el assessment falla o excede el tiempo, el flujo continúa sin error visible | Debe |

### Generación y distribución del documento
| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-19 | El sistema genera un PDF membretado según el tipo de solicitud | Debe |
| RF-20 | Todo documento lleva un número de referencia único e inmutable | Debe |
| RF-21 | El documento es enviable a un proveedor sin edición manual | Debe |
| RF-22 | Correo 1: al coordinador asignado, con el PDF adjunto | Debe |
| RF-23 | Correo 2: acuse de recibo al solicitante | Debe |
| RF-24 | Si falla la generación del PDF, la solicitud no cambia de estado | Debe |
| RF-25 | Si falla el correo al coordinador, la solicitud avanza pero se marca y alerta | Debe |
| RF-26 | El sistema determina el coordinador según una regla configurable | Debe |

### Cotizaciones y comparativa
| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-27 | El coordinador carga cotizaciones en PDF, Word o imagen | Debe |
| RF-28 | El sistema extrae datos estructurados de cada cotización | Debe |
| RF-29 | Todo dato extraído es editable por el coordinador | Debe |
| RF-30 | Ningún campo numérico admite valor por defecto cero; el dato ausente es nulo | Debe |
| RF-31 | El sistema indica la confianza de extracción por campo | Debería |
| RF-32 | Una cotización ilegible se declara como tal y se ofrece captura manual | Debe |
| RF-33 | El sistema detecta si cada cotización declara el tratamiento de impuestos | Debe |
| RF-34 | El sistema detecta discrepancias de especificación entre proveedores | Debe |
| RF-35 | Las discrepancias se muestran antes que los precios | Debe |
| RF-36 | El sistema genera comparativa en Excel editable, con neto arriba e impuestos desglosados abajo | Debe |
| RF-37 | No se convierte moneda automáticamente | Debe |
| RF-38 | Con una sola cotización, el sistema lo declara y no fuerza un comparativo | Debe |
| RF-39 | El sistema genera pros, contras y una sugerencia razonada | Debe |
| RF-40 | La sugerencia se etiqueta visualmente como generada por el sistema | Debe |

### Decisión y cierre
| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-41 | El coordinador debe escribir una recomendación antes de enviar la comparativa | Debe |
| RF-42 | El envío permanece bloqueado mientras la recomendación esté vacía (bloqueo duro B3) | Debe |
| RF-43 | El solicitante accede a la comparativa por link público, sin sesión | Debe |
| RF-44 | El solicitante selecciona una opción con un clic, previa confirmación | Debe |
| RF-45 | La decisión se registra con marca de tiempo y notifica a Compras (correo 4) | Debe |
| RF-46 | Una comparativa ya decidida se muestra en modo lectura | Debe |
| RF-47 | El solicitante puede indicar que ninguna opción le sirve, sin cerrar con decisión | Debería |
| RF-48 | El link registra sus accesos y admite expiración configurable | Debe |

### Trazabilidad y administración
| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-49 | Toda transición de estado se registra con actor y marca de tiempo | Debe |
| RF-50 | El dashboard muestra la tasa de conversión solicitud → aceptación | Debe |
| RF-51 | El dashboard filtra por día, semana, mes, rango, coordinador y categoría | Debe |
| RF-52 | El dashboard muestra tiempo por etapa | Debe |
| RF-53 | La vista filtrada es exportable a Excel | Debería |
| RF-54 | El administrador gestiona plantillas y campos sin desarrollo | Debe |
| RF-55 | Los cambios de plantilla se versionan; las solicitudes conservan su versión de origen | Debe |
| RF-56 | El administrador gestiona coordinadores, categorías y reglas de asignación | Debe |
| RF-57 | El administrador configura umbrales y destinatarios de alertas | Debe |
| RF-58 | El solicitante consulta el estado de sus solicitudes por correo, sin sesión | Debería |
| RF-59 | Compras pide información **al solicitante** cuando faltan datos que solo él tiene, y la solicitud vuelve a él sin cambiar de estado | Debe |
| RF-60 | El solicitante responde esas preguntas **sin sesión**, desde "mis solicitudes", y su respuesta queda disponible para el coordinador | Debe |
| RF-61 | El ciclo de preguntas se puede repetir sobre la misma solicitud | Debe |
| RF-62 | Si el solicitante no responde en 3 días, Compras recibe un recordatorio | Debe |
| RF-63 | Compras puede cancelar la solicitud en cualquier estado no terminal; las cotizaciones ya cargadas se conservan | Debe |
| RF-64 | El solicitante **no** puede cancelar su solicitud | Debe |
| RF-65 | Cuando el solicitante rechaza todas las opciones, la solicitud vuelve a Compras para evaluación y **no** se cierra | Debe |

## Non-functional requirements

| Categoría | Requerimiento |
|---|---|
| **Rendimiento** | Carga inicial bajo 2 s en conexión promedio. Clasificación <10 s. Assessment <15 s. Extracción por cotización <30 s |
| **Disponibilidad** | El fallo de cualquier función de IA no impide completar el flujo. Degrada funcionalidad, nunca disponibilidad |
| **Adaptabilidad** | Portal del solicitante y vista pública: móvil primero. Panel del coordinador y dashboard: escritorio primero |
| **Accesibilidad** | Contraste mínimo AA (4.5:1 normal, 3:1 grande), navegación por teclado, foco visible, etiquetas asociadas, color nunca única señal |
| **Idioma** | Español de Honduras en toda la interfaz y documentos generados. Un solo registro de tratamiento (voseo/tuteo/neutro) a definir |
| **Moneda** | Lempira (HNL) y dólar (USD) soportados; sin conversión automática |
| **Zona horaria** | Todas las marcas de tiempo en America/Tegucigalpa |
| **Seguridad** | RLS en datos sensibles; archivos por URL firmada con expiración; token de link ≥32 bytes aleatorios; sin indexación por buscadores |
| **Privacidad** | La información de cotizaciones es comercialmente sensible; no se usa para entrenar modelos ni sale del entorno del proyecto |
| **Trazabilidad** | Tabla de eventos de solo escritura; correcciones por evento compensatorio |
| **Mantenibilidad** | Plantillas, campos, catálogos, reglas y umbrales configurables sin despliegue |
| **Navegadores** | Dos últimas versiones de los navegadores de uso mayoritario |

## Business rules

Reglas no negociables, decisión explícita del cliente (fuente: 18/22).

| # | Regla | Origen |
|---|---|---|
| RN-01 | La recomendación final la escribe una persona, no el sistema | "que la IA le haga una sugerencia, pero que sea el coordinador quien al final diga" |
| RN-02 | El agente no crea campos fuera del estándar de Compras | "siempre hay particularidades del negocio que necesito conservar" |
| RN-03 | Un producto con marca no avanza sin arte oficial adjunto | Caso real de gorras con logotipo incorrecto |
| RN-04 | La clasificación no necesita ser infalible; el usuario puede corregirla | "no pasa nada si una RFP se va como RFQ" |
| RN-05 | El solicitante no inicia sesión; la comparativa se comparte por link | Decisión consciente para reducir fricción |
| RN-06 | Nunca se inventan cifras ni se convierten monedas automáticamente | Un dato inventado decide una compra real |
| RN-07 | El sistema no escribe en los sistemas de gestión del cliente | Decisión de arquitectura |
| RN-08 | Producto y servicio tienen la misma calidad de plantilla; ninguno es secundario | Distribución esperada ~50/50 |

## Bloqueos duros

Los únicos tres puntos donde el sistema impide avanzar (todo lo demás advierte y deja continuar). Ninguno depende de la IA.

| # | Bloqueo | Dónde | Verificación |
|---|---|---|---|
| B1 | Campo obligatorio de plantilla vacío | Formulario de plantilla (P4) | Cliente y servidor |
| B2 | Producto con marca sin arte adjunto | Formulario de plantilla (P4) | Cliente y servidor |
| B3 | Recomendación del coordinador vacía | Revisión de comparativa (C4) | Cliente y servidor |

## Edge cases

Los casos límite por rol y paso (EC-xx) se detallan en la fuente 20 (flujos por rol, ~70 casos) y en la 24 (flujos exhaustivos, EC-1.1…EC-18.4 + matriz T-01…T-18). Se resumen los transversales:

| # | Situación | Comportamiento en todo el sistema |
|---|---|---|
| T-01 | Pérdida de conexión | Los datos guardados persisten; se retoma donde quedó |
| T-03 | Edición concurrente | Aviso de que otro usuario edita; última escritura prevalece con registro |
| T-04 | Función de IA caída prolongada | El flujo completo sigue operable de forma manual |
| T-07 | Dato nunca capturado | "no especificado". Nunca vacío ambiguo ni cero |
| T-08 | Error en un evento de trazabilidad | Evento compensatorio. La tabla nunca se actualiza ni borra |
| T-15 | Doble envío de cualquier formulario | Idempotencia en servidor. Nunca duplica registros |

## Out of scope (Fase 1)

| Fuera de alcance | Por qué | Destino |
|---|---|---|
| Memoria histórica de patrones de compra | Pospuesto; la data se guarda desde el día 1 | Mejora futura |
| Integración con el módulo de presupuesto de Finanzas | Requiere coordinación con Finanzas y Tecnología | COM-4 |
| Reportería KPI desde los sistemas actuales | Diferida de esta fase | COM-2 |
| Motor de Plan de Compras del proceso SNOP | Requiere alineación previa | COM-3 |
| Cualquier lectura/escritura sobre el sistema de gestión actual | Decisión de arquitectura: autocontenido | — |
| Aplicación móvil nativa | La web adaptable cubre el caso de uso | — |
| Firma electrónica de documentos | No solicitado | — |
| Órdenes de compra y pagos | El ciclo cierra en la decisión, no en la compra | — |

## Acceptance and success criteria

El producto se considera entregado cuando (fuente 18 §14):

1. Un colaborador sin entrenamiento previo completa una solicitud de principio a fin, sin ayuda de Compras y sin iniciar sesión.
2. El PDF generado es enviable a un proveedor tal cual, sin edición manual.
3. Ninguna solicitud de producto con marca llega a Compras sin el arte adjunto.
4. El coordinador carga cotizaciones en los tres formatos y obtiene una comparativa correcta en los tres casos.
5. La comparativa muestra valor neto e impuestos desglosados, y marca observación cuando el tratamiento fiscal no está declarado.
6. Ninguna comparativa sale al solicitante sin recomendación escrita por el coordinador.
7. El dashboard muestra todos los procesos con su estado real, y la tasa de conversión es consultable por período.
8. El administrador cambia una plantilla y el cambio se refleja sin despliegue.
9. Lady confirma que el flujo corresponde al proceso que ella definió, no a una interpretación distinta.

## Métricas de éxito

| Métrica | Línea base | Meta |
|---|---|---|
| Tasa de conversión solicitud → aceptación de cotización | No medible hoy | Medible desde el día 1; línea base al cierre del piloto |
| Tiempo de ciclo total | No medible hoy | Medible; meta tras el piloto |
| Solicitudes con especificación completa al llegar a Compras | Bajo, sin dato | >90% |
| Solicitudes con marca que llegan sin arte oficial | Ocurre | Cero |
| Cotizaciones con tratamiento fiscal no declarado | Frecuente, sin dato | Detectadas al 100% |
| Precisión del clasificador automático | — | >80% sin corrección del usuario |

## Correos del sistema (nomenclatura vigente)

> **Ampliado de 5 a 8 el 2026-10-03** (RF-59…RF-65), por decisión del cliente en el taller.
> Los correos 6, 7 y 8 cubren el ciclo de preguntas al solicitante. La numeración 1–5 no cambia:
> los registros históricos de `correo_enviado` siguen significando lo mismo.

**5 correos del ciclo** (transición de estado, siempre se envían):

| # | Cuándo | Quién lo recibe |
|---|---|---|
| 1 | Nueva solicitud | coordinador asignado |
| 2 | Acuse de recibo | solicitante |
| 3 | Comparativo listo, con el enlace público | solicitante |
| 4 | Decisión registrada — o devuelta a Compras si ninguna opción le sirvió | coordinador asignado + admin |
| 6 | Se necesita información del solicitante | solicitante |

**1 correo de respuesta** (dispara el solicitante):

| # | Cuándo | Quién lo recibe |
|---|---|---|
| 7 | El solicitante respondió las preguntas | coordinador asignado |

**2 correos de alerta** (configurables, no del ciclo):

| # | Cuándo | Quién lo recibe |
|---|---|---|
| 5 | Solicitud sin movimiento | destinatario de alertas |
| 8 | El solicitante no respondió las preguntas en 3 días | coordinador asignado |

- Los ocho se registran en la bitácora `correo_enviado`.
- El correo 1 **nunca** se envía al solicitante: lleva el PDF de su propia solicitud con precios.
- El correo 8 depende de un programador (cron). Mientras no exista ninguno desplegado, se
  dispara desde el botón "Ejecutar alertas" del panel de administración, que ya existe.

## Stack de PDF y correo (vigente)

- **PDF:** se genera con **pdfme** (`@pdfme/generator`) usando una **plantilla declarativa JSON genérica y reemplazable**. El membrete/estructura vive en configuración (no en código) para poder sustituirla por la oficial de Compras sin recodificar. El documento se persiste en `documento_generado` con versión.
- **Correo transaccional:** se envía con **Resend** (servicio dedicado, dominio propio). Se registra cada envío en la bitácora `correo_enviado` (remitente, destinatario, asunto, estado, intentos, error).
- **Base de datos:** hoy PostgreSQL local vía `pg`; la capa de acceso es abstracta (puerto `Repositorio`) para migrar a **Supabase Cloud** (misma interfaz, adaptador + URL). Ver `docs/references/architecture.md`.

## Temas abiertos (TBD — no bloquean G1)

| # | Tema | Responsable | Efecto |
|---|---|---|---|
| Q1 | Regla de asignación entre los 4 coordinadores | Lady | Configuración, no código |
| Q2 | ¿Los coordinadores ven solicitudes de otros? | Lady | Define RLS |
| Q3 | Umbral de días para alerta de inactividad | Lady | Activa/desactiva alerta 5 |
| Q4 | Dominios de correo aceptados como institucionales | BIA/IT | Validación P1 |
| Q5 | Formato del número de referencia | Lady/Intelia | Generación de referencia |
| Q6 | ¿RFI y RFP recorren el ciclo completo de comparativa? | Producto | Alcance de C3/C4/L1 |
| Q7 | Exenciones/retenciones fiscales a reconocer | Lady | Alcance de validación fiscal |
| Q8 | Tamaño máximo de archivo aceptado | Producto | Carga de adjuntos/cotizaciones |
| Q9 | Registro de tratamiento de la interfaz (voseo/tuteo/neutro) | Producto | UX copy |

## Riesgo asumido de seguridad (documentado)

El solicitante no inicia sesión y la comparativa se comparte por link público → cualquiera con el enlace puede ver precios de proveedores. Decisiones del cliente. Mitigaciones: token ≥32 bytes, expiración configurable, registro de accesos, sin indexación, revocación posible. **Debe quedar aceptado por escrito antes de producción.**

## Plan de entrega

| Sprint | Contenido | Duración |
|---|---|---|
| 0 | Preparación de entorno y base | 3–5 días |
| 1 | Intake, clasificación, estados y trazabilidad | 2 semanas |
| 2 | Assessment, generación de PDF y correos | 2 semanas |
| 3 | Cotizaciones, comparativa y decisión | 2–3 semanas |
| 4 | Dashboard, administración y alertas | 1–2 semanas |
| 5 | Piloto y ajustes con datos reales | 2 semanas |

**Total: 7–10 semanas de desarrollo; 9–12 semanas incluyendo piloto.**
