# AUDITORÍA UX — Flujo SOLICITANTES
**Portal de Compras BIA · `http://localhost:3001` · código local**
Fecha: 2026-09-26 · Auditor: agente externo (solo lectura, sin escrituras en `app/**`, `components/**`, `lib/**`)
Alcance: `/`, `/solicitud/nueva`, `/mis-solicitudes`, `/mis-solicitudes/[id]`, `/comparativa/[token]`

**Cómo leer este informe.** Cada hallazgo lleva `[MEDIDO]` (observado en el navegador o leído en el código, con
`archivo:línea` o cifra) o `[INFERIDO]` (interpretación mía a partir de lo medido). No hay hallazgos inventados:
todo lo que sigue sale de `metricas.json`, `metricas-pase2.json`, `metricas-pase3.json`, `metricas-pase4.json`,
`consola.json`, `textos.txt` de esta misma carpeta, o de lectura directa del código.

---

## 1. VEREDICTO SOBRE LA QUEJA DEL WIZARD EN MÓVIL

### Se confirma, y el problema real es peor y distinto al reportado

**Lo que se confirma:** el sidebar de progreso se convierte en un bloque superior que se come la pantalla, y el
contenedor de altura fija con `overflow-hidden` recorta el paso activo en vez de dejarlo crecer.

**Lo que se corrige en la hipótesis:** la línea conectora del rail **no está rota**. `[MEDIDO]` El pseudo-elemento
`::before` es idéntico en escritorio y en móvil: `width: 2px; height: 164px; margin-left: 11px`
(`metricas.json` → `D-02-captura.rail` == `M-02-captura.rail`). Los `<li>` se apilan verticalmente en ambos
layouts (`aside` `flex-direction: column` en los dos casos), así que la línea vertical atraviesa correctamente los
círculos. No hay "línea horizontal atravesando el encabezado". El rail no es el problema.

**Lo que sí es el problema, y es peor:** no es que el encabezado se vea feo. Es que **el header de progreso se
come la pantalla y el contenido del paso activo queda dentro de una ventana de 179 px, mientras el botón
primario queda físicamente recortado por el `overflow-hidden` del contenedor.**

### 1.1 Reparto de altura medido (el dato central)

`components/solicitante/SolicitanteWizard.tsx:45` — contenedor
`h-[90vh] md:h-[80vh] min-h-[650px] max-h-[850px] overflow-hidden flex flex-col md:flex-row`
`components/solicitante/SolicitanteWizard.tsx:47` — `<aside>` `md:w-[280px] ... shrink-0 overflow-hidden`

| Viewport | Alto contenedor | Alto `aside` (header) | **% pantalla** | Alto `section` (form) | **% pantalla** | `section.clientHeight` | Contenido `scrollHeight` | CTA primario |
|---|---|---|---|---|---|---|---|---|
| 1440×900 | 718 px | 718 px (sidebar lateral) | — | 718 px | 80 % | 718 px | 1.822 px (paso 4) | +989 px bajo el fold |
| **390×844** | 760 px | **486 px** | **64 %** | **272 px** | **36 %** | **272 px** | 2.625 px (paso 4) | **+1.909 px, 83 px recortados** |
| **360×740** | 666 px | **486 px** | **73 %** | **179 px** | **27 %** | **179 px** | 3.636 px (paso 4) | **+2.796 px, 91 px recortados** |
| **360×333** (teclado) | — | **486 px** | **146 %** | **163 px** | — | **163 px** | 3.636 px | +3.182 px |

Fuente: `metricas-pase4.json` → `P4-360x740-reparto`, `P4-390x844-reparto`, `S-05-teclado-virtual-360`.

`[MEDIDO]` **El "Continuar" del paso 2 está recortado, no solo debajo del fold:**
```
P4-360x740-sin-scroll: mainBottom 735 · ctaTop 786 · ctaBottom 826
                      ctaRecortadoPorElContenedor: true · pxDelCtaCortados: 91
P4-390x844-sin-scroll: mainBottom 834 · ctaTop 876 · ctaBottom 916
                      ctaRecortadoPorElContenedor: true · pxDelCtaCortados: 83
```
Es alcanzable, pero solo **después de hacer scroll dentro de una ventana de 179 px**: `sectionMaxScroll 562 px`
para 179 px de ventana. En la práctica el usuario ve 179 px de un formulario de 741 px y tiene que descubrir que
dentro de ese rectángulo hay un scroll invisible. `contenedoresScrollables` no reporta scrollbar porque la clase
`no-scrollbar` (`:146`) lo oculta. **`[INFERIDO]`** No hay ninguna pista visual de que el contenido continues:
no hay barra, no hay degradado, no hay flecha, no hay paso "2 de 4" arriba.

### 1.2 El hallazgo peor que el reportado: la IA es invisible en móvil

`components/solicitante/SolicitanteWizard.tsx:292` — la tarjeta del veredicto de la IA
(`bg-gradient-to-br from-white to-sky-50/50 ... **overflow-hidden**`)

`[MEDIDO]` Contenido real vs. contenido renderizado de esa tarjeta:

| Viewport | `scrollHeight` | `clientHeight` | **% visible** |
|---|---|---|---|
| 1440×900 | 271 px | 211 px | 78 % |
| 390×844 | 336 px | **56 px** | **17 %** |
| 360×740 | 368 px | **56 px** | **15 %** |

Fuente: `metricas.json` → `D-03-clasificacion.recortesOverflowHidden`,
`metricas-pase4.json` → `P4-390x844-paso3-cta.alturaTarjetaIA`, `P4-360x740-paso3-cta.alturaTarjetaIA`.

**Consecuencia medida, no teórica:** en `M-03-clasificacion.png` y `S-03-clasificacion.png` el usuario ve el
encabezado, y luego **directamente** las tarjetas de RFQ / RFI / RFP. Desaparecen por completo:
- el `<h3>` "Esto parece una **RFQ**" (`:315-321`)
- el nivel de confianza "94% confianza" / "Sugerencia IA" (`:300-308`)
- la explicación "Ya sabés exactamente qué necesitás — solo nos falta cotizar el precio…" (`:331-337`)
- la línea "Razón: …" (`:339`)

El sistema pide **"Confirmar clasificación"** sobre una clasificación cuya justificación no se renderiza. El
85 % del valor de la IA — que es la razón por la que esa pantalla existe — se pierde.

### 1.3 El resto de la hypothesis, punto por punto

| Sub-hipótesis del encargo | Veredicto | Evidencia |
|---|---|---|
| El `aside` se apila arriba en móvil | **CONFIRMADO** | `M-02-captura.aside`: 292×486 px, `flexDirection: column`, 64 % del alto en 390, 73 % en 360 |
| La línea del rail queda horizontal | **DESCARTADO** | `rail` idéntico en escritorio y móvil: `2px × 164px @ ml-[11px]`. Los `<li>` siguen verticales. No hay línea horizontal |
| `space-y-7` + "Progreso de la solicitud" comen alto | **CONFIRMADO como contribuyente, no como causa** | Los 4 `<li>` miden 20 px c/u con 48 px de separación; más `h3` (11px/24px de alto) + tarjeta "Estado actual" + 2 botones de 39 px + `p-6`/`p-8` + `mb-8`/`mb-12` = 486 px. Es lo que produce los 486 px, pero el problema de fondo es que ese bloque existe en absoluto en `< 768px` |
| `min-h-[650px]` + `overflow-hidden` recortan el paso activo | **CONFIRMADO** | `pxDelCtaCortados: 91` (360) / `83` (390); `section.clientHeight 179` vs `scrollHeight 3636` |
| `PASOS_SIDEBAR` (4) vs 5 pasos HTML: ¿el assessment aparece como paso? | **CONFIRMADO, y el mapa miente en 2 de 5 pantallas** | ver §1.4 |
| No hay otro indicador de progreso | **CONFIRMADO — `Stepper.tsx` es código muerto** | ver §1.5 |

### 1.4 El mapa de progreso no corresponde a las pantallas (verificado en los 5 pasos)

`SolicitanteWizard.tsx:36-40` — `p = paso <= 2 ? 1 : paso === 3 ? 2 : paso === 4 ? 3 : 4`

`[MEDIDO]` Recorrido real, 5 pantallas HTML (`h2` capturado) vs. etiqueta activa del rail:

| Pantalla real | `h2` capturado | Rail `[ACTIVO]` | ¿Coincide? |
|---|---|---|---|
| 1 de 5 | `¿Qué necesitás?` | "Captura Inicial" | parcial — el paso 1 real (identidad, correo/nombre/área) **no existe en el wizard**, vive en `/` |
| 2 de 5 | `Clasificación de tu solicitud` | "Clasificación" | sí |
| 3 de 5 | `Detalles para cotizar` | "Detalles técnicos" | sí en el nombre, **pero esta pantalla contiene 4 cosas distintas**: resumen, toggle branding, dropzone de logo, campos de plantilla, **y las preguntas del assessment** (`:500-610`) |
| 4 de 5 | `Tu solicitud está lista` | "Documento" | sí |
| 5 de 5 | `Tu solicitud fue enviada` | **"Documento"** | **NO** — en la pantalla de confirmación el rail dice "Documento" |

Fuente: `metricas-pase4.json` → `mapaSidebar`; `metricas.json` → `h2` de D-02..D-06; `Mapa verificado en P4`.

**Sobre "¿el assessment IA aparece como paso o está invisible?":** no aparece como paso. `[MEDIDO]` La misma
pantalla "Detalles técnicos" aloja `Información comercial (N)` (`:500-545`) y
`El asistente necesita estos detalles (N)` (`:546-610`) como dos listas apiladas dentro de un solo scroll, más el
toggle de branding y la dropzone. El usuario no puede distinguir "me están preguntando cosas" de "estoy llenando
campos técnicos". Y la línea 39 del archivo de comentarios del propio código lo admite
(`// Mapeo html step (2..6) -> sidebar progress (1..4)`): es un mapeo forzado.

`[MEDIDO]` **Nondeterminismo que agrava esto:** la IA devolvió **6** campos en la corrida de escritorio y **4** en
la de 390×844 para la misma entrada (`D-04b-carga-IA.preguntas: 6` vs `M-04b-carga-IA.preguntas: 4`; 13 vs 9
`input`s en pantalla). El scroll requerido para llegar al CTA varió entre 989 px (escritorio), 1.909 px (390) y
2.796 px (360). **`[INFERIDO]`** El solicitante no puede estimar cuánto falta, y el equipo no puede reproducir un
reporte de bug de "me pide demasiados datos" porque el número cambia.

### 1.5 `components/ui-ext/Stepper.tsx` — confirmado como código muerto

`[MEDIDO]` `grep -rn "Stepper" app/ components/ lib/ hooks/`: **0 usos**. Las únicas coincidencias en todo el repo
están en `specs/001-frontend-prototype/spec.md:38`, `specs/001-frontend-prototype/plan.md:68`,
`specs/001-frontend-prototype/tasks.md:33`, `specs/003-design-enterprise/tasks.md:15` y
`docs/product/user-flows.md:287`. Ningún `.tsx` de la aplicación lo importa.

**Y sí, hay otro indicador de progreso — pero es peor que inútil:** el rail del `<aside>`, que **no es navegable**.
`[MEDIDO]` Los `<li>` del rail (`:65`) no son `<button>`, no tienen `onClick`, no tienen `tabindex` y no aparecen
en la lista de tabulación (ver `K-02-foco-wizard-paso2`: los primeros 3 tabuladores son `NEXTJS-PORTAL`,
"Guardar borrador", "Cancelar y descartar" — el rail no aparece). El hook **sí** exporta `irA` (`:280-284`) con
protección de `maxAlcanzado`, pero `SolicitanteWizard` **nunca lo destructura** (`:22`). El usuario no puede saltar
atrás por el progreso, solo con el botón "Atrás" de cada paso — y **el paso 2 no tiene "Atrás"** (`:252-258`, solo
el `mt-auto` con "Continuar"). `docs/product/user-flows.md:287` promete "pasos navegables (solo hacia pasos ya
alcanzados)": **no está implementado en ninguna parte.**

### 1.6 Simulación de teclado virtual — con su salvedad declarada

`[MEDIDO, conLimitación]` **No medí un teclado real de iOS.** Reduje el viewport con
`page.setViewportSize({360, 333})` (≈45 % de 740, el alto típico que deja un teclado de iPhone SE). Es un
**proxy**, no una medición de Safari real: iOS no reduce `innerHeight`, hace scroll del documento. Lo que sí es
medido y sólido es que **el layout no tiene ningún margen de supervivencia**:

- `aside` = 486 px = **146 % del viewport visible** (`S-05-teclado-virtual-360.aside.pctAltoViewport: 146`)
- "Guardar borrador" y "Cancelar y descartar" quedan **fuera de pantalla** (`cortados: [{BUTTON,"Guardar borrador",top:425},{BUTTON,"Cancelar y descartar",top:471}]` con viewport 333)
- La ventana de contenido cae de 179 px a **163 px** (`section.clientHeight 163`)
- El único input del paso visible mide `top: 573, bottom: 574` (1 px) — es el `sr-only` del file input

Evidencia visual: `S-05-teclado-virtual-360.png` — el 100 % del área visible es el encabezado de progreso; lo único
del formulario es el texto del dropzone "Subir arte o logo oficial".

`[INFERIDO]` Con un teclado abierto, el solicitante no ve el campo que está escribiendo, no ve el CTA, y no puede
guardar el borrador. El flujo es intr operable por teclado en un teléfono.

### 1.7 Lo que NO está roto (para que el fix no lo rompa)

- **No hay scroll horizontal en ninguna pantalla.** `[MEDIDO]` `overflowXDoc: false` y
  `scrollWidthDoc == innerWidth` en los 11 estados de wizard medidos (390 y 360), en `/mis-solicitudes`, en el
  detalle y en `/comparativa`. Las 3 movilizaciones que rompen la pantalla de lista (§7, P1-b) son **aplastamiento
  vertical**, no desborde horizontal.
- **El doble envío está bien protegido.** `[MEDIDO]` 4 disparos consecutivos sobre "Enviar solicitud" con
  `b.click()` vía `evaluate` (para saltar el bloqueo de `disabled` de Playwright) →
  `P4-doble-envio.postsACrearSolicitud: 1`. El guard `disabled={envio.estado === "enviando"}` (`:784`) funciona.
- **La carga del logo es invisible pero no se rompe.** `[MEDIDO]` 4 tabuladores, el primero es el portal de
  Next.js, luego "Guardar borrador" y "Cancelar y descartar" — es decir, **los botones de rescate del
  borrador están en el DOM antes del formulario**, que es exactamente lo contrario de lo que un usuario de
  teclado espera (debería ser: saltar al contenido → llenar → CTA → acciones secundarias).

---

## 2. HEURÍSTICAS DE NIELSEN (10 × 0-4)

> Nota sobre la #10: **sí existe** `docs/guias/manual-solicitante.md` (35 líneas, 4 secciones). Es un buen
> documento —corto, sin jerga, con el voseo correcto— y por eso puntúa más alto. Pero **no es alcanzable desde la
> aplicación**: no hay ningún enlace a la guía en `/`, ni en el wizard, ni en `/mis-solicitudes`, ni en la vista
> pública. `[MEDIDO]` `grep` sobre el `innerText` de las 6 pantallas: cero menciones a "ayuda", "guía",
> "manual" o "?".

| # | Heurística | Nota | Evidencia del fallo |
|---|---|---|---|
| 1 | **Visibilidad del estado del sistema** | **1/4** | El único indicador es el chip "Estado actual: Borrador activo" (`:99-107`), que dice lo obvio y nada del estado real. El "Guardado" no sobrevive a la recarga: `borradoAt` es `useState` (`hooks/useSolicitudWizard.ts:91`), nunca se rehidrata → `K-07: muestraBorradorGuardado: false, botonGuardarTexto: "Guardar borrador"` cuando el borrador **sí** está en localStorage. Cero `aria-live` en el wizard (`:K-03.ariaLive: []`) |
| 2 | **Correspondencia con el mundo real** | **3/4** | Es lo más fuerte del flujo. "Guardar borrador", "Cancelar y descartar", "¿Lleva marca o branding?", "No lo sé", "Generar documento", "Ver mis solicitudes". El único subrayamiento: la IA inventa vocabulario de mercado ("RFI/RFQ/RFP", `Solicitud de Información/Cotización/Propuesta`) que nadie explica antes de usarlo, y la vista pública dice "HNL 98.9" vs "USD 31.5" sin conversión |
| 3 | **Control y libertad del usuario** | **1/4** | El rail no es navegable (§1.5). El paso 2 no tiene "Atrás" (`:252-258`). La confirmación (paso 6) **no tiene ninguna salida** salvo "Ver mis solicitudes" (`h: 16 px` de zona táctil) — no se puede deshacer el envío, no se puede editar, no se puede cancelar. `anterior()` (`:276-278`) en paso 6 llevaría a 5, pero no se renderiza ningún botón |
| 4 | **Consistencia y estándares** | **2/4** | Dos patrones distintos de progreso conviven: `TrackerEtapas` con emoji (`📝🧾⚖️🗳️✅`, `TrackerEtapas.tsx:8-12`) y el rail del wizard con check SVG. El rail usa `space-y-7` (48 px) como ritmo y el contenido usa `space-y-3/4/5`. El botón de "descartar" (destructivo, `:132`) es visualmente hermano de "Guardar borrador" (`:115`): mismo ancho, misma altura, mismo radio, solo cambia el color a rose. En la vista pública el botón destructivo "Ninguna me sirve" (`:156`) es un `outline` neutro al lado de CTAs `bg-slate-900` |
| 5 | **Prevención de errores** | **1/4** | Ver **P0-1** (dead-end del campo Área) y **P0-2** (recorte del CTA). Validación silenciosa: "Continuar" `disabled` sin un solo mensaje de campo (`D-02b: disabled: true`, y `hooks/useSolicitudWizard.ts:299` exige 4 campos). El selector de "Tipo de necesidad" tiene 7 opciones (medido en `lib/domain/categorias.ts`) y ninguna tiene texto de ayuda. `input[aria-invalid]` ausente en el error de correo (`E-01.inputAriaInvalid: null`) |
| 6 | **Reconocer más que recordar** | **2/4** | El resumen del paso 5 (`:649-742`) es excelente: muestra todo lo capturado. Pero en el paso 4 el bloque de recap (`:454-457`) usa `line-clamp-2` y trunca la descripción a 2 líneas — y `[MEDIDO]` el texto que el usuario escribió sí está completo en la DB y en el resumen, pero aquí se oculta. El `Placeholder` de "Descripción breve" es `"Añadí un poco más de contexto..."`, que no dice qué información espera Compras |
| 7 | **Flexibilidad y eficiencia de uso** | **1/4** | `~40 solicitudes/mes` y **el solicitante frecuente tiene que repetir 8 campos a mano cada vez**: correo, nombre, área, título, categoría, producto/servicio, fecha, descripción. Ninguno se autocompleta desde la solicitud anterior. `nombre` y `area` vienen por query param desde `/` (`:24-33`) y se vacían en cada arranque. La sesión se "recuerda" con una cookie de 30 días (`lib/cookie.ts:20`) que **solo guarda el email** (`:32-34`) |
| 8 | **Estética y diseño minimalista** | **1/4** | En móvil el 73 % de la pantalla es cromo de navegación y el 27 % es contenido (`P4-360x740-reparto`). `[MEDIDO]` 41 elementos con texto < 12 px en el paso 2, incluidos 5 a 10 px y 3 a 11 px; el tracker compacto usa **`text-[8px]`** (`TrackerEtapas.tsx:46`) y el completo **`text-[9px]`** (`:83`). `H-04` genera campos que el usuario tiene queBORRAR para poder avanzar: `document.body.innerText` de `E-06` incluye `"XXXX"` |
| 9 | **Recuperar de errores** | **1/4** | Ver **P0-4**: la IA que falla no deja rastro. "Failed to fetch" en crudo al enviar (`E-06.alerta`). Sin reintento ni estado de "reintentando". El `catch` del assessment (`hooks/useSolicitudWizard.ts:208-210`) marca `assessmentListo: true` con 0 preguntas: **fallo silencioso con appearance de éxito** |
| 10 | **Ayuda y documentación** | **2/4** | `manual-solicitante.md` existe y es bueno, pero **inalcanzable desde el producto**. Además **contradice la reality**: dice "Guarda el PDF de tu solicitud si la necesitas (disponible tras confirmar el envío)" (§4) — la UI sí lo ofrece (`:829-846`), pero la guía no menciona en ningún punto que exista un enlace público de comparación sin login, ni qué hacer si ese correo se pierde (§3 dice "recibirás un correo con el enlace" y nada más) |

### **TOTAL: 15 / 40**

Modo Operate: la #10 **sí se puede puntuar con observación directa** (leí la guía, la contrasté con la UI y la
navegué entera), aunque el predictor es bajo porque el usuario nunca la encuentra sin un enlace externo.

---

## 3. CARGA COGNITIVA — checklist de 8 ítems

| # | Ítem | Estado | Evidencia medida |
|---|---|---|---|
| 1 | ¿Cuántas decisiones debo tomar en total? | ⚠️ MEDIA | 4 bloques de decisión, uno de ellos **>4 opciones**: "Tipo de necesidad" = **7** categorías (`lib/domain/categorias.ts`, sin texto de ayuda); "¿A qué comprador?" = **4** coordinadores (`M-05b.n: 4`) sin explicar qué pasa si eliges mal; tipo = 3; producto/servicio = 2 |
| 2 | ¿Cuántas piezas de información debo recordar de una pantalla a otra? | ❌ FALLA | El paso 4 pide **4-6 respuestas del assessment + campos de plantilla** sin resumen navegable, en un scroll de 3.636 px. El único recap (`line-clamp-2`, `:456`) está truncado. El usuario no puede ver "lo que ya contesté" sin volver arriba |
| 3 | ¿Cuántas piezas de información debo masuk (recordar/ingresar) de memoria? | ❌ FALLA | 8 campos manuales + 4-6 respuestas = 12-14 数据 points, en 3 pantallas, sin autocOMPLETADO. "Área" además se muestra pero **no se puede editar** |
| 4 | ¿Qué hace el sistema por mí? | ❌ FALLA | Hace mucho y no lo dice: clasifica RFI/RFQ/RFP, genera las preguntas, preselecciona comprador, genera PDF, envía correo con enlace público. La UI solo lo explica *a posteriori* ("Clasificación Asignada", `:698`). El chip "Borrador activo" no informa nada del proceso |
| 5 | ¿Cuántas opciones de salida del sistema hay? | ⚠️ MEDIA | 3 ("Guardar borrador", "Cancelar y descartar", "Atrás"), pero **"Atrás" falta en el paso 2** (`:252-258`) y en la confirmación. Y el destructivo "Cancelar y descartar" tiene el mismo peso visual que el salvavidas "Guardar borrador" |
| 6 | ¿Puedo volver atrás? | ❌ FALLA | Rail no navegable (§1.5). "Atrás" solo en pasos 3-5. Tras el envío: 0 salidas |
| 7 | ¿Sé en qué paso voy y cuánto falta? | ❌ FALLA | 4 etiquetas para 5 pantallas; en la confirmación el rail dice "Documento" (§1.4). Sin "Paso 3 de 5". El avance es invisible salvo por el scroll |
| 8 | ¿Puedo ver los errores y corregirlos? | ❌ FALLA | Botones `disabled` sin mensaje (`:254`, `:614`); `aria-invalid` ausente; fallo de IA indistinguible de "no hay nada que preguntar" (**P0-4**); "Failed to fetch" (**P1-a**) |

**Resultado: 7 de 8 ítems fallan. 2 en amarillo. 0 en verde.**
**Puntos de decisión con más de 4 opciones visibles: 1** — "Tipo de necesidad" (7 categorías, `:218-223`).
En el límite exacto: "¿A qué comprador?" (4, `:751-770`).

---

## 4. RECORRIDO EMOCIONAL Y MOMENTOS DE ALTA

Escribo esto desde la posición de un solicitante de Trade Marketing, teléfono en la mano, 15 minutos, sin
capacitación previa.

| Momento | Emoción | Qué la provoca | Qué la arruina |
|---|---|---|---|
| **Entrada a `/`** | Curiosidad tranquila | "Nueva solicitud de cotización" / "Ingresá tus datos básicos para comenzar. **Sin contraseñas.**" (`app/page.tsx:65`). La última frase es una genial decisión de producto: elimina el miedo de entrada. Nada la arruina aquí. Es la mejor pantalla del flujo | — |
| **Al ver el wizard por 1ª vez en el teléfono** | **Confusión** | Aparece primero un bloque azul de 486 px con "PROGRESO DE LA SOLICITUD / Captura Inicial / Clasificación / Detalles técnicos / Documento / ESTADO ACTUAL / Borrador activo / Guardar borrador / Cancelar y descartar". **Antes de ver una sola casilla de la solicitud.** `[MEDIDO]` La pregunta "¿qué necesito?" (el `h2`) aparece en y≈1360 de un fullPage de 2.532 px | El usuario no sabe si ya empezó, si esto es un formulario, o si tiene que tocar algo del bloque azul |
| **Escribiendo título y categoría** | Curiosidad | Los `placeholder` son buenos: "Ej. Sombrillas brandeadas — activación playa", "Añadí un poco más de contexto…" | Se le oculta el `select` de categoría y las 3 opciones producto/servicio **por debajo del borde** (`S-02-captura`: label en y=757, el `select` en y=779 con viewport 740). Siente que la pantalla "no acaba" |
| **Al tocar "Continuar"** | Incertidumbre | El loader del assessment tiene `role="status" aria-live="polite"` (`:401`) y dice "Preparando preguntas del asistente…" / "Analizando tu solicitud para preguntar lo que los proveedores necesitan" | pero no hay `%`, no hay ETA, no hay "esto toma ~20 s". `[MEDIDO]` La llamada real tardó entre 20 y 60 s |
| **Al aparecer la clasificación** | **Decepción / enojo** | — | `[MEDIDO]` El veredicto de la IA, su confianza, su explicación y su "Razón:" **no se renderizan** (56 px de 336-368 px = 15-17 %). El usuario ve 3 tarjetas de opción y ninguna luz de por qué una está marcada. No hay "momento de confianza con la IA" — hay un momento de *corte* |
| **Al confirmar y caer en el assessment** | **Agotamiento** | Las sugerencias seleccionables son buenas ("Cuero sintético", "TPU", "PVC", "Entrenamiento", "15 días hábiles"…) y el "No lo sé" es un alivio honesto | `[MEDIDO]` 2.796 px de scroll en un teléfono de 740 px, con el 73 % de la pantalla en cromo. Ningún indicador de "voy por el 3 de 6". El campo obligatorio del logo (`:496` "**Obligatorio**") aparece después de 4-6 preguntas, no al principio |
| **Al ver el resumen (paso 5)** | Satisfacción | La tarjeta con "Referencia Única", semáforo, tipo de necesidad, fecha, clasificación asignada, y el detalle de cada respuesta incluyendo "(no lo sé)" es **lo mejor diseñado del flujo**. En escritorio cabe sin scroll (`D-05.recortesOverflowHidden: []`) | En móvil, `section.scrollHeight 1874` vs `clientHeight 272` — hay que hacer scroll para ver el resumen que estás a punto de aprobar |
| **Al elegir comprador** | Duda | 4 nombres con sus categorías, y un "Irá asignada a **Bryan Bonilla**" (`:773-777`) | 4 nombres sin ninguna pista de carga actual, horario, ni qué pasa si el solicitante no conoce a ninguno |
| **✨ El alta: "Tu solicitud fue enviada"** | **Alivio genuino** | `[MEDIDO]` Check verde de 80 px, `h2` de `text-3xl`, la referencia `RFQ-2026-0013` en monoespaciada sobre negro, "Todo listo. Te avisaremos a mj.e2e@biabrands.co en cuanto haya una comparativa lista para que decidas", el PDF con Ver/Descargar, y el "Ver mis solicitudes" | **Pero el alta está en el peor lugar posible**: `[MEDIDO]` el `aside` baja a 389 px (46 %) pero la ventana de contenido es 369 px con 192 px de scroll → en 390×844 el `h2` "Tu solicitud fue enviada" **no está en el fold inicial**, igual que las dos acciones del PDF. El momento de mayor valor emocional es el que peor se ve |
| **Días después, en el correo** | Confianza | El correo llega con el enlace público | El texto promete "en cuanto haya una comparativa lista para que decidas", y el estado real en `/mis-solicitudes` es "Esperando decisión" / "Comparativa lista" — dos etiquetas distintas para el mismo significado |
| **✨ El segundo alta: la comparativa** | Decisión responsable | La pantalla pública funciona bien en móvil: las tarjetas apilan, el "Elegir esta opción" es un botón ancho, el modal de confirmación es claro: "Estás por elegir **CostaPrint**. Esta acción registrará tu decisión y notificará a Compras para avanzar." | Pero `[MEDIDO]` las dos opciones están en **monedas distintas**: "HNL 98.9" (CostaPrint) y "USD 31.5" (PlayaPromo), con el aviso "Los importes se muestran en su moneda original (sin conversión)" repetido dos veces, y `hayEquivalente: false` — **no hay ninguna cifra de comparación**. Un solicitante de Trade Marketing no sabe si HNL 98.90 es más o menos que USD 31.50. La "Recomendación de Compras: Recomiendo PlayaPromo" no cuantifica la brecha |

**Veredicto emocional: 1 momento de alto real y comprometido, 1 momento de alto決 potencial desperdiciado.** El
resto del recorrido es trabajo, noKER delighted-ness. Para un usuario que hace 2-3 solicitudes al mes eso es
tolerable; para el novato es la razón por la que pide ayuda a un compañero.

---

## 5. FORTALEZAS (concretas, y defendibles)

1. **La decisión de no pedir contraseña es la mejor decisión de producto del flujo, y está bien comunicada.**
   `app/page.tsx:65` — "Ingresá tus datos básicos para comenzar. **Sin contraseñas.**" Todo el wizard depende de
   ella y funciona: el solicitante nunca ve un login, nunca ve un "sesión expiró", y `/mis-solicitudes` acepta un
   email en la URL. Es lo que hace viable el piloto. Y con la bonus track de datos ya予定: el tracker de etapas
   (`TrackerEtapas`) + semáforo de margen + "Atención: 4 días" le dan al solicitante visibilidad real sin pedirle
   nada a nadie.

2. **El resumen del paso 5 (`:649-742`) está genuinamente bien diseñado.** Muestra la referencia placeholder
   ("La referencia definitiva se asigna al enviar" — honesto, no promete un ID que no existe todavía), el
   semáforo, la clasificación con su explicación en una línea, y **cada respuesta del assessment incluyendo
   "(no lo sé)" en itálica**. Es la clase de detalle que hace que un solicitante se atreva a mandar. En escritorio
   cabe entero sin scroll.

3. **La honestidad del "No lo sé" como mecanismo de primera clase, y el diseño del assessment.** `No lo sé`
   (`:538`, `:602`) es un checkbox, no un campo de texto vacío: el solicitante nunca se siente evaluado. Los chips
   de sugerencia (`:570-583`) con `title` para el truncado son un patrón acertado para datos enuméricos. Y el
   "Borrador guardado en este navegador." (`:138`) es una frase honesta y específica — si funciona, que funcione;
   si no, el **P0-3** dice que no.

4. **El guard de doble envío y la separación servidor/cliente de la IA.** `[MEDIDO]` 4 clics rápidos = 1 sola
   petición. Toda llamada a la IA es server-side vía `api-client` (`hooks/useSolicitudWizard.ts:142, 175`), lo que
   significa que la `OPENROUTER_API_KEY` **nunca llega al navegador** — laarchitecture of secrets está bien
   hecha, que es más de lo que se puede decir de muchos portales.

---

## 6. HALLAZGOS PRIORIZADOS

### P0-1 · Dead-end absoluto: "Continuar" deshabilitado para siempre si falta `area`

**Qué pasa.** `hooks/useSolicitudWizard.ts:299` — `pasoValido` del paso 2 exige `s.titulo && s.tipoNecesidad &&
s.fechaRequerida && **s.area.trim()**`. `area` **solo** llega por query param desde `app/page.tsx:24`. El wizard
**no tiene ningún campo de área**: la línea 253 lo muestra como texto de solo lectura — `Área: {estado.area || "—"}`.
Si la URL no trae `?area=`, no hay forma de seguir.

**Evidencia `[MEDIDO]`** (`metricas-pase2.json` → `H1-sin-area`):
```json
{ "textoVisibleArea": "Área: —", "hayCampoAreaEnFormulario": false,
  "botonContinuarDisabled": true,
  "camposQueElUsuarioPuedeLlenar": ["titulo","select-one","date","textarea"] }
```
Llené los 4 campos que el usuario **sí** puede llenar. El botón sigue `disabled: true`.

**Por qué importa.** Es un callejón sin salida absoluto, con cero pistas. Se dispara al: abrir un marcador, recibir
un link con el `area` sanitizada, volver con back/forward a una URL parcial, o recargar tras editar la URL. El
manual (`manual-solicitante.md:7`) dice "Abre el enlace del portal" → alguien marca `/solicitud/nueva`.

**Fix.** (a) Convertir el `<span>` de la línea 253 en un `<input>` real cuando `area` esté vacío, o (b) sacar
`area` de `pasoValido` y defaultedarla a "Sin especificar", o (c) mínimo: mostrar el error inline
`"Falta tu área — completala para continuar"` con `role="alert"`. La opción (a) es la correcta y son ~8 líneas.

---

### P0-2 · El contenido del paso activo se recorta: 85 % del veredicto de la IA no se renderiza, y el CTA primario queda cortado

**Qué pasa.** Dos recortes distintos del mismo `overflow-hidden`, con la misma causa raíz: el contenedor
`h-[90vh] ... overflow-hidden` (`:45`) da una ventana al `section` (`:146`, `overflow-y-auto no-scrollbar`), pero
**el aside se la queda casi toda** y la tarjeta de la IA (`:292`) tiene su propio `overflow-hidden` sin altura
definida.

**Evidencia `[MEDIDO]`**
- Tarjeta IA: `clientHeight 56` vs `scrollHeight 336` (390) / `368` (360) → **17 % / 15 % visible**. Escritorio
  211/271 = 78 %. Desaparecen `<h3>` "Esto parece una RFQ", "94% confianza", la explicación y "Razón: …".
- CTA "Continuar" recortado por el contenedor: **91 px** en 360, **83 px** en 390
  (`P4-*-sin-scroll.ctaRecortadoPorElContenedor: true`).
- Ventana de contenido: **179 px** en 360×740 para **3.636 px** de contenido. Con teclado: 163 px.
- "Confirmar clasificación" en 360×740: `recortadoPx: 22` (el botón cortado por la mitad — visible en
  `S-03-clasificacion.png`).

**Por qué importa.** El usuario **no puede leer por qué** el sistema clasificó su solicitud como RFQ antes de
confirmarla. Y en el paso 4 (el más largo) tiene que descubrir un scroll invisible dentro de una ventana de 179 px
para llegar al botón. En un teléfono real esto se traduce en: "¿está colgado? ¿tengo que bajar la página? ¿perdí
algo?" — y abandono en el paso 2 o 4, que es donde se pierde la solicitud.

**Fix.**
1. Móvil: `h-[90vh]` → quitar el `h-*` fijo por completo bajo `md` (`md:h-[80vh]`), dejar que `main` crezca con
   `min-h-screen` y que la **página** haga scroll (patrón mobile-first normal). Elimina los 3 recortes de una vez.
2. El `aside` en `<768px`: colapsar a **una barra de 1 línea** — "Paso 2 de 5 · Clasificación" + un dot rail
   horizontal de 5 puntos. Y bajar "Guardar borrador" / "Cancelar y descartar" a un `⋯` o al pie del formulario.
   Con eso el `section` pasa de 179 px a ~600 px.
3. La tarjeta de la IA (`:292`): quitar `overflow-hidden` (o agregar `overflow-visible`), o poner
   `min-h-fit`. Y en móvil, mostrar el `<h3>` del veredicto **fuera** de la tarjeta recortable.
4. Quitar `no-scrollbar` (`:146`) o reemplazarlo por un fade-out en el borde inferior para que el scroll sea
   discoverable.

---

### P0-3 · El autoguardado del borrador no restaura nada cuando se recarga

**Qué pasa.** `hooks/useSolicitudWizard.ts:125-128` autoguarda en cada cambio (correcto), pero
`estadoInicial(nuevo=true)` (`:74-76`) **ignora `leerBorrador()` y devuelve `base`**. Y `app/page.tsx:24` siempre
entra con `nuevo=1`. Resultado: el borrador se escribe y nunca se lee.

**Evidencia `[MEDIDO]`** (`metricas-pase2.json` → `H2-draft-loss`):
```json
"antes":   { "tituloInput": "TÍTULO ÚNICO XYZ-12345", "pasoEnLS": 2,
             "tituloEnLS": "TÍTULO ÚNICO XYZ-12345" },
"despues": { "url": "?nuevo=1&email=…&area=…", "tituloInput": "",
             "tituloEnPantalla": false, "descEnPantalla": false,
             "veredicto": "BORRADOR PERDIDO: los datos NO volvieron tras recargar" }
```
**Y hay un segundo bug independiente:** `H2b-draft-sin-nuevo` (entrando sin `nuevo=1`) → `tituloEnPantalla:
false` también. Porque `estadoInicial` (`:79`) exige `guardado.email === base.email` y `base.email =
leerBorradorEmail()`, que lee la cookie… y la cookie **estaba vacía** (`"cookie": ""`), porque
`guardarBorradorEmail` solo se llama dentro de `siguiente()` (`:133`), nunca al entrar al paso 2.

**Por qué importa.** Pérdida de datos silenciosa en el flujo más largo (el solicitante tarda minutos, no horas;
pero una llamada, un mensaje, una app de WhatsApp y el borrador se evapora). Y el mensaje "Borrador guardado en
este navegador." (`:138`) **miente** después de la recarga (`K-07.muestraBorradorGuardado: false`) porque
`borradoAt` (`:91`) es estado efímero.

**Fix.**
1. `app/page.tsx:22-24`: llamar a `guardarBorradorEmail(email)` en un `useEffect` al montar la home (no solo en el
   submit), para que `leerBorradorEmail()` funcione desde el paso 2.
2. `hooks/useSolicitudWizard.ts:74-76`: cuando `nuevo === true`, **borrar** el localStorage (en vez de ignorarlo) y
   arrancar limpio; cuando `nuevo === false`, restaurar. Hoy las dos ramas hacen lo mismo.
3. Persistir `borradoAt` en el objeto del borrador y mostrar el estado real ("Guardado hace 3 min") leyendo del
   localStorage, no de un `useState`.

---

### P0-4 · Fallo silencioso de la IA: el solicitante avanza creyendo que le preguntaron todo

**Qué pasa.** `hooks/useSolicitudWizard.ts:208-210` — el `catch` del assessment hace
`{ assessmentListo: true, contextoInsuficiente: false, assessmentPreguntas: [] }`. Idéntico a "la IA decidió que no
hace falta preguntar". Sin error, sin reintento, sin `aria-live`.

**Evidencia `[MEDIDO]`** (`E-05-IA-offline-assessment`, con `context.setOffline(true)`):
```json
{ "hayPreguntas": 0, "h2": ["Detalles para cotizar"] }
```
Texto visible completo: "Detalles para cotizar / **Completá la información técnica requerida para tu
solicitud.** / … / Subir arte o logo oficial / Atrás / **Generar documento**". Cero preguntas, cero aviso, botón
activo.

**Y el caso irmão (`:158-159`, la clasificación) miente con más fuerza** (`E-04`):
> "SIN SUGERENCIA" / "**No pudimos determinar el tipo automáticamente**" / "El texto ingresado **era muy ambiguo**
> para determinar el tipo."

La causa real era "no hay red". El texto culpa al usuario por su escritura. `[INFERIDO]` Con ~40 solicitudes/mes
en Honduras, un corte de datos en un faktoría es routine: cada una produce un solicitante que piensa que escribió
mal y que "el sistema no entendió".

**Fix.** (a) Diferenciar el `catch` del caso de baja confianza: un `estado.error` con copy explícito
("No pudimos analizar tu solicitud — revisá tu conexión e intentá de nuevo") + botón "Reintentar" que llame a
`clasificarIA()` / `evaluarAssessment()`. (b) En el `catch` del assessment, **no** marcar `assessmentListo: true`:
dejar la pantalla vacía con un mensaje y el reintento. (c) Un `role="status"` en la región que recibe las
preguntas (hoy solo el loader lo tiene, `:401`).

---

### P1-a · Errores en inglés de desarrollador dentro de una UI en voseo

**Qué pasa.** `hooks/useSolicitudWizard.ts:271` — `mensaje: e instanceof Error ? e.message : …`. Un
`TypeError: Failed to fetch` de `fetch` llega crudo al `role="alert"` de `:780`.

**Evidencia `[MEDIDO]`** `E-06-envio-offline.alerta: "Failed to fetch"`. Contexto: el solicitante está en el paso 5,
llenó todo, apretó "Enviar solicitud" y le aparece la palabra "fetch".

**Por qué importa.** Es la última pantalla antes de que el trabajo de 15 minutos seecte. Un mensaje que parece de
desarrollador destruye la confianza en el sistema justo cuando más se necesita.

**Fix.** Mapear los errores de red a copy en español y añadir un reintento:
`TypeError`/`Failed to fetch` → "No pudimos enviar tu solicitud. Revisá tu conexión e intentá de nuevo." +
botón "Reintentar" que re-invoque `enviarSolicitud()`. Idealmente con un `idempotencyKey` para no duplicar.

---

### P1-b · `/mis-solicitudes` en móvil: la tarjeta se aplasta a 57 px y el badge se sale

**Qué pasa.** `app/mis-solicitudes/page.tsx:124-133` — el `div.flex.justify-between` pone los dos badges en un
contenedor `shrink-0` (`:129`) que reserva su ancho antes de que el título calcule el suyo. El título no tiene
`min-w-0`, así que en vez de hacer wrapve, se estruja.

**Evidencia `[MEDIDO]`** (`metricas-pase2.json` → `H6-lista-movil-aplastamiento`, viewport 390):
```json
{ "tarjetaW": 292, "colTituloW": 57,
  "tituloW": 57, "tituloH": 240, "lineasTitulo": 10,
  "refW": 57, "refH": 45,
  "badges": [ …, { "txt": "Enviada a Compras", "w": 118, "desbordadoDerecha": 58, "seSaleDelCard": true } ] }
```
**El título "Pelotas de fútbol tamaño 5 marca BIA para torneo juvenil" ocupa 10 líneas en 57 px de ancho** (240 px
de alto). La referencia "RFQ-2026-0012" se parte en 3 líneas. El badge "Enviada a Compras" **se sale 58 px del
borde derecho de la tarjeta y queda cortado** — visible en `MM-02-lista.png` como "Enviada a Comp", y "Compara" en
RFQ-2026-0008.

**Por qué importa.** Es la pantalla de retorno: donde el solicitante va a ver si le(compra. Con 40 solicitudes/mes
acumulándose, es la primera impresión del sistema después del primer envío. Hoy es ilegible.

**Fix.** Móvil: `flex-col` en el header de la tarjeta, badges en fila propia debajo del título, y
`min-w-0` + `truncate`/`line-clamp-2` en el título. Los badges de estado deben poder leerse enteros.

---

### P1-c · Sin convención para los campos del assessment y sin límite de tamaño/tipo de archivo

**Qué pasa.** `:588-595` y `:523-530` — `<input type="text">` para todo: cantidades, tallas, códigos de material,
plazos, Supervision. No hay `inputMode`, ni `pattern`, ni `type="number"`, ni `maxLength`. Y `:477-486` — el
`<input type="file">` no valida nada: solo el atributo `accept` (que los navegadores respetan en el diálogo pero no
al arrastrar ni al seleccionar programáticamente).

**Evidencia `[MEDIDO]`** (`H4b/c/d`):
- PNG de **12 MB**: `nombreMostrado: "SI"`, `zonaVerde: true`, `hayMensajeDeError: false`
- **PDF corrupto** (`"%PDF-1.4\nesto no es un pdf real"`): `nombreMostrado: true`, `hayErrorVisible: false`
- **`.heic`** (fuera del `accept`): `aceptado: true` — sin error
- `H4e-advance`: "Generar documento" `disabled: false` — se puede enviar con cualquiera de esos archivos

**Por qué importa.** El solicitante con un `.ai` de Illustrator de 40 MB o un PDF escaneado de 8 MB lo sube, ve la
zona verde,按下 "Enviar solicitud", y el error llega — o no llega — del servidor, en el paso 5, después de todo el
trabajo. `[INFERIDO]` El `accept` incluye `.svg`, que es un vector activo: subir un SVG a un portal es un vector de
XSS servido desde el propio dominio.

**Fix.** (a) `onChange`: validar `f.size` contra un techo explícito (p. ej. 5 MB) y la extensión contra una lista
blanca, con mensaje inline `role="alert"` y manteniendo el nombre del archivo anterior. (b) Quitar `.svg` de la
lista blanca o servirlo como descarga `Content-Disposition: attachment` + CSP. (c) Derivar `inputMode`/`type` del
`cp.tipoDato` / `aq.campoKey` en vez de `text` para todo.

---

### P1-d · Foco invisible, `role` ausente y trampa de foco rota en los modales

**Qué pasa.** El input del radio "Producto/Servicio" es `sr-only` (`:230`) = 1×1 px, y su `<label>` **no tiene
ningún estilo de foco** — solo variantes `group-has-[:checked]`.

**Evidencia `[MEDIDO]`** (`metricas-pase2.json` → `H3-foco-radio-card`):
```json
{ "inputRect": {"w":1,"h":1}, "tarjetaBounds": {"w":136,"h":115},
  "outlineEnTarjeta": "rgb(15, 23, 42) none 3px",
  "tieneFocusVisibleEnClases": false,
  "cardClasses": "… group-has-[:checked]:border-sky-500 group-has-[:checked]:bg-sky-50/50 …" }
```
Un usuario de teclado tabula hasta la tarjeta "Producto" y **nada cambia visualmente**.

**Y el modal público (`:169-199`)** — `[MEDIDO]` `H5b-modal-foco`:
```json
{ "hayTrampaDeFoco": false, "hayRoleDialog": false, "hayAriaModal": false,
  "escapeCierra": false,
  "focoAlAbrir": {"activo":"BUTTON:Elegir esta opción"},
  "recorrido": ["Elegir esta opción"(fondo), "Ninguna me sirve"(fondo), "Cancelar"(modal), "Confirmar"(modal), "BODY", "NEXTJS-PORTAL", "Elegir…"(fondo)] }
```
El foco **no entra** al modal, **sale** al fondo, `Tab` llega al documento de atrás, `Escape` no cierra, y no hay
`role="dialog"`. `[INFERIDO]` Un usuario de teclado/screen-reader que abre "Confirmar selección" no sabe que se abrió
un diálogo y puede disparar "Elegir esta opción" de otra tarjeta sin darse cuenta.

**Y el árbol de headings del wizard es inválido:** `[MEDIDO]` `h1Total: 0` en los 5 pasos. El outline empieza en
`H3: Progreso de la solicitud` → `H2: ¿Qué necesitás?`. `document.title` sigue siendo "Nueva solicitud — Portal
de Compras BIA" en los 5 pasos.

**Fix.**
1. `:229-235` — agregar `has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sky-500 has-[:focus-visible]:ring-offset-2`
   a la tarjeta, o `group-focus-within:` en el `<label>`.
2. El modal público: `role="dialog" aria-modal="true" aria-labelledby={id}`, foco al primer botón al abrir,
   trampa de foco en `Tab`/`Shift+Tab`, `Escape` para cerrar, `returnFocus` al disparador. (Hay un
   `components/ui-ext/Modal.tsx` en el repo que probablemente ya resuelve esto — no lo usaron.)
3. Un `<h1 className="sr-only">` por paso (o cambiar el `<h3>` "Progreso de la solicitud" a `<p>` y promover el
   `h2` del paso a `h1`). Y `document.title` por paso.

---

### P2-a · La IA clasifica pero su justificación es inaccesible — y el mapa de progreso miente

Ver §1.2 (recorte) y §1.4 (mapa). Son dosbugs distintos con un fix común: **hacer el rail responsivo de verdad**
— de 4 filas verticales en escritorio a 1 línea compacta en móvil — y **hacer que coincida con las 5 pantallas
reales**, promoting "Detalles técnicos" a dos etiquetas cuando corresponda, o renombrando "Detalles técnicos" a
"Detalles y preguntas" y agregando una 5ª etiqueta "Enviada".

`[MEDIDO]` Además: `PASOS_SIDEBAR` (`:11-16`) es un array hardcodeado mientras el hook tiene 6 pasos tipados
(`PasoWizard = 1|2|3|4|5|6`). La fuente de verdad del progreso está duplicada y ya divergió.

---

### P2-b · La comparativa pide comparar importes que no son comparables

**Evidencia `[MEDIDO]`** (`H5a-comparativa-estructura`):
```json
{ "monedasPresentes": ["HNL","USD"], "importes": ["HNL 98.9","USD 31.5"],
  "hayAvisoSinConversion": true, "hayEquivalente": false,
  "recomendacion": "Recomiendo PlayaPromo" }
```
Y en el detalle del solicitante, la misma inconsistencia de formato: "COTIZACIONES (2) / Prov Cara SA **HNL 100000**
/ Prov Barata SA **HNL 80000**" (`H6b-detalle-movil`) — sin separador de miles, un decimal en público y cero en el
detalle.

**Por qué importa.** Esta es **la pantalla de decisión de compra** del rol. Le pide al solicitante que elija entre
dos números en monedas distintas, diciéndole dos veces que no hay conversión, y sin ninguna referencia para
juzgarlos. La "Recomendación de Compras" no cuantifica nada.

**Fix.** (a) Mostrar un equivalente orientativo con fecha de tasa, o al menos el monto en una moneda común en la
tarjeta de comparación. (b) Formateo único (`Intl.NumberFormat` con `maximumFractionDigits: 2` y
`minimumFractionDigits: 2`) en las dos vistas. (c) Un tercer elemento de comparación: **diferencia absoluta y
porcentual** entre las dos opciones.

---

### P2-c · No hay forma de decidir desde la propia pantalla de seguimiento, y el correo es el único camino

**Evidencia `[MEDIDO]`** `H6b-detalle-movil` sobre RFQ-2026-0008 en `COMPARATIVA_LISTA`:
```json
{ "hayDecisionCTA": false,
  "texto": "… PROGRESSO … COTIZACIONES (2) | Prov Cara SA | HNL 100000 | Prov Barata SA | HNL 80000" }
```
El solicitante ve las cotizaciones internas en su página de seguimiento pero **no hay ningún enlace, botón ni
pista** hacia `/comparativa/[token]`. Si el correo se pierde, la solicitud queda en "Tu decisión"
(`TrackerEtapas` etapa 4) **para siempre**, sin autoservicio. El manual (§3) solo dice "recibirás un correo con el
enlace".

**Fix.** Si existe `link_publico` para la solicitud, renderizar un botón primario "Ver comparativa y decidir" en
`/mis-solicitudes/[id]`. Es una fila de código con un `join` que ya existe en el repo.

---

### P2-d · El enlace público no tiene caducidad ni aviso en la UI

**Evidencia `[MEDIDO]`** `H5d-token-usa: status 200` y el texto "Enlace público · sin iniciar sesión" (`:59`). La
tabla `link_publico` tiene `fecha_expiracion` y `revocado` (confirmado en `\d link_publico`), y hay
`veces_accedido` / `ultimo_acceso` — **nada de eso se muestra ni se comunica al solicitante**.

**Por qué importa.** Quien recibe el correo (un solicitante, pero también cualquier reenvío) tiene un bearer
token perpetuo a los precios de proveedores de BIA, con la etiqueta tranquilizadora "sin iniciar sesión".
`[INFERIDO]` A 40 solicitudes/mes el volumen es bajo, pero la etiqueta "sin iniciar sesión" sin fecha de vencimiento
es una invitación a reenviar el link.

**Fix.** Mostrar "Este enlace expira el {fecha}" si existe `fecha_expiracion`, y registrar/mostrar
"visto el {fecha}". Si no hay expiración configurada, al menos rotar el token al decidir (`UPDATE … SET revocado`),
que es lo que ya hace el flujo de decisión.

---

### P3-a · Objetivos táctiles por debajo del mínimo y tipografía ilegible

`[MEDIDO]` Elementos con menos de 32 px de alto:
- "Ver mis solicitudes" en la confirmación: **16 px** (`D-06-confirmacion.ctas`, `M-06-confirmacion`)
- "Nueva Solicitud" en `/mis-solicitudes`: **31 px**
- "Crear una solicitud" (estado vacío): **16 px**

Tipografías: `TrackerEtapas.tsx:46` → **`text-[8px]`**; `:83` → `text-[9px]`. En el wizard: 5 textos a 10-11 px
por pantalla (`textosMenores12px`). En `VistaPublica.tsx` hay **14** usos de `text-[9px]`/`text-[10px]`/`text-[11px]`
en el contenido que decide una compra.

`[MEDIDO]` Ningún `input` del wizard pasa de 16 px de `fontSize` (el `font-sans` base) — bien. El problema es el
contraste de tamaños, no el de los inputs.

---

### P3-b · Cero soporte de `prefers-reduced-motion`, y una animación decorativa infinita en el wizard

**Evidencia `[MEDIDO]`** `grep -rn "prefers-reduced-motion" styles/ app/ components/` → **0 resultados en todo el
repo.**

- `styles/globals.css:111` — `.step-enter { animation: fade-in-up 0.4s ease-out forwards; }`, aplicado a la raíz de
  los 5 pasos del wizard (`:205`, `:287`, `:398`, `:644`, `:797`).
- `styles/globals.css:107` — `.animate-fluid-blob { animation: blob-morph 12s ease-in-out infinite alternate,
  blob-spin 24s linear infinite; }`, que en el wizard es el blob decorativo del `<aside>` (`:48`,
  `bg-gradient-to-r from-sky-200 … blur-[40px] mix-blend-multiply`).

**Por qué importa.** Un usuario con "Reducir movimiento" activado en iOS/macOS recibe un blob que se deforma y gira
**indefinidamente** (36 s de ciclo combinado) más un fade-up en cada cambio de paso, sin ninguna vía de escape.
Además, un `blur-[40px]` con `mix-blend-multiply` animado es composición GPU continua: en un teléfono de gama media
eso compite con el scroll del `section`, que es precisamente el punto débil del layout.

**Fix.** Un bloque global:
```css
@media (prefers-reduced-motion: reduce) {
  .step-enter, .animate-fluid-blob { animation: none !important; }
}
```
Y considerar `md:animate-fluid-blob` para no gastar GPU en el blob en móvil.

---

### P3-c · Código muerto y deuda que confunde al siguiente que lea el repo

`[MEDIDO]` `components/ui-ext/Stepper.tsx` (64 líneas) tiene `aria-current="step"`, `aria-label` en los botones
navegables y una API `onNavigate` bien diseñada — **y cero imports en toda la aplicación**. Lo mismo con el
`irA(paso)` que el hook exporta (`:280-284`) y nadie destructura, y con el `PASOS_SIDEBAR` hardcodeado que
duplica la fuente de verdad de los pasos.

`[MEDIDO]` El `document.title` de `/solicitud/nueva` es fijo, y `components/coordinador/Modal.tsx` (nuevo, sin
commitear) provocaba un `Error: the name 'Modal' is defined multiple times` en
`components/coordinador/CargaCotizaciones.tsx:454` que **devolvió HTTP 500 en `/mis-solicitudes`** durante mi
recorrido (ver §9). El módulo del coordinador se compila dentro del grafo de `/mis-solicitudes` (esta página es
de rol solicitante).

---

## 7. RED FLAGS POR PERSONA

### 👤 A. Solicitante novato, primer teléfono, sin ayuda

Orden real de lo que toca y lo que encuentra:

1. Marca `solicitudcompras-app.vercel.app` → entra. **Bien.** (Si marca `/solicitud/nueva` → **P0-1**, dead-end absoluto.)
2. Escribe sus datos → "Continuar" funciona. **Bien.**
3. El wizard lo recibe con **486 px de cromo (64-73 %)** antes de la primera casilla. `[MEDIDO]` El `h2`
   "¿Qué necesitás?" aparece en y≈1360 de un fullPage de 2.532 px. **No sabe si la página ya empezó.**
4. Escribe el título, elige categoría… `[MEDIDO]` en 360×740 el `select` de categoría está en y=779 con viewport
   740: **no lo ve**. Baja. Descubre que el rectángulo scrollea. `[MEDIDO]` **No hay scrollbar** (`no-scrollbar`).
5. Intenta tocar "Continuar" → `[MEDIDO]` **está 91 px fuera del contenedor recortado.** Desliza, lo encuentra,
   avanza.
6. La IA clasifica → `[MEDIDO]` **no ve nada de lo que dijo la IA** (15-17 % de la tarjeta). Ve 3 opciones y un
   botón "Confirmar clasificación". **Pico de sospecha: "¿acertó?" — no hay forma de saberlo.**
7. Cae en 4-6 preguntas → `[MEDIDO]` **2.796 px de scroll en una ventana de 179 px.** 27 % de la pantalla es
   formulario. No hay "pregunta 3 de 6".
8. Envía. Le da un trabajo de 15 minutos con riesgo de pérdida silenciosa (**P0-3**).

**Balance: la última pantalla es buena. Las 4 anteriores son hostiles en el teléfono.**

### 👤 B. Solicitante frecuente (3+ solicitudes/mes)

Lo que le sobra y lo que le falta:
- **Le sobra:** el bloque de progreso de 486 px que ya conoce de memoria, en cada uno de los 5 pasos. Y el
  `Guardar borrador` manual: ya está autoguardado (`hooks/useSolicitudWizard.ts:125-128`), así que el botón es
  redundante — pero como el autoguardado **no restaura** (**P0-3**), el botón es su única perceived red de
  seguridad. Si arreglan uno, hay que quitar el otro o se contradicen.
- **Le falta:** todo. `[MEDIDO]` 8 campos manuales, cero autocompletado, cero "repetir última solicitud",
  `nombre` y `area` borrados en cada arranque (`app/page.tsx:24-33`). Un habitual con 3 solicitudes de material
  POP escribe lo mismo 3 veces.
- **Y le cuesta caro:** `[MEDIDO]` las 3 peticiones por solicitud contra la IA (clasificar, assessment, y la
  subida del logo) con un LLM detrás. Medí esperas reales de 20-60 s en el assessment con un loader que no tiene
  % ni ETA. Un habitual que ya sabe qué escribir pasa 60 s mirando un spinner.
- `/mis-solicitudes` sin paginación: `[MEDIDO]` en escritorio la 6ª tarjeta ya está en y=969 con viewport 900. Con
  40/mes, en unos meses es un scroll infinito de tarjetas ilegibles de 57 px de ancho (**P1-b**).

### 👤 C. Usuario de accesibilidad / teclado / lector de pantalla

Fallos medidos, en orden de gravedad:

| # | Elemento exacto que falla | Evidencia |
|---|---|---|
| 1 | **Todo el modal público de decisión** — sin `role="dialog"`, sin `aria-modal`, foco que no entra, `Tab` que sale al fondo, `Escape` que no cierra | `H5b`: `hayTrampaDeFoco: false, hayRoleDialog: false, hayAriaModal: false, escapeCierra: false` |
| 2 | **Tarjetas Producto/Servicio sin foco visible** — input de 1×1 px, label sin estilo `:focus-visible` | `H3`: `tieneFocusVisibleEnClases: false, outlineEnTarjeta: none` |
| 3 | **Cero `aria-live` en el wizard** — el sistema anuncia el *loader* (`:401`, `role="status"`) pero **no** la llegada de la clasificación ni de las preguntas, que es lo que cambia | `K-03`: `ariaLive: []`, `roleStatus: 0`, `roleAlert: 0` en el paso 2 |
| 4 | **Cero `<h1>` en las 5 pantallas del wizard** — outline inválido `H3 → H2` | `h1Total: 0` en D-02..D-06, M-02..M-06, S-02..S-04 |
| 5 | **`<aside>` como landmark sin nombre** | `K-03.landmarks: ["MAIN","ASIDE"]` — se anuncia como "complementary" sin etiqueta |
| 6 | **Error de correo sin `aria-invalid` ni `aria-describedby`**, y el mensaje no está en `role="alert"` | `E-01.inputAriaInvalid: null`; `app/page.tsx:82-84` |
| 7 | **El rail de progreso no es tabulable** — sin `button`, sin `tabindex`, sin `onClick`; el progreso es 100 % visual | `K-02`: los 3 primeros tabuladores son el portal, "Guardar borrador" y "Cancelar y descartar"; el rail no aparece |
| 8 | **Botones de rescate del borrador antes del contenido** en el orden de tabulación | `K-02` orden: `NEXTJS-PORTAL → Guardar borrador → Cancelar y descartar → #titulo → …` |
| 9 | **8 px de tipografía** en el tracker de etapas (la única señal de progreso) | `TrackerEtapas.tsx:46` `text-[8px]` |
| 10 | **Cero soporte de `prefers-reduced-motion` en todo el repo** | `[MEDIDO]` `grep -rn "prefers-reduced-motion" styles/ app/ components/` → **0 resultados**. `styles/globals.css:111` define `.step-enter { animation: fade-in-up 0.4s ease-out forwards; }` (aplicado en los 5 pasos del wizard: `:205`, `:287`, `:398`, `:644`, `:797`) y `.animate-fluid-blob { animation: blob-morph 12s …, blob-spin 24s linear infinite; }` (`:107`), que en el wizard es el blob decorativo del `<aside>` (`:48`) |
| 11 | **Error de red en inglés** | `E-06.alerta: "Failed to fetch"` |

---

## 8. ESTADO MÓVIL DEL FLUJO — veredicto

### Usabilidad móvil actual: **NO APROBADA para piloto.** Bloqueantes reales, en orden:

**BLOQUEANTE 1 — El layout del wizard no tiene presupuesto vertical en móvil.** (`P0-2`)
El `aside` de 486 px compite con el formulario dentro de un `h-[90vh] overflow-hidden`. Resultado medido: 179 px
de ventana de contenido en 360×740, CTA primario **recortado 91 px por el contenedor**, y el veredicto de la IA
al **15 % visible**. Esto no es "se ve feo": es que **el producto no entrega su contenido en el teléfono**.
Es la queja original, confirmada, y peor de lo reportado.

**BLOQUEANTE 2 — Pérdida de datos al recargar.** (`P0-3`)
Autoguardado que no restaura, en un flujo de 5 pasos que un móvil interrumpe por diseño (llamada, WhatsApp, app
de banco). Con un dead-end absoluto si falta `area` (`P0-1`). Un piloto no puede affords esto.

**BLOQUEANTE 3 — La comparación de precios no es comparable.** (`P2-b`)
"HNL 98.9" vs "USD 31.5" sin conversión, en la pantalla donde se decide una compra. El solicitante **no puede
cumplir su tarea** con lo que la pantalla le da. Si el piloto falla aquí, falla por la razón equivocada
(elegirán mal y parecerá que el portal no sirve).

### Lo que SÍ funciona en móvil (no tocar al arreglar):

- `[MEDIDO]` **Cero scroll horizontal** en las 6 pantallas.
- `[MEDIDO]` **`/mis-solicitudes` carga y devuelve datos** en 390×844 (con la restricción de ancho de `P1-b`).
- `[MEDIDO]` **`/comparativa/[token]` es usable en móvil**: las tarjetas apilan, el CTA "Elegir esta opción" es
  ancho y claro, el modal de confirmación entra y su copy es bueno, y el整体 flujo se lee sin scroll horizontal.
  **Es la mejor pantalla móvil del producto** y confirma que el equipo sabe hacer responsive bien cuando el
  layout no tiene un `h-*` fijo + `overflow-hidden` en la mitad.
- `[MEDIDO]` **Zonas táctiles primarias ≥ 39 px** en el wizard y ≥ 44 px en la comparativa. Los targets de 16 px
  (`P3-a`) son links secundarios, no el camino principal.
- `[MEDIDO]` **Guard de doble envío** (`P4-doble-envio`: 4 clics → 1 POST).
- `[MEDIDO]` **Tono y registro** invariantes entre móvil y escritorio: mismo voseo, misma copy, mismos colores. No
  hay una versión "móvil" degradada, hay una versión **mal distribuida**.

### Veredicto en una frase

> El flujo del solicitante **funciona en escritorio y funciona en `/comparativa` en móvil**, pero **el wizard —que es
> donde vive el 90 % del trabajo del solicitante— no es usable en un teléfono**: muestra el 27 % del espacio
> dedicated al formulario, esconde el 85 % de la explicación de la IA, y esconde el botón que hay que tocar
> detrás de 2.796 px de scroll en una ventana de 179 px. Arreglando P0-1, P0-2 y P0-3, el wizard móvil pasa de
> "no usable" a "viable"; sin ellos, el piloto se mide con una muestra sesgada (solo los solicitantes con
> escritorio).

---

## 9. CONSOLA Y PASOS FALLIDOS

### 9.1 Lo que se rompió durante la auditoría

| Qué | Severidad | Estado | Fallback usado |
|---|---|---|---|
| **`Error: the name 'Modal' is defined multiple times`** en `components/coordinador/CargaCotizaciones.tsx:454` → **HTTP 500 en `/mis-solicitudes`** y `/mis-solicitudes/[id]` | **Bloqueante temporal** | **Resuelto** durante la corrida. `git status` muestra `components/coordinador/Modal.tsx` **nuevo y sin commitear** + `CargaCotizaciones.tsx` modificado → colisión de una edición en paralelo del flujo coordinador. Verificado ahora: las 4 rutas devuelven **200** | Repetí las pasadas de `/mis-solicitudes` en `MM` (390×844), que corrieron después de la recuperación y sí renderizaron. `MD-06-detalle-sin-email` quedó con `status: 500` y es el residuo de la ventana rota; `MM-06` devolvió 200 con contenido completo |
| IA intermitente / lenta | Media | Manejada | Esperé hasta 180 s por el `waitForFunction` del loader del assessment (`S-espera-assessment`, `H4`). Nunca hubo timeout en 4 pasadas completas del wizard |
| El assessment devuelve **4 o 6 campos** para la misma entrada | Media (nondeterminismo, no fallo) | No manejada — es un hallazgo | Ninguno: es el hallazgo `§1.4` |
| `page.click('button:has-text("Continuar")')` fallaba en móvil | — (artefacto del harness) | Resuelta | Cambié a `locator().click()` + `evaluate(el => el.click())`, que hacen el scroll al contenedor correcto. Confirmé por separado que **con** scroll el CTA sí es 100 % visible y golpeable (`hitTest: "Continuar"`) |
| `E-07-accept-archivo: hayFileInput: false` | — (sonda mal ubicada) | Resuelta | La sonda corrió en el paso 2, donde el input de archivo no existe. Repetida en el paso 4 → `H4a-file-input` con `accept: ".png,.jpg,.jpeg,.pdf,.svg,.ai,.eps"` |

### 9.2 Consola del navegador (todas las pasadas)

`[MEDIDO]` 42 entradas. Filtro por lo que no es ruido de Next.js:

| Origen | Tipo | Mensaje | Juicio |
|---|---|---|---|
| escritorio | error | `404 (Not Found)` en un recurso estático | Ruido de dev; sin impacto en la UI |
| `MD` | error + **pageerror** | `./components/coordinador/CargaCotizaciones.tsx:454:10 — the name 'Modal' is defined multiple times` | **Bug de compilación real** (ver §9.1). Rompió `/mis-solicitudes` con 500 |
| `MD` | error | `500 (Internal Server Error)` | Consecuencia del anterior |
| `errores` (offline) | requestfailed ×7 | `net::ERR_INTERNET_DISCONNECTED` en `/_next/static/chunks/lib_api-client_ts_001lp54._.js` y `/api/solicitudes` | **Esperado** (simulación). Pero notable: el `api-client` es un chunk lazy, así que **el fallo de red impide cargar el módulo de API** — coherente con `E-04`/`E-05` |
| `errores`, `movil390`, `MD`, `MM` | requestfailed | `net::ERR_ABORTED` en URLs con `&_rsc=…` | Prefetch de Next.js cancelado al navegar. Ruido |
| `movil390`, `movil360`, `MD`, `MM`, `PD`, `PM`, `PS` | error | varios sin texto útil | Ninguno atribuible a lógica del solicitante |
| — | `pageerror` en wizard, home, comparativa | **0** | El wizard no lanza excepciones en ninguna pasada, ni en móvil |

**Conclusión de consola:** el código de la ruta del solicitante está limpio de excepciones. El único error de
compilación observado vino del archivo del coordinador, y —esto es lo relevante para el solicitante— **rompió una
página de rol solicitante**, porque Next compila el módulo importado dentro del mismo grafo. Vale una regla: el
código del rol coordinador no debe poder tumbar la página de seguimiento del solicitante.

---

## 10. PREGUNTAS PROVOCADORAS PARA EL EQUIPO

1. **Si el 80 % de los solicitantes usa un teléfono y el wizard en teléfono muestra el 27 % de la pantalla
   dedicado al formulario con el botón primario recortado 91 px por el contenedor — ¿cómo justificamos que el
   piloto mida la usabilidad del producto, y no la de los solicitantes que happen to tener un escritorio?**
   ¿Sejian Doing una prueba de campo con dispositivos reales antes del piloto, o vamos a descubrir en producción
   que la tasa de abandono entre el paso 2 y el 4 es un problema de layout?

2. **La IA clasifica la solicitud y le dice al usuario por qué — pero en móvil le muestra el 15 % de esa
   explicación. Si invertimos 40 minutos en prompts, modelo y una assessment que genera preguntas específicas del
   proveedor, y el 85 % de la salida no se renderiza en el dispositivo donde está el 80 % de los usuarios:
   ¿estamos optimizando la IA o optimizando el pipeline de datos?** ¿Cuál es la métrica de éxito real de la IA —
   la confianza del modelo, o la tasa con la que el solicitante *acepta* la clasificación sin corregirla (que hoy
   ni siquiera podemos medir, porque no hay `aria-live` ni evento)?

3. **La pantalla de decisión de compra pide comparar "HNL 98.9" contra "USD 31.5" y le dice al solicitante que no
   hay conversión. Si la IA de Compras recomienda "PlayaPromo" sin cuantificar la brecha, estamos delegando una
   decisión de tenso de miles de lempiras a un usuario que — por diseño del producto — no tiene cuenta, no tiene
   contraseña y probablemente no sepa convertir monedas. ¿Quién es responsable de que esa decisión sea
   defendible: el sistema, o el solicitante al que se la delegates?** ¿Y por qué el enlace público — un bearer
   token perpetuo con la etiqueta "sin iniciar sesión" — no expira?

4. **Menos provocadora, y quizá la más importante: ¿qué pasa con los datos cuando alguien recarga?** El sistema
   autoguarda un borrador en cada tecla y no lo restaura nunca, y el mensaje "Borrador guardado en este
   navegador." sigue ahí mintiendo después de la recarga. Si en el piloto un solicitante pierde 15 minutos de
   trabajo y el equipo no tiene ni un log de eso, **nunca lo vamos a saber.** ¿Añadimos instrumentación de
   "recarga en el paso N" antes del piloto?

5. **Y una de proceso: el `docs/guias/manual-solicitante.md` existe, es bueno, y no está enlazado desde ninguna
   parte del producto.** ¿Es una decisión (el solicitante la recibe por correo) o un olvido? Si es un olvido, es
   el fix de mejor relación esfuerzo/valor de toda esta lista: una línea en `/`.

---

## ANEXO — Índice de evidencia

Todo en `qa/evidencia-piloto/critique-solicitante/`:

| Archivo | Contenido |
|---|---|
| `audit-solicitante.mjs` | Pase 1: recorrido completo escritorio + 390×844 + 360×740, teclado/foco, persistencia, errores/offline, mis-solicitudes, comparativa, consola |
| `audit-pase2.mjs` | Pase 2: dead-end de `area`, pérdida de borrador, foco del radio, subida de archivo, trampa de foco del modal, aplastamiento de la lista |
| `audit-pase3.mjs` | Pase 3: alcanzabilidad del CTA, reparto de alturas, anuncio de cambio de paso |
| `audit-pase4.mjs` | Pase 4: recorte físico del CTA vs. below-fold, `pctVisible` de la tarjeta IA, mapa sidebar por paso, doble envío |
| `metricas.json` | 80 estados con métricas DOM (aside, rail, recortes, scrollables, CTAs, cortados, targets, tipografías) |
| `metricas-pase2.json` | 16 hallazgos dirigidos |
| `metricas-pase3.json` / `metricas-pase4.json` | Alcanzabilidad del CTA, reparto, mapa del rail, doble envío |
| `consola.json` | 42 entradas de consola (error/warning/pageerror/requestfailed) con su origen |
| `pase2-notas.json` | Consola y requests del pase 2 (vacía: 0 errores) |
| `pasos-fallidos.json` | **0 pasos del recorrido principal fallidos** |
| `textos.txt` | `innerText` completo de cada estado capturado |
| `D-*` (7) | Escritorio 1440×900: home, captura, clasificación, loader, detalles, documento, confirmación |
| `M-*` (7) | 390×844: los mismos 6 estados + loader |
| `S-*` (6) | 360×740: home, captura, clasificación, detalles, **teclado virtual simulado**, tras recarga |
| `E-*` (6) | Email inválido, email no institucional, plazo corto, IA offline (clasificación), IA offline (assessment), envío offline |
| `K-*` (3) | Foco por tabulación (home y wizard), borrador guardado, tras recarga |
| `MD-*` (6) / `MM-*` (6) | `/mis-solicitudes` y detalle: escritorio y 390×844 |
| `PD-*` (6) / `PM-*` (6) / `PS-*` (6) | `/comparativa/[token]`: 1440×900, 390×844, 360×740 — pendiente, modal, ya decidida, token inválido |
| `H1`–`H6*` (9) | Dead-end de área, borrador perdido, foco del radio, archivo 12 MB, PDF corrupto, HEIC, comparativa, lista aplastada |
| `P3-*` / `P4-*` (12) | Alcance del CTA, reparto de alturas, mapa del rail, doble envío |
| `AUDIT-SOLICITANTES.md` | Este informe |
