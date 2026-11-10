# ENGRAM Demo — Frontend and MCP Direction

## Diagnóstico

### Observación

El frontend mezcla tres columnas densas, muchos bordes, muchos botones y varios tonos de gris similares. El canvas, el inspector, los filtros y las acciones de exportación compiten por la misma atención.

### Contexto

ENGRAM no es un dashboard común: es una sala de investigación de evidencia y procedencia.

### Regla de diseño

La interfaz debe guiar una investigación, no mostrar todas las capacidades al mismo tiempo.

## Analogía útil: Obsidian, pero para procedencia

Sí vale la pena usar Obsidian como referencia explicativa. Ayuda a que alguien entienda rápidamente que ENGRAM trabaja con notas o memorias conectadas en un canvas, con navegación entre nodos y un panel de detalle.

La frase podría ser:

> ENGRAM es como Obsidian para investigar la procedencia de una memoria: cada nodo tiene evidencia, estado de custody y relaciones verificables.

La analogía debe tener límites claros:

- Obsidian organiza conocimiento personal.
- ENGRAM investiga evidencia y cadena de custody.
- En Obsidian, un enlace puede ser una decisión editorial del usuario.
- En ENGRAM, una relación debe indicar si es directa, derivada, no atestiguada o sólo posible.
- Obsidian permite editar y reorganizar notas.
- ENGRAM debe distinguir con claridad entre mover una tarjeta visualmente y modificar el estado real de una memoria.

No conviene copiar la estética de Obsidian literalmente. Conviene copiar su modelo mental reconocible: canvas, nodos, backlinks, panel contextual y navegación por relaciones. La identidad visual debe seguir siendo la de un laboratorio de investigación.

Una introducción posible para la demo:

> Si conocés Obsidian, pensá en ENGRAM como un canvas de conocimiento donde cada conexión tiene que explicar de dónde viene y qué tan confiable es.

## Dirección visual propuesta

### 1. Evidence command center

- El canvas debe ser el protagonista.
- Reducir el rail izquierdo a navegación, investigación y filtros.
- Convertir el inspector derecho en un drawer contextual que aparece al seleccionar una memoria.
- Pasar exportaciones, guardado de vistas y login a un menú secundario.
- Hacer que la pregunta `Can this memory still be trusted?` sea el encabezado narrativo central.

### 2. Jerarquía visual

- Fondo casi negro azulado.
- Un solo color primario frío para acciones y selección.
- Amarillo sólo para sospecha o advertencia.
- Rojo sólo para riesgo real.
- Verde sólo para evidencia confirmada.
- Menos bordes visibles; usar contraste, espaciado y sombras suaves para separar superficies.

Ahora casi todos los elementos parecen paneles equivalentes. La persona usuaria no sabe qué mirar primero.

### 3. Tarjetas del grafo

Cada tarjeta debería mostrar:

- Estado visual fuerte acompañado por texto.
- ID pequeño y secundario.
- Topic como elemento principal.
- Una línea de resumen.
- Tipo de relación mediante una etiqueta breve.
- Selección con halo y elevación, no sólo con borde cyan.
- Hover preview limpio, no otro panel pesado.

El grafo debería tener niveles de zoom semánticos: al alejarse se ven estados y relaciones; al acercarse aparecen topic, preview y metadatos.

### 4. Barra de acciones

Agrupar las acciones actuales así:

- Navegación: zoom, fit y focus.
- Vista: graph layout y reset.
- Evidencia: export bundle y export JSON.
- Comparación: una acción destacada aparte.

La barra actual concentra demasiadas acciones al mismo nivel.

### 5. Guided scenario

El stepper debería verse como una barra de progreso compacta:

`Observe → Trace → Understand → Compare → Preserve`

Con una sola instrucción principal, un CTA dominante, acciones secundarias colapsadas y un estado actual muy visible.

### 6. Identidad visual

El concepto de laboratorio de memoria permite una estética propia:

- Sans técnica para controles.
- Serif o display sólo para preguntas e hipótesis.
- Textura sutil de papel técnico o grilla en el canvas.
- Líneas de conexión con estilos distintos, pero más limpias.
- Tipografía monoespaciada sólo para hashes, IDs y receipts.
- Iconografía consistente para custody, derivation, quarantine y hypothetical.

Evitar efectos sci-fi gratuitos. La identidad debe reforzar investigación y trazabilidad.

### 7. Estados de interfaz

Cada estado debe verse intencionalmente diferente:

- Loading: skeleton del canvas y del inspector.
- Empty: `No memories match this filter`, con acción para limpiar filtros.
- Error: `The adapter could not load custody data`, con retry.
- Partial: warning visible, por ejemplo `Graph incomplete: 4 of 8 impact reports loaded`.
- Mutation: preview, confirmación, éxito y rollback visual si falla.

Loading, success, empty y error no deben parecerse entre sí.

## MCP recomendado

### Chrome DevTools MCP

Para analizar la interfaz corriendo: screenshots, inspección DOM/CSS, Lighthouse, consola, red y emulación responsive.

Referencia: [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp)

Ya aparece disponible en el entorno actual.

### Figma MCP oficial

Para definir una dirección visual y extraer tokens y componentes. Permite llevar una UI existente a capas editables y leer variables, componentes y layout.

Referencia: [Figma MCP oficial](https://developers.figma.com/docs/figma-mcp-server/)

### IWSDK Spatial UI

Para la parte XR conviene mantener UIKitML y hacer que comparta la misma jerarquía visual que el canvas 2D.

Referencia: [IWSDK Spatial UI](https://developers.meta.com/vr/documentation/iwsdk/concepts/spatial-ui/flow/)

## Prompt para Chrome DevTools MCP

```text
Inspect the running ENGRAM Canvas at desktop and mobile widths.
Do not modify code.

Report:
1. Visual hierarchy problems.
2. Elements competing for attention.
3. Inconsistent spacing, typography, colors, borders, and radii.
4. Loading, empty, partial, and error states that are visually ambiguous.
5. Keyboard and focus issues.
6. Three concrete redesign directions, each preserving the existing evidence semantics.
7. Screenshots or selectors for every finding.
```

## Prompt para Figma MCP

```text
Create a visual redesign direction for ENGRAM Canvas as an evidence investigation command center.

Preserve:
- custody status semantics
- direct, derived, unattested, and possible relationship types
- factual versus hypothetical worlds
- provenance and chain-of-custody language

Improve:
- hierarchy
- density
- graph readability
- contextual inspector behavior
- guided investigation flow
- visual distinction between confirmed evidence, suspicion, and hypothetical results

Produce:
- color tokens
- typography tokens
- spacing and radius tokens
- card states
- inspector states
- desktop and mobile layouts
```

## Recomendación

El primer cambio debería concentrarse en la composición de `client/canvas.html` y en el sistema de tokens de `client/src/canvas/canvas.css`. Después habría que alinear los paneles `.uikitml` para que la versión XR comparta la misma jerarquía visual.

El problema principal no es falta de tecnología: es que demasiadas capacidades aparecen al mismo nivel.
