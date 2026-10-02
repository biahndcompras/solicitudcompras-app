# Project Lessons

Record only corrections that generalize into a rule capable of preventing the same mistake. Do not use this file as a session diary.

## Un campo declarado en el schema no está implementado

2026-10-02 — `contexto_investigado` estaba en el schema Zod, con `default("")`, y por eso
parecía funcionar. El prompt nunca lo pedía (el modelo no lo emitía) y la UI nunca lo leía
(el texto se perdía). Para que un campo llegue a pantalla tiene que existir en las cuatro
capas: prompt → schema → estado → render.

**Regla:** antes de dar por hecho que un campo de salida existe, seguí su camino completo.
`grep` del nombre en las cuatro capas. Un `default("")` en el schema hides el hole, not
closes it.

## Un tope aplicado a una lista combinada descarta lo obligatorio

2026-10-02 — al forzar campos obligatorios en el assessment, el límite de 10 preguntas se
aplicaba después de unir obligatorios y preguntadas por la IA. Con más de 10 obligatorios
sobrantes, los últimos se perdían **en silencio**: el solicitante no los veía, el aviso de
envío no los listaba, y el RFQ llegaba sin ellos. El feature anulaba su razón de existir.

**Regla:** cuando un límite trunque una lista, el recorte aplica a lo descartable y nunca a
lo obligatorio. Y probá el caso adversarial del límite (más elementos que el tope), no solo
el feliz.

## Un escaner de secretos solo ve los patrones que le enseñaron

2026-10-02 — `scripts/secret-scan.sh` pasó limpio con las contraseñas del panel hardcodeadas
en 4 archivos de QA. Busca patrones de API key (`sk-`, JWT, `AKIA…`), no contraseñas en
scripts de prueba. "El escaneo pasó" no es "no hay secretos".

**Regla:** cuando agregues un escáner, pensá qué clase de secreto **no** detecta y decilo.
Ningún escáner es completo; el que dice que sí, miente.

## Comparar dos modelos por un parámetro que la ruta ignora

2026-10-02 — reporté una comparación entre `gemini-2.5-flash` y `gpt-4o-mini` usando un
`modeloOverride` que `POST /api/ia/assessment` no declara: Zod descarta la clave desconocida y
las dos "corridas" eran el mismo modelo por defecto. El resultado parecía verosímil, así que
pasó dos turnos sin que nadie lo cuestionara.

**Regla:** antes de comparar A contra B, verificá que el harness realmente cambia entre A y B.
Imprimí el valor efectivo (`getModel()`) una vez, en la propia corrida, y verificalo en la
salida. Si no podés demostrar que el paráetero surtió efecto, no tenés una comparación.