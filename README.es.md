# ENGRAM (resumen en español)

**Geometría de la evidencia.** ENGRAM es el entorno de investigación
—escritorio Canvas y espacial XR— sobre MNEME, el motor autoritativo
de memoria verificable. MNEME decide y prueba; ENGRAM lo hace
inspeccionable. Ninguna vista es autoridad: arrastrar una tarjeta solo
mueve layout, lo hipotético nunca se mezcla con lo factual, y toda
mutación pasa por preview, autorización de MNEME y commit explícito.

## Arranque local

```sh
./scripts/dev-local.sh
python3 scripts/verify-fixture.py   # escenario sintético reproducible
python3 scripts/test-adapter.py     # regresiones del adaptador
```

Abrí `https://localhost:8081/canvas.html` (Canvas) o `/index.html`
(XR). La demo guiada —Observe, Trace, Understand, Compare, Preserve—
está en `docs/DEMO-SCENARIO.md`; validación XR y seguridad en
`docs/XR-INTERACTION-VALIDATION.md` y `docs/SECURITY-ROUND4.md`.
Sin headset conectado no se afirma validación en hardware.
