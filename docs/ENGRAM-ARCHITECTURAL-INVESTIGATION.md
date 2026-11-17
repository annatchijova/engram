# Investigación arquitectónica de ENGRAM

## Estado de la investigación

**CODE FACT:** `/home/labestiadevigia/engram` está vacío en el remoto; sólo contiene la preparación Git/Devpost. No hay MNEME dentro de ENGRAM todavía.

**CODE FACT:** el MNEME existente está en `/home/labestiadevigia/mneme`, commit `bde801a`.

**VERIFICACIÓN:** las suites ejecutadas como scripts pasan:

- authority: 142
- bundle: 128
- causality: 86
- claims: 66
- conformance: 48
- counterfactual: 39
- custody: 40
- field: 44
- influence: 25
- protocol vectors: 20
- provenance: 45
- semantic mutants: 16 killed, 3 survivors declarados
- spec agreement: 80

`pytest` no es el runner correcto para este repositorio: los tests llaman `sys.exit()` durante la colección. Eso produjo un error interno de pytest después de ejecutar correctamente parte de las pruebas.

Esta investigación aplica `destination-driven-construction`, `software-archaeology` y `claim-provenance-discipline`.

---

## 1. Mapa de capacidades de MNEME

### Creación y evolución de memorias

**CODE FACT** — [`mneme/field.py:344`](/home/labestiadevigia/mneme/mneme/field.py:344), `store()`:

- crea una fila inmutable en `memories`;
- calcula `content_sha256`;
- crea el evento `STORED` como secuencia 0;
- exige `STORE`, salvo campos todavía sin ledger de autoridad;
- registra actor, razón, embedding y metadatos;
- puede declarar `topic`, `claim` y `derived_from_decision`;
- detecta contradicciones por `topic + claim`;
- crea links `INHIBITORY` bidireccionales;
- escribe `CONTRADICTED_BY` en ambas cadenas.

**Invariantes:**

- M1: el contenido no se edita;
- M2: escritura y evento deben compartir transacción;
- M3: la cadena comienza en `STORED`;
- la autoridad de la operación queda sellada en el payload;
- una contradicción es bilateral.

**Boundary:** el actor que llama es una fuente de datos no confiable; MNEME puede demostrar consistencia e identidad declarada, no que el contenido sea verdadero.

**Reutilización ENGRAM:** reutilizar directamente como operación de dominio, pero detrás de un adaptador servidor. Nunca escribir SQLite desde WebXR.

### Supersession

**CODE FACT** — [`mneme/field.py:477`](/home/labestiadevigia/mneme/mneme/field.py:477), `supersede()`:

- crea una nueva memoria;
- exige `SUPERSEDE`;
- escribe `supersedes` en el sucesor;
- escribe `SUPERSEDED_BY` en el predecesor;
- cambia el predecesor a `SUPERSEDED`;
- rechaza predecesores no `CLEAN`;
- tiene una defensa de carrera para evitar dos sucesores.

**Invariante:** la actualización conceptual es una nueva entidad y una relación bilateral, nunca un `UPDATE content`.

**ENGRAM:** la interacción “reemplazar” debe presentarse como “crear una nueva versión y retirar la anterior”, no como editar un objeto físico.

### Reinforcement y estado de campo

**CODE FACT** — [`mneme/field.py:579`](/home/labestiadevigia/mneme/mneme/field.py:579), `reinforce()`:

```text
c' = c + 1/4 · (1 - c)
```

- usa `Fraction`;
- cuantiza sólo al borde SQL/hash;
- exige `REINFORCE`;
- rechaza memorias no `CLEAN`;
- crea `REINFORCED`;
- puede crear `STATE_CHANGED` al cruzar `3/4`;
- ambas operaciones usan la misma autorización.

**Estados:** `REINFORCED`, `NEUTRAL`, `FORGOTTEN`.

Reinforcement no significa “verdad”. Significa que una operación autorizada aumentó confianza operacional dentro del campo.

**ENGRAM:** la geometría debe distinguir `confidence`, `field_state` y `epistemic standing`. No deberían ser tres niveles de brillo equivalentes.

### Contradicción

Hay dos capas distintas:

1. **Contradicción documental/simple:** `field.store()` detecta mismo topic y claims distintos.
2. **Contradicción epistemológica:** [`mneme/claims.py:364`](/home/labestiadevigia/mneme/mneme/claims.py:364) separa proposiciones de documentos.

**CODE FACT:** claims soporta `SUPPORTS`, `CONTRADICTS`, `SUPERSEDES` y `DERIVED_FROM`, además de restricciones n-arias:

- `AT_MOST_ONE`
- `EXACTLY_ONE`
- `INCOMPATIBLE`

**CODE FACT** — [`mneme/claims.py:690`](/home/labestiadevigia/mneme/mneme/claims.py:690), `standing()`:

- recalcula el standing;
- no guarda confidence epistemológica;
- excluye evidencia no `CLEAN`;
- informa por separado evidencia retenida;
- no transforma evidencia abundante en `VALIDATED` automáticamente.

**Invariantes:** C1 proposición inmutable; C3 standing derivado; C4 relaciones bilaterales; C5 resolución satisfecha; C6 reabrir una proposición validada requiere `ADJUDICATE`.

**ENGRAM:** la contradicción no debería representarse como dos nodos “chocando”. El estado real puede ser una restricción entre varias proposiciones, con estado `UNDETERMINED`, `SATISFIED` o `VIOLATED`.

### Custodia y provenance

**CODE FACT** — [`mneme/custody.py:242`](/home/labestiadevigia/mneme/mneme/custody.py:242), `CustodyEntry`; [`mneme/chain.py:202`](/home/labestiadevigia/mneme/mneme/chain.py:202), `append()`:

Cada memoria posee una cadena independiente:

```text
prev_hash || canonical_json(envelope)
```

El genesis está ligado al `memory_id`:

```text
sha256("MNEME_CUSTODY_GENESIS:" || memory_id)
```

La cadena exige secuencia densa desde cero, `STORED` como primer evento, timestamps UTC canónicos y no decrecientes, `reason` no vacío, vocabulario cerrado y versionado, `UNIQUE(memory_id, prev_hash)` y `UNIQUE(entry_hash)`.

**CODE FACT:** [`mneme/custody.py:306`](/home/labestiadevigia/mneme/mneme/custody.py:306), `replay_state()` reconstruye custody status, field state, confidence, transitions y supersession.

**ENGRAM:** la cadena no debe convertirse en una “textura” decorativa. Debe ser una estructura inspeccionable, con eventos individuales, razones y hashes verificables.

### Quarantine

#### Actor quarantine

**CODE FACT** — [`mneme/trust.py:109`](/home/labestiadevigia/mneme/mneme/trust.py:109), `quarantine_actor()`:

Hace dos cosas en una transacción:

1. retrospectivamente marca memorias tocadas por el actor;
2. prospectivamente escribe `ACTOR_QUARANTINED` y elimina sus capacidades efectivas.

La definición de “tocado” excluye:

```python
NON_INFLUENCE_EVENTS = (
    "CONTRADICTED_BY",
    "DECISION_USED_MEMORY",
)
```

Esto evita que un actor silencie una memoria simplemente por contradecirla o citarla en una decisión.

El `TaintSweep` contiene actor, iniciador, memorias marcadas, seal del conjunto y vecinos `RESONANT` consultados pero no automáticamente tainted.

#### Memory quarantine

**CODE FACT** — [`mneme/trust.py:258`](/home/labestiadevigia/mneme/mneme/trust.py:258), `quarantine_memory()`:

- requiere `QUARANTINE_MEMORY`;
- crea `QUARANTINED`;
- preserva evidencia;
- no tiene reversal implementado.

#### Rehabilitation

**CODE FACT** — [`mneme/trust.py:317`](/home/labestiadevigia/mneme/mneme/trust.py:317), `rehabilitate_memory()`:

- sólo revierte `TAINT_FLAGGED`;
- requiere `REHABILITATE`;
- no puede revertir `QUARANTINED`;
- no puede ejecutarse desde un actor quarantineado;
- escribe `REHABILITATED`.

**Límite documentado:** una quarantine directa todavía no tiene camino de reversión.

**ENGRAM:** “quarantine” necesita distinguir físicamente cuarentena de actor, cuarentena directa de memoria, taint transitorio y exposición indirecta. No deben compartir el mismo gesto ni la misma representación.

### Autoridad

**CODE FACT** — [`mneme/authority.py:133`](/home/labestiadevigia/mneme/mneme/authority.py:133), capacidades cerradas:

- `STORE`
- `REINFORCE`
- `SUPERSEDE`
- `QUARANTINE_ACTOR`
- `QUARANTINE_MEMORY`
- `REHABILITATE`
- `GRANT`
- `REVOKE`
- `DECIDE`
- `ASSERT`
- `ADJUDICATE`
- `COUNTERFACTUAL`

La autoridad es una cadena por actor, separada de la custodia de memorias.

**CODE FACT:** `bootstrap_root()` está en `mneme/authority.py:835`, `register_actor()` en `:900`, `grant()` en `:943`, `revoke()` en `:1017`, `quarantine_actor_authority()` en `:1058` y `reinstate_actor()` en `:1094`.

**Invariantes:** A1 cada mutación nombra un grant; A2 chains ligadas al actor; A3 no amplification; A4 revocation es evento; A5 actor quarantineado no tiene capacidades; A6 nunca se elimina el último holder de `GRANT`; A7 ampliar el custody gate es una lectura autorizada.

**Límite crítico:** el root es self-issued durante bootstrap. MNEME no vincula automáticamente ese actor con una identidad externa, key, hardware token o ceremonia.

**ENGRAM:** el cliente XR jamás puede decidir que una mano “es” un actor autorizado. La sesión XR debe recibir una identidad autenticada externamente y el servidor debe comprobar el grant.

### Recall

**CODE FACT** — [`mneme/field.py:903`](/home/labestiadevigia/mneme/mneme/field.py:903), `recall()`:

1. sólo permite `CLEAN`;
2. evita que memorias no limpias sean seed;
3. evita que atraviesen el BFS como intermediarias;
4. excluye `FORGOTTEN`;
5. calcula ranking exacto con `Fraction`;
6. usa tie-break por `memory_id`;
7. produce `RecallReceipt`.

El score es:

```text
sim(q,m) · (state_boost · (43/50)^hop + resonant_boost)
```

La recepción registra query hash, seed, memoria servida y orden, exclusiones, `top_k`, `hops`, ranking protocol, mundo hipotético y `as_of`.

Recall es read-only. Persistir el recibo es acción explícita mediante `persist_receipt()`.

**Límite:** `mcp_server.py` usa embeddings determinísticos derivados de SHA-256 y los marca `is_semantic: False`. Eso da reproducibilidad, no semántica.

**Límite:** el repositorio no muestra una interfaz pública para crear links `RESONANT`; actualmente la escritura visible de links es la creación automática de `INHIBITORY` en `field.store()`. Un gesto XR “conectar resonantemente” requeriría un contrato nuevo.

### Causalidad, decisiones e impacto

**CODE FACT** — [`mneme/causality.py:170`](/home/labestiadevigia/mneme/mneme/causality.py:170), `record_decision()`:

- exige `DECIDE`;
- exige un `RecallReceipt` persistido;
- rechaza recibos counterfactuales;
- exige que `used_memory_ids` sea subconjunto de lo servido;
- guarda sólo `decision_sha256`, no el artefacto;
- escribe `DECISION_USED_MEMORY` en cada memoria;
- verifica la relación en ambas direcciones.

Esto permite responder “qué decisión usó esta memoria”, pero no reconstruir el razonamiento de la decisión.

**CODE FACT** — [`mneme/causality.py:365`](/home/labestiadevigia/mneme/mneme/causality.py:365), `impact()` distingue:

- `DIRECT`: recibos y decisiones que nombran directamente la memoria;
- `DERIVED`: supersession y descendencia declarada;
- `DERIVED_UNATTESTED`: derivación declarada por terceros;
- `POSSIBLE`: co-servicio y vecinos resonantes.

**Límite:** `POSSIBLE` no es causalidad probada. `DERIVED` depende de declaraciones explícitas y no siempre es bilateral.

**ENGRAM:** una expansión física debe mostrar estas categorías como epistemologías distintas, no como distancias visuales equivalentes.

### Counterfactuals

**CODE FACT** — [`mneme/counterfactual.py:172`](/home/labestiadevigia/mneme/mneme/counterfactual.py:172), `compare_worlds()`:

Compara dos estados de custody para una misma query y sella memorias removidas, memorias que entraron, cambios de ranking, cambios de score, cambios de outcome de claims, decisiones cuyo input cambió e `interference`.

`containment_effect()` pregunta qué habría ocurrido sin la contención. `exclusion_effect()` predice qué cambia si se excluyen memorias.

**Límites:** es por query, compara recall y no el razonamiento del agente, no re-ejecuta decisiones, y una delta vacía no significa “no hubo impacto en todo el sistema”.

Ampliar el gate para revelar memorias retenidas requiere `COUNTERFACTUAL`.

**ENGRAM:** el mundo alternativo debe ser visualmente imposible de confundir con el mundo factual. No alcanza con cambiar el color del fondo.

### Bundles y verificación

**CODE FACT** — [`mneme/bundle.py:230`](/home/labestiadevigia/mneme/mneme/bundle.py:230), `export_bundle()`:

Exporta memorias, chains, sweeps, receipts, decisiones, claims, claim sets, authority chains, lineage excluido, Merkle roots, protocols declarados y bundle seal.

**CODE FACT:** [`mneme/bundle.py:1014`](/home/labestiadevigia/mneme/mneme/bundle.py:1014), `verify_bundle_verbose()` ejecuta B0–B9.

**CODE FACT:** [`verify_offline.py:1170`](/home/labestiadevigia/mneme/verify_offline.py:1170) es un verificador independiente stdlib-only.

Esto es deliberado: compartir escritor y verificador ocultaría errores comunes.

**ENGRAM:** una exportación XR debe mostrar “bundle verificable”, no “la escena es verdadera”. La escena sólo puede presentar el resultado del verificador y sus límites.

---

## 2. Definición del destino ENGRAM

### Qué es ENGRAM

**DESIGN PROPOSAL**

ENGRAM es un entorno XR para investigar y actuar sobre memoria computacional verificable. No muestra una base de datos en 3D: convierte custody, autoridad, contradicción, causalidad y mundos alternativos en operaciones espaciales con consecuencias semánticas reales.

El usuario puede inspeccionar cómo nació una memoria, seguir su cadena de custody, separar contenido/evidencia/autoridad/standing, ver quién podía causar cada transición, examinar contradicciones y restricciones n-arias, preparar y ejecutar operaciones autorizadas, medir blast radius, comparar mundos factual/counterfactual, exportar evidencia y auditar por qué una representación no es concluyente.

### Por qué necesita XR

ENGRAM necesita XR sólo si el espacio permite representar simultáneamente temporalidad, capas de evidencia, relaciones causales, cambios de custody, separación entre hecho/hipótesis/posibilidad y comparación de mundos.

Una vista 2D puede mostrar un grafo. No puede, con la misma naturalidad, permitir que el usuario extraiga una cadena desde una memoria, gire el objeto para pasar de contenido a provenance, separe una proposición de sus documentos, sostenga dos mundos alternativos en paralelo, observe qué relaciones desaparecen al aplicar una exclusión o confine una entidad y vea qué conexiones dejan de ser servibles.

Si ENGRAM sólo agrega nodos flotantes y gestos de selección, será una visualización de MNEME, no una adaptación estructuralmente necesaria.

### Relación MNEME–ENGRAM

```text
MNEME
  autoridad epistemológica y determinista
  estado persistente
  operaciones autorizadas
  replay
  hashes
  bundles
  verificación

ENGRAM
  interpretación espacial
  interacción humana
  previews
  navegación
  comparación visual
  feedback
```

ENGRAM no puede inventar nuevas relaciones causales, autoridad, standing, custody status, hechos sobre el bundle ni resultados de una mutación.

### Frontera de autoridad

```text
mano / gesto
  → intención candidata
  → confirmación semántica
  → comando tipado
  → servidor MNEME
  → autorización + precondiciones
  → transacción
  → nuevo estado/eventos
  → snapshot/version
  → ENGRAM actualiza representación
```

No debe existir el flujo “la mano cambia color/local state y luego se sincroniza”.

### Determinismo

Debe quedar del lado MNEME: replay, custody transitions, authority checks, confidence arithmetic, ranking, impact classification, counterfactual delta, canonical serialization, hashes y verification.

Puede ser no determinista o aproximado: layout espacial, interpolación, animaciones, selección de cámara y reconocimiento inicial de gestos, siempre que éste produzca sólo una intención candidata.

### Mutaciones permitidas desde XR

Sólo comandos que correspondan a capacidades MNEME: `STORE`, `REINFORCE`, `SUPERSEDE`, `QUARANTINE_ACTOR`, `QUARANTINE_MEMORY`, `REHABILITATE`, `DECIDE`, `ASSERT`, `ADJUDICATE` y `COUNTERFACTUAL` para ampliar lectura.

Cada mutación debe incluir actor, grant esperado, razón, precondición de snapshot, idempotency key, operación solicitada, confirmación explícita y resultado devuelto por MNEME.

---

## 3. Ontología espacial

| MNEME | Representación espacial | Interacción | Transición permitida | Invariante | Ambigüedad |
|---|---|---|---|---|---|
| Memoria | objeto estable, con identidad visible | acercar / inspeccionar | ninguna | contenido inmutable | ID y hash siempre visibles bajo demanda |
| `STORED` | raíz física de una cadena | extraer línea de eventos | ninguna | seq 0 y genesis | si falta cadena, mostrar “incompleta” |
| Custody chain | hilo/columna ordenada por eventos | recorrer, expandir, comparar | sólo lectura | hashes y secuencia | evento ilegible = verificación fallida |
| Authority chain | estructura separada, no “halo” de prestigio | seleccionar actor/grant | sólo lectura salvo operaciones autorizadas | no amplification | mostrar quién emitió el grant |
| `CLEAN` | disponible para recall | tomar/consultar | lectura | servable | no significa verdadero |
| `TAINT_FLAGGED` | confinado con etiqueta de sweep | rehabilitar, sólo con autoridad | `REHABILITATED` | no se limpia manualmente | distinguir taint de quarantine directa |
| `QUARANTINED` | recinto cerrado | inspeccionar; no liberar con gesto simple | sólo nueva operación diseñada | gate de custody | sin reversal actualmente |
| `SUPERSEDED` | nodo histórico retirado, conectado al sucesor | seguir lineage | ninguna edición | M1, bilateralidad | no mostrarlo como borrado |
| `REINFORCED` | peso o estabilidad del campo | reforzar con confirmación | confidence exacta | threshold 3/4 | no representar como verdad |
| `INHIBITORY` | tensión/constraint entre entidades | inspeccionar contradicción | no editar desde “connect” | bilateralidad | pares pueden ser insuficientes |
| Claim | proposición separada de documentos | abrir standing | ASSERT/ADJUDICATE | C1–C6 | `ASSERTED` no es validación |
| Claim set | recinto de hipótesis | resolver conjunto | `VALIDATED`/`REFUTED` | resolución satisface constraint | `UNDETERMINED` debe permanecer visible |
| Recall receipt | bandeja de resultados servidos | fijar receipt | persistir explícitamente | sólo lo servido puede citarse | omitted/excluded counts visibles |
| Decision | objeto derivado del receipt | registrar decisión | `DECIDE` | subset bilateral | hash no revela razonamiento |
| Impact | volumen de consecuencias etiquetadas | recorrer edges | ninguna | DIRECT/DERIVED/POSSIBLE separados | possible no es causal |
| Counterfactual | segunda cámara o mundo paralelo | excluir/restaurar | sólo simulación sellada | nunca factual | etiquetar mundo y query |
| Bundle | artefacto exportable | verificar/importar | ninguna | B0–B9 | exclusions declaradas |

### Crítica de las metáforas candidatas

- **Inspeccionar una memoria expone custody:** sólida, si expone evidencia y no convierte custody en verdad.
- **Separar capas expone authority:** útil, pero una capa superior puede implicar autoridad superior. Debe mostrarse como relación de grants.
- **Quarantine como manipulación física:** válida, pero debe tener preview y commit explícito. Actor y memoria requieren gestos distintos.
- **Causalidad que se propaga:** debe propagarse como resultado computado y etiquetado, no como aura.
- **Eliminar una memoria crea counterfactual:** correcto sólo si crea un mundo hipotético separado y no altera MNEME.
- **Blast radius físico:** potente si DIRECT, DERIVED y POSSIBLE son clases incompatibles.
- **Contradicciones espaciales:** es mejor representar restricciones y claims que “colisiones” entre memorias.

---

## 4. Gramática de interacción

### Inspect

```text
acción física: acercar, mirar, pinchar para abrir
significado: consultar estado/provenance
autoridad: ninguna
operación: query read-only
feedback: cadena, hashes, estado, límites
reversibilidad: total
```

### Expose

```text
acción física: separar capas del objeto
significado: cambiar vista entre contenido, custody, authority, claims
autoridad: ninguna
operación: query read-only
feedback: cada capa rotulada
reversibilidad: total
```

No significa separar físicamente la memoria del sistema.

### Stage

```text
acción física: tomar una entidad y colocarla en un espacio de operación
significado: preparar una intención
autoridad: todavía ninguna mutación
operación: construir command preview
feedback: “esto intentará QUARANTINE_MEMORY sobre M”
reversibilidad: total antes del commit
```

### Commit

```text
acción física: gesto explícito de confirmación distinto
significado: solicitar la transición
autoridad: servidor verifica grant
operación: comando MNEME transaccional
feedback: éxito, rechazo, conflicto o verificación fallida
reversibilidad: depende de MNEME
```

### Compare

```text
acción física: sostener/separar dos cámaras
significado: comparar dos snapshots o mundos
autoridad: widening counterfactual si corresponde
operación: compare_worlds
feedback: delta sellada y query-scoped
reversibilidad: total, no muta
```

### Trace

```text
acción física: tirar de una línea/event edge
significado: recorrer causalidad/provenance
autoridad: ninguna
operación: query
feedback: DIRECT / DERIVED / POSSIBLE
reversibilidad: total
```

### Adjudicate

```text
acción física: colocar claims en una estructura de resolución
significado: declarar cuál hipótesis se valida/refuta
autoridad: ADJUDICATE
operación: resolve_set
feedback: constraint satisfied/violated
reversibilidad: no tratar como undo; es otra decisión auditada
```

### Gestos que no deben existir sin una nueva interfaz MNEME

- “conectar” para crear cualquier relación;
- “borrar” una memoria;
- “arrastrar a limpio” para rehabilitar;
- “mover hacia arriba” para elevar autoridad;
- “sacudir” para resolver contradicciones;
- “soltar” para ejecutar una mutación.

---

## 5. Arquitectura final

```text
┌─────────────────────────────────────┐
│ ENGRAM XR / IWSDK / WebXR           │
│ layout, hands, spatial interaction  │
└──────────────────┬──────────────────┘
                   │ typed intents + snapshots
┌──────────────────▼──────────────────┐
│ ENGRAM Adapter / Command Gateway    │
│ mapping, previews, idempotency,     │
│ stale-state checks, session actor   │
└──────────────────┬──────────────────┘
                   │ authenticated commands/queries
┌──────────────────▼──────────────────┐
│ MNEME Service Boundary              │
│ authority, transactions, persistence│
└──────────────────┬──────────────────┘
                   │
┌──────────────────▼──────────────────┐
│ MNEME core                          │
│ field, custody, trust, authority,   │
│ causality, counterfactual, claims,  │
│ bundle, offline verifier            │
└─────────────────────────────────────┘
```

### Componentes

#### MNEME core

Reutilizar `mneme/field.py`, `custody.py`, `authority.py`, `trust.py`, `causality.py`, `counterfactual.py`, `claims.py`, `bundle.py`, `protocol.py` y `verify_offline.py`.

No duplicar estas semánticas en TypeScript.

#### ENGRAM adapter

Debe introducir comandos versionados, queries read-only, `expected_snapshot` o version check, actor/session binding, idempotency keys, previews, error codes semánticos y traducción de IDs XR a IDs MNEME.

#### XR state model

Debe distinguir:

- `authoritative_snapshot`;
- `pending_intent`;
- `rendered_projection`;
- `verification_state`;
- `interaction_state`;
- `counterfactual_world`.

Nunca usar el estado visual como cache implícitamente confiable.

#### Spatial representation

Cada entidad visual necesita identidad, fuente, timestamp/snapshot, clase epistemológica, estado de verificación y clasificación factual/hipotética/advisory.

#### Persistence

La autoridad debe persistir en backend. El browser/WebXR sólo puede tener cache, sesión, layout y pending interaction. No debe contener el único registro de un gesto mutante.

#### IWSDK/WebXR

Inicialmente es una capa de transporte/presentación, no una fuente de estado. Quest-specific integration puede añadirse para hand tracking, passthrough, anchors, ergonomía, seated mode y profiling, pero no se debe afirmar compatibilidad con Quest o glasses hasta probarla.

### Arquitecturas que violarían invariantes

1. SQLite en el navegador: la representación se vuelve autoridad.
2. Optimistic mutation: el gesto cambia estado antes de autorización.
3. GraphQL genérico sin comandos tipados: pierde las diferencias entre operaciones.
4. Una sola clase `Entity`: mezcla memoria, claim, decision y grant.
5. Un único “confidence score”: colapsa field state, claim standing y custody.
6. Un mapa visual sin protocolo versionado: aplica semántica nueva a evidencia vieja.
7. Inferir causalidad desde proximidad espacial: confunde POSSIBLE con DIRECT.
8. Crear links resonantes desde el cliente: actualmente no existe una operación MNEME autorizada que los respalde.

---

## 6. Niveles de construcción

No son MVPs ni fases técnicas. Son estados coherentes de ENGRAM.

### Nivel 1 — Provenance Field

**Capacidad visible:** el usuario inspecciona memorias reales de MNEME y recorre custody, authority y estado.

**Arquitectura:** adapter read-only, snapshots, representación espacial de una memoria y su cadena.

**MNEME ejercitado:** `recall`, `mneme_custody_chain`, `mneme_authority`, bundle metadata.

**Invariantes:** M1–M5, A1–A7 y ausencia de autoridad XR.

**Preguntas adversariales:**

- ¿Puede una memoria no `CLEAN` aparecer como servable?
- ¿Una cadena truncada se marca como incompleta?
- ¿El layout sugiere más autoridad que la indicada por el ledger?
- ¿Se distingue confidence de verdad?

Si el trabajo se detiene aquí, sigue siendo una herramienta usable de inspección de memoria verificable.

### Nivel 2 — Audited Containment

**Capacidad visible:** el usuario prepara y ejecuta quarantine de actor o memoria, con preview, confirmación y resultado auditado.

**Arquitectura:** command gateway, actor session, grants, idempotency y conflict checking.

**MNEME ejercitado:** quarantine actor, direct quarantine, rehabilitation donde corresponda y resultados auditados.

**Invariantes:** M2, M4, A5, A6 y separación entre quarantine y rehabilitation.

**Preguntas adversariales:**

- ¿Puede un gesto ambiguo causar quarantine?
- ¿Puede el actor XR rehabilitar sus propios datos?
- ¿Una operación repetida produce doble evento?
- ¿La UI muestra que direct quarantine no tiene reversal?
- ¿La vista muestra taint advisory como custody status?

### Nivel 3 — Causal Field

**Capacidad visible:** el usuario sigue recall → receipt → decision → impact.

**Arquitectura:** causal projection, edge classification, decision artifact references y evidence completeness.

**MNEME ejercitado:** `persist_receipt`, `record_decision`, `impact`, claims standing.

**Invariantes:** sólo se puede citar lo servido; bilateralidad; `decision_sha256` no se presenta como razonamiento.

**Preguntas adversariales:**

- ¿POSSIBLE parece DIRECT?
- ¿Una decisión aparece sin receipt persistido?
- ¿Se confunde “input changed” con “outcome changed”?
- ¿Se muestra evidencia ausente o sólo la presente?

### Nivel 4 — Counterfactual Chambers

**Capacidad visible:** el usuario compara mundo factual y mundos hipotéticos sellados.

**Arquitectura:** world-scoped projections, immutable snapshots, labels explícitos y autorización para widening.

**MNEME ejercitado:** `compare_worlds`, `containment_effect`, `exclusion_effect`.

**Invariantes:** counterfactual nunca es factual; delta query-scoped; widening requiere `COUNTERFACTUAL`; una simulación no se persiste como decisión factual.

**Preguntas adversariales:**

- ¿Puede exportarse un counterfactual como evidencia factual?
- ¿El mundo alternativo usa el snapshot correcto?
- ¿Una delta vacía se presenta como “sin impacto global”?
- ¿La query forma parte del resultado sellado?

### Nivel 5 — Portable Epistemic Instrument

**Capacidad visible:** múltiples investigadores inspeccionan, operan, comparan y exportan evidencia verificable.

**Arquitectura:** backend multiusuario, protocolos versionados, concurrencia explícita, bundle handoff, offline verifier e integración de device.

**Invariantes adicionales:** stale snapshots rechazados, ninguna mutación parcial, exclusiones declaradas, bundles viejos verificados bajo sus protocolos y fallos visibles.

**Preguntas adversariales:**

- ¿Qué ocurre si dos operadores quarantinean simultáneamente?
- ¿Qué sucede si la red cae durante el commit?
- ¿Puede un cliente viejo interpretar un protocolo nuevo?
- ¿Qué evidencia queda si una interacción se interrumpe?
- ¿Puede un bundle parcial parecer completo?

---

## 7. Threat / epistemic model

| Amenaza | Consecuencia | Defensa requerida |
|---|---|---|
| Provenance falsificada | historia coherente pero inventada | declarar que hash no equivale a verdad; external identity/root sigue abierto |
| Timestamp falso | orden interno válido, cronología real falsa | servidor genera tiempo; mostrar “declared time” |
| XR stale state | operación sobre pantalla antigua | snapshot/version precondition |
| Gesture ambiguity | mutación no intencional | stage → preview → explicit commit |
| Replay | repetir quarantine/reinforce | idempotency key + preconditions |
| Spatial misrepresentation | advisory interpretado como hecho | clase epistemológica obligatoria |
| Omisión causal | graph parece cerrado aunque faltan edges | mostrar exclusions e incompletitud |
| Visual authority inflation | tamaño/color implica poder | autoridad sólo desde capabilities |
| Counterfactual leakage | simulación interpretada como evidencia | world labels y tipos separados |
| Concurrent mutation | supersession o governance inconsistente | servidor transaccional y conflictos explícitos |
| Verification failure | escena sigue mostrando datos confiables | estado `UNVERIFIED`, sin fallback silencioso |
| Partial physical interaction | objeto queda “a mitad” | pending intent no es estado MNEME |
| Forged embedding | vector firmado pero mal calculado | mostrar límite del embedding boundary |
| Causal overclaim | DERIVED/POSSIBLE tratado como causalidad | categorías separadas |
| Direct quarantine sin reversión | operador cree que existe undo | UI debe decirlo antes del commit |
| Read audit gap | widened counterfactual no queda auditado | decidir si ENGRAM necesita read audit adicional |
| Missing resonant writer | interacción “connect” no tiene contrato | no exponer gesto hasta diseñar operación MNEME |

Los tres survivors de la mutation suite son especialmente relevantes:

1. un embedder que entrega un vector que nunca calculó;
2. un atacante que fabrica un campo entero coherente;
3. un exporter hostil que omite autoridad.

ENGRAM no debe crear una falsa sensación de resolver esos límites con visualización.

---

## 8. Competition fit

La página oficial describe una competencia online para experiencias hands-first en Meta VR devices, incluyendo Quest y Meta VR Glasses, con categorías de entretenimiento, gaming y productivity.

**Encaje genuino:**

- Productivity: ENGRAM ayuda a investigar decisiones y memoria computacional.
- Hands-first: separar capas, staging, comparación de mundos y confinement pueden tener significado real.
- Seated/small-radius: el campo debe estar alrededor del usuario, sin exigir locomoción.
- IWSDK/WebXR: adecuado como entrada inicial sin asumir todavía integración específica de Quest.

**Affordances con valor real:**

- hand tracking para tomar una memoria y abrir su evidencia;
- dos manos para comparar factual/counterfactual;
- gestos de separación para cambiar capas semánticas;
- spatial anchoring para mantener el field estable;
- passthrough sólo si ayuda a seguridad o ergonomía.

**Gimmicks a evitar:**

- explosion animations sin relación con datos;
- nodos flotantes por cada fila SQL;
- “gravity” como simulación de causalidad;
- colores de autoridad no derivados de capabilities;
- usar voz o gestos sólo para replicar botones 2D;
- hacer que el usuario camine para descubrir un grafo.

La competencia no debe cambiar la ontología de MNEME. Debe mostrar por qué esa ontología se vuelve más operable en XR.

---

## 9. Preguntas abiertas prioritarias

### P0 — Producto y verdad espacial

1. ¿Qué operación ENGRAM debe ser imposible o claramente peor en 2D?
2. ¿Cuál será el primer flujo completo: provenance, containment, causal impact o counterfactual?
3. ¿Qué significa exactamente “manipular” una memoria sin sugerir que el usuario manipula la verdad?

### P1 — Contrato MNEME–ENGRAM

4. ¿ENGRAM será un cliente remoto de MNEME o ambos vivirán en el mismo proceso?
5. ¿Qué identidad externa representará al actor XR?
6. ¿Necesitamos auditar lecturas XR, especialmente counterfactual widening?
7. ¿Cómo se versionará el command adapter?

### P1 — Relaciones faltantes

8. ¿ENGRAM necesita crear `RESONANT` links?
9. Si sí, ¿qué operación MNEME, capability, evento y protocolo los autorizarán?
10. ¿Un link resonant será una afirmación causal, una asociación del usuario o una derivación explícita?

### P1 — Escala y persistencia

11. ¿SQLite es suficiente para el primer nivel real de ENGRAM?
12. ¿Qué snapshot/concurrency model se necesita para dos operadores?
13. ¿Cómo se transportarán bundles y verificaciones sin introducir una segunda semántica?

### P2 — UX y hardware

14. ¿Qué hand tracking real está disponible para la primera build?
15. ¿Qué parte puede probarse con WebXR emulator sin declarar compatibilidad física?
16. ¿Cuál es el seated interaction radius y qué ocurre cuando el usuario pierde tracking?
17. ¿Cómo se representa un failure de red durante un commit?

### P2 — Claims y decisiones

18. ¿ENGRAM permitirá adjudicación real o sólo inspección durante la competencia?
19. ¿Cómo se presenta `decision_sha256` sin sugerir que el sistema conoce el razonamiento?
20. ¿Cómo se hace visible la evidencia omitida en bundles parciales?

---

## Conclusión

MNEME ya contiene un núcleo fuerte y poco común: integridad, autoridad separada, custody, recall determinista, causalidad y counterfactuals.

El riesgo principal de ENGRAM no es técnico sino epistemológico: construir una escena espacial que parezca más cierta que MNEME. La arquitectura correcta es:

> MNEME decide y prueba. ENGRAM hace que esas decisiones puedan inspeccionarse y operarse corporalmente.

La primera decisión de producto no debería ser qué framework usar, sino qué operación de memoria gana un significado que sólo la geometría puede expresar.
