---
estado: pendiente-de-respuesta
dirigido-a: Ladi Matute (Compras)
preparado: 2026-10-14
---

# Seis decisiones para arrancar el piloto

Estas son las seis cosas que falta definir para que el Portal de Compras empiece a usarse.
Todo lo demás está construido y funcionando.

**Cómo responder:** escriba al lado de cada número lo que decida. Si alguna no la tiene clara,
márquela como "hay que hablarlo" y lo vemos juntos.

---

## 1. Quiénes van a usar el portal y con qué rol

El portal tiene tres roles: **solicitante** (pide), **coordinador** (cotiza y recomienda) y
**administrador** (ve los números y configura).

**Lo que necesitamos:** la lista de las personas que van a entrar, con el rol de cada una.

**Ejemplo de respuesta:**
> Solicitantes: los gerentes de área de Mercadeo, Ventas y Manufactura.
> Coordinadores: María José, Lester y Bryan.
> Administrador: yo.

---

## 2. Quién atiende cada tipo de compra

Cuando alguien pide algo, el sistema decide a qué coordinador le llega. Hoy la regla es: según
el **tipo de necesidad** que el solicitante elija (mercadeo, logística, administrativo,
tecnología, etc.), le llega al coordinador que tenga asignado ese tipo.

**Lo que necesitamos:** qué tipos de compra atiende cada coordinador.

**Ejemplo de respuesta:**
> María José: mercadeo y publicidad.
> Lester: servicios logísticos y tecnología.
> Bryan: administrativo y CAPEX.
> Si algo no encaja en ninguna, que le llegue a Bryan.

**Si prefiere otra regla** (por monto, por área que pide, repartir por turnos), dígalo y la
implementamos.

---

## 3. Qué tipos de solicitud va a usar el piloto

El portal maneja tres tipos:

- **RFQ — Solicitud de Cotización.** "Quiero esto, mándenme precios." Es el caso normal.
- **RFP — Solicitud de Propuesta.** "Tengo un problema, propónganme soluciones."
- **RFI — Solicitud de Información.** "Quiero saber qué hay en el mercado", sin comprar todavía.

**Hoy funcionan RFQ y RFP completos.** RFI está disponible pero **sin formulario propio**: no
tiene una lista de preguntas preparada, así que las preguntas se las hace el asistente según el
caso.

**Lo que necesitamos:** ¿quieren que el piloto incluya RFI, o arrancamos solo con RFQ y RFP?

**Ejemplo de respuesta:**
> Arranquemos solo con RFQ y RFP. RFI lo vemos después.

---

## 4. Cuántos días puede quedarse una comparativa sin respuesta

Cuando le mandamos la comparativa al solicitante para que decida, el sistema espera. Pasado
cierto tiempo, **avisa** para que nadie se olvide. Hoy el aviso sale a los 5 días.

**Lo que necesitamos:** confirmar si 5 días es el número correcto, o si prefieren otro.

**Ejemplo de respuesta:**
> 5 días está bien. Si a los 5 días no contestó, avísenme a mí también.

**Nota:** esto es solo el aviso. La solicitud no se cierra sola; el solicitante siempre puede
decidir más tarde.

---

## 5. Qué hacer con los impuestos de las cotizaciones

Honduras tiene casos donde a una compra **no se le cobra el 15% de impuesto**, o donde hay
**retenciones** que se descuentan. Por ejemplo, ciertos servicios profesionales.

**Hoy el sistema hace esto:** revisa que las cuentas cuadren (neto + impuesto = total) y avisa
si un proveedor no desglosó el impuesto. **Pero no conoce los casos especiales**, así que no
puede decirle a un proveedor que está exento.

**Lo que necesitamos:** ¿cuáles son las excepciones que debemos reconocer, y cómo se calculan?

**Ejemplo de respuesta:**
> Los servicios de consultoría no llevan ISV pero sí retención del 12.5%.
> Los alimentos básicos están exentos.
> Todo lo demás lleva 15%.

**Si prefieren dejarlo así por ahora**, dígalo: el sistema seguirá avisando cuando las cuentas
no cuadren, y esas reglas las aplica el coordinador a mano.

---

## 6. Cuál es el tamaño máximo de archivo que se puede subir

Los proveedores mandan sus cotizaciones en PDF, Word o foto. El sistema acepta hasta **10 MB**
por archivo.

**Lo que necesitamos:** confirmar si 10 MB alcanza para lo que suelen mandar, o si necesitan más.

**Ejemplo de respuesta:**
> 10 MB está bien.

**Por qué se pregunta:** las cotizaciones escaneadas o con muchas fotos pueden pesar más. Si
hace falta más, se cambia la configuración, pero conviene saberlo antes del piloto.

---

## Lo que NO hace falta que decida

Para que no se preocupe por cosas que ya están cerradas:

- **El riesgo del enlace:** ya nos confirmó que lo entienden y lo aceptan.
- **El lenguaje del portal:** se dirige de "usted" en todas las pantallas.
- **Los correos:** ya salen de verdad, desde el dominio `biahnd.website`.
- **Cancela solo Compras:** el solicitante no puede cancelar su propia solicitud.
- **"Ninguna me sirve":** devuelve la solicitud a Compras para reevaluar; no la cierra.

---

## Resumen para copiar y responder

```
1. Equipo y roles:
   Solicitantes:
   Coordinadores:
   Administrador:

2. Quién atiende cada tipo de compra:

3. Tipos del piloto (¿incluye RFI?):

4. Días sin respuesta antes de avisar:

5. Excepciones de impuestos:

6. Tamaño máximo de archivo:
```
