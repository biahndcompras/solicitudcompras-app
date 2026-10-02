# Auditoría UX — Flujo de Coordinadores

**Fecha:** 2026-09-22 · **Target:** `app/panel/page.tsx` (+ `app/login/coordinador`, `app/panel/solicitud/[id]`) · **Modo:** Operate
**Método:** scan determinista (`detect.mjs`) + recorrido real con Playwright (1440×900 y 390×844), login como Carlos Melara.
**Evidencia:** `qa/evidencia-piloto/critique/` (17 capturas, `audit-metricas.json`, `audit-textos.txt`, `audit-consola.json`, `audit-foco.json`).

**Cobertura:** login · panel (7 filas, 4 filtros, búsqueda) · RFQ-0010 sin cotizaciones · RFQ-0008 con comparativa (pasos 07/08/09) · RFQ-0007 cerrada · móvil.

---

## Bloque de correcciones — 2026-09-26

Los 12 hallazgos (P0-1 a P3-12) están implementados sobre el mismo HEAD (`47bdc86`) y verificados con código, tests y recorrido real. **Sin commit**: los cambios están en el working tree.

**Tests nuevos:** 24 en 4 archivos (`app/panel/page.test.tsx` 8, `app/api/solicitudes/route.test.ts` 3, `components/coordinador/CargaCotizaciones.test.tsx` 6, `components/coordinador/DetalleSolicitud.test.tsx` 7). Suite completa: 129 en verde, 7 skips (los de DB, preexistentes). `npx tsc --noEmit` limpio y `npx eslint` con 0 errores (3 warnings preexistentes en archivos ajenos al bloque).

**Evidencia nueva:** `fix-metricas.json`, `fix-consola.json`, `fix-01…fix-13*.png` (recorrido post-fix, `audit-coord-fix.mjs`) + el re-run completo de `audit-coord.mjs` (mismos `audit-*.png` / `audit-metricas.json` / `audit-textos.txt`, ahora regenerados sobre el código corregido).

| # | Estado | Fix | Evidencia |
|---|---|---|---|
| P0-1 | **Resuelto** | `app/panel/page.tsx:383-395` — "Abrir" es `<Link href=/panel/solicitud/{id}>`; se elimina el `onClick` del `<tr>` | `audit-teclado.mjs`: antes 0 entradas al detalle → **ahora 4** (una por fila), `conOnClick: 0`, `spanRoleLink: []`. Enter sobre el enlace navega (URL verificada en `fix-metricas.json → teclado.urlTrasEnter`) |
| P0-2 | **Resuelto** | `DetalleSolicitud.tsx:240-343` (fila 1 = Volver + kebab "⋯ Más", fila 2 = pasos a ancho completo; `sm+` mantiene la fila anterior) + `CargaCotizaciones.tsx:270,340,436` (las acciones de cada card bajan a su propia fila en `<sm`) | `fix-10-movil-detalle-390.png`: los 3 pasos miden 97×60 px y caben; `movil.kebab=true`; "Cancelar solicitud" 254×45 px dentro del viewport y su modal abre (`modalCancelarAbierto: true`). `recorte: []` y `targetsPequenos: []` a 390 px (antes: recorte + 2 targets de 31 px) |
| P1-3 | **Resuelto** | `app/api/solicitudes/route.ts:12-20` — `soloEnviadasACompras()` excluye estados pre-envío en el endpoint, no en la UI | Panel: **4 filas** (antes 7), 0 filas "Pipe Test", contadores 2+1+0+1=4. `app/api/solicitudes/route.test.ts` (3 tests) |
| P1-4 | **Resuelto** | `CargaCotizaciones.tsx:142-162` (cabecera) y `:290-330` (avisos por cotización) + estado vacío terminal (`:420-430`) | `audit-textos.txt → detalle-0007-cerrada`: **0 imperativos** (`Cargá\|Agregá\|Verificá\|MÍNIMO 2\|antes de comparar\|Requiere aclaración` → `[]`). `fix-06-rfq0007-terminal.png`. 6 tests en `CargaCotizaciones.test.tsx` |
| P1-5 | **Resuelto** | `app/panel/page.tsx:93-127` + rama de error con "Reintentar" (`:268-288`); `DetalleSolicitud.tsx:133-173` + rama de error (`:400-418`) | Test de panel: un `TypeError` de red muestra "No pudimos traer tu bandeja" y **no** "No tenés solicitudes asignadas"; el mensaje del servidor ("No autenticado") se muestra tal cual. Test de detalle: la lista vacía no se muestra y "Reintentar" recarga |
| P2-6 | **Resuelto** | `app/panel/page.tsx:288-327` (búsqueda) y `:309-323` (filtro sin coincidencias) | `audit-textos.txt → panel-busqueda-vacia`: "Sin resultados para «zzzz» / Revisá la referencia… / Limpiar búsqueda" con "0 resultados". 3 tests (búsqueda, filtro y bandeja vacía) |
| P2-7 | **Resuelto** | `DetalleSolicitud.tsx:19-25` (labels planos) + `:320-345` ("Paso X de 3" + barra de pasos) | `fix-03-detalle-0008-1440.png` y `fix-10-movil-detalle-390.png`: "Paso 1 de 3 · Cotizaciones" + botones "07 Cotizaciones / 08 Comparativa / 09 Recomendación" con el número como apoyo. Explica el bloqueo: "Comparativa se habilita con 2 cotizaciones cargadas". 2 tests |
| P2-8 | **Resuelto** | `app/panel/page.tsx:193-213` (KPI = contador puro, no clicable) + `:219` (`aria-pressed` en los chips) | Test: la etiqueta aparece 2 veces pero solo 1 como botón; el chip activo expone `aria-pressed="true"`. Coherente con los tabs del detalle, que ya lo traían |
| P2-9 | **Parcial** | Todo el coordinator flow: `app/panel/page.tsx`, `DetalleSolicitud.tsx`, `CargaCotizaciones.tsx`, `Recomendacion.tsx`, `Comparativa.tsx` | Elementos <12 px en `/panel`: **antes 14 → ahora 14**, pero los 6 `th` a 10 px son la excepción de tabla que la propia auditoría acepta. Los 8 restantes (11 px y 9 px) viven en `components/Badge.tsx` y `components/Semaforo.tsx`, **compartidos con el flujo solicitante y fuera del alcance de escritura de este bloque**. `targetsPequenos` en móvil: 2 → **0** |
| P3-10 | **Resuelto** | `app/panel/page.tsx:355-362` (celda) + `:413-419` (`referenciaDe`) | `referenciaInventada: 0` (0 coincidencias de `SOL-` en el panel). Test: "Sin referencia" con el id interno en `title` |
| P3-11 | **Resuelto** | `components/coordinador/Modal.tsx` (extraído del `Modal` local de `CargaCotizaciones.tsx` y reutilizado por ambos) + modales en `DetalleSolicitud.tsx:530-620` | `fix-05-modal-cancelar.png` / `fix-04-modal-reabrir.png` / `fix-12-movil-modal-cancelar.png`. El recorrido registra `dialog nativo: 0` (antes 2 `window.confirm`). 3 tests, incluido "window.confirm no se llama" |
| P3-12 | **Resuelto** | `CargaCotizaciones.tsx:171,276,296,341,392` + `app/panel/page.tsx:389` (y helpers `tonoFormato`/`tonoConfianza`/`tonoAdjuntar` en `:550-561`) | `detect.mjs`: **6 hits → 0**. Al limpiar aparecieron 2 hits de ternarios en la misma línea (`bg-slate-50` junto a `bg-amber-50`): se movieron a helpers `tonoFormato` / `tonoConfianza` / `tonoAdjuntar` |

**Regresiones comprobadas:** el bloqueo B3 sigue activo (`enviar-bloqueado.disabled: true`), el paso 08 de RFQ-0010 sigue deshabilitado y su clic rechazado (`tab08-disabled-en-0010`), RN-01 intacto (el textarea de recomendación sigue bloqueando el envío sin criterio) y el `NOTAS` del recorrido completo vuelve a `[]` (0 diálogos nativos, 0 pasos fallidos).

**Ajuste al harness:** `audit-coord.mjs` cerraba los `window.confirm` con el handler de `page.on("dialog")`; como P3-11 los sustituye por modales in-app, el guion ahora captura el modal y pulsa "Volver" (si no, el overlay bloquea los pasos siguientes). No se cambió ninguna aserción del guion.

**QA adversarial (`validate`) — 3 hallazgos propios corregidos en este bloque:**

1. `.catch(() => undefined)` en `generarComparativa` (`DetalleSolicitud.tsx:195-197`) hacía que un fallo de generación se renderizara como *"Se necesitan al menos 2 cotizaciones"*. Es el mismo patrón que P1-5 en otro sitio: ahora hay estado `error` + "Reintentar" (`DetalleSolicitud.tsx:182-209,426-446`) con test.
2. La recarga tras crear/editar/eliminar una cotización hacía parpadear la lista ("Cargando cotizaciones…"). Separada en dos caminos: `recargarCotizaciones()` silencioso y `reintentarCotizaciones()` con estado de carga (`:163-173`, `DetalleSolicitud.tsx`).
3. El estado vacío solo se ramificaba por búsqueda: el filtro "Esperando decisión" con 0 filas seguía diciendo "No tenés solicitudes asignadas". Ahora tiene su rama con "Ver todas" (`app/panel/page.tsx:309-323`).

---

## Veredicto de especificidad — 2.5/4

El sistema es claramente de compras: la vocabulario (`bandeja`, `re-cotizar`, `comparativa`, `semáforo`, RN-01, categorías BIA) y la máquina de estados son propios del dominio. Pero la *superficie* es un kit reutilizable de "dashboard AI": fondo gradiente ambiental, cards de vidrio, etiquetas uppercase de 10–11px con tracking amplio, botones píldora. La especificidad vive en el contenido y en el estado, no en la piel.

---

## Nielsen — 23/40

| # | Heurística | Nota |
|---|---|---|
| 1 | Visibilidad del estado | **2** — badges, semáforo y contadores son honestos, pero el coordinador no tiene *tracker* en su propio journey (`TrackerEtapas` solo se usa en `app/mis-solicitudes/*`) y el tab 08 deshabilitado no explica por qué. |
| 2 | Correspondencia sistema–mundo real | **2** — español de Honduras y dominio correctos; pero "07 · Cotizaciones" filtra numeración interna y `BORRADOR` filtra vocabulario del lado solicitante. |
| 3 | Control y libertad | **2** — hay Volver / Editar / Reabrir / Cancelar, pero `window.confirm` sin resumen de impacto y **en móvil "Cancelar solicitud" es inalcanzable**. |
| 4 | Consistencia y estándares | **2** — los 4 KPIs y los 5 chips codifican los mismos 4 estados dos veces; `<tr onClick>` y `<span role="link">` no son HTML válido ni accesible. |
| 5 | Prevención de errores | **3** — lo más fuerte: mínimo 2 cotizaciones, bloqueo duro B3, RN-01, RN-06, avisos de confianza. Débil: la acción destructiva está a 2 posiciones del tab activo, con el mismo peso visual. |
| 6 | Reconocer en vez de recordar | **3** — filtros, badges, semáforo y referencia visibles. Débil: "MÍNIMO 2 PARA COMPARATIVA" es críptico y los pasos 07/08/09 exigen recordar el flujo. |
| 7 | Flexibilidad y eficiencia | **2** — buscador + filtros + atajos de KPI, pero sin ruta por teclado, sin ordenar por urgencia, sin acciones en lote, y los filtros no cubren `BORRADOR`. |
| 8 | Diseño estético y minimalista | **2** — limpio y coherente con el solicitante, pero KPI duplicados, muro de 16 chips de confianza y mucho texto de 10–11px. |
| 9 | Errores: reconocer y recuperar | **2** — hay banners, pero sin validación por campo, sin CTA de reintento, y un fallo de red se renderiza igual que "no tienes solicitudes". |
| 10 | Ayuda y documentación | **3** — existe `docs/guias/manual-coordinador.md`; en producto, cero. RN-01/B3/RN-06 solo se explican vía `title` (solo hover, muerto en táctil). |

---

## Carga cognitiva — 6 de 8 fallan

| Ítem | Veredicto |
|---|---|
| ¿Entiende qué hacer primero? | **Falla** — sin tracker; "07" no significa nada. |
| ¿Sabe en qué estado está? | Pasa — badge + semáforo coherentes con los contadores. |
| ¿Entiende qué falta? | **Falla parcial** — dice "Mínimo 2", no "faltan 2 cotizaciones"; el tab 08 deshabilitado no da razón. |
| ¿Puede corregir errores? | **Falla** — un fallo de carga se ve igual que una bandeja vacía. |
| ¿Puede deshacer? | Parcial — "Reabrir" existe pero nadie dice que invalida el enlace ya enviado. |
| ¿Los mensajes son claros? | **Falla** — una solicitud cerrada sigue ordenando "Cargá", "Verificá", "Requiere aclaración". |
| ¿La jerarquía es evidente? | Pasa en desktop. |
| ¿La densidad es tolerable? | **Falla** — 16 chips de confianza, 14 textos <12px, 4 KPIs + 5 chips duplicados. |

**Puntos de decisión con >4 opciones visibles:** el panel ofrece 2 acciones × 7 filas + 4 KPIs + 5 chips = **23 targets interactivos** sobre el fold, sin acción primaria. La barra del detalle mete **7 controles en una fila** (Volver, Reabrir, Editar, Cancelar, 07, 08, 09).

---

## Recorrido emocional

**El mejor momento:** la banda de cierre en RFQ-0007 — *"El solicitante eligió Imprenta CostaPrint S. de R.L. · 22/9/2026"* — y la confirmación del paso 09 con el enlace público. Cierra el ciclo con dignidad.

**El peor momento:** abrir RFQ-0007 (cerrada, ya decidida) y que la app te diga *"Cargá cada oferta con sus datos"*, *"Verificá estos datos antes de generar la comparativa"* y *"Requiere aclaración con el proveedor antes de comparar"*. **La app contradice su propio mensaje de éxito.** Segundo peor: el móvil, donde el core job del coordinador es prácticamente inejecutable.

---

## Fortalezas

1. **La máquina de estados es honesta y legible.** El vocabulario de badges (`Activa` / `Esperando cotizaciones` / `Esperando decisión` / `Cerrada`) es exactamente el modelo mental del coordinador y calza con los contadores.
2. **RN-01 se respeta en la UI, no solo en el backend.** El paso 09 dice *"Podés contradecir la sugerencia de la IA sin fricción"*, el bloque de IA está etiquetado *"Solo un insumo"* y el botón de envío se bloquea con una **explicación humana** en vez de un `disabled` mudo.
3. **La incertidumbre de la IA se hace visible en vez de esconderse.** Los marcadores *"⚠ no especifica"*, la confianza por campo y el *"Revisión manual requerida"* con la lista exacta de campos son un trabajo de confianza que casi ninguna app hace.

---

## Hallazgos priorizados

### P0-1 · Un usuario de teclado o lector de pantalla **no puede abrir ninguna solicitud** del panel

**Evidencia:** 7 `<tbody tr>`, los 7 con `onClick`, **0 focusables**. Los 7 `span[role="link"]` tienen `tabIndex: -1`. En `/panel` hay 11 paradas de teclado y **ninguna lleva al detalle**.
`app/panel/page.tsx:262-265` (onClick en `<tr>`), `app/panel/page.tsx:293-300` (`<span role="link">`).

`role="link"` sin `tabindex` es lo peor de ambos mundos: un lector de pantalla anuncia "enlace" y no hay forma de activarlo.

**Fix:** convertir "Abrir" en un `<Link href>` real (o `<button>`); quitar el `onClick` de la fila o añadir `tabIndex={0}` + `onKeyDown` + `role` + `aria-label` con la referencia.

---

### P0-2 · En móvil la barra de acciones recorta "Cancelar solicitud" y **el grupo de tabs 07/08/09 desaparece**

**Evidencia:** `audit-17-movil-detalle.png` a 390px. "Cancelar s…" cortado en el borde derecho; los tabs no están. La barra es un único `flex items-center justify-between` sin wrap ni apilado responsive (`components/coordinador/DetalleSolicitud.tsx:184-239`), y el shell ancestro tiene `overflow-hidden`, así que el contenido **se recorta en vez de desplazarse** — por eso la métrica `overflowX: false` es un falso negativo.
Además: el heading "Cotizaciones de proveedores" parte en 3 líneas, los botones "Adjuntar archivo"/"Editar" desbordan la card, y "Generar comparativa" se solapa con su propio texto.

**Fix:** apilar la barra (`flex-col` en pequeño), sacar los tabs a su propia fila de ancho completo, y meter "Cancelar solicitud" en un menú "⋯ más" en móvil.

---

### P1-3 · Borradores **no enviados de otros usuarios** ensucian la bandeja del coordinador, y ningún filtro los saca

**Evidencia:** `audit-03-panel.png` filas 5–7. En DB: 3 filas `BORRADOR`, solicitante "Pipe Test" (`pipeline@bia.hn`), creadas 2026-08-13/14, asignadas a `...0002`. `ESTADO_FILTRO` (`app/panel/page.tsx:66-74`) no tiene `BORRADOR`, así que aparecen **solo en "Todos" (7 filas)** y quedan fuera de los 4 filtros (2+1+0+1 = 4). Además muestran *"43 días de gestión"* y un semáforo **verde** *"Sin fecha límite"*: parecen trabajo sano que nunca avanza.

**Fix:** excluir estados pre-envío en la **API** del listado del coordinador, no en la UI.

---

### P1-4 · Una solicitud cerrada sigue ordenando al coordinador hacer el trabajo

**Evidencia:** `audit-15-detalle-0007-cerrada.png`. Banner verde "Solicitud cerrada con decisión" y, justo debajo, "Cargá cada oferta con sus datos…", "MÍNIMO 2 PARA COMPARATIVA", "Verificá estos datos antes de generar la comparativa", "Revisión fiscal: … Requiere aclaración con el proveedor antes de comparar".
Origen: la cabecera de `components/coordinador/CargaCotizaciones.tsx:143-146` y los bloques de aviso por cotización **no** se condicionan con `soloLectura` — solo los botones (`:156-165` y `:391-416`).

**Fix:** propagar el estado terminal y cambiar la copy de cabecera; suprimir los avisos accionables cuando `terminal`.

---

### P1-5 · Un fallo al cargar la lista se renderiza silenciosamente como "no tienes solicitudes"

**Evidencia:** `app/panel/page.tsx:96` → `.catch(() => setSolicitudes([]))`. Un 500 o un corte de red es indistinguible de una bandeja vacía. La UI de error en `:231-238` solo se dispara cuando `!sesion?.localId`.
`DetalleSolicitud.tsx:124` tiene el mismo patrón (`.catch(() => setCotizaciones([]))`).

**Fix:** estado `error` real + la rama de error existente con CTA de reintento.

---

### P2-6 · Una búsqueda sin resultados muestra el estado vacío equivocado

**Evidencia:** `audit-05-panel-busqueda-vacia.png`. Tras escribir `zzzz` el texto capturado es *"No tenés solicitudes asignadas / Cuando te asignen una categoría, aparecerán acá."* con contador *"0 resultados"*.
`app/panel/page.tsx:239-246` no ramifica según haya búsqueda activa.

**Fix:** ramificar el estado vacío según `busqueda`; ofrecer "limpiar búsqueda".

---

### P2-7 · "07 / 08 / 09" es jerga interna, y el coordinador no tiene sentido de posición

**Evidencia:** `DetalleSolicitud.tsx:150-154`. `grep` confirma que `TrackerEtapas` solo se usa en `app/mis-solicitudes/[id]/page.tsx:84` y `app/mis-solicitudes/page.tsx:135` — el journey del coordinador no tiene ninguna barra de progreso, aunque el componente existe y funciona.

**Fix:** labels planos ("Cotizaciones", "Comparativa", "Recomendación") + tracker o "Paso 1 de 3".

---

### P2-8 · El panel codifica los mismos 4 estados dos veces, y ninguno de los dos selectores expone su estado

**Evidencia:** `audit-03-panel.png`. 4 tarjetas KPI + 5 chips de filtro con los mismos 4 estados. Ni las KPI (`page.tsx:166-179`) ni los chips (`:187-198`) tienen `aria-pressed`/`aria-current`, mientras que los tabs del detalle sí lo tienen (`DetalleSolicitud.tsx:227`). Inconsistencia interna verificable.

**Fix:** `aria-pressed` en ambos; y decidir si las KPI son contadores puros (no clicables) o si sobran los chips.

---

### P2-9 · Texto de 10–11 px por todo el flujo

**Evidencia:** 14 elementos <12px en `/panel` y 14 en el paso 09 (`audit-metricas.json`): "Coordinador" 10px, "7 resultados" 11px, "Carlos Melara" 11px, "Salir" 11px, "✓ Pros" 11px, "Solo un insumo" 10px, y el propio píldor "Abrir" a 11px (`page.tsx:296`). 2 targets a 31px en móvil.

**Fix:** piso de 12px. El `thead` a 10px (`page.tsx:251`) es el único sitio aceptable por convención de tabla.

---

### P3-10 · Referencias sintéticas que no existen en ningún documento

**Evidencia:** el panel muestra `SOL-F40B42A0`, `SOL-DAAF118A`, `SOL-EC35649B`; en DB esas filas tienen `numero_referencia` NULL. Provienen del fallback `app/panel/page.tsx:315-320` (`SOL-${id.slice(0,8)}`). Si el coordinador cita `SOL-F40B42A0` a un proveedor, está citando una cadena que no está en ningún lado.

**Fix:** "Sin referencia" + id interno en tooltip, o backfill de referencias reales.

---

### P3-11 · `window.confirm` nativo para acciones irreversibles

**Evidencia:** `DetalleSolicitud.tsx:44` y `:83`. Diálogos capturados: *"¿Cancelar esta solicitud? El proceso se cerrará y quedará registrado como CANCELADA."* y *"¿Reabrir para re-cotizar? La solicitud vuelve a «En cotización»…"*. Sin resumen de impacto, sin estilo, y el de cancelar ni siquiera se puede abrir en móvil.

**Fix:** modal in-app que diga la consecuencia concreta (incluido si el enlace público deja de funcionar).

---

### P3-12 · Contraste `gray-on-color` (6 hits del detector)

`app/panel/page.tsx:296` (`text-slate-700` sobre hover `bg-sky-50`); `CargaCotizaciones.tsx:160` (slate-600/sky-50), `:257` (slate-600/sky-50), `:284` (slate-600/amber-50), `:311` (slate-700 y slate-900/green-50). slate-700 sobre sky-50 ≈ 4.0:1, por debajo de 4.5 para texto pequeño.

**Fix:** primer tono del mismo matiz (`sky-800`, `amber-800`, `emerald-800`).

**Nota sobre el detector:** los 6 son legítimos pero de baja señal — la regla dispara ante cualquier `text-slate-*` sobre `bg-*-50`, y en este código ese combo es un patrón deliberado de "card teñida". El problema real es el **tamaño** (11px), no el tono. No se detectaron falsos positivos de otras reglas: el resto del flujo salió limpio.

---

## Red flags por persona

**Alex (power user, 200 cotizaciones/mes)** — no llega a nada por teclado (0 de 11 paradas abren una solicitud); no puede ordenar por urgencia, así que revisa las 7 filas para encontrar la que está en riesgo; no hay acciones en lote; el muro de 16 chips de confianza le cuesta más de lo que informa.

**Jordan (primer día)** — "07 · Cotizaciones" no significa nada; "MÍNIMO 2 PARA COMPARATIVA" no dice qué hacer; RN-01 / B3 / RN-06 son jerga sin explicación en producto; las 3 filas `BORRADOR` de "Pipe Test" parecen trabajo real que debería tomar.

**Sam (accesibilidad)** — P0-1 (no puede abrir ninguna solicitud), P2-8 (los dos selectores sin estado anunciado), 10–11px de texto, 2 targets de 31px en móvil, ayuda solo en `title` (inútil en táctil), y "Abrir" anunciado como enlace pero no focusable.

---

## Consola

Sin errores de aplicación. 6 mensajes: un `404` en un recurso estático y 5 warnings de `@supabase/supabase-js` sobre usar el objeto `user` de `getSession()` (ruido conocido de la librería, no un defecto de esta UI).

## Foco por teclado (login)

9 de 12 paradas con indicador visible. Las 3 restantes caen en `BODY` entre ciclos del tab order — normal en una página con 3 controles. El login no tiene problema de foco; el problema está en el panel (P0-1).

---

## Orden de arreglo sugerido

1. **P0-1** — filas del panel accesibles (1 línea de arquitectura, desbloquea a todo el mundo).
2. **P0-2** — barra de acciones responsive en el detalle.
3. **P1-3** — excluir pre-envío en la API del coordinador.
4. **P1-4** — copy de estado terminal en `CargaCotizaciones`.
5. **P1-5** — estado de error real en el panel.
6. P2-6 a P2-9 en un mismo bloque de pulido.
7. P3-10 a P3-12 como limpieza.
