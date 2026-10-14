---
estado: analisis-para-decision
fecha: 2026-10-14
pedido: login del solicitante con verificación por código para ver sus solicitudes
---

# Login del solicitante: análisis y plan

## 1. El problema real es más grande que los montos

Hoy la identidad del solicitante es **"declarar un correo"**:

```
/solicitud/nueva?email=X&nombre=Y&area=Z
/mis-solicitudes?email=X
/mis-solicitudes/<id>?email=X
```

No hay ninguna prueba de que quien escribe `X` sea el dueño de `X`. Consecuencias, de menor a
mayor:

1. Ver el historial de otra persona con solo saber su correo.
2. Ver los **precios de sus proveedores** (esto se cerró el 2026-10-14, pero fue tapar el
   síntoma: la raíz sigue ahí).
3. **Responder en su nombre** las preguntas de Compras.
4. **Enviar solicitudes** haciéndose pasar por otro — con su nombre, su área y su correo como
   remitente de los correos.

El punto 4 es el más serio y no lo habíamos visto: cualquiera puede generar solicitudes reales
a nombre de un compañero, y esas solicitudes le llegan a Compras como si fueran legítimas.

**Lo que pide el cliente es la solución correcta: que el solicitante demuestre que es él.**

## 2. ¿Supabase + Resend, o solo Resend?

**Recomendación: Supabase Auth con OTP por correo, y Resend como el servidor de correo.**

No son alternativas. Resend **no es** un sistema de autenticación: es un servicio de envío.
Supabase Auth **sí** es el sistema de autenticación, y **usa** a Resend para mandar el correo.

Así se reparte el trabajo:

| Quién | Qué hace |
|---|---|
| **Supabase Auth** | Genera el código, lo guarda, controla su expiración, limita los reintentos por correo, valida el código, emite la sesión, la refresca y la maneja en cookies |
| **Resend** (vía SMTP de Supabase) | Entrega el correo con el código, desde el dominio ya verificado |

### Por qué no "solo Resend"

Sería construir autenticación a mano: generar códigos, guardarlos, decidir cuándo expiran,
impedir la fuerza bruta, firmar una sesión, invalidarla, y hacerlo todo sin equivocarse. **Es
exactamente donde la autenticación casera falla.** Y no lo necesitamos: el sistema ya existe y
el equipo de Compras ya lo usa.

### Por qué encaja bien acá

- **El equipo ya está en Supabase Auth.** Agregar al solicitante es sumarlo al mismo modelo, no
  crear un segundo.
- **La infraestructura está**: `getSession()`, `guardApi`, el middleware y `@supabase/ssr`
  existen y funcionan.
- **No hay migración de datos**: la identidad **ya es el correo**. El día que el solicitante
  entre con su correo, sus solicitudes ya son suyas. Solo cambia *cómo se prueba* ese correo.
- **Resend ya está configurado y verificado** (`biahnd.website`), y Resend está en la lista
  oficial de proveedores SMTP de Supabase.

### Lo que cuesta

- Al activar SMTP propio, Supabase impone **30 correos/hora** por defecto, para cuidar la
  reputación del dominio. Es ajustable desde la configuración de límites. Para un piloto de
  ~10 compras, sobra.
- Cada solicitante que entra pasa a ser un usuario de Supabase Auth. Con el volumen del piloto
  es despreciable.

## 3. Las decisiones de diseño

### 3.1 ¿Qué acciones exigen sesión y cuáles siguen por enlace?

No todo necesita login. Un login para aprobar un enlace mata la ventaja del enlace.

| Acción | Cómo se prueba la identidad | Por qué |
|---|---|---|
| Ver el historial (`/mis-solicitudes`) | **Sesión** | Acceso prolongado y sensible: montos, estados, todo |
| Ver el detalle (`/mis-solicitudes/<id>`) | **Sesión** | Igual. Es el mismo dato |
| Responder preguntas de Compras | **Enlace con token** (`/responder/<token>`) | Es una acción puntual, nacida de un correo. Igual que decidir |
| Decidir la comparativa | **Enlace con token** | Ya funciona así; el riesgo está aceptado (ADR 0007) |
| Crear una solicitud | **Sesión** | Es el punto 4 del §1: hoy se puede suplantar |

**Consecuencia:** el detalle deja de usar `?email=` y pasa a usar la sesión. Los enlaces de los
correos 2 y 6 llevan al login si no hay sesión, y vuelven a donde iban (`?next=`).

### 3.2 ¿El login es obligatorio siempre?

Si se pide el código para entrar a **ver** y para **crear**, el flujo deja de ser "sin
contraseñas". Sigue siendo sin contraseñas —un código de 6 dígitos no es una contraseña— pero
suma un paso.

**La sesión dura**, así que es "código una vez, y después entra por semanas". Con `@supabase/ssr`
el refresco es automático.

### 3.3 ¿Qué pasa con los enlaces de los correos que ya se enviaron?

Los correos viejos apuntan a `?email=` y dejarían de funcionar. Como todavía no hay piloto,
**no hay correos reales en circulación**: se cambia y listo.

### 3.4 El rol del solicitante

Hoy `getSession()` **devuelve `null` si el usuario no tiene rol de staff** (`lib/auth.ts`). Un
solicitante logueado quedaría tratado como "sin sesión". Hay que agregar el rol:

- `solicitante` pasa a ser un rol más, o
- la sesión sin rol se interpreta como solicitante

**Recomiendo lo primero**: un rol explícito en `app_metadata`, para que el middleware pueda
decidir por ruta sin ambigüedad. Es la misma mecánica que ya usan coordinador y admin.

## 4. Cómo analizaría el problema antes de escribir código

Las preguntas que me haría, y que conviene contestar por escrito:

1. **¿Qué protege esta autenticación?** Los cuatro puntos del §1. El objetivo no es "tener
   login", es que la identidad deje de ser una declaración.
2. **¿Qué se rompe al activarla?** El wizard, `mis-solicitudes`, el detalle, los enlaces de
   los correos 2 y 6, los tests e2e y los scripts de QA que usan `?email=`. Todo eso hay que
   inventariarlo antes, no descubrirlo a mitad.
3. **¿Qué NO debe cambiar?** El enlace de decisión y el de responder: si piden login, la
   ventaja del enlace desaparece y el riesgo ya está aceptado.
4. **¿Cómo se abusa de esto?** Alguien escribiendo el correo de otro para inundarlo de
   códigos. Supabase limita por correo, pero conviene sumar espera entre intentos y evaluar
   CAPTCHA.
5. **¿Qué pasa si el correo no llega?** Sin salida el usuario queda afuera. Hace falta un
   "reenviar código" y un mensaje que explique revisar el spam.
6. **¿Cómo se verifica?** Recorrido completo en navegador de los tres roles, y que el código
   **no** llegue a un correo ajeno.

## 5. Plan de implementación

Por bloques, con la misma disciplina que 010: test que falla primero, verificación en
navegador, y `TASKS.md` en el mismo commit.

### Bloque 0 — Configuración (no es código)

1. Activar OTP por correo en Supabase Auth.
2. Configurar SMTP propio con las credenciales de Resend, remitente del dominio verificado.
3. Ajustar el límite de correos por hora.
4. Traducir las plantillas de correo de Supabase al español y al registro de "usted".

**Verificación:** pedir un código a un correo real y recibirlo. Sin esto, nada más importa.

### Bloque 1 — El rol y la sesión

- Agregar `solicitante` como rol, con su lugar en `SesionAutenticada` y en el middleware.
- `scripts/seed-auth.mjs` extendido, o los solicitantes se crean solos al entrar (OTP crea el
  usuario la primera vez).

### Bloque 2 — La pantalla de acceso

- `/login/solicitante`: correo → `signInWithOtp` → código → `verifyOtp` → sesión.
- Reutilizar el estilo de los otros dos logins.
- Espera entre intentos, "reenviar código", y mensajes que digan qué hacer si no llega.

### Bloque 3 — Mudar la identidad del solicitante a la sesión

- `/solicitud/nueva`, `/mis-solicitudes` y el detalle pasan a leer la sesión en vez de `?email=`.
- El middleware los protege.
- **Se elimina `?email=`**: es la vulnerabilidad, no un atajo.

Este bloque es el delicado: toca las tres pantallas del solicitante y todos los enlaces.

### Bloque 4 — Los enlaces que quedan por token

- Responder preguntas pasa a `/responder/<token>`, con el mismo patrón que la decisión.
- Los correos 2 y 6 apuntan al login con `?next=`, o al token si la acción es puntual.

### Bloque 5 — Verificación

- Los cuatro puntos del §1, uno por uno, intentando hacer el mal: entrar con el correo de
  otro, enviar a nombre de otro, responder por otro.
- Recorrido de los tres roles en navegador.
- Actualizar los tests e2e y los scripts de QA que usan `?email=`.

## 6. Lo que hay que decidir antes de empezar

| # | Decisión | Mi recomendación |
|---|---|---|
| 1 | ¿Supabase Auth con Resend como SMTP? | **Sí.** Resend no es autenticación; construirla a mano es el error clásico |
| 2 | ¿Login obligatorio para ver **y** crear? | **Sí**, si no se cierra el punto 4 (suplantar solicitudes) |
| 3 | ¿La decisión y responder siguen por enlace sin login? | **Sí.** Si piden login, el enlace pierde su razón de ser |
| 4 | ¿Rol `solicitante` explícito? | **Sí**, para que el middleware decida por ruta |
| 5 | ¿Sesión de cuánto dura? | Lo que dé Supabase por defecto, con refresco. "Código una vez por semanas" |
| 6 | ¿Qué pasa con los correos ya enviados? | Nada: no hay piloto en marcha |

## 7. Lo que necesito para arrancar

- **La consola de Supabase** para activar OTP y configurar el SMTP. O las credenciales SMTP de
  Resend, si preferís configurarlo vos.
- **Confirmación del punto 2** de la tabla: si el login es obligatorio también para crear, es
  un cambio de comportamiento que hay que asumir con Compras (contradice el "sin contraseñas"
  que declara el brief, así que va a un ADR).
