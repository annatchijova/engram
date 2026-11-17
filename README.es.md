[English](README.md) · [Español](README.es.md) · [README técnico](README_TECHNICAL.md)

# ENGRAM

**La memoria tiene geometría.**

![Logo de ENGRAM](visual/ENGRAM-logo.png)

## ¿Y si pudieras entrar físicamente en la memoria de una IA?

Hoy la memoria de una IA suele aparecer como texto, registros o datos
invisibles. Cuando un recuerdo cambia, es difícil saber de dónde vino, quién
lo modificó, qué contradice o qué decisiones posteriores depende de él.

ENGRAM transforma la memoria computacional en un espacio de investigación
explorable. Sobre [MNEME](https://github.com/annatchijova/mneme), permite
recorrer recuerdos, examinar su procedencia, ensayar una intervención
autorizada, comparar un mundo factual con un hipotético sellado y verificar la
evidencia resultante.

No es un grafo 3D decorativo. Es una forma de investigar una pregunta difícil:
**¿qué cambiaría si dejáramos de confiar en este recuerdo?**

## Entrá por acá

- **[Observatorio XR](https://client-six-mu-93.vercel.app)** — la experiencia
  hands-first para Meta Quest/WebXR.
- **[Canvas 2D](https://client-six-mu-93.vercel.app/canvas.html)** — el mismo
  campo desde un navegador convencional.
- **[Slides](https://annatchijova.github.io/engram/slides.html)** — la historia
  visual breve.
- **[Bundle de evidencia](visual/engram-bundle.json)** · **[Export del canvas](visual/engram-canvas.json)**

La web y XR trabajan sobre el mismo adaptador y el mismo campo MNEME. El
navegador es la mesa de investigación accesible; el observatorio es el
instrumento espacial para relaciones difíciles de sostener en una vista plana.

## ¿Para quién existe?

ENGRAM está pensado para quienes necesitan comprender cómo una memoria de IA
llegó a ser lo que es, no solamente guardar otro dato:

- investigadores de memoria persistente, contradictoria o cambiante;
- equipos que construyen o evalúan sistemas multiagente con procedencias mixtas;
- equipos de seguridad y auditoría que investigan contaminación e impacto;
- laboratorios y universidades que enseñan o estudian memoria computacional.

Son usuarios previstos, no clientes validados. La propuesta es volver
operable e inspeccionable una investigación compleja; no afirmamos que VR sea
la interfaz correcta para cada tarea de memoria.

## Una investigación completa

La demo acompaña un recuerdo a través de cinco preguntas:

1. ¿Qué hay en el campo y cuál es su estado de custodia?
2. ¿De dónde salió este registro?
3. ¿Qué recibos, decisiones y memorias afecta?
4. ¿Qué cambiaría una intervención acotada?
5. ¿Se puede verificar el bundle resultante de manera independiente?

El Canvas puede preparar y confirmar la única operación de cuarentena
soportada. En el observatorio, un pinch corto selecciona, uno sostenido carga
un objeto y soltarlo solo prepara una vista previa; el commit autorizado es un
gesto explícito separado. El gesto propone una acción: nunca es la autoridad.

## ¿Por qué XR?

El valor de XR aparece cuando una investigadora necesita sostener a la vez
procedencia, custodia, dependencias, autoridad, cambios históricos y
consecuencias de una intervención. ENGRAM les da lugares y formas distintas,
mientras MNEME conserva la autoridad sobre el estado subyacente.

La misma investigación está disponible en la web. Meta Quest es el destino de
la modalidad espacial hands-first, no una barrera que impida investigar desde
una computadora.

## Galería de evidencia

### El Canvas de investigación

![Investigación inicial en ENGRAM](visual/canvas-initial.png)

![Grafo de procedencia de ENGRAM](visual/canvas-provenance.png)

### La superficie 2D

<img src="visual/2D/Screenshot%20from%202026-11-17%2016-24-06.png" alt="Superficie 2D de investigación de ENGRAM" width="640">

<img src="visual/2D/Screenshot%20from%202026-11-17%2016-28-53.png" alt="Superficie 2D de memorias de ENGRAM" width="640">

<img src="visual/2D/Screenshot%20from%202026-11-17%2016-38-43.png" alt="Superficie 2D de procedencia de ENGRAM" width="640">

<img src="visual/2D/Screenshot%20from%202026-11-17%2016-39-22.png" alt="Superficie 2D móvil de ENGRAM" width="320">

### El observatorio

![Observatorio XR de ENGRAM](visual/observatory/01-observatory.png)

![Instrumento de verificación de ENGRAM](visual/observatory/06-verification-vault.png)

Las capturas de interacción con manos todavía se están preparando. La
evidencia XR actual proviene del emulador y de superficies renderizadas; no es
una afirmación de validación en un Quest físico.

## Lo que ya está hecho

- Canvas y observatorio XR leen el mismo campo respaldado por MNEME.
- Cadenas de custodia, autoridad, impacto causal tipado y deltas
  contrafactuales aparecen como estructuras de evidencia distintas.
- Una cuarentena real autorizada por MNEME se prepara, previsualiza y confirma
  mediante el flujo de demo.
- El bundle se exporta y se verifica mediante el proceso offline separado de
  MNEME; la interfaz muestra ese resultado, no uno inventado.
- Hay pruebas y chequeos de readiness para el tour guiado, la exploración
  libre, el adaptador, el build y las invariantes de presentación. Los
  alcances exactos están en el [README técnico](README_TECHNICAL.md).

## Limitaciones, sin esconderlas

Esto es un prototipo de investigación para una competencia, no un servicio de
memoria listo para producción. La demo pública usa un token de lectura
compartido, un login de demostración y un despliegue sin volumen persistente,
por lo que el campo sembrado puede reiniciarse después de un cold start. El
comportamiento XR fue ejercitado en el emulador IWER Quest 3; el confort, el
tracking y la legibilidad en hardware físico todavía requieren pruebas. También
falta evaluar con investigadores reales si la inspección espacial descubre
algo que una interfaz 2D vuelve difícil de advertir.

El detalle completo de limitaciones, amenazas, fallos y trabajo pendiente está
en el [README técnico](README_TECHNICAL.md).

## Proveniencia del desarrollo

Algunas decisiones de implementación y diseño se trabajaron con asistencia de
OpenAI Codex, Kimi, Anthropic Claude y el modelo Muse de Meta. La autora dirigió
el trabajo, integró los cambios y verificó el comportamiento resultante; esa
asistencia no se presenta como validación de usuarios.

## Para seguir

- [README técnico](README_TECHNICAL.md) — arquitectura, evidencia, límites,
  fronteras de confianza y reproducibilidad.
- [README en inglés](README.md) — versión humana para jurados.
- [Escenario de demo](docs/DEMO-SCENARIO.md) — la investigación sintética.
- [Evaluación release candidate de XR](docs/XR-RELEASE-CANDIDATE-ROUND12.md) —
  comprobaciones observadas y riesgos abiertos.

## Licencia

Apache License 2.0. Copyright 2026 Anna Tchijova.
