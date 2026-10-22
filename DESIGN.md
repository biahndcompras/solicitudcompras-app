# DESIGN.md — Portal de Compras BIA

Sistema de diseño del portal, derivado de la referencia `frontend-reference/restoboard-nextjs`
(RestoBoard). **Ningún valor de este documento es inventado**: cada uno cita el archivo del que
sale. Lo que la referencia no tiene está marcado `NO EXISTE EN LA REFERENCIA` con una propuesta
construida solo con tokens existentes.

Las rutas citadas son relativas a `frontend-reference/restoboard-nextjs/` salvo que se diga otra cosa.

---

## 0. Regla de oro

1. Un valor nuevo en la UI se toma de este documento. Si no está, se agrega acá **con su fuente**
   antes de usarlo.
2. La referencia es la fuente de verdad **visual**; el PRD y `AGENTS.md` son la fuente de verdad
   **funcional**. Cuando choquen (p. ej. tamaño táctil), gana la funcionalidad y se documenta la
   desviación.
3. No se introducen colores, sombras, tamaños ni animaciones fuera de este sistema.

---

## 1. Carácter

> «Calm, dense and exact. […] reads like a well-set instrument panel, not a marketing page. Most of
> the screen is white. A near-black band carries the live, urgent data. Color is rare, so when it
> appears it means something.»
> — `DESIGN.md` (Character)

Traducción operativa para Compras:

- **Fondo blanco** para todo el trabajo; **banda casi negra** (`#010120`) solo para el sidebar, la
  sección de «pulso» del dashboard, la pantalla de acceso y los toasts críticos.
- **Hairlines** (1px gris) separan; **no** se usan sombras salvo capas flotantes (menús, modales,
  toasts).
- **Color escaso y con significado**: negro = acción/dato principal; menta = ahora/seleccionado;
  periwinkle = comparación/en curso; rojo = requiere que alguien actúe; verde = bien/confirmación.
- **Un solo botón primario por área.**
- El **listón** (ribbon) es el único elemento decorativo y aparece **una vez por pantalla** (hero del
  dashboard o pantalla de acceso). Nunca en botones, gráficas ni textos.

---

## 2. Tokens

### 2.1 Primitivos

Fuente: `styles/tokens.css:8-21`.

| Token | Valor | Uso |
|---|---|---|
| `--rb-black` | `#000000` | Tinta, acción primaria |
| `--rb-white` | `#ffffff` | Lienzo |
| `--rb-navy-950` | `#010120` | Superficies oscuras |
| `--rb-navy-800` | `#26263a` | Bordes sobre oscuro |
| `--rb-navy-400` | `#9999a6` | Texto secundario sobre oscuro |
| `--rb-slate-700` | `#313641` | Elevación sobre oscuro |
| `--rb-grey-400` | `#959494` | Texto secundario |
| `--rb-grey-100` | `#ebebeb` | Hairline, superficies suaves |
| `--rb-orange-500` | `#fc4c02` | Listón (inicio) |
| `--rb-magenta-500` | `#ef2cc1` | Listón (medio) |
| `--rb-periwinkle-200` | `#bdbbff` | Listón (fin), serie secundaria |
| `--rb-mint-100` | `#c8f6f9` | «Ahora», selección |
| `--rb-red-600` | `#d92d20` | Crítico |
| `--rb-green-700` | `#067647` | Éxito |

### 2.2 Semánticos y utilidad Tailwind

Fuente: `styles/tokens.css:24-43` (semánticos) y `app/globals.css:5-32` (mapeo a Tailwind).

| Token semántico | Valor | Utilidad | Uso |
|---|---|---|---|
| `--color-bg-canvas` | `#ffffff` | `bg-canvas` | Fondo de página y de panel |
| `--color-bg-canvas-dark` | `#010120` | `bg-canvas-dark` | Sidebar, banda viva, auth |
| `--color-bg-surface-soft` | `#ebebeb` | `bg-surface-soft` | Cabeceras de tabla, hover, tracks |
| `--color-bg-surface-dark-soft` | `#313641` | `bg-surface-dark-soft` | Elementos elevados sobre oscuro |
| `--color-bg-primary` | `#000000` | `bg-primary` | Acción principal |
| `--color-bg-accent-mint` | `#c8f6f9` | `bg-mint` | Ahora / seleccionado |
| `--color-bg-accent-periwinkle` | `#bdbbff` | `bg-periwinkle` | Comparación / en curso |
| `--color-bg-critical` | `#d92d20` | `bg-critical` | Fondo crítico |
| `--color-text-ink` | `#000000` | `text-ink` | Texto principal |
| `--color-text-body` | `#959494` | `text-body` | Texto secundario (no accionable) |
| `--color-text-on-dark` | `#ffffff` | `text-on-dark` | Texto sobre oscuro |
| `--color-text-on-dark-muted` | `#9999a6` | `text-on-dark-muted` | Secundario sobre oscuro |
| `--color-text-critical` | `#d92d20` | `text-critical` | Crítico |
| `--color-text-success` | `#067647` | `text-success` | Éxito |
| `--color-border-hairline` | `#ebebeb` | `border-hairline` / `shadow-[inset_0_0_0_1px_...]` | Separadores |
| `--color-border-on-dark` | `#26263a` | `border-on-dark-line` | Separadores sobre oscuro |
| `--color-border-strong` | `#000000` | (focus) | Anillo de foco |
| `--color-gradient-orange/magenta/periwinkle` | ver primitivos | (solo listón) | Degradado de marca |

### 2.3 Radios, elevación y movimiento

Fuente: `styles/tokens.css:60-73`, replicado en `app/globals.css:27-32`.

| Token | Valor | Uso |
|---|---|---|
| `--radius-none` | `0` | — |
| `--radius-xs` | `3.25px` | Chips, checkbox |
| `--radius-sm` | `4px` | Botones, inputs, paneles, badges |
| `--radius-md` | `8px` | Solo overlays grandes |
| `--radius-full` | `9999px` | Punto del logo, badges de notificación |
| `--shadow-soft-drop` | `0 4px 10px 0 rgb(1 1 32 / 0.1)` | Menús, modales, toasts |
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | Toda animación |
| `--duration-fast` | `160ms` | Hover |
| `--duration-base` | `320ms` | Cambios de estado |
| `--duration-slow` | `700ms` | Revelados |

> **Aviso:** `--radius-sm` está redefinido a `4px` en `@theme` (`app/globals.css:28`), así que en
> Tailwind `rounded-sm` **no** es el `0.125rem` por defecto. Usar `rounded-sm` = 4px.

### 2.4 Espaciado (hallazgo importante)

`styles/tokens.css:46-57` declara una escala (`--spacing-xxs` 2px … `--spacing-section` 80px),
**pero no se mapea a `@theme` y ningún componente la usa**. Lo que realmente se renderiza es la
escala numérica de Tailwind (base 4px):

| Clase | Valor efectivo | Dónde se usa |
|---|---|---|
| `h-7` | 28px | Botón sm, tabs, segmented |
| `h-8` | 32px | Botón md, filtros, paginación |
| `size-8` | 32px | Avatar, botón de fila |
| `size-9` | 36px | IconButton, botón de menú |
| `h-10` | 40px | Inputs, buscador |
| `size-12` | 48px | Empty state |
| `gap-4` / `p-4` | 16px | Rejillas, panel compacto |
| `p-6` / `gap-6` | 24px | Panel, secciones |
| `px-4` / `px-8` | 16 / 32px | Margen lateral de página |
| `pb-16` | 64px | Aire inferior de página |

**Decisión:** se documenta y usa la **escala numérica** (la que renderiza). Los tokens
`--spacing-*` quedan como referencia histórica; no se usan en código nuevo.

---

## 3. Tipografía

Fuente: `app/layout.tsx:3-5` (carga), `app/globals.css:22-23` (familias) y `app/globals.css:34-58`
(escala).

- **Inter Variable** para todo lo que se lee. **Geist Mono** para etiquetas, botones, cabeceras de
  tabla, cifras de eje y timestamps.
- Cargadas con `@fontsource-variable/inter` y `@fontsource/geist-mono/400.css` + `/500.css`
  (`app/layout.tsx`). En el proyecto real se instalan los mismos paquetes para que las métricas
  coincidan; **no** sustituir por JetBrains Mono.
- `body` aplica `font-feature-settings: "ss01", "tnum"` (`app/globals.css`, `@layer base`), así que
  las cifras son tabulares por defecto. Además, toda cifra que cambia usa `tabular-nums`.

### Escala

| Utilidad | Tamaño / línea / tracking / peso | Fuente |
|---|---|---|
| `text-display-xxl` | 64 / 70.4 / −1.92 / 500 | `app/globals.css:34-37` — **sin uso** en la referencia |
| `text-display-xl` | 40 / 48 / −0.8 / 500 | `app/globals.css:38-41` |
| `text-display-lg` | 28 / 32.2 / −0.42 / 500 | `app/globals.css:42-45` |
| `text-display-md` | 22 / 25.3 / −0.22 / 500 | `app/globals.css:46-49` |
| `text-body-lg` | 18 / 23.4 / −0.18 / 400 | `app/globals.css:50-52` |
| `text-body-md` | 16 / 20.8 / −0.16 / 400 | `app/globals.css:53-55` |
| `text-caption` | 14 / 19.6 / 0 / 400 | `app/globals.css:56-57` |

### Utilidades mono

Fuente: `app/globals.css:61-91`.

| Utilidad | Tamaño / línea / tracking | Uso |
|---|---|---|
| `eyebrow` | 11 / 11 / 0.55px, 500, mayúsculas | Etiquetas de sección, KPIs, cabeceras |
| `mono-label` | 11 / 15.4 / 0.055px, 500, mayúsculas | Chips, contadores, botón sm |
| `mono-button` | 16 / 16 / 0.08px, 500, mayúsculas | Botón md |
| `mono-caption` | 10 / 14 / 0.05px, 400 | Ejes de gráfica, timestamps |

**Reglas:** títulos de display en peso 500 con tracking negativo; nunca 700. El gris de cuerpo
(`#959494`) es solo para metadatos, **nunca** para algo que el usuario deba leer para actuar
(`DESIGN.md` → Accessibility).

---

## 4. Layout

### 4.1 Shell

Fuente: `components/layout/AppShell.tsx`.

- Contenedor `flex min-h-dvh bg-canvas`.
- Sidebar fija: **248px** expandida, **72px** colapsada, animada con spring 380/40
  (`components/layout/Sidebar.tsx`).
- Main: `px-4 pt-6 pb-16 sm:px-8 sm:pt-8`; contenido en columna `gap-6`.
- **Entrada de página**: `opacity 0 → 1`, `y 14 → 0`, `0.5s`, ease de la casa, `key={pathname}`
  (`AppShell.tsx`).
- En `lg` (1024px) el sidebar se vuelve **drawer** de `280px` / `max-w-[85vw]` con overlay
  `bg-canvas-dark/60` y spring 420/42.

### 4.2 PageHeader

Fuente: `components/layout/PageHeader.tsx`.

- `sticky top-0 z-30`, márgenes negativos `-mx-4 px-4 sm:-mx-8 sm:px-8`.
- Al superar **12px** de scroll (`y > 12`) se condensa: fondo `bg-canvas/90`, `py-3`,
  `backdrop-blur-md`, hairline inferior y el título escala a **0.82** (spring 300/30).
- Subtítulo y breadcrumbs se pliegan con animación de altura.
- Buscador: `h-10`, ancho `sm:w-64`, atajo `/`, `kbd` con el atajo.
- Botón de menú móvil: `size-9`, visible `<lg`.

### 4.3 Paneles y rejillas

Fuente: `components/ui/primitives.tsx` (`Panel`), `components/dashboard/OverviewScreen.tsx`.

- Panel: `rounded-sm bg-canvas p-6` + `shadow-[inset_0_0_0_1px_var(--color-border-hairline)]`,
  columna `gap-5`. Título `text-display-md`; subtítulo `text-caption text-body`; acción a la derecha.
- Rejillas: `gap-4` (16px). Secciones: `gap-6` (24px).
- Dashboard: KPIs `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`; contenido
  `xl:grid-cols-[minmax(0,1fr)_388px]` (riel derecho de **388px**).
- `SummaryStrip`: `grid-cols-2 lg:grid-cols-4`, celdas `px-6 py-5` con hairlines internos.
- Tablas: cabecera `bg-surface-soft`, `eyebrow` en `text-body`, filas `py-2.5`/`py-3` con
  `border-b border-hairline`; contenedor con scroll horizontal y `min-w-[760px]` cuando hace falta.
- Sidebar: `px-4 py-6`, ítems `h-10 gap-3 rounded-sm`, contadores `mono-label`, grupos con `eyebrow`.

### 4.4 Acceso

Fuente: `components/screens/auth/AuthLayout.tsx`.

- `grid min-h-dvh lg:grid-cols-[1fr_620px]`.
- Izquierda oscura `px-6 py-10 sm:px-14 sm:py-12`, listón al 62% de alto, titular `30/36` en móvil y
  `sm:text-display-xl`, estadísticas en `display-lg`.
- Derecha `max-w-[400px]`, entrada `0.7s` con `y 16`.
- Pie `mono-caption` (versión, términos, privacidad).

---

## 5. Color con significado (mapa BIA)

Fuente: `DESIGN.md` (Color meaning) + `components/ui/primitives.tsx` (tonos de `Badge`).

| Significado | Token | Dónde |
|---|---|---|
| Acción principal / dato principal | `bg-primary` (negro) | Botón primario, serie principal de gráficas |
| «Ahora» / seleccionado | `bg-mint` | KPI actual, fila seleccionada, barra de hoy |
| Comparación / en curso | `bg-periwinkle` | Serie secundaria, estados en proceso |
| Requiere acción | `text-critical` / `bg-critical` | Vencido, sin decisión, cancelado |
| Bien / confirmación | `text-success` | Deltas positivos, cierre con decisión |
| Neutro | `bg-surface-soft` + hairline | Estados sin urgencia |

### Mapa de estados del portal

`NO EXISTE EN LA REFERENCIA` (RestoBoard no tiene estados de solicitud). Propuesta **solo con
tokens existentes**; se implementa como `Badge`:

| Estado BIA | Tono de `Badge` | Por qué |
|---|---|---|
| Activa (`ENVIADA_A_COMPRAS`) | `dark` | Neutro operativo, sin urgencia |
| Esperando cotizaciones (`EN_COTIZACION`) | `periwinkle` | «En curso» |
| Comparativa lista (`COMPARATIVA_LISTA`) | `mint` | «Ahora»: es la acción de Compras |
| Esperando decisión (`ENVIADA_A_SOLICITANTE`) | `mint` + contorno | En espera de un tercero |
| Cerrada con decisión | `success` (contorno) | Confirmación |
| Cerrada sin decisión | `neutral` | Fin sin acción |
| Cancelada | `critical` (contorno) | Requiere lectura |
| Retrasada / sin decisión > umbral | `solid-critical` | Requiere que alguien actúe |

**No hay ámbar en la referencia.** El «por vencer» del semáforo se resuelve con `periwinkle`
(informativo) y el «retrasado» con `critical`; no se introduce un amarillo nuevo.

---

## 6. Componentes

Todos viven en `components/ui` y `components/layout` de la referencia. Se portan **tal cual**,
cambiando solo el router (`Link`, `usePathname`, `useRouter` → `next/link`, `next/navigation`).

### 6.1 Primitivas — `components/ui/primitives.tsx`

| Componente | Anatomía / valores |
|---|---|
| `Button` | `md`: `h-8 px-5` + `mono-button`; `sm`: `h-7 px-3.5` + `mono-label`; `active:scale-[0.97]`; variantes `primary` (negro), `mint`, `white`, `outline` (hairline), `ghost-dark`; icono con micro-movimiento (plus rota 90°, download baja) |
| `IconButton` | `size-9` (36px), `rounded-sm`, hairline o `bg-surface-dark-soft`; **siempre** `aria-label` |
| `Badge` | `h-6`, `px-2`, `text-caption`, `rounded-sm`; tonos `neutral`, `dark`, `mint`, `periwinkle`, `success`, `critical`, `solid-critical` |
| `Avatar` | `size-8`, **cuadrado**, `mono-label`; tonos `mint`/`periwinkle`/`neutral` |
| `Segmented` | Track `bg-surface-soft p-1 rounded-sm`; opción activa negra con `layoutId` (spring 520/40); `role="radiogroup"` |
| `Logo` | Mark de 4 celdas (3 cuadrados + 1 punto redondo) + `text-display-md` |
| `Panel` | Ver §4.3 |

### 6.2 Formularios — `components/ui/forms.tsx`

| Componente | Valores |
|---|---|
| `Checkbox` | Caja `18px`, `rounded-xs`, borde negro; check con spring 600/30 |
| `Toggle` | Track `h-5 w-9` (no píldora), pulgar `size-3.5`; `role="switch"` |
| `TextField` | `h-10`, hairline, foco negro, label `text-caption` 500, error con shake y mensaje animado |
| `SelectField` | `h-10`, nativo estilizado, chevron a la derecha |
| `Tabs` | Subrayado `h-0.5` con `layoutId`, contadores en chip mono |
| `FilterChip` | `h-8`, activo negro, removible con × |
| `QtyStepper` | Botones `size-8`, cifra con animación vertical |
| `Modal` | `max-w-[480px]`, cabecera `p-6 pb-4`, pie `bg-surface-soft px-6 py-4`, spring 420/34 |
| `EmptyState` | Cuadrado menta `size-12`, título `text-body-lg`, mensaje `text-caption`, acción outline |
| `SummaryStrip` | Ver §4.3 |

### 6.3 Layout — `components/layout/*`

`AppShell`, `Sidebar`, `PageHeader`, `SearchField`, `NotificationBell` (ver §4). El sidebar tiene
grupos con `eyebrow`, ítem activo con `layoutId` y borde interior blanco de 2px, contadores y
selector de contexto (en BIA: **rol/portal**, no «outlet»).

### 6.4 Feedback — `components/ui/Toast.tsx`

- Esquina inferior derecha, ancho `min(380px, 100vw-32px)`, spring 420/34.
- Tonos `success` / `critical` / `info`; **crítico no se autodestruye**; máximo 3 visibles.
- `aria-live="polite"`.

### 6.5 Marca — `components/brand/Ribbon.tsx`

- 36 hebras, 40 muestras, SVG con gradiente naranja→magenta→periwinkle.
- Deriva lenta, se inclina con el puntero, se pausa fuera de pantalla y con `prefers-reduced-motion`.
- Es el único adorno permitido.

---

## 7. Gráficas

No hay librería: son SVG/divs propios. Patrones de `components/charts/*` y
`components/dashboard/*`.

| Patrón | Archivo | Valores |
|---|---|---|
| Barras apiladas + leyenda con totales | `components/charts/OrdersChart.tsx` | Plot `h-[240px]`, 5 ticks, barras `52–62%` del slot, crecen desde 0 en `0.8s` con delay escalonado |
| Serie destacada («ahora») | idem | Fondo `bg-mint` con `layoutId`; barra actual con línea «Now» y tooltip oscuro |
| Proyección | idem | Barra punteada con borde `--color-text-body` |
| Línea comparativa | `components/screens/ReportsScreen.tsx` | `pathLength 0→1`, periwinkle, puntos cuadrados |
| Gantt/timeline | `components/charts/ReservationTimeline.tsx` | Filas por recurso, bloques negros/menta/periwinkle, línea de «ahora» |
| Barras agrupadas | `components/charts/StaffCoverage.tsx` | Programado vs necesario, faltante con contorno crítico |
| Sparkline | `components/dashboard/KpiCard.tsx` | `88×28`, trazo 1.5, punto final con spring |
| Barra de nivel | `components/dashboard/StockWatch.tsx` | Track gris + relleno por nivel |

### Mapeo a Compras

`NO EXISTE EN LA REFERENCIA` un dashboard de compras; se reutilizan los patrones:

| Referencia | Compras |
|---|---|
| Orders by hour | **Solicitudes por día** (apiladas por estado) |
| Forecast to close | **En curso que cerrarán** (proyección) |
| Reservations timeline | **Duración por etapa** (gantt de etapas) |
| Staff coverage | **Carga por coordinador** (asignadas vs cerradas) |
| Sales mix | **Solicitudes por categoría** o **ahorro por categoría** |
| Top servers | **Top coordinadores** |
| Stock to watch | **Sin decisión hace N días** (ageing) |
| KPIs + sparkline | Solicitudes activas, tiempo de ciclo, sin decisión, ahorro |

Reglas de datos (de la referencia y del proyecto): nunca inventar cifras (RN-06), `—` cuando no
hay dato, y **no** mostrar 0 donde no se midió.

---

## 8. Movimiento

Fuente: `DESIGN.md` (Motion), `lib/hooks/motion.tsx`, `components/layout/*`.

| Patrón | Implementación | Dónde |
|---|---|---|
| Entrada de página | `opacity 0→1`, `y 14→0`, `0.5s` | `AppShell` |
| Revelado por sección | `revealParent` (stagger 0.07) + `revealChild` (`y 18`, `blur 4px`, `0.7s`) una vez | `Reveal` |
| Números | `CountUp` 1.1s, se dispara al entrar en vista | KPIs, totales |
| Gráficas | barras 0.8s; línea `pathLength`; puntos spring | Charts |
| Selección | `layoutId` (sidebar, tabs, segmented) | Navegación |
| Listas | `AnimatePresence` + `layout` | Tablas, tickets |
| Header | condensación a los 12px | `PageHeader` |
| Ambiente | listón lento + pulso del punto «live» (`rb-pulse`, 1.8s) | Hero |

- **Easing único:** `cubic-bezier(0.22, 1, 0.36, 1)`.
- **Duraciones:** 160ms hover, 320ms estado, 700ms revelado.
- **Reduced motion:** `MotionConfig reducedMotion="user"` + regla CSS global que anula animaciones
  (`app/globals.css`, `@media (prefers-reduced-motion)`).
- Nada anima en bucle salvo el listón y el pulso del indicador «live».

---

## 9. Iconografía

Fuente: `components/ui/Icon.tsx`.

- Grid **24px**, trazo **1.5**, `strokeLinecap="square"`, `strokeLinejoin="miter"`, `currentColor`,
  relleno `none`. Los puntos del menú «más» sí van rellenos.
- Set actual: dashboard, orders, reservations, kitchen, floor, stock, staff, menu, suppliers,
  reports, settings, bell, search, plus, download, clock, chevrons, more, check, arrows, close,
  alert, info, check-circle, filter, refresh, hamburger, sidebar-collapse.
- **No** se usa una librería de iconos. Los nuevos se dibujan con la misma geometría.

`NO EXISTE EN LA REFERENCIA`: iconos para documento/adjunto, comparativa/balanza, envío, edificio,
moneda, calendario de entrega y archivo. Propuesta: extender el mismo set 24/1.5 (p. ej. `file`,
`scale`, `send`, `building`, `coins`, `calendar`, `paperclip`).

---

## 10. Responsive

Fuente: `components/layout/*`, `components/dashboard/OverviewScreen.tsx`.

- Breakpoints Tailwind por defecto (`sm` 640, `lg` 1024, `xl` 1280).
- `<lg`: sidebar oculta; drawer de 280px con overlay; botón hamburguesa en el header.
- Header móvil: título + subtítulo, luego fila de acciones (segmented, campana, primario) y el
  primario reduce su texto («New order» → «New»).
- Hero: stats en 2 columnas, titulares `28/32`, botones a ancho completo.
- Rejillas: 1 columna → 2 (`sm`) → 4 (`xl`); el riel derecho de 388px solo en `xl`.
- Tablas: scroll horizontal contenido, `min-w` explícito, sin romper el layout.
- **Desviación necesaria para BIA:** la referencia usa botones de 32px y controles de 36–40px. En
  móvil nuestro mínimo táctil es **44px** (regla del proyecto). Propuesta: `size="lg"` con
  `h-11` para `<sm` y `h-8` desde `sm`; no cambiar la densidad de escritorio.

---

## 11. Accesibilidad

Fuente: `DESIGN.md` (Accessibility), `app/globals.css` (`@layer base`).

- Foco visible: `outline: 2px solid #000` con `outline-offset: 2px`; sobre oscuro, menta.
- Todo botón solo-icono lleva `aria-label`.
- Roles reales: `role="switch"`, `radiogroup`/`radio`, `tablist`/`tab`, `dialog` + `aria-modal`.
- `aria-live` en toasts y mensajes.
- Teclado: todo alcanzable; el buscador responde a `/`.
- **Hallazgo de contraste:** `#959494` sobre blanco da ≈ **2.8:1**, por debajo de AA para texto
  pequeño. La referencia lo admite solo para metadatos no accionables. En BIA: ese gris se usa
  **solo** para metadatos; los estados y ayudas que el usuario necesita para actuar van en `ink` o
  `navy-800`. Si se necesita un gris accesible para texto secundario esencial, usar `#313641`
  (`--rb-slate-700`).

---

## 12. Copy

- **Español (es-HN), trato de «usted»** (ADR 0008). La referencia está en inglés y en sentence case;
  se conserva **sentence case** y se traduce.
- Sin signos de exclamación.
- Decir qué pasó y qué hacer: «Adjunte el arte del producto antes de enviar», no «Error».
- Las etiquetas mono (`eyebrow`, `mono-label`, `mono-button`) van en **mayúsculas** por CSS; el
  texto fuente se escribe normal.
- Números: `Intl.NumberFormat("es-HN")`; moneda con `lib/domain/moneda.ts` (no duplicar formato).

---

## 13. Inconsistencias dentro de la referencia (y decisión)

| # | Inconsistencia | Evidencia | Decisión |
|---|---|---|---|
| 1 | `DESIGN.md` remite a `TOKENS.md`, que **no existe** | `DESIGN.md` («The exact values are in `TOKENS.md`») | La fuente es `styles/tokens.css` + `app/globals.css` |
| 2 | Dice badges/chips a 3.25px; el código usa 4px | `DESIGN.md` (Shape) vs `components/ui/primitives.tsx` (`Badge`: `rounded-sm`) | **4px** (lo que renderiza); 3.25px solo en checkbox/chips pequeños |
| 3 | Dice «avatares y radios son las únicas formas redondas»; el `Avatar` es **cuadrado** | `DESIGN.md` vs `primitives.tsx` (`Avatar`: `size-8`, sin radio) | **Avatar cuadrado**; redondo solo el punto del logo y el badge de notificación |
| 4 | Escala de spacing declarada y **sin uso** | `styles/tokens.css:46-57` vs componentes (`p-6`, `gap-4`) | Usar la escala numérica de Tailwind (ver §2.4) |
| 5 | `text-display-xxl` (64px) definido y **sin uso** | `app/globals.css:34-37` (0 usos en `components/`) | No usar salvo que se necesite un titular de portada |
| 6 | Colores oscuros de hover **hardcodeados** | `Sidebar.tsx` (`#3a404c`), `primitives.tsx` (`#3d4350`, `#f6f6f6`) | Agregar tokens `--color-surface-dark-hover` y `--color-canvas-hover`; no repetir hex |
| 7 | La serie «Delivery» usa un token de **texto** como relleno | `components/charts/OrdersChart.tsx:14` (`SERIES` → `var(--color-text-body)`) | Añadir `--color-series-3` con el mismo valor; no mezclar semántica |
| 8 | Titular del hero con tamaño a medida (`28/32`) fuera de la escala | `components/dashboard/LiveBand.tsx` | Se conserva como «display-lg móvil» documentado |
| 9 | `text-body` (#959494) no cumple AA | `styles/tokens.css:14` | Ver §11: solo metadatos; esencial en `#313641` |
| 10 | Sparkline con `viewport once:false` (redibuja al volver a entrar) mientras los revelados son `once:true` | `components/dashboard/KpiCard.tsx` vs `lib/hooks/motion.tsx` | **once:true** para todo lo que no sea dato vivo |
| 11 | `DESIGN.md` dice «una sola sombra» pero hay `hover:shadow-[inset_...]` | `DESIGN.md` vs `primitives.tsx` | Son **bordes** simulados, no sombras de elevación: permitido |
| 12 | Datos de demo en `config/site.ts` (186 venues, etc.) | `config/site.ts`, `AuthLayout.tsx` | Son contenido, no diseño: en BIA salen de la base |

---

## 14. Lo que NO existe en la referencia y cómo se resuelve

| Necesidad BIA | Estado en la referencia | Propuesta con lo que sí existe |
|---|---|---|
| Ámbar / «por vencer» | No hay token | `periwinkle` (informativo) + `critical` (vencido); no inventar amarillo |
| Botones táctiles 44px | 32px | Variante `lg` (`h-11`) solo `<sm` |
| Modo oscuro | No existe | No implementar; el oscuro es solo para banda/sidebar/auth/kitchen |
| Iconos de compras | No existen | Extender el set 24/1.5 |
| Stepper de wizard | No existe | Construir con `eyebrow` + números `mono-label` + hairline; estados con `mint`/`periwinkle`/`critical` |
| Fecha / calendario | No existe | `TextField` de 40px + popover con `Panel` y celdas `size-8`; el picker nativo queda como fallback |
| Carga de archivos / dropzone | No existe | Caja con hairline **discontinua** (único uso permitido de borde punteado, ya presente en la proyección de barras) + `Button` |
| Tabla con muchas columnas / fila expandible | Tabla simple | Cabecera `surface-soft`, fila expandible con `AnimatePresence` y panel interno |
| Badge de estado con icono | `Badge` solo texto | Mantener solo texto; el icono va en la celda, no dentro del badge |
| Confirmaciones destructivas | `Modal` genérico | `Modal` + primario `critical` (fondo rojo) y foco en cancelar |
| Skeleton de carga | No existe | Bloque `bg-surface-soft` con `animate-pulse` (el único pulso permitido además del live) |
| Paginación | Botones `size-8` | Reutilizar tal cual |
| Filtros persistentes en URL | No aplica (demo) | Mantener el comportamiento actual del app; el diseño no cambia |
| Impresión / PDF | No existe | No se toca: el PDF se genera en servidor con `pdf-lib` |

---

## 15. Mapa de pantallas BIA → patrón de la referencia

| Pantalla BIA | Patrón | Notas de adaptación |
|---|---|---|
| `/admin` (dashboard) | `OverviewScreen` + `LiveBand` | Banda «Pulso de compras» con KPIs reales; sin reloj demo |
| `/admin/procesos` | `OrdersScreen` | `SummaryStrip` + tabs por estado + tabla con filtros y paginación |
| `/admin/solicitud/[id]` | `OrderDetailScreen` + paneles | Mantener respuestas/rondas/cotizaciones/comparativa/decisión; riel derecho |
| `/admin/coordinadores` | `StaffScreen` | Tabla con avatar, rol, categorías, estado; alta por invitación |
| `/admin/campos` | `SettingsScreen` | Sub-nav + paneles de campos |
| `/admin/configuracion` | `SettingsScreen` | Umbrales, expiración, destinatarios |
| `/admin/ajustes` | `SettingsScreen` | Perfil real |
| `/panel` (coordinador) | `OverviewScreen` adaptado | Menos KPIs, foco en bandeja y acciones del día |
| `/panel/solicitud/[id]` | `OrderDetailScreen` | Etapas 07/08/09 + riel con form original y rondas |
| Wizard del solicitante | Kit de formularios + stepper nuevo | Sin banda oscura; una acción primaria por paso |
| `/mis-solicitudes` | `OrdersScreen` | Lista/tabla simple; sin montos (privacidad) |
| `/comparativa/[token]` | Sin shell | Página pública limpia; no exponer chrome interno |
| `/login/admin`, `/login/coordinador` | `AuthLayout` | Split con listón; sin «SSO» (no existe en BIA) |
| Correos y PDF | Fuera del sistema | No se tocan en el rediseño |

---

## 16. Plan de migración sin romper funcionalidad

**Principio:** dos sistemas conviven; se cambia **ruta por ruta**, nunca con un interruptor global.
Cada fase deja la suite verde y se verifica en navegador.

| Fase | Alcance | Archivos nuevos / tocados | Riesgo | Verificación |
|---|---|---|---|---|
| **F0 · Fundación** | Tokens, fuentes, `motion`, `config/site`, `Providers` | `styles/tokens.css` (nuevo), `app/globals.css` (aditivo), `package.json`, `app/layout.tsx` | Bajo: no cambia ninguna pantalla | `tsc`, suite, build; comparar una pantalla vieja pixel a pixel |
| **F1 · Kit UI** | `ui/primitives`, `ui/forms`, `ui/Icon`, `ui/Toast`, `brand/Ribbon`, `lib/hooks/motion` | `components/ui/*`, `components/brand/*`, `lib/hooks/*` | Bajo: aún sin consumidores | Tests de componente nuevos; Storybook no existe → página de muestra temporal |
| **F2 · Admin shell + dashboard** | `AppShell`, `Sidebar`, `PageHeader` y `/admin` | `components/layout/*`, `app/admin/page.tsx` | **Medio**: es la pantalla más vista | Suite + Playwright (desktop 1440 y móvil 390) + `validate` |
| **F3 · Resto del admin** | procesos, detalle, coordinadores, campos, configuración, perfil | `app/admin/**`, componentes de tabla/form | Medio: conservar filtros, acciones y textos que los tests buscan | Suite por pantalla + e2e |
| **F4 · Coordinador** | `/panel`, `/panel/solicitud/[id]` | shell compartido, dashboard, bandeja, detalle | Medio: no romper etapas 07/08/09 | Suite + flujo completo con Playwright |
| **F5 · Solicitante** | wizard, `/mis-solicitudes` | kit de formularios, stepper | **Alto**: flujo largo y con borrador | Suite + e2e del wizard + prueba manual |
| **F6 · Acceso y público** | `/login/*`, `/comparativa/[token]` | `AuthLayout`, página pública | Medio: el enlace público es cliente-facing | Prueba manual + revisión de privacidad |
| **F7 · Limpieza** | Borrar `ui-ext` y estilos viejos | `components/ui-ext/*`, `styles/globals.css` | Bajo si no quedan referencias | `rg` de imports + build |

### Reglas de convivencia

- El **shell viejo** (`AdminShell`, `panel/*`) sigue intacto hasta que su ruta migre.
- No se borra `AmbientBackground`, `MetricCard`, `DataTable`, etc. hasta F7.
- Los **textos y roles accesibles** se conservan; si un test depende de una clase, se actualiza el
  test **en el mismo commit** que la pantalla.
- El **PDF** y los **correos** no se tocan (server-side).
- El enlace público **no** recibe el sidebar ni la banda oscura.

### Riesgos conocidos y su mitigación

1. **Scroll**: el admin actual usa un scroller interno (`h-dvh` + `overflow-y-auto`) por un bug ya
   corregido. El `PageHeader` de la referencia usa `useScroll` del documento. Mitigación: en F2
   probar el header con el scroller real; si no condensa, usar el contenedor como target.
2. **Touch targets**: 32px de la referencia vs 44px del proyecto. Mitigación: variante `lg` móvil.
3. **Contraste**: `text-body` no cumple AA. Mitigación: §11.
4. **Tests que buscan texto/clases**: inventariar antes de cada pantalla; cambiar el test junto con
   la UI.
5. **Regresión visual del wizard**: es el flujo más largo; migrarlo al final y con e2e.
6. **Fuentes**: si no se instalan los paquetes exactos, las métricas cambian. Mitigación: mismos
   paquetes que la referencia.

### Definición de terminado por pantalla

- Valores de este documento (tokens, tipografía, radios, spacing).
- Sin gradientes salvo el listón; sin sombras salvo flotantes.
- Teclado y foco visibles; `aria-label` en iconos.
- Desktop 1440 y móvil 390 verificados en navegador.
- `npm test`, `tsc`, `lint` verdes; `validate` sin críticos.

---

## 17. Checklist de aceptación visual

- [ ] Fondo blanco; banda oscura solo donde corresponde.
- [ ] Hairlines de 1px; sin sombras de elevación salvo menús/modales/toasts.
- [ ] Inter + Geist Mono cargadas; cifras tabulares.
- [ ] Títulos display 500 con tracking negativo; etiquetas mono en mayúsculas.
- [ ] Un solo botón primario por área; rojo solo para acción requerida.
- [ ] Radios 4px (paneles/botones), 3.25px (chips/checkbox), 8px solo overlays.
- [ ] Sidebar 248/72 (drawer 280 en móvil) y header que condensa.
- [ ] Movimiento con el easing y duraciones de §8; reduced-motion respetado.
- [ ] Nada inventado: cada valor nuevo tiene fuente en este documento.
