# Auditoría de diseño y UI — Dashboard de Administración

**Portal de Compras BIA** · rama `main` · HEAD `e8ff42b` · 27 de septiembre de 2026
Alcance: `app/admin/**` (7 pantallas) + `components/ui-ext/{AdminShell,AdminSidebar}.tsx`
Método: inspección de código + medición en navegador (Playwright) con datos reales de `bia`
Datos de prueba: 121 solicitudes, 136 cotizaciones, 25 campos de catálogo, 7 usuarios

> **Run note (impeccable critique):** `⚠️ DEGRADED: single-context (spawn_agent no disponible en esta sesión)`.
> Las dos evaluaciones (A: revisión de diseño, B: detector + navegador) se-corrieron en el mismo
> contexto en vez de en dos sub-agentes. El detector determinista sí se ejecutó aparte
> (`node ~/.agents/skills/impeccable/scripts/detect.mjs --json app/admin components/ui-ext` → 3 `gray-on-color`).
> Snapshot persistido en `qa/evidencia-piloto/critique-admin/` (la ruta que pidió el encargo, no
> `.impeccable/critique/`).

---

## 1. Veredicto: qué hace que esto se sienta como juguete

No es "el color". Son **cuatro decisiones estructurales** que se pueden medir. Ninguna es un
adjetivo; las cuatro tienen número.

### 1.1 La sidebar no era una sidebar: era un bloque del tamaño del documento

`AdminShell.tsx:16` usaba `min-h-screen` en `<main>` y `min-h-screen` en `<section>`, y
`AdminSidebar.tsx:47` usaba `flex-1` en el `<nav>`. `min-height` no acota el crecimiento: la
`<section>` crecía hasta la altura de la tabla y el `<aside>` — flex sibling con
`align-items: stretch` — se estiraba con ella.

Medido a 1440×900 con 121 solicitudes reales:

| Métrica | Valor medido |
|---|---|
| `document.scrollHeight` | **8 588 px** (9,5 pantallas) |
| Altura del `<aside>` | **8 524 px** = **9,5× el viewport** |
| Altura del `<nav>` | **8 307 px** |
| Contenido real del nav (5 items) | **210 px** |
| **Espacio muerto en el nav** | **8 097 px** |
| Borde inferior del bloque usuario + logout | `top: 8 419 px` |
| **Scroll necesario para poder cerrar sesión** | **7 519 px** |
| Scroller interno `overflow-y-auto` | `scrollHeight (8 435) === clientHeight (8 435)` |

Ese último renglón es el hallazgo de raíz: **el contenedor que debía hacer scroll nunca
scrolleó, ni una sola vez, en ninguna pantalla.** Es código muerto. El documento hacía de
scroller y arrastraba la sidebar con él.

La prueba de que la causa es exactamente esa y no otra: en las tres páginas con poco contenido
(`/admin/coordinadores`, `/admin/configuracion`, `/admin/ajustes`) la sidebar medía **683 px**
(0,8× el viewport) sin tocar una línea. **La sidebar crecía en proporción al contenido.** El
`min-h-screen` no era un error cosmético: era un bug de layout que hacía inaccesible el logout.

### 1.2 La densidad era la de una landing page, no la de una herramienta de auditoría

| | Antes | Después | Referencia enterprise |
|---|---|---|---|
| Altura de fila | 64 px @1440 · 78 px @1280 · **85 px ≤1024** | **58 px** | 32–40 px |
| Filas visibles en 900 px de alto | **3** | **6** | 20–40 |
| Filas visibles a 1024×768 | **0** | **4** | 15+ |
| Filas visibles a 1280×500 | **0** | 0 (se scrollea) | — |
| DOM nodes (121 filas) | 2 413 | **700** | — |

**A 1024×768 —una de las resoluciones de portátil de negocio más comunes— el dashboard no
mostraba ni una sola fila de la tabla.** El usuario tenía que scrollear ~4 000 px para llegar a
la primera. Eso, solo, ya se lee como juguete: una herramienta de auditoría que no muestra datos
en la pantalla donde la usas.

### 1.3 La tipografía no tenía jerarquía: era bimodal

Inventario real de estilos computados en el dashboard a 1440×900 (1 231 nodos de texto):

| Tamaño | Nodos | % |
|---|---|---|
| 30 px | 3 | 0,2 % |
| 20 px | 1 | 0,1 % |
| 18 px | 1 | 0,1 % |
| 14 px | 1 | 0,1 % |
| 13 px | 1 | 0,1 % |
| 12 px | 957 | 77,7 % |
| 11 px | 8 | 0,6 % |
| **10 px** | **259** | **21,0 %** |

**8 tamaños distintos. El 99,4 % del texto está en ≤12 px.** Y la distribución es bimodal: o los
4 números de KPI (30 px), o ≤14 px. **No existe el escalón intermedio.** En una ventana de 900 px
eso es un mar de texto de 10–12 px con tres números grandes sueltos.

4 pesos (400/500/600/700), 2 familias (Inter, JetBrains Mono). Per `apple-design` §15, la
jerarquía se construye con **peso + tamaño + leading como un conjunto**; aquí el tamaño está
colapsado y el peso hace casi todo el trabajo.

### 1.4 El movimiento era ruido, y costaba tiempo medible

`AmbientBackground` (`components/ui-ext/AmbientBackground.tsx:10-13`) renderiza dos blobs de
`50vw` y `40vw`, `blur(80px)`, `mix-blend-multiply`, con `blob-morph 12s` + `blob-spin 24s`
**infinite**. En el admin eso son **4 animaciones corriendo a la vez, de forma permanente**.

Evidencia de que no es decoración sino un coste:

| Medición | Resultado |
|---|---|
| `document.getAnimations()` en el admin | 4 (2× `blob-morph` 12 000 ms, 2× `blob-spin` 24 000 ms) |
| 1 screenshot de Playwright, por defecto | **18 285 ms** |
| 1 screenshot con `animations: "disabled"` | **2 556 ms** |
| Aceleración | **7,3×** |
| Screenshot con `timeout: 8000` | **falla** |

`apple-design` §14 pide explícitamente evitar "full-viewport moving backgrounds, slow looping
oscillations (near 0.2 Hz / one cycle per 5s)". 12 s y 24 s infinite están exactamente en esa
categoría. Y `emil-design-eng` pone el listón en "un dashboard profesional debe ser **crisp y
rápido**".

Sobre el markup, además: `body` (`bg-grid`) → `AmbientBackground` → `section bg-white/30` →
`header bg-gradient-to-r from-sky-100/80 via-white/50 to-emerald-100/50` → `aside bg-white/40` →
tarjetas `bg-white`. **Seis capas translúcidas apiladas**, lo que `apple-design` §12 prohíbe
("never stack a light translucent surface on another — legibility collapses"). De ahí el lavado
menta/celeste de fondo que se ve en la captura.

### 1.5 La tabla de tokens gastados — el argumento

Esta es la tabla que sostiene el veredicto. Todo medido con estilos computados, no estimado.

| Categoría | Valores distintos en el admin (antes) | Reparto | Qué dice |
|---|---|---|---|
| **Tamaños de fuente** | **8** | 10, 11, 12, 13, 14, 18, 20, 30 px | 8 escalas para 7 pantallas. Ninguna pantalla comparte escala con otra: `/admin/procesos` usa 6, `/admin/coordinadores` 7, el dashboard 8. |
| **Pesos** | 4 | 400, 500, 600, 700 | Razonable. El problema es que compensan una escala de tamaños rota. |
| **Familias** | 2 | Inter, JetBrains Mono | Correcto. |
| **Radios** | **4 estáticos + 2 animados** | 4 px, 12 px, 16 px, 9999 px + 2 `border-radius` con % del blob | Los 2 animados son del `blob-morph`, no del admin. |
| **Sombras** | **1** | `shadow-sm` en TODO | Una tarjeta de tabla de 1 118 px y un badge de 105 px usan la misma profundidad. `apple-design` §12: "bigger surfaces should read as thicker". Violado. |
| **Gradientes** | 3 | header `sky→white→emerald`, `emerald-100/40`, `sky-500/10→emerald-200/20` | 2 de los 3 son de los blobs. |
| **Capas translúcidas** | 6 apiladas | body + blobs + section + header + aside + cards | `apple-design` §12 prohíbe el apilado. |
| **Movimiento** | 2 keyframes, 4 instancias, infinitas | 12 s / 24 s | Sin propósito, 100 % del tiempo en pantalla. |
| **Anchos de columna** | 7 hardcodeados | `px-5` (7×), `px-4`, `py-4`, `py-3`, `py-3.5`, `py-2.5` | 6 pasos de padding vertical distintos. |
| **Tokens de diseño del proyecto** | **0** | — | Ver §1.6. |

### 1.6 El hallazgo que cambia el diagnóstico: el sistema de diseño no existe

`DataTable.tsx`, `MetricCard.tsx`, `Topbar.tsx`, `EmptyState.tsx`, `Segmented.tsx`, `Avatar.tsx`,
`BarChart.tsx`, `Chip.tsx`, `Timeline.tsx`, `Switch.tsx` y `AppShell.tsx` usan clases de token
(`bg-superficie`, `rounded-card`, `shadow-card`, `text-ink`, `text-brass`, `font-display`,
`border-borde`, `azul-claro`, `azul-marino`, `texto-terciario`).

**Ninguna está definida.** El proyecto tiene un único archivo CSS (`styles/globals.css`) y no
define ninguna. Verificado contra el CSS compilado:

```
$ grep -o "superficie\|rounded-card\|azul-marino\|shadow-card" .next/static/chunks/*.css
superficie: 0
rounded-card: 0
azul-marino: 0
shadow-card: 0
```

Consecuencias, ambas verificadas:

1. Esos 11 componentes tienen **0 imports** en todo el repo. Son código muerto. La "biblioteca
 enterprise" que el admin podría haber adoptado no está cableada a nada.
2. `app/panel/**` (el coordinador, `e8ff42b`) **sí** usa esos tokens inline
 (`AppShell.tsx:39-41`: `bg-azul-claro text-azul-marino`, `rounded-card`, `bg-superficie`).
 Es decir: **el panel del coordinador está painted con un sistema de diseño que no compila.**

Esto no lo arreglé: `AppShell.tsx` está en la lista de "no tocar" y el panel es del bloque del
coordinador. Queda reportado como **P1** con la fix exacta.

**Consecuencia para el encargo:** no hay un tercer lenguaje que reutilizar. El admin no está
"pegado" a un sistema mal aplicado — está usando los valores crudos de Tailwind porque el
sistema nunca existió. La Fase 2 tiene que **crear** los tokens, no consolidar los existentes.

---

## 2. Nielsen 0–4 sobre las 7 pantallas admin

Modo: **Operate** (herramienta de trabajo). Las 10 heurísticas aplican → total sobre **/40**.

| # | Heurística | Pts | Evidencia medida |
|---|---|---|---|
| 1 | Visibilidad del estado del sistema | **1** | Los KPIs no respondían a la búsqueda: filtrando a **1 fila**, los KPIs seguían diciendo "88 procesos activos / 79 sin decisión / 12 % conversión". `busqueda` no estaba en las deps del `useEffect`. Sin paginación tampoco existía "página 3 de 5". Sin feedback en el toggle de campos: 0 toasts, 0 spinners, 0 botones deshabilitados. |
| 2 | Correspondencia con el mundo real | **2** | Los estados sí tienen nombre de negocio ("Esperando cotizaciones", "Comparativa lista") y el semáforo es honesto. Pero "Catálogo"etiketeaba `/admin/campos` (que es un catálogo de *campos*), y había dos pantallas de "Ajustes" con nombres que colisionan. |
| 3 | Control y libertad del usuario | **1** | Sin `beforeunload`: escribir un campo y navegar **perdía todo sin aviso** (verificado). El toggle de `/admin/campos` —desactiva una pregunta del assessment para toda la empresa— no pedía confirmación (0 diálogos en 3 clics) y no tenía deshacer. `/admin/ajustes` tenía un botón "Guardar Cambios" **sin handler**: loss of data simulado. |
| 4 | Consistencia y estándares | **1** | Tres capas translúcidas apiladas; `shadow-sm` como única profundidad; radios sin sistema; el admin con `rounded-2xl` (32 px) donde el panel usa `rounded-card` (4 px). `/admin/configuracion` se titula "Ajustes Generales" y existe `/admin/ajustes` "Ajustes de Perfil", **sin enlace en la navegación**. |
| 5 | Prevención de errores | **1** | Acción destructiva sin confirmación; sin guarda de cambios sin guardar; 0/7 columnas ordenables y 0 selección de filas (no se puede actúar sobre subconjuntos); "Exportar" exporta **todo** aunque estés filtrando. |
| 6 | Reconocimiento sobre recuerdo | **2** | Iconos + etiquetas en la nav (bien). Pero el gráfico de barras **no mostraba valores** y coloreaba por índice (`i % 2 === 1 ? sky-400 : sky-200`) — color sin significado. Sin números, el admin tenía que estimar longitudes de barra. |
| 7 | Flexibilidad y eficiencia | **0** | **0/7 columnas ordenables** (`esBoton:false`, sin `role`, sin `aria-sort`, sin `tabindex`, `cursor:auto`). **0 checkboxes**, sin barra de acciones masivas. Búsqueda **sin debounce** → 283 ms por tecla a 321 filas. Sin atajos de teclado. Sin ajuste de densidad. |
| 8 | Diseño estético y minimalista | **1** | 21 % del texto a 10 px; 99,4 % a ≤12 px; 6 capas translúcidas; un círculo decorativo `bg-emerald-100` sin significado de datos en la tarjeta de conversión; gradiente menta/celeste de fondo. Nada de lo cual sea "restringido" en el sentido de `apple-design`. |
| 9 | Recuperación ante errores | **1** | `.catch(() => setProcesos([]))` — un fallo de red se renderizaba **exactamente igual que "no hay datos"**. Lo mismo en métricas y en coordinadores. El usuario no tenía forma de saber si el dashboard estaba vacío o roto. |
| 10 | Ayuda y documentación | **1** | No hay ninguna ayuda contextual, ni explanation de qué significa "Sin decisión > 5 días", ni qué es "margen". El único texto explicativo del producto está en `/admin/configuracion`. |
| **TOTAL** | | **11 / 40** | **Banda: toy.** Un dashboard enterprise de auditoría vive en 26–32. |

### Desglose por pantalla

| Pantalla | /40 | P0/P1 propios | Nota |
|---|---|---|---|
| `/admin` (dashboard) | **11** | P0 ×2 | La peor:volumen, densidad y datos desincronizados. |
| `/admin/procesos` | 17 | P1 ×1 | Tablero kanban de 4 columnas, `navX` 8,4×, sin paginación ni orden, columnas sin tope (un rfq puede tener 300 tarjetas). |
| `/admin/coordinadores` | 19 | — | La mejor: 6 tarjetas, contenido corto, la sidebar se comporta bien. Pero `DOTS[i % 3]` colorea el estado por **índice de orden**, no por dato, y calcula el promedio en JS sobre `listarTodas()` completo (O(n·m)). |
| `/admin/campos` | 12 | P1 ×3 | Destructivo sin confirmar, sin feedback, sin guarda de datos. |
| `/admin/configuracion` | 18 | P2 ×1 | Correcta, pero el título "Ajustes Generales" colisiona con `/admin/ajustes`. Sin `beforeunload` al editar umbrales. |
| `/admin/ajustes` | **8** | **P0 ×1** | Formulario editable con valores **hardcodeados** (`Lady`, `admin@bia.com`, `********`) y botón "Guardar Cambios" **sin handler**. No existía endpoint de perfil. Puro teatro. Y no estaba enlazado desde la nav. |
| `/admin/solicitud/[id]` | 22 | P2 ×2 | La mejor implementada: timeline con `evento_trazabilidad`, reasignación, cancelación. Timeline sin estado vacío distinguishible ("Sin eventos registrados." sí existe — bien). |

---

## 3. Inventario de movimiento — veredicto de `review-animations`

**Default: marcar. Veredicto: BLOQUEADO.** Aprobación ganada, no asumida.

| Before | After | Why |
|---|---|---|
| `blob-morph 12s ease-in-out infinite alternate` sobre un div de `50vw` con `blur(80px)` | Eliminar del admin | `apple-design` §14: "avoid full-viewport moving backgrounds, slow looping oscillations". 12 s = 0,083 Hz, muy por debajo del umbral. `emil` tabla de frecuencia: 100 % del tiempo en pantalla = "No animation. Ever." |
| `blob-spin 24s linear infinite` (rotación + scale 1→1,1) | Eliminar del admin | Mismo argumento + es un bucle lineal sin estado final: nunca "se para", nunca resuelve. |
| `mix-blend-multiply` sobre dos gradientes detrás de texto de 10 px | Eliminar | `apple-design` §12: no se apila material translúcido. El blending sobre texto pequeño destruye el contraste. |
| `blob-morph` anima `border-radius` y `background-position` | n/a | `review-animations` std. 7: solo `transform`/`opacity` van a GPU. `border-radius` fuerza **paint** en cada frame, en dos elementos de `50vw`. Con `blur(80px)` encima, en un portátil de la planta. |
| `animate-fluid-blob` sin `prefers-reduced-motion` en el admin | N/A | El bloque global de `e8ff42b` sí lo respeta; el bug era que el admin lo usaba igual. Resuelto al quitarlo del admin. |
| `transition-all` en 6 sitios (campos, config) | `transition-colors` | `review-animations`: "transition: all"animate props no previstos y no fuera de GPU. |
| `transition-colors` en hover de fila / nav / links | Se mantiene | Correcto: es un cambio de color, `ease` por defecto, sin transform. |
| Sin estado `:active` en ningún control del admin | `scale(0.97)` / opacidad en `:active` | `emil`: "buttons must feel responsive". En móvil el `tap-highlight` se cobraba el feedback; ahora hay `:active` propio. |
| `min-height: 100vh` en el shell | `height: 100dvh` | `mobile-native` §3: `100vh` es el viewport **mayor**; con la barra de URL visible el shell desborda. |

**Auditoría de rendimiento (std. 7):** el coste medido no es teórico.

| Medición | Antes | Después |
|---|---|---|
| Animaciones corriendo en el admin | 4 | **0** |
| Screenshot de Playwright | 18 285 ms | **2 556 ms** |
| Aceleración | — | **7,3×** |

Los blobs se quedan en el solicitante, la home, la vista pública y el panel del coordinador: es
su decisión y no es mi scope. En el admin, no.

---

## 4. Bugs cazados — tabla de ataques

| # | Ataque | Qué esperaba romper | Qué se rompió de verdad | Arreglado |
|---|---|---|---|---|
| 1 | **Sidebar gigante** — medir nav y shell a 900 px y 2 000 px de alto | Que el nav creciera con el documento | **CONFIRMADO y peor de lo previsto**: nav 8 307 px con 210 px de contenido; el logout a 7 519 px bajo el pliegue; el `overflow-y-auto` interno nunca scrolleó en ninguna pantalla | ✅ `AdminShell`+`AdminSidebar` |
| 2 | **Volumen 200** | Timeout de render | 321 filas → 6 122 nodos, doc 25 061 px, **283 ms por tecla** | ✅ paginación |
| 3 | **Volumen 1 000** | Bloqueo de main thread | 1 121 filas → 20 923 nodos, doc 88 203 px, sidebar **97,8× el viewport**, **685–1 465 ms por tecla** | ✅ |
| 4 | **Volumen 5 000** | Congelación | 5 121 filas → 94 922 nodos, doc **403 891 px (448 pantallas)**, sidebar **448,5× el viewport**, **1 568–4 028 ms por tecla** | ✅ |
| 5 | **Sin paginación** | Confirmar ausencia | Confirmado: las 121 filas se renderizaban enteras; sin recycle, sin virtualization, sin total | ✅ 25/pág + "1–25 de 122" |
| 6 | **Ordenar columnas** | Que ninguna ordenara | **0/7 ordenables.** Sin `button`, `role`, `aria-sort` ni `tabindex`. Un admin no puede "¿cuáles son las más antiguas?" | ✅ 6/6 con `aria-sort` |
| 7 | **Seleccionar filas** | Que no existiera | **0 checkboxes**, sin barra de acciones masivas | ❌ **no arreglado** (P1, ver §6) |
| 8 | **Viewports 320–2 560** | Rupturas de layout | **Sin overflow horizontal** en ninguno (`scrollWidth === innerWidth` en los 11) ✅. Pero **debajo de 768 px: 0 enlaces de navegación** — el admin era inalcanzable en teléfono | ✅ nav móvil |
| 9 | **Alturas extremas (500/600 px)** | 0 filas visibles | **CONFIRMADO**: a 1024×768, 1280×500 y 1366×600 → **0 filas visibles**; había que scrollear ~4 000 px | ✅ 4 filas a 1024×768 |
| 10 | **Sidebar unreachable en móvil** | Que no hubiera salida | Sidebar `hidden md:flex` → en móvil no hay nav, **ni logout, ni marca**. El usuario queda atrapado en una pantalla | ✅ 6 links + logout 72×32 |
| 11 | **Target táctil logout** | <44 px | **16×16 px.** 122–123 targets <32 px en todas las pantallas ("Ver Detalle" 87×27) | ✅ 36×36 / 72×32 |
| 12 | **Nombre de 200 caracteres** | Romper la tabla | **No se rompió** ✅. La celda de nombre se envuelve, la fila sube a 107 px, **cero overflow horizontal**. `truncate`+`title` lo deja en 58 px uniformes | ✅ |
| 13 | **Área / categoría largas** | Desbordar columna | **No se rompió** ✅. `nombreCategoria` cae a "Sin clasificar" | — |
| 14 | **NULL en todas las columnas** | Crashes / "NaN" / "Invalid Date" | **No se rompió** ✅. `areaSolicitante` null → "—"; `fecha_requerida` null → "Sin fecha límite"; `solicitante_nombre` **NOT NULL en schema** (defensa en profundidad) | — |
| 15 | **Fechas inválidas / futuras** | Mostrar basura | **Parcial**: fecha de creación **30 días en el futuro** renderiza "0 h" (`duracionAtencion` hace `Math.max(0, …)`) y muestra `27/10/2026` como si fuera real | ❌ en `lib/domain/semaforo.ts` (fuera de scope) |
| 16 | **Montos de 9 cifras** | Desbordar KPI | **No aplica**: el dashboard **no muestra ningún monto**. NiCotizaciones, ni comparativas, ni presupuesto. Ausencia, no bug (P2 de info) | ❌ ver §6 |
| 17 | **`formatoDuracion` con días enteros** | Formato raro | **CONFIRMADO**: `m = Math.floor((dias - Math.floor(dias)) * 30)` usa el **resto subdía**, así que toda duración entera ≥60 d sale **"400 d · 0 m"** / "200 d · 0 m". 400 días son 13 meses | ❌ fuera de scope, fix exacto en §6 |
| 18 | **Exportar** | Que respetara el filtro | **Ignora la búsqueda**: `href="/api/metricas/excel?rango=todo"`. Exportas todo estando filtrado, sin avisar | ✅ `title` explícito |
| 19 | **Acción destructiva sin confirmar** | 0 diálogos | **CONFIRMADO**: 3 clics → 0 diálogos. Desactiva un campo del assessment **para toda la empresa**, sin confirmar, sin deshacer, sin feedback, y `toggleCampo` **nunca revisaba `res.ok`** | ✅ diálogo + `res.ok` + feedback + guarda de reentrada |
| 20 | **Triple clic en el toggle** | Carrera / estado corrupto | 3 PATCH + 3 GET concurrentes, todos leyendo el mismo `c.activo` obsoleto. No corrompió datos en esta pasada, pero **no hay guarda de reentrada** | ✅ `ocupado` |
| 21 | **Formulario pierde datos al navegar** | Pérdida silenciosa | **CONFIRMADO**: escribí `PRUEBA_999` → click real en la nav → `/admin/procesos` → **sin aviso, datos perdidos** (`avisoSinGuardar: false`) | ✅ `beforeunload` + `confirm` |
| 22 | **`/admin/ajustes` verosímil** | Botón que no hace nada | **CONFIRMADO**: valores hardcodeados + "Guardar Cambios" `type="button"` **sin handler**. No hay endpoint de perfil. Y la página **no estaba en la nav** | ✅ solo lectura honesto + enlazada |
| 23 | **`/admin/procesos` ejecuta sin feedback** | Acción sin confirmar | **No se rompió**: la página es de solo lectura (tarjetas-enlace). Pero sin paginación ni orden, y las 4 columnas **no tienen tope**: 300 solicitudes RFQ = 300 tarjetas en una columna | ❌ ver §6 |
| 24 | **`/admin/coordinadores` coerción** | Datos falseados | `COLORES_AVATAR[i % 5]` y `DOTS[i % 3]` colorean **por índice de orden, no por dato** → "verde = activo" es mentira visual. El promedio se calcula en JS sobre `listarTodas()` (O(coordinadores × solicitudes)) | ❌ ver §6 |
| 25 | **Aislamiento de rol** | Fuga admin→panel | `/panel` con sesión **admin** → redirect a `/admin` ✅ correcto. `/api/admin/*` sin sesión → **403** ✅ | — |
| 26 | **Búsqueda vs KPIs** | KPIs desincronizados | **CONFIRMADO**: 1 fila en tabla, KPIsFollow mostrando 88/79/12 % | ✅ aviso de alcance |
| 27 | **Sistema de diseño fantasma** | Clases que no existen | **11 componentes con tokens inexistentes y 0 imports**; el panel del coordinador los usa inline | ❌ ver §6 (P1) |
| 28 | **Base mobile-native** | 5 reglas ausentes | `tap-highlight` ausente, `touch-action` 0 en el CSS compilado, `overscroll-behavior` 0, `viewport-fit=cover` ausente, inputs a 12–14 px (iOS hace zoom) | ✅ 4 de 5 (`viewport-fit` requiere `app/layout.tsx`, fuera de scope) |
| 29 | **Hover pegajoso en táctil** | Falso positivo | **No se rompió** ✅ — Tailwind v4 compila `hover:` dentro de `@media (hover:hover)`. No inventé el bug | — |
| 30 | **Overflow horizontal de página** | Scrollear en X | **No se rompió** ✅ en los 11 viewports. La tabla scrollea dentro de su wrapper | — |

Ataques que **no** rompieron nada y reporto como tales: 12, 13, 14, 16, 23, 25, 29, 30, y el
toggle simple de campos (funciona y persiste — verifiqué que un único click sí guarda).

---

## 5. Antes / después con números

### 5.1 Volumen (el mismo ataque, con y sin la corrección)

| Filas | DOM nodes antes | Doc height antes | Sidebar × viewport | Tecla antes | DOM nodes después | Tecla después |
|---|---|---|---|---|---|---|
| 121 (real) | 2 413 | 8 588 px | 9,5× | 283 ms | **700** | **25–94 ms** |
| 321 | 6 122 | 25 061 px | 27,8× | 283 ms | **700** | **~30 ms** |
| 1 121 | 20 923 | 88 203 px | 97,8× | 685–1 465 ms | **700** | **~30 ms** |
| 5 121 | 94 922 | 403 891 px | 448,5× | 1 568–4 028 ms | **700** | **~30 ms** |

**El coste por pulsación deja de crecer con el volumen.** Ese es el punto: antes era O(n) en DOM,
ahora es O(25) constante.

### 5.2 Layout por viewport

| Viewport | Sidebar ×vp antes | después | Filas visibles antes | después | Nav en móvil antes | después |
|---|---|---|---|---|---|---|
| 320×568 | — | — | 0 | 0 | **0** | **6** |
| 375×667 | — | — | 0 | 0 | **0** | **6** |
| 768×1024 | 10,8× | 0,84× | 3 | 2 | 5 | 6 |
| 1024×768 | 14,4× | 0,79× | **0** | **4** | 5 | 6 |
| 1280×800 | 12,6× | 0,82× | 1 | 3 | 5 | 6 |
| 1440×900 | 9,3× | 0,82× | 3 | **6** | 5 | 6 |
| 1920×1080 | 7,8× | 0,85× | 6 | 7 | 5 | 6 |
| 2560×1440 | 5,8× | 0,89× | 11 | **16** | 5 | 6 |
| 1366×600 | 15,6× | 0,68× | **0** | 0 | 5 | 6 |
| 1280×500 | 20,2× | 0,68× | **0** | 0 | 5 | 6 |

`document.scrollHeight` pasó de 8 588 px a **exactamente la altura del viewport** en las 6
pantallas: el documento ya no scrollea, scrollea el contenedor interno (`scrollHeight > clientHeight`
= **true** por primera vez).

### 5.3 Tokens: antes → después

| | Antes | Después |
|---|---|---|
| Tamaños de fuente | 8 | 8 (sin consolidar — Fase 2) |
| Texto ≤12 px | 99,4 % | 87 % |
| Radios | 4 + 2 animados | **4** |
| Sombras | 1 (`shadow-sm` en todo) | 1 (pero **consciente**: superficie plana, sin sombra falsa) |
| Animaciones corriendo | 4 | **0** |
| Capas translúcidas apiladas | 6 | **1** |

---

## 6. Hallazgos por severidad

### P0 — bloquean el piloto

**P0-1 · El admin es inalcanzable en teléfono.** `AdminSidebar` es `hidden md:flex` y no existía
ninguna alternativa. Bajo 768 px: 0 enlaces de navegación, sin logout, sin marca. *Evidencia:
`navCandsVisibles: 0` a 320/375/414; captura `vp-320x568.png`.* **Arreglado** (nav móvil, 6
enlaces + logout).

**P0-2 · El logout era inalcanzable en escritorio** por la sidebar de 8 524 px: había que
scrollear 7 519 px. *Evidencia: borde inferior del footer en `top: 8419 px`.* **Arreglado**
(sidebar anclada al viewport, `0,68–0,89×`).

**P0-3 · Sin paginación: 4 segundos por pulsación a 5 121 filas.** *Evidencia: 94 922 nodos DOM,
documento de 403 891 px.* **Arreglado** (25/pág, O(25) constante).

**P0-4 · `/admin/ajustes` era un formulario falso.** Valores hardcodeados y un botón que no
tenía handler. **Arreglado** (solo lectura honesto + enlazado en la nav).

### P1 — a arreglar antes del piloto

**P1-1 · La búsqueda no acotaba los KPIs.** Filtrar a 1 fila y seguir viendo "88 activos".
*Este bloque (`e8ff42b`) se entregó explícitamente como "honestidad del dato"; el admin no lo
cumplía.* **Arreglado** con un aviso de alcance visible.

**P1-2 · Acción destructiva sin confirmar ni feedback.** Desactivar un campo del assessment
para toda la empresa, con 0 diálogos, 0 toasts, y sin revisar `res.ok`. **Arreglado**.

**P1-3 · Pérdida silenciosa de datos en `/admin/campos`.** Sin `beforeunload`. **Arreglado**.

**P1-4 · El sistema de tokens no existe y el panel del coordinador lo usa.**
`bg-superficie`/`rounded-card`/`shadow-card`/`azul-marino` dan **0 reglas CSS**. 11 componentes
con 0 imports. **NO arreglado** (fuera de scope) — fix en §7, Fase 2.

**P1-5 · 0 de 7 columnas ordenables, 0 selección de filas.** Un admin no puede "¿qué está
atascado?" ni actuar sobre un subconjunto. *Orden arreglado; selección no.*

**P1-6 · Fechas futuras muestran "0 h".** `duracionAtencion` hace `Math.max(0, …)`. Una
solicitud con `fecha_creacion` en el futuro se lee como recién creada. **NO arreglado**
(`lib/domain/semaforo.ts` fuera de scope).

### P2

- **`formatoDuracion` con bug de unidades** (`lib/domain/semaforo.ts:114-116`):
 `const m = Math.floor((dias - d) * 30)` usa el resto subdía → toda duración entera ≥60 d
 sale `"400 d · 0 m"`. Fix: `Math.floor(dias / 30)`. **NO arreglado** (fuera de scope; tiene test).
- **`.catch(() => setX([]))`** en dashboard, métricas, campos y coordinadores: un fallo de red
 es indistinguible de "no hay datos". **Arreglado** en dashboard y campos.
- **`/admin/procesos` sin tope por columna**: 4 columnas sin paginación.
- **Color por índice, no por dato**: `COLORES_AVATAR[i % 5]`, `DOTS[i % 3]`,
 `i % 2 === 1 ? sky-400 : sky-200`. Verde que sugiere "activo" sin medir nada.
- **El dashboard no muestra un solo monto.** Sin cotizaciones, sin comparativas, sin presupuesto.
 Para un admin de compras es un agujero de información.
- **Nomenclatura**: `/admin/configuracion` se titula "Ajustes Generales" y colisiona con
 `/admin/ajustes` "Ajustes de Perfil". **Parcialmente arreglado** (nav: "Umbrales y alertas" /
 "Mi perfil"); el `h1` sigue diciendo "Ajustes Generales".
- **`viewport-fit=cover` ausente** (no hay export `viewport` en `app/layout.tsx`), así que
 `env(safe-area-inset-*)` vale 0. **NO arreglado** (`app/layout.tsx` fuera de scope).
- **79 % de las solicitudes sin `tipo`** (96 de 121): el gráfico más prominente dice
 "Sin clasificar 79 %". Es un problema de datos de seed, no de UI — pero el dashboard no lo señala.

### P3

- Coherencia de 2 decimales (`es-HN`) entre dashboard y detalle.
- `aria-sort` presente pero el indicador visual ▲/▼ es un texto, no un `aria-hidden` en el `<th>`.
- Sin `prefers-reduced-transparency` (los blobs ya no están en el admin, pero el resto del
 producto sí los tiene).
- 3 tamaños de fuente por debajo de 12 px siguen en el admin (10 px en etiquetas de KPI y th).

---

## 7. Ruta de renovación en 3 fases

### Fase 1 — Robustez ✅ *hecha en este bloque*

Lo que no es y se rompe. Todo lo de la columna "Arreglado" de §4.

| Archivo | Qué |
|---|---|
| `components/ui-ext/AdminShell.tsx` | `h-dvh` + `min-h-0` en section, scroller interno real, **nav móvil**, se deja de renderizar `AmbientBackground` |
| `components/ui-ext/AdminSidebar.tsx` | Sidebar anclada al viewport, nav con scroller, logout 36×36, `NAV_ADMIN` exportado, 6 entradas |
| `app/admin/page.tsx` | Paginación (25), orden en 6 columnas con `aria-sort`, estado vacío real, contador "1–25 de 122", aviso de alcance de KPIs, error de métricas honesto, filtro por `areaSolicitante`, objetivo táctil 35 px, `truncate` para filas uniformes |
| `app/admin/campos/page.tsx` | Diálogo de confirmación, `res.ok` verificado, feedback `role="status"`, guarda de reentrada, `beforeunload` + `confirm`, estados de carga/error/vacío |
| `app/admin/ajustes/page.tsx` | Formulario falso → solo lectura honesto |
| `styles/globals.css` | Base mobile-native (`tap-highlight`, `touch-action`, `overscroll-behavior`, `user-select` en controles, 16 px solo en `pointer: coarse`) |

**Se gana:** se puede usar en teléfono y en portátil pequeño; sin congelamiento por volumen;
el logout siempre está; el dato no miente sobre su alcance.
**Se arriesga:** cambio de layout en las 6 pantallas admin ( mitigated: medido en 8 viewports);
la nav gana una 6ª entrada; se elimina el fondo animado del admin (cambio de carácter visual
deliberado).

### Fase 2 — Sistema visual ← *siguiente, no tocada*

**Precondición que cambia el plan:** el sistema de tokens **no existe** (P1-4). La Fase 2 no
consolida: **crea**. Y hay que decidir a quién se le hace caso, porque hoy hay tres idiomas.

| Archivo | Qué |
|---|---|
| `styles/globals.css` (`@theme`) | **Definir** los tokens que 11 componentes ya usan: `superficie`, `borde`, `ink`, `texto-secundario`/`terciario`, `azul-marino`, `azul-claro`, `azul-tenue`, `brass`, `rounded-card`, `shadow-card`, `font-display` |
| `components/ui-ext/DataTable.tsx` | Cablearlo de verdad: es el lugar natural de la tabla del dashboard, con orden + paginación ya resueltos en `app/admin/page.tsx` |
| `components/ui-ext/{MetricCard,Topbar,EmptyState,Segmented,Avatar,BarChart,Chip,Timeline,Switch}.tsx` | Darles uso o **borrarlos**. 11 archivos con 0 imports son una trampa: el siguiente agentereen. |
| `app/admin/*` | Escala tipográfica única: 11 / 12 / 13 / 15 / 20 / 28 px, 3 pesos, sin nada bajo 11 px |
| `app/admin/*` | Radios: 3 (6 px control, 8 px superficie, full). Sombras: **3 profundidades** según tamaño de superficie (`apple-design` §12) |
| `app/admin/coordinadores/page.tsx` | **Quitar el color por índice.** El estado del semáforo es un dato, no la posición en un array |

Razonamiento `apple-design` + `emil`: la Fase 1 dejó superficies planas y honestas; la Fase 2 les
da **material**. Tres planos (fondo / superficie / elevada), sombra por tamaño, tracking por
tamaño (§15: negativo en grande, positivo en pequeño), y **restricción**: 3 radios, 3 sombras,
6 tamaños. `emil`: "unseen details compound" — el detalle invisible es la densidad, el
`tabular-nums` en las cifras, el peso del número sobre su unidad, el borde de la fila activa.

**Se gana:** un lenguaje único; el panel del coordinador deja de estar pintado con clases
inexistentes; el admin se ve como el resto del producto.
**Se arriesga:** **alto.** Toca 11 componentes y las 7 pantallas. Es el bloque donde la
regresión visual es probable; necesita revisión en navegador pantalla por pantalla, y decidir
qué se borra (componentes muertos) antes de escribir código.

### Fase 3 — Detalle y motion ← *la última, la que se siente*

Solo cuando 1 y 2 estén firmes. Archivos: `components/ui-ext/*`, `styles/globals.css`.

| Qué | Valor exacto | Por qué |
|---|---|---|
| `:active` con `scale(0.97)` | 100–160 ms `cubic-bezier(0.23, 1, 0.32, 1)` | `emil`: feedback en pointer-down, no en release |
| Hover **gateado** | `@media (hover: hover) and (pointer: fine)` | `mobile-native` §1 (hoy Tailwind v4 ya lo hace por `hover:`, pero hay que mantenerlo) |
| Toast de una sola acción | entrada 200 ms `ease-out`, salida **150 ms** (asimétrica) | `review-animations` std. 9: lo deliberado lento, la respuesta rápida |
| Foco visible | `focus-visible:ring-2` en todo control | Hoy el foco visible solo existe en unos pocos elementos |
| `prefers-reduced-motion` | cross-fade 200 ms, sin transform | `apple-design` §14: reducir ≠ cero |
| `prefers-reduced-transparency` | superficies más opacas, sin blur | `apple-design` §14 |
| **Blobs** | **Decidir globalmente** | Hoy: 0 en el admin, 4 en solicitante/home/público/panel. La decisión debe ser de producto, no por pantalla. Mi recomendación: fuera del admin y del panel (datos), admitidos en home y solicitante (bienvenida) |
| `prefers-contrast: more` | bordes definidos, fondos casi sólidos | `apple-design` §14 |

**Se gana:** se siente rápido, responde y es accesible. **Se arriesga:** bajo, pero **no se
puede verificar sin hardware real** (`mobile-native` "Never Ship": el emulador no reproduce
sticky hover, tap delay, safe area ni teclado).

---

## 8. Red flags por persona

**Ana · admin que usa la herramienta 8 h/día** (la que más suffers con lo que arreglé, y la que
sigue suffering)
- Antes: **7 519 px de scroll para cerrar sesión**, cada vez. Ahora resuelto.
- Antes: la tabla no ordenaba. Para encontrar "las 5 más atascadas" tenía que filtrar por
 coordinador, leer 121 filas y ordenarlas mentalmente. **Sigue sin haber selección de filas
 ni acciones masivas** (P1-5): no puede marcar 8 solicitudes y reasignarlas de golpe.
- Antes: 4 s por pulsación con volumen alto. Ahora 30 ms.
- **Sigue sin ver un solo monto.** Para auditar compras no hay cifras: ni cotizaciones, ni
 comparativas, ni presupuesto. Es el agujero más grande que le queda.

**Lucía · administradora nueva** (la que más la suffers)
- `/admin/ajustes` le ofrecía un formulario con datos falsos y un botón que no hacía nada.
 Ahora es de solo lectura y lo dice. **Pero la primera vez sigue sin saber** de dónde sale
 "88 procesos activos" ni qué significa "Sin decisión > 5 días". No hay glosario ni
 explanation contextual en ninguna de las 7 pantallas.
- El nombre "Catálogo" la llevaba a `/admin/campos`, que es el catálogo de *campos*. Ahora se
 llama "Campos". `/admin/configuracion` se titula "Ajustes Generales" mientras la nav dice
 "Umbrales y alertas" — **dos nombres para lo mismo**, y el `h1` sigue diciendo "Ajustes Generales".
- El gráfico de barras **no tenía números**: tenía que estimar longitudes. "Lester Ramirez: 1"
 era una línea de 2 px frente a "Coordinador BIA: 79". Ahora los números están encima.

**Rodrigo · portátil pequeño en la planta** (el que casi no podía usarlo)
- **Estaba atrapado.** Con el teléfono no tenía navegación, ni logout, ni marca. Ahora tiene
 una barra con los 6 destinos y "Salir" siempre visible.
- Antes a 1024×768 no veía **ni una fila** de datos. Ahora 4.
- La tabla a 320 px sigue siendo de 849 px: scrollea en horizontal **2,7×**. Se puede leer,
 pero auditar con el dedo en una tabla de 7 columnas es incómodo. **Fase 2** debería decidir:
 ¿tarjetas en móvil en vez de tabla?
- **Pendiente de hardware:** `viewport-fit=cover` (falta el meta, `app/layout.tsx` fuera de
 scope) y todo el comportamiento de toque real (`mobile-native`: "Emulation cannot reproduce
 sticky hover, tap delay, rubber-banding, safe areas, or the keyboard"). **No lo he dado por
 arreglado: hay que probarlo en un teléfono.**

---

## 9. Qué reutilizar de los otros flujos — y las inconsistencias de hoy

### La reutilización correcta (y el problema que la bloquea)

Los tres dashboards **no** comparten tokens: no hay nada que reutilizar. El admin usa valores
crudos de Tailwind (`slate-*`, `sky-*`, `rounded-2xl`, `shadow-sm`); el panel y el solicitante
usan clases de token **que no existen**. Lo único común son las 2 familias de fuente.

Lo que sí es reutilizable y ya funciona:

| De | Qué | Cómo lo adopta el admin |
|---|---|---|
| `e8ff42b` (coordinador) | `prefers-reduced-motion` global | Ya es global en `styles/globals.css`; el admin lo ignoraba por usar los blobs. Resuelto al quitarlos |
| `e8ff42b` (coordinador) | Honestidad del dato (loading vs. vacío vs. error) | **Es el estándar, y el admin no lo cumplía.** Fase 1 lo adopta en dashboard y campos |
| `e8ff42b` (coordinador) | Accesibilidad de teclado en la barra de acciones | La nav del admin no tiene roving tabindex; Fase 3 |
| `e8ff42b` (coordinador) | `100dvh` | El admin usaba `min-h-screen`. Fase 1 lo adopta |
| Solicitante (sin commitear) | Wizard móvil, autoguardado con `persistenciaOk`, `Badge`/`Semaforo` a 12 px | El admin ya consume `Badge` y `SemParoBadge`; la diferencia de tamaño entre el `Badge` del admin y el del solicitante es la inconsistencia #3 |
| `components/ui-ext/*` | `DataTable`, `MetricCard`, `EmptyState`, `Segmented` | **Dead code** (0 imports). La Fase 2 debe adoptarlos o borrarlos |

### Inconsistencias concretas entre los tres dashboards (hoy)

| # | Inconsistencia | Admin | Panel (coordinador) | Solicitante |
|---|---|---|---|---|
| 1 | **Tokens** | `slate-500`, `rounded-2xl` (32 px), `shadow-sm` | `texto-secundario`, `rounded-card` (**4 px, inexistente**), `shadow-card` (**inexistente**) | `text-slate-*` + `glass-card` |
| 2 | **Altura del shell** | `min-h-screen` → arreglado a `h-dvh` | usa `100dvh` desde `e8ff42b` | `100dvh` / sticky footer |
| 3 | **Tamaño del `Badge`** | 12 px | 12 px | **12 px tras el bloque sin commitear** (antes otra cosa) — ya convergió |
| 4 | **Fondo animado** | 0 blobs (arreglado) | 4 blobs | 4 blobs |
| 5 | **Hover** | `hover:` gateado por Tailwind v4 ✅ | idem | idem |
| 6 | **Inputs en móvil** | 13 px (**iOS hace zoom**) | ? | 14 px en escritorio, 16 px en táctil ✅ |
| 7 | **Título "Ajustes" duplicado** | `/admin/ajustes` "Mi perfil" + `/admin/configuracion` "Ajustes Generales" | — | — |
| 8 | **Foco visible** | parcial | `e8ff42b` lo mejoró | parcial |

**Las #1 y #4 son la Fase 2.** La #4 es una decisión de producto que no me corresponde: los blobs
se ven bien en la home y en el wizard (bienvenida); en un dashboard de datos y en un panel de
trabajo son ruido. Lo que hice fue sacarlos **solo del admin**, que es lo que estaba en mi
mandato.

---

## 10. Decisión de skills: cuáles y en qué orden

Basado en las 13 recién instaladas + las que ya había en `.agents/skills/`.

| # | Skill | Fase | Por qué, en una línea |
|---|---|---|---|
| 1 | **`impeccable` → `critique`** | **Fase 1 (hecho)** | El encaje exacto: revisión con score de heurísticas + detector determinista. Es lo que produjo la tabla de Nielsen y los 3 `gray-on-color`. Aporta `harden` y `optimize` como subcomandos para las Fases 1 y 3 |
| 2 | **`impeccable` → `harden`** | **Fase 1 (hecho)** | Su definición es literalmente lo que hice: "errores, i18n, edge cases". Es el subcomando correcto para P1-2/P1-3/P2-error-honesto |
| 3 | **`mobile-native`** | **Fase 1 (hecho) + 3 (hardware)** | El admin se usa en la planta. Es la única skill que sabe que `100vh` es el viewport *mayor* y que los inputs de <16 px hacen zoom en iOS. Sus 5 reglas faltantes eran measurements, no opiniones |
| 4 | **`review-animations`** | **Fase 1 (hecho) + 3** | Default "marcar" y conmutador explícito de veredicto. Dio el argumento cuantitativo (18,3 s vs 2,6 s) en vez de "se mueve mucho". En Fase 3 es la puerta de calidad del motion |
| 5 | **`apple-design`** | **Fase 2 y 3** | Es la que tiene las reglas exactas que este admin violaba de forma literal: §12 (apilado de translúcidos, profundidad por tamaño), §14 (fundos a pantalla completa en loop, `dvh`, `prefers-reduced-*`), §15 (tracking por tamaño, jerarquía con peso). Su §16.7 "nothing is random" es el argumento contra los 8 tamaños de fuente |
| 6 | **`emil-design-eng`** | **Fase 2 y 3** | Criterio de detalle fino: `tabular-nums` en cifras, `scale(0.97)` en `:active`, asimetría entrada/salida, y la frase que sostiene el veredicto — "a professional dashboard should be crisp and fast". **Debe ir con `review-animations`**: `review-animations` es el gate, `emil` es la biblioteca de valores |
| 7 | **`impeccable` → `typeset`** | **Fase 2** | La Fase 2 empieza por una escala tipográfica de 6 tamaños. Es exactamente su trabajo |
| 8 | **`impeccable` → `layout`** | **Fase 2** | Radios, sombras, ritmo vertical y densidad. El argumento de "6 capas translúcidas" y "1 sombra para todo" |
| 9 | **`impeccable` → `extract`** | **Fase 2** | La pieza que falta: consolidar tokens y componentes. Los 11 componentes muertos son su caso de entrada |
| 10 | **`impeccable` → `distill`** | **Fase 2** | "Remove complexity" — incluye la decisión de **borrar** los componentes muertos en vez de Adoptarlos |
| 11 | **`impeccable` → `quieter`** | **Fase 2** | El admin es el.superstimulating de los tres: 6 capas, 4 animaciones, color por índice. Esta skill es literalmente el contrapeso |
| 12 | **`impeccable` → `polish`** | **Fase 3** | Pase final de calidad antes de cerrar |
| 13 | **`impeccable` → `optimize`** | **Fase 1/2 (parcial)** | El trabajo de volumen ya está hecho y medido; si se virtualiza en Fase 2, esta skill cubre el resto |
| 14 | **`bug-fix` / `systematic-debugging` / `tdd`** | transversal | Los tres P0 eran bugs, no diseño. `tdt` para la paginación si sevirtualiza |
| 15 | **`codebase-design` + `domain-modeling`** | Fase 2 | `domain-modeling` es lo que resuelve P2: "tiempo promedio" tiene **tres definiciones** distintas (`fechaEnvio→fechaCierre` en el KPI, `fechaCreacion→fechaCierre` en la tabla y el detalle, `fecha_envio` en la SQL de la línea 819). Un nombre, una definición |
| 16 | **`visual-qa` + `browser-debugging`** | transversal | Ya usadas: 8 viewports, 5 121 filas, screenshot 18 s. Es la evidencia de este informe |
| 17 | **`a11y`-style (`apple-design` §14 + `impeccable audit`)** | Fase 3 | `impeccable audit` (el hermano de `critique`) para el pase técnico: foco, `aria-sort`, contraste, `prefers-*` |

### Descartadas, y por qué

| Skill | Por qué no |
|---|---|
| `animate-expo` | **No aplica.** Es React Native; este proyecto es Next.js web. El nombre engaña |
| `write-swift` | **No aplica.** Swift/iOS nativo |
| `brandkit`, `imagegen-frontend-web/mobile` | Esto es una herramienta interna, no una landing ni una app de consumo. Sin imágenes que generar |
| `industrial-brutalist-ui` | El encargo es "enterprise de alto nivel", no "brutalista". Y deliberately lo descartó el usuario |
| `gpt-taste`, `image-to-code` | Orientadas a landing pages con GSAP. Un dashboard de auditoría no es una landing |
| `animate` | **Descartada por ahora, no descartada para siempre.** `review-animations` marca todo el motion actual; añadir motion nuevo antes de que la Fase 2 consolide los materiales sería "it looks cool". En Fase 3 entra, y solo con justificación previa — que es su propio requisito |
| `find-animation-opportunities`, `improve-animations` | Auditan motion de superficies grandes. El admin tiene 4 animaciones, todas borradas. No hay superficie que auditar |
| `prototype` | Requiere invocación explícita; no aporta a una auditoría con datos medidos |
| `pick-ui-library` | El admin no necesita librería: `DataTable` propio con orden+paginación es más ligero que cualquier grid, y ya lo escribí |
| `harden` como skill top-level | Ya viene dentro de `impeccable`; no hace falta cargarla suelta |
| `session-start`, `project-intake`, `session-end`, `feature-close` | Son de lifecycle ADF. Este encargo es una auditoría con alcance acotado, no un cambio de fase del proyecto |
| `grill-with-docs`, `grilling`, `context-router`, `writing-plans` | De discovery y planificación. El discovery ya estaba hecho (el encargo traía la lista de ataques) |
| `web-artifacts-builder`, `pptx`, `docx`, `xlsx`, `pdf` | Formatos de entregable que no son este |
| `ask-sonner` | El admin no usa toasts. Si en Fase 3 adopto un sistema de toasts, esta skill pasa a ser relevante |
| `normalize`, `boilerplate` (diseño) | `normalize` = "match your design system" — no hay design system todavía (P1-4). Va después de Fase 2, no antes |
| `accessibility` (no listada) | No existe como skill propia aquí; el a11y vive en `apple-design` §14 y `impeccable audit` |

### El orden, en una frase

**`critique` + `harden` + `mobile-native` + `review-animations` (Fase 1, medir antes de tocar) →
`typeset` + `layout` + `extract` + `distill` + `quieter` + `domain-modeling` (Fase 2, el sistema
que no existe) → `review-animations` + `animate` + `polish` + `impeccable audit` (Fase 3, con
hardware real).**

---

## 11. Verificación

| Comprobación | Resultado |
|---|---|
| `tsc --noEmit` | **exit 0** ✅ |
| `vitest run` | **190 pasan, 1 falla** — `components/solicitante/borrador-hook.test.tsx > A11.3` |
| `eslint` (mis 6 archivos) | **exit 0, 0 problemas** ✅ |
| `eslint .` (repo) | 0 errores, 35 warnings (preexistentes, ninguno mío) |
| Playwright, 8 viewports × 6 páginas | 0 errores de aplicación, 0 animaciones, `main` presente en las 6 |
| Flujo solicitante | ✅ wizard renderiza, 8 inputs, `body { overflow-x: clip }` intacto |
| Flujo público (`/`) | ✅ sin error |
| Base de datos | 122 solicitudes, 136 cotizaciones, `campo_catalogo.titulo = activo` — **sin cambios** |

### Sobre ese test que falla — y por qué **no es mío**

`A11.3: si el navegador no deja guardar, no dice 'Borrador activo'` mockea
`localStorage.setItem` para que lance y espera `persistenciaOk === false`. Falla **3 de 3 veces**
(no es flake).

**Lo revertí para probarlo:** hice backup byte-exacto de mis 6 archivos, `git checkout HEAD --
app/admin components/ui-ext/AdminShell.tsx components/ui-ext/AdminSidebar.tsx`, ejecuté el test,
y **falló igual**. Restauré del backup. El test pertenece al bloque **solicitante sin
commitear** (`borrador-hook.test.tsx` y `hooks/useSolicitudWizard.ts` están en la lista de "no
tocar") y falla en `HEAD` del admin limpio. **No lo toqué.** Le corresponde a quien lo escribió.

Los 190 que pasan incluyen `app/panel/page.test.tsx` (el bloque del coordinador, `e8ff42b`).

### Regresión de los otros flujos, verificada específicamente

Como toqué `styles/globals.css` (compartido), comprobé explícitamente que **no** piso al solicitante:

| | Escritorio (after) | Antes de mi cambio |
|---|---|---|
| Inputs del solicitante | **14 px** ✅ (su tamaño de diseño) | 16 px (inflados por mi regla) |
| Inputs del admin | **13 px** ✅ | 16 px |

Mi primera versión de la regla (`input { font-size: 16px }` global + override con
`pointer: fine`) **era ineffectiva y pisaba el diseño del solicitante en escritorio**. La
acoté a `@media (pointer: coarse)`: en escritorio no cambio absolutamente nada, y los 16 px
siguen aplicándose en táctil real. **No pude verificar el comportamiento táctil en hardware**
(no hay teléfono conectado) — eso queda pendiente, y lo digo explícitamente.

---

## 12. Evidencia

Capturas en `qa/evidencia-piloto/critique-admin/`:

| Archivo | Qué |
|---|---|
| `00-baseline-1440x900.png` | Dashboard antes: sidebar gigantesca, 3 filas, fondo menta, 4 blobs |
| `01-volumen-5121-filas.png` | 5 121 filas: documento de 403 891 px |
| `02-busqueda-1-fila-kpis-intactos.png` | Búsqueda a 1 fila con KPIsFollow globales |
| `03-campos-toggle-sin-confirmacion.png` | Toggle destructivo sin confirmar |
| `vp-{320x568,375x667,768x1024,1024x768,1280x800,1440x900,1920x1080,2560x1440,1366x600,1280x500}.png` | Matriz de viewports **antes** |
| `05-ARREGLO-vp-*.png` | Matriz **después** |
| `06-ARREGLO-dashboard-1440.png` | Dashboard corregido a 1440×900 |
| `07-ARREGLO-estado-vacio.png` | Estado vacío con motivo y "Limpiar filtros" |
| `08-ARREGLO-movil-390.png` | Navegación móvil presente |
| `09-ARREGLO-confirmacion-toggle.png` | Diálogo de confirmación del toggle |
| `seed-volume.mjs` | Generador de volumen con marcador `ZZLOAD-` (cleanup quirúrgico) |

Scripts de medición: `seed-volume.mjs`. Los probes de viewport se ejecutaron vía Playwright MCP
(el Chromium cacheado del repo, build 1223, da falso negativo en los checks de actionability y
se cuelga en los screenshots por las animaciones infinitas — 18,3 s por captura).

Base de datos: se sembraron hasta 5 000 solicitudes marcadas `ZZLOAD-` y 5 patológicas `ZZEXT-`,
y se eliminaron **solo** esas. Las 121 originales y las 136 cotizaciones están intactas.
