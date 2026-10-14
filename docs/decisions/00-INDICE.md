---
title: Decision Log — Portal de Compras BIA
status: review
authority: technical
owner: Intelia (build)
last_reviewed: 2026-08-12
---

# Registro de decisiones — Portal de Compras BIA

Bitácora de decisiones arquitectónicas y de producto (ADRs) en `docs/decisions/`. Formato y criterios según `.agents/skills/domain-modeling/ADR-FORMAT.md`.

| ADR | Decisión |
|---|---|
| 0001 | Nombre de producto: Portal de Compras BIA |
| 0002 | Terminología canónica: "coordinador" (no "comprador") |
| 0003 | Estimación de duración: 7–10 semanas de desarrollo, 9–12 con piloto |
| 0004 | Nomenclatura de correos: 4 del ciclo + 1 de alerta configurable |
| 0005 | Sistema autocontenido: cero integraciones con el ERP del cliente |
| 0006 | Catálogo de campos como única fuente de verdad |
| 0007 | Riesgo asumido: el enlace público de decisión no tiene contraseña |
| 0008 | Registro de la interfaz: "usted", nunca voseo |

> El `user-flows.md` (docs/product) es la autoridad de comportamiento de roles/acciones/funcionalidades; los ADRs aquí registran *por qué* se decidió algo, no el detalle funcional.
